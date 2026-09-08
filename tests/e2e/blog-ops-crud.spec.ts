/**
 * ブログ運用の CRUD を、**実際に走っているサーバーへ実際に押して**確かめる。
 *
 * --- なぜこの 1 本が要るのか ---
 *
 * 単体テストは差し替えた保存先で通る。`vitest` が緑でも、
 * 「Server Action が本当に呼ばれるか」「断りが画面に出るか」は分からない。
 * 実際、この 1 本を書いたときに **6 つのフォーム全部が、欄に紐づく断りを
 * 画面のどこにも出していなかった**（`FormResult` は `field` 付きを出さない約束で、
 * 欄の側が出すことになっているのに、欄へ配線されていなかった）。
 * 単体テストはユースケースが断ったことしか見ていないので、素通りしていた。
 *
 * 手で `curl` を叩く確かめ方はこの代わりにならない。記録に残らず、
 * 次の人が同じ手順を踏めず、壊れても誰も気付かない。
 *
 * --- 確かめる順序 ---
 *
 * 1. 作れること（下書きとして作られること）
 * 2. **断れること**（同じ住所・題名なし・部品欠けの公開・理由なしの削除）
 * 3. 読者側に下書きが出ないこと
 * 4. 読者が点を付けられること
 *
 * 2 を 1 より重く見ている。作れることは画面を開けば分かるが、
 * 断れることは押してみないと分からない。
 */
import { expect, test } from "@playwright/test";
import { SEED_ARTICLE_SLUGS, SEED_HUB_SLUG } from "../../scripts/seed/local-seed-data";
import { authenticateE2E } from "./auth-fixture";

/*
 * 見本データの値は**書き写さない**。seed の側から取る。
 * 2026-08-26 まで 3 つとも手書きで、seed が記事の URL 名を変えた日に
 * この spec だけが 404 を踏む形になっていた。
 */
const SITE = SEED_HUB_SLUG;
/** 見本データにある下書き。読者側に出てはいけない。 */
const DRAFT_SLUG = SEED_ARTICLE_SLUGS.draft;
/** 見本データにある公開済み。読者側に出て、点を付けられる。 */
const PUBLISHED_SLUG = SEED_ARTICLE_SLUGS.published;

/**
 * この走行だけの住所。走るたびに違う値にする。
 *
 * 固定値にすると、2 回目の走行で「同じ住所に 2 本目」に当たって
 * 1 本目の検査が落ちる。落ちた理由が「作れない」なのか
 * 「前回の走行が残っている」なのか、落ちたログからは区別できない。
 */
function freshSlug(tag: string): string {
  return `e2e-${tag}-${Date.now().toString(36)}`;
}

/**
 * その住所の記事に付ける題名。**題名も走行ごとに変える。**
 *
 * 住所だけを変えて題名を固定にすると、一覧から題名で選ぶところが
 * 「同じ名前のリンクが 2 本」に当たって落ちる。2026-08-26 に実測:
 * 画面の大きさ 2 通り（desktop / mobile）が同じ保存先を共有しているので、
 * 先に走った側が残した記事と、後から走った側が作った記事が並ぶ。
 * 落ちた理由は「作れない」ではなく「前の走行が残っている」だが、
 * 落ちたログからは区別できない。
 */
function freshTitle(label: string, slug: string): string {
  return `${label}（${slug}）`;
}

test.beforeEach(async ({ context }) => {
  await authenticateE2E(context);
});

test.describe("管理側: 記事の CRUD", () => {
  test("下書きを作れて、一覧に出る", async ({ page }) => {
    const slug = freshSlug("create");
    await page.goto("/admin/blog/articles/new");

    await page.getByLabel("どのブログに置くか").selectOption(SITE);
    await page.getByLabel("記事の住所").fill(slug);
    const title = freshTitle("E2E で作った記事", slug);
    await page.getByLabel("見出し", { exact: true }).fill(title);
    await page.getByRole("button", { name: "下書きを作る" }).click();

    await expect(page.getByText(/下書きを作りました/)).toBeVisible();

    await page.goto(`/admin/blog/articles?site=${SITE}`);
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });

  test("同じ住所に 2 本目は断られ、断りが画面に出る", async ({ page }) => {
    const slug = freshSlug("dup");

    for (const nth of [1, 2]) {
      await page.goto("/admin/blog/articles/new");
      await page.getByLabel("どのブログに置くか").selectOption(SITE);
      await page.getByLabel("記事の住所").fill(slug);
      await page.getByLabel("見出し", { exact: true }).fill(freshTitle(`重複の確認 ${nth} 本目`, slug));
      await page.getByRole("button", { name: "下書きを作る" }).click();

      if (nth === 1) {
        await expect(page.getByText(/下書きを作りました/)).toBeVisible();
      } else {
        // 断りが**画面に出る**ことまで見る。断ったことだけなら単体で足りる。
        await expect(page.getByText(new RegExp(`「${slug}」はこのブログに既にあります`))).toBeVisible();
      }
    }
  });

  test("題名が空だと断られ、断りが画面に出る", async ({ page }) => {
    await page.goto("/admin/blog/articles/new");
    await page.getByLabel("どのブログに置くか").selectOption(SITE);
    await page.getByLabel("記事の住所").fill(freshSlug("notitle"));
    await page.getByRole("button", { name: "下書きを作る" }).click();

    await expect(page.getByText("記事の題名を入れてください。")).toBeVisible();
  });

  test("部品が足りないまま公開にはできず、理由が画面に出る", async ({ page }) => {
    const slug = freshSlug("publish");
    await page.goto("/admin/blog/articles/new");
    await page.getByLabel("どのブログに置くか").selectOption(SITE);
    await page.getByLabel("記事の住所").fill(slug);
    const title = freshTitle("公開を断られる記事", slug);
    await page.getByLabel("見出し", { exact: true }).fill(title);
    await page.getByRole("button", { name: "下書きを作る" }).click();
    await expect(page.getByText(/下書きを作りました/)).toBeVisible();

    await page.goto(`/admin/blog/articles?site=${SITE}`);
    await page.getByRole("link", { name: title }).click();

    await expect(page.getByText("公開に必要な部品が足りません")).toBeVisible();
    await page.getByLabel("公開状態").selectOption("published");
    await page.getByRole("button", { name: "記事を保存" }).click();

    await expect(page.getByText(/揃うまで公開にはできません/)).toBeVisible();
  });

  test("理由と復元可能性の確認が揃うまで消せず、揃えば消える", async ({ page }) => {
    const slug = freshSlug("delete");
    await page.goto("/admin/blog/articles/new");
    await page.getByLabel("どのブログに置くか").selectOption(SITE);
    await page.getByLabel("記事の住所").fill(slug);
    const title = freshTitle("消される記事", slug);
    await page.getByLabel("見出し", { exact: true }).fill(title);
    await page.getByRole("button", { name: "下書きを作る" }).click();
    await expect(page.getByText(/下書きを作りました/)).toBeVisible();

    await page.goto(`/admin/blog/articles?site=${SITE}`);
    await page.getByRole("link", { name: title }).click();

    const deleteButton = page.getByRole("button", {
      name: `記事「${title}」 を削除する`,
    });
    await expect(deleteButton).toBeDisabled();
    await page.getByLabel("なぜ削除するのか").fill("E2E の後片付け");
    await expect(deleteButton).toBeDisabled();
    await page.getByRole("checkbox", { name: /削除済み一覧から同じ URL へ戻せること/ }).check();
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();
    await expect(page.getByText(`「${title}」を消しました。`)).toBeVisible();

    await page.goto(`/admin/blog/articles?site=${SITE}`);
    await expect(page.getByRole("link", { name: title })).toHaveCount(0);
  });
});

test.describe("読者側", () => {
  test("下書きは一覧にも記事の場所にも出ない", async ({ page }) => {
    await page.goto(`/s/${SITE}/blog`);
    await expect(page.getByRole("link", { name: /4K/ })).toHaveCount(0);

    const response = await page.goto(`/s/${SITE}/blog/${DRAFT_SLUG}`);
    expect(response?.status()).toBe(404);
  });

  test("公開済みの記事は読めて、点を付けられる", async ({ page }) => {
    await page.goto(`/s/${SITE}/blog/${PUBLISHED_SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByLabel("この記事は役に立ちましたか").selectOption("5");
    await page.getByRole("button", { name: "送る" }).click();

    await expect(page.getByText("ありがとうございました。")).toBeVisible();
    await expect(page.getByText(/いまの評価: /)).toBeVisible();
  });

  test("点を選ばずに送ると断られる", async ({ page }) => {
    await page.goto(`/s/${SITE}/blog/${PUBLISHED_SLUG}`);
    await page.getByRole("button", { name: "送る" }).click();
    await expect(page.getByText("点数を選んでください。")).toBeVisible();
  });
});
