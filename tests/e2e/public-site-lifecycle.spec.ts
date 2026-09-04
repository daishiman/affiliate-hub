/**
 * @req REQ-BOPS01, REQ-BOPS06, REQ-BOPS11
 *
 * 管理画面で公開状態を変え、読者の実HTTPと実ブラウザが同じ答えになることを確かめる。
 * desktop/mobile は別のseedサイトを使い、片方のhidden/削除がもう片方を404にしない。
 */
import { expect, test, type Page } from "@playwright/test";
import { authenticateE2E } from "./auth-fixture";
import {
  publicSiteLifecycleFixture,
  type PublicSiteLifecycleFixture,
} from "./public-site-lifecycle-fixture";

// 4公開URLを5状態で実際に遷移するため、単一画面用の共通45秒より長くなる。
test.setTimeout(90_000);

const PUBLIC_STATE_RETRY = {
  timeout: 15_000,
  intervals: [100, 250, 500, 1_000],
};

type PublicTarget = {
  readonly path: string;
  readonly visibleTexts: readonly string[];
  readonly links?: readonly { readonly name: string; readonly href: string }[];
};

function publicTargets(fixture: PublicSiteLifecycleFixture): readonly PublicTarget[] {
  const root = `/s/${fixture.siteSlug}`;
  return [
    { path: root, visibleTexts: [fixture.siteName] },
    { path: `${root}/blog`, visibleTexts: [fixture.articleTitle] },
    {
      path: `${root}/blog/${fixture.articleSlug}`,
      visibleTexts: [
        fixture.articleTitle,
        fixture.articleLead,
        fixture.articleBlockHeading,
        fixture.articleBlockBody,
      ],
      links: [{ name: "記事一覧", href: `${root}/blog` }],
    },
    {
      path: `${root}/profile`,
      visibleTexts: [fixture.fixedPageTitle, fixture.fixedPageBody],
    },
  ];
}

async function expectAvailable(
  page: Page,
  fixture: PublicSiteLifecycleFixture,
): Promise<void> {
  for (const target of publicTargets(fixture)) {
    await expect(async () => {
      const navigation = await page.goto(target.path, { waitUntil: "domcontentloaded" });
      expect(navigation?.status(), `HTTP/browser ${target.path}`).toBe(200);
      for (const text of target.visibleTexts) {
        await expect(
          page.getByText(text, { exact: true }).first(),
          `browser content ${target.path}: ${text}`,
        ).toBeVisible({ timeout: 1_000 });
      }
      for (const link of target.links ?? []) {
        await expect(page.getByRole("link", { name: link.name })).toHaveAttribute(
          "href",
          link.href,
        );
      }
    }).toPass(PUBLIC_STATE_RETRY);
  }
}

async function expectNotFound(
  page: Page,
  fixture: PublicSiteLifecycleFixture,
): Promise<void> {
  for (const target of publicTargets(fixture)) {
    await expect(async () => {
      const navigation = await page.goto(target.path, { waitUntil: "domcontentloaded" });
      expect(navigation?.status(), `HTTP/browser ${target.path}`).toBe(404);
      await expect(
        page.getByRole("heading", { name: "このページは見つかりませんでした" }),
        `browser not-found ${target.path}`,
      ).toBeVisible({ timeout: 1_000 });
    }).toPass(PUBLIC_STATE_RETRY);
  }
}

/**
 * 途中のassertで止まっても、次のspecへhidden/deleted状態を持ち越さない。
 * 管理画面とServer Actionを通すため、後処理も利用者と同じ境界を検査する。
 */
async function ensureActive(page: Page, fixture: PublicSiteLifecycleFixture): Promise<void> {
  await page.goto("/admin/site-network/deleted");
  const restoreButton = page.getByRole("button", {
    name: `「${fixture.siteName}」を同じ URL で戻す`,
  });
  if ((await restoreButton.count()) > 0) {
    await restoreButton.click();
  }

  await page.goto(`/admin/site-network/${fixture.nodeId}`);
  const status = page.getByLabel("公開状態");
  if ((await status.count()) > 0 && (await status.inputValue()) !== "active") {
    await status.selectOption("active");
    await page.getByRole("button", { name: "直す" }).click();
    await page.getByText("status を直しました。").waitFor();
  }

  // Server Actionのpending表示で元のボタン名が消えても、復元完了とは限らない。
  // 後処理も公開URLの事後条件まで待ち、retryへ404を持ち越さない。
  await expectAvailable(page, fixture);
}

test.beforeEach(async ({ context }) => {
  await authenticateE2E(context);
});

test.afterEach(async ({ page }, testInfo) => {
  await ensureActive(page, publicSiteLifecycleFixture(testInfo.project.name));
});

test("公開サイトはhidden・論理削除で404になり、同じURL・内容へ戻る", async ({ page }, testInfo) => {
  const fixture = publicSiteLifecycleFixture(testInfo.project.name);

  await expectAvailable(page, fixture);

  await page.goto(`/admin/site-network/${fixture.nodeId}`);
  await page.getByLabel("公開状態").selectOption("hidden");
  await page.getByRole("button", { name: "直す" }).click();
  await expect(page.getByText("status を直しました。")).toBeVisible();
  await expectNotFound(page, fixture);

  await page.goto(`/admin/site-network/${fixture.nodeId}`);
  await page.getByLabel("公開状態").selectOption("active");
  await page.getByRole("button", { name: "直す" }).click();
  await expect(page.getByText("status を直しました。")).toBeVisible();
  await expectAvailable(page, fixture);

  await page.goto(`/admin/site-network/${fixture.nodeId}`);
  await page.getByLabel("なぜつながりから外すのか").fill("E2E で公開停止と復元を確かめるため");
  await page.getByRole("checkbox", { name: /配下が無いこと/ }).check();
  await page.getByRole("button", { name: new RegExp(`${fixture.siteName}.*つながりから外す`) }).click();
  await expect(page.getByText("このつながりはありません")).toBeVisible();
  await expectNotFound(page, fixture);

  await page.goto("/admin/site-network/deleted");
  const restoreButton = page.getByRole("button", {
    name: `「${fixture.siteName}」を同じ URL で戻す`,
  });
  await restoreButton.click();
  await expectAvailable(page, fixture);
});
