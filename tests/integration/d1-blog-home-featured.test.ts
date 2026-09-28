/**
 * @tier 2
 * @req REQ-BOPS02, REQ-BOPS06
 * @types boundary, db-migration, state-transition, tenant-isolation
 *
 * トップの「おすすめ」は公開記事の複製ではなく、
 * (workspace, site, article slug, position) で保存する編集者の選定意図である。
 * 公開を取り下げても意図行を消さず、同じ URL 名の再公開で復帰するため、
 * published_articles への物理 FK は持たず INSERT 時の guard と公開 reader で整合させる。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import type { PublicSiteReader } from "@/application/ports/blog-ops";
import * as schema from "@/db/schema";
import {
  createD1PublicBlogPort,
} from "@/infrastructure/persistence/d1/blog-ops-repository";
import { createD1SiteRepository } from "@/infrastructure/persistence/d1/site-repository";
import { sampleSites } from "@/infrastructure/persistence/sample/site-sample-repository";
import { migrationStatements } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;
type FeaturedReader = PublicSiteReader & {
  listFeaturedArticles(): Promise<
    | {
        readonly ok: true;
        readonly value: {
          readonly selectedCount: number;
          readonly articles: readonly { readonly slug: string; readonly title: string }[];
        };
      }
    | { readonly ok: false; readonly error: unknown }
  >;
};

const OWNER = "ws_featured_owner";
const OUTSIDER = "ws_featured_outsider";
const SITE = "featured-owned-blog";

let proxy: Proxy;

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  const featuredTable = await proxy.env.DB.prepare(
    "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'blog_home_featured_article'",
  ).first<{ present: number }>();
  if (featuredTable !== null) {
    await proxy.env.DB.prepare("DELETE FROM blog_home_featured_article").run();
  }
  await proxy.env.DB.prepare("DELETE FROM published_article_tombstones").run();
  await proxy.env.DB.prepare("DELETE FROM published_articles").run();
  await proxy.env.DB.prepare("DELETE FROM articles").run();
  await proxy.env.DB.prepare("DELETE FROM site_network_node").run();
  await proxy.env.DB.prepare("DELETE FROM site_blueprints").run();

  const blueprint = {
    ...sampleSites()[0]!.blueprint,
    id: "sb_featured_owner",
    workspaceId: OWNER,
  };
  await proxy.env.DB.prepare(
    `INSERT INTO site_blueprints
       (id, workspace_id, slug, name, pattern, published_at, blueprint_json)
     VALUES (?, ?, ?, ?, ?, unixepoch(), ?)`,
  )
    .bind(
      "sb_featured_owner",
      OWNER,
      SITE,
      blueprint.name,
      blueprint.pattern,
      JSON.stringify(blueprint),
    )
    .run();
  await proxy.env.DB.prepare(
    `INSERT INTO site_network_node
       (id, workspace_id, site_slug, role, name, status)
     VALUES ('snn_featured_owner', ?, ?, 'hub', 'おすすめ検証ブログ', 'active')`,
  )
    .bind(OWNER, SITE)
    .run();
});

async function publishArticle({
  slug,
  title,
  workspaceId = OWNER,
  siteSlug = SITE,
  sourceArticleId = null,
  archived = false,
}: {
  readonly slug: string;
  readonly title: string;
  readonly workspaceId?: string;
  readonly siteSlug?: string;
  readonly sourceArticleId?: string | null;
  readonly archived?: boolean;
}) {
  if (sourceArticleId !== null) {
    await proxy.env.DB.prepare(
      `INSERT INTO articles
         (id, workspace_id, site_slug, slug, article_template, type, title, lead,
          status, public_category_slug, author_name, published_at, updated_at)
       VALUES (?, ?, ?, ?, 'T3', 'guide', ?, '', 'published', 'guides', '編集部',
               unixepoch(), unixepoch())`,
    )
      .bind(sourceArticleId, workspaceId, siteSlug, slug, title)
      .run();
  }

  const article = {
    slug,
    siteSlug,
    type: "guide",
    title,
    summary: `${title}の要約`,
    categorySlug: "guides",
    publishedAt: "2026-09-03",
    updatedAt: "2026-09-03",
    author: { slug: "editor", name: "編集部", bio: "", credentials: [] },
    disclosureRequired: false,
    sections: [],
  };
  await proxy.env.DB.prepare(
    `INSERT INTO published_articles
       (site_slug, slug, workspace_id, source_article_id, type, title, summary,
        category_slug, author_slug, author_name, published_at, updated_at, archived_at, article_json)
     VALUES (?, ?, ?, ?, 'guide', ?, ?, 'guides', 'editor', '編集部',
             '2026-09-03', '2026-09-03', ?, ?)`,
  )
    .bind(
      siteSlug,
      slug,
      workspaceId,
      sourceArticleId,
      title,
      article.summary,
      archived ? "2026-09-04" : null,
      JSON.stringify(article),
    )
    .run();
}

function selectFeatured(
  articleSlug: string,
  position: number,
  workspaceId = OWNER,
  siteSlug = SITE,
) {
  return proxy.env.DB.prepare(
    `INSERT INTO blog_home_featured_article
       (workspace_id, site_slug, article_slug, position)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(workspaceId, siteSlug, articleSlug, position)
    .run();
}

async function featuredReader(): Promise<FeaturedReader> {
  const db = drizzle(proxy.env.DB, { schema });
  const opened = await createD1PublicBlogPort(db, createD1SiteRepository(db)).openSite(SITE);
  if (!opened.ok || opened.value === null) {
    throw new Error("公開サイトの reader を開けませんでした。");
  }
  return opened.value as FeaturedReader;
}

describe("ブログトップのおすすめ記事", () => {
  it("同一 tenant/site の公開中 URL だけを、記事と位置の重複なしで選べる", async () => {
    await publishArticle({
      slug: "source-backed",
      title: "編集記事から公開",
      sourceArticleId: "bar_featured_source",
    });
    await publishArticle({ slug: "snapshot-only", title: "公開 projection だけの記事" });
    await publishArticle({ slug: "archived", title: "非公開記事", archived: true });

    await expect(selectFeatured("source-backed", 0)).resolves.toBeDefined();
    await expect(selectFeatured("snapshot-only", 1)).resolves.toBeDefined();

    await expect(selectFeatured("source-backed", 2)).rejects.toThrow();
    await expect(selectFeatured("snapshot-only", 0)).rejects.toThrow();
    await expect(selectFeatured("missing", 2)).rejects.toThrow();
    await expect(selectFeatured("archived", 2)).rejects.toThrow();
    await expect(selectFeatured("source-backed", 2, OUTSIDER)).rejects.toThrow();
    await expect(selectFeatured("source-backed", 2, OWNER, "another-site")).rejects.toThrow();

    const stored = await proxy.env.DB.prepare(
      `SELECT article_slug AS articleSlug, position
         FROM blog_home_featured_article
        WHERE workspace_id = ? AND site_slug = ?
        ORDER BY position`,
    )
      .bind(OWNER, SITE)
      .all<{ articleSlug: string; position: number }>();
    expect(stored.results).toEqual([
      { articleSlug: "source-backed", position: 0 },
      { articleSlug: "snapshot-only", position: 1 },
    ]);
  });

  it("選定数は意図行を保ち、公開 reader は表示可能な記事だけを保存順で返す", async () => {
    await publishArticle({ slug: "first", title: "最初のおすすめ" });
    await publishArticle({ slug: "second", title: "2 番目のおすすめ" });
    await publishArticle({ slug: "third", title: "3 番目のおすすめ" });
    await selectFeatured("third", 0);
    await selectFeatured("first", 1);
    await selectFeatured("second", 2);

    const reader = await featuredReader();
    const initial = await reader.listFeaturedArticles();
    expect(initial.ok).toBe(true);
    if (!initial.ok) throw new Error("おすすめ記事を読めませんでした。");
    expect(initial.value).toMatchObject({ selectedCount: 3 });
    expect(initial.value.articles.map(({ slug }) => slug)).toEqual(["third", "first", "second"]);

    await proxy.env.DB.prepare(
      "DELETE FROM published_articles WHERE site_slug = ? AND slug = 'first'",
    )
      .bind(SITE)
      .run();
    await proxy.env.DB.prepare(
      "UPDATE published_articles SET archived_at = '2026-09-04' WHERE site_slug = ? AND slug = 'second'",
    )
      .bind(SITE)
      .run();

    const hidden = await reader.listFeaturedArticles();
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) throw new Error("おすすめ記事を読めませんでした。");
    expect(hidden.value).toMatchObject({ selectedCount: 3 });
    expect(hidden.value.articles.map(({ slug }) => slug)).toEqual(["third"]);

    await publishArticle({ slug: "first", title: "再公開した最初のおすすめ" });
    const republished = await reader.listFeaturedArticles();
    expect(republished.ok).toBe(true);
    if (!republished.ok) throw new Error("再公開後のおすすめ記事を読めませんでした。");
    expect(republished.value).toMatchObject({ selectedCount: 3 });
    expect(republished.value.articles.map(({ slug, title }) => ({ slug, title }))).toEqual([
      { slug: "third", title: "3 番目のおすすめ" },
      { slug: "first", title: "再公開した最初のおすすめ" },
    ]);

    const intent = await proxy.env.DB.prepare(
      "SELECT count(*) AS total FROM blog_home_featured_article WHERE workspace_id = ? AND site_slug = ?",
    )
      .bind(OWNER, SITE)
      .first<{ total: number }>();
    expect(intent?.total).toBe(3);
  });
});
