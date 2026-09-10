/**
 * @tier 3
 * @req REQ-VIS03
 * @types scenario, state-transition, boundary
 */
import { expect, test } from "@playwright/test";
import { authenticateE2E } from "./auth-fixture";

test("表紙の登録が断られても、画像を選び直さず説明を直して再登録できる", async ({ context, page }, testInfo) => {
  await authenticateE2E(context);
  const articleId = testInfo.project.name === "mobile" ? "ba_seed_review_wait" : "ba_seed_draft";
  await page.goto(`/admin/blog/articles/${articleId}`);
  const form = page.locator('form[toolname="set_blog_article_thumbnail"]');
  const original = form.getByLabel("表紙にする絵");
  const submit = form.getByRole("button", { name: "この絵を表紙にする" });
  await expect(original).toBeVisible();

  // 実Canvasで作った800pxのPNGを、本物のfile inputへ選ぶ。変換/Server Actionは置換しない。
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 450;
    const drawing = canvas.getContext("2d")!;
    drawing.fillStyle = "#486574";
    drawing.fillRect(0, 0, 800, 450);
    drawing.fillStyle = "#dde8eb";
    drawing.fillRect(80, 80, 640, 290);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  await original.setInputFiles({ name: "retry-cover.png", mimeType: "image/png", buffer: Buffer.from(encoded, "base64") });
  await expect.poll(() => form.locator('input[name="derived-320"]').evaluate((node: HTMLInputElement) => node.files?.length ?? 0)).toBe(1);
  await expect.poll(() => form.locator('input[name="derived-640"]').evaluate((node: HTMLInputElement) => node.files?.length ?? 0)).toBe(1);
  const selectedFiles = await form.evaluate((node) => [...node.querySelectorAll<HTMLInputElement>('input[type="file"]')].map((input) => ({
    name: input.name,
    files: [...input.files ?? []].map((file) => ({ name: file.name, size: file.size })),
  })));
  await form.getByLabel("絵の説明").fill("");
  await submit.click();
  await expect(form.getByText(/絵の説明を入れてください/)).toBeVisible();

  const afterFailure = await form.evaluate((node) => ({
    files: [...node.querySelectorAll<HTMLInputElement>('input[type="file"]')].map((input) => ({
      name: input.name,
      files: [...input.files ?? []].map((file) => ({ name: file.name, size: file.size })),
    })),
    preview: node.querySelector('img[src^="blob:"]')?.getAttribute("src"),
  }));
  await testInfo.attach("failed-action-file-state", { body: JSON.stringify(afterFailure, null, 2), contentType: "application/json" });
  expect(afterFailure.files).toEqual(selectedFiles);

  // setInputFilesを繰り返さず、説明文だけを直して同じ原本・派生の束を再送する。
  await form.getByLabel("絵の説明").fill("青い背景に白い長方形を描いた表紙");
  await submit.click();
  await expect(form.getByText("表紙を登録しました。320 / 640 の幅で配ります。")).toBeVisible();
  await expect(page.getByRole("img", { name: "青い背景に白い長方形を描いた表紙" })).toBeVisible();
  await expect(page.getByRole("img", { name: "青い背景に白い長方形を描いた表紙" })).toHaveJSProperty("naturalWidth", 800);
  await expect(form.locator('img[src^="blob:"]')).toHaveCount(0);
  for (const name of ["original", "derived-320", "derived-640", "derived-1280"]) {
    await expect.poll(() => form.locator(`input[name="${name}"]`).evaluate((node: HTMLInputElement) => node.files?.length ?? 0)).toBe(0);
  }

  // テストの登録をローカルseedから外す。他の画面検査へ変更を持ち越さない。
  await page.getByRole("button", { name: "表紙を外す" }).click();
  await expect(page.getByText(/この記事にはまだ表紙がありません/)).toBeVisible();
});
