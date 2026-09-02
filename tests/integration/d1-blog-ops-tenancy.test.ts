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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import type { PublishedArticle } from "@/application/read-models/published-article";
import type { WorkspaceId } from "@/domain/shared";
import {
  createD1BlogOpsRepository,
  createD1PublicBlogPort,
} from "@/infrastructure/persistence/d1/blog-ops-repository";
import { createD1SiteRepository } from "@/infrastructure/persistence/d1/site-repository";
import { createD1PublishedArticleWriter } from "@/infrastructure/persistence/d1/published-article-repository";
import { sampleSites } from "@/infrastructure/persistence/sample/site-sample-repository";
import { readPublicSiteComposition } from "@/presentation/site/public-site-projection";
import { migrationStatements } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

const OWNER = "ws_blog_owner" as WorkspaceId;
const OUTSIDER = "ws_blog_outsider" as WorkspaceId;
const SITE = "tenant-owned-blog";
const ARTICLE_ID = "bar_tenant_owned";
const BLOCK_ID = "bab_tenant_owned";
const TAG_ID = "btg_tenant_owned";
const RATING_ID = "brt_tenant_owned";
const DELETED_AT = new Date("2026-08-26T00:30:00.000Z");

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
  await proxy.env.DB.prepare("DELETE FROM published_article_tombstones").run();
  await proxy.env.DB.prepare("DELETE FROM published_articles").run();
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
  await proxy.env.DB.prepare(
    "INSERT OR IGNORE INTO categories (id, slug, name) VALUES ('cat_tenant_guide', 'tenant-guide', 'テナントガイド')",
  ).run();

  const blueprint = {
    ...sampleSites()[0]!.blueprint,
    id: "sb_tenant_owned",
    workspaceId: OWNER,
    categories: [
      {
        slug: "tenant-guide",
        name: "テナントガイド",
        oneLine: "所有者の記事カテゴリ",
        initialArticleTypes: ["guide"],
      },
    ],
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
    "INSERT INTO articles (id, workspace_id, site_slug, slug, article_template, type, title, category_id) VALUES (?, ?, ?, ?, 'T1', 'ranking', ?, 'cat_tenant_guide')",
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

function publishedArticleInput(
  over: Partial<Parameters<ReturnType<typeof repository>["saveArticle"]>[1]> = {},
) {
  return {
    id: ARTICLE_ID,
    siteSlug: SITE,
    slug: "owned-article",
    template: "T1" as const,
    title: "公開する編集記事",
    lead: "公開projectionと同じ要約",
    status: "published" as const,
    authorName: "所有者編集部",
    categorySlug: "tenant-guide",
    publishedAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    blocks: [
      {
        id: "bab_public_projection",
        kind: "summary-section" as const,
        heading: "公開本文",
        body: "編集aggregateから決定的に写した本文",
        position: 0,
      },
    ],
    tagIds: [] as readonly string[],
    ...over,
  };
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
      categorySlug: null,
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
      categorySlug: "tenant-guide",
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

    expect(article.ok, !article.ok ? JSON.stringify(article.error) : "").toBe(true);
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

  it("同じ版から競合保存しても勝者1件だけを本体・本文・タグへ原子的に反映する", async () => {
    const before = await repository().findArticle(OWNER, ARTICLE_ID);
    if (!before.ok || before.value === null) throw new Error("所有者の記事がありません。");
    expect(before.value.article.revision).toBe(1);

    const common = {
      ...before.value.article,
      expectedRevision: 1,
      updatedAt: new Date("2026-08-30T03:00:00.000Z"),
    } as const;
    const [alpha, beta] = await Promise.all([
      repository().saveArticle(OWNER, {
        ...common,
        title: "競合保存 Alpha",
        blocks: [
          {
            id: "bab_cas_alpha",
            kind: "summary-section" as const,
            heading: "Alpha",
            body: "Alpha の本文",
            position: 0,
          },
        ],
        tagIds: [TAG_ID],
      }),
      repository().saveArticle(OWNER, {
        ...common,
        title: "競合保存 Beta",
        blocks: [
          {
            id: "bab_cas_beta",
            kind: "summary-section" as const,
            heading: "Beta",
            body: "Beta の本文",
            position: 0,
          },
        ],
        tagIds: [],
      }),
    ]);

    const results = [alpha, beta];
    expect(
      results.filter((result) => result.ok),
      JSON.stringify(results.filter((result) => !result.ok)),
    ).toHaveLength(1);
    const conflict = results.find((result) => !result.ok);
    expect(conflict?.ok).toBe(false);
    if (conflict !== undefined && !conflict.ok) expect(conflict.error.code).toBe("CONFLICT");

    const after = await repository().findArticle(OWNER, ARTICLE_ID);
    if (!after.ok || after.value === null) throw new Error("競合保存後の記事がありません。");
    expect(after.value.article.revision).toBe(2);
    if (after.value.article.title === "競合保存 Alpha") {
      expect(after.value.blocks).toMatchObject([
        { id: "bab_cas_alpha", heading: "Alpha", body: "Alpha の本文" },
      ]);
      expect(after.value.tagIds).toEqual([TAG_ID]);
    } else {
      expect(after.value.article.title).toBe("競合保存 Beta");
      expect(after.value.blocks).toMatchObject([
        { id: "bab_cas_beta", heading: "Beta", body: "Beta の本文" },
      ]);
      expect(after.value.tagIds).toEqual([]);
    }
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
      authorName: "所有者編集部",
      categorySlug: "tenant-guide",
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
    const projection = await proxy.env.DB.prepare(
      "SELECT slug FROM published_articles WHERE source_article_id = ?",
    )
      .bind(ARTICLE_ID)
      .first<{ slug: string }>();
    expect(projection).toBeNull();
  });

  it("BlogOps公開は編集aggregate・本文・canonical projectionを1つのbatchで確定する", async () => {
    const saved = await repository().saveArticle(OWNER, publishedArticleInput());
    expect(saved.ok, !saved.ok ? JSON.stringify(saved.error) : "").toBe(true);

    const opened = await publicRepository().openSite(SITE);
    if (!opened.ok || opened.value === null) throw new Error("公開サイトを開けません。");
    const [detail, list, source, composition] = await Promise.all([
      opened.value.findArticleBySlug("owned-article"),
      opened.value.listPublished(20),
      opened.value.findSourceArticleId("owned-article"),
      readPublicSiteComposition(SITE, { source: "live", port: publicRepository() }),
    ]);

    expect(detail.ok && detail.value?.sections[0]?.paragraphs).toEqual([
      "編集aggregateから決定的に写した本文",
    ]);
    expect(list.ok && list.value.map((row) => row.slug)).toEqual(["owned-article"]);
    expect(source).toEqual({ ok: true, value: ARTICLE_ID });
    expect(composition.ok && composition.value?.counts.articles).toBe(1);
  });

  it("公開カテゴリがnullならrepository境界で拒否し空分類をprojectionへ保存しない", async () => {
    const saved = await repository().saveArticle(
      OWNER,
      publishedArticleInput({ categorySlug: null }),
    );
    expect(saved.ok).toBe(false);
    if (!saved.ok) {
      expect(saved.error).toMatchObject({ code: "VALIDATION_FAILED", field: "categorySlug" });
    }
    const projection = await proxy.env.DB.prepare(
      "SELECT category_slug AS categorySlug FROM published_articles WHERE site_slug = ? AND slug = ?",
    )
      .bind(SITE, "owned-article")
      .first();
    expect(projection).toBeNull();
  });

  it("AIとBlogOpsの同URL並行公開は勝者だけを確定しaggregateを分裂させない", async () => {
    const db = drizzle(proxy.env.DB, { schema });
    const aiWriter = createD1PublishedArticleWriter(db);
    const aiArticle: PublishedArticle = {
      slug: "owned-article",
      siteSlug: SITE,
      type: "guide",
      title: "AI公開が作った記事",
      summary: "AI公開の要約",
      categorySlug: "tenant-guide",
      publishedAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      author: { slug: "ai-author", name: "AI著者", bio: "", credentials: [] },
      disclosureRequired: false,
      sections: [{ id: "ai", heading: "本文", paragraphs: ["AI本文"] }],
    };

    const [ai, blogOps] = await Promise.all([
      aiWriter.save(OWNER, aiArticle),
      repository().saveArticle(OWNER, publishedArticleInput()),
    ]);
    expect([ai.ok, blogOps.ok].filter(Boolean)).toHaveLength(1);

    const projection = await proxy.env.DB.prepare(
      `SELECT source_article_id AS sourceArticleId, title
       FROM published_articles WHERE site_slug = ? AND slug = 'owned-article'`,
    )
      .bind(SITE)
      .first<{ sourceArticleId: string | null; title: string }>();
    const aggregate = await proxy.env.DB.prepare(
      "SELECT status, title FROM articles WHERE id = ?",
    )
      .bind(ARTICLE_ID)
      .first<{ status: string; title: string }>();
    if (projection?.sourceArticleId === null) {
      expect(ai.ok).toBe(true);
      expect(blogOps.ok).toBe(false);
      expect(projection.title).toBe("AI公開が作った記事");
      expect(aggregate).toEqual({ status: "draft", title: "所有者の記事" });
    } else {
      expect(ai.ok).toBe(false);
      expect(blogOps.ok).toBe(true);
      expect(projection).toEqual({
        sourceArticleId: ARTICLE_ID,
        title: "公開する編集記事",
      });
      expect(aggregate).toEqual({
        status: "published",
        title: "公開する編集記事",
      });
    }
  });

  it("公開中の更新とarchiveは全公開入口へ同時に反映する", async () => {
    expect((await repository().saveArticle(OWNER, publishedArticleInput())).ok).toBe(true);
    const updated = await repository().saveArticle(
      OWNER,
      publishedArticleInput({
        title: "更新後の題名",
        lead: "更新後の要約",
        updatedAt: new Date("2026-09-02T00:00:00.000Z"),
        blocks: [
          {
            id: "bab_public_projection_updated",
            kind: "summary-section",
            heading: "更新後",
            body: "更新後の本文",
            position: 0,
          },
        ],
      }),
    );
    expect(updated.ok).toBe(true);
    const afterUpdate = await publicRepository().openSite(SITE);
    if (!afterUpdate.ok || afterUpdate.value === null) throw new Error("公開サイトを開けません。");
    const updatedArticle = await afterUpdate.value.findArticleBySlug("owned-article");
    expect(updatedArticle.ok && updatedArticle.value?.title).toBe("更新後の題名");

    const archived = await repository().saveArticle(
      OWNER,
      publishedArticleInput({
        title: "更新後の題名",
        status: "archived",
        updatedAt: new Date("2026-09-03T00:00:00.000Z"),
      }),
    );
    expect(archived.ok).toBe(true);
    const afterArchive = await publicRepository().openSite(SITE);
    if (!afterArchive.ok || afterArchive.value === null) throw new Error("公開サイトを開けません。");
    expect(await afterArchive.value.findArticleBySlug("owned-article")).toEqual({ ok: true, value: null });
    expect(await afterArchive.value.listPublished(20)).toEqual({ ok: true, value: [] });
    const tombstone = await proxy.env.DB.prepare(
      "SELECT workspace_id AS workspaceId FROM published_article_tombstones WHERE site_slug = ? AND slug = ?",
    )
      .bind(SITE, "owned-article")
      .first<{ workspaceId: string }>();
    expect(tombstone?.workspaceId).toBe(String(OWNER));
  });

  it("projection書き込み失敗で編集aggregateと本文を一切変更しない", async () => {
    await proxy.env.DB.prepare(`
      CREATE TRIGGER fail_public_projection
      BEFORE INSERT ON published_articles
      BEGIN SELECT RAISE(ABORT, 'injected public projection failure'); END
    `).run();
    try {
      const saved = await repository().saveArticle(OWNER, publishedArticleInput());
      expect(saved.ok).toBe(false);
      const article = await repository().findArticle(OWNER, ARTICLE_ID);
      expect(article.ok && article.value?.article).toMatchObject({
        title: "所有者の記事",
        status: "draft",
        revision: 1,
      });
      expect(article.ok && article.value?.blocks.map((block) => block.id)).toEqual([BLOCK_ID]);
      const projection = await proxy.env.DB.prepare(
        "SELECT slug FROM published_articles WHERE site_slug = ? AND slug = ?",
      )
        .bind(SITE, "owned-article")
        .first<{ slug: string }>();
      expect(projection).toBeNull();
    } finally {
      await proxy.env.DB.prepare("DROP TRIGGER IF EXISTS fail_public_projection").run();
    }
  });

  it("削除時の墓標書き込み失敗でaggregateと公開projectionを両方戻す", async () => {
    expect((await repository().saveArticle(OWNER, publishedArticleInput())).ok).toBe(true);
    await proxy.env.DB.prepare(`
      CREATE TRIGGER fail_public_tombstone
      BEFORE INSERT ON published_article_tombstones
      BEGIN SELECT RAISE(ABORT, 'injected public tombstone failure'); END
    `).run();
    try {
      const deleted = await repository().deleteArticle(OWNER, ARTICLE_ID, DELETED_AT);
      expect(deleted.ok).toBe(false);
      const article = await proxy.env.DB.prepare(
        "SELECT deleted_at AS deletedAt FROM articles WHERE id = ?",
      )
        .bind(ARTICLE_ID)
        .first<{ deletedAt: number | null }>();
      expect(article?.deletedAt).toBeNull();
      const projection = await proxy.env.DB.prepare(
        "SELECT source_article_id AS sourceArticleId FROM published_articles WHERE site_slug = ? AND slug = ?",
      )
        .bind(SITE, "owned-article")
        .first<{ sourceArticleId: string }>();
      expect(projection?.sourceArticleId).toBe(ARTICLE_ID);
    } finally {
      await proxy.env.DB.prepare("DROP TRIGGER IF EXISTS fail_public_tombstone").run();
    }
  });

  it("公開記事を同じID・URL・本文のprojectionとして原子的に復元する", async () => {
    expect((await repository().saveArticle(OWNER, publishedArticleInput())).ok).toBe(true);
    expect((await repository().deleteArticle(OWNER, ARTICLE_ID, DELETED_AT)).ok).toBe(true);
    const hidden = await publicRepository().openSite(SITE);
    if (!hidden.ok || hidden.value === null) throw new Error("公開サイトを開けません。");
    expect(await hidden.value.findArticleBySlug("owned-article")).toEqual({
      ok: true,
      value: null,
    });

    const restored = await repository().restoreArticle(
      OWNER,
      ARTICLE_ID,
      new Date("2026-09-04T00:00:00.000Z"),
    );
    expect(restored.ok).toBe(true);
    const opened = await publicRepository().openSite(SITE);
    if (!opened.ok || opened.value === null) throw new Error("復元サイトを開けません。");
    const article = await opened.value.findArticleBySlug("owned-article");
    expect(article.ok && article.value).toMatchObject({
      slug: "owned-article",
      siteSlug: SITE,
      title: "公開する編集記事",
      sections: [
        {
          id: "bab_public_projection",
          paragraphs: ["編集aggregateから決定的に写した本文"],
        },
      ],
    });
    expect(await opened.value.findSourceArticleId("owned-article")).toEqual({
      ok: true,
      value: ARTICLE_ID,
    });
  });

  it("復元projectionの障害でaggregate復元と墓標削除をrollbackする", async () => {
    expect((await repository().saveArticle(OWNER, publishedArticleInput())).ok).toBe(true);
    expect((await repository().deleteArticle(OWNER, ARTICLE_ID, DELETED_AT)).ok).toBe(true);
    await proxy.env.DB.prepare(`
      CREATE TRIGGER fail_restore_projection
      BEFORE INSERT ON published_articles
      BEGIN SELECT RAISE(ABORT, 'injected restore projection failure'); END
    `).run();
    try {
      const restored = await repository().restoreArticle(
        OWNER,
        ARTICLE_ID,
        new Date("2026-09-04T00:00:00.000Z"),
      );
      expect(restored.ok).toBe(false);
      const article = await proxy.env.DB.prepare(
        "SELECT deleted_at AS deletedAt FROM articles WHERE id = ?",
      )
        .bind(ARTICLE_ID)
        .first<{ deletedAt: number | null }>();
      expect(article?.deletedAt).not.toBeNull();
      const tombstone = await proxy.env.DB.prepare(
        "SELECT workspace_id AS workspaceId FROM published_article_tombstones WHERE site_slug = ? AND slug = ?",
      )
        .bind(SITE, "owned-article")
        .first<{ workspaceId: string }>();
      expect(tombstone?.workspaceId).toBe(String(OWNER));
      const projection = await proxy.env.DB.prepare(
        "SELECT slug FROM published_articles WHERE site_slug = ? AND slug = ?",
      )
        .bind(SITE, "owned-article")
        .first();
      expect(projection).toBeNull();
    } finally {
      await proxy.env.DB.prepare("DROP TRIGGER IF EXISTS fail_restore_projection").run();
    }
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
      "INSERT INTO articles (id, workspace_id, site_slug, slug, article_template, type, title, status, published_at) VALUES ('bar_editing_only', ?, ?, 'editing-only', 'T1', 'ranking', '編集表にしかない公開印', 'published', unixepoch())",
    )
      .bind(String(OWNER), SITE)
      .run();

    const projectedOnly = {
      slug: "projection-only",
      siteSlug: SITE,
      type: "guide",
      title: "公開projectionにだけある記事",
      summary: "読者が読む正本の要約",
      categorySlug: "guide",
      publishedAt: "2026-09-02",
      updatedAt: "2026-09-02",
      author: { slug: "canonical-author", name: "正本著者", bio: "経歴", credentials: [] },
      disclosureRequired: false,
      sections: [{ id: "body", heading: "本文", paragraphs: ["公開projectionのみにある本文"] }],
    };
    const canonicalOwned = {
      ...projectedOnly,
      slug: "owned-article",
      title: "不一致では公開projectionが勝つ",
      summary: "編集aggregateの題名は公開読み取りに使わない",
      updatedAt: "2026-09-01",
      sections: [{ id: "body", heading: "正本本文", paragraphs: ["編集側と不一致の本文"] }],
    };
    for (const article of [projectedOnly, canonicalOwned]) {
      await proxy.env.DB.prepare(
        `INSERT INTO published_articles
          (site_slug, slug, workspace_id, type, title, summary, category_slug,
           author_slug, author_name, published_at, updated_at, article_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          article.siteSlug,
          article.slug,
          String(OWNER),
          article.type,
          article.title,
          article.summary,
          article.categorySlug,
          article.author.slug,
          article.author.name,
          article.publishedAt,
          article.updatedAt,
          JSON.stringify(article),
        )
        .run();
    }
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
    const editingOnly = await opened.value.findArticleBySlug("editing-only");
    const projectionOnly = await opened.value.findArticleBySlug("projection-only");
    const list = await opened.value.listPublished(10);
    const slots = await opened.value.listLayoutSlots();
    const bands = await opened.value.listLayoutBands();
    const parts = await opened.value.listDeliveryParts();
    const network = await opened.value.listNetwork();
    const tags = await opened.value.listTags();
    const composition = await readPublicSiteComposition(SITE, {
      source: "live",
      port: publicBlog,
    });

    expect(detail.ok && detail.value?.title).toBe("不一致では公開projectionが勝つ");
    expect(detail.ok && detail.value?.sections[0]?.paragraphs).toEqual([
      "編集側と不一致の本文",
    ]);
    expect(editingOnly.ok && editingOnly.value).toBeNull();
    expect(projectionOnly.ok && projectionOnly.value?.title).toBe("公開projectionにだけある記事");
    expect(list.ok && list.value.map((row) => row.slug)).toEqual([
      "projection-only",
      "owned-article",
    ]);
    expect(composition.ok && composition.value?.counts.articles).toBe(2);
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
