import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { EventPublisherPort, IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import type {
  AffiliateProgramRepositoryPort,
  CommercialLinkIngestionRepositoryPort,
} from "@/application/ports/monetization";
import { requireCapability } from "@/domain/identity";
import {
  ASP_LABEL,
  LINK_INGESTION_SOURCE_LABEL,
  LINK_INGESTION_STATE_LABEL,
  type LinkIngestion,
  type LinkIngestionSource,
  type LinkIngestionState,
  createLinkIngestion,
  matchProduct,
  nextActionsFor,
  normalizeAffiliateUrl,
  rejectIngestion,
  resolveProgram,
} from "@/domain/monetization";
import {
  type ActorContext,
  type AffiliateProgramId,
  type DomainError,
  type DomainEventName,
  type LinkIngestionId,
  type ProductId,
  type Result,
  buildEvent,
  err,
  notFound,
  ok,
  readDataClass,
  taggedString,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 成果リンクの受信箱（プラットフォーム層 §9.2）。
 *
 * **貼り付けから商品に結びつくまでを 1 本の道にする。**
 * ここが無いと、受け取った URL は誰かのメモに散らばり、
 * 「この記事のリンクはどこから来たのか」を後から辿れなくなる。
 *
 * 受信箱は Commercial 区分。順位づけへは決して渡さない。
 */
export type ManageLinkInboxDeps = {
  readonly inbox: CommercialLinkIngestionRepositoryPort;
  readonly programs: AffiliateProgramRepositoryPort;
  readonly ids: IdGeneratorPort;
  readonly events: EventPublisherPort;
  /**
   * 誰がこのリンクを進めたかの記録。
   *
   * 出来事 (`events`) とは役割が違う。出来事は**受け手に知らせるため**で、
   * 受け手がいなければ流れなくてよい。記録は**後から人が読むため**で、
   * 残せなかったら操作を成功として返さない。
   */
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
};

function guardCommercial(deps: ManageLinkInboxDeps): void {
  if (readDataClass(deps.inbox) !== "commercial") {
    throw new Error(
      "受信箱のつなぎ目に商業データの印が付いていません。印が無いと順位づけ側へ渡せてしまいます。",
    );
  }
}

/**
 * 出来事を流す。
 *
 * 流せなかったことを理由に、済んだ操作を失敗にしない。
 * 受け手がいない状態でも送り手の処理は完了しているため。
 */
async function emit(
  deps: ManageLinkInboxDeps,
  actor: ActorContext,
  name: DomainEventName,
  payload: Readonly<Record<string, unknown>>,
): Promise<void> {
  const event = buildEvent(name, String(actor.workspaceId), new Date(), payload);
  if (!event.ok) return;
  await deps.events.publish(event.value);
}

export type LinkIngestionView = {
  readonly id: string;
  readonly submittedUrl: string;
  readonly host: string;
  readonly sourceLabel: string;
  readonly submittedAt: Date;
  readonly state: LinkIngestionState;
  readonly stateLabel: string;
  readonly programId: string | null;
  readonly programLabel: string | null;
  readonly productId: string | null;
  /** 重複しているとき、その相手。画面では「同じものが既にあります」と出す。 */
  readonly duplicateOf: string | null;
  readonly rejectedReason: string | null;
  /** 次にできること。画面のボタンとツールの引数はここから作る。 */
  readonly nextStates: readonly LinkIngestionState[];
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "—";
  }
}

function toView(item: LinkIngestion, programLabel: string | null): LinkIngestionView {
  return {
    id: String(item.id),
    submittedUrl: item.submittedUrl,
    host: hostOf(item.submittedUrl),
    sourceLabel: LINK_INGESTION_SOURCE_LABEL[item.source],
    submittedAt: item.submittedAt,
    state: item.state,
    stateLabel: LINK_INGESTION_STATE_LABEL[item.state],
    programId: item.programId === null ? null : String(item.programId),
    programLabel,
    productId: item.productId === null ? null : String(item.productId),
    duplicateOf: item.duplicateOf === null ? null : String(item.duplicateOf),
    rejectedReason: item.rejectedReason,
    nextStates: nextActionsFor(item),
  };
}

// --- 一覧 -------------------------------------------------------------------

export type ListLinkInboxInput = { readonly state?: LinkIngestionState | "all" };

export type ListLinkInboxOutput = {
  readonly items: readonly LinkIngestionView[];
  readonly total: number;
  /** 状態ごとの件数。「何件が手つかずか」を数えるのは画面の仕事ではない。 */
  readonly countsByState: Readonly<Record<LinkIngestionState, number>>;
  readonly duplicateCount: number;
  readonly emptyReason: string | null;
};

const EMPTY_COUNTS: Readonly<Record<LinkIngestionState, number>> = {
  received: 0,
  resolved: 0,
  matched: 0,
  rejected: 0,
};

export function createListLinkInboxUseCase(
  deps: ManageLinkInboxDeps,
): UseCase<ListLinkInboxInput, ListLinkInboxOutput> {
  guardCommercial(deps);
  return {
    async execute(actor, input): Promise<Result<ListLinkInboxOutput, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.read_revenue", "受信箱の参照");
      if (!allowed.ok) return allowed;

      const filter = !input.state || input.state === "all" ? null : input.state;
      const listed = await deps.inbox.list(actor.workspaceId, { state: filter }, {
        limit: 100,
        cursor: null,
      });
      if (!listed.ok) return listed;

      const programs = await deps.programs.list(actor.workspaceId, { limit: 100, cursor: null });
      const labelOf = new Map<string, string>(
        programs.ok
          ? programs.value.items.map((p) => [String(p.id), `${p.advertiserName}（${ASP_LABEL[p.asp]}）`])
          : [],
      );

      const counts = { ...EMPTY_COUNTS };
      for (const item of listed.value.items) counts[item.state] += 1;

      const items = listed.value.items.map((i) =>
        toView(i, i.programId === null ? null : (labelOf.get(String(i.programId)) ?? null)),
      );

      return ok({
        items,
        total: items.length,
        countsByState: counts,
        duplicateCount: items.filter((i) => i.duplicateOf !== null).length,
        emptyReason:
          items.length === 0
            ? filter === null
              ? "受信箱はからです。成果リンクを貼り付けると、ここに並びます。"
              : `「${LINK_INGESTION_STATE_LABEL[filter]}」のものはありません。`
            : null,
      });
    },
  };
}

// --- 受け取り ---------------------------------------------------------------

export type SubmitAffiliateUrlInput = {
  readonly url: string;
  readonly source: LinkIngestionSource;
  readonly note?: string;
};

export type SubmitAffiliateUrlOutput = {
  readonly item: LinkIngestionView;
  /** 同じ URL が既にあったか。**捨てずに受け取ったうえで知らせる。** */
  readonly duplicate: boolean;
  readonly message: string;
};

export function createSubmitAffiliateUrlUseCase(
  deps: ManageLinkInboxDeps,
): UseCase<SubmitAffiliateUrlInput, SubmitAffiliateUrlOutput> {
  guardCommercial(deps);
  return {
    async execute(actor, input): Promise<Result<SubmitAffiliateUrlOutput, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.manage", "成果リンクの受け取り");
      if (!allowed.ok) return allowed;

      const normalized = normalizeAffiliateUrl(input.url);
      if (!normalized.ok) return normalized;
      const normalizedUrl = normalized.value;

      /*
       * 重複の判定は「先に読む」ではなく「先に取りに行く」。
       *
       * 読んでから入れる形だと、2 人が同時に同じ URL を貼ったときに
       * 両方が「無い」を読み、どちらにも印が付かないまま 2 行入る。
       * 取り合い（`claimNormalizedUrl`）は同時に呼ばれても勝ちを 1 本に
       * 決めるので、負けた側は必ず相手を指せる。
       *
       * ID を先に作るのはそのため。取り合いには「誰が取ったか」が要る。
       */
      const id = taggedString<"LinkIngestionId">(`li_${deps.ids.newId()}`) as LinkIngestionId;
      const claimed = await deps.inbox.claimNormalizedUrl(
        actor.workspaceId,
        normalizedUrl,
        id,
      );
      if (!claimed.ok) return claimed;
      const ownsClaim = String(claimed.value) === String(id);
      async function failAfterClaim<T>(failure: Result<T, DomainError>): Promise<Result<T, DomainError>> {
        if (!ownsClaim || failure.ok) return failure;
        const released = await deps.inbox.releaseNormalizedUrl(
          actor.workspaceId,
          normalizedUrl,
          id,
        );
        // 解放できないほうが後続を恒久的に塞ぐため、こちらを優先して知らせる。
        return released.ok ? failure : released;
      }

      const created = createLinkIngestion({
        id,
        workspaceId: actor.workspaceId,
        submittedUrl: input.url,
        source: input.source,
        submittedAt: new Date(),
        /*
         * 取り合いの返り値が重複判定の正本。
         *
         * 負けたあとに勝者本体を読み直すと、勝者がまだ保存前の瞬間だけ
         * null が返り、確定済みの負けを「重複なし」へ戻してしまう。
         * 対象外の勝者は取り合いから降りるため、claim が残っている間は
         * その ID をそのまま相手としてよい。
         */
        duplicateOf: ownsClaim ? null : claimed.value,
        note: input.note ?? null,
      });
      if (!created.ok) return failAfterClaim(created);

      const saved = await deps.inbox.save(created.value);
      if (!saved.ok) return failAfterClaim(saved);

      await emit(deps, actor, "affiliate_url.submitted", {
        linkIngestionId: String(saved.value.id),
        url: saved.value.submittedUrl,
      });

      /*
       * 誰がこのリンクを持ち込んだかを残す。**記録は保存の後**に書く。
       *
       * ここが記録の起点になる。後の「広告主を決めた」「商品に結びつけた」は
       * 同じ `targetId` で辿れるので、リンク 1 本の来歴が
       * 受け取りから最後まで 1 本につながる。
       *
       * `duplicateOf` を入れるのは、同じ URL が 2 回持ち込まれたときに
       * 「消していない」判断の跡を残すため。後から二重計上を疑われたときに、
       * どちらを本体として扱ったかがここでしか分からない。
       */
      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "affiliate_link.created",
        targetType: "link_ingestion",
        targetId: String(saved.value.id),
        after: {
          /*
           * URL 全体ではなく**行き先のホスト名だけ**を残す。
           * 成果リンクの URL には成果の割り当て先を示す文字列が入っており、
           * 記録として広く読まれる場所へ置くものではない。
           * 「どこ宛てのリンクを受け取ったか」はホスト名で足りる。
           */
          host: hostOf(saved.value.submittedUrl),
          source: saved.value.source,
          state: saved.value.state,
          duplicateOf: saved.value.duplicateOf === null ? null : String(saved.value.duplicateOf),
        },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("リンクは受信箱に入っています", appended.error.details));
      }

      const duplicate = saved.value.duplicateOf !== null;
      return ok({
        item: toView(saved.value, null),
        duplicate,
        message: duplicate
          ? "受け取りました。同じリンクが既に受信箱にあります（消していません）。"
          : "受け取りました。次は、どの広告主のリンクかを決めてください。",
      });
    },
  };
}

// --- 広告主を決める ---------------------------------------------------------

export type ResolveLinkIngestionInput = {
  readonly linkIngestionId: string;
  readonly programId: string;
};

export function createResolveLinkIngestionUseCase(
  deps: ManageLinkInboxDeps,
): UseCase<ResolveLinkIngestionInput, LinkIngestionView> {
  guardCommercial(deps);
  return {
    async execute(actor, input): Promise<Result<LinkIngestionView, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.manage", "広告主の確定");
      if (!allowed.ok) return allowed;

      const found = await deps.inbox.findById(
        actor.workspaceId,
        taggedString<"LinkIngestionId">(input.linkIngestionId) as LinkIngestionId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("受信箱のリンク", input.linkIngestionId));

      const programId = taggedString<"AffiliateProgramId">(input.programId) as AffiliateProgramId;
      const program = await deps.programs.findById(actor.workspaceId, programId);
      if (!program.ok) return program;
      if (program.value === null) return err(notFound("提携プログラム", input.programId));

      const next = resolveProgram(found.value, programId);
      if (!next.ok) return next;

      const saved = await deps.inbox.save(next.value);
      if (!saved.ok) return saved;

      await emit(deps, actor, "affiliate_url.resolved", {
        linkIngestionId: String(saved.value.id),
        programId: String(programId),
      });

      /*
       * どの広告主のリンクだと決めたのは誰か。**記録は保存の後**に書く。
       *
       * ここで決めた広告主が、後の報酬の宛先になる。取り違えたときに
       * 「誰がいつそう決めたか」が言えないと、直す相手が分からない。
       */
      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "affiliate_link.changed",
        targetType: "link_ingestion",
        targetId: String(saved.value.id),
        /*
         * 前の広告主を `null` と決め打たない。決め直しのときに
         * 「どこから変えたか」が消え、取り違えの追跡ができなくなる。
         */
        before: {
          state: found.value.state,
          programId: found.value.programId === null ? null : String(found.value.programId),
        },
        after: { state: saved.value.state, programId: String(programId) },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("広告主は決まっています", appended.error.details));
      }

      return ok(
        toView(saved.value, `${program.value.advertiserName}（${ASP_LABEL[program.value.asp]}）`),
      );
    },
  };
}

// --- 商品に結びつける -------------------------------------------------------

export type MatchLinkIngestionInput = {
  readonly linkIngestionId: string;
  readonly productId: string;
};

export function createMatchLinkIngestionUseCase(
  deps: ManageLinkInboxDeps,
): UseCase<MatchLinkIngestionInput, LinkIngestionView> {
  guardCommercial(deps);
  return {
    async execute(actor, input): Promise<Result<LinkIngestionView, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.manage", "商品との結びつけ");
      if (!allowed.ok) return allowed;

      const found = await deps.inbox.findById(
        actor.workspaceId,
        taggedString<"LinkIngestionId">(input.linkIngestionId) as LinkIngestionId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("受信箱のリンク", input.linkIngestionId));

      const next = matchProduct(
        found.value,
        taggedString<"ProductId">(input.productId) as ProductId,
      );
      if (!next.ok) return next;

      const saved = await deps.inbox.save(next.value);
      if (!saved.ok) return saved;

      await emit(deps, actor, "product.matched", {
        linkIngestionId: String(saved.value.id),
        productId: input.productId,
      });

      /*
       * どの商品に結びつけたのは誰か。**記録は保存の後**に書く。
       *
       * この結びつけが、記事に出るリンクの行き先を決める。
       * 別の商品のリンクが貼られていたと分かったとき、直す前に
       * 「いつからそうなっていたか」を知る必要がある。
       */
      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "affiliate_link.changed",
        targetType: "link_ingestion",
        targetId: String(saved.value.id),
        before: {
          state: found.value.state,
          productId: found.value.productId === null ? null : String(found.value.productId),
        },
        after: { state: saved.value.state, productId: input.productId },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("商品との結びつけは済んでいます", appended.error.details));
      }

      return ok(toView(saved.value, null));
    },
  };
}

// --- 対象外にする -----------------------------------------------------------

export type RejectLinkIngestionInput = {
  readonly linkIngestionId: string;
  readonly reason: string;
};

export function createRejectLinkIngestionUseCase(
  deps: ManageLinkInboxDeps,
): UseCase<RejectLinkIngestionInput, LinkIngestionView> {
  guardCommercial(deps);
  return {
    async execute(actor, input): Promise<Result<LinkIngestionView, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.manage", "受信箱の整理");
      if (!allowed.ok) return allowed;

      const found = await deps.inbox.findById(
        actor.workspaceId,
        taggedString<"LinkIngestionId">(input.linkIngestionId) as LinkIngestionId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("受信箱のリンク", input.linkIngestionId));

      const next = rejectIngestion(found.value, input.reason);
      if (!next.ok) return next;

      const saved = await deps.inbox.save(next.value);
      if (!saved.ok) return saved;

      /*
       * 対象外にしたら、その URL の取り合いから降りる。
       *
       * 降ろさないと、捨てたリンクを相手に指した「重複」が次から延々と出る。
       * claim の勝者 ID が重複相手の正本なので、対象外になった勝者を
       * 取り合いに残すと、その ID を次の貼り付けが指し続けるため。
       */
      const released = await deps.inbox.releaseNormalizedUrl(
        actor.workspaceId,
        saved.value.normalizedUrl,
        saved.value.id,
      );
      if (!released.ok) return released;

      // 対象外にしたことは出来事として流さない。
      // 受け手（商品・記事）が反応する必要がなく、流すと意味の無い連絡が増える。

      /*
       * 一方で、記録は**流さないからこそ必要**になる。
       * 出来事を流さない操作は、この記録が消えると跡が 1 つも残らない。
       *
       * 理由は `affiliate_link.rejected` の必須項目にしてある。
       * 「なぜ捨てたか」は `before` と `after` の差からは読めないので、
       * 理由の欄が空のまま通ると、後から捨てた判断を説明できなくなる。
       */
      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "affiliate_link.rejected",
        targetType: "link_ingestion",
        targetId: String(saved.value.id),
        before: { state: found.value.state },
        after: { state: saved.value.state },
        reason: input.reason,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("このリンクは対象外になっています", appended.error.details));
      }

      return ok(toView(saved.value, null));
    },
  };
}

/** 受信箱でこれから使う予定の状態名。画面の絞り込みに使う。 */
export const LINK_INBOX_FILTERS: readonly (LinkIngestionState | "all")[] = [
  "all",
  "received",
  "resolved",
  "matched",
  "rejected",
];

/** 絞り込みの表示名。画面とツールで同じ言葉にする。 */
export function filterLabel(filter: LinkIngestionState | "all"): string {
  return filter === "all" ? "すべて" : LINK_INGESTION_STATE_LABEL[filter];
}

/** 受信箱がからのときに出す案内。文言を画面ごとに書き起こさない。 */
export const INBOX_INTRO =
  "成果リンクを貼り付けると、重複を確かめたうえで受信箱に入ります。広告主と商品を決めるまで、記事には出しません。";
