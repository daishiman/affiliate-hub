import type { SiteBlueprint } from "@/domain/authoring";

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
    out.push(
      `DELETE FROM blog_article_tag WHERE article_id = ${q(fixture.articleId)};`,
      `DELETE FROM blog_article_block WHERE article_id = ${q(fixture.articleId)};`,
      `DELETE FROM blog_article_rating WHERE article_id = ${q(fixture.articleId)};`,
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
      `INSERT INTO legal_page (id, workspace_id, site_slug, kind, title, body, status, deleted_at, updated_at)
         VALUES (${q(fixture.fixedPageId)}, ${q(workspaceId)}, ${q(fixture.siteSlug)}, 'profile', ${q(fixture.fixedPageTitle)}, ${q(fixture.fixedPageBody)}, 'published', NULL, ${nowSeconds});`,
    );
  }
  return out;
}
