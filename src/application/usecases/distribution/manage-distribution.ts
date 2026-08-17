import type { EditorialContentVariantRepositoryPort } from "@/application/ports/authoring";
import type { IdGeneratorPort } from "@/application/ports/common";
import type {
  ChannelConnectionRepositoryPort,
  ManualExportPort,
  PublicationRepositoryPort,
} from "@/application/ports/distribution";
import {
  CHANNEL_CAPABILITIES,
  type ChannelCapability,
  type ChannelKind,
  type Publication,
  type PublicationState,
  advance,
  buildIdempotencyKey,
  createPublication,
  isConnectionUsable,
  supportsDirectPublish,
} from "@/domain/distribution";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type ChannelConnectionId,
  type ContentVariantId,
  type DomainError,
  type PublicationId,
  type Result,
  assertSameTenant,
  domainError,
  err,
  ok,
  taggedString,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

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
  readonly publications: PublicationRepositoryPort;
  readonly manualExport: ManualExportPort;
  /**
   * 記事の本文。書き出しに要る。
   *
   * 配信の記録は「どこへ、どの状態で出したか」しか持たない。
   * 貼り付ける中身は記事側にあるので、ここから読む。
   */
  readonly variants: EditorialContentVariantRepositoryPort;
  /** ID 生成。配信を新しく作るときに要る。 */
  readonly ids: IdGeneratorPort;
};

/** 出し方の表示名。識別子をそのまま画面に出さない。 */
export const PUBLISH_MODE_LABEL: Readonly<Record<string, string>> = {
  api_publish: "自動で投稿できる",
  api_schedule: "自動で予約投稿できる",
  manual_export: "下書きを書き出して、ご自身で投稿する",
};

/** 配信の状態の表示名。 */
export const PUBLICATION_STATE_LABEL: Readonly<Record<PublicationState, string>> = {
  QUEUED: "順番待ち",
  RENDERING: "本文を組み立て中",
  VALIDATING: "出す前の確認中",
  SENDING: "送信中",
  PUBLISHED: "公開済み",
  MANUAL_EXPORT_READY: "書き出し済み（貼り付け待ち）",
  FAILED_VALIDATION: "確認で止まった",
  FAILED_SEND: "送信に失敗した",
  RETRY_SCHEDULED: "再送を待っている",
  CANCELLED: "取りやめ",
};

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
): string | null {
  if (capability.publishMode === "manual_export") {
    return `${capability.label} には公開された投稿の仕組みがありません。下書きを書き出して、ご自身で投稿してください。`;
  }
  if (connected.length === 0) {
    return `${capability.label} との接続がまだありません。接続してから配信できます。`;
  }
  return null;
}

export function createListChannelsUseCase(
  deps: ManageDistributionDeps,
): UseCase<Record<string, never>, ListChannelsOutput> {
  return {
    async execute(actor: ActorContext): Promise<Result<ListChannelsOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "配信先の参照");
      if (!allowed.ok) return allowed;

      const listed = await deps.connections.listByWorkspace(actor.workspaceId, {
        limit: 100,
        cursor: null,
      });
      if (!listed.ok) return listed;

      const now = new Date();
      const channels = (Object.keys(CHANNEL_CAPABILITIES) as ChannelKind[]).map((kind) => {
        const capability = CHANNEL_CAPABILITIES[kind];
        const mine = listed.value.items.filter((c) => c.kind === kind);
        const usable = mine.filter((c) => isConnectionUsable(c, now));
        const unusable = mine
          .filter((c) => !isConnectionUsable(c, now))
          .map((c) =>
            c.revokedAt !== null
              ? `${c.accountLabel}: 接続が取り消されています。`
              : `${c.accountLabel}: 接続の期限が切れています。つなぎ直してください。`,
          );
        const connected = usable.map((c) => c.accountLabel);
        return {
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
          blockedReason: blockedReasonFor(capability, connected),
        };
      });

      return ok({
        channels,
        connectedCount: channels.filter((c) => c.connectedAccounts.length > 0).length,
        manualOnlyCount: channels.filter((c) => !c.canDirectPublish).length,
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

      const listed = await deps.publications.listRecent(actor.workspaceId, input.limit ?? 50);
      if (!listed.ok) return listed;

      const items = listed.value.map(toCard);
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

      const moved = advance(found.value, "CANCELLED", { at: new Date() });
      if (!moved.ok) return moved;

      const saved = await deps.publications.save(moved.value);
      if (!saved.ok) return saved;
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
      const variant = await deps.variants.findById(actor.workspaceId, publication.variantId);
      if (!variant.ok) return variant;
      if (variant.value === null) {
        return err(
          domainError("NOT_FOUND", "この配信のもとになった記事が見つかりません。", {
            suggestedAction: "記事の一覧から選び直して、もう一度書き出してください。",
          }),
        );
      }

      const draft = await deps.manualExport.buildDraft({
        connectionId: publication.connectionId ?? taggedString<"ChannelConnectionId">("none"),
        idempotencyKey: publication.idempotencyKey,
        title: variant.value.title,
        body: variant.value.body,
        imageKeys: [],
        scheduledAt: publication.scheduledAt,
        disclosureText: variant.value.disclosure,
      });
      if (!draft.ok) return draft;

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

      const variant = await deps.variants.findById(actor.workspaceId, variantId);
      if (!variant.ok) return variant;
      if (variant.value === null) {
        return err(
          domainError("NOT_FOUND", "この記事が見つかりません。", {
            suggestedAction: "記事の一覧から選び直してください。",
          }),
        );
      }
      const sameVariant = assertSameTenant(actor, variant.value, "この記事");
      if (!sameVariant.ok) return sameVariant;

      // 承認前を通さない。ここが最後の関所で、画面の出し分けは補助でしかない。
      if (variant.value.status !== "approved" && variant.value.status !== "published") {
        return err(
          domainError("CONFLICT", "承認が済んでいない記事は配信できません。", {
            suggestedAction:
              "記事の画面で内容を確認し、承認してから配信してください（承認は人が行います）。",
          }),
        );
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

      // 同じ要求が既にあれば、それを返す。作り直さない。
      const idempotencyKey = buildIdempotencyKey({
        variantId,
        channelKind: input.channelKind,
        scheduledAt,
      });
      const existing = await deps.publications.findByIdempotencyKey(
        actor.workspaceId,
        idempotencyKey,
      );
      if (!existing.ok) return existing;
      if (existing.value !== null) {
        return ok({
          card: toCard(existing.value),
          alreadyExisted: true,
          manualExportNotice: manualNoticeFor(input.channelKind),
        });
      }

      const created = createPublication({
        id: taggedString<"PublicationId">(`pub_${deps.ids.newId()}`) as PublicationId,
        workspaceId: actor.workspaceId,
        variantId,
        channelKind: input.channelKind,
        connectionId: connectionId.value,
        scheduledAt,
        idempotencyKey,
      });
      if (!created.ok) return created;

      const saved = await deps.publications.save(created.value);
      if (!saved.ok) return saved;

      return ok({
        card: toCard(saved.value),
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
  if (!supportsDirectPublish(input.channelKind)) return ok(null);

  const listed = await deps.connections.listByWorkspace(actor.workspaceId, {
    limit: 100,
    cursor: null,
  });
  if (!listed.ok) return listed;

  const now = new Date();
  const usable = listed.value.items.filter(
    (c) => c.kind === input.channelKind && isConnectionUsable(c, now),
  );

  if (input.connectionId != null && input.connectionId !== "") {
    const chosen = usable.find((c) => String(c.id) === input.connectionId);
    if (chosen === undefined) {
      return err(
        domainError("NOT_FOUND", `指定された ${capability.label} の接続が使えません。`, {
          suggestedAction:
            "接続が取り消されているか、期限が切れています。設定の画面でつなぎ直してください。",
        }),
      );
    }
    return ok(chosen.id);
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
