import type { EventPublisherPort, IdGeneratorPort } from "@/application/ports/common";
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

      const existing = await deps.inbox.findByNormalizedUrl(actor.workspaceId, normalized.value);
      if (!existing.ok) return existing;

      const created = createLinkIngestion({
        id: taggedString<"LinkIngestionId">(`li_${deps.ids.newId()}`),
        workspaceId: actor.workspaceId,
        submittedUrl: input.url,
        source: input.source,
        submittedAt: new Date(),
        existing: existing.value === null ? [] : [existing.value],
        note: input.note ?? null,
      });
      if (!created.ok) return created;

      const saved = await deps.inbox.save(created.value);
      if (!saved.ok) return saved;

      await emit(deps, actor, "affiliate_url.submitted", {
        linkIngestionId: String(saved.value.id),
        url: saved.value.submittedUrl,
      });

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

      // 対象外にしたことは出来事として流さない。
      // 受け手（商品・記事）が反応する必要がなく、流すと意味の無い連絡が増える。
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
