/**
 * @tier 1
 * @req REQ-TS09
 * @types code-boundary
 *
 * D1/live の読者向け一覧は、D1 に保存された公開記事だけを返す。
 * sample repository を混ぜると、一覧に出たURLを別readerで開いたとき
 * 404になるため、adapter境界でimport自体を禁止する。
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_PATH = "src/infrastructure/persistence/d1/published-article-repository.ts";
const source = readFileSync(join(process.cwd(), SOURCE_PATH), "utf8");
const blogOpsSource = readFileSync(
  join(process.cwd(), "src/infrastructure/persistence/d1/blog-ops-repository.ts"),
  "utf8",
);
const publicBlogAdapter = blogOpsSource.slice(
  blogOpsSource.indexOf("export function createD1PublicBlogPort"),
);
const blogIndexSource = readFileSync(
  join(process.cwd(), "src/app/s/[site]/blog/page.tsx"),
  "utf8",
);
const legacyDetailSource = readFileSync(
  join(process.cwd(), "src/app/s/[site]/blog/[article]/page.tsx"),
  "utf8",
);
const topBandsSource = readFileSync(
  join(process.cwd(), "src/presentation/site/blog-top-bands.tsx"),
  "utf8",
);
const homeContentSource = readFileSync(
  join(process.cwd(), "src/presentation/site/home-content.tsx"),
  "utf8",
);
const siteViewModelSource = readFileSync(
  join(process.cwd(), "src/presentation/site/view-model.ts"),
  "utf8",
);
describe("公開済み記事 reader の live/sample 境界", () => {
  it("D1 adapter が sample repository を import・fallbackしない", () => {
    expect(source).not.toMatch(/from\s+["'][^"']*\/sample\//);
    expect(source).not.toContain("createSampleContentRepository");
    expect(source).not.toContain("samples.");
    expect(source).not.toContain("mergeBySlug");
  });

  it("カテゴリ・書き手の SQL 条件はそれぞれの reader に残す", () => {
    expect(source).toContain("eq(publishedArticles.categorySlug, categorySlug)");
    // 検索の記号・公開条件はD1実行テストで確認する。SQL文字列の写しは保持しない。
    expect(source).toContain("eq(publishedArticles.authorSlug, personSlug)");
  });

  it("PublicBlog は編集 aggregate を公開用に直読みせず canonical reader へ委譲する", () => {
    expect(publicBlogAdapter).not.toContain(".from(blogArticles)");
    expect(publicBlogAdapter).toContain("publishedContent.findArticle");
    expect(publicBlogAdapter).toContain("publishedContent.listRecent");
  });

  it("公開一覧と canonical home だけが articleHref 経由で記事 URL を持つ", () => {
    // 公開一覧は共通の一覧へ委譲し、記事URLを直接組み立てない。
    expect(blogIndexSource).toContain("ArticleIndexPage");
    const indexSource = readFileSync(join(process.cwd(), "src/presentation/site/article-index-page.tsx"), "utf8");
    expect(indexSource).toContain("toArticleCards(");
    expect(blogIndexSource).not.toContain("`/blog/${a.slug}`");

    /*
      トップは `toSiteHomeView` から共通の記事カード変換へ渡し、
      その変換が `articleHref` を使う。トップで slug から直接
      URL を作ると、記事種別ごとの正規経路とずれる。
    */
    expect(homeContentSource).toContain("recentArticles: toArticleCards(siteSlug, ordered");
    expect(siteViewModelSource).toContain(
      "href: siteHref(siteSlug, articleHref(summary))",
    );

    // 旧の新着帯は canonical 記事区画と重複するため、URL を再所有しない。
    expect(topBandsSource).not.toContain("articleHref");
    expect(topBandsSource).not.toContain("projection.articles");
    expect(topBandsSource).not.toContain("`/blog/${a.slug}`");
  });

  it("過去の /blog/:slug は同じ公開projectionからcanonical URLへ308にする", () => {
    expect(legacyDetailSource).toContain("permanentRedirect");
    expect(legacyDetailSource).toContain("articleHref(");
    expect(legacyDetailSource).not.toContain("BlogArticleView");
  });

  it("公開projectionの直接writerは共有statement builderの1ファイルだけ", () => {
    const d1Dir = join(process.cwd(), "src/infrastructure/persistence/d1");
    const writers = readdirSync(d1Dir)
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => {
        const body = readFileSync(join(d1Dir, file), "utf8");
        return /\.(insert|update|delete)\(publishedArticles\)/.test(body);
      })
      .map((file) => `src/infrastructure/persistence/d1/${file}`);
    expect(writers).toEqual([SOURCE_PATH]);
    expect(blogOpsSource).not.toMatch(/\.(insert|update|delete)\(publishedArticles\)/);
  });

  // sourceの隔離はd1-published-article.test.tsで実D1のlist/find/replace/archiveを
  // 直接実行して検証する。述語の出現回数は、CAS不一致の存在照会など安全な変更でも
  // 増えるため、隔離が守られることの証明には使わない。
});
