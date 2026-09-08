/** @tier 1 @req REQ-SEO10, REQ-SEO11 @types equivalence, boundary, permission-matrix */
import type {
  AiCitationClientPort,
  CitationMonthlyBudgetStatus,
  PageMetric,
  SearchConsoleClientPort,
  SearchConsoleQueryRow,
  SearchConsoleRow,
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
import type { SeoStaticAuditPort, StaticAuditClaim, StaticAuditScan } from "@/application/ports/seo-static-audit";
import type { PublishedArticle } from "@/application/read-models/published-article";
import {
  type CollectSeoMeasurementsDeps,
  citationSiteMonthlyAllowance,
  createCollectSeoMeasurements,
} from "@/application/usecases/seo/collect-seo-measurements";
import {
  DEFAULT_CITATION_PAGES_PER_RUN,
  type Finding,
  type MeasurementSource,
  type PageKey,
  type PageObservation,
  pageKeyOf,
} from "@/domain/seo/aeo-measurement";
import { err, ok, validationError } from "@/domain/shared";
import { describe, expect, it } from "vitest";
import { anOwner, anOutsider, aWriter, WORKSPACE } from "../../support/actors";

const ORIGIN = "https://example.com";
const BASE_PATH = "/s/creator-tools";
const SITE = "creator-tools";
const HOME_URL = `${ORIGIN}${BASE_PATH}`;
const NOW = "2026-09-04T00:00:00.000Z";

function urlOf(slug: string): string {
  return `${ORIGIN}${BASE_PATH}/guides/${slug}`;
}

function keyOf(slug: string): PageKey {
  const key = pageKeyOf(urlOf(slug));
  if (!key.ok) throw new Error(`鍵を作れませんでした: ${slug}`);
  return key.key;
}

function anArticle(slug: string, over: Partial<PublishedArticle> = {}): PublishedArticle {
  return {
    siteSlug: SITE,
    slug,
    type: "guide",
    title: `${slug} の選び方`,
    summary: "作業時間と騒音のバランスで選びます。",
    categorySlug: "laptops",
    publishedAt: "2026-08-01",
    updatedAt: "2026-08-01",
    author: {
      slug: "editorial-team",
      name: "編集部",
      bio: "制作道具を検証するチームです。",
      credentials: ["編集実務 5 年"],
    },
    disclosureRequired: false,
    sections: [{ id: "conclusion", heading: "結論", paragraphs: ["場所に合わせて選びます。"] }],
    ...over,
  };
}

/** 所見が 1 件も出ない観測。ここから 1 か所ずつ崩して規則を確かめる。 */
function aCleanObservation(url: string): PageObservation {
  const key = pageKeyOf(url);
  if (!key.ok) throw new Error(`鍵を作れませんでした: ${url}`);
  return {
    pageKey: key.key,
    url,
    title: "静かなノートパソコンの選び方",
    metaDescription:
      "作業時間と騒音のバランスで選ぶ手順を、実測値の見方まで含めてまとめました。用途別の目安も載せています。",
    canonical: url,
    ogImage: `${ORIGIN}/og.png`,
    jsonLdTypes: ["Article"],
    headingLevels: [1, 2, 2],
    internalLinkCount: 5,
    images: [{ src: `${ORIGIN}/a.png`, hasAlt: true, hasDimensions: true }],
  };
}

type HarnessOptions = {
  readonly articles?: readonly { readonly article: PublishedArticle; readonly archivedAt: string | null }[];
  readonly observe?: StaticAuditCollectorPort["observe"];
  readonly observeLlmsTxt?: StaticAuditCollectorPort["observeLlmsTxt"];
  readonly searchConsoleConfigured?: boolean;
  readonly rows?: readonly SearchConsoleRow[];
  readonly queryRows?: readonly SearchConsoleQueryRow[];
  readonly rawQueryRowsFetched?: number;
  readonly pageRowsMayBeLimited?: boolean;
  readonly queryComplete?: boolean;
  readonly queryMayBeLimited?: boolean;
  readonly fetchRowsFails?: string;
  readonly aiConfigured?: boolean;
  readonly citationLimit?: number;
  readonly citationMonthlyLimit?: number | null;
  readonly citationGrant?: number;
  readonly citationSearchesUsed?: number | null;
  readonly budgetTimes?: readonly string[];
  readonly existingFindings?: readonly Finding[];
  readonly observedArticles?: Readonly<Record<string, string>>;
  readonly citedUrls?: ReadonlySet<string>;
  readonly failedCitationUrls?: ReadonlySet<string>;
  readonly staticResourceLimitFailures?: number;
  readonly staticCandidateLimitedReason?: string;
};

function harness(options: HarnessOptions = {}) {
  const calls = {
    observed: [] as string[],
    replaced: [] as Parameters<SeoFindingPort["replaceForPages"]>[0][],
    successes: [] as MeasurementSource[],
    failures: [] as { readonly source: MeasurementSource; readonly reason: string }[],
    metrics: [] as PageMetric[],
    citationTargets: [] as string[],
    citationMaxSearches: [] as number[],
    budgetReservations: [] as Parameters<SeoCitationBudgetPort["reserve"]>[0][],
    budgetSettlements: [] as Parameters<SeoCitationBudgetPort["settle"]>[0][],
    queryMetrics: [] as SearchQueryMetric[],
    listed: [] as Parameters<SeoMeasurementArticlePort["list"]>[0][],
    publishedStaticFindings: [] as Finding[],
  };

  const rows = options.articles ?? [
    { article: anArticle("quiet-laptop"), archivedAt: null },
    { article: anArticle("quiet-keyboard"), archivedAt: null },
  ];

  const findings: SeoFindingPort = {
    async observedPageKey() { return ok(null); },
    async replaceForPages(input) {
      calls.replaced.push(input);
      return ok({ added: input.findings.length, resolved: 0 });
    },
    async groupedByArticle() {
      return ok([]);
    },
    async list() {
      return ok(options.existingFindings ?? []);
    },
    async unappliedSummary() {
      return ok({ count: 0, oldestObservedAt: null });
    },
  };

  const metrics: SeoPageMetricPort = {
    async upsertAiCitations(next) {
      calls.metrics.push(...next.map(row => ({ ...row, impressions: null, clicks: null, position: null })));
      return ok(next.length);
    },
    async upsertMany(input) {
      calls.metrics.push(...input.metrics);
      return ok(input.metrics.length);
    },
    async recent() {
      return ok([]);
    },
  };

  const collections: SeoSourceCollectionPort = {
    async all() {
      return ok([]);
    },
    async recordSuccess(input) {
      calls.successes.push(input.source);
      return ok(true as const);
    },
    async recordFailure(input) {
      calls.failures.push({ source: input.source, reason: input.reason });
      return ok(true as const);
    },
  };

  const settings: SeoMeasurementSettingPort = {
    async loadOrCreate(now) {
      return ok({
        introducedAt: now,
        autoApplyPaused: false,
        pausedAt: null,
        resumedAt: null,
        citationCheckLimit: options.citationLimit ?? DEFAULT_CITATION_PAGES_PER_RUN,
        citationMonthlySearchLimit: options.citationMonthlyLimit === undefined ? 150 : options.citationMonthlyLimit,
      });
    },
    async setPaused() {
      throw new Error("この試験では呼ばれません。");
    },
    async setCitationCheckLimit() {
      throw new Error("この試験では呼ばれません。");
    },
    async setCitationMonthlySearchLimit() {
      throw new Error("この試験では呼ばれません。");
    },
  };

  const measurementArticles: SeoMeasurementArticlePort = {
    async list(input) {
      calls.listed.push(input);
      return ok(rows.filter(row => row.archivedAt === null && row.article.siteSlug === input.siteSlug)
        .sort((a, b) => (options.observedArticles?.[a.article.slug] ?? "").localeCompare(options.observedArticles?.[b.article.slug] ?? ""))
        .slice(0, input.limit).map(row => row.article));
    },
  };

  const staticAudit: StaticAuditCollectorPort = {
    async observe(url) {
      calls.observed.push(url);
      if (options.observe) return await options.observe(url);
      return ok(aCleanObservation(url));
    },
    async observeLlmsTxt(url) {
      calls.observed.push(url);
      return options.observeLlmsTxt ? options.observeLlmsTxt(url) : ok("present");
    },
  };

  const parsedHomeKey = pageKeyOf(HOME_URL);
  if (!parsedHomeKey.ok) throw new Error("テスト用トップURLの鍵を作れませんでした。");
  const activeArticles = rows.filter(row => row.archivedAt === null && row.article.siteSlug === SITE);
  const staticTargets = [
    { pageKey: parsedHomeKey.key, url: HOME_URL, articleSlug: null, updatedAt: null },
    ...activeArticles.map(({ article }) => ({
      pageKey: keyOf(article.slug), url: urlOf(article.slug), articleSlug: article.slug, updatedAt: article.updatedAt,
    })),
  ];
  const staticObservations = new Map<PageKey, PageObservation>();
  let staticRevision = 1;
  const scan = (status: StaticAuditScan["status"]): StaticAuditScan => ({
    workspaceId: WORKSPACE,
    siteSlug: SITE,
    runId: "static-run",
    revision: staticRevision,
    inventoryHash: "inventory",
    status,
    total: staticTargets.length,
    inventoryComplete: true,
    startedAt: NOW,
    completedAt: status === "published" ? NOW : null,
    lastCompletedAt: status === "published" ? NOW : null,
  });
  const staticAudits: SeoStaticAuditPort = {
    async inventory() {
      return ok({ siteSlug: SITE, targets: staticTargets, total: staticTargets.length, complete: true, emitLlmsTxt: true });
    },
    async beginOrResume(input) {
      const targets = staticTargets.filter(target => !staticObservations.has(target.pageKey)).slice(0, input.limit);
      if (targets.length === 0) return ok({ scan: scan("ready"), claim: null, skippedReason: null });
      staticRevision += 1;
      const claim: StaticAuditClaim = {
        workspaceId: WORKSPACE, siteSlug: SITE, runId: "static-run", revision: staticRevision,
        leaseId: "lease", leaseExpiresAt: "2026-09-04T00:10:00.000Z", targets,
      };
      return ok({ scan: scan("collecting"), claim, skippedReason: null });
    },
    async stage(input) {
      let remainingResourceFailures = options.staticResourceLimitFailures ?? 0;
      for (const attempt of input.attempts) if (attempt.ok) {
        if (remainingResourceFailures > 0) remainingResourceFailures -= 1;
        else staticObservations.set(attempt.pageKey, attempt.observation);
      }
      staticRevision += 1;
      return ok({
        scan: scan(staticObservations.size === staticTargets.length ? "ready" : "collecting"),
        resourceLimitFailures: Math.min(options.staticResourceLimitFailures ?? 0, input.attempts.filter((attempt) => attempt.ok).length),
      });
    },
    async loadCompleteCandidate() {
      if (staticObservations.size !== staticTargets.length) return ok({ candidate: null, limitedReason: null });
      if (options.staticCandidateLimitedReason) return ok({ candidate: null, limitedReason: options.staticCandidateLimitedReason });
      return ok({ candidate: { scan: scan("ready"), pages: staticTargets.map(target => ({ target, observation: staticObservations.get(target.pageKey)! })) }, limitedReason: null });
    },
    async markPublished(input) {
      calls.publishedStaticFindings.push(...input.findings);
      staticRevision += 1;
      return ok({ scan: scan("published"), added: input.findings.length, resolved: 0 });
    },
    async coverage() { return ok([]); },
  };

  const searchConsole: SearchConsoleClientPort = {
    configured: () => options.searchConsoleConfigured ?? true,
    async fetchRows(input) {
      if (options.fetchRowsFails !== undefined) {
        return err(validationError(options.fetchRowsFails));
      }
      return ok({
        rows: (options.rows ?? []).filter((row) => row.metricDate === input.startDate),
        mayBeLimited: options.pageRowsMayBeLimited ?? false,
      });
    },
    async fetchQueryRows(input) {
      const rows = (options.queryRows ?? []).filter((row) => row.metricDate === input.metricDate)
        .slice(0, input.rowBudget);
      return ok({
        rows,
        rowsFetched: options.rawQueryRowsFetched ?? rows.length,
        startRow: input.startRow,
        nextStartRow: input.startRow + rows.length,
        complete: options.queryComplete ?? true,
        mayBeLimited: options.queryMayBeLimited ?? false,
      });
    },
  };

  const queryMetrics: SeoSearchQueryCollectionPort = {
    async beginOrResume(input) {
      return ok({ siteSlug: input.siteSlug, metricDate: input.to, runId: "query-run", startRow: 0, revision: 1 });
    },
    async stagePage(input) {
      calls.queryMetrics.push(...input.rows);
      return ok(input.rows.length);
    },
  };

  const aiCitation: AiCitationClientPort = {
    configured: () => options.aiConfigured ?? true,
    async check(input) {
      calls.citationTargets.push(input.url);
      calls.citationMaxSearches.push(input.maxSearches);
      const searchesUsed = "citationSearchesUsed" in options ? options.citationSearchesUsed ?? null : 1;
      if (options.failedCitationUrls?.has(input.url)) {
        return { ...err(validationError("確認失敗")), searchesUsed };
      }
      return { ...ok({
        url: input.url,
        cited: options.citedUrls?.has(input.url) ?? false,
        excerpt: "",
        checkedAt: NOW,
      }), searchesUsed: searchesUsed ?? 1 };
    },
  };

  const budgetStatus = (limit: number | null, used = 0, unconfirmed = 0, reserved = 0): CitationMonthlyBudgetStatus => ({
    monthKey: "2026-09", limitSearches: limit, usedSearches: used, unconfirmedSearches: unconfirmed,
    reservedSearches: reserved, remainingSearches: limit === null ? null : Math.max(0, limit - used - unconfirmed - reserved),
    reached: limit !== null && used + unconfirmed + reserved >= limit,
  });
  const citationBudgets: SeoCitationBudgetPort = {
    async current(input) { return ok(budgetStatus(input.monthlyLimit)); },
    async reserve(input) {
      calls.budgetReservations.push(input);
      const grant = Math.min(options.citationGrant ?? input.requestedSearches, input.monthlyLimit, input.siteMonthlyLimit);
      return ok({
        reservation: grant > 0 ? { id: "citation-lease", monthKey: input.at.slice(0, 7), siteSlug: input.siteSlug,
          reservedSearches: grant, limitSearches: input.monthlyLimit } : null,
        status: budgetStatus(input.monthlyLimit, 0, 0, grant),
        unavailableReason: grant > 0 ? null : "monthly_exhausted",
      });
    },
    async settle(input) {
      calls.budgetSettlements.push(input);
      return ok(budgetStatus(input.reservation.limitSearches, input.usedSearches, input.unconfirmedSearches));
    },
  };

  let budgetClockIndex = 0;
  const deps: CollectSeoMeasurementsDeps = {
    workspaceId: WORKSPACE,
    findings,
    metrics,
    queryMetrics,
    collections,
    settings,
    measurementArticles,
    staticAudit,
    staticAudits,
    searchConsole,
    aiCitation,
    citationBudgets,
    now: () => new Date(NOW),
    budgetNow: () => new Date(options.budgetTimes?.[Math.min(budgetClockIndex++, options.budgetTimes.length - 1)] ?? NOW),
  };

  return { usecase: createCollectSeoMeasurements(deps), calls };
}

const staticInput = {
  action: "static_audit",
  siteSlug: SITE,
  origin: ORIGIN,
  basePath: BASE_PATH,
  limit: 10,
} as const;

const citationInput = {
  action: "ai_citation",
  siteSlug: SITE,
  origin: ORIGIN,
  basePath: BASE_PATH,
  activeSiteCount: 1,
  siteOrdinal: 0,
} as const;

const searchInput = {
  action: "search_console",
  siteUrl: `${ORIGIN}${BASE_PATH}/`,
  siteSlug: SITE,
  origin: ORIGIN,
  basePath: BASE_PATH,
  startDate: "2026-09-01",
  endDate: "2026-09-01",
  queryRowBudget: 50_000,
} as const;

function aRow(over: Partial<SearchConsoleRow> = {}): SearchConsoleRow {
  return {
    url: urlOf("quiet-laptop"),
    metricDate: "2026-09-01",
    impressions: 100,
    clicks: 10,
    position: 8.4,
    ...over,
  };
}

describe("SEO 計測の収集", () => {
  it("別の作業場所のownerは一覧にも外部収集にも進めない", async () => {
    const { usecase, calls } = harness();
    const result = await usecase.execute(anOutsider(), staticInput);
    expect(result.ok).toBe(false);
    expect(calls.listed).toEqual([]);
    expect(calls.observed).toEqual([]);
  });
  it("site.manage を持たない役では断る", async () => {
    const { usecase, calls } = harness();

    const result = await usecase.execute(aWriter(), staticInput);

    expect(result.ok).toBe(false);
    // 断ったのに外を見に行っていないこと。断りが「見たあと」だと外部呼び出しが残る。
    expect(calls.observed).toEqual([]);
  });
});

describe("系統①: サイト内静的解析", () => {
  it("1 ページ落ちても他を続け、全件が揃うまで所見を公開しない", async () => {
    const { usecase, calls } = harness({
      observe: async (url) =>
        url.endsWith("quiet-keyboard")
          ? err(validationError("取得できませんでした。"))
          : ok(aCleanObservation(url)),
    });

    const result = await usecase.execute(anOwner(), staticInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pagesExamined).toBe(2);
    expect(result.value.skippedReason).toContain("全 3 件の確認が揃うまで所見は更新しません");
    expect(calls.publishedStaticFindings).toEqual([]);
    expect(calls.failures).toEqual([{ source: "static_audit", reason: "1 件の公開ページを読めませんでした。" }]);
  });

  it("1 ページも読めなくても失敗を記録し、旧所見を保持して次回へ回す", async () => {
    const { usecase, calls } = harness({
      observe: async () => err(validationError("取得できませんでした。")),
    });

    const result = await usecase.execute(anOwner(), staticInput);

    expect(result.ok).toBe(true);
    expect(calls.failures).toEqual([
      { source: "static_audit", reason: "3 件の公開ページを読めませんでした。" },
    ]);
    expect(calls.publishedStaticFindings).toEqual([]);
  });

  it("保存上限を超えた観測を成功件数から外し、失敗として次回へ回す", async () => {
    const { usecase, calls } = harness({ articles: [], staticResourceLimitFailures: 1 });
    const result = await usecase.execute(anOwner(), staticInput);
    expect(result).toMatchObject({ ok: true, value: { pagesExamined: 0, skippedReason: expect.stringContaining("1 件を再試行") } });
    expect(calls.failures).toEqual([{ source: "static_audit", reason: "1 件の公開ページを読めませんでした。" }]);
  });

  it("全観測の容量上限理由を実行結果と失敗記録へ返す", async () => {
    const reason = "観測結果の合計が安全な一括確認容量を超えたため、14日後に再試行します。";
    const { usecase, calls } = harness({ articles: [], staticCandidateLimitedReason: reason });
    const result = await usecase.execute(anOwner(), staticInput);
    expect(result).toMatchObject({ ok: true, value: { skippedReason: reason } });
    expect(calls.failures).toContainEqual({ source: "static_audit", reason });
  });

  it("公開記事が 0 件でもトップページとllms.txtを確認して完了する", async () => {
    const { usecase, calls } = harness({ articles: [] });

    const result = await usecase.execute(anOwner(), staticInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pagesExamined).toBe(1);
    expect(result.value.skippedReason).toBeNull();
    expect(calls.observed).toEqual([HOME_URL, `${HOME_URL}/llms.txt`]);
  });

  it("1件枠ではトップとllms.txtを別の起動へ分け、合計取得数を超えない", async () => {
    const { usecase, calls } = harness({ articles: [] });

    const first = await usecase.execute(anOwner(), { ...staticInput, limit: 1 });
    expect(first).toMatchObject({ ok: true, value: { skippedReason: expect.stringContaining("取得枠") } });
    expect(calls.observed).toEqual([HOME_URL]);

    const second = await usecase.execute(anOwner(), { ...staticInput, limit: 1 });
    expect(second).toMatchObject({ ok: true, value: { skippedReason: null } });
    expect(calls.observed).toEqual([HOME_URL, `${HOME_URL}/llms.txt`]);
  });

  it("取り下げた記事と他サイトの記事は見に行かない", async () => {
    const { usecase, calls } = harness({
      articles: [
        { article: anArticle("quiet-laptop"), archivedAt: NOW },
        { article: anArticle("other-site", { siteSlug: "another" }), archivedAt: null },
        { article: anArticle("quiet-keyboard"), archivedAt: null },
      ],
    });

    const result = await usecase.execute(anOwner(), staticInput);

    expect(result.ok).toBe(true);
    expect(calls.observed).toEqual([HOME_URL, urlOf("quiet-keyboard"), `${HOME_URL}/llms.txt`]);
  });

  it("limit を超えて読みに行かない", async () => {
    const { usecase, calls } = harness();

    await usecase.execute(anOwner(), { ...staticInput, limit: 1 });

    expect(calls.observed).toHaveLength(1);
  });

  it("全ページとllms.txtが揃った時だけページ内・横断所見を一括公開する", async () => {
    const { usecase, calls } = harness({
      articles: [{ article: anArticle("quiet-laptop"), archivedAt: null }],
      observe: async (url) => ok({ ...aCleanObservation(url), title: "" }),
    });

    const result = await usecase.execute(anOwner(), staticInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.findingsAdded).toBeGreaterThan(0);
    expect(calls.publishedStaticFindings.map((finding) => finding.code)).toContain("missing_title");
    expect(calls.observed.at(-1)).toBe(`${HOME_URL}/llms.txt`);
  });
});

describe("系統②: Search Console", () => {
  it("資格情報が無いときは失敗ではなく見送りとして返す", async () => {
    const { usecase, calls } = harness({ searchConsoleConfigured: false });

    const result = await usecase.execute(anOwner(), searchInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.skippedReason).toBe("Search Console の資格情報が登録されていません。");
    // 見送りは「収集できた」ではない。成功として記録すると最終収集時刻が進む。
    expect(calls.successes).toEqual([]);
    expect(calls.replaced).toEqual([]);
  });

  it("取得に失敗したら失敗を記録してから失敗を返す", async () => {
    const { usecase, calls } = harness({ fetchRowsFails: "所有権が確認できていません。" });

    const result = await usecase.execute(anOwner(), searchInput);

    expect(result.ok).toBe(false);
    expect(calls.failures).toEqual([
      { source: "search_console", reason: "所有権が確認できていません。" },
    ]);
  });

  it("記事の身元を持たない形で保存する（自動反映の候補に上げない）", async () => {
    const { usecase, calls } = harness({ rows: [aRow()] });

    await usecase.execute(anOwner(), searchInput);

    expect(calls.replaced[0]?.pages).toEqual([
      { pageKey: keyOf("quiet-laptop"), siteSlug: SITE, articleSlug: null },
    ]);
  });

  it("同じページの複数日ぶんは実績として全部積み、ページは 1 件に畳む", async () => {
    const { usecase, calls } = harness({
      rows: [aRow({ metricDate: "2026-09-01" }), aRow({ metricDate: "2026-09-02" })],
    });

    const result = await usecase.execute(anOwner(), {
      ...searchInput,
      endDate: "2026-09-02",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metricsSaved).toBe(2);
    expect(result.value.pagesExamined).toBe(1);
    expect(calls.metrics.every((metric) => metric.aiCitations === null)).toBe(true);
  });

  it("鍵を作れない URL の行は捨てる", async () => {
    const { usecase, calls } = harness({
      rows: [aRow({ url: "ftp://example.com/x" }), aRow()],
    });

    await usecase.execute(anOwner(), searchInput);

    expect(calls.metrics).toHaveLength(1);
  });

  it("よく出ているのに押されていないページだけを所見にする", async () => {
    const { usecase, calls } = harness({
      rows: [
        // 十分に出ていて、率が下限を下回る。所見になる唯一の行。
        aRow({ url: urlOf("low-ctr"), impressions: 200, clicks: 1 }),
        // 率は同じだが表示が下限に 1 足りない。少ない回数の率は揺れるので所見にしない。
        aRow({ url: urlOf("too-few"), impressions: 199, clicks: 0 }),
        // 表示は十分だが率がちょうど下限。`<` なので所見にしない（下記の註）。
        aRow({ url: urlOf("exactly-at-threshold"), impressions: 200, clicks: 2 }),
        // 率も表示も問題なし。
        aRow({ url: urlOf("healthy"), impressions: 1000, clicks: 80 }),
      ],
    });

    const result = await usecase.execute(anOwner(), searchInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 4 ページ全部の実績を積む。所見が付くかと、実績を残すかは別の話。
    expect(result.value.pagesExamined).toBe(4);
    expect(result.value.metricsSaved).toBe(4);
    expect(calls.replaced[0]?.findings.map((finding) => finding.pageKey)).toEqual([
      keyOf("low-ctr"),
    ]);
    expect(calls.replaced[0]?.findings[0]?.code).toBe("high_impressions_low_ctr");
  });

  /*
    境界をどちら側に倒すかは、ここで決めて書き留めておく。

    実装は `clicks / impressions < LOW_CTR_THRESHOLD` なので、**ちょうど 1%
    は所見にならない**。`<=` にすると「ちょうど 1%」が所見になるが、
    1% は「ここから下は低い」と決めた線であって、線そのものが悪いわけではない。
    線上を所見にすると、運営者が 1% ちょうどまで改善したページに赤い印が
    残り続け、直したのに消えないという形で信用を失う。**線は下限であって
    上限ではない**ので `<` のままにする。

    表示回数のほうは逆で、`impressions >= MIN_IMPRESSIONS_FOR_CTR` と
    線上を含める。こちらは「これだけ出ていれば率を信用してよい」という
    十分性の線なので、ちょうど 200 回は信用してよい側に入る。
  */
  it("ちょうど下限の率は所見にしない（線は下限であって上限ではない）", async () => {
    const { usecase, calls } = harness({
      rows: [aRow({ url: urlOf("exactly-at-threshold"), impressions: 500, clicks: 5 })],
    });

    await usecase.execute(anOwner(), searchInput);

    expect(calls.replaced[0]?.findings).toEqual([]);
  });

  it("表示 0 回のページは率を計算せず所見にしない", async () => {
    // 0 除算で NaN になる。NaN との比較は常に偽なので所見にはならないが、
    // 「たまたま偽になる」ことに頼っていないかをここで固定しておく。
    const { usecase, calls } = harness({
      rows: [aRow({ url: urlOf("no-impressions"), impressions: 0, clicks: 0 })],
    });

    await usecase.execute(anOwner(), searchInput);

    expect(calls.replaced[0]?.findings).toEqual([]);
  });

  it("CTR所見は先頭日ではなく期間内のpage合計で判定する", async () => {
    const { usecase, calls } = harness({
      rows: [
        aRow({ metricDate: "2026-09-01", impressions: 200, clicks: 0, position: 10 }),
        aRow({ metricDate: "2026-09-02", impressions: 1_000, clicks: 100, position: 2 }),
      ],
    });

    await usecase.execute(anOwner(), { ...searchInput, endDate: "2026-09-02" });

    expect(calls.replaced[0]?.findings).toEqual([]);
    expect(calls.metrics).toHaveLength(2);
  });

  it("selected origin/basePath外のpageとqueryを保存せず、生取得数と保存数を分ける", async () => {
    const inside = aRow();
    const outside = aRow({ url: "https://example.com/s/another/guides/foreign" });
    const { usecase, calls } = harness({
      rows: [inside, outside],
      rawQueryRowsFetched: 3,
      queryRows: [
        { ...inside, query: "  静かな PC  " },
        { ...outside, query: "foreign query" },
      ],
    });

    const result = await usecase.execute(anOwner(), searchInput);

    expect(result).toMatchObject({ ok: true, value: { queryRowsFetched: 3, queryRowsStored: 1 } });
    expect(calls.metrics).toHaveLength(1);
    expect(calls.queryMetrics).toEqual([{ siteSlug: SITE, pageKey: keyOf("quiet-laptop"),
      metricDate: "2026-09-01", query: "  静かな PC  ", impressions: 100, clicks: 10, position: 8.4 }]);
  });

  it("page取得が完全ならsite全体置換、上限到達時は返却pageだけ置換する", async () => {
    const complete = harness({ rows: [aRow()] });
    await complete.usecase.execute(anOwner(), searchInput);
    expect(complete.calls.replaced[0]).toMatchObject({
      completeSiteSlug: SITE,
      recordPageObservations: false,
      pages: [{ siteSlug: SITE, pageKey: keyOf("quiet-laptop") }],
    });

    const limited = harness({ rows: [aRow()], pageRowsMayBeLimited: true });
    await limited.usecase.execute(anOwner(), searchInput);
    expect(limited.calls.replaced[0]?.completeSiteSlug).toBeUndefined();
    expect(limited.calls.replaced[0]?.pages).toHaveLength(0);
    expect(limited.calls.replaced[0]?.siteSnapshotSlug).toBe(SITE);
  });

  it("検索語が共有予算で途中なら成功stampを進めず、次回継続を示す", async () => {
    const { usecase, calls } = harness({ queryRows: [{ ...aRow(), query: "quiet" }], queryComplete: false });
    const result = await usecase.execute(anOwner(), { ...searchInput, queryRowBudget: 1 });

    expect(result.ok && result.value.skippedReason).toContain("次回同じ日の startRow");
    expect(calls.successes).toEqual([]);
  });
});

describe("系統③: AI 検索での被引用", () => {
  it("外部送信前に検索回数を予約し、usageで確認した実数だけを一括確定する", async () => {
    const articles = ["quiet-laptop", "quiet-keyboard", "quiet-mouse"].map((slug) => ({ article: anArticle(slug), archivedAt: null }));
    const { usecase, calls } = harness({ articles, citationLimit: 3, citationMonthlyLimit: 10, citationGrant: 4 });
    const result = await usecase.execute(anOwner(), citationInput);
    expect(result.ok).toBe(true);
    expect(calls.budgetReservations[0]).toMatchObject({ requestedSearches: 9, monthlyLimit: 10, siteMonthlyLimit: 10 });
    expect(calls.citationMaxSearches).toEqual([3, 3, 2]);
    expect(calls.budgetSettlements).toHaveLength(1);
    expect(calls.budgetSettlements[0]).toMatchObject({ usedSearches: 3, unconfirmedSearches: 0 });
    expect(calls.budgetSettlements[0]?.attempted).toHaveLength(3);
  });

  it("送信後にusage不明ならそのrequestの予約全量を未確認として確定する", async () => {
    const { usecase, calls } = harness({ citationGrant: 3, citationSearchesUsed: null,
      failedCitationUrls: new Set([urlOf("quiet-laptop"), urlOf("quiet-keyboard")]) });
    await usecase.execute(anOwner(), citationInput);
    expect(calls.citationTargets).toHaveLength(1);
    expect(calls.budgetSettlements[0]).toMatchObject({ usedSearches: 0, unconfirmedSearches: 3 });
  });

  it("月次上限が未設定なら予約も外部通信も行わない", async () => {
    const { usecase, calls } = harness({ citationMonthlyLimit: null });
    const result = await usecase.execute(anOwner(), citationInput);
    expect(result.ok && result.value.skippedReason).toContain("月次上限が未設定");
    expect(calls.budgetReservations).toEqual([]);
    expect(calls.citationTargets).toEqual([]);
  });

  it("予約後にUTC月が替わったら外部送信せず未使用予約を返す", async () => {
    const { usecase, calls } = harness({ budgetTimes: [
      "2026-09-30T23:59:59.900Z", "2026-10-01T00:00:00.100Z", "2026-10-01T00:00:00.200Z",
    ] });
    const result = await usecase.execute(anOwner(), citationInput);
    expect(calls.citationTargets).toEqual([]);
    expect(calls.budgetSettlements[0]).toMatchObject({ usedSearches: 0, unconfirmedSearches: 0 });
    expect(result.ok && result.value.skippedReason).toContain("月が替わった");
  });

  it("引用あり/なしの成功観測を1/0として保存し、確認失敗は未観測のままにする", async () => {
    const { usecase, calls } = harness({ citedUrls: new Set([urlOf("quiet-laptop")]) });
    const result = await usecase.execute(anOwner(), citationInput);
    expect(result.ok && result.value.metricsSaved).toBe(2);
    expect(calls.metrics.map(row => ({ pageKey: row.pageKey, aiCitations: row.aiCitations, metricDate: row.metricDate }))).toEqual([
      { pageKey: keyOf("quiet-laptop"), aiCitations: 1, metricDate: "2026-09-04" },
      { pageKey: keyOf("quiet-keyboard"), aiCitations: 0, metricDate: "2026-09-04" },
    ]);
  });

  it("全AI確認失敗では成功stamp/所見置換/0件実績を作らない", async () => {
    const { usecase, calls } = harness({ failedCitationUrls: new Set([urlOf("quiet-laptop"), urlOf("quiet-keyboard")]) });
    const result = await usecase.execute(anOwner(), citationInput);
    expect(result.ok).toBe(false);
    expect(calls.failures).toHaveLength(1);
    expect(calls.successes).toEqual([]);
    expect(calls.replaced).toEqual([]);
    expect(calls.metrics).toEqual([]);
  });

  it("一部のAI確認失敗は成功ページだけ保存し失敗件数を示す", async () => {
    const { usecase, calls } = harness({ failedCitationUrls: new Set([urlOf("quiet-keyboard")]) });
    const result = await usecase.execute(anOwner(), citationInput);
    expect(result.ok && result.value.skippedReason).toContain("1 件の被引用チェックに失敗");
    expect(result.ok && result.value.metricsSaved).toBe(1);
    expect(calls.replaced[0]?.pages.map(page => page.articleSlug)).toEqual(["quiet-laptop"]);
  });

  it("資格情報が無いときは見送りとして返す", async () => {
    const { usecase, calls } = harness({ aiConfigured: false });

    const result = await usecase.execute(anOwner(), citationInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.skippedReason).toBe("AI 検索の資格情報が登録されていません。");
    expect(calls.citationTargets).toEqual([]);
  });

  it("上限が 0 なら、止めた理由を返して 1 件も問い合わせない", async () => {
    const { usecase, calls } = harness({ citationLimit: 0 });

    const result = await usecase.execute(anOwner(), citationInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 上限 0 は「既定値へ戻す」ではない。倒すと運営者が止められなくなる。
    expect(result.value.skippedReason).toBe("被引用チェックの1回上限が 0 に設定されています。");
    expect(calls.citationTargets).toEqual([]);
  });

  it("上限のぶんだけ問い合わせ、残した件数を見送りとして返す", async () => {
    const { usecase, calls } = harness({ citationLimit: 1 });

    const result = await usecase.execute(anOwner(), citationInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 1 ページ 1 呼び出し。まとめ問い合わせを許すと上限が意味を失う。
    expect(calls.citationTargets).toHaveLength(1);
    expect(result.value.skippedReason).toBe("1回上限 1 件のため、残りは次回に回しました。");
  });

  it("所見の有無によらず観測履歴から最古の記事を選ぶ専用一覧を使う", async () => {
    const { usecase, calls } = harness({
      citationLimit: 1,
      observedArticles: { "quiet-laptop": "2026-09-03", "quiet-keyboard": "2026-08-01" },
    });

    await usecase.execute(anOwner(), citationInput);

    expect(calls.citationTargets).toEqual([urlOf("quiet-keyboard")]);
  });

  it("引用されたページには所見を付けない", async () => {
    const { usecase, calls } = harness({
      articles: [{ article: anArticle("quiet-laptop"), archivedAt: null }],
      citedUrls: new Set([urlOf("quiet-laptop")]),
    });

    const result = await usecase.execute(anOwner(), citationInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 見たこと自体は記録する。見ていないページと区別できなくなるため。
    expect(calls.replaced[0]?.pages).toHaveLength(1);
    expect(calls.replaced[0]?.findings).toEqual([]);
    expect(calls.replaced[0]).toMatchObject({ observedAt: NOW });
    expect(result.value.skippedReason).toBeNull();
  });

  it("引用されなかったページには所見を付ける", async () => {
    const { usecase, calls } = harness({
      articles: [{ article: anArticle("quiet-laptop"), archivedAt: null }],
    });

    await usecase.execute(anOwner(), citationInput);

    expect(calls.replaced[0]?.findings.map((finding) => finding.code)).toEqual([
      "not_cited_by_ai_search",
    ]);
  });
});

describe("AI月次枠のブログ間配分", () => {
  it("均等配分し、割り切れない枠は月ごとに先頭をずらす", () => {
    expect(Array.from({ length: 3 }, (_, siteOrdinal) => citationSiteMonthlyAllowance({
      monthlyLimit: 2, activeSiteCount: 3, siteOrdinal, monthKey: "2026-09",
    })).reduce((sum, value) => sum + value, 0)).toBe(2);
    const september = Array.from({ length: 3 }, (_, siteOrdinal) => citationSiteMonthlyAllowance({
      monthlyLimit: 1, activeSiteCount: 3, siteOrdinal, monthKey: "2026-09",
    }));
    const october = Array.from({ length: 3 }, (_, siteOrdinal) => citationSiteMonthlyAllowance({
      monthlyLimit: 1, activeSiteCount: 3, siteOrdinal, monthKey: "2026-10",
    }));
    expect(september).not.toEqual(october);
    expect(september.reduce((sum, value) => sum + value, 0)).toBe(1);
    expect(october.reduce((sum, value) => sum + value, 0)).toBe(1);
  });
});
