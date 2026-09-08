/** @tier 3 @req REQ-SEO15 @types scenario, boundary, state-transition */
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { authenticateE2E } from "./auth-fixture";
import { seoRevisionFixture } from "./seo-reviewed-revision-fixture";

async function reloadPublishedArticle(page: Page, summaryVisible: boolean) {
  // desktop/mobileのfixtureは同じローカルSQLiteへ接続する。書込直後の並列readが
  // preview固有の一時エラーになっても、正常な公開ページと保存結果を検査する。
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("heading", { name: "差分を確認する記事A", exact: true })).toBeVisible({ timeout: 2_000 });
    const summary = page.getByText("机の奥行きを先に確かめます。", { exact: true });
    if (summaryVisible) await expect(summary).toBeVisible({ timeout: 2_000 });
    else await expect(summary).toHaveCount(0);
  }).toPass({ timeout: 10_000 });
}

test("候補の差分を読み、選んだ1記事だけ反映して取り消せる", async ({ page, context, baseURL }, testInfo) => {
  const fixture = seoRevisionFixture(testInfo.project.name, "apply", baseURL!);
  fixture.setup();
  const published = await context.newPage();
  try {
    await authenticateE2E(context, fixture.token);
    await page.goto(`/admin/seo?site=${fixture.siteSlug}`);
    await expect(page.getByRole("button", { name: "いま直せるものを直す" })).toHaveCount(0);
    await page.getByRole("link", { name: "差分を確認する記事Aの差分と実績を見る" }).click();
    const changes = page.getByRole("table", { name: "反映する変更" });
    await expect(changes.getByRole("cell", { name: "（未入力）" })).toBeVisible();
    await expect(changes.getByRole("cell", { name: "机の奥行きを先に確かめます。" })).toBeVisible();
    const metrics = page.getByRole("table", { name: "日ごとのページ実績" });
    await expect(metrics.getByRole("cell", { name: "100", exact: true })).toBeVisible();
    await expect(metrics.getByRole("row").filter({ has: page.getByRole("cell", { name: "100", exact: true }) }).getByRole("cell", { name: "記録なし", exact: true })).toBeVisible();
    await expect(metrics.getByRole("cell", { name: "引用なし", exact: true })).toBeVisible();
    await expect(metrics.getByRole("cell", { name: "引用あり", exact: true })).toBeVisible();
    const querySummary = page.getByText(/^検索語の日別記録：1件・取得済み1\/28日/);
    await expect(querySummary).toBeVisible();
    await querySummary.click();
    const queryMetrics = page.getByRole("table", { name: "検索語の日別記録" });
    await expect(queryMetrics.getByRole("rowheader", { name: /初心者にも使いやすい高さを調整できる机/ })).toBeVisible();
    await expect(page.getByText(/匿名化された検索語などは含まれず、ページ実績の総計とは一致しません/)).toBeVisible();
    const screenshots = "eval-log/affiliate-hub/current-worktree/elegant-review/20260908/gsc-query-ui/screenshots";
    await mkdir(screenshots, { recursive: true });
    await page.locator("section").filter({ has: page.getByRole("heading", { name: "差分を確認する記事Aの差分" }) }).screenshot({ path: join(screenshots, `revision-${testInfo.project.name}.png`) });
    const metricScroll = page.getByRole("group", { name: "日ごとのページ実績", exact: true });
    const queryScroll = page.getByRole("group", { name: "検索語の日別記録", exact: true });
    await metricScroll.screenshot({ path: join(screenshots, `metrics-${testInfo.project.name}.png`) });
    await queryMetrics.screenshot({ path: join(screenshots, `query-metrics-${testInfo.project.name}.png`) });
    if (testInfo.project.name === "mobile") {
      await metricScroll.focus();
      await expect(metricScroll).toBeFocused();
      await metricScroll.press("ArrowRight");
      await expect.poll(() => metricScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      for (let step = 0; step < 8; step += 1) await metricScroll.press("ArrowRight");
      await expect.poll(() => metricScroll.evaluate((element) => {
        const lastColumn = element.querySelector("thead th:last-child")!;
        return lastColumn.getBoundingClientRect().right <= element.getBoundingClientRect().right;
      })).toBe(true);
      await metricScroll.screenshot({ path: join(screenshots, "metrics-mobile-right.png") });
      await queryScroll.focus();
      await expect(queryScroll).toBeFocused();
      await queryScroll.press("ArrowRight");
      await expect.poll(() => queryScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      for (let step = 0; step < 8; step += 1) await queryScroll.press("ArrowRight");
      await expect.poll(() => queryScroll.evaluate((element) => {
        const lastColumn = element.querySelector("thead th:last-child")!;
        return lastColumn.getBoundingClientRect().right <= element.getBoundingClientRect().right;
      })).toBe(true);
      await queryScroll.screenshot({ path: join(screenshots, "query-mobile-right.png") });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await published.goto(`/s/${fixture.siteSlug}/guides/article-a`);
    await expect(published.getByRole("heading", { name: "差分を確認する記事A", exact: true })).toBeVisible();
    await expect(published.getByText("机の奥行きを先に確かめます。", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "この差分を反映" }).click();
    await expect(page.getByText("確認した差分をこの記事に反映しました。反映の記録から取り消せます。")).toBeVisible();
    await reloadPublishedArticle(published, true);
    expect(fixture.saved().map(({ slug, summary }) => ({ slug, summary }))).toEqual([
      { slug: "article-a", summary: "机の奥行きを先に確かめます。" }, { slug: "article-b", summary: "" },
    ]);
    await page.getByRole("button", { name: "この反映を取り消す" }).click();
    await expect(page.getByRole("table", { name: "この記事への反映日時" }).getByText(/に取り消し済み/)).toBeVisible();
    await reloadPublishedArticle(published, false);
    expect(fixture.saved().map(({ slug, summary }) => ({ slug, summary }))).toEqual([
      { slug: "article-a", summary: "" }, { slug: "article-b", summary: "" },
    ]);
  } finally { await published.close(); fixture.cleanup(); }
});

test("差分確認後の別編集を上書きせず、最新の差分を確認し直せる", async ({ page, context, baseURL }, testInfo) => {
  const fixture = seoRevisionFixture(testInfo.project.name, "conflict", baseURL!);
  fixture.setup();
  try {
    await authenticateE2E(context, fixture.token);
    await page.goto(`/admin/seo?site=${fixture.siteSlug}&article=article-a`);
    await expect(page.getByRole("button", { name: "この差分を反映" })).toBeVisible();
    fixture.editAfterReview();
    await page.getByRole("button", { name: "この差分を反映" }).click();
    await expect(page.getByText(/記事または所見が変わりました/)).toBeVisible();
    expect(fixture.saved()[0]).toMatchObject({ title: "確認後に人が編集した題名", summary: "" });
    await page.getByRole("button", { name: "最新の差分を確認" }).click();
    await expect(page.getByRole("heading", { name: "確認後に人が編集した題名の差分" })).toBeVisible();
    await page.getByRole("button", { name: "この差分を反映" }).click();
    await expect(page.getByText("確認した差分をこの記事に反映しました。反映の記録から取り消せます。")).toBeVisible();
    expect(fixture.saved()[0]).toMatchObject({ title: "確認後に人が編集した題名", summary: "机の奥行きを先に確かめます。" });
  } finally { fixture.cleanup(); }
});

test("SEO反映前に開いた通常編集画面が、新しい内容を上書きしない", async ({ page, context, baseURL }, testInfo) => {
  const fixture = seoRevisionFixture(testInfo.project.name, "stale-editor", baseURL!);
  fixture.setup();
  const editor = await context.newPage();
  try {
    await authenticateE2E(context, fixture.token);
    await editor.goto(`/admin/content/published/${fixture.siteSlug}/article-a/edit`);
    await editor.getByLabel("タイトル", { exact: true }).fill("古い画面で入力した訂正");
    await editor.getByLabel("一覧に出す結論").fill("確認前の下書きの結論");
    await editor.getByLabel("訂正理由").fill("誤記を直すため");
    await page.goto(`/admin/seo?site=${fixture.siteSlug}&article=article-a`);
    await page.getByRole("button", { name: "この差分を反映" }).click();
    await expect(page.getByText("確認した差分をこの記事に反映しました。反映の記録から取り消せます。")).toBeVisible();
    await editor.getByRole("button", { name: "訂正を保存", exact: true }).click();
    await expect(editor.getByText(/この記事は別の操作で更新されています/)).toBeVisible();
    await expect(editor.getByLabel("タイトル", { exact: true })).toHaveValue("古い画面で入力した訂正");
    await expect(editor.getByRole("link", { name: "最新の記事を別タブで開く" })).toBeVisible();
    expect(fixture.saved()[0]).toMatchObject({ title: "差分を確認する記事A", summary: "机の奥行きを先に確かめます。" });
    const opened = context.waitForEvent("page");
    await editor.getByRole("link", { name: "最新の記事を別タブで開く" }).click();
    const latest = await opened;
    await expect(latest.getByLabel("タイトル", { exact: true })).toHaveValue("差分を確認する記事A");
    await expect(latest.getByLabel("一覧に出す結論")).toHaveValue("机の奥行きを先に確かめます。");
    await latest.getByLabel("タイトル", { exact: true }).fill("最新の内容へ追記した題名");
    await latest.getByLabel("訂正理由").fill("最新の記事を確認して追記するため");
    await latest.getByRole("button", { name: "訂正を保存", exact: true }).click();
    await expect(latest.getByText("訂正を保存しました。公開画面の更新日にも反映されます。")).toBeVisible();
    expect(fixture.saved()[0]).toMatchObject({ title: "最新の内容へ追記した題名", summary: "机の奥行きを先に確かめます。" });
    await latest.close();
  } finally { await editor.close(); fixture.cleanup(); }
});
