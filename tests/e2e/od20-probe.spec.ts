import { expect, test } from "@playwright/test";
import { authenticateE2E } from "./auth-fixture";

test("probe admin/blog/articles 404", async ({ context, page }) => {
  await authenticateE2E(context);
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    failures.push(`FAILED ${request.url()} ${request.failure()?.errorText ?? ""}`);
  });
  await page.goto("/admin/blog/articles", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  console.log(`PROBE404 ${JSON.stringify(failures, null, 2)}`);
  expect(true).toBe(true);
});
