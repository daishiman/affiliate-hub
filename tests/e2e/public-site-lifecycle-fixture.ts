import type { SiteBlueprint } from "@/domain/authoring";
import { projectBlogArticle } from "@/application/read-models/published-article";
import { searchableTextOf } from "@/application/read-models/searchable-text";

export type PublicSiteLifecycleFixture = {
  readonly project: "desktop" | "mobile";
  readonly siteSlug: string;
  readonly nodeId: string;
  readonly blueprintId: string;
  readonly siteName: string;
  readonly articleId: string;
  readonly articleSlug: string;
  readonly articleTitle: string;
  readonly articleLead: string;
  readonly articleBlockHeading: string;
  readonly articleBlockBody: string;
  readonly fixedPageId: string;
  readonly fixedPageTitle: string;
  readonly fixedPageBody: string;
};

export const PUBLIC_SITE_LIFECYCLE_FIXTURES: readonly PublicSiteLifecycleFixture[] = [
  {
    project: "desktop",
    siteSlug: "e2e-public-lifecycle-desktop",
    nodeId: "sn_e2e_public_lifecycle_desktop",
    blueprintId: "sb_e2e_public_lifecycle_desktop",
    siteName: "E2E 公開ライフサイクル desktop",
    articleId: "ba_e2e_public_lifecycle_desktop",
    articleSlug: "same-article-after-restore",
    articleTitle: "E2E 公開記事 desktop",
    articleLead: "復元後も同じ記事を読めることを確かめます。",
    articleBlockHeading: "要点",
    articleBlockBody: "削除前と復元後で変わらない本文です。",
    fixedPageId: "lp_e2e_public_lifecycle_desktop",
    fixedPageTitle: "E2E 運営者情報 desktop",
    fixedPageBody: "E2E 固定ページ本文 desktop",
  },
  {
    project: "mobile",
    siteSlug: "e2e-public-lifecycle-mobile",
    nodeId: "sn_e2e_public_lifecycle_mobile",
    blueprintId: "sb_e2e_public_lifecycle_mobile",
    siteName: "E2E 公開ライフサイクル mobile",
    articleId: "ba_e2e_public_lifecycle_mobile",
    articleSlug: "same-article-after-restore",
    articleTitle: "E2E 公開記事 mobile",
    articleLead: "復元後も同じ記事を読めることを確かめます。",
    articleBlockHeading: "要点",
    articleBlockBody: "削除前と復元後で変わらない本文です。",
    fixedPageId: "lp_e2e_public_lifecycle_mobile",
    fixedPageTitle: "E2E 運営者情報 mobile",
    fixedPageBody: "E2E 固定ページ本文 mobile",
  },
] as const;

export function publicSiteLifecycleFixture(projectName: string): PublicSiteLifecycleFixture {
  const fixture = PUBLIC_SITE_LIFECYCLE_FIXTURES.find((candidate) => candidate.project === projectName);
  if (fixture === undefined) {
    throw new Error(`公開サイトのライフサイクル用seedが無いprojectです: ${projectName}`);
  }
  return fixture;
}

function q(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** desktop/mobile に別サイトを与え、状態変更の競合を防ぐ。 */
export function buildPublicSiteLifecycleSeedSql({
  workspaceId,
  baseBlueprint,
  parentSiteSlug,
  nowSeconds,
}: {
  readonly workspaceId: string;
  readonly baseBlueprint: SiteBlueprint;
  readonly parentSiteSlug: string;
  readonly nowSeconds: number;
}): readonly string[] {
  const out: string[] = [];
  for (const fixture of PUBLIC_SITE_LIFECYCLE_FIXTURES) {
    const blueprint: SiteBlueprint = {
      ...baseBlueprint,
      id: fixture.blueprintId as SiteBlueprint["id"],
      workspaceId: workspaceId as SiteBlueprint["workspaceId"],
      name: fixture.siteName,
    };
    /*
     * 読者に出す**写し**。`articles` に 'published' と書くだけでは出ない。
     *
     * `published_articles` は `articles` の参照ではなく写しで、読者側の解決は
     * この表しか見ない（`src/db/schema.ts`）。2026-09-05 まで、この fixture は
     * `articles` だけを書いていた。`/s/e2e-public-lifecycle-<project>/blog` に
     * 「E2E 公開記事」が出ず、`afterEach` の後片付け（`ensureActive`）が
     * 15 秒待って落ちていた。**本体の検査ではなく後片付けが落ちる**ので、
     * 「hidden・論理削除で 404 になる」という検査の中身は無関係だった。
     *
     * 同じ抜けが 2026-09-05 に 3 か所で見つかっている（見本・下書きの seed・
     * ここ）。**公開記事を作る SQL を手で書くと必ずこうなる。**写しは
     * `publishedArticleSaveStatements` という別の関数の仕事なので、
     * `INSERT INTO articles` を手書きした時点で片方だけになる。
     * 値は本番の公開経路と同じ `projectBlogArticle` から作り、手で組まない。
     */
    const projected = projectBlogArticle({
      id: fixture.articleId,
      siteSlug: fixture.siteSlug,
      slug: fixture.articleSlug,
      type: "ranking",
      title: fixture.articleTitle,
      lead: fixture.articleLead,
      authorName: "Playwright",
      publishedAt: new Date(nowSeconds * 1000),
      updatedAt: new Date(nowSeconds * 1000),
      categorySlug: baseBlueprint.categories[0]?.slug ?? "",
      blocks: [
        {
          id: `bb_${fixture.articleId}`,
          kind: "summary-section",
          heading: fixture.articleBlockHeading,
          body: fixture.articleBlockBody,
        },
      ],
    });
    out.push(
      `DELETE FROM blog_article_tag WHERE article_id = ${q(fixture.articleId)};`,
      `DELETE FROM blog_article_block WHERE article_id = ${q(fixture.articleId)};`,
      `DELETE FROM blog_article_rating WHERE article_id = ${q(fixture.articleId)};`,
      `DELETE FROM published_articles WHERE site_slug = ${q(fixture.siteSlug)} AND slug = ${q(fixture.articleSlug)};`,
      `DELETE FROM articles WHERE id = ${q(fixture.articleId)};`,
      `DELETE FROM legal_page WHERE id = ${q(fixture.fixedPageId)};`,
      `DELETE FROM site_network_node WHERE id = ${q(fixture.nodeId)};`,
      `DELETE FROM site_blueprints WHERE slug = ${q(fixture.siteSlug)};`,
      `INSERT INTO site_blueprints (id, workspace_id, slug, name, pattern, published_at, blueprint_json)
         VALUES (${q(fixture.blueprintId)}, ${q(workspaceId)}, ${q(fixture.siteSlug)}, ${q(fixture.siteName)}, ${q(baseBlueprint.pattern)}, ${nowSeconds}, ${q(JSON.stringify(blueprint))});`,
      `INSERT INTO site_network_node (id, workspace_id, site_slug, role, parent_slug, name, one_line, position, status, created_at, updated_at)
         VALUES (${q(fixture.nodeId)}, ${q(workspaceId)}, ${q(fixture.siteSlug)}, 'sub', ${q(parentSiteSlug)}, ${q(fixture.siteName)}, ${q("公開状態のE2E検証用。")}, 90, 'active', ${nowSeconds}, ${nowSeconds});`,
      `INSERT INTO articles (id, workspace_id, site_slug, slug, article_template, type, title, lead, status, author_name, published_at, created_at, updated_at)
         VALUES (${q(fixture.articleId)}, ${q(workspaceId)}, ${q(fixture.siteSlug)}, ${q(fixture.articleSlug)}, 'T1', 'ranking', ${q(fixture.articleTitle)}, ${q(fixture.articleLead)}, 'published', 'Playwright', ${nowSeconds}, ${nowSeconds}, ${nowSeconds});`,
      `INSERT INTO blog_article_block (id, workspace_id, article_id, kind, heading, body, position)
         VALUES (${q(`bb_${fixture.articleId}`)}, ${q(workspaceId)}, ${q(fixture.articleId)}, 'summary-section', ${q(fixture.articleBlockHeading)}, ${q(fixture.articleBlockBody)}, 0);`,
      `INSERT INTO published_articles (site_slug, slug, workspace_id, source_article_id, type, title, summary, category_slug, author_slug, author_name, published_at, updated_at, archived_at, article_json, search_text)
         VALUES (${q(projected.siteSlug)}, ${q(projected.slug)}, ${q(workspaceId)}, ${q(fixture.articleId)}, ${q(projected.type)}, ${q(projected.title)}, ${q(projected.summary)}, ${q(projected.categorySlug)}, ${q(projected.author.slug)}, ${q(projected.author.name)}, ${q(projected.publishedAt)}, ${q(projected.updatedAt)}, NULL, ${q(JSON.stringify(projected))}, ${q(searchableTextOf(projected))});`,
      `INSERT INTO legal_page (id, workspace_id, site_slug, kind, title, body, status, deleted_at, updated_at)
         VALUES (${q(fixture.fixedPageId)}, ${q(workspaceId)}, ${q(fixture.siteSlug)}, 'profile', ${q(fixture.fixedPageTitle)}, ${q(fixture.fixedPageBody)}, 'published', NULL, ${nowSeconds});`,
    );
  }
  return out;
}
