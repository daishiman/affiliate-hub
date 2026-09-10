/**
 * @req REQ-BOPS01, REQ-BOPS06, REQ-BOPS11
 *
 * 管理画面で公開状態を変え、読者の実HTTPと実ブラウザが同じ答えになることを確かめる。
 * desktop/mobile は別のseedサイトを使い、片方のhidden/削除がもう片方を404にしない。
 */
import { expect, test, type Page } from "@playwright/test";
import { articleIndexRoute } from "@/domain/authoring";
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

/**
 * 順位記事の索引の名札。**ルート表から引く。**
 *
 * seed の記事は `type: 'ranking'`（`public-site-lifecycle-fixture.ts`）なので、
 * 親は必ずこの 1 本になる。ここに「おすすめ順位」と書き写すと、
 * 画面の言葉を変えた日に検査だけが古い言葉を要求して落ちる。
 */
const RANKING_INDEX_LABEL = articleIndexRoute("ranking").label;

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
      /*
        記事タイプの索引（残課題 ah-milz で作った行き先）。
        seed の記事は `type: 'ranking'` なので親は `/best` になる。

        **記事の親を、記事とは別の URL として開いて確かめる。**
        パンくずのリンクだけを見ていると、`href` は正しいのに押した先が
        404、という状態を通してしまう。実際 2026-09-05 まで `/best` には
        画面が無く、根の動的ルート `/{fixedPage}` が受けていた。
      */
      path: `${root}/best`,
      visibleTexts: [RANKING_INDEX_LABEL, fixture.articleTitle],
      links: [{ name: fixture.siteName, href: root }],
    },
    {
      /*
        旧入口。ここは 308 で種類ごとの正名（ranking なら `/best/<slug>`）へ寄る。
        寄せた先で本文が読めることまで含めて、この 1 つの URL で確かめる。

        パンくずは三段（ブログ名 › おすすめ順位 › 記事名）で、
        **真ん中も押せる**（2026-09-05・残課題 ah-milz）。それまで真ん中は
        行き先の無い文字で、押せると思って押す読者を受け止める先が無かった。

        名札は `articleIndexRoute` から引く。ここに「おすすめ順位」と
        書き写すと、画面の言葉を変えた日に検査だけが古い言葉を要求する。
      */
      path: `${root}/blog/${fixture.articleSlug}`,
      visibleTexts: [
        fixture.articleTitle,
        fixture.articleLead,
        fixture.articleBlockHeading,
        fixture.articleBlockBody,
      ],
      links: [
        { name: fixture.siteName, href: root },
        { name: RANKING_INDEX_LABEL, href: `${root}/best` },
      ],
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
        // ブログ名は header・パンくず・footer の 3 か所に出る。
        // 見張りたいのは「現在の場所から上へ戻れるか」なので、パンくずに絞る。
        await expect(
          page.getByRole("navigation", { name: "現在の場所" }).getByRole("link", {
            name: link.name,
          }),
          `breadcrumb link ${target.path}: ${link.name}`,
        ).toHaveAttribute("href", link.href);
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
