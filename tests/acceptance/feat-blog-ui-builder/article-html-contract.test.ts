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
const STRUCTURED_DATA = readFileSync(
  new URL("../../../src/presentation/site/article-structured-data.tsx", import.meta.url),
  "utf8",
);

/**
 * `<JsonLdScripts values={[...]}>` の値をすべて集める。
 *
 * nullable builder の条件分岐は `JsonLdScripts` が一括して担う。
 * 呼び出し側へ IIFE が戻ると経路が再び分かれるため、配列境界を直接見る。
 */
const JSON_LD_USAGES: readonly string[] = STRUCTURED_DATA.split("<JsonLdScripts")
  .slice(1)
  .map((tag) => tag.slice(0, tag.indexOf("/>") === -1 ? tag.length : tag.indexOf("/>")))
  .filter((body) => body.includes("values="));

/**
 * その組み立て関数の結果が JSON-LD として出ているか。
 *
 * builder は nullable を含む配列へ直に置く。そこで名前が見えれば、
 * `JsonLdScripts` が native script へ写すことは component test が保証する。
 */
function emittedAsJsonLd(builder: string): boolean {
  return JSON_LD_USAGES.some((body) => body.includes(`${builder}(`));
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
    expect(PAGE).toMatch(/<ArticleStructuredData\s+article=\{result\.value\}/);
    expect(STRUCTURED_DATA).toContain("buildBlogPosting(article, site)");
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
 * A10 のもう一方の入口——**だったところ**。
 *
 * 2026-08-30 の時点で、公開面には記事の入口が 2 系統あった。
 *   - `/best` `/guides` `/reviews` `/compare` → `article-page.tsx`（上で見た）
 *   - `/blog/<slug>` → `src/app/s/[site]/blog/[article]/page.tsx`
 * 前者は編集済みの読み取りモデル、後者は運用側の記事集約を通り、
 * **後者には canonical も OGP も JSON-LD も無かった**（実測: `ld+json` 0 件）。
 * 当時の手当ては、後者にも同じ 4 つを置くことだった。
 *
 * **2026-09-02 に、入口の数が 1 つに戻った。**`published_articles` が唯一の
 * 公開 projection になり、ブログ運用で書いた記事も種別に応じた正規 URL
 * （`/reviews/<slug>` など）で開くようになった。`/blog/<slug>` は 308 で
 * そこへ寄せるだけの旧入口である。
 *
 * だからここで見るものが裏返る。**この画面が構造化データを持たないこと**を
 * 見る。308 の応答は本文を返さず、読む側は必ず寄せた先を読む。ここに
 * JSON-LD や `generateMetadata` を置くと、誰も読まない題名のために記事を
 * 1 回余計に読み、題名の作り方を 2 か所に持つことになる（受入 A10 の中身は
 * 上の `article-page.tsx` の describe が持つ）。
 */
const BLOG_PAGE = readFileSync(
  new URL("../../../src/app/s/[site]/blog/[article]/page.tsx", import.meta.url),
  "utf8",
);

describe("A10 旧 `/blog/` の入口は、本文を描かず正規 URL へ寄せる", () => {
  it("読み込んだ画面の本文が空でない（テスト自身の前提）", () => {
    expect(BLOG_PAGE.length).toBeGreaterThan(200);
    expect(BLOG_PAGE).toContain("LegacyBlogArticlePage");
  });

  /**
   * 行き先を**この画面で組み立てない。**`/reviews/<slug>` のような道を
   * ここへ書くと、記事の種別が増えた日にこの 1 枚だけ古い写し方で残り、
   * 旧 URL から来た読者が消えた道へ 308 で送られる。
   */
  it("308 で寄せ、行き先は `articleHref` から引く", () => {
    expect(BLOG_PAGE).toContain("permanentRedirect(");
    expect(BLOG_PAGE).toContain("articleHref(found.value)");
  });

  /**
   * 無い記事を 308 で送ると、寄せた先で 404 になる。
   * 旧 URL の時点で無いと答える方が、読者にも検索側にも短い。
   */
  it("無い記事は寄せずに 404 で閉じる", () => {
    expect(BLOG_PAGE).toContain("notFound()");
  });

  /*
    見るのは**書き出しの宣言**であって、語の出現ではない。
    ただの `toContain("generateMetadata")` にすると、
    「ここに generateMetadata を残すな」と説明したコメント自身に当たって
    赤くなる——理由を書いた文章が検査を壊す形になってしまう。
  */
  it.each([
    [/<JsonLdScript/, "構造化データ"],
    [/export\s+(async\s+function|const)\s+generateMetadata\b/, "題名と canonical"],
  ])("%s を持たない（%s は寄せた先が持つ）", (marker) => {
    expect(BLOG_PAGE).not.toMatch(marker);
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
