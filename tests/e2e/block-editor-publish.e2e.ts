/**
 * @req REQ-BOPS04, REQ-BOPS05, REQ-BOPS11
 * FRONT-REQ-005-A4/A5: product search and real image upload in the save/publish journey.
 * Dedicated config only; never shared-seed E2E. This does not claim all 19 block types.
 */
import { expect, test, type Page } from "@playwright/test";
import { createBlockEditorFixture } from "./block-editor-publish-fixture";

async function addBlock(page: Page, label: string) {
  await page.getByRole("button", { name: "段落の下に部品を足す", exact: true }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
}

async function save(page: Page) {
  await page.getByRole("button", { name: "記事を保存", exact: true }).click();
  await expect(page.getByRole("button", { name: "記事を保存", exact: true })).toBeEnabled();
  await expect(page.getByText("保存済み", { exact: true })).toBeVisible();
}

async function setStatus(page: Page, status: "published" | "archived") {
  const setting = page.getByText("記事の設定（公開状態・カテゴリ・タグ）", { exact: true });
  if (!(await page.getByLabel("公開状態", { exact: true }).isVisible())) await setting.click();
  await page.getByLabel("公開状態", { exact: true }).selectOption(status);
  await save(page);
}

test("本文・装飾・表・商品・画像を保存し、匿名読者へ公開してから取り下げる", async ({ page, context, browser, baseURL }, testInfo) => {
  const fixture = createBlockEditorFixture(testInfo.project.name);
  const geometry = { viewport: testInfo.project.use.viewport, isMobile: testInfo.project.use.isMobile, hasTouch: testInfo.project.use.hasTouch };
  const anonymous = await browser.newContext({ baseURL, ...geometry });
  const reader = await anonymous.newPage();
  const restoredContext = await browser.newContext({ baseURL, ...geometry });
  let journeyCompleted = false;
  try {
    await fixture.authenticate(context);
    await page.goto(fixture.editPath);
    await expect(page.getByRole("heading", { name: fixture.title, exact: true })).toBeVisible();
    expect((await reader.goto(fixture.publicPath))?.status()).toBe(404);

    const paragraph = page.getByRole("textbox", { name: "段落", exact: true });
    await paragraph.fill("装飾を含む検証本文");
    await paragraph.press("ControlOrMeta+A");
    await page.getByRole("button", { name: "太字", exact: true }).click();
    await addBlock(page, "比較表");
    await page.getByRole("textbox", { name: "1 列目の見出し", exact: true }).fill("確認項目");
    await page.getByRole("textbox", { name: "2 列目の見出し", exact: true }).fill("検証結果");
    await page.getByRole("textbox", { name: "1 行 1 列", exact: true }).fill("保存後の値");
    await page.getByRole("textbox", { name: "1 行 2 列", exact: true }).fill("保持できた値");
    await addBlock(page, "商品カード");
    await page.getByRole("searchbox", { name: "商品を探す", exact: true }).fill(fixture.productName);
    await page.getByRole("button", { name: `${fixture.brand} ${fixture.productName}`, exact: true }).click();
    await addBlock(page, "画像");
    const uploaded = page.waitForResponse((response) => response.url().endsWith("/api/article-images") && response.request().method() === "POST");
    await page.getByLabel("画像に使うファイル", { exact: true }).setInputFiles({
      name: "block-editor-e2e.png", mimeType: "image/png", buffer: fixture.png,
    });
    const upload = await uploaded;
    expect(upload.status()).toBe(200);
    const { url: imageUrl } = await upload.json() as { url: string };
    await page.getByRole("textbox", { name: "画像の説明（見えない人へ伝わる言葉）", exact: true }).fill("保存した検証画像");
    expect((await anonymous.request.get(imageUrl)).status()).toBe(404);
    await save(page);

    // A new context has no local draft: persisted D1 content, not localStorage restoration, must win.
    await fixture.authenticate(restoredContext);
    const restored = await restoredContext.newPage();
    await restored.goto(fixture.editPath);
    await expect(restored.getByRole("textbox", { name: "段落", exact: true })).toHaveText("装飾を含む検証本文");
    await expect(restored.getByRole("textbox", { name: "1 行 2 列", exact: true })).toHaveText("保持できた値");
    await expect(restored.getByRole("img", { name: "保存した検証画像", exact: true })).toBeVisible();
    await setStatus(restored, "published");

    expect((await reader.goto(fixture.publicPath))?.status()).toBe(200);
    await expect(reader.getByRole("heading", { name: fixture.title, exact: true })).toBeVisible();
    // This fixture has only an author name: repeated empty profile cards add no information.
    const authorLink = reader.getByRole("link", { name: fixture.authorName, exact: true });
    await expect(authorLink).toHaveCount(1);
    // Start at the document's normal tab order; do not focus the author link programmatically.
    let authorReachedByKeyboard = false;
    for (let stops = 0; stops < 32; stops += 1) {
      await reader.keyboard.press("Tab");
      if (await authorLink.evaluate((link) => link === document.activeElement)) {
        authorReachedByKeyboard = true;
        break;
      }
    }
    expect(authorReachedByKeyboard, "冒頭の著者リンクへ通常のTab移動で到達できる").toBe(true);
    const renderedText = reader.getByText("装飾を含む検証本文", { exact: true });
    await expect(renderedText).toBeVisible();
    expect(await renderedText.evaluate((element) => element.tagName === "STRONG" || element.closest("strong") !== null)).toBe(true);
    await expect(reader.getByRole("columnheader", { name: "確認項目", exact: true })).toBeVisible();
    await expect(reader.getByRole("cell", { name: "保持できた値", exact: true })).toBeVisible();
    await expect(reader.getByText(fixture.productName, { exact: true })).toBeVisible();
    const publicImage = reader.getByRole("img", { name: "保存した検証画像", exact: true });
    await publicImage.scrollIntoViewIfNeeded();
    await expect(publicImage).toBeVisible();
    await expect.poll(() => publicImage.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
    expect((await anonymous.request.get(imageUrl)).status()).toBe(200);
    expect(await reader.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const readerCapture = testInfo.outputPath("published-reader.png");
    await reader.screenshot({ path: readerCapture, fullPage: true });
    await testInfo.attach("published-reader", { path: readerCapture, contentType: "image/png" });

    await setStatus(restored, "archived");
    expect((await reader.goto(fixture.publicPath))?.status()).toBe(404);
    const blockedImage = await anonymous.request.get(imageUrl);
    expect(blockedImage.status()).toBe(404);
    expect(blockedImage.headers()["cache-control"]).toContain("no-store");
    journeyCompleted = true;
  } finally {
    await restoredContext.close();
    await anonymous.close();
    try { fixture.cleanup(); } catch (error) {
      if (journeyCompleted) throw error;
      // Keep the primary browser assertion visible, while retaining cleanup failure evidence.
      await testInfo.attach("cleanup-error", { body: String(error), contentType: "text/plain" });
    }
  }
});
