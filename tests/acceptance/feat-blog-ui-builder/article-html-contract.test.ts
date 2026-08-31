/**
 * @tier 2
 * @req REQ-SEO01, A10, A12
 * @types contract, regression
 *
 * feat-blog-ui-builder の受入 A10:
 * 「記事 HTML にメタ情報と JSON-LD が入る」
 *
 * ## この 1 本を足した理由（`design-review.md` R5-1）
 *
 * `buildBlogPosting` / `buildFaqPage` / `buildItemList` /
 * `buildBreadcrumbList` は純関数として**十分に検査されている**
 * （`tests/application/seo/structured-data.test.ts`、
 *  `tests/application/seo/expression-blocks.test.ts`）。
 *
 * ところが、**それが画面に置かれているかを見る検査はどこにも無い**。
 * `article-page.tsx` から `<script type="application/ld+json">` を
 * 4 つとも消しても、9885 本のテストは 1 本も赤くならない。
 * 実測で確認した（`ld+json` を含む検査は tests/ 配下に 0 件）。
 *
 * これはこの feature が生まれた失敗そのものである——
 * 正しい部品を作って、繋ぎ忘れる。
 *
 * ## なぜ描画ではなく本文を読むのか
 *
 * `ArticlePage` は async server component で、`next/headers` と
 * 合成器（DB 経路）に依存する。ここで丸ごと模造すると、
 * 検査しているのが「画面」ではなく「模造の出来」になる。
 *
 * 本リポジトリには同じ判断の先例がある——
 * `tests/ui/ui-layers.test.ts` は同じ `article-page.tsx` の本文から
 * `rel="sponsored"` の在否を見ている。その慣習に揃える。
 *
 * **実描画での確認は P09 の e2e が持つ。** ここはその前段で、
 * 「繋ぎが外れていない」ことだけを止める。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE = readFileSync(
  new URL("../../../src/presentation/site/article-page.tsx", import.meta.url),
  "utf8",
);

/**
 * `<JsonLdScript value={...}>` の値をすべて集める。
 *
 * 組み立て関数は 2 通りの置かれ方をしている。
 *   - script タグの中で直に呼ぶ（`buildBlogPosting`）
 *   - 先に変数へ束ねてから埋める（`buildItemList` → `itemList`）
 * 後者は「null なら出さない」の判断が要るためで、正当な書き方である。
 * だから「タグの中に関数名がある」では見られない。
 */
const JSON_LD_USAGES: readonly string[] = PAGE.split("<JsonLdScript")
  .slice(1)
  .map((tag) => tag.slice(0, tag.indexOf("/>") === -1 ? tag.length : tag.indexOf("/>")))
  .filter((body) => body.includes("value="));

/**
 * その組み立て関数の結果が JSON-LD として出ているか。
 *
 * 直呼びなら関数名がタグ内にある。変数経由なら、その代入先の名前が
 * `serializeJsonLd(<名前>)` としてタグ内にある。両方を見る。
 */
function emittedAsJsonLd(builder: string): boolean {
  if (JSON_LD_USAGES.some((body) => body.includes(builder))) return true;
  const bound = PAGE.match(new RegExp(`const\\s+(\\w+)\\s*=\\s*${builder}\\(`));
  if (bound === null) return false;
  return JSON_LD_USAGES.some((body) => body.includes(`value={${bound[1]}}`));
}

describe("A10 記事 HTML の構造化データ", () => {
  it("読み込んだ画面の本文が空でない（テスト自身の前提）", () => {
    expect(PAGE.length).toBeGreaterThan(1000);
    expect(PAGE).toContain("ArticlePage");
  });

  /**
   * T-A10-4 — 🟢 現状は緑。**外したら赤くする**ための 1 本。
   *
   * 4 つを個別に見る。まとめて `toContain("ld+json")` にすると、
   * 1 つ残っていれば他の 3 つが消えても緑のまま通る。
   */
  it.each([
    ["buildBlogPosting", "記事そのもの（A10 の本体）"],
    ["buildBreadcrumbList", "現在地。検索結果のパンくず表示に効く"],
    ["buildItemList", "順位記事の順位表"],
    ["buildFaqPage", "FAQ ブロック"],
  ])("T-A10-4 %s が JSON-LD として画面に置かれている（%s）", (builder) => {
    expect(emittedAsJsonLd(builder), `${builder} が ld+json の外にある／消えている`).toBe(true);
  });

  /**
   * T-A10-5 — 構造化データは**本文と同じ 1 つの読み取りモデル**から作る。
   *
   * `result.value` を渡さずに画面用の射影（`article`）から作り直すと、
   * 表示の都合で丸めた値が構造化データへ流れる。
   * ここが崩れると、読者に見える出典と検索エンジンへ渡す出典が食い違う。
   */
  it("T-A10-5 構造化データは読み取りモデルから直接作る", () => {
    expect(PAGE).toContain("buildBlogPosting(result.value");
    expect(PAGE).not.toMatch(/buildBlogPosting\(\s*article\b/);
  });

  /**
   * 絶対 URL の origin は届いたリクエストの Host から作る。
   *
   * 環境変数へ固定すると、開発と本番で構造化データの URL がずれたまま配られる。
   * 「Host が読めないときは相対 URL」も併せて固定する——
   * 嘘の絶対 URL を出すより、origin を空にするほうが害が小さい。
   */
  it("T-A10-5b origin を環境変数へ固定していない", () => {
    expect(PAGE).toContain("requestOriginFromNextHeaders()");
    expect(PAGE).not.toContain("x-forwarded-host");
    expect(PAGE).not.toMatch(/process\.env\.[A-Z_]*(ORIGIN|SITE_URL|BASE_URL)/);
  });
});

/**
 * A10 のもう一方の入口。
 *
 * 公開面には記事の入口が **2 系統**ある。
 *   - `/best` `/guides` `/reviews` `/compare` → `article-page.tsx`（上で見た）
 *   - `/blog/<slug>` → `src/app/s/[site]/blog/[article]/page.tsx`
 *
 * 前者は編集済みの読み取りモデル、後者は運用側の記事集約を通る。
 * 2026-08-30 まで**後者には canonical も OGP も JSON-LD も無かった**
 * （実測: `curl` の応答に `ld+json` が 0 件）。同じ受入 A10 の対象なのに、
 * 上の検査は前者のファイルしか読んでいないので気づけなかった。
 *
 * 「同じ画面に見えるものが同じ経路とは限らない」——入口ごとに見る。
 */
const BLOG_PAGE = readFileSync(
  new URL("../../../src/app/s/[site]/blog/[article]/page.tsx", import.meta.url),
  "utf8",
);

describe("A10 ブログ運用で書いた記事の構造化データ", () => {
  it("読み込んだ画面の本文が空でない（テスト自身の前提）", () => {
    expect(BLOG_PAGE.length).toBeGreaterThan(1000);
    expect(BLOG_PAGE).toContain("BlogArticlePage");
  });

  it.each([
    ["buildBlogOpsPosting", "記事そのもの"],
    ["buildBreadcrumbList", "現在地"],
  ])("%s が JSON-LD として画面に置かれている（%s）", (builder) => {
    const tags = BLOG_PAGE.split("<JsonLdScript")
      .slice(1)
      .filter((body) => body.includes("value="));
    expect(
      tags.some((body) => body.includes(builder)),
      `${builder} が ld+json の外にある／消えている`,
    ).toBe(true);
  });

  /**
   * canonical と OGP は `generateMetadata` からしか出せない。
   * 無いと、この経路の記事だけ検索結果と SNS で無題のまま扱われる。
   */
  it("generateMetadata を持ち、記事ごとの metadata を作る", () => {
    expect(BLOG_PAGE).toMatch(/export\s+async\s+function\s+generateMetadata/);
    expect(BLOG_PAGE).toContain("blogArticleMetadata(site, article)");
  });

  it("origin を環境変数へ固定していない", () => {
    expect(BLOG_PAGE).toContain("requestOriginFromNextHeaders()");
    expect(BLOG_PAGE).not.toContain("x-forwarded-host");
    expect(BLOG_PAGE).not.toMatch(/process\.env\.[A-Z_]*(ORIGIN|SITE_URL|BASE_URL)/);
  });

  /**
   * 構造化データは**本文と同じ記事集約**から作る。
   * 画面用に別途読み直すと、読者に見える更新日と `dateModified` がずれる。
   */
  it("構造化データは画面と同じ記事集約から作る", () => {
    expect(BLOG_PAGE).toContain("article: detail.article");
    expect(BLOG_PAGE).toContain("blocks: detail.blocks");
  });
});

/**
 * A12 —「最終更新日が可視で出て、JSON-LD の `dateModified` と一致する」。
 *
 * この一致は既に緑である（`expression-blocks.test.ts:261` が
 * `dateModified: view.updatedAt` を固定している）。
 * `test-design.md` §1 は A12 を 🔴 と書いたが、**実測では 🟢** だった。
 * 対応表の訂正は P13 の書き戻しへ回す（本 phase の scope_out）。
 *
 * ここで足すのは、その一致が**画面まで届いているか**の 1 本だけ。
 */
describe("A12 最終更新日の 2 経路", () => {
  it("T-A12-2 画面が最終更新日を独自に組み立て直していない", () => {
    // updatedAt を画面側で加工すると、可視の日付と dateModified がずれる。
    // 画面は view-model の値をそのまま渡すだけでなければならない。
    expect(PAGE).not.toMatch(/dateModified/);
  });
});
