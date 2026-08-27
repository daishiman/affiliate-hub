import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type {
  EditorialContentPackageRepositoryPort,
  EditorialContentVariantRepositoryPort,
} from "@/application/ports/authoring";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import type {
  ChannelConnectionRepositoryPort,
  ChannelConnectorProviderPort,
  ManualExportPort,
  PublicationRepositoryPort,
} from "@/application/ports/distribution";
import type { ContentVariant } from "@/domain/authoring";
import { evaluateExternalPublicationGate } from "@/domain/compliance";
import {
  CHANNEL_CAPABILITIES,
  type ChannelConnection,
  type ChannelCapability,
  type ChannelKind,
  type Publication,
  type PublicationState,
  type PublishMode,
  type PublishState,
  PUBLICATION_STATE_LABEL,
  advance,
  buildIdempotencyKey,
  createChannelConnection,
  createPublication,
  isConnectionUsable,
  publicationMutationConflict,
  rendersOwnArticle,
  supportsDirectPublish,
  supportsExternalDirectPublish,
} from "@/domain/distribution";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type ChannelConnectionId,
  type ContentVariantId,
  type DomainError,
  type PublicationId,
  type Result,
  type WorkspaceId,
  assertSameTenant,
  assertWorkspaceWideAccess,
  domainError,
  err,
  ok,
  taggedString,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";
import {
  ensurePublicationBrandAccess,
  ensureVariantBrandAccess,
  filterPublicationsByBrandScope,
  publicationListScopeOf,
  type PublicationBrandAccessDeps,
} from "./publication-brand-access";

/**
 * 配信（どこへ出すか）のユースケース。
 *
 * ここでの中心は **「出せない先を出せるように見せない」** こと。
 * note には公開された投稿用の仕組みが無いため、
 * 「note へ直接公開」という選択肢を作らない。書き出して人が貼る道だけを出す。
 * その判断は domain の `supportsDirectPublish` が唯一の持ち主で、
 * 画面にも API にも同じ判断が効く。
 */
export type ManageDistributionDeps = {
  readonly connections: ChannelConnectionRepositoryPort;
  readonly connectors: ChannelConnectorProviderPort;
  readonly publications: PublicationRepositoryPort;
  readonly manualExport: ManualExportPort;
  /**
   * 記事の本文。書き出しに要る。
   *
   * 配信の記録は「どこへ、どの状態で出したか」しか持たない。
   * 貼り付ける中身は記事側にあるので、ここから読む。
   */
  readonly variants: EditorialContentVariantRepositoryPort;
  /** 記事が属するブランドを、クライアント入力ではなく親企画から逆引きする。 */
  readonly contentPackages: EditorialContentPackageRepositoryPort;
  /** ID 生成。配信を新しく作るときに要る。 */
  readonly ids: IdGeneratorPort;
  /** 操作の記録。配信予定はいずれ外へ出るので、誰が動かしたかを残す。 */
  readonly auditLog: AuditLogPort;
};

function brandAccessDeps(deps: ManageDistributionDeps): PublicationBrandAccessDeps {
  return {
    contentVariants: deps.variants,
    contentPackages: deps.contentPackages,
  };
}

/**
 * 配信予定が変わったことを記録する。
 *
 * --- 予約・取りやめを 1 つの関数で書く理由 ---
 * 後から読む人が知りたいのは「いつ外へ出る予定になっていたか」で、
 * 予約も取りやめもその 1 本の線の上にある。`before` / `after` の日時に差が出る
 * （取りやめは `after` が null）。操作ごとに書き分けると、
 * 同じことの別名が並んで、一覧から予定の変遷を追えなくなる。
 *
 * **記録は保存の後に呼ぶ。** 先に書くと、保存が落ちたときに
 * 「起きていない予約」の証拠が残る。
 */
async function recordScheduleChange(
  deps: ManageDistributionDeps,
  actor: ActorContext,
  input: {
    readonly publicationId: string;
    readonly channelKind: ChannelKind;
    /**
     * 前の予定。**`null` は「前が無い（いま作った）」の意味**で、
     * `{ scheduledAt: null }` は「予定日を決めずに登録されていた」の意味。
     * ここを一緒にすると、新規作成と「予定日なしからの変更」が見分けられなくなる。
     */
    readonly before: { readonly scheduledAt: string | null } | null;
    readonly after: string | null;
    readonly doneAlready: string;
  },
): Promise<Result<void, DomainError>> {
  const entry = buildAuditEntry({ ids: deps.ids, now: () => new Date() }, actor, {
    action: "publication.schedule_changed",
    targetType: "publication",
    targetId: input.publicationId,
    before: input.before,
    after: { scheduledAt: input.after, channelKind: input.channelKind },
  });
  if (!entry.ok) return entry;
  const appended = await deps.auditLog.append(entry.value);
  if (!appended.ok) {
    return err(auditWriteFailure(input.doneAlready, appended.error.details));
  }
  return ok(undefined);
}

/**
 * 下書きを外へ書き出したことを記録する。
 *
 * **これは読み取りの操作だが、記録の義務がある。**`つなぎ目の呼び出し`
 * （`scripts/port-wiring.mjs`）が記録を要求するのは保存先へ書く入口だけなので、
 * ここは見張りに掛からない。掛からないが、`02-補充仕様` §7 は
 * 必須記録対象に**エクスポート**を挙げている。
 *
 * 理由は、この操作が**記事の本文をまるごと人の手に渡す**ことにある。
 * 渡した先で何が起きるかはこちらから見えないので、
 * 「いつ・誰が・どの配信の本文を持ち出したか」がここに残っていないと、
 * 外へ出た経路を後から辿る手段が 1 つも無い。
 *
 * **本文は記録に入れない。**入れると、記録そのものが本文の 2 つ目の置き場所になる。
 * 残すのは、どの配信を・どの媒体向けに書き出したか、までにする。
 */
async function recordManualExport(
  deps: ManageDistributionDeps,
  actor: ActorContext,
  input: {
    readonly publicationId: string;
    readonly channelKind: ChannelKind;
    readonly channelLabel: string;
  },
): Promise<Result<void, DomainError>> {
  const entry = buildAuditEntry({ ids: deps.ids, now: () => new Date() }, actor, {
    action: "export.performed",
    targetType: "publication",
    targetId: input.publicationId,
    after: { channelKind: input.channelKind, channelLabel: input.channelLabel },
  });
  if (!entry.ok) return entry;
  const appended = await deps.auditLog.append(entry.value);
  if (!appended.ok) {
    // 下書きは組み立て終わっているが、**まだ渡していない**。
    // ここで断れば、記録に残らない持ち出しは 1 件も起きない。
    return err(auditWriteFailure("下書きは作れています", appended.error.details));
  }
  return ok(undefined);
}

/** 出し方の表示名。識別子をそのまま画面に出さない。 */
export const PUBLISH_MODE_LABEL: Readonly<Record<string, string>> = {
  api_publish: "自動で投稿できる",
  api_schedule: "自動で予約投稿できる",
  manual_export: "下書きを書き出して、ご自身で投稿する",
};

/**
 * 配信の状態の表示名。
 *
 * 正本は domain 側（`domain/distribution/publication.ts`）にある。
 * 進めなかった理由の文を domain が組み立てるので、そちらに置いてある。
 * ここは読み出し口を保つためだけの再輸出で、**別の表を作らない**。
 */
export { PUBLICATION_STATE_LABEL } from "@/domain/distribution";

/** 広告表記をどこに出すかの表示名。 */
const DISCLOSURE_PLACEMENT_LABEL: Readonly<Record<string, string>> = {
  body_top: "本文の冒頭",
  body_anywhere: "本文のどこか",
  platform_tag: "各サービスの表示機能",
};

// --- 出し先の一覧 -----------------------------------------------------------

export type ChannelStatus = {
  readonly kind: ChannelKind;
  readonly label: string;
  readonly publishModeLabel: string;
  readonly canDirectPublish: boolean;
  readonly maxBodyLength: number | null;
  readonly allowsBodyLinks: boolean;
  readonly allowsAffiliateLinks: boolean;
  readonly disclosurePlacementLabel: string;
  readonly basisNote: string;
  /** 接続済みのアカウント名。未接続は空。 */
  readonly connectedAccounts: readonly string[];
  /** 接続はあるが使えない理由（期限切れ・取り消し）。 */
  readonly unusableReasons: readonly string[];
  /** いま出せない理由。null なら出せる。 */
  readonly blockedReason: string | null;
};

export type ListChannelsOutput = {
  readonly channels: readonly ChannelStatus[];
  readonly connectedCount: number;
  readonly manualOnlyCount: number;
};

function blockedReasonFor(
  capability: ChannelCapability,
  connected: readonly string[],
  connectionDetailsAvailable: boolean,
): string | null {
  // 手動書き出しは接続なしで使える。「自動投稿ではない」と「利用不可」を混ぜない。
  if (capability.publishMode === "manual_export") return null;
  if (!connectionDetailsAvailable) {
    return "ブランド限定の担当者は、workspace共通の接続を利用できません。限定のない公開担当者に配信を依頼してください。";
  }
  if (connected.length === 0) {
    return `${capability.label} との接続がまだありません。接続してから配信できます。`;
  }
  return null;
}

/** cursorを最後まで辿り、媒体種別数を接続件数の上限として扱わない。 */
export async function listAllChannelConnections(
  connections: ChannelConnectionRepositoryPort,
  workspaceId: WorkspaceId,
  pageSize = 100,
): Promise<Result<readonly ChannelConnection[], DomainError>> {
  const items: ChannelConnection[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const page = await connections.listByWorkspace(workspaceId, { limit: pageSize, cursor });
    if (!page.ok) return page;
    items.push(...page.value.items);
    const next = page.value.nextCursor;
    if (next !== null && seenCursors.has(next)) {
      return err(
        domainError("INVARIANT_VIOLATED", "出し先の続きを正しく読み出せませんでした。", {
          suggestedAction: "画面を開き直してください。",
        }),
      );
    }
    if (next !== null) seenCursors.add(next);
    cursor = next;
  } while (cursor !== null);
  return ok(items);
}

export function createListChannelsUseCase(
  deps: ManageDistributionDeps,
): UseCase<Record<string, never>, ListChannelsOutput> {
  return {
    async execute(actor: ActorContext): Promise<Result<ListChannelsOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "配信先の参照");
      if (!allowed.ok) return allowed;
      // 媒体能力は非機密なカタログ。限定担当者にも返す。一方、接続はbrandIdを
      // 持たないworkspace共通資源なので、限定担当者のときはrepository自体を読まない。
      const connectionDetailsAvailable = (actor.scopedBrandIds?.length ?? 0) === 0;
      const listed = connectionDetailsAvailable
        ? await listAllChannelConnections(deps.connections, actor.workspaceId)
        : ok([] as readonly ChannelConnection[]);
      if (!listed.ok) return listed;

      const now = new Date();
      const channels = [];
      for (const kind of Object.keys(CHANNEL_CAPABILITIES) as ChannelKind[]) {
        const capability = CHANNEL_CAPABILITIES[kind];
        const mine = listed.value.filter((c) => c.kind === kind);
        const usable: ChannelConnection[] = [];
        const unusable: string[] = [];
        for (const connection of mine) {
          if (!isConnectionUsable(connection, now)) {
            unusable.push(
              connection.revokedAt !== null
                ? `${connection.accountLabel}: 接続が取り消されています。`
                : `${connection.accountLabel}: 接続の期限が切れています。つなぎ直してください。`,
            );
            continue;
          }
          if (!supportsExternalDirectPublish(kind)) {
            usable.push(connection);
            continue;
          }
          const connector = deps.connectors.forConnection(connection);
          if (!connector.ok) {
            unusable.push(`${connection.accountLabel}: ${connector.error.message}`);
            continue;
          }
          const ready = await connector.value.checkReadiness();
          if (!ready.ok) {
            unusable.push(`${connection.accountLabel}: ${ready.error.message}`);
            continue;
          }
          usable.push(connection);
        }
        const connected = usable.map((c) => c.accountLabel);
        channels.push({
          kind,
          label: capability.label,
          publishModeLabel: PUBLISH_MODE_LABEL[capability.publishMode] ?? capability.publishMode,
          canDirectPublish: supportsDirectPublish(kind),
          maxBodyLength: capability.maxBodyLength,
          allowsBodyLinks: capability.allowsBodyLinks,
          allowsAffiliateLinks: capability.allowsAffiliateLinks,
          disclosurePlacementLabel:
            DISCLOSURE_PLACEMENT_LABEL[capability.disclosurePlacement] ??
            capability.disclosurePlacement,
          basisNote: capability.basisNote,
          connectedAccounts: connected,
          unusableReasons: unusable,
          blockedReason: blockedReasonFor(
            capability,
            connected,
            connectionDetailsAvailable,
          ),
        });
      }

      return ok({
        channels,
        connectedCount: channels.filter((c) => c.connectedAccounts.length > 0).length,
        manualOnlyCount: channels.filter((c) => !c.canDirectPublish).length,
      });
    },
  };
}

export type RegisterChannelConnectionInput = {
  readonly channelKind: ChannelKind;
  readonly accountLabel: string;
  /** 秘密の値ではなくSecretResolverが読む参照名。 */
  readonly credentialRef: string;
  readonly expiresAt?: string | null;
};

export type RegisterChannelConnectionOutput = {
  readonly connectionId: string;
  readonly kind: ChannelKind;
  readonly accountLabel: string;
  readonly usable: boolean;
  readonly unavailableReason: string | null;
};

function connectionIdentityConflict(): DomainError {
  return domainError("CONFLICT", "この認証情報は、登録済みの接続先と一致しません。", {
    suggestedAction:
      "登録済み接続の認証情報を差し替えず、別の接続として新しい参照名で登録してください。",
  });
}

async function recordConnectionRegistration(
  deps: ManageDistributionDeps,
  actor: ActorContext,
  connection: ChannelConnection,
  at: Date,
): Promise<Result<void, DomainError>> {
  const targetId = String(connection.id);
  const alreadyRecorded = await deps.auditLog.listByTarget(
    connection.workspaceId,
    "channel_connection",
    targetId,
  );
  if (!alreadyRecorded.ok) return alreadyRecorded;
  if (alreadyRecorded.value.some((entry) => entry.action === "connector.connected")) {
    return ok(undefined);
  }

  // 接続行ごとに監査IDを固定する。append成功後の応答喪失や並行retryでも
  // connector.connectedを複製せず、同じ証拠へ収束させる。
  const entry = buildAuditEntry(
    { ids: { newId: () => `connector_connected_${targetId}` }, now: () => at },
    actor,
    {
      action: "connector.connected",
      targetType: "channel_connection",
      targetId,
      after: {
        kind: connection.kind,
        accountLabel: connection.accountLabel,
        connectionConfigured: true,
        usable: true,
      },
    },
  );
  if (!entry.ok) return entry;
  const appended = await deps.auditLog.append(entry.value);
  if (appended.ok) return ok(undefined);

  // 同じ監査IDの並行appendに負けただけなら成功。保存先障害で欠けたならretryを促す。
  const recovered = await deps.auditLog.listByTarget(
    connection.workspaceId,
    "channel_connection",
    targetId,
  );
  if (
    recovered.ok &&
    recovered.value.some((candidate) => candidate.action === "connector.connected")
  ) {
    return ok(undefined);
  }
  return err(auditWriteFailure("外部媒体との接続は登録されています", appended.error.details));
}

/** workspace共通の外部接続を登録する。ブランド限定actorへは開かない。 */
export function createRegisterChannelConnectionUseCase(
  deps: ManageDistributionDeps,
): UseCase<RegisterChannelConnectionInput, RegisterChannelConnectionOutput> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "channel_connection.manage", "外部媒体との接続管理");
      if (!allowed.ok) return allowed;
      const workspaceWide = assertWorkspaceWideAccess(actor, "外部媒体との接続");
      if (!workspaceWide.ok) return workspaceWide;
      if (!supportsExternalDirectPublish(input.channelKind)) {
        return err(domainError("NOT_SUPPORTED", `${CHANNEL_CAPABILITIES[input.channelKind].label} は接続を使う直接投稿に対応していません。`));
      }
      let expiresAt: Date | null = null;
      if (input.expiresAt != null && input.expiresAt.trim() !== "") {
        expiresAt = new Date(input.expiresAt);
        if (Number.isNaN(expiresAt.getTime())) {
          // 欄の名前を付けない。接続の画面に期限の入力欄は無く（値は provider 側から来る）、
          // 名前を付けると断りが「その欄」を待って画面のどこにも出ないまま消える。
          return err(validationError("接続期限の日時を読み取れませんでした。"));
        }
      }
      const at = new Date();
      // providerへ接続する前にも入力の参照名を検査する。秘密そのものなら外へ送らない。
      const candidate = createChannelConnection({
        id: taggedString<"ChannelConnectionId">(`conn_${deps.ids.newId()}`) as ChannelConnectionId,
        workspaceId: actor.workspaceId,
        kind: input.channelKind,
        accountLabel: input.accountLabel,
        connectedAt: at,
        expiresAt,
        credentialRef: input.credentialRef,
      });
      if (!candidate.ok) return candidate;
      const connector = deps.connectors.forConnection(candidate.value);
      if (!connector.ok) return connector;
      const identity = await connector.value.resolveIdentity();
      if (!identity.ok) return identity;

      const built = createChannelConnection({
        ...candidate.value,
        accountLabel: identity.value.accountLabel,
        providerIdentity: identity.value.providerIdentity,
      });
      if (!built.ok) return built;
      const saved = await deps.connections.createIfAbsent(built.value);
      if (!saved.ok) return saved;
      if (
        saved.value.connection.providerIdentity !== built.value.providerIdentity ||
        saved.value.connection.credentialRef !== built.value.credentialRef
      ) {
        return err(connectionIdentityConflict());
      }

      const recorded = await recordConnectionRegistration(
        deps,
        actor,
        saved.value.connection,
        at,
      );
      if (!recorded.ok) return recorded;
      return ok({
        connectionId: String(saved.value.connection.id),
        kind: saved.value.connection.kind,
        accountLabel: saved.value.connection.accountLabel,
        usable: true,
        unavailableReason: null,
      });
    },
  };
}

// --- 配信の一覧 -------------------------------------------------------------

export type PublicationCard = {
  readonly publicationId: string;
  readonly variantId: string;
  readonly channelKind: ChannelKind;
  readonly channelLabel: string;
  readonly state: PublicationState;
  readonly stateLabel: string;
  readonly scheduledAt: Date | null;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly externalUrl: string | null;
};

export type ListPublicationsOutput = {
  readonly items: readonly PublicationCard[];
  readonly needsAttention: readonly PublicationCard[];
  readonly total: number;
  readonly emptyReason: string | null;
};

function toCard(p: Publication): PublicationCard {
  return {
    publicationId: String(p.id),
    variantId: String(p.variantId),
    channelKind: p.channelKind,
    channelLabel: CHANNEL_CAPABILITIES[p.channelKind].label,
    state: p.state,
    stateLabel: PUBLICATION_STATE_LABEL[p.state],
    scheduledAt: p.scheduledAt,
    attempts: p.attempts,
    lastError: p.lastError,
    externalUrl: p.externalUrl,
  };
}

/** 手当てが要る状態。放っておくと出ないまま止まる。 */
const NEEDS_ATTENTION: readonly PublicationState[] = [
  "FAILED_VALIDATION",
  "FAILED_SEND",
  "MANUAL_EXPORT_READY",
];

export type ListPublicationsInput = { readonly limit?: number };

export function createListPublicationsUseCase(
  deps: ManageDistributionDeps,
): UseCase<ListPublicationsInput, ListPublicationsOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ListPublicationsInput,
    ): Promise<Result<ListPublicationsOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "配信の参照");
      if (!allowed.ok) return allowed;

      const listed = await deps.publications.listRecent(
        actor.workspaceId,
        input.limit ?? 50,
        publicationListScopeOf(actor),
      );
      if (!listed.ok) return listed;

      const visible = await filterPublicationsByBrandScope(
        brandAccessDeps(deps),
        actor,
        listed.value,
      );
      if (!visible.ok) return visible;

      const items = visible.value.map(toCard);
      return ok({
        items,
        needsAttention: items.filter((i) => NEEDS_ATTENTION.includes(i.state)),
        total: items.length,
        emptyReason:
          items.length === 0
            ? "まだ配信の記録がありません。記事を承認して公開すると、ここに並びます。"
            : null,
      });
    },
  };
}

// --- 配信 1 件 --------------------------------------------------------------

export type GetPublicationInput = { readonly publicationId: string };
export type GetPublicationOutput = {
  readonly card: PublicationCard;
  readonly canDirectPublish: boolean;
  readonly publishModeLabel: string;
  readonly nextStates: readonly { readonly state: PublicationState; readonly label: string }[];
  /** 進められない理由。null なら進められる。 */
  readonly blockedReason: string | null;
  /**
   * この画面の中で体裁を整えてそのまま出せるか。
   *
   * 画面に「自社サイトなら」という条件を書かせないために、判断はここで済ませる。
   * 画面が配信先の種別で分岐すると、配信先を足すたびに画面を探して直すことになる。
   *
   * 出し終わった配信で false にするのが要点。true のままだと同じ記事が 2 度出る。
   */
  readonly canPublishFromScreen: boolean;
};

/**
 * 進める先を、実際に `advance` を試して求める。
 *
 * 表を画面側で写経すると、domain の遷移表を直したときに片方だけ古くなる。
 * ここで実際に試すことで、出したボタンは必ず押せる。
 */
function nextStatesOf(
  publication: Publication,
): readonly { readonly state: PublicationState; readonly label: string }[] {
  const candidates = Object.keys(PUBLICATION_STATE_LABEL) as PublicationState[];
  return candidates
    .filter((to) => {
      // 公開ゲートの結果が要る遷移はここでは判定できないため、対象から外す。
      if (publication.state === "VALIDATING") return false;
      return advance(publication, to, { at: new Date() }).ok;
    })
    .map((state) => ({ state, label: PUBLICATION_STATE_LABEL[state] }));
}

function notFound(): DomainError {
  return domainError("NOT_FOUND", "この配信が見つかりません。", {
    suggestedAction: "配信の一覧から選び直してください。",
  });
}

export function createGetPublicationUseCase(
  deps: ManageDistributionDeps,
): UseCase<GetPublicationInput, GetPublicationOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: GetPublicationInput,
    ): Promise<Result<GetPublicationOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "配信の参照");
      if (!allowed.ok) return allowed;

      const found = await deps.publications.findById(
        actor.workspaceId,
        taggedString<"PublicationId">(input.publicationId) as PublicationId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound());

      const same = assertSameTenant(actor, found.value, "この配信");
      if (!same.ok) return same;
      const scoped = await ensurePublicationBrandAccess(
        brandAccessDeps(deps),
        actor,
        found.value,
      );
      if (!scoped.ok) return scoped;

      const publication = found.value;
      const capability = CHANNEL_CAPABILITIES[publication.channelKind];
      return ok({
        card: toCard(publication),
        canDirectPublish: supportsDirectPublish(publication.channelKind),
        publishModeLabel: PUBLISH_MODE_LABEL[capability.publishMode] ?? capability.publishMode,
        nextStates: nextStatesOf(publication),
        blockedReason: supportsDirectPublish(publication.channelKind)
          ? null
          : `${capability.label} には公開された投稿の仕組みがありません。下書きを書き出して、ご自身で投稿してください。`,
        canPublishFromScreen:
          rendersOwnArticle(publication.channelKind) && publication.externalUrl === null,
      });
    },
  };
}

// --- 取りやめ ---------------------------------------------------------------

export type CancelPublicationInput = { readonly publicationId: string };
export type CancelPublicationOutput = { readonly card: PublicationCard };

/**
 * 配信を取りやめる。
 *
 * すでに公開済みのものは取りやめられない（domain の遷移表がそう決めている）。
 * 「取り下げ」は別の操作であり、外部サービス側の対応可否に依存する。
 */
export function createCancelPublicationUseCase(
  deps: ManageDistributionDeps,
): UseCase<CancelPublicationInput, CancelPublicationOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: CancelPublicationInput,
    ): Promise<Result<CancelPublicationOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.publish", "配信の取りやめ");
      if (!allowed.ok) return allowed;

      const found = await deps.publications.findById(
        actor.workspaceId,
        taggedString<"PublicationId">(input.publicationId) as PublicationId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound());

      const same = assertSameTenant(actor, found.value, "この配信");
      if (!same.ok) return same;
      const scoped = await ensurePublicationBrandAccess(
        brandAccessDeps(deps),
        actor,
        found.value,
      );
      if (!scoped.ok) return scoped;

      const moved = advance(found.value, "CANCELLED", { at: new Date() });
      if (!moved.ok) return moved;

      const saved = await deps.publications.compareAndSwap(found.value, moved.value);
      if (!saved.ok) return saved;
      if (saved.value === null) return err(publicationMutationConflict());

      const recorded = await recordScheduleChange(deps, actor, {
        publicationId: input.publicationId,
        channelKind: saved.value.channelKind,
        before: { scheduledAt: found.value.scheduledAt?.toISOString() ?? null },
        // 取りやめたので、この先出る予定は無い。null がその意味を持つ。
        after: null,
        doneAlready: "配信は取りやめました",
      });
      if (!recorded.ok) return recorded;

      return ok({ card: toCard(saved.value) });
    },
  };
}

// --- 手作業での書き出し -----------------------------------------------------

export type ExportManualDraftInput = { readonly publicationId: string };
export type ExportManualDraftOutput = {
  readonly channelLabel: string;
  readonly markdown: string;
  readonly instructions: string;
};

/**
 * 公式の投稿の仕組みが無い先（note）へ出すための書き出し。
 *
 * ここが「note へ直接公開」の代わりに用意している唯一の道。
 * 非公式の投稿方法をここへ足してはならない。
 */
export function createExportManualDraftUseCase(
  deps: ManageDistributionDeps,
): UseCase<ExportManualDraftInput, ExportManualDraftOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ExportManualDraftInput,
    ): Promise<Result<ExportManualDraftOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "下書きの書き出し");
      if (!allowed.ok) return allowed;

      const found = await deps.publications.findById(
        actor.workspaceId,
        taggedString<"PublicationId">(input.publicationId) as PublicationId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound());

      const same = assertSameTenant(actor, found.value, "この配信");
      if (!same.ok) return same;
      const scoped = await ensurePublicationBrandAccess(
        brandAccessDeps(deps),
        actor,
        found.value,
      );
      if (!scoped.ok) return scoped;

      const publication = found.value;
      const capability = CHANNEL_CAPABILITIES[publication.channelKind];
      if (supportsDirectPublish(publication.channelKind)) {
        return err(
          domainError(
            "NOT_SUPPORTED",
            `${capability.label} は自動で投稿できるため、書き出しは使いません。`,
            { suggestedAction: "そのまま配信を進めてください。" },
          ),
        );
      }

      // 本文が要る。空のまま書き出すと、貼り付けても何も出ない下書きを渡すことになり、
      // note へ出す唯一の道が事実上ふさがる。
      const variant = await deps.variants.findVersionedById(
        actor.workspaceId,
        publication.variantId,
      );
      if (!variant.ok) return variant;
      if (variant.value === null) {
        return err(
          domainError("NOT_FOUND", "この配信のもとになった記事が見つかりません。", {
            suggestedAction: "記事の一覧から選び直して、もう一度書き出してください。",
          }),
        );
      }
      if (
        publication.variantRevision === null ||
        publication.variantRevision !== variant.value.revision
      ) {
        return err(
          domainError("CONFLICT", "予約後に記事が変更されたため、この下書きは書き出せません。", {
            suggestedAction: "変更後の内容を人が承認し、配信を予約し直してください。",
          }),
        );
      }

      const draft = await deps.manualExport.buildDraft(publication.channelKind, {
        connectionId: publication.connectionId ?? taggedString<"ChannelConnectionId">("none"),
        idempotencyKey: publication.idempotencyKey,
        providerDeliveryKey: publication.providerDeliveryKey,
        title: variant.value.variant.title,
        body: variant.value.variant.body,
        imageKeys: [],
        scheduledAt: publication.scheduledAt,
        providerRecordCreatedAt: publication.providerRecordCreatedAt,
        disclosureText: variant.value.variant.disclosure,
      });
      if (!draft.ok) return draft;

      // 記録は**渡す前**。渡した後に書くと、記録に残らない持ち出しが起きうる。
      const logged = await recordManualExport(deps, actor, {
        publicationId: input.publicationId,
        channelKind: publication.channelKind,
        channelLabel: capability.label,
      });
      if (!logged.ok) return logged;

      return ok({
        channelLabel: capability.label,
        markdown: draft.value.markdown,
        instructions: draft.value.instructions,
      });
    },
  };
}

// --- 配信を作る -------------------------------------------------------------

export type SchedulePublicationInput = {
  readonly variantId: string;
  readonly channelKind: ChannelKind;
  /** 出し先のアカウント。省略したときは、使える接続が 1 つだけなら自動で決まる。 */
  readonly connectionId?: string | null;
  /**
   * 予約時刻。空文字・null・省略で即時。
   *
   * **Date ではなく文字列で受ける。** 入口の形は道具の一覧として
   * JSON Schema に写されるが、Date は JSON Schema で表現できず、
   * 一覧の生成そのものが落ちる（実際に落として直した）。
   * REST・WebMCP・画面のどれから来ても同じ形にするため、ここは文字列に揃える。
   */
  readonly scheduledAt?: string | null;
};

export type SchedulePublicationOutput = {
  readonly card: PublicationCard;
  /**
   * 同じ要求が既にあったか。
   *
   * true でも失敗ではない。**同じものを 2 回作らなかった**という結果なので、
   * 画面はエラーではなく「すでに登録済みです」と伝える。
   */
  readonly alreadyExisted: boolean;
  /** 自動で投稿できない先のときの案内。null なら自動で出せる。 */
  readonly manualExportNotice: string | null;
};

function sampleOnlyExternalPublicationError(): DomainError {
  return domainError("CONFLICT", "見本の記事は外部サービスへ自動配信できません。", {
    suggestedAction:
      "自分の記事として本文を保存し、変更後の内容を人が承認してから配信してください。",
  });
}

function validateExternalGate(variant: ContentVariant): Result<true, DomainError> {
  const gate = evaluateExternalPublicationGate(variant);
  return gate.ok
    ? ok(true)
    : err(
        domainError(
          "PUBLISH_GATE_FAILED",
          gate.failures.map((failure) => failure.message).join(" / "),
          { suggestedAction: "記事の画面で指摘を直し、人が承認してから配信してください。" },
        ),
      );
}

/**
 * 「この記事を、ここへ出す」を開始する。
 *
 * ここが無いと、承認まで進めた記事を配信へ渡す道が無い（配信の一覧に見本が
 * 並ぶだけで、実際には誰も新しい配信を作れない）。1 周の結合テストで
 * この穴が見つかった（残課題 26）。
 *
 * --- ここで守っていること ---
 *
 * 1. **承認していない記事は出せない。** 状態の判断は原稿側の `status` 一つに
 *    寄せる。画面が「承認済みの記事だけ選択肢に出す」で済ませると、
 *    AI や API から同じ操作をされたときに素通りする。
 *
 * 2. **出し先のアカウントを黙って選ばない。** 使える接続が複数あるとき、
 *    こちらで 1 つ選ぶと、意図しないアカウントへ投稿してから気づくことになる。
 *    投稿は取り消しても「一度出た」事実が消えないので、迷ったら聞く。
 *
 * 3. **同じ要求は 1 件にする。** 二重クリック・再送・AI の再試行で
 *    同じ投稿が 2 つ並ぶのを、作る時点で防ぐ。鍵の作り方は domain が持つ。
 */
export function createSchedulePublicationUseCase(
  deps: ManageDistributionDeps,
): UseCase<SchedulePublicationInput, SchedulePublicationOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: SchedulePublicationInput,
    ): Promise<Result<SchedulePublicationOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.publish", "配信の開始");
      if (!allowed.ok) return allowed;

      const variantId = taggedString<"ContentVariantId">(input.variantId) as ContentVariantId;

      const variant = await deps.variants.findVersionedById(actor.workspaceId, variantId);
      if (!variant.ok) return variant;
      if (variant.value === null) {
        return err(
          domainError("NOT_FOUND", "この記事が見つかりません。", {
            suggestedAction: "記事の一覧から選び直してください。",
          }),
        );
      }
      const sameVariant = assertSameTenant(actor, variant.value.variant, "この記事");
      if (!sameVariant.ok) return sameVariant;
      const scopedVariant = await ensureVariantBrandAccess(
        brandAccessDeps(deps),
        actor,
        variant.value.variant,
      );
      if (!scopedVariant.ok) return scopedVariant;

      // D1の外部送信claimはcontent_variants実表の版を同じUPDATE文で照合する。
      // 見本だけの記事は照合対象が無く永久にclaimできないため、予約成功を装わない。
      if (supportsExternalDirectPublish(input.channelKind) && !variant.value.persisted) {
        return err(sampleOnlyExternalPublicationError());
      }

      // 外部媒体の評価は予約時とworkerで同じComplianceの正本を使う。
      const externalGate = validateExternalGate(variant.value.variant);
      if (input.channelKind !== "own_site" && !externalGate.ok) {
        return externalGate;
      }
      // 自社サイトの詳細な記事candidateは公開画面でcanonical evaluatePublishGateが評価する。
      if (
        input.channelKind === "own_site" &&
        variant.value.variant.status !== "approved" &&
        variant.value.variant.status !== "published"
      ) {
        return err(domainError("CONFLICT", "承認が済んでいない記事は配信できません。", {
          suggestedAction: "記事の画面で内容を確認し、人が承認してから配信してください。",
        }));
      }

      const raw = (input.scheduledAt ?? "").trim();
      let scheduledAt: Date | null = null;
      if (raw !== "") {
        const parsed = new Date(raw);
        // 読み取れない文字列を「指定なし」に倒さない。倒すと即時投稿になる。
        if (Number.isNaN(parsed.getTime())) {
          return err(
            validationError(
              "日時の形が読み取れませんでした。日付と時刻を選び直してください。",
              "scheduledAt",
            ),
          );
        }
        // 過ぎた時刻を黙って即時に倒さない。打ち間違いがそのまま投稿になる。
        if (parsed.getTime() < Date.now()) {
          return err(
            validationError(
              "過ぎた時刻は予約できません。いま出すなら予約時刻を空にしてください。",
              "scheduledAt",
            ),
          );
        }
        scheduledAt = parsed;
      }

      const connectionId = await resolveConnection(deps, actor, input);
      if (!connectionId.ok) return connectionId;

      // 同じ要求は保存先の一意境界で原子的に1件へ収束させる。
      const idempotencyKey = buildIdempotencyKey({
        variantId,
        variantRevision: variant.value.revision,
        channelKind: input.channelKind,
        scheduledAt,
      });
      const created = createPublication({
        id: taggedString<"PublicationId">(`pub_${deps.ids.newId()}`) as PublicationId,
        workspaceId: actor.workspaceId,
        variantId,
        variantRevision: variant.value.revision,
        channelKind: input.channelKind,
        connectionId: connectionId.value,
        scheduledAt,
        idempotencyKey,
      });
      if (!created.ok) return created;

      const canonical = await deps.publications.createIfAbsent(created.value);
      if (!canonical.ok) return canonical;
      if (!canonical.value.created) {
        const scopedExisting = await ensurePublicationBrandAccess(
          brandAccessDeps(deps),
          actor,
          canonical.value.publication,
        );
        if (!scopedExisting.ok) return scopedExisting;
        return ok({
          card: toCard(canonical.value.publication),
          alreadyExisted: true,
          manualExportNotice: manualNoticeFor(input.channelKind),
        });
      }
      const saved = canonical.value.publication;

      const recorded = await recordScheduleChange(deps, actor, {
        publicationId: String(saved.id),
        channelKind: input.channelKind,
        // 新しく作った配信なので、前の予定は無い。
        before: null,
        after: scheduledAt?.toISOString() ?? null,
        doneAlready: "配信は登録されています",
      });
      if (!recorded.ok) return recorded;

      return ok({
        card: toCard(saved),
        alreadyExisted: false,
        manualExportNotice: manualNoticeFor(input.channelKind),
      });
    },
  };
}

function manualNoticeFor(kind: ChannelKind): string | null {
  if (supportsDirectPublish(kind)) return null;
  return `${CHANNEL_CAPABILITIES[kind].label} には公開された投稿の仕組みがありません。下書きを書き出して、ご自身で投稿してください。`;
}

/**
 * 自動投稿先の接続は、現行モデルでは workspace 共通で brandId を持たない。
 * 限定担当者へ「この接続は担当ブランド用だろう」と推測で割り当てない。
 */
function ensureDirectChannelConnectionAccess(
  actor: ActorContext,
  kind: ChannelKind,
): Result<true, DomainError> {
  return supportsDirectPublish(kind)
    && supportsExternalDirectPublish(kind)
    ? assertWorkspaceWideAccess(actor, "配信先の接続")
    : ok(true);
}

/**
 * 出し先のアカウントを決める。
 *
 * 自動で投稿できない先（note）は接続を持たないので null を返す。
 * 自動で投稿できる先では、**使える接続が 1 つのときだけ**自動で決める。
 */
async function resolveConnection(
  deps: ManageDistributionDeps,
  actor: ActorContext,
  input: SchedulePublicationInput,
): Promise<Result<ChannelConnectionId | null, DomainError>> {
  const capability = CHANNEL_CAPABILITIES[input.channelKind];
  if (!supportsExternalDirectPublish(input.channelKind)) return ok(null);
  const scopedConnection = ensureDirectChannelConnectionAccess(actor, input.channelKind);
  if (!scopedConnection.ok) return scopedConnection;

  const now = new Date();
  async function ready(connection: ChannelConnection): Promise<boolean> {
    if (!supportsExternalDirectPublish(connection.kind)) return true;
    const connector = deps.connectors.forConnection(connection);
    if (!connector.ok) return false;
    return (await connector.value.checkReadiness()).ok;
  }
  if (input.connectionId != null && input.connectionId !== "") {
    const chosen = await deps.connections.findById(
      actor.workspaceId,
      taggedString<"ChannelConnectionId">(input.connectionId) as ChannelConnectionId,
    );
    if (!chosen.ok) return chosen;
    if (
      chosen.value === null ||
      chosen.value.kind !== input.channelKind ||
      !isConnectionUsable(chosen.value, now)
    ) {
      return err(
        domainError("NOT_FOUND", `指定された ${capability.label} の接続が使えません。`, {
          suggestedAction:
            "接続が取り消されているか、期限が切れています。設定の画面でつなぎ直してください。",
        }),
      );
    }
    if (!(await ready(chosen.value))) {
      return err(
        domainError("NOT_FOUND", `指定された ${capability.label} の接続は認証情報が未登録か、現在利用できません。`, {
          suggestedAction: "接続設定で利用不可の理由を確認してください。",
        }),
      );
    }
    return ok(chosen.value.id);
  }

  const listed = await listAllChannelConnections(deps.connections, actor.workspaceId);
  if (!listed.ok) return listed;
  const candidates = listed.value.filter(
    (c) => c.kind === input.channelKind && isConnectionUsable(c, now),
  );
  const usable: ChannelConnection[] = [];
  for (const connection of candidates) {
    if (await ready(connection)) usable.push(connection);
  }

  if (usable.length === 0) {
    return err(
      domainError("CONFLICT", `${capability.label} との接続がまだありません。`, {
        suggestedAction: "設定の画面で接続してから、もう一度配信してください。",
      }),
    );
  }
  if (usable.length > 1) {
    return err(
      validationError(
        `${capability.label} の接続が ${usable.length} つあります。どのアカウントへ出すか選んでください（${usable
          .map((c) => c.accountLabel)
          .join(" / ")}）。`,
        "connectionId",
      ),
    );
  }
  return ok(usable[0]!.id);
}

// --- 配信の中身を直す -------------------------------------------------------

/**
 * 直せる項目。
 *
 * **本文は入っていない。** 配信は記事を指しているだけで、文章そのものは
 * 持っていない（`Publication` に本文の欄が無い）。文章を直したいときは
 * 記事の側（`update_content_variant`）を直す。本文保存で版が進むため、既存の
 * 配信は外部送信前に止まり、変更後の内容を人が承認して予約し直す。
 * ここで本文を持たせると、記事と配信で違う文章が保存できてしまい、
 * 「読者が読んだのはどちらか」が言えなくなる。
 */
export type UpdatePublicationInput = {
  readonly publicationId: string;
  /** 送り先の媒体。変えると接続先も選び直しになる。 */
  readonly channelKind?: ChannelKind;
  /** 出す時刻。空文字は「予約を外して即時にする」の意味。 */
  readonly scheduledAt?: string;
};

export type UpdatePublicationOutput = {
  readonly card: PublicationCard;
  readonly manualExportNotice: string | null;
};

/** 外へ出始めたか、終端へ着いた配信。ここから先は直せない。 */
const NON_EDITABLE_PUBLICATION_STATES: ReadonlySet<PublicationState> = new Set([
  "SENDING",
  "PUBLISHED",
  "MANUAL_EXPORT_READY",
  "CANCELLED",
]);

/** 手動配信用の予約を、外部送信不能な記事のまま自動配信へ付け替えさせない。 */
async function validateExternalChannelChange(
  deps: ManageDistributionDeps,
  actor: ActorContext,
  publication: Publication,
): Promise<Result<true, DomainError>> {
  const current = await deps.variants.findVersionedById(
    actor.workspaceId,
    publication.variantId,
  );
  if (!current.ok) return current;
  if (current.value === null) {
    return err(
      domainError("NOT_FOUND", "この配信のもとになった記事が見つかりません。", {
        suggestedAction: "記事の一覧から選び直して、配信を予約し直してください。",
      }),
    );
  }

  const sameVariant = assertSameTenant(actor, current.value.variant, "この記事");
  if (!sameVariant.ok) return sameVariant;

  // D1のclaimはcontent_variants実表をEXISTSで照合する。見本だけの本文には
  // 照合先が無いので、接続解決より前に断り、成功した予約を永久待ちにしない。
  if (!current.value.persisted) {
    return err(sampleOnlyExternalPublicationError());
  }

  if (
    publication.variantRevision === null ||
    publication.variantRevision !== current.value.revision
  ) {
    return err(
      domainError("CONFLICT", "予約後に記事が変更されたため、外部自動配信へ変更できません。", {
        suggestedAction: "変更後の内容を人が承認し、配信を予約し直してください。",
      }),
    );
  }

  return validateExternalGate(current.value.variant);
}

/**
 * 送信前の配信を直す。
 *
 * **送信済みを直せないのは、直しても届かないから。** 外へ出た投稿は
 * 相手側にあり、こちらの記録を書き換えても投稿は変わらない。
 * 書き換えられるようにすると、記録と実物が食い違ったまま気づけなくなる。
 * 出した後にできるのは、外部サービス側での取り下げだけである。
 */
export function createUpdatePublicationUseCase(
  deps: ManageDistributionDeps,
): UseCase<UpdatePublicationInput, UpdatePublicationOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: UpdatePublicationInput,
    ): Promise<Result<UpdatePublicationOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.publish", "配信の修正");
      if (!allowed.ok) return allowed;

      const found = await deps.publications.findById(
        actor.workspaceId,
        taggedString<"PublicationId">(input.publicationId) as PublicationId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound());

      const same = assertSameTenant(actor, found.value, "この配信");
      if (!same.ok) return same;
      const scoped = await ensurePublicationBrandAccess(
        brandAccessDeps(deps),
        actor,
        found.value,
      );
      if (!scoped.ok) return scoped;

      const before = found.value;
      const channelKind = input.channelKind ?? before.channelKind;
      const scopedConnection = ensureDirectChannelConnectionAccess(actor, channelKind);
      if (!scopedConnection.ok) return scopedConnection;
      if (NON_EDITABLE_PUBLICATION_STATES.has(before.state)) {
        return err(
          domainError(
            "CONFLICT",
            `この配信は「${PUBLICATION_STATE_LABEL[before.state]}」なので、もう直せません。`,
            {
              suggestedAction:
                "外へ出たものはこちらからは変えられません。取り下げが要る場合は、配信先のサービスで操作してください。",
              details: { state: before.state },
            },
          ),
        );
      }

      /*
       * 予約時刻の読み取り。`schedule` の判断とわざと同じにしてある。
       *
       * 読み取れない文字列を「指定なし」に倒すと即時投稿になる、
       * 過ぎた時刻を黙って即時に倒すと打ち間違いがそのまま出る——
       * どちらも直す口から入っても同じように起きる。
       */
      let scheduledAt: Date | null = before.scheduledAt;
      if (input.scheduledAt !== undefined) {
        const raw = input.scheduledAt.trim();
        if (raw === "") {
          scheduledAt = null;
        } else {
          const parsed = new Date(raw);
          if (Number.isNaN(parsed.getTime())) {
            return err(
              validationError(
                "日時の形が読み取れませんでした。日付と時刻を選び直してください。",
                "scheduledAt",
              ),
            );
          }
          if (parsed.getTime() < Date.now()) {
            return err(
              validationError(
                "過ぎた時刻は予約できません。いま出すなら予約時刻を空にしてください。",
                "scheduledAt",
              ),
            );
          }
          scheduledAt = parsed;
        }
      }

      /*
       * 媒体を変えたら、接続先も選び直す。
       *
       * 前の媒体の接続 ID を残したまま送ると、X の鍵で Instagram へ出そうとする
       * ような組み合わせが作れる。失敗するだけならよいが、
       * どちらのアカウントの話なのかが記録からも読めなくなる。
       */
      let connectionId = before.connectionId;
      if (channelKind !== before.channelKind) {
        if (supportsExternalDirectPublish(channelKind)) {
          const validVariant = await validateExternalChannelChange(deps, actor, before);
          if (!validVariant.ok) return validVariant;
        }
        const resolved = await resolveConnection(deps, actor, {
          variantId: String(before.variantId),
          channelKind,
        });
        if (!resolved.ok) return resolved;
        connectionId = resolved.value;
      }

      const saved = await deps.publications.compareAndSwap(before, {
        ...before,
        channelKind,
        connectionId,
        scheduledAt,
      });
      if (!saved.ok) return saved;
      if (saved.value === null) return err(publicationMutationConflict());

      const entry = buildAuditEntry({ ids: deps.ids, now: () => new Date() }, actor, {
        action: "publication.changed",
        targetType: "publication",
        targetId: input.publicationId,
        before: {
          channelKind: before.channelKind,
          scheduledAt: before.scheduledAt?.toISOString() ?? null,
        },
        after: {
          channelKind: saved.value.channelKind,
          scheduledAt: saved.value.scheduledAt?.toISOString() ?? null,
        },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("配信の設定は保存しました", appended.error.details));
      }

      return ok({
        card: toCard(saved.value),
        manualExportNotice: manualNoticeFor(channelKind),
      });
    },
  };
}

// --- 記事 1 本の、配信先ごとの状態 ------------------------------------------

/**
 * 画面の部品（`ChannelStatusList`）が受け取る形。
 *
 * **ここで部品の形に合わせておく。** 合わせないと、画面側が
 * 配信の状態 10 種を 5 種へ畳む対応表を持つことになり、
 * 一覧の画面と詳細の画面で別々の畳み方が育つ。
 */
/**
 * 画面へ渡す配信先の見え方。
 *
 * `iconName` と `statusLabels` の型を能力表と同じまで狭めてある。
 * `string` のままにすると、画面側の部品（`ChannelStatusList`）が求める
 * 3 種の方式・5 つの状態に当てはまらず、**画面の側で型を widen する細工**が要る。
 * 細工を入れると、方式を 1 つ足した日に画面だけが古いまま通ってしまう。
 */
export type ChannelStatusView = {
  readonly kind: ChannelKind;
  readonly label: string;
  readonly accentToken: string;
  readonly iconName: PublishMode;
  readonly statusLabels: Readonly<Record<PublishState, string>>;
};

export type ChannelStatusItem = {
  readonly capability: ChannelStatusView;
  readonly state: "not_started" | "scheduled" | "sending" | "done" | "failed";
  readonly failureReason?: string;
  readonly publicationId: string | null;
};

export type GetContentChannelStatusInput = { readonly variantId: string };
export type GetContentChannelStatusOutput = {
  readonly variantId: string;
  readonly entries: readonly ChannelStatusItem[];
  /** 手当てが要る配信先の数。見出しの脇に出す。 */
  readonly needsAttentionCount: number;
};

/**
 * 配信の 10 状態を、画面の 5 状態へ畳む。
 *
 * **畳む先を 5 つに保つのは、人が一目で読める区切りがそこまでだから。**
 * 「順番待ち」と「本文を組み立て中」の違いは、押せる操作が同じなので
 * 画面では区別しない。区別が要るのは、待てばよいのか（sending）、
 * 手を打つのか（failed）、もう済んだのか（done）である。
 */
function foldState(state: PublicationState): ChannelStatusItem["state"] {
  switch (state) {
    case "PUBLISHED":
      return "done";
    case "FAILED_VALIDATION":
    case "FAILED_SEND":
      return "failed";
    case "SENDING":
    case "RENDERING":
    case "VALIDATING":
    case "RETRY_SCHEDULED":
      return "sending";
    case "MANUAL_EXPORT_READY":
    case "QUEUED":
      return "scheduled";
    // 取りやめは「出していない」と同じ扱いにする。もう一度予約できる。
    case "CANCELLED":
      return "not_started";
  }
}

/**
 * 記事 1 本について、全ての配信先の状態を返す。
 *
 * **配信の記録が無い配信先も、必ず 1 行返す。** 返さないと、画面には
 * 「出した先」だけが並び、出していない先は存在しないように見える。
 * 出し忘れは、並んでいないものからは気づけない。
 */
export function createGetContentChannelStatusUseCase(
  deps: ManageDistributionDeps,
): UseCase<GetContentChannelStatusInput, GetContentChannelStatusOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: GetContentChannelStatusInput,
    ): Promise<Result<GetContentChannelStatusOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "配信状況の参照");
      if (!allowed.ok) return allowed;

      const variantId = taggedString<"ContentVariantId">(input.variantId) as ContentVariantId;
      if ((actor.scopedBrandIds?.length ?? 0) > 0) {
        const variant = await deps.variants.findById(actor.workspaceId, variantId);
        if (!variant.ok) return variant;
        if (variant.value === null) return err(notFound());
        const sameVariant = assertSameTenant(actor, variant.value, "この記事");
        if (!sameVariant.ok) return sameVariant;
        const scopedVariant = await ensureVariantBrandAccess(
          brandAccessDeps(deps),
          actor,
          variant.value,
        );
        if (!scopedVariant.ok) return scopedVariant;
      }

      const listed = await deps.publications.listByVariant(actor.workspaceId, variantId);
      if (!listed.ok) return listed;

      /*
       * 同じ配信先へ何度も出していれば、**新しいほうを採る**。
       * 古い失敗が最後まで赤いままだと、直して出し直したことが画面に出ない。
       */
      const latest = new Map<ChannelKind, Publication>();
      for (const p of listed.value) {
        const prev = latest.get(p.channelKind);
        if (prev === undefined || rankOf(p) >= rankOf(prev)) latest.set(p.channelKind, p);
      }

      const entries: ChannelStatusItem[] = (
        Object.keys(CHANNEL_CAPABILITIES) as ChannelKind[]
      ).map((kind) => {
        const capability = CHANNEL_CAPABILITIES[kind];
        const view: ChannelStatusView = {
          kind,
          label: capability.label,
          accentToken: capability.accentToken,
          iconName: capability.publishMode,
          statusLabels: capability.statusLabels,
        };
        const publication = latest.get(kind);
        if (publication === undefined) {
          return { capability: view, state: "not_started", publicationId: null };
        }
        const state = foldState(publication.state);
        return {
          capability: view,
          state,
          // 失敗の行に理由を必ず添える。理由の無い赤は、見た人に何もできることを与えない。
          failureReason:
            state === "failed"
              ? (publication.lastError ?? "理由が記録されていません。もう一度お試しください。")
              : undefined,
          publicationId: String(publication.id),
        };
      });

      return ok({
        variantId: input.variantId,
        entries,
        needsAttentionCount: entries.filter((e) => e.state === "failed").length,
      });
    },
  };
}

/**
 * 同じ配信先の記録どうしを比べる順番。
 *
 * 予約時刻ではなく**状態の進み具合**で比べる。予約時刻は取りやめた古い記録の
 * ほうが後ろにあることがあり、時刻で比べると取りやめが最新として残る。
 */
function rankOf(p: Publication): number {
  const order: Readonly<Record<PublicationState, number>> = {
    CANCELLED: 0,
    QUEUED: 1,
    RENDERING: 2,
    VALIDATING: 3,
    RETRY_SCHEDULED: 4,
    FAILED_VALIDATION: 5,
    FAILED_SEND: 5,
    SENDING: 6,
    MANUAL_EXPORT_READY: 7,
    PUBLISHED: 8,
  };
  return order[p.state];
}
