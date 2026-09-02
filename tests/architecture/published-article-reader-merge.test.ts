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
const adminSource = source.slice(
  source.indexOf("export function createD1PublishedArticleAdminRepository"),
);
describe("公開済み記事 reader の live/sample 境界", () => {
  it("D1 adapter が sample repository を import・fallbackしない", () => {
    expect(source).not.toMatch(/from\s+["'][^"']*\/sample\//);
    expect(source).not.toContain("createSampleContentRepository");
    expect(source).not.toContain("samples.");
    expect(source).not.toContain("mergeBySlug");
  });

  it("カテゴリ・検索・書き手の SQL 条件はそれぞれの reader に残す", () => {
    expect(source).toContain("eq(publishedArticles.categorySlug, categorySlug)");
    expect(source).toContain("like(publishedArticles.title, `%${trimmed}%`)");
    expect(source).toContain("like(publishedArticles.summary, `%${trimmed}%`)");
    expect(source).toContain("eq(publishedArticles.authorSlug, personSlug)");
  });

  it("PublicBlog は編集 aggregate を公開用に直読みせず canonical reader へ委譲する", () => {
    expect(publicBlogAdapter).not.toContain(".from(blogArticles)");
    expect(publicBlogAdapter).toContain("publishedContent.findArticle");
    expect(publicBlogAdapter).toContain("publishedContent.listRecent");
  });

  it("公開一覧・トップ帯は articleHref を唯一の URL 組み立てに使う", () => {
    expect(blogIndexSource).toContain("articleHref(a)");
    expect(topBandsSource).toContain("articleHref(a)");
    expect(blogIndexSource).not.toContain("`/blog/${a.slug}`");
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

  it("AI公開の管理口はBlogOps由来projectionを一覧・訂正・archive対象にしない", () => {
    expect(
      adminSource.match(/isNull\(publishedArticles\.sourceArticleId\)/g),
    ).toHaveLength(4);
  });
});
