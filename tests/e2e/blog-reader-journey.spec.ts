import { expect, test } from "@playwright/test";
import { SITE } from "../ui/route-cases";
import { waitForStreamedContent } from "./streamed-content";

const HOME = `/s/${SITE}`;

test("検索結果が0件でもカテゴリーから探し直せる", async ({ page }, testInfo) => {
  await page.goto(`${HOME}/search`);
  await waitForStreamedContent(page);
  const input = page.getByRole("main").getByRole("searchbox").first();
  await input.fill("no-matching-reader-journey-example");
  await input.press("Enter");
  await expect(page).toHaveURL(/q=no-matching-reader-journey-example/);
  await expect(page.getByRole("heading", { name: "カテゴリーから探す", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("search-empty.png"), fullPage: true });
  const alternatives = page.getByRole("region", { name: "カテゴリーから探す" });
  await alternatives.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/categories\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("JavaScriptなしで並べ替えから記事一覧・本文まで辿れる", async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({
    baseURL, javaScriptEnabled: false, locale: "ja-JP",
    viewport: testInfo.project.use.viewport,
  });
  const page = await context.newPage();
  try {
    await page.goto(HOME);
    await page.getByRole("navigation", { name: "記事の並べ替え" }).getByRole("link", { name: "人気順" }).click();
    await expect(page).toHaveURL(/sort=popular/);
    await page.getByRole("link", { name: "公開中の記事をすべて見る", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "記事一覧", level: 1 })).toBeVisible();
    const article = page.getByRole("main").getByRole("heading", { level: 2 }).getByRole("link").first();
    const title = await article.innerText();
    await page.screenshot({ path: testInfo.outputPath("article-index-no-js.png"), fullPage: true });
    await article.click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("ブランドの選択を検索画面で保持し、解除できる", async ({ page }) => {
  await page.goto(`${HOME}/search?tag=mihondo`);
  await waitForStreamedContent(page);
  await expect(page.getByRole("heading", { name: /見本堂：/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "タグの絞り込みを解除" })).toBeVisible();
  await page.getByRole("link", { name: "タグの絞り込みを解除" }).click();
  await expect(page).toHaveURL(`${HOME}/search`);
});
