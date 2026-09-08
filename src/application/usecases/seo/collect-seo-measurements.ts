import type {
  AiCitationClientPort,
  ObservedPageIdentity,
  PageMetric,
  SearchConsoleClientPort,
  SearchQueryMetric,
  SeoFindingPort,
  SeoCitationBudgetPort,
  SeoMeasurementSettingPort,
  SeoMeasurementArticlePort,
  SeoPageMetricPort,
  SeoSearchQueryCollectionPort,
  SeoSourceCollectionPort,
  StaticAuditCollectorPort,
} from "@/application/ports/seo-measurement";
import { CITATION_SEARCHES_PER_REQUEST } from "@/application/ports/seo-measurement";
import type {
  SeoStaticAuditPort,
  StaticAuditAttempt,
  StaticAuditFailureCode,
} from "@/application/ports/seo-static-audit";
import { articleHref } from "@/application/read-models/published-article";
import { canonicalSiteUrl } from "@/application/seo/feeds";
/*
  取りまとめ（`@/domain/identity`）ではなく、要る 1 つを直に指す。
  取りまとめは brand / membership / user / workspace まで数珠つなぎに引き、
  この使い道はそれを 1 つも使わない。定時実行がこのユースケースを引くので、
  取りまとめ経由だと **Worker の中にその全部がもう 1 部載る**。
  見張りは `tests/architecture/worker-entry-weight.test.ts`。
*/
import { requireCapability } from "@/domain/identity/permissions";
import {
  type Finding,
  type MeasurementSource,
  auditCompleteSite,
  auditLlmsTxt,
  auditPageObservation,
  pageKeyOf,
} from "@/domain/seo/aeo-measurement";
import {
  type ActorContext,
  type DomainError,
  type Result,
  type WorkspaceId,
  assertSameTenant,
  assertWorkspaceWideAccess,
  err,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 3 つのデータ源から所見と実績を集める（受入 A1・A2・A3・A4）。
 *
 * ==========================================================================
 * 系統ごとに別の action にしている理由
 * ==========================================================================
 *
 * 「全部集める」1 つの操作にすると、Search Console が資格情報切れで
 * 落ちた日に、**動いていた静的解析の結果まで捨てる**ことになる。
 * 3 つは壊れ方も所要時間も上限も違うので、別々に呼べる形にし、
 * 定時実行の側で 3 回呼ぶ。
 *
 * ==========================================================================
 * 収集は「止まっていても」続ける（NFR4）
 * ==========================================================================
 *
 * 自動反映を止めているときも収集は止めない。止めるのは書き換えだけで、
 * 何が起きているかを見せるのは止めない。止めた瞬間に画面が
 * 古い数字で固まると、運営者は再開してよいかを判断できなくなる。
 */

export type CollectSeoMeasurementsDeps = {
  readonly workspaceId: WorkspaceId;
  readonly findings: SeoFindingPort;
  readonly metrics: SeoPageMetricPort;
  readonly queryMetrics: SeoSearchQueryCollectionPort;
  readonly collections: SeoSourceCollectionPort;
  readonly settings: SeoMeasurementSettingPort;
  readonly measurementArticles: SeoMeasurementArticlePort;
  readonly staticAudit: StaticAuditCollectorPort;
  /** 巡回中の世代と、全件成功時だけ公開する所見を同じ保存境界で管理する。 */
  readonly staticAudits: SeoStaticAuditPort;
  readonly searchConsole: SearchConsoleClientPort;
  readonly aiCitation: AiCitationClientPort;
  readonly citationBudgets: SeoCitationBudgetPort;
  readonly now: () => Date;
  /** 課金予約の月は送信直前の実時計で決め、cron開始時刻へ固定しない。 */
  readonly budgetNow: () => Date;
};

export type CollectSeoMeasurementsInput =
  | {
      readonly action: "static_audit";
      readonly siteSlug: string;
      /** 公開サイトの起点。`https://example.com` と `/s/<site>`。 */
      readonly origin: string;
      readonly basePath: string;
      /** 1 回で見るページ数の上限。定時実行が全体を分けて回すために要る。 */
      readonly limit: number;
    }
  | {
      readonly action: "search_console";
      readonly siteUrl: string;
      readonly siteSlug: string;
      readonly origin: string;
      readonly basePath: string;
      readonly startDate: string;
      readonly endDate: string;
      /** 全 site で共有する、1 起動あたりの検索語取得行予算。 */
      readonly queryRowBudget: number;
    }
  | {
      readonly action: "ai_citation";
      readonly siteSlug: string;
      readonly origin: string;
      readonly basePath: string;
      /** 同じ作業場所の公開ブログ間で月次枠を均等配分する。 */
      readonly activeSiteCount: number;
      readonly siteOrdinal: number;
    };

export type CollectSeoMeasurementsOutput = {
  readonly source: MeasurementSource;
  readonly pagesExamined: number;
  readonly findingsAdded: number;
  readonly findingsResolved: number;
  readonly metricsSaved: number;
  /** Google API から取得し、共有予算を消費した生行数。 */
  readonly queryRowsFetched: number;
  /** 選択 site の URL として実際に保存した行数。 */
  readonly queryRowsStored: number;
  /** 上限や資格情報で見送ったこと。**黙って 0 件にしない。** */
  readonly skippedReason: string | null;
};

export function createCollectSeoMeasurements(
  deps: CollectSeoMeasurementsDeps,
): UseCase<CollectSeoMeasurementsInput, CollectSeoMeasurementsOutput> & {
  readonly workspaceOf: (actor: ActorContext) => WorkspaceId;
} {
  return {
    workspaceOf: () => deps.workspaceId,
    async execute(actor, input) {
      const tenant = assertSameTenant(actor, { workspaceId: deps.workspaceId }, "SEO の計測");
      if (!tenant.ok) return tenant;
      const scope = assertWorkspaceWideAccess(actor, "SEO の計測");
      if (!scope.ok) return scope;
      const allowed = requireCapability(actor, "site.manage", "SEO の計測");
      if (!allowed.ok) return allowed;

      const now = deps.now().toISOString();
      switch (input.action) {
        case "static_audit":
          return await runStaticAudit(deps, input, now);
        case "search_console":
          return await runSearchConsole(deps, input, now);
        case "ai_citation":
          return await runAiCitation(deps, input, now);
      }
    },
  };
}

/**
 * 系統①: 自分のサイトを読んで規則に照らす。
 *
 * 1 ページ落ちても他を続け、失敗ページは次回に再試行する。全公開ページを
 * 同じ世代で読めた時だけ、ページ内規則とサイト横断規則を一括で確定する。
 * 途中経過を所見へ混ぜないので、「未確認」を「問題なし」に変えない。
 */
async function runStaticAudit(
  deps: CollectSeoMeasurementsDeps,
  input: Extract<CollectSeoMeasurementsInput, { action: "static_audit" }>,
  now: string,
): Promise<Result<CollectSeoMeasurementsOutput, DomainError>> {
  const limit = Math.floor(input.limit);
  if (limit < 1) return ok(staticAuditOutput(0, 0, 0, "この起動の全ブログ共通25ページ枠は使用済みです。"));

  const inventory = await deps.staticAudits.inventory({
    siteSlug: input.siteSlug,
    origin: input.origin,
    basePath: input.basePath,
  });
  if (!inventory.ok) return inventory;
  const begun = await deps.staticAudits.beginOrResume({ inventory: inventory.value, at: now, limit });
  if (!begun.ok) return begun;

  let pagesExamined = 0;
  let failures = 0;
  let pagesAttempted = 0;
  if (begun.value.claim !== null) {
    const attempts: StaticAuditAttempt[] = [];
    for (const target of begun.value.claim.targets) {
      pagesAttempted += 1;
      const observed = await deps.staticAudit.observe(target.url);
      if (observed.ok) {
        pagesExamined += 1;
        attempts.push({ pageKey: target.pageKey, ok: true, observation: observed.value });
      } else {
        failures += 1;
        attempts.push({ pageKey: target.pageKey, ok: false, errorCode: staticAuditFailureCode(observed.error) });
      }
    }
    const staged = await deps.staticAudits.stage({ claim: begun.value.claim, attempts, at: now });
    if (!staged.ok) return staged;
    failures += staged.value.resourceLimitFailures;
    pagesExamined -= staged.value.resourceLimitFailures;
    if (failures > 0) {
      await deps.collections.recordFailure({
        source: "static_audit",
        failedAt: now,
        reason: `${failures} 件の公開ページを読めませんでした。`,
      });
    }
  }

  const loaded = await deps.staticAudits.loadCompleteCandidate({ siteSlug: input.siteSlug, at: now });
  if (!loaded.ok) return loaded;
  if (loaded.value.limitedReason !== null) {
    const recorded = await deps.collections.recordFailure({
      source: "static_audit",
      failedAt: now,
      reason: loaded.value.limitedReason,
    });
    if (!recorded.ok) return recorded;
    return ok(staticAuditOutput(pagesExamined, 0, 0, loaded.value.limitedReason));
  }
  if (loaded.value.candidate === null) {
    const reason = begun.value.skippedReason
      ?? (failures > 0
        ? `${failures} 件を再試行します。全 ${inventory.value.total} 件の確認が揃うまで所見は更新しません。`
        : `全 ${inventory.value.total} 件の確認を続けています。完了後に所見をまとめて更新します。`);
    return ok(staticAuditOutput(pagesExamined, 0, 0, reason));
  }

  // llms.txt も外部取得1件として同じ起動枠へ含める。HTMLで枠を使い切った
  // ときはready世代を保持し、次回はHTMLを再取得せず案内ファイルだけを見る。
  if (pagesAttempted >= limit && begun.value.claim !== null) {
    return ok(staticAuditOutput(
      pagesExamined,
      0,
      0,
      "この起動の取得枠を使い切りました。AI向け案内ファイルは次回確認します。",
    ));
  }
  const candidate = loaded.value.candidate;

  const home = pageKeyOf(canonicalSiteUrl({ origin: input.origin, basePath: input.basePath }, ""));
  if (!home.ok || !candidate.pages.some((page) => page.target.pageKey === home.key)) {
    return err(validationError("公開トップページを静的監査の完全な対象集合で確認できません。"));
  }
  const llms = await deps.staticAudit.observeLlmsTxt(
    canonicalSiteUrl({ origin: input.origin, basePath: input.basePath }, "/llms.txt"),
  );
  if (!llms.ok) {
    await deps.collections.recordFailure({
      source: "static_audit",
      failedAt: now,
      reason: "AI向け案内ファイルを確認できませんでした。",
    });
    return llms;
  }

  const observations = candidate.pages.map((page) => page.observation);
  const findings = [
    ...observations.flatMap((observation) => auditPageObservation(observation, now)),
    ...auditCompleteSite(observations, now),
    ...auditLlmsTxt({
      pageKey: home.key,
      expected: inventory.value.emitLlmsTxt,
      observed: llms.value,
    }, now),
  ];
  const published = await deps.staticAudits.markPublished({ candidate, findings, at: now });
  if (!published.ok) return published;
  return ok(staticAuditOutput(
    pagesExamined,
    published.value.added,
    published.value.resolved,
    null,
  ));
}

function staticAuditOutput(
  pagesExamined: number,
  findingsAdded: number,
  findingsResolved: number,
  skippedReason: string | null,
): CollectSeoMeasurementsOutput {
  return {
    source: "static_audit",
    pagesExamined,
    findingsAdded,
    findingsResolved,
    metricsSaved: 0,
    queryRowsFetched: 0,
    queryRowsStored: 0,
    skippedReason,
  };
}

function staticAuditFailureCode(error: DomainError): StaticAuditFailureCode {
  const reason = error.details?.["reason"];
  if (reason === "AbortError" || reason === "TimeoutError") return "timeout";
  if (reason === "response_too_large" || reason === "link_limit_exceeded") return "resource_limit";
  if (error.code === "VALIDATION_FAILED") return "invalid_response";
  if (error.details?.["status"] !== undefined) return "http_error";
  return "unavailable";
}

/** 押された率の下限。これを下回り、かつ十分に出ているときだけ所見にする。 */
const LOW_CTR_THRESHOLD = 0.01;
/** 「十分に出ている」の下限。少ない回数の率は揺れるので所見にしない。 */
const MIN_IMPRESSIONS_FOR_CTR = 200;

/**
 * 系統②: Search Console。**実績は積み、所見は率が悪いものだけ。**
 *
 * 資格情報が無いときは失敗ではなく「見送り」として返す。失敗にすると、
 * 鍵をまだ登録していないだけの運営者に赤い印が出続け、
 * 本当に壊れた日の印と区別できなくなる。
 */
async function runSearchConsole(
  deps: CollectSeoMeasurementsDeps,
  input: Extract<CollectSeoMeasurementsInput, { action: "search_console" }>,
  now: string,
): Promise<Result<CollectSeoMeasurementsOutput, DomainError>> {
  if (!deps.searchConsole.configured()) {
    return ok({
      source: "search_console",
      pagesExamined: 0,
      findingsAdded: 0,
      findingsResolved: 0,
      metricsSaved: 0,
      queryRowsFetched: 0,
      queryRowsStored: 0,
      skippedReason: "Search Console の資格情報が登録されていません。",
    });
  }

  const dates = datesBetween(input.startDate, input.endDate);
  if (dates === null) return err(validationError("Search Console の日付範囲を確認できません。"));

  let metricsSaved = 0;
  let pageRowsMayBeLimited = false;
  const aggregate = new Map<string, { pageKey: PageMetric["pageKey"]; impressions: number; clicks: number; weightedPosition: number }>();
  for (const metricDate of dates) {
    // 日ごとに取得→保存し、最大 50,000 行×日数を Worker memory へ溜めない。
    const fetched = await deps.searchConsole.fetchRows({ siteUrl: input.siteUrl, startDate: metricDate, endDate: metricDate });
    if (!fetched.ok) {
      await deps.collections.recordFailure({ source: "search_console", failedAt: now, reason: fetched.error.message });
      return fetched;
    }
    pageRowsMayBeLimited ||= fetched.value.mayBeLimited;
    const perDay = new Map<string, PageMetric>();
    for (const row of fetched.value.rows) {
      if (!belongsToSelectedSite(row.url, input.origin, input.basePath)) continue;
      const key = pageKeyOf(row.url);
      if (!key.ok || row.metricDate !== metricDate) continue;
      perDay.set(`${key.key}\u0000${row.metricDate}`, {
        pageKey: key.key, metricDate: row.metricDate, impressions: row.impressions,
        clicks: row.clicks, position: row.position, aiCitations: null,
      });
    }
    const savedDay = await deps.metrics.upsertMany({ metrics: [...perDay.values()], observedAt: now });
    if (!savedDay.ok) return savedDay;
    metricsSaved += savedDay.value;
    for (const metric of perDay.values()) {
      const current = aggregate.get(metric.pageKey) ?? { pageKey: metric.pageKey, impressions: 0, clicks: 0, weightedPosition: 0 };
      const impressions = metric.impressions ?? 0;
      current.impressions += impressions;
      current.clicks += metric.clicks ?? 0;
      current.weightedPosition += (metric.position ?? 0) * impressions;
      aggregate.set(metric.pageKey, current);
    }
  }

  const findings: Finding[] = [...aggregate.values()].flatMap((row) => {
    if (row.impressions < MIN_IMPRESSIONS_FOR_CTR || row.clicks / row.impressions >= LOW_CTR_THRESHOLD) return [];
    const position = row.impressions === 0 ? 0 : row.weightedPosition / row.impressions;
    return [{
      source: "search_console" as const, pageKey: row.pageKey, code: "high_impressions_low_ctr" as const,
      detail: `${row.impressions} 回出て ${row.clicks} 回押されました（平均掲載順位 ${position.toFixed(1)}）。`, observedAt: now,
    }];
  });
  // 完全取得なら site の旧 GSC 所見を全て入れ替える。50k 上限到達時は
  // 未返却ページを「直った」と扱えないため、今回も所見があるページだけ更新する。
  const findingPages = pageRowsMayBeLimited
    ? findings.map((finding) => finding.pageKey)
    : [...aggregate.values()].map((row) => row.pageKey);
  const pages: ObservedPageIdentity[] = findingPages.map((pageKey) => ({
    pageKey,
    siteSlug: input.siteSlug,
    articleSlug: null,
  }));
  const saved = await deps.findings.replaceForPages({
    source: "search_console",
    observedAt: now,
    pages,
    findings,
    siteSnapshotSlug: input.siteSlug,
    completeSiteSlug: pageRowsMayBeLimited ? undefined : input.siteSlug,
    recordPageObservations: false,
  });
  if (!saved.ok) return saved;

  let queryRowsFetched = 0;
  let queryRowsStored = 0;
  let queryComplete = input.queryRowBudget > 0;
  let queryMayBeLimited = false;
  if (input.queryRowBudget > 0) {
    const target = await deps.queryMetrics.beginOrResume({
      siteSlug: input.siteSlug, from: input.startDate, to: input.endDate, observedAt: now,
    });
    if (!target.ok) return target;
    const queryRows = await deps.searchConsole.fetchQueryRows({
      siteUrl: input.siteUrl, metricDate: target.value.metricDate,
      startRow: target.value.startRow, rowBudget: input.queryRowBudget,
    });
    if (!queryRows.ok) {
      await deps.collections.recordFailure({ source: "search_console", failedAt: now, reason: queryRows.error.message });
      return queryRows;
    }
    const scopedRows: SearchQueryMetric[] = queryRows.value.rows.flatMap((row) => {
      if (!belongsToSelectedSite(row.url, input.origin, input.basePath)) return [];
      const key = pageKeyOf(row.url);
      if (!key.ok || row.metricDate !== target.value.metricDate) return [];
      return [{ siteSlug: input.siteSlug, pageKey: key.key, metricDate: row.metricDate, query: row.query,
        impressions: row.impressions, clicks: row.clicks, position: row.position }];
    });
    const staged = await deps.queryMetrics.stagePage({
      target: target.value, rows: scopedRows, nextStartRow: queryRows.value.nextStartRow,
      complete: queryRows.value.complete, mayBeLimited: queryRows.value.mayBeLimited, observedAt: now,
    });
    if (!staged.ok) return staged;
    queryRowsFetched = queryRows.value.rowsFetched;
    queryRowsStored = staged.value;
    queryComplete = queryRows.value.complete;
    queryMayBeLimited = queryRows.value.mayBeLimited;
  }

  if (queryComplete) {
    const recorded = await deps.collections.recordSuccess({ source: "search_console", collectedAt: now });
    if (!recorded.ok) return recorded;
  }

  const skipped = [
    pageRowsMayBeLimited ? "ページ実績は Google の 1 日 50,000 行の公開上限に達した可能性があります。" : null,
    input.queryRowBudget === 0 ? "検索語内訳はこの起動の共有予算に達したため次回に回しました。" : null,
    !queryComplete ? "検索語内訳の続きは次回同じ日の startRow から取得します。" : null,
    queryMayBeLimited ? "検索語内訳は匿名検索語を含まず、API が返した上位 50,000 行です。" : null,
  ].filter((part): part is string => part !== null);

  return ok({
    source: "search_console",
    pagesExamined: aggregate.size,
    findingsAdded: saved.value.added,
    findingsResolved: saved.value.resolved,
    metricsSaved,
    queryRowsFetched,
    queryRowsStored,
    skippedReason: skipped.length === 0 ? null : skipped.join(" "),
  });
}

function belongsToSelectedSite(rawUrl: string, origin: string, basePath: string): boolean {
  try {
    const url = new URL(rawUrl);
    const selectedOrigin = new URL(origin).origin;
    const root = `/${basePath.split("/").filter(Boolean).join("/")}`;
    return url.origin === selectedOrigin && (url.pathname === root || url.pathname.startsWith(`${root}/`));
  } catch {
    return false;
  }
}

function datesBetween(from: string, to: string): readonly string[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
  const length = Math.floor((end - start) / 86_400_000) + 1;
  if (length < 1 || length > 31) return null;
  return Array.from({ length }, (_, index) => new Date(start + index * 86_400_000).toISOString().slice(0, 10));
}

/**
 * 系統③: AI 検索で引用されているか。
 *
 * ページ数の1回上限と、web検索回数の月次上限を別々に守る。
 * 外部送信前に最大使用数を永続予約し、提供元usageで分かった実数だけ確定する。
 *
 * 見る順は「最後に見てから最も時間が経ったもの」から。上限があるので
 * 毎回全部は見られず、同じページばかり見ると残りが永久に見られない。
 */
async function runAiCitation(
  deps: CollectSeoMeasurementsDeps,
  input: Extract<CollectSeoMeasurementsInput, { action: "ai_citation" }>,
  now: string,
): Promise<Result<CollectSeoMeasurementsOutput, DomainError>> {
  if (!deps.aiCitation.configured()) {
    return ok({
      source: "ai_citation",
      pagesExamined: 0,
      findingsAdded: 0,
      findingsResolved: 0,
      metricsSaved: 0,
      queryRowsFetched: 0,
      queryRowsStored: 0,
      skippedReason: "AI 検索の資格情報が登録されていません。",
    });
  }

  const setting = await deps.settings.loadOrCreate(now);
  if (!setting.ok) return setting;

  const pageLimit = setting.value.citationCheckLimit;
  if (pageLimit === 0) {
    return ok({
      source: "ai_citation",
      pagesExamined: 0,
      findingsAdded: 0,
      findingsResolved: 0,
      metricsSaved: 0,
      queryRowsFetched: 0,
      queryRowsStored: 0,
      skippedReason: "被引用チェックの1回上限が 0 に設定されています。",
    });
  }
  const monthlyLimit = setting.value.citationMonthlySearchLimit;
  if (monthlyLimit === null || monthlyLimit === 0) {
    return ok({
      source: "ai_citation", pagesExamined: 0, findingsAdded: 0, findingsResolved: 0,
      metricsSaved: 0, queryRowsFetched: 0, queryRowsStored: 0,
      skippedReason: monthlyLimit === null
        ? "AI検索の月次上限が未設定です。外部通信は行いませんでした。"
        : "AI検索の月次上限が 0 に設定されています。",
    });
  }

  // 所見の有無は前回観測の有無を表さない。公開記事の観測履歴で巡回順を決める。
  const listed = await deps.measurementArticles.list({ siteSlug: input.siteSlug, source: "ai_citation", limit: pageLimit + 1 });
  if (!listed.ok) return listed;
  const site = { origin: input.origin, basePath: input.basePath };
  const targets = listed.value.slice(0, pageLimit).map((article) => ({
    url: canonicalSiteUrl(site, articleHref(article)), title: article.title, articleSlug: article.slug,
  }));

  if (targets.length === 0) {
    const recorded = await deps.collections.recordSuccess({ source: "ai_citation", collectedAt: now });
    if (!recorded.ok) return recorded;
    return ok({ source: "ai_citation", pagesExamined: 0, findingsAdded: 0, findingsResolved: 0,
      metricsSaved: 0, queryRowsFetched: 0, queryRowsStored: 0, skippedReason: null });
  }

  const reservedAt = deps.budgetNow().toISOString();
  const monthKey = reservedAt.slice(0, 7);
  const siteMonthlyLimit = citationSiteMonthlyAllowance({
    monthlyLimit, activeSiteCount: input.activeSiteCount, siteOrdinal: input.siteOrdinal, monthKey,
  });
  const reserved = await deps.citationBudgets.reserve({
    siteSlug: input.siteSlug,
    at: reservedAt,
    monthlyLimit,
    siteMonthlyLimit,
    requestedSearches: targets.length * CITATION_SEARCHES_PER_REQUEST,
  });
  if (!reserved.ok) return reserved;
  if (reserved.value.reservation === null) {
    const reason = reserved.value.unavailableReason === "setting_changed"
      ? "AI検索の月次上限が変更されたため、次回に最新設定で確認します。"
      : reserved.value.unavailableReason === "concurrent"
      ? "同じブログの被引用チェックを別の処理が実行中です。"
      : reserved.value.unavailableReason === "site_exhausted"
        ? "このブログの今月分を使い切ったため、次月へ回しました。"
        : "作業場所で共有するAI検索の月次上限に達しました。";
    return ok({ source: "ai_citation", pagesExamined: 0, findingsAdded: 0, findingsResolved: 0,
      metricsSaved: 0, queryRowsFetched: 0, queryRowsStored: 0, skippedReason: reason });
  }
  const reservation = reserved.value.reservation;

  const pages: ObservedPageIdentity[] = [];
  const findings: Finding[] = [];
  const metrics: Pick<PageMetric, "pageKey" | "metricDate" | "aiCitations">[] = [];
  let failures = 0;
  let requestLimitFailures = 0;
  let usedSearches = 0;
  let unconfirmedSearches = 0;
  let reservationRemaining = reservation.reservedSearches;
  let monthRolledOver = false;
  const attempted: Parameters<SeoCitationBudgetPort["settle"]>[0]["attempted"][number][] = [];

  for (const target of targets) {
    if (reservationRemaining <= 0) break;
    const key = pageKeyOf(target.url);
    if (!key.ok) { failures += 1; continue; }
    const maxSearches = Math.min(CITATION_SEARCHES_PER_REQUEST, reservationRemaining);
    const attemptedAt = deps.budgetNow().toISOString();
    if (attemptedAt.slice(0, 7) !== reservation.monthKey) {
      monthRolledOver = true;
      break;
    }
    const result = await deps.aiCitation.check({ url: target.url, query: target.title, maxSearches });
    attempted.push({ siteSlug: input.siteSlug, articleSlug: target.articleSlug, pageKey: key.key, attemptedAt });
    if (result.searchesUsed === null) {
      unconfirmedSearches += maxSearches;
      reservationRemaining -= maxSearches;
    } else {
      usedSearches += result.searchesUsed;
      reservationRemaining -= result.searchesUsed;
    }
    if (!result.ok || !Number.isFinite(Date.parse(result.value.checkedAt))) {
      failures += 1;
      if (!result.ok && result.error.details?.["reason"] === "max_uses_exceeded") requestLimitFailures += 1;
      continue;
    }
    metrics.push({ pageKey: key.key, metricDate: new Date(result.value.checkedAt).toISOString().slice(0, 10), aiCitations: result.value.cited ? 1 : 0 });
    pages.push({ pageKey: key.key, siteSlug: input.siteSlug, articleSlug: target.articleSlug });
    if (!result.value.cited) {
      findings.push({
        source: "ai_citation",
        pageKey: key.key,
        code: "not_cited_by_ai_search",
        detail: `「${target.title}」で問い合わせましたが、この記事は引用されませんでした。`,
        observedAt: result.value.checkedAt,
      });
    }
  }

  const settled = await deps.citationBudgets.settle({
    reservation, usedSearches, unconfirmedSearches, attempted, at: deps.budgetNow().toISOString(),
  });
  if (!settled.ok) return settled;

  if (attempted.length === 0) {
    return ok({ source: "ai_citation", pagesExamined: 0, findingsAdded: 0, findingsResolved: 0,
      metricsSaved: 0, queryRowsFetched: 0, queryRowsStored: 0,
      skippedReason: monthRolledOver ? "月が替わったため、未使用の予約を戻して次回へ回しました。" : null });
  }

  if (attempted.length > 0 && pages.length === 0) {
    const requestLimitDetail = requestLimitFailures > 0
      ? ` うち ${requestLimitFailures} 件は1回の検索上限に達しました。` : "";
    const recorded = await deps.collections.recordFailure({ source: "ai_citation", failedAt: now,
      reason: `${attempted.length} 件すべての被引用チェックに失敗しました。${requestLimitDetail}` });
    if (!recorded.ok) return recorded;
    return err(validationError("被引用チェックがすべて失敗しました。接続状態を確かめてください。"));
  }
  const savedMetrics = await deps.metrics.upsertAiCitations(metrics);
  if (!savedMetrics.ok) return savedMetrics;
  const saved = await deps.findings.replaceForPages({ source: "ai_citation", observedAt: now, pages, findings });
  if (!saved.ok) return saved;

  const recorded = await deps.collections.recordSuccess({ source: "ai_citation", collectedAt: now });
  if (!recorded.ok) return recorded;

  return ok({
    source: "ai_citation",
    pagesExamined: pages.length,
    findingsAdded: saved.value.added,
    findingsResolved: saved.value.resolved,
    metricsSaved: savedMetrics.value,
    queryRowsFetched: 0,
    queryRowsStored: 0,
    skippedReason: [
      failures > 0 ? `${failures} 件の被引用チェックに失敗しました。` : "",
      requestLimitFailures > 0 ? `${requestLimitFailures} 件は1回の検索上限に達し、結果を確認できませんでした。` : "",
      listed.value.length > targets.length ? `1回上限 ${pageLimit} 件のため、残りは次回に回しました。` : "",
      pages.length < targets.length && reservationRemaining === 0 ? "月次の残り回数に合わせ、続きは次回に回しました。" : "",
      monthRolledOver ? "月が替わったため、未使用の予約を戻して次回へ回しました。" : "",
    ].filter(Boolean).join(" ") || null,
  });
}

export function citationSiteMonthlyAllowance(input: {
  readonly monthlyLimit: number;
  readonly activeSiteCount: number;
  readonly siteOrdinal: number;
  readonly monthKey: string;
}): number {
  const { monthlyLimit, activeSiteCount, siteOrdinal, monthKey } = input;
  if (!Number.isSafeInteger(monthlyLimit) || monthlyLimit < 0 || !Number.isSafeInteger(activeSiteCount)
      || activeSiteCount < 1 || !Number.isSafeInteger(siteOrdinal) || siteOrdinal < 0
      || siteOrdinal >= activeSiteCount || !/^\d{4}-\d{2}$/.test(monthKey)) return 0;
  const base = Math.floor(monthlyLimit / activeSiteCount);
  const remainder = monthlyLimit % activeSiteCount;
  const [year, month] = monthKey.split("-").map(Number);
  const firstExtra = ((year * 12 + month - 1) % activeSiteCount + activeSiteCount) % activeSiteCount;
  const distance = (siteOrdinal - firstExtra + activeSiteCount) % activeSiteCount;
  return base + (distance < remainder ? 1 : 0);
}
