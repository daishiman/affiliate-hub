/**
 * @tier 2
 * @req REQ-SEO13
 * @types screen-states, boundary, scenario
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SeoDashboardOutput } from "@/application/usecases/seo/manage-seo-auto-apply";
import type { Finding, FindingCode, PageKey } from "@/domain/seo/aeo-measurement";
import { SeoDashboard } from "@/presentation/admin/observe/seo-dashboard";

vi.mock("@/presentation/admin/observe/seo-aeo-action", () => ({
  revertSeoAutoApplyAction: vi.fn(),
  applySeoRevisionAction: vi.fn(),
  setSeoAutoApplyPausedAction: vi.fn(),
}));

afterEach(cleanup);

function finding(code: FindingCode, index: number): Finding {
  return {
    source: "static_audit",
    pageKey: `example.test/article-${index}` as PageKey,
    code,
    detail: "確認した所見",
    observedAt: "2026-09-06T00:00:00.000Z",
  };
}

function dashboard(findings: readonly Finding[], unappliedCount: number, siteSlug: string | undefined,
  budget: Partial<SeoDashboardOutput["citationMonthlyBudget"]> = {},
  staticAuditCoverage: SeoDashboardOutput["staticAuditCoverage"] = []) {
  const view: SeoDashboardOutput = {
    action: "dashboard", paused: false, introducedAt: "2026-09-01T00:00:00.000Z",
    findings, sources: [], recentApplies: [], autoApplyStalled: false, unappliedCount,
    candidates: unappliedCount === 0 ? [] : [{ siteSlug: "blog", articleSlug: "older/article", pageKey: "example.test/older/article", title: "古い記事の候補", findingCount: unappliedCount }],
    citationMonthlyBudget: { monthKey: "2026-09", limitSearches: 60, usedSearches: 7,
      unconfirmedSearches: 2, reservedSearches: 1, remainingSearches: 50, reached: false, ...budget },
    staticAuditCoverage,
  };
  return render(
    <SeoDashboard
      view={view} siteSlug={siteSlug} siteOptions={[]} siteError={null} canManage
      renderRevert={() => null}
      pauseSlot={null}
      citationBudgetSlot={null}
    />,
  );
}

describe("SEO所見の表示件数と修正できる候補", () => {
  it("記事を選んだ後は、その記事の差分と観測だけを表示する", () => {
    const view = dashboard([], 0, "blog");
    view.unmount();
    render(
      <SeoDashboard
        view={{
          action: "dashboard", paused: false, introducedAt: "2026-09-01T00:00:00.000Z",
          findings: [], sources: [], recentApplies: [], autoApplyStalled: false, unappliedCount: 0,
          candidates: [], citationMonthlyBudget: { monthKey: "2026-09", limitSearches: 60,
            usedSearches: 7, unconfirmedSearches: 2, reservedSearches: 1, remainingSearches: 50, reached: false },
          staticAuditCoverage: [],
        }}
        siteSlug="blog" siteOptions={[]} siteError={null} canManage
        reviewSlot={<section aria-label="選択した記事">記事Aの差分と観測</section>}
        renderRevert={() => null} pauseSlot={null} citationBudgetSlot={null}
      />,
    );
    expect(screen.getByRole("region", { name: "選択した記事" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "いまの状況" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "記事の修正候補" })).toBeNull();
  });

  it("直近50件がテンプレート所見でも、記事ごとの候補から差分を確認できる", () => {
    dashboard(Array.from({ length: 50 }, (_, i) => finding("missing_canonical", i)), 1, "blog");

    expect(screen.queryByRole("button", { name: "いま直せるものを直す" })).toBeNull();
    expect(screen.getByRole("link", { name: "古い記事の候補の差分と実績を見る" }).getAttribute("href")).toBe("/admin/seo?site=blog&article=older%2Farticle");
    expect(screen.queryByText("記事を書き換えて消える所見はありません")).toBeNull();
    expect(screen.getByText(/記事の候補を最大50件表示/)).toBeDefined();
    expect(screen.getByText(/確認対象: blog/)).toBeDefined();
    expect(screen.getByRole("link", { name: "全ブログを見る" }).getAttribute("href")).toBe("/admin/seo");
  });

  it("記事の手動修正が必要な所見だけなら、自動修正ボタンを出さない", () => {
    dashboard([finding("title_too_long", 1)], 0, "blog");

    expect(screen.queryByRole("button", { name: "いま直せるものを直す" })).toBeNull();
    expect(screen.getByText("題名が長すぎる")).toBeDefined();
    expect(screen.getByText("確認できる記事の修正候補はありません")).toBeDefined();
  });

  it("ブログ未選択の集計は、選択ブログの数と誤認させない", () => {
    dashboard([], 0, undefined);
    expect(screen.getByText(/全ブログから、直近の最大50件/)).toBeDefined();
  });

  it("AI月次枠を意味の異なる4値へ分け、UTCのリセットを示す", () => {
    dashboard([], 0, undefined);
    expect(screen.getByText(/AIの被引用チェック：残り50回／上限60回/)).toBeDefined();
    expect(screen.getByText("残り")).toBeDefined();
    expect(screen.getByText("確認済みの検索")).toBeDefined();
    expect(screen.getByText("実行中の確保")).toBeDefined();
    expect(screen.getByText("使用数を確認できなかった確保")).toBeDefined();
    expect(screen.getByText(/2026年9月（UTC）/)).toBeDefined();
  });

  it.each([
    [{ limitSearches: null, remainingSearches: null, reached: false }, "月次上限が未設定"],
    [{ limitSearches: 0, remainingSearches: 0, reached: true }, "停止中（0回）"],
    [{ limitSearches: 10, remainingSearches: 0, reached: true }, "実行中（残りを確保中"],
    [{ limitSearches: 10, usedSearches: 10, unconfirmedSearches: 0, reservedSearches: 0, remainingSearches: 0, reached: true }, "今月の上限に到達"],
  ] as const)("未設定・0・到達を閉じた状態でも示す", (budget, label) => {
    dashboard([], 0, undefined, budget);
    expect(screen.getByText((content, element) => element?.tagName === "SUMMARY" && content.includes(label))).toBeDefined();
  });

  it("静的監査の未確認・失敗・再確認待ちを閉じた状態でも区別する", () => {
    dashboard([], 0, "blog", {}, [{
      siteSlug: "blog", status: "collecting", total: 12, current: 7, never: 2, failed: 1, stale: 2,
      inventoryComplete: true, startedAt: "2026-09-01T00:00:00.000Z", lastCompletedAt: null,
      currentFindingCount: 3,
    }]);
    expect(screen.getByText((content, element) => element?.tagName === "SUMMARY"
      && content.includes("確認途中：公開ページ7/12件を確認済み（未確認2・失敗1・再確認待ち2）"))).toBeDefined();
    expect(screen.getByText("公開ページの確認は途中です")).toBeDefined();
    expect(screen.queryByText(/所見0件/)).toBeNull();
  });

  it("全件が現在の内容なら、確認済み総数と所見数を一息で読める", () => {
    dashboard([], 0, "blog", {}, [{
      siteSlug: "blog", status: "published", total: 12, current: 12, never: 0, failed: 0, stale: 0,
      inventoryComplete: true, startedAt: "2026-09-01T00:00:00.000Z", lastCompletedAt: "2026-09-02T00:00:00.000Z",
      currentFindingCount: 0,
    }]);
    expect(screen.getByText((content, element) => element?.tagName === "SUMMARY"
      && content.includes("公開ページ12件を確認済み・所見0件"))).toBeDefined();
    expect(screen.queryByText("公開ページの確認は途中です")).toBeNull();
  });

  it("全ブログのうち未開始ブログがあれば、完了済みブログだけで全件確認と言わない", () => {
    dashboard([], 0, undefined, {}, [{
      siteSlug: "ready", status: "published", total: 12, current: 12, never: 0, failed: 0, stale: 0,
      inventoryComplete: true, startedAt: "2026-09-01T00:00:00.000Z", lastCompletedAt: "2026-09-02T00:00:00.000Z",
      currentFindingCount: 0,
    }, {
      siteSlug: "waiting", status: "not_started", total: 0, current: 0, never: 0, failed: 0, stale: 0,
      inventoryComplete: false, startedAt: null, lastCompletedAt: null, currentFindingCount: 0,
    }]);
    expect(screen.getByText((content, element) => element?.tagName === "SUMMARY"
      && content.includes("確認途中：公開ページ12/12件を確認済み・未開始1ブログ"))).toBeDefined();
    expect(screen.queryByText(/公開ページ12件を確認済み・所見0件/)).toBeNull();
  });

  it.each([
    [{ status: "limited" as const, inventoryComplete: false, total: 1001, current: 0, never: 1001 }, "公開ページ1,000件超1ブログ"],
    [{ status: "limited" as const, inventoryComplete: true, total: 70, current: 70, never: 0 }, "一括確認容量超過1ブログ"],
  ])("監査上限を確認途中や問題なしに見せず、閉じた状態でも理由を示す", (state, message) => {
    dashboard([], 0, "blog", {}, [{
      siteSlug: "blog", ...state, failed: 0, stale: 0,
      startedAt: "2026-09-01T00:00:00.000Z", lastCompletedAt: null, currentFindingCount: 2,
    }]);
    expect(screen.getByText((content, element) => element?.tagName === "SUMMARY" && content.includes(message))).toBeDefined();
    expect(screen.getByText("公開ページの確認上限に達しました")).toBeDefined();
    expect(screen.queryByText(/公開ページ70件を確認済み・所見2件/)).toBeNull();
  });

  it("対象数と容量の上限が混在しても、両方の理由を閉じた状態と詳細に示す", () => {
    dashboard([], 0, undefined, {}, [{
      siteSlug: "many", status: "limited", total: 1001, current: 0, never: 1001, failed: 0, stale: 0,
      inventoryComplete: false, startedAt: "2026-09-01T00:00:00.000Z", lastCompletedAt: null, currentFindingCount: 0,
    }, {
      siteSlug: "large", status: "limited", total: 70, current: 70, never: 0, failed: 0, stale: 0,
      inventoryComplete: true, startedAt: "2026-09-01T00:00:00.000Z", lastCompletedAt: null, currentFindingCount: 0,
    }]);
    expect(screen.getByText((content, element) => element?.tagName === "SUMMARY"
      && content.includes("公開ページ1,000件超1ブログ・一括確認容量超過1ブログ"))).toBeDefined();
    expect(screen.getByText(/公開ページが1,000件を超えたブログが1件あります/)).toBeDefined();
    expect(screen.getByText(/一括確認容量を超えたブログが1件あります/)).toBeDefined();
    expect(screen.getByText("1001件以上")).toBeDefined();
  });
});
