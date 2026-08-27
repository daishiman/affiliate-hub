/**
 * @tier 2
 * @req REQ-BOPS01, REQ-BOPS02, REQ-BOPS03, REQ-BOPS04, REQ-BOPS05, REQ-BOPS06
 * @req REQ-BOPS07, REQ-BOPS08, REQ-BOPS09, REQ-BOPS11, REQ-BOPS14
 * @types boundary, db-migration, state-transition, tenant-isolation
 *
 * `legal_page` と blog の子表（部品・タグ結合・評価）は workspace_id を持ち、
 * そのうえで親のサイト／記事が操作者の workspace に属するときだけ読み書きできる。
 * 二重にしてあるのは、片方だけだと 1 本のクエリが単体では他所の行に届くからで、
 * その両方を本物の D1 と migration で確かめる。
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import type { WorkspaceId } from "@/domain/shared";
import {
  createD1BlogOpsRepository,
  createD1PublicBlogPort,
} from "@/infrastructure/persistence/d1/blog-ops-repository";
import { createD1SiteRepository } from "@/infrastructure/persistence/d1/site-repository";
import { sampleSites } from "@/infrastructure/persistence/sample/site-sample-repository";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

const OWNER = "ws_blog_owner" as WorkspaceId;
const OUTSIDER = "ws_blog_outsider" as WorkspaceId;
const SITE = "tenant-owned-blog";
const PAGE_ID = "lgp_tenant_owned";
const ARTICLE_ID = "bar_tenant_owned";
const BLOCK_ID = "bab_tenant_owned";
const TAG_ID = "btg_tenant_owned";
const RATING_ID = "brt_tenant_owned";
const DELETED_AT = new Date("2026-08-26T00:30:00.000Z");

let proxy: Proxy;

function migrationStatements(): readonly string[] {
  const dir = path.resolve(process.cwd(), "drizzle");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .flatMap((file) =>
      readFileSync(path.join(dir, file), "utf8")
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter((statement) => statement !== ""),
    );
}

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
  await proxy.env.DB.prepare("DELETE FROM blog_article_rating").run();
  await proxy.env.DB.prepare("DELETE FROM blog_article_tag").run();
  await proxy.env.DB.prepare("DELETE FROM blog_article_block").run();
  await proxy.env.DB.prepare("DELETE FROM blog_tag").run();
  await proxy.env.DB.prepare("DELETE FROM articles").run();
  await proxy.env.DB.prepare("DELETE FROM blog_delivery_snapshot").run();
  await proxy.env.DB.prepare("DELETE FROM blog_delivery_part").run();
  await proxy.env.DB.prepare("DELETE FROM blog_layout_band").run();
  await proxy.env.DB.prepare("DELETE FROM blog_layout_slot").run();
  await proxy.env.DB.prepare("DELETE FROM legal_page").run();
  await proxy.env.DB.prepare("DELETE FROM site_network_node").run();
  await proxy.env.DB.prepare("DELETE FROM site_blueprints").run();

  const blueprint = {
    ...sampleSites()[0]!.blueprint,
    id: "sb_tenant_owned",
    workspaceId: OWNER,
  };
  await proxy.env.DB.prepare(
    "INSERT INTO site_blueprints (id, workspace_id, slug, name, pattern, blueprint_json) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      "sb_tenant_owned",
      String(OWNER),
      SITE,
      blueprint.name,
      blueprint.pattern,
      JSON.stringify(blueprint),
    )
    .run();

  await proxy.env.DB.prepare(
    "INSERT INTO site_network_node (id, workspace_id, site_slug, role, name) VALUES (?, ?, ?, 'hub', ?)",
  )
    .bind("snn_tenant_owned", String(OWNER), SITE, "所有者のブログ")
    .run();
  await proxy.env.DB.prepare(
    "INSERT INTO legal_page (id, workspace_id, site_slug, kind, title, body) VALUES (?, ?, ?, 'profile', ?, ?)",
  )
    .bind(PAGE_ID, String(OWNER), SITE, "運営者情報", "所有者だけが読める本文")
    .run();
  await proxy.env.DB.prepare(
    "INSERT INTO articles (id, workspace_id, site_slug, slug, article_template, type, title) VALUES (?, ?, ?, ?, 'T1', 'ranking', ?)",
  )
    .bind(ARTICLE_ID, String(OWNER), SITE, "owned-article", "所有者の記事")
    .run();
  await proxy.env.DB.prepare(
    "INSERT INTO blog_article_rating (id, workspace_id, article_id, reader_key, score, comment) VALUES (?, ?, ?, ?, 5, ?)",
  )
    .bind(RATING_ID, String(OWNER), ARTICLE_ID, "reader_tenant_test", "所有者の評価")
    .run();
  await proxy.env.DB.prepare(
    "INSERT INTO blog_article_block (id, workspace_id, article_id, kind, heading, body, position) VALUES (?, ?, ?, 'summary-section', ?, ?, 0)",
  )
    .bind(BLOCK_ID, String(OWNER), ARTICLE_ID, "所有者の見出し", "所有者の本文")
    .run();
  await proxy.env.DB.prepare(
    "INSERT INTO blog_tag (id, workspace_id, site_slug, slug, name, description, kind) VALUES (?, ?, ?, ?, ?, '', 'topic')",
  )
    .bind(TAG_ID, String(OWNER), SITE, "owned-tag", "所有者のタグ")
    .run();
  await proxy.env.DB.prepare(
    "INSERT INTO blog_article_tag (workspace_id, article_id, tag_id) VALUES (?, ?, ?)",
  )
    .bind(String(OWNER), ARTICLE_ID, TAG_ID)
    .run();
});

function repository() {
  return createD1BlogOpsRepository(drizzle(proxy.env.DB, { schema }));
}

function publicRepository() {
  const db = drizzle(proxy.env.DB, { schema });
  return createD1PublicBlogPort(db, createD1SiteRepository(db));
}

describe("記事タグ結合の DB 整合性", () => {
  it("正規 migration 後は親FKが有効で整合性違反がない", async () => {
    const foreignKeys = await proxy.env.DB.prepare(
      "PRAGMA foreign_key_list('blog_article_tag')",
    ).all<{ table: string; from: string; on_delete: string }>();
    expect(
      foreignKeys.results.map((row) => [row.from, row.table, row.on_delete]).sort(),
    ).toEqual([
      ["article_id", "articles", "CASCADE"],
      ["tag_id", "blog_tag", "CASCADE"],
    ]);
    const violations = await proxy.env.DB.prepare("PRAGMA foreign_key_check").all();
    expect(violations.results).toEqual([]);
  });
});

describe("固定ページの workspace 境界", () => {
  it("公開口は published かつ未削除の正本語彙だけを返す", async () => {
    await proxy.env.DB.prepare(
      "UPDATE legal_page SET kind = 'profile', status = 'published' WHERE id = ?",
    )
      .bind(PAGE_ID)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO legal_page (id, workspace_id, site_slug, kind, title, body, status, deleted_at) VALUES ('lgp_draft', ?, ?, 'contact', 'draft', 'draft', 'draft', NULL), ('lgp_deleted', ?, ?, 'company', 'deleted', 'deleted', 'published', ?)",
    )
      .bind(
        String(OWNER),
        SITE,
        String(OWNER),
        SITE,
        Math.floor(DELETED_AT.getTime() / 1000),
      )
      .run();

    const opened = await publicRepository().openSite(SITE);
    expect(opened.ok && opened.value).not.toBeNull();
    if (!opened.ok || opened.value === null) return;
    const result = await opened.value.listFixedPages();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((page) => page.kind)).toEqual(["profile"]);
    }
  });

  it("別 workspace からは読めず、存在の有無も漏らさない", async () => {
    const result = await repository().listFixedPages(OUTSIDER, SITE);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it("別 workspace からの保存を断り、元の本文を変えない", async () => {
    const result = await repository().saveFixedPage(OUTSIDER, {
      id: PAGE_ID,
      siteSlug: SITE,
      kind: "profile",
      title: "書き換え後",
      body: "別 workspace からの本文",
      status: "draft",
      deletedAt: null,
      updatedAt: new Date("2026-08-26T00:00:00.000Z"),
    });

    expect(result.ok).toBe(false);
    const row = await proxy.env.DB.prepare("SELECT title, body FROM legal_page WHERE id = ?")
      .bind(PAGE_ID)
      .first<{ title: string; body: string }>();
    expect(row).toEqual({ title: "運営者情報", body: "所有者だけが読める本文" });
  });

  it("別 workspace からの削除を断り、行を残す", async () => {
    const result = await repository().deleteFixedPage(OUTSIDER, PAGE_ID);

    expect(result.ok).toBe(false);
    const row = await proxy.env.DB.prepare("SELECT id FROM legal_page WHERE id = ?")
      .bind(PAGE_ID)
      .first<{ id: string }>();
    expect(row?.id).toBe(PAGE_ID);
  });

  it("削除済み本文を保存で上書きせず、所有者だけが同じ行を明示復元する", async () => {
    expect((await repository().deleteFixedPage(OWNER, PAGE_ID)).ok).toBe(true);
    const deleted = await repository().listDeletedFixedPages(OWNER, SITE);
    expect(deleted.ok && deleted.value[0]).toMatchObject({
      id: PAGE_ID,
      title: "運営者情報",
      body: "所有者だけが読める本文",
      status: "draft",
    });

    const implicitRestore = await repository().saveFixedPage(OWNER, {
      id: PAGE_ID,
      siteSlug: SITE,
      kind: "profile",
      title: "暗黙上書き",
      body: "変えてはいけない本文",
      status: "draft",
      deletedAt: null,
      updatedAt: DELETED_AT,
    });
    expect(implicitRestore.ok).toBe(false);
    expect((await repository().restoreFixedPage(OUTSIDER, PAGE_ID, DELETED_AT)).ok).toBe(false);
    expect((await repository().restoreFixedPage(OWNER, PAGE_ID, DELETED_AT)).ok).toBe(true);
    expect((await repository().restoreFixedPage(OWNER, PAGE_ID, DELETED_AT)).ok).toBe(false);

    const restored = await repository().listFixedPages(OWNER, SITE);
    expect(restored.ok && restored.value[0]).toMatchObject({
      id: PAGE_ID,
      title: "運営者情報",
      body: "所有者だけが読める本文",
      status: "draft",
      deletedAt: null,
    });
  });

  it("同じ siteSlug を別 workspace も持つとき、固定ページをどちらにも見せない", async () => {
    await proxy.env.DB.prepare(
      "INSERT INTO site_network_node (id, workspace_id, site_slug, role, name) VALUES (?, ?, ?, 'hub', ?)",
    )
      .bind("snn_tenant_ambiguous", String(OUTSIDER), SITE, "同名の別ブログ")
      .run();

    const ownerResult = await repository().listFixedPages(OWNER, SITE);
    const outsiderResult = await repository().listFixedPages(OUTSIDER, SITE);

    expect(ownerResult.ok).toBe(true);
    if (ownerResult.ok) expect(ownerResult.value).toEqual([]);
    expect(outsiderResult.ok).toBe(true);
    if (outsiderResult.ok) expect(outsiderResult.value).toEqual([]);
  });

  it("同じ siteSlug を別 workspace も持つとき、固定ページを上書きできない", async () => {
    await proxy.env.DB.prepare(
      "INSERT INTO site_network_node (id, workspace_id, site_slug, role, name) VALUES (?, ?, ?, 'hub', ?)",
    )
      .bind("snn_tenant_ambiguous", String(OUTSIDER), SITE, "同名の別ブログ")
      .run();

    const result = await repository().saveFixedPage(OUTSIDER, {
      id: PAGE_ID,
      siteSlug: SITE,
      kind: "profile",
      title: "書き換え後",
      body: "曖昧な slug からの本文",
      status: "published",
      deletedAt: null,
      updatedAt: new Date("2026-08-26T00:00:00.000Z"),
    });

    expect(result.ok).toBe(false);
    const row = await proxy.env.DB.prepare("SELECT title FROM legal_page WHERE id = ?")
      .bind(PAGE_ID)
      .first<{ title: string }>();
    expect(row?.title).toBe("運営者情報");
  });

  it("同じ siteSlug を別 workspace も持つとき、固定ページを削除できない", async () => {
    await proxy.env.DB.prepare(
      "INSERT INTO site_network_node (id, workspace_id, site_slug, role, name) VALUES (?, ?, ?, 'hub', ?)",
    )
      .bind("snn_tenant_ambiguous", String(OUTSIDER), SITE, "同名の別ブログ")
      .run();

    const result = await repository().deleteFixedPage(OUTSIDER, PAGE_ID);

    expect(result.ok).toBe(false);
    const row = await proxy.env.DB.prepare("SELECT id FROM legal_page WHERE id = ?")
      .bind(PAGE_ID)
      .first<{ id: string }>();
    expect(row?.id).toBe(PAGE_ID);
  });
});

describe("親リソースと子リソースの workspace 境界", () => {
  it("一覧の適合判定も workspace 内の記事部品だけを一括で返す", async () => {
    const owner = await repository().listArticleBlockKinds(OWNER, [ARTICLE_ID]);
    const outsider = await repository().listArticleBlockKinds(OUTSIDER, [ARTICLE_ID]);

    expect(owner.ok && owner.value[ARTICLE_ID]).toEqual(["summary-section"]);
    expect(outsider.ok && outsider.value).toEqual({});
  });

  it("記事の編集正本は articles だけで、旧 blog_article を並行保持しない", async () => {
    const tables = await proxy.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('articles', 'blog_article') ORDER BY name",
    ).all<{ name: string }>();
    const columns = await proxy.env.DB.prepare("PRAGMA table_info(articles)").all<{
      name: string;
    }>();

    expect(tables.results.map((row) => row.name)).toEqual(["articles"]);
    expect(columns.results.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        "workspace_id",
        "site_slug",
        "article_template",
        "lead",
        "author_name",
        "deleted_at",
      ]),
    );

    const found = await repository().findArticle(OWNER, ARTICLE_ID);
    expect(found.ok && found.value?.article.id).toBe(ARTICLE_ID);
  });

  it("別 workspace の記事IDを削除しても、親と部品・タグ・評価を残す", async () => {
    const result = await repository().deleteArticle(OUTSIDER, ARTICLE_ID, DELETED_AT);

    expect(result.ok).toBe(false);
    for (const [table, column, id] of [
      ["articles", "id", ARTICLE_ID],
      ["blog_article_block", "id", BLOCK_ID],
      ["blog_article_tag", "article_id", ARTICLE_ID],
      ["blog_article_rating", "id", RATING_ID],
    ] as const) {
      const row = await proxy.env.DB.prepare(`SELECT ${column} AS id FROM ${table} WHERE ${column} = ?`)
        .bind(id)
        .first<{ id: string }>();
      expect(row?.id, `${table} を残す`).toBe(id);
    }
  });

  it("所有する記事は論理削除し、本文部品・タグ結合・評価を残す", async () => {
    const result = await repository().deleteArticle(OWNER, ARTICLE_ID, DELETED_AT);

    expect(result.ok).toBe(true);
    const article = await proxy.env.DB.prepare(
      "SELECT id, deleted_at AS deletedAt FROM articles WHERE id = ?",
    )
      .bind(ARTICLE_ID)
      .first<{ id: string; deletedAt: number | null }>();
    expect(article?.id).toBe(ARTICLE_ID);
    expect(article?.deletedAt).not.toBeNull();
    for (const table of ["blog_article_block", "blog_article_tag", "blog_article_rating"]) {
      const row = await proxy.env.DB.prepare(`SELECT 1 AS present FROM ${table} WHERE ${
        "article_id"
      } = ?`)
        .bind(ARTICLE_ID)
        .first<{ present: number }>();
      expect(row?.present, `${table} を残す`).toBe(1);
    }

    const normal = await repository().listArticles(OWNER, SITE);
    const deleted = await repository().listDeletedArticles(OWNER, SITE);
    expect(normal.ok && normal.value).toEqual([]);
    expect(deleted.ok && deleted.value[0]?.article.id).toBe(ARTICLE_ID);
  });

  it("別 workspace のタグIDを削除しても、親タグと記事の結びを残す", async () => {
    const result = await repository().deleteTag(OUTSIDER, TAG_ID);

    expect(result.ok).toBe(false);
    const tag = await proxy.env.DB.prepare("SELECT id FROM blog_tag WHERE id = ?")
      .bind(TAG_ID)
      .first<{ id: string }>();
    const link = await proxy.env.DB.prepare("SELECT tag_id AS id FROM blog_article_tag WHERE tag_id = ?")
      .bind(TAG_ID)
      .first<{ id: string }>();
    expect(tag?.id).toBe(TAG_ID);
    expect(link?.id).toBe(TAG_ID);
  });

  it("所有するタグの親行が削除できたときだけ、記事の結びも削除する", async () => {
    const result = await repository().deleteTag(OWNER, TAG_ID);

    expect(result.ok).toBe(true);
    const tag = await proxy.env.DB.prepare("SELECT id FROM blog_tag WHERE id = ?")
      .bind(TAG_ID)
      .first<{ id: string }>();
    const link = await proxy.env.DB.prepare("SELECT tag_id AS id FROM blog_article_tag WHERE tag_id = ?")
      .bind(TAG_ID)
      .first<{ id: string }>();
    expect(tag).toBeNull();
    expect(link).toBeNull();
  });

  it("別 workspace の記事IDを upsert で上書きせず、子行も触らない", async () => {
    const result = await repository().saveArticle(OUTSIDER, {
      id: ARTICLE_ID,
      siteSlug: SITE,
      slug: "outsider-article",
      template: "T1",
      title: "別 workspace の見出し",
      lead: "",
      status: "draft",
      authorName: "",
      publishedAt: null,
      updatedAt: new Date("2026-08-26T00:00:00.000Z"),
      blocks: [],
      tagIds: [],
    });

    expect(result.ok).toBe(false);
    const article = await proxy.env.DB.prepare("SELECT title FROM articles WHERE id = ?")
      .bind(ARTICLE_ID)
      .first<{ title: string }>();
    const block = await proxy.env.DB.prepare("SELECT id FROM blog_article_block WHERE id = ?")
      .bind(BLOCK_ID)
      .first<{ id: string }>();
    expect(article?.title).toBe("所有者の記事");
    expect(block?.id).toBe(BLOCK_ID);
  });

  it("別 workspace のタグIDを upsert で上書きしない", async () => {
    const result = await repository().saveTag(OUTSIDER, {
      id: TAG_ID,
      siteSlug: SITE,
      slug: "outsider-tag",
      name: "別 workspace のタグ",
      description: "",
      kind: "topic",
    });

    expect(result.ok).toBe(false);
    const tag = await proxy.env.DB.prepare("SELECT name FROM blog_tag WHERE id = ?")
      .bind(TAG_ID)
      .first<{ name: string }>();
    expect(tag?.name).toBe("所有者のタグ");
  });

  it("別 workspace のサイト網IDを upsert で上書きしない", async () => {
    const result = await repository().saveNetworkNode(OUTSIDER, {
      id: "snn_tenant_owned",
      siteSlug: "outsider-blog",
      role: "hub",
      parentSlug: null,
      name: "別 workspace のブログ",
      oneLine: "",
      position: 0,
      status: "active",
    });

    expect(result.ok).toBe(false);
    const node = await proxy.env.DB.prepare("SELECT name FROM site_network_node WHERE id = ?")
      .bind("snn_tenant_owned")
      .first<{ name: string }>();
    expect(node?.name).toBe("所有者のブログ");
  });

  it("所有するIDの記事・タグ・サイト網は引き続き更新できる", async () => {
    const article = await repository().saveArticle(OWNER, {
      id: ARTICLE_ID,
      siteSlug: SITE,
      slug: "owned-article",
      template: "T1",
      title: "所有者が更新した記事",
      lead: "",
      status: "draft",
      authorName: "",
      publishedAt: null,
      updatedAt: new Date("2026-08-26T00:00:00.000Z"),
      blocks: [
        {
          id: "bab_tenant_replaced",
          kind: "summary-section",
          heading: "更新後",
          body: "更新後の本文",
          position: 0,
        },
      ],
      tagIds: [TAG_ID],
    });
    const tag = await repository().saveTag(OWNER, {
      id: TAG_ID,
      siteSlug: SITE,
      slug: "owned-tag",
      name: "所有者が更新したタグ",
      description: "",
      kind: "topic",
    });
    const network = await repository().saveNetworkNode(OWNER, {
      id: "snn_tenant_owned",
      siteSlug: SITE,
      role: "hub",
      parentSlug: null,
      name: "所有者が更新したブログ",
      oneLine: "",
      position: 0,
      status: "active",
    });

    expect(article.ok).toBe(true);
    expect(tag.ok).toBe(true);
    expect(network.ok).toBe(true);
    const rows = await Promise.all([
      proxy.env.DB.prepare("SELECT title AS value FROM articles WHERE id = ?")
        .bind(ARTICLE_ID)
        .first<{ value: string }>(),
      proxy.env.DB.prepare("SELECT name AS value FROM blog_tag WHERE id = ?")
        .bind(TAG_ID)
        .first<{ value: string }>(),
      proxy.env.DB.prepare("SELECT name AS value FROM site_network_node WHERE id = ?")
        .bind("snn_tenant_owned")
        .first<{ value: string }>(),
    ]);
    expect(rows.map((row) => row?.value)).toEqual([
      "所有者が更新した記事",
      "所有者が更新したタグ",
      "所有者が更新したブログ",
    ]);
  });

  it("記事タグが重複・不存在・別site・別workspaceならaggregateを一切変更しない", async () => {
    await proxy.env.DB.prepare(
      "INSERT INTO blog_tag (id, workspace_id, site_slug, slug, name, kind) VALUES ('btg_other_site', ?, 'other-site', 'other-site', '別site', 'topic'), ('btg_outsider_scope', ?, ?, 'outsider-scope', '別workspace', 'topic')",
    )
      .bind(String(OWNER), String(OUTSIDER), SITE)
      .run();
    const before = await repository().findArticle(OWNER, ARTICLE_ID);
    if (!before.ok || before.value === null) throw new Error("所有者の記事がありません。");

    for (const tagIds of [
      [TAG_ID, TAG_ID],
      ["btg_missing"],
      ["btg_other_site"],
      ["btg_outsider_scope"],
    ]) {
      const result = await repository().saveArticle(OWNER, {
        ...before.value.article,
        title: "変更されてはいけない題名",
        updatedAt: DELETED_AT,
        blocks: [{
          id: "bab_should_not_replace",
          kind: "summary-section",
          heading: "変更禁止",
          body: "変更禁止",
          position: 0,
        }],
        tagIds,
      });
      expect(result.ok, tagIds.join(",")).toBe(false);
      const after = await repository().findArticle(OWNER, ARTICLE_ID);
      expect(after.ok && after.value).toEqual(before.value);
    }
  });

  it("検証SELECT後にタグが削除されても記事aggregateを一切変更しない", async () => {
    const before = await repository().findArticle(OWNER, ARTICLE_ID);
    if (!before.ok || before.value === null) throw new Error("所有者の記事がありません。");
    await proxy.env.DB.prepare(`
      CREATE TRIGGER delete_tag_during_article_save
      BEFORE INSERT ON blog_article_tag
      WHEN NEW.tag_id = '${TAG_ID}'
      BEGIN
        DELETE FROM blog_tag WHERE id = NEW.tag_id;
      END
    `).run();

    try {
      const result = await repository().saveArticle(OWNER, {
        ...before.value.article,
        title: "競合時に変更されてはいけない題名",
        updatedAt: DELETED_AT,
        blocks: [{
          id: "bab_racing_delete",
          kind: "summary-section",
          heading: "変更禁止",
          body: "変更禁止",
          position: 0,
        }],
        tagIds: [TAG_ID],
      });

      expect(result.ok).toBe(false);
      const after = await repository().findArticle(OWNER, ARTICLE_ID);
      expect(after.ok && after.value).toEqual(before.value);
      const tag = await proxy.env.DB.prepare("SELECT id FROM blog_tag WHERE id = ?")
        .bind(TAG_ID)
        .first<{ id: string }>();
      expect(tag?.id).toBe(TAG_ID);
    } finally {
      await proxy.env.DB.prepare("DROP TRIGGER IF EXISTS delete_tag_during_article_save").run();
    }
  });

  it("別 workspace の layout・帯・配信部品 ID を upsert で上書きしない", async () => {
    await proxy.env.DB.prepare(
      "INSERT INTO blog_layout_slot (id, workspace_id, site_slug, region, slot_key, title) VALUES ('bls_owned', ?, ?, 'header', 'global-nav', '所有者の枠')",
    )
      .bind(String(OWNER), SITE)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO blog_layout_band (id, workspace_id, site_slug, band, title) VALUES ('blb_owned', ?, ?, 'latest_posts', '所有者の帯')",
    )
      .bind(String(OWNER), SITE)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO blog_delivery_part (id, workspace_id, site_slug, part, note) VALUES ('bdp_owned', ?, ?, 'canonical', '所有者の配信')",
    )
      .bind(String(OWNER), SITE)
      .run();

    const slot = await repository().saveLayoutSlot(OUTSIDER, {
      id: "bls_owned",
      siteSlug: SITE,
      region: "header",
      slotKey: "global-nav",
      title: "他社が変更",
      body: "",
      position: 0,
      enabled: true,
    });
    const band = await repository().saveLayoutBand(OUTSIDER, {
      id: "blb_owned",
      siteSlug: SITE,
      band: "latest_posts",
      title: "他社が変更",
      enabled: true,
      position: 0,
      itemLimit: 3,
    });
    const part = await repository().saveDeliveryPart(OUTSIDER, {
      id: "bdp_owned",
      siteSlug: SITE,
      part: "canonical",
      enabled: true,
      note: "他社が変更",
      position: 0,
    });

    expect(slot.ok).toBe(false);
    expect(band.ok).toBe(false);
    expect(part.ok).toBe(false);
    const rows = await Promise.all([
      proxy.env.DB.prepare("SELECT title AS value FROM blog_layout_slot WHERE id = 'bls_owned'")
        .first<{ value: string }>(),
      proxy.env.DB.prepare("SELECT title AS value FROM blog_layout_band WHERE id = 'blb_owned'")
        .first<{ value: string }>(),
      proxy.env.DB.prepare("SELECT note AS value FROM blog_delivery_part WHERE id = 'bdp_owned'")
        .first<{ value: string }>(),
    ]);
    expect(rows.map((row) => row?.value)).toEqual([
      "所有者の枠",
      "所有者の帯",
      "所有者の配信",
    ]);
  });

  it("記事集約の部品保存に失敗しても、既存の公開本体・部品・タグを欠損させない", async () => {
    await proxy.env.DB.prepare("UPDATE articles SET status = 'published' WHERE id = ?")
      .bind(ARTICLE_ID)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO articles (id, workspace_id, site_slug, slug, article_template, type, title) VALUES ('bar_conflict', ?, ?, 'conflict', 'T1', 'ranking', '競合用')",
    )
      .bind(String(OWNER), SITE)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO blog_article_block (id, workspace_id, article_id, kind, heading, body, position) VALUES ('bab_conflict', ?, 'bar_conflict', 'summary-section', '', '', 0)",
    )
      .bind(String(OWNER))
      .run();

    const result = await repository().saveArticle(OWNER, {
      id: ARTICLE_ID,
      siteSlug: SITE,
      slug: "owned-article",
      template: "T1",
      title: "途中まで書き換わってはいけない",
      lead: "",
      status: "published",
      authorName: "",
      publishedAt: new Date("2026-08-26T00:00:00.000Z"),
      updatedAt: new Date("2026-08-26T00:00:00.000Z"),
      blocks: [
        {
          id: "bab_conflict",
          kind: "summary-section",
          heading: "競合する部品",
          body: "",
          position: 0,
        },
      ],
      tagIds: [],
    });

    expect(result.ok).toBe(false);
    const article = await proxy.env.DB.prepare(
      "SELECT title, status FROM articles WHERE id = ?",
    )
      .bind(ARTICLE_ID)
      .first<{ title: string; status: string }>();
    const block = await proxy.env.DB.prepare(
      "SELECT id FROM blog_article_block WHERE id = ? AND article_id = ?",
    )
      .bind(BLOCK_ID, ARTICLE_ID)
      .first<{ id: string }>();
    const tag = await proxy.env.DB.prepare(
      "SELECT tag_id AS id FROM blog_article_tag WHERE article_id = ? AND tag_id = ?",
    )
      .bind(ARTICLE_ID, TAG_ID)
      .first<{ id: string }>();
    expect(article).toEqual({ title: "所有者の記事", status: "published" });
    expect(block?.id).toBe(BLOCK_ID);
    expect(tag?.id).toBe(TAG_ID);
  });
});

describe("公開 identity の workspace 境界", () => {
  it("hidden のサイトは公開identityを開かない", async () => {
    await proxy.env.DB.prepare(
      "UPDATE site_network_node SET status = 'hidden' WHERE id = 'snn_tenant_owned'",
    ).run();

    const opened = await publicRepository().openSite(SITE);

    expect(opened.ok && opened.value).toBeNull();
  });

  it("曖昧な同名 slug を閉じ、解決後は所有 workspace の公開行だけを返す", async () => {
    await proxy.env.DB.prepare(
      "UPDATE articles SET status = 'published', published_at = unixepoch() WHERE id = ?",
    )
      .bind(ARTICLE_ID)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO articles (id, workspace_id, site_slug, slug, article_template, type, title, status) VALUES ('bar_owner_draft', ?, ?, 'owner-draft', 'T1', 'ranking', '所有者の下書き', 'draft')",
    )
      .bind(String(OWNER), SITE)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO blog_layout_slot (id, workspace_id, site_slug, region, slot_key, title) VALUES ('bls_public_owner', ?, ?, 'header', 'global-nav', '所有者の枠')",
    )
      .bind(String(OWNER), SITE)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO blog_layout_band (id, workspace_id, site_slug, band, title) VALUES ('blb_public_owner', ?, ?, 'latest_posts', '所有者の帯')",
    )
      .bind(String(OWNER), SITE)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO blog_delivery_part (id, workspace_id, site_slug, part, note) VALUES ('bdp_public_owner', ?, ?, 'canonical', '所有者の配信')",
    )
      .bind(String(OWNER), SITE)
      .run();

    await proxy.env.DB.prepare(
      "INSERT INTO site_network_node (id, workspace_id, site_slug, role, name) VALUES ('snn_public_outsider', ?, ?, 'hub', '同名の別サイト')",
    )
      .bind(String(OUTSIDER), SITE)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO site_network_node (id, workspace_id, site_slug, role, parent_slug, name) VALUES ('snn_public_outsider_child', ?, 'outsider-child', 'sub', ?, '別 tenant の子')",
    )
      .bind(String(OUTSIDER), SITE)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO articles (id, workspace_id, site_slug, slug, article_template, type, title, status, published_at) VALUES ('bar_public_outsider', ?, ?, 'outsider-article', 'T1', 'ranking', '別 tenant の記事', 'published', unixepoch())",
    )
      .bind(String(OUTSIDER), SITE)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO blog_layout_slot (id, workspace_id, site_slug, region, slot_key, title) VALUES ('bls_public_outsider', ?, ?, 'header', 'profile', '別 tenant の枠')",
    )
      .bind(String(OUTSIDER), SITE)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO blog_layout_band (id, workspace_id, site_slug, band, title) VALUES ('blb_public_outsider', ?, ?, 'sister_sites', '別 tenant の帯')",
    )
      .bind(String(OUTSIDER), SITE)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO blog_delivery_part (id, workspace_id, site_slug, part, note) VALUES ('bdp_public_outsider', ?, ?, 'rss_feeds', '別 tenant の配信')",
    )
      .bind(String(OUTSIDER), SITE)
      .run();
    await proxy.env.DB.prepare(
      "INSERT INTO blog_tag (id, workspace_id, site_slug, slug, name, kind) VALUES ('btg_public_outsider', ?, ?, 'outsider-tag', '別 tenant のタグ', 'topic')",
    )
      .bind(String(OUTSIDER), SITE)
      .run();

    const publicBlog = publicRepository();
    const ambiguous = await publicBlog.openSite(SITE);
    expect(ambiguous.ok && ambiguous.value).toBeNull();

    await proxy.env.DB.prepare("DELETE FROM site_network_node WHERE id = 'snn_public_outsider'").run();
    const opened = await publicBlog.openSite(SITE);
    expect(opened.ok && opened.value).not.toBeNull();
    if (!opened.ok || opened.value === null) return;
    const detail = await opened.value.findArticleBySlug("owned-article");
    const draft = await opened.value.findArticleBySlug("owner-draft");
    const list = await opened.value.listPublished(10);
    const slots = await opened.value.listLayoutSlots();
    const bands = await opened.value.listLayoutBands();
    const parts = await opened.value.listDeliveryParts();
    const network = await opened.value.listNetwork();
    const tags = await opened.value.listTags();

    expect(detail.ok && detail.value?.article.id).toBe(ARTICLE_ID);
    expect(draft.ok && draft.value).toBeNull();
    expect(list.ok && list.value.map((row) => row.id)).toEqual([ARTICLE_ID]);
    expect(slots.ok && slots.value.map((row) => row.id)).toEqual(["bls_public_owner"]);
    expect(bands.ok && bands.value.map((row) => row.id)).toEqual(["blb_public_owner"]);
    expect(parts.ok && parts.value.map((row) => row.id)).toEqual(["bdp_public_owner"]);
    expect(network.ok && network.value.map((row) => row.id)).toEqual(["snn_tenant_owned"]);
    expect(tags.ok && tags.value.map((row) => row.id)).toEqual([TAG_ID]);

    await proxy.env.DB.prepare(
      "UPDATE site_network_node SET deleted_at = unixepoch() WHERE id = 'snn_tenant_owned'",
    ).run();
    const deletedSite = await publicBlog.openSite(SITE);
    expect(deletedSite.ok && deletedSite.value).toBeNull();
  });
});

describe("サイト網と記事の論理削除・復元", () => {
  it("記事は二重削除・別 tenant・二重復元を断り、同じ ID と URL で戻る", async () => {
    await proxy.env.DB.prepare("UPDATE articles SET status = 'published' WHERE id = ?")
      .bind(ARTICLE_ID)
      .run();

    const deleted = await repository().deleteArticle(OWNER, ARTICLE_ID, DELETED_AT);
    const twiceDeleted = await repository().deleteArticle(OWNER, ARTICLE_ID, DELETED_AT);
    const outsiderRestore = await repository().restoreArticle(OUTSIDER, ARTICLE_ID, new Date());
    const restored = await repository().restoreArticle(
      OWNER,
      ARTICLE_ID,
      new Date("2026-08-26T01:00:00.000Z"),
    );
    const twiceRestored = await repository().restoreArticle(OWNER, ARTICLE_ID, new Date());

    expect(deleted.ok).toBe(true);
    expect(twiceDeleted.ok).toBe(false);
    expect(outsiderRestore.ok).toBe(false);
    expect(restored.ok).toBe(true);
    expect(twiceRestored.ok).toBe(false);
    const detail = await repository().findArticle(OWNER, ARTICLE_ID);
    expect(detail.ok && detail.value?.article).toMatchObject({
      id: ARTICLE_ID,
      slug: "owned-article",
    });
  });

  it("削除済み記事を公開一覧・公開詳細へ出さない", async () => {
    await proxy.env.DB.prepare("UPDATE articles SET status = 'published' WHERE id = ?")
      .bind(ARTICLE_ID)
      .run();
    await repository().deleteArticle(OWNER, ARTICLE_ID, DELETED_AT);

    const opened = await publicRepository().openSite(SITE);
    expect(opened.ok && opened.value).not.toBeNull();
    if (!opened.ok || opened.value === null) return;
    const list = await opened.value.listPublished(10);
    const detail = await opened.value.findArticleBySlug("owned-article");

    expect(list.ok && list.value).toEqual([]);
    expect(detail.ok && detail.value).toBeNull();
  });

  it("サイト網は論理削除し、通常一覧と公開 layout/tag から除外して同じ URL で戻す", async () => {
    await proxy.env.DB.prepare(
      "INSERT INTO blog_layout_slot (id, workspace_id, site_slug, region, slot_key, title) VALUES ('bls_lifecycle', ?, ?, 'header', 'global-nav', '案内')",
    )
      .bind(String(OWNER), SITE)
      .run();

    const deleted = await repository().deleteNetworkNode(OWNER, "snn_tenant_owned", DELETED_AT);
    const twiceDeleted = await repository().deleteNetworkNode(
      OWNER,
      "snn_tenant_owned",
      DELETED_AT,
    );
    const outsiderRestore = await repository().restoreNetworkNode(
      OUTSIDER,
      "snn_tenant_owned",
      new Date(),
    );
    const normal = await repository().listNetwork(OWNER);
    const deletedRows = await repository().listDeletedNetwork(OWNER);
    const closed = await publicRepository().openSite(SITE);
    const restored = await repository().restoreNetworkNode(
      OWNER,
      "snn_tenant_owned",
      new Date("2026-08-26T01:00:00.000Z"),
    );
    const twiceRestored = await repository().restoreNetworkNode(
      OWNER,
      "snn_tenant_owned",
      new Date(),
    );

    expect(deleted.ok).toBe(true);
    expect(twiceDeleted.ok).toBe(false);
    expect(outsiderRestore.ok).toBe(false);
    expect(normal.ok && normal.value).toEqual([]);
    expect(deletedRows.ok && deletedRows.value[0]?.node.siteSlug).toBe(SITE);
    expect(closed.ok && closed.value).toBeNull();
    expect(restored.ok).toBe(true);
    expect(twiceRestored.ok).toBe(false);
    const found = await repository().findNetworkNode(OWNER, "snn_tenant_owned");
    expect(found.ok && found.value?.siteSlug).toBe(SITE);
    const reopened = await publicRepository().openSite(SITE);
    expect(reopened.ok && reopened.value).not.toBeNull();
  });
});

describe("評価の workspace 境界", () => {
  it("別 workspace の記事に付いた件数・本文を返さない", async () => {
    const summaries = await repository().summarizeRatings(OUTSIDER, [ARTICLE_ID]);
    const ratings = await repository().listRatings(OUTSIDER, ARTICLE_ID);

    expect(summaries.ok).toBe(true);
    if (summaries.ok) {
      expect(summaries.value[ARTICLE_ID]).toEqual({ count: 0, average: null });
    }
    expect(ratings.ok).toBe(true);
    if (ratings.ok) expect(ratings.value).toEqual([]);
  });

  it("別 workspace から非表示へ変えられない", async () => {
    const result = await repository().setRatingHidden(OUTSIDER, RATING_ID, true);

    expect(result.ok).toBe(false);
    const row = await proxy.env.DB.prepare("SELECT hidden FROM blog_article_rating WHERE id = ?")
      .bind(RATING_ID)
      .first<{ hidden: number }>();
    expect(row?.hidden).toBe(0);
  });
});
