/** @tier 1 @req REQ-SEO14, REQ-SEO15, REQ-SEC01 @types equivalence, permission-matrix, state-transition, boundary */
import type { AutoApplyLogEntry, SeoArticleState, PageMetric, SearchQueryMetric } from "@/application/ports/seo-measurement";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { createManageSeoAutoApply, type ManageSeoAutoApplyDeps, type ManageSeoAutoApplyInput, type SeoRevisionPreviewOutput } from "@/application/usecases/seo/manage-seo-auto-apply";
import { type Finding, type FindingCode, type PageKey, AUTO_APPLY_COOLDOWN_MS, UNAPPLIED_AGE_THRESHOLD_MS, UNAPPLIED_BACKLOG_THRESHOLD } from "@/domain/seo/aeo-measurement";
import { type BrandId, domainError, err, ok } from "@/domain/shared";
import { describe, expect, it, vi } from "vitest";
import { anAnalyst, anOwner, anOutsider, aWriter, WORKSPACE } from "../../support/actors";

const SITE = "creator-tools";
const SLUG = "quiet-laptop";
const PAGE_KEY = "example.com/s/creator-tools/guides/quiet-laptop" as PageKey;

const NOW = "2026-09-04T00:00:00.000Z";
const INTRODUCED_AT = "2026-06-01T00:00:00.000Z";

function daysBefore(days: number): string {
  return new Date(Date.parse(NOW) - days * 24 * 60 * 60 * 1000).toISOString();
}

/** 題名も要約も空。埋める材料（見出しと本文）はある記事。 */
function anEmptyArticle(over: Partial<PublishedArticle> = {}): PublishedArticle {
  return {
    siteSlug: SITE,
    slug: SLUG,
    type: "guide",
    title: "",
    summary: "",
    categorySlug: "laptops",
    // 導入後に作られた記事（NFR2 の線の内側）。
    publishedAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    author: {
      slug: "editorial-team",
      name: "編集部",
      bio: "制作道具を検証するチームです。",
      credentials: ["編集実務 5 年"],
    },
    disclosureRequired: false,
    sections: [
      {
        id: "conclusion",
        heading: "静かなノートパソコンの選び方",
        paragraphs: ["作業時間と騒音のバランスで選びます。実測値を見るのが近道です。"],
      },
    ],
    ...over,
  };
}

function aFinding(code: FindingCode, over: Partial<Finding> = {}): Finding {
  return {
    source: "static_audit",
    pageKey: PAGE_KEY,
    code,
    detail: "所見の説明。",
    observedAt: daysBefore(1),
    ...over,
  };
}

function harness() {
  let state: SeoArticleState | null = {
    article: anEmptyArticle(), archivedAt: null, createdAt: "2026-08-01T00:00:00.000Z",
    revision: 2, sourceArticleId: "article-source", sourceRevision: 3,
  };
  let evidence = [aFinding("missing_title"), aFinding("missing_meta_description")];
  let entries: AutoApplyLogEntry[] = [];
  let paused = false;
  let citationMonthlySearchLimit = 60;
  const deps: ManageSeoAutoApplyDeps = {
    workspaceId: WORKSPACE,
    findings: {
      observedPageKey: vi.fn(async () => ok(entries.at(-1)?.pageKey ?? null)),
      replaceForPages: vi.fn(),
      groupedByArticle: vi.fn(async () => ok(state === null ? [] : [{ siteSlug: SITE, articleSlug: SLUG, pageKey: PAGE_KEY, title: state.article.title, findings: evidence }])),
      list: vi.fn(async () => ok(evidence)),
      unappliedSummary: vi.fn(async () => ok({ count: evidence.length, oldestObservedAt: evidence[0]?.observedAt ?? null })),
    },
    logs: {
      list: vi.fn(async () => ok(entries)),
      lastAppliedAt: vi.fn(async () => ok(entries.at(-1)?.appliedAt ?? null)),
    },
    revisions: {
      find: vi.fn(async () => ok(state)),
      applyApproved: vi.fn(async (input) => {
        const entry: AutoApplyLogEntry = { id: "log-1", siteSlug: SITE, articleSlug: SLUG, pageKey: PAGE_KEY,
          snapshot: input.plan.snapshot, justifiedBy: input.plan.justifiedBy, appliedAt: input.plan.appliedAt,
          diffSummary: input.diffSummary, approvedBy: input.approvedBy, afterRevision: input.before.revision + 1,
          revertedAt: null, notifiedAt: null };
        state = { ...input.before, article: input.after, revision: input.before.revision + 1 };
        entries.push(entry);
        return ok(entry);
      }),
      revert: vi.fn(async ({ logId, at }) => {
        const entry = entries.find((e) => e.id === logId);
        if (!entry) return err(domainError("NOT_FOUND", "履歴がありません"));
        if (entry.revertedAt || state === null || state.revision !== entry.afterRevision) return err(domainError("CONFLICT", "編集済みです"));
        state = { ...state, article: JSON.parse(entry.snapshot.articleJson), revision: state.revision + 1 };
        const reverted = { ...entry, revertedAt: at };
        entries = [reverted];
        return ok(reverted);
      }),
    },
    metrics: { upsertMany: vi.fn(), upsertAiCitations: vi.fn(), recent: vi.fn(async () => ok([])) },
    queryMetrics: {
      recent: vi.fn(async () => ok({ rows: [], truncated: false, dates: [] })),
    },
    settings: {
      loadOrCreate: vi.fn(async () => ok({ introducedAt: INTRODUCED_AT, autoApplyPaused: paused, pausedAt: null, resumedAt: null, citationCheckLimit: 50, citationMonthlySearchLimit })),
      setPaused: vi.fn(async (input) => { paused = input.paused; return ok({ introducedAt: INTRODUCED_AT, autoApplyPaused: paused, pausedAt: null, resumedAt: null, citationCheckLimit: 50, citationMonthlySearchLimit }); }),
      setCitationCheckLimit: vi.fn(),
      setCitationMonthlySearchLimit: vi.fn(async (limit) => {
        citationMonthlySearchLimit = limit;
        return ok({ introducedAt: INTRODUCED_AT, autoApplyPaused: paused, pausedAt: null, resumedAt: null,
          citationCheckLimit: 50, citationMonthlySearchLimit });
      }),
    },
    citationBudgets: {
      current: vi.fn(async (input) => ok({ monthKey: input.at.slice(0, 7), limitSearches: input.monthlyLimit,
        usedSearches: 7, unconfirmedSearches: 2, reservedSearches: 1,
        remainingSearches: input.monthlyLimit === null ? null : Math.max(0, input.monthlyLimit - 10),
        reached: input.monthlyLimit !== null && input.monthlyLimit <= 10 })),
      reserve: vi.fn(), settle: vi.fn(),
    },
    staticAudits: {
      inventory: vi.fn(), beginOrResume: vi.fn(), stage: vi.fn(), loadCompleteCandidate: vi.fn(), markPublished: vi.fn(),
      coverage: vi.fn(async () => ok([])),
    },
    collections: { all: vi.fn(async () => ok([])), recordSuccess: vi.fn(), recordFailure: vi.fn() },
    searchConsoleConfigured: false, aiCitationConfigured: false, now: () => new Date(NOW),
  };
  const uc = createManageSeoAutoApply(deps);
  return { deps, uc, state: () => state, entries: () => entries,
    edit: (patch: Partial<SeoArticleState>) => { state = { ...state!, ...patch }; },
    remove: () => { state = null; },
    evidence: (next: Finding[]) => { evidence = next; },
    async preview(actor = anOwner()): Promise<SeoRevisionPreviewOutput> {
      const result = await uc.execute(actor, { action: "preview", siteSlug: SITE, articleSlug: SLUG });
      expect(result).toMatchObject({ ok: true, value: { action: "preview" } });
      if (!result.ok || result.value.action !== "preview") throw new Error("preview failed");
      return result.value;
    },
    async apply(token: string, actor = anOwner()) {
      return uc.execute(actor, { action: "apply", siteSlug: SITE, articleSlug: SLUG, approvalToken: token });
    },
  };
}

describe("記事を選び、差分を承認して反映する", () => {
  it("差分確認は記事・履歴・所見を書き換えない", async () => {
    const h = harness(); const preview = await h.preview();
    expect(preview.changes).toEqual([
      { field: "title", label: "題名", before: "", after: "静かなノートパソコンの選び方" },
      { field: "summary", label: "要約", before: "", after: "作業時間と騒音のバランスで選びます。" },
    ]);
    expect(preview.approvalToken).toMatch(/^[a-f0-9]{64}$/);
    expect(h.state()?.article.title).toBe("");
    expect(h.deps.revisions.applyApproved).not.toHaveBeenCalled();
  });
  it("確認した1記事だけを原子的な保存口へ渡す", async () => {
    const h = harness(); const preview = await h.preview();
    const result = await h.apply(preview.approvalToken!);
    expect(result).toMatchObject({ ok: true, value: { action: "apply", entry: { approvedBy: "user-owner" } } });
    expect(h.deps.findings.groupedByArticle).toHaveBeenCalledWith({ siteSlug: SITE, articleSlug: SLUG, limit: 1, includeApplied: true });
    expect(h.deps.revisions.applyApproved).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      before: expect.objectContaining({ revision: 2, sourceRevision: 3 }),
      after: expect.objectContaining({ title: preview.changes[0].after, summary: preview.changes[1].after }),
      approvedBy: "user-owner",
    }));
  });
  it("旧一括run経路を受け付けない", async () => {
    const h = harness();
    const result = await h.uc.execute(anOwner(), { action: "run", limit: 50 } as unknown as ManageSeoAutoApplyInput);
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED" } });
    expect(h.deps.revisions.applyApproved).not.toHaveBeenCalled();
  });
  it.each(["", "modified", "a".repeat(64)])("未確認・改変されたtokenを拒否する (%s)", async (token) => {
    const h = harness(); const result = await h.apply(token);
    expect(result.ok).toBe(false); expect(h.deps.revisions.applyApproved).not.toHaveBeenCalled();
  });
  it.each(["published", "source", "evidence", "actor"])("確認後の%s変更は再確認が必要", async (target) => {
    const h = harness(); const preview = await h.preview();
    if (target === "published") h.edit({ article: { ...h.state()!.article, title: "人が編集した題名" }, revision: 3 });
    if (target === "source") h.edit({ sourceRevision: 4 });
    if (target === "evidence") h.evidence([aFinding("missing_title", { observedAt: NOW })]);
    const result = await h.apply(preview.approvalToken!, target === "actor" ? anOwner({ userId: "another-editor" }) : anOwner());
    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(h.deps.revisions.applyApproved).not.toHaveBeenCalled();
  });
  it("保存直前に起きた競合を補償上書きで隠さない", async () => {
    const h = harness(); const preview = await h.preview();
    vi.mocked(h.deps.revisions.applyApproved).mockResolvedValueOnce(err(domainError("CONFLICT", "保存直前に更新されました")));
    expect(await h.apply(preview.approvalToken!)).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(h.entries()).toEqual([]); expect(h.state()?.article.title).toBe("");
    expect(h.deps.revisions.revert).not.toHaveBeenCalled();
  });
});

describe("対象条件を差分画面と確定時で揃える", () => {
  it.each([null, "invalid", "2026-05-31T23:59:59.999Z"])("実作成日時 %s は新しい公開日で補わない", async (createdAt) => {
    const h = harness(); h.edit({ createdAt }); const preview = await h.preview();
    expect(preview.approvalToken).toBeNull(); expect(preview.blockedReason).toBeTruthy();
  });
  it("停止中も差分と実績は読めるが反映できない", async () => {
    const h = harness(); const preview = await h.preview();
    await h.uc.execute(anOwner(), { action: "pause" });
    expect((await h.preview()).blockedReason).toContain("停止");
    expect((await h.apply(preview.approvalToken!)).ok).toBe(false);
    await h.uc.execute(anOwner(), { action: "resume" });
    expect((await h.preview()).approvalToken).not.toBeNull();
  });
  it.each([
    ["非再現", [aFinding("missing_title", { source: "ai_citation" })]],
    ["画面の問題", [aFinding("missing_canonical")]],
    ["所見なし", []],
  ] as const)("%s を記事の改稿根拠にしない", async (_label, findings) => {
    const h = harness(); h.evidence([...findings]); expect((await h.preview()).approvalToken).toBeNull();
  });
  it("別の欄のAI所見を、静的所見への承認に混ぜない", async () => {
    const h = harness();
    h.evidence([aFinding("missing_title"), aFinding("missing_meta_description", { source: "ai_citation" })]);
    const p = await h.preview();
    expect(p.changes.map((change) => change.field)).toEqual(["title"]);
    expect((await h.apply(p.approvalToken!)).ok).toBe(true);
    expect(h.state()?.article.summary).toBe("");
    expect(h.entries()[0].justifiedBy.map((finding) => finding.code)).toEqual(["missing_title"]);
  });
  it("埋める文がなければ架空の差分を作らない", async () => {
    const h = harness(); h.edit({ article: anEmptyArticle({ sections: [] }) });
    expect(await h.preview()).toMatchObject({ approvalToken: null, changes: [] });
  });
  it("取り下げた記事を反映しない", async () => {
    const h = harness(); h.edit({ archivedAt: NOW });
    expect((await h.preview()).approvalToken).toBeNull();
  });
  it("見つからない記事を見本に置き換えない", async () => {
    const h = harness(); h.remove();
    expect(await h.uc.execute(anOwner(), { action: "preview", siteSlug: SITE, articleSlug: SLUG })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
  it.each([[-1, false], [0, true]])("14日境界から %d ms", async (offset, allowed) => {
    const h = harness();
    vi.mocked(h.deps.logs.lastAppliedAt).mockResolvedValue(ok(new Date(Date.parse(NOW) - AUTO_APPLY_COOLDOWN_MS - offset).toISOString()));
    expect((await h.preview()).approvalToken !== null).toBe(allowed);
  });
});

describe("閲覧と承認の権限・範囲", () => {
  it("分析担当者は読めるが反映・取消・停止はできない", async () => {
    const h = harness(); await h.preview(anAnalyst());
    for (const input of [{ action: "apply", siteSlug: SITE, articleSlug: SLUG, approvalToken: "a".repeat(64) }, { action: "revert", logId: "log-1" }, { action: "pause" }, { action: "set_citation_monthly_limit", limit: 60 }] as const) {
      expect(await h.uc.execute(anAnalyst(), input)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
    expect(h.deps.settings.setCitationMonthlySearchLimit).not.toHaveBeenCalled();
  });
  it("閲覧権限のない執筆者には観測データを返さない", async () => {
    const h = harness(); expect(await h.uc.execute(aWriter(), { action: "dashboard", limit: 50 })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
  it.each([anOutsider(), anOwner({ scopedBrandIds: ["brand-one" as BrandId] })])("接続先と異なる範囲から読めない", async (actor) => {
    const h = harness(); expect(await h.uc.execute(actor, { action: "dashboard", limit: 50 })).toMatchObject({ ok: false, error: { code: "TENANT_MISMATCH" } });
    expect(h.deps.findings.list).not.toHaveBeenCalled();
  });
  it.each([anOwner({ identified: false }), anOwner({ isAiServiceAccount: true })])("人の本人確認を経ない承認は拒否する", async (actor) => {
    const h = harness(); const preview = await h.preview();
    expect((await h.apply(preview.approvalToken!, actor)).ok).toBe(false);
    expect(h.deps.revisions.applyApproved).not.toHaveBeenCalled();
    expect(await h.uc.execute(actor, { action: "set_citation_monthly_limit", limit: 60 }))
      .toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await h.uc.execute(actor, { action: "pause" }))
      .toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await h.uc.execute(actor, { action: "resume" }))
      .toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(h.deps.settings.setCitationMonthlySearchLimit).not.toHaveBeenCalled();
  });
});

describe("取り消しも記事・履歴を同時に確定する", () => {
  it("保存した版がそのままなら変更前へ戻し、二重取消は拒否する", async () => {
    const h = harness(); await h.apply((await h.preview()).approvalToken!);
    expect(await h.uc.execute(anOwner(), { action: "revert", logId: "log-1" })).toMatchObject({ ok: true, value: { action: "revert" } });
    expect(h.state()?.article.title).toBe("");
    expect((await h.uc.execute(anOwner(), { action: "revert", logId: "log-1" })).ok).toBe(false);
  });
  it("人の追記を巻き戻さない", async () => {
    const h = harness(); await h.apply((await h.preview()).approvalToken!);
    h.edit({ revision: 4, article: anEmptyArticle({ title: "編集後" }) });
    expect(await h.uc.execute(anOwner(), { action: "revert", logId: "log-1" })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(h.state()?.article.title).toBe("編集後"); expect(h.entries()[0].revertedAt).toBeNull();
  });
  it("存在しない履歴は失敗する", async () => {
    const h = harness(); expect((await h.uc.execute(anOwner(), { action: "revert", logId: "missing" })).ok).toBe(false);
  });
});

describe("観測期間と候補を分かる形で返す", () => {
  it("28件ではなく両端を含む直近28日を指定し、欠測を0で埋めない", async () => {
    const h = harness(); const row: PageMetric = { pageKey: PAGE_KEY, metricDate: "2026-09-01", impressions: 5, clicks: 1, position: 2, aiCitations: null };
    vi.mocked(h.deps.metrics.recent).mockResolvedValue(ok([row]));
    const p = await h.preview();
    expect(p.metrics).toEqual({ from: "2026-08-08", to: "2026-09-04", rows: [row], error: null });
    expect(h.deps.metrics.recent).toHaveBeenCalledWith({ pageKey: PAGE_KEY, from: "2026-08-08", to: "2026-09-04" });
    expect(h.deps.queryMetrics.recent).toHaveBeenCalledWith({ siteSlug: SITE, pageKey: PAGE_KEY,
      from: "2026-08-08", to: "2026-09-04", limit: 100 });
  });
  it("検索語は同じ記事と期間へ束縛し、完成日・更新未完了・2種類の上限を分ける", async () => {
    const h = harness();
    const query: SearchQueryMetric = { siteSlug: SITE, pageKey: PAGE_KEY, metricDate: "2026-09-01",
      query: "  静かな PC  ", impressions: 5, clicks: 1, position: 2.5 };
    vi.mocked(h.deps.queryMetrics.recent).mockResolvedValue(ok({
      rows: [query], truncated: true, dates: [
        { metricDate: "2026-09-01", active: true, refreshing: true,
          activeMayBeLimited: true, activeCompletedAt: "2026-09-03T00:00:00.000Z" },
        { metricDate: "2026-08-31", active: true, refreshing: false,
          activeMayBeLimited: null, activeCompletedAt: null },
        { metricDate: "2026-08-30", active: false, refreshing: true,
          activeMayBeLimited: null, activeCompletedAt: null },
      ],
    }));

    expect((await h.preview()).searchQueries).toEqual({
      from: "2026-08-08", to: "2026-09-04", rows: [query], truncated: true,
      requestedDayCount: 28, availableDayCount: 2, unfinishedDayCount: 2,
      limitedDates: ["2026-09-01"], unknownLimitDayCount: 1,
      latestCompletedAt: "2026-09-03T00:00:00.000Z", error: null, configured: false,
    });
  });
  it("検索語の読込失敗だけを区画へ閉じ、差分とページ実績は返す", async () => {
    const h = harness();
    vi.mocked(h.deps.queryMetrics.recent).mockResolvedValue(err(domainError("UPSTREAM_UNAVAILABLE", "検索語を取得できません")));
    const p = await h.preview();
    expect(p.changes).toHaveLength(2);
    expect(p.metrics.error).toBeNull();
    expect(p.searchQueries).toMatchObject({ rows: [], error: "検索語を取得できません" });
  });
  it("検索語の変化を承認tokenへ混ぜない", async () => {
    const h = harness();
    const first = await h.preview();
    vi.mocked(h.deps.queryMetrics.recent).mockResolvedValue(ok({ rows: [{ siteSlug: SITE, pageKey: PAGE_KEY,
      metricDate: "2026-09-01", query: "別の検索語", impressions: 1, clicks: 0, position: 8 }],
      truncated: false, dates: [] }));
    expect((await h.preview()).approvalToken).toBe(first.approvalToken);
  });
  it("実績の読込失敗を空の成功として隠さない", async () => {
    const h = harness(); vi.mocked(h.deps.metrics.recent).mockResolvedValue(err(domainError("UPSTREAM_UNAVAILABLE", "実績を取得できません")));
    expect((await h.preview()).metrics).toMatchObject({ rows: [], error: "実績を取得できません" });
  });
  it("観測先不明なら仮URLの実績を問い合わせない", async () => {
    const h = harness(); vi.mocked(h.deps.findings.groupedByArticle).mockResolvedValue(ok([]));
    const p = await h.preview(); expect(p.article.pageKey).toBeNull(); expect(p.metrics.error).toBeTruthy();
    expect(h.deps.metrics.recent).not.toHaveBeenCalled();
    expect(h.deps.queryMetrics.recent).not.toHaveBeenCalled();
  });
  it("問題が無い記事でも観測したページの実績を確認できる", async () => {
    const h = harness(); vi.mocked(h.deps.findings.groupedByArticle).mockResolvedValue(ok([]));
    vi.mocked(h.deps.findings.observedPageKey).mockResolvedValue(ok(PAGE_KEY));
    expect((await h.preview()).article.pageKey).toBe(PAGE_KEY);
    expect(h.deps.findings.observedPageKey).toHaveBeenCalledWith({ siteSlug: SITE, articleSlug: SLUG });
  });
  it("所見が解消しても反映履歴の観測先で実績を読める", async () => {
    const h = harness(); await h.apply((await h.preview()).approvalToken!);
    vi.mocked(h.deps.findings.groupedByArticle).mockResolvedValue(ok([]));
    expect((await h.preview()).article.pageKey).toBe(PAGE_KEY);
  });
  it("候補記事数と所見数を混同せず選択ブログに限定する", async () => {
    const h = harness();
    const result = await h.uc.execute(anAnalyst(), { action: "dashboard", siteSlug: SITE, limit: 50 });
    expect(result).toMatchObject({ ok: true, value: { candidates: [{ siteSlug: SITE, articleSlug: SLUG, findingCount: 2 }], unappliedCount: 2, autoApplyStalled: false } });
    expect(h.deps.findings.unappliedSummary).toHaveBeenCalledWith({ siteSlug: SITE });
    expect(h.deps.findings.groupedByArticle).toHaveBeenCalledWith({ siteSlug: SITE, limit: 50 });
    expect(h.deps.staticAudits.coverage).toHaveBeenCalledWith({
      siteSlug: SITE,
      staleBefore: "2026-08-21T00:00:00.000Z",
    });
  });
  it("連携未設定を停止と扱わず、件数と経過を両方見て滞留を表示する", async () => {
    const h = harness(); vi.mocked(h.deps.findings.unappliedSummary).mockResolvedValue(ok({ count: UNAPPLIED_BACKLOG_THRESHOLD + 1, oldestObservedAt: new Date(Date.parse(NOW) - UNAPPLIED_AGE_THRESHOLD_MS - 1).toISOString() }));
    const result = await h.uc.execute(anAnalyst(), { action: "dashboard", limit: 50 });
    expect(result).toMatchObject({ ok: true, value: { autoApplyStalled: true } });
    if (result.ok && result.value.action === "dashboard") expect(result.value.sources.filter((s) => s.source !== "static_audit").every((s) => s.state === "not_configured")).toBe(true);
  });
});
