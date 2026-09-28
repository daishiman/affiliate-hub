import type {
  AutoApplyLogEntry,
  CitationMonthlyBudgetStatus,
  PageMetric,
  SeoArticleRevisionPort,
  SeoArticleState,
  SeoAutoApplyLogPort,
  SeoFindingPort,
  SeoCitationBudgetPort,
  SeoMeasurementSettingPort,
  SeoPageMetricPort,
  SeoSearchQueryReadPort,
  SeoSourceCollectionPort,
  SearchQueryMetric,
} from "@/application/ports/seo-measurement";
import type { SeoStaticAuditPort, StaticAuditCoverage } from "@/application/ports/seo-static-audit";
import { articleHref, type PublishedArticle } from "@/application/read-models/published-article";
import { applyFindingsToArticle } from "@/application/seo/aeo-measurement/auto-fix";
import { requireCapability } from "@/domain/identity";
import {
  AUTO_APPLY_BLOCK_LABEL,
  MEASUREMENT_SOURCE_CAN_JUSTIFY_AUTO_APPLY,
  MEASUREMENT_STALE_AFTER_MS,
  type Finding,
  type PageKey,
  type SourceHealth,
  UNAPPLIED_AGE_THRESHOLD_MS,
  UNAPPLIED_BACKLOG_THRESHOLD,
  autoApplyStalled,
  byUrgency,
  decideAutoApply,
  effectJudgementPending,
  sourceHealth,
} from "@/domain/seo/aeo-measurement";
import {
  type ActorContext,
  type DomainError,
  type Result,
  type WorkspaceId,
  assertSameTenant,
  assertWorkspaceWideAccess,
  domainError,
  err,
  notFound,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

const OBSERVATION_WINDOW_DAYS = 28;
/** 画面の説明とrepositoryのread上限を同じ値にする。 */
export const SEARCH_QUERY_DISPLAY_LIMIT = 100;

/** 記事単位の差分確認と承認。保存と取消は版を照合する一括確定の口へ委ねる。 */
export type ManageSeoAutoApplyDeps = {
  readonly workspaceId: WorkspaceId;
  readonly findings: SeoFindingPort;
  readonly logs: SeoAutoApplyLogPort;
  readonly settings: SeoMeasurementSettingPort;
  readonly collections: SeoSourceCollectionPort;
  readonly revisions: SeoArticleRevisionPort;
  readonly metrics: SeoPageMetricPort;
  readonly queryMetrics: SeoSearchQueryReadPort;
  readonly searchConsoleConfigured: boolean;
  readonly aiCitationConfigured: boolean;
  readonly citationBudgets: SeoCitationBudgetPort;
  readonly staticAudits: SeoStaticAuditPort;
  readonly now: () => Date;
};

export type ManageSeoAutoApplyInput =
  | { readonly action: "preview"; readonly siteSlug: string; readonly articleSlug: string }
  | { readonly action: "apply"; readonly siteSlug: string; readonly articleSlug: string; readonly approvalToken: string }
  | { readonly action: "revert"; readonly logId: string }
  | { readonly action: "pause" }
  | { readonly action: "resume" }
  | { readonly action: "set_citation_monthly_limit"; readonly limit: number }
  | { readonly action: "dashboard"; readonly siteSlug?: string; readonly limit: number };

export type SeoDashboardOutput = {
  readonly action: "dashboard";
  readonly paused: boolean;
  readonly introducedAt: string;
  /** 重い順に並んだ所見。画面が並べ替えない（画面ごとに順が変わらないように）。 */
  readonly findings: readonly Finding[];
  readonly sources: readonly SourceHealth[];
  readonly recentApplies: readonly {
    readonly entry: AutoApplyLogEntry;
    /** 効果を判定してよい時期に来ているか（NFR7）。 */
    readonly effectPending: boolean;
  }[];
  /** 自動反映が実質止まっている疑い（NFR6）。 */
  readonly autoApplyStalled: boolean;
  readonly unappliedCount: number;
  readonly candidates: readonly SeoRevisionCandidate[];
  readonly citationMonthlyBudget: CitationMonthlyBudgetStatus;
  /** 「所見0件」を全件確認済みと取り違えないための、ブログ別の確認範囲。 */
  readonly staticAuditCoverage: readonly StaticAuditCoverage[];
};

export type SeoRevisionCandidate = {
  readonly siteSlug: string;
  readonly articleSlug: string;
  readonly pageKey: string;
  readonly title: string;
  readonly findingCount: number;
};

export type SeoRevisionChange = {
  readonly field: "title" | "summary";
  readonly label: string;
  readonly before: string;
  readonly after: string;
};

export type SeoRevisionPreviewOutput = {
  readonly action: "preview";
  readonly article: { readonly siteSlug: string; readonly articleSlug: string; readonly pageKey: string | null; readonly title: string; readonly url: string };
  readonly changes: readonly SeoRevisionChange[];
  readonly diffSummary: string;
  readonly approvalToken: string | null;
  readonly blockedReason: string | null;
  readonly metrics: {
    readonly from: string;
    readonly to: string;
    readonly rows: readonly PageMetric[];
    readonly error: string | null;
  };
  /** Search Consoleが返した日別内訳。ページ総計へは合算しない。 */
  readonly searchQueries: {
    readonly from: string;
    readonly to: string;
    readonly rows: readonly SearchQueryMetric[];
    readonly truncated: boolean;
    readonly requestedDayCount: number;
    readonly availableDayCount: number;
    readonly unfinishedDayCount: number;
    readonly limitedDates: readonly string[];
    readonly unknownLimitDayCount: number;
    readonly latestCompletedAt: string | null;
    readonly error: string | null;
    readonly configured: boolean;
  };
};

export type ManageSeoAutoApplyOutput =
  | SeoDashboardOutput
  | SeoRevisionPreviewOutput
  | { readonly action: "apply"; readonly entry: AutoApplyLogEntry }
  | { readonly action: "revert"; readonly entry: AutoApplyLogEntry }
  | { readonly action: "pause" | "resume"; readonly paused: boolean }
  | { readonly action: "set_citation_monthly_limit"; readonly limit: number };

export function createManageSeoAutoApply(
  deps: ManageSeoAutoApplyDeps,
): UseCase<ManageSeoAutoApplyInput, ManageSeoAutoApplyOutput> {
  return {
    async execute(actor, input) {
      const tenant = assertSameTenant(actor, { workspaceId: deps.workspaceId }, "検索の見え方");
      if (!tenant.ok) return tenant;
      const scope = assertWorkspaceWideAccess(actor, "検索の見え方");
      if (!scope.ok) return scope;
      const readOnly = input.action === "dashboard" || input.action === "preview";
      const operation = readOnly ? "検索の見え方の閲覧"
        : input.action === "set_citation_monthly_limit" ? "AI検索の月次上限の変更" : "記事の改稿操作";
      const allowed = requireCapability(actor, readOnly ? "analytics.read" : "site.manage", operation);
      if (!allowed.ok) return allowed;
      if ((input.action === "apply" || input.action === "revert" || input.action === "pause"
          || input.action === "resume" || input.action === "set_citation_monthly_limit")
          && (!actor.identified || actor.isAiServiceAccount)) {
        return err(domainError("FORBIDDEN", "この変更はログインした運営者が操作してください。"));
      }
      const now = deps.now().toISOString();
      switch (input.action) {
        case "preview":
        case "apply": {
          if (!input.siteSlug?.trim() || !input.articleSlug?.trim()) return err(validationError("ブログと記事を選んでください。"));
          const prepared = await prepareRevision(deps, actor, { siteSlug: input.siteSlug, articleSlug: input.articleSlug }, now);
          if (!prepared.ok) return prepared;
          const { before, after, justifiedBy, appliedCodes, preview } = prepared.value;
          if (input.action === "preview") return ok(preview);
          if (!input.approvalToken || input.approvalToken !== preview.approvalToken || after === null || preview.article.pageKey === null) {
            return err(domainError("CONFLICT", preview.blockedReason ?? "記事または所見が変わりました。最新の差分を確認してから反映してください。", { suggestedAction: "最新の差分を開き直してください。" }));
          }
          const saved = await deps.revisions.applyApproved({
            before, after: { ...after, updatedAt: now.slice(0, 10) },
            plan: {
              snapshot: { pageKey: preview.article.pageKey as PageKey, takenAt: now, articleJson: JSON.stringify(before.article) },
              justifiedBy, appliedAt: now,
            },
            appliedCodes, diffSummary: preview.diffSummary, approvedBy: actor.userId,
          });
          return saved.ok ? ok({ action: "apply", entry: saved.value }) : saved;
        }
        case "revert": {
          if (!input.logId?.trim()) return err(validationError("取り消す履歴を選んでください。"));
          const reverted = await deps.revisions.revert({ logId: input.logId, at: now, revertedBy: actor.userId });
          return reverted.ok ? ok({ action: "revert", entry: reverted.value }) : reverted;
        }
        case "pause":
        case "resume": {
          const saved = await deps.settings.setPaused({ paused: input.action === "pause", at: now });
          return saved.ok ? ok({ action: input.action, paused: saved.value.autoApplyPaused }) : saved;
        }
        case "set_citation_monthly_limit": {
          const saved = await deps.settings.setCitationMonthlySearchLimit(input.limit);
          return saved.ok ? ok({ action: input.action, limit: saved.value.citationMonthlySearchLimit ?? 0 }) : saved;
        }
        case "dashboard":
          if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) return err(validationError("表示件数は1〜100件で指定してください。"));
          return dashboard(deps, input, now);
        default:
          return err(validationError("記事を選び、差分の確認から操作してください。"));
      }
    },
  };
}

type PreparedRevision = {
  readonly before: SeoArticleState;
  readonly after: PublishedArticle | null;
  readonly justifiedBy: readonly Finding[];
  readonly appliedCodes: readonly Finding["code"][];
  readonly preview: SeoRevisionPreviewOutput;
};

async function prepareRevision(
  deps: ManageSeoAutoApplyDeps,
  actor: ActorContext,
  input: { readonly siteSlug: string; readonly articleSlug: string },
  now: string,
): Promise<Result<PreparedRevision, DomainError>> {
  const found = await deps.revisions.find(input);
  if (!found.ok) return found;
  if (found.value === null) return err(notFound("記事", input.articleSlug));
  const before = found.value;
  const groups = await deps.findings.groupedByArticle({ ...input, limit: 1, includeApplied: true });
  if (!groups.ok) return groups;
  const group = groups.value.find((g) => g.siteSlug === input.siteSlug && g.articleSlug === input.articleSlug);
  let pageKey = group?.pageKey ?? null;
  if (pageKey === null) {
    const observed = await deps.findings.observedPageKey(input);
    if (!observed.ok) return observed;
    pageKey = observed.value;
  }
  const setting = await deps.settings.loadOrCreate(now);
  if (!setting.ok) return setting;

  const lastApplied = pageKey === null ? ok(null) : await deps.logs.lastAppliedAt(pageKey);
  if (!lastApplied.ok) return lastApplied;
  const decision = decideAutoApply({ now, paused: setting.value.autoApplyPaused,
    loopIntroducedAt: setting.value.introducedAt, articleCreatedAt: before.createdAt,
    lastAppliedAt: lastApplied.value, findings: group?.findings ?? [],
  });
  // 停止・冷却中も内容は確認できる。確定の可否とは分ける。
  const fix = applyFindingsToArticle(before.article, (group?.findings ?? []).filter((f) => MEASUREMENT_SOURCE_CAN_JUSTIFY_AUTO_APPLY[f.source]));
  const changes: SeoRevisionChange[] = [];
  if (fix !== null) {
    for (const [field, label] of [["title", "題名"], ["summary", "要約"]] as const) {
      if (before.article[field] !== fix.next[field]) changes.push({ field, label, before: before.article[field], after: fix.next[field] });
    }
  }
  const blockedReason = before.archivedAt !== null ? "この記事は取り下げられています。"
    : !decision.allowed ? AUTO_APPLY_BLOCK_LABEL[decision.block]
    : fix === null ? "記事の中に補える内容がありません。"
    : pageKey === null ? "この記事の観測記録はまだありません。" : null;
  const justifiedBy = decision.allowed && fix !== null
    ? decision.justifiedBy.filter((f) => fix.appliedCodes.includes(f.code)).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : [];
  // 同じ記事の別版・別の根拠・別の承認者には使えない。時刻や実績の変動は差分の身元に含めない。
  const approvalToken = blockedReason === null && fix !== null
    ? await digest({ workspaceId: deps.workspaceId, actorId: actor.userId, before, after: fix.next, justifiedBy, introducedAt: setting.value.introducedAt }) : null;
  const to = now.slice(0, 10);
  const from = new Date(Date.parse(`${to}T00:00:00.000Z`) - (OBSERVATION_WINDOW_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  const [measured, searched] = pageKey === null
    ? [null, null] as const
    : await Promise.all([
      deps.metrics.recent({ pageKey, from, to }),
      deps.queryMetrics.recent({ siteSlug: input.siteSlug, pageKey, from, to, limit: SEARCH_QUERY_DISPLAY_LIMIT }),
    ]);
  const searchBreakdown = searched?.ok ? searched.value : null;
  const activeDates = searchBreakdown?.dates.filter((date) => date.active) ?? [];
  const completedAt = activeDates
    .map((date) => date.activeCompletedAt)
    .filter((value): value is string => value !== null)
    .sort();
  return ok({ before, after: fix?.next ?? null, justifiedBy, appliedCodes: fix?.appliedCodes ?? [], preview: {
    action: "preview", article: { ...input, pageKey, title: before.article.title, url: `/s/${encodeURIComponent(input.siteSlug)}${articleHref(before.article)}` },
    changes, diffSummary: fix?.diffSummary ?? "", approvalToken, blockedReason,
    metrics: { from, to, rows: measured?.ok ? measured.value : [], error: measured === null ? "この記事の観測記録はまだありません。" : measured.ok ? null : measured.error.message },
    searchQueries: {
      from,
      to,
      rows: searchBreakdown?.rows ?? [],
      truncated: searchBreakdown?.truncated ?? false,
      requestedDayCount: OBSERVATION_WINDOW_DAYS,
      availableDayCount: activeDates.length,
      unfinishedDayCount: searchBreakdown?.dates.filter((date) => date.refreshing).length ?? 0,
      limitedDates: activeDates
        .filter((date) => date.activeMayBeLimited === true)
        .map((date) => date.metricDate),
      unknownLimitDayCount: activeDates.filter((date) => date.activeMayBeLimited === null).length,
      latestCompletedAt: completedAt.at(-1) ?? null,
      error: searched === null ? "この記事の観測記録はまだありません。" : searched.ok ? null : searched.error.message,
      configured: deps.searchConsoleConfigured,
    },
  } });
}

async function digest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function dashboard(
  deps: ManageSeoAutoApplyDeps,
  input: Extract<ManageSeoAutoApplyInput, { action: "dashboard" }>,
  now: string,
): Promise<Result<ManageSeoAutoApplyOutput, DomainError>> {
  const setting = await deps.settings.loadOrCreate(now);
  if (!setting.ok) return setting;
  const citationMonthlyBudget = await deps.citationBudgets.current({
    at: now,
    monthlyLimit: setting.value.citationMonthlySearchLimit,
  });
  if (!citationMonthlyBudget.ok) return citationMonthlyBudget;

  const listed = await deps.findings.list({ siteSlug: input.siteSlug, limit: input.limit });
  if (!listed.ok) return listed;

  const collections = await deps.collections.all();
  if (!collections.ok) return collections;

  const logs = await deps.logs.list({ siteSlug: input.siteSlug, limit: input.limit });
  if (!logs.ok) return logs;

  const backlog = await deps.findings.unappliedSummary({ siteSlug: input.siteSlug });
  if (!backlog.ok) return backlog;

  const candidates = await deps.findings.groupedByArticle({ siteSlug: input.siteSlug, limit: input.limit });
  if (!candidates.ok) return candidates;

  const staticAuditCoverage = await deps.staticAudits.coverage({
    siteSlug: input.siteSlug,
    staleBefore: new Date(Date.parse(now) - MEASUREMENT_STALE_AFTER_MS.static_audit).toISOString(),
  });
  if (!staticAuditCoverage.ok) return staticAuditCoverage;

  const lastCollectedAt = {
    static_audit: null as string | null,
    search_console: null as string | null,
    ai_citation: null as string | null,
  };
  for (const row of collections.value) lastCollectedAt[row.source] = row.lastCollectedAt;

  return ok({
    action: "dashboard",
    paused: setting.value.autoApplyPaused,
    introducedAt: setting.value.introducedAt,
    findings: [...listed.value].sort(byUrgency),
    sources: sourceHealth(
      lastCollectedAt,
      {
        static_audit: true,
        search_console: deps.searchConsoleConfigured,
        ai_citation: deps.aiCitationConfigured,
      },
      now,
    ),
    recentApplies: logs.value.map((entry) => ({
      entry,
      effectPending: effectJudgementPending(entry.appliedAt, now),
    })),
    autoApplyStalled: autoApplyStalled(backlog.value.count, backlog.value.oldestObservedAt, now),
    unappliedCount: backlog.value.count,
    candidates: candidates.value.map((group) => ({ siteSlug: group.siteSlug, articleSlug: group.articleSlug, pageKey: group.pageKey, title: group.title, findingCount: group.findings.length })),
    citationMonthlyBudget: citationMonthlyBudget.value,
    staticAuditCoverage: staticAuditCoverage.value,
  });
}

/** 画面が閾値を再定義しないように、判定の根拠をそのまま出す。 */
export const AUTO_APPLY_STALL_THRESHOLDS = {
  count: UNAPPLIED_BACKLOG_THRESHOLD,
  ageMs: UNAPPLIED_AGE_THRESHOLD_MS,
} as const;
