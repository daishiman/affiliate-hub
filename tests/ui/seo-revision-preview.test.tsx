/**
 * @tier 2
 * @req REQ-SEO13
 * @types screen-states, state-transition, boundary, scenario
 */
// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SEARCH_QUERY_DISPLAY_LIMIT, type SeoDashboardOutput, type SeoRevisionPreviewOutput } from "@/application/usecases/seo/manage-seo-auto-apply";
import type { PageKey } from "@/domain/seo/aeo-measurement";
import type { SeoAeoFormState } from "@/presentation/admin/observe/seo-aeo-state";
import { ApplySeoRevisionForm } from "@/presentation/admin/observe/seo-aeo-forms";
import { SeoRevisionPreview } from "@/presentation/admin/observe/seo-revision-preview";

const { applyRevision, refresh } = vi.hoisted(() => ({ applyRevision: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/presentation/admin/observe/seo-aeo-action", () => ({
  applySeoRevisionAction: applyRevision,
  revertSeoAutoApplyAction: vi.fn(),
  setSeoAutoApplyPausedAction: vi.fn(),
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function preview(over: Partial<SeoRevisionPreviewOutput> = {}): SeoRevisionPreviewOutput {
  return {
    action: "preview",
    article: { siteSlug: "blog", articleSlug: "article-a", pageKey: "example.test/a", title: "机の選び方", url: "https://example.test/a" },
    changes: [{ field: "summary", label: "要約", before: "", after: "机の奥行きを先に確かめます。" }],
    diffSummary: "本文から要約を補います。", approvalToken: "reviewed-a", blockedReason: null,
    metrics: { from: "2026-08-10", to: "2026-09-06", rows: [], error: null },
    searchQueries: {
      from: "2026-08-10", to: "2026-09-06", rows: [], truncated: false,
      requestedDayCount: 28, availableDayCount: 0, unfinishedDayCount: 0,
      limitedDates: [], unknownLimitDayCount: 0, latestCompletedAt: null,
      error: null, configured: true,
    },
    ...over,
  };
}

function review(view: SeoRevisionPreviewOutput, recentApplies: SeoDashboardOutput["recentApplies"] = []) {
  return <SeoRevisionPreview view={view} recentApplies={recentApplies} canManage
    renderRevert={(logId) => <button type="button">{logId}を取り消す</button>} applySlot={
    <ApplySeoRevisionForm siteSlug={view.article.siteSlug} articleSlug={view.article.articleSlug}
      approvalToken={view.approvalToken} disabledReason={view.blockedReason} />
  } />;
}

describe("確認したSEO差分だけの反映", () => {
  it("同じページ鍵を持つ別記事の反映履歴と取消操作を混ぜない", () => {
    const history = (id: string, articleSlug: string): SeoDashboardOutput["recentApplies"][number] => ({
      effectPending: true,
      entry: {
        id, articleSlug, siteSlug: "blog", pageKey: "example.test/a" as PageKey,
        justifiedBy: [], diffSummary: "要約を更新", appliedAt: "2026-09-06T02:03:04.000Z",
        revertedAt: null, notifiedAt: null,
        snapshot: { pageKey: "example.test/a" as PageKey, takenAt: "2026-09-06T02:03:04.000Z", articleJson: "{}" },
      },
    });
    render(review(preview(), [history("article-a-log", "article-a"), history("other-log", "other-article")]));
    expect(screen.getByRole("button", { name: "article-a-logを取り消す" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "other-logを取り消す" })).toBeNull();
  });

  it("対象と変更前後を読み、確認した記事・差分だけを送信する", async () => {
    const sent: FormData[] = [];
    applyRevision.mockImplementation(async (_prev: SeoAeoFormState, data: FormData) => {
      sent.push(data);
      return { status: "done", message: "確認した差分をこの記事に反映しました。" };
    });
    render(review(preview()));
    expect(screen.getByRole("heading", { name: "机の選び方の差分" })).toBeDefined();
    const changes = screen.getByRole("table", { name: "反映する変更" });
    expect(within(changes).getByRole("cell", { name: "（未入力）" })).toBeDefined();
    expect(within(changes).getByRole("cell", { name: "机の奥行きを先に確かめます。" })).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "この差分を反映" }));
    await screen.findByText("確認した差分をこの記事に反映しました。");
    expect(Object.fromEntries(sent[0]!)).toEqual({ siteSlug: "blog", articleSlug: "article-a", approvalToken: "reviewed-a" });
    expect(screen.queryByRole("button", { name: "いま直せるものを直す" })).toBeNull();
  });

  it("送信中は再実行を止め、競合時は差分を残して再確認へ進める", async () => {
    let finish!: (state: SeoAeoFormState) => void;
    applyRevision.mockImplementation(() => new Promise<SeoAeoFormState>((resolve) => { finish = resolve; }));
    const view = render(review(preview()));
    await userEvent.click(screen.getByRole("button", { name: "この差分を反映" }));
    expect((screen.getByRole("button", { name: "差分を反映しています" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { finish({ status: "failed", message: "別の編集があるため反映しませんでした。" }); });
    expect(screen.getByText("別の編集があるため反映しませんでした。")).toBeDefined();
    expect(screen.getByRole("cell", { name: "机の奥行きを先に確かめます。" })).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "最新の差分を確認" }));
    expect(refresh).toHaveBeenCalled();
    view.rerender(review(preview({ article: { ...preview().article, articleSlug: "article-b", title: "椅子の選び方" }, approvalToken: "reviewed-b" })));
    expect(screen.queryByText("別の編集があるため反映しませんでした。")).toBeNull();
    expect(screen.getByRole("heading", { name: "椅子の選び方の差分" })).toBeDefined();
  });

  it("反映できない理由を出し、差分と観測値は確認できる", () => {
    render(review(preview({ approvalToken: null, blockedReason: "作成日時を確認できないため反映できません。" })));
    expect(screen.queryByRole("button", { name: "この差分を反映" })).toBeNull();
    expect(screen.getByText("作成日時を確認できないため反映できません。")).toBeDefined();
    expect(screen.getByRole("table", { name: "反映する変更" })).toBeDefined();
    expect(screen.getByText("この期間のページ実績はまだありません")).toBeDefined();
  });

  it("反映成功後に候補が消えても、同じ記事の完了表示を残す", async () => {
    applyRevision.mockResolvedValue({ status: "done", message: "確認した差分をこの記事に反映しました。" });
    const view = render(review(preview()));
    await userEvent.click(screen.getByRole("button", { name: "この差分を反映" }));
    await waitFor(() => expect(screen.getByText("確認した差分をこの記事に反映しました。")).toBeDefined());
    view.rerender(review(preview({ changes: [], approvalToken: null, blockedReason: "反映する差分はありません。" })));
    expect(screen.getByText("確認した差分をこの記事に反映しました。")).toBeDefined();
    expect(screen.queryByRole("button", { name: "この差分を反映" })).toBeNull();
  });
});

type Queries = SeoRevisionPreviewOutput["searchQueries"];
function queryView(over: Partial<Queries> = {}) {
  return preview({ searchQueries: { ...preview().searchQueries, ...over } });
}
function queryRow(query = "机 選び方", metricDate = "2026-09-05") {
  return { siteSlug: "blog", pageKey: "example.test/a" as PageKey, metricDate, query, impressions: 12, clicks: 0, position: 4.25 };
}
async function openQueries() {
  const summary = screen.getByText(/^検索語の日別記録：/);
  const details = summary.closest("details")!;
  expect(details.open).toBe(false);
  await userEvent.click(summary);
  expect(details.open).toBe(true);
  return details;
}

describe("この記事の検索語を日別記録として確認する", () => {
  it("差分から同じ記事の観測値へ移れ、反映不可でも検索語を確認できる", async () => {
    render(review({ ...queryView({ rows: [queryRow()], availableDayCount: 28 }), changes: [], approvalToken: null, blockedReason: "反映する差分はありません。" }));
    const link = screen.getByRole("link", { name: "この記事のページ実績・検索語を見る" });
    expect(link.getAttribute("href")).toBe("#article-observations");
    expect(document.getElementById("article-observations")?.textContent).toContain("この記事の観測値");
    const details = await openQueries();
    expect(within(details).getByRole("table", { name: "検索語の日別記録" })).toBeDefined();
    expect(within(details).getByText(/匿名化された検索語などは含まれず、ページ実績の総計とは一致しません/)).toBeDefined();
  });

  it("同じ検索語を日別のまま表示し、長い日本語や HTML 文字を省略・実行しない", async () => {
    const query = "初心者にも使いやすい高さを調整できる机の選び方".repeat(8) + "<script>fail()</script>";
    render(review(queryView({ rows: [queryRow(query, "2026-09-05"), queryRow(query, "2026-09-04")], availableDayCount: 28 })));
    const details = await openQueries();
    const table = within(details).getByRole("table", { name: "検索語の日別記録" });
    expect(within(table).getAllByRole("rowheader").map((header) => header.textContent)).toEqual([`${query}2026-09-05`, `${query}2026-09-04`]);
    expect(within(table).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["12", "0", "4.3", "12", "0", "4.3"]);
    expect(table.querySelector("script")).toBeNull();
    expect(table.closest('[role="group"]')?.getAttribute("tabindex")).toBe("0");
    expect(within(details).getByText((text) => text.includes(`最新の日付から最大${SEARCH_QUERY_DISPLAY_LIMIT}件を表示します。日別の記録を合算しません`))).toBeDefined();
  });

  it("連携未設定を取得済み0件とせず、保存済み記録があれば残す", async () => {
    render(review(queryView({ configured: false, rows: [queryRow()], availableDayCount: 1 })));
    expect(screen.getByText(/^検索語の日別記録：.*1件.*連携未設定/)).toBeDefined();
    const details = await openQueries();
    expect(within(details).getByText(/Search Consoleの連携が未設定です/)).toBeDefined();
    expect(within(details).getByRole("table", { name: "検索語の日別記録" })).toBeDefined();
  });

  it("連携未設定で過去の記録が無い場合は、設定確認だけを案内する", async () => {
    render(review(queryView({ configured: false })));
    expect(screen.getByText("検索語の日別記録：連携未設定")).toBeDefined();
    const details = await openQueries();
    expect(within(details).getByRole("link", { name: "収集元の状態を確認する" }).getAttribute("href")).toBe("/admin/seo?site=blog");
    expect(within(details).queryByText("取得した範囲に、このページの検索語はありません")).toBeNull();
    expect(within(details).queryByText("日別取得の最新完了")).toBeNull();
    expect(within(details).queryByText("検索語の取得はまだ完了していません")).toBeNull();
    expect(within(details).queryByRole("table")).toBeNull();
  });

  it("初回の取得未完了と、取得した範囲に検索語が無い状態を分ける", async () => {
    const rendered = render(review(queryView({ unfinishedDayCount: 2 })));
    expect(screen.getByText(/^検索語の日別記録：.*取得未完了2日/)).toBeDefined();
    let details = await openQueries();
    expect(within(details).getByText("検索語の取得はまだ完了していません")).toBeDefined();
    expect(within(details).getByText(/完了後に記録を表示します/)).toBeDefined();
    expect(within(details).queryByText(/前回完了した記録を表示します/)).toBeNull();
    expect(within(details).queryByText("取得した範囲に、このページの検索語はありません")).toBeNull();
    rendered.unmount();
    render(review(queryView({ availableDayCount: 28 })));
    details = await openQueries();
    expect(within(details).getByText("取得した範囲に、このページの検索語はありません")).toBeDefined();
    expect(within(details).getByText(/検索された回数が0という意味ではありません/)).toBeDefined();
  });

  it("過去の完了記録と取得未完了の日数を両方示し、実行中とは断定しない", async () => {
    render(review(queryView({ rows: [queryRow()], availableDayCount: 28, unfinishedDayCount: 2, latestCompletedAt: "2026-09-06T02:03:04.000Z" })));
    expect(screen.getByText(/^検索語の日別記録：.*1件.*取得未完了2日/)).toBeDefined();
    const details = await openQueries();
    expect(within(details).getByText(/更新が完了するまでは、前回完了した記録を表示します/)).toBeDefined();
    const completedAt = within(details).getByText("2026/09/06 11:03（日本時間）");
    expect(completedAt.getAttribute("datetime")).toBe("2026-09-06T02:03:04.000Z");
    expect(details.textContent).not.toContain("実行中");
  });

  it("検索語の読取失敗を空として扱わず、ページ実績と再読込導線を残す", async () => {
    const view = queryView({ error: "検索語の記録を読み出せません。" });
    render(review({ ...view, metrics: { ...view.metrics, rows: [{ pageKey: "example.test/a" as PageKey, metricDate: "2026-09-05", impressions: 12, clicks: 1, position: 3, aiCitations: null }] } }));
    expect(screen.getByText("検索語の日別記録：読み出せませんでした")).toBeDefined();
    expect(screen.getByRole("table", { name: "日ごとのページ実績" })).toBeDefined();
    const details = await openQueries();
    expect(within(details).getByText("検索語の記録を読み出せません。")).toBeDefined();
    expect(within(details).queryByText("取得した範囲に、このページの検索語はありません")).toBeNull();
    expect(within(details).getByRole("link", { name: "保存済みの記録を読み直す" }).getAttribute("href")).toBe("/admin/seo?site=blog&article=article-a#article-observations");
  });

  it.each([false, true])("表示件数の上限と API 上限、既存記録の上限不明を分離する（続き %s）", async (truncated) => {
    render(review(queryView({ rows: Array.from({ length: SEARCH_QUERY_DISPLAY_LIMIT }, (_, n) => queryRow(`検索語${n}`)), truncated, availableDayCount: 28, limitedDates: ["2026-09-05"], unknownLimitDayCount: 1 })));
    const summary = screen.getByText(/^検索語の日別記録：/);
    expect(summary.textContent).toContain(`${SEARCH_QUERY_DISPLAY_LIMIT}件`);
    expect(summary.textContent?.includes("続きあり")).toBe(truncated);
    const details = await openQueries();
    expect(within(details).getByText(/2026-09-05 はAPI公開範囲の上限/)).toBeDefined();
    expect(within(details).getByText(/ブログを含むプロパティ・日・検索種別ごとの上限/)).toBeDefined();
    expect(within(details).getByText(/上限に達したか確認できない日が1日/)).toBeDefined();
  });

  it("観測先が未確定なら読取障害とせず、ページ全体の未観測案内と整合する", async () => {
    const view = queryView({ error: "この記事の観測記録はまだありません。" });
    render(review({ ...view, article: { ...view.article, pageKey: null } }));
    expect(screen.getByText("検索語の日別記録：まだ記録なし")).toBeDefined();
    const details = await openQueries();
    expect(within(details).queryByText("検索語の記録を読み出せませんでした")).toBeNull();
    expect(within(details).getByText(/この記事の観測記録と結びつくまで/)).toBeDefined();
  });
});

describe("同じページの実測を誤読させない", () => {
  it("取得期間・ゼロと未観測を区別し、効果を断定しない", () => {
    const base = preview();
    render(review(preview({ metrics: { ...base.metrics, rows: [{ pageKey: base.article.pageKey as PageKey, metricDate: "2026-09-05", impressions: 0, clicks: 0, position: 0, aiCitations: null }] } })));
    expect(screen.getByText("2026-08-10 〜 2026-09-06 の記録です。")).toBeDefined();
    const row = screen.getByRole("row", { name: "2026-09-05 0 0 —（表示なし） 記録なし" });
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["0", "0", "—（表示なし）", "記録なし"]);
    expect(screen.getByText(/数字の増減だけで、この変更の効果とは判断できません/)).toBeDefined();
  });

  it("AIだけ記録された日は、検索の数字を0で補わない", () => {
    const base = preview();
    render(review(preview({ metrics: { ...base.metrics, rows: [{ pageKey: base.article.pageKey as PageKey, metricDate: "2026-09-06", impressions: null, clicks: null, position: null, aiCitations: 1 }] } })));
    const row = screen.getByRole("row", { name: "2026-09-06 記録なし 記録なし 記録なし 引用あり" });
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["記録なし", "記録なし", "記録なし", "引用あり"]);
  });

  it("ページの観測identityがまだ無いときは、取得障害と区別して表示する", () => {
    const base = preview();
    render(review(preview({ article: { ...base.article, pageKey: null }, metrics: { ...base.metrics, error: "この記事の観測記録はまだありません" } })));
    expect(screen.getByText("この記事の観測記録はまだありません")).toBeDefined();
    expect(screen.queryByText("この記事のページ実績を読み出せませんでした")).toBeNull();
  });

  it("取得失敗を観測ゼロや未観測として表示しない", () => {
    render(review(preview({ metrics: { ...preview().metrics, error: "記録の取得に失敗しました。" } })));
    expect(screen.getByText("この記事のページ実績を読み出せませんでした")).toBeDefined();
    expect(screen.getByText("記録の取得に失敗しました。")).toBeDefined();
    expect(screen.queryByText("この期間のページ実績はまだありません")).toBeNull();
  });
});
