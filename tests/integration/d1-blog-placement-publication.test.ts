/** @tier 2 @req REQ-BOPS06, REQ-BOPS07 @types state-transition, tenant-isolation, boundary */
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { parseProse } from "@/domain/blogops";
import type { ActorContext, WorkspaceId } from "@/domain/shared";
import type { SaveBlogArticleInput } from "@/application/ports/blog-ops";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { toAffiliatePlacementArticleBlock } from "@/application/adapters/expression-article-block";
import { createReviewBlogPlacementsUseCase } from "@/application/usecases/authoring/review-blog-placements";
import { createD1BlogOpsRepository } from "@/infrastructure/persistence/d1/blog-ops-repository";
import { createD1BlogAffiliatePlacementRepository } from "@/infrastructure/persistence/d1/blog-affiliate-placement-repository";
import { recordingAuditLog } from "../support/doubles";
import { sequentialIds } from "../support/blog-ops-fake";
import { migrationStatements } from "../support/migrations";

const OWNER = "ws_placement_public" as WorkspaceId;
const OUTSIDER = "ws_placement_outside" as WorkspaceId;
const SITE = "placement-public";
const NOW = new Date("2026-09-06T00:00:00Z");
const actor: ActorContext = { workspaceId: OWNER, userId: "user_placement" as ActorContext["userId"], roles: ["owner"], scopedBrandIds: [], isAiServiceAccount: false, identified: true };
type TestEnv = { DB: D1Database };
let proxy: Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;
let sequence = 0;
const db = () => drizzle(proxy.env.DB, { schema });
const articles = () => createD1BlogOpsRepository(db());
const ledger = () => createD1BlogAffiliatePlacementRepository({ db: db(), newId: () => `placement_${++sequence}` });
const placement = { siteSlug: SITE, articleSlug: "article", placement: "intro", position: 1, trackingCode: "buy-now" } as const;

function usecase() {
  return createReviewBlogPlacementsUseCase({ blogOps: articles(), placements: ledger(), auditLog: recordingAuditLog().port, ids: sequentialIds(), now: () => NOW });
}

async function seed(status: "draft" | "published" = "published") {
  const input: SaveBlogArticleInput = {
    id: "placement_article", siteSlug: SITE, slug: "article", template: "T1", title: "保持するタイトル", lead: "保持する導入",
    status, authorName: "編集部", categorySlug: status === "published" ? "guide" : null,
    publishedAt: status === "published" ? NOW : null, updatedAt: NOW,
    blocks: [{ id: "placement_body", kind: "summary-section", heading: "本文", body: "保持する本文", position: 0 }], tagIds: ["placement_tag"],
  };
  const result = await articles().saveArticle(OWNER, input);
  expect(result.ok, JSON.stringify(result)).toBe(true);
  return { ...input, expectedRevision: 1 };
}

async function snapshot() {
  const detail = await articles().findArticle(OWNER, "placement_article");
  const row = await proxy.env.DB.prepare("SELECT article_json FROM published_articles WHERE site_slug = ? AND slug = ?").bind(SITE, "article").first<{ article_json: string }>();
  const listed = await ledger().listByAffiliate({ workspaceId: OWNER });
  if (!detail.ok || !listed.ok) throw new Error("snapshot failed");
  return { detail: detail.value, published: row === null ? null : JSON.parse(row.article_json) as PublishedArticle, placements: listed.value };
}

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({ configPath: "wrangler.jsonc", environment: "dev", persist: false });
  for (const statement of migrationStatements()) await proxy.env.DB.prepare(statement).run();
}, 60_000);
afterAll(async () => { await proxy?.dispose(); });
beforeEach(async () => {
  for (const table of ["published_article_tombstones", "published_articles", "blog_affiliate_placement", "blog_article_tag", "blog_article_block", "articles", "blog_tag", "site_blueprints"]) {
    await proxy.env.DB.prepare(`DELETE FROM ${table}`).run();
  }
  await proxy.env.DB.prepare("INSERT INTO site_blueprints (id, workspace_id, slug, name, pattern, blueprint_json) VALUES ('placement_site', ?, ?, '配置ブログ', 'hybrid', ?)")
    .bind(OWNER, SITE, JSON.stringify({ categories: [{ slug: "guide" }] })).run();
  await proxy.env.DB.prepare("INSERT INTO blog_tag (id, workspace_id, site_slug, slug, name, description, kind) VALUES ('placement_tag', ?, ?, 'keep', '保持タグ', '', 'topic')").bind(OWNER, SITE).run();
});

describe("配置・記事集約・公開JSONの原子的同期", () => {
  it("保存・位置変更・削除が読者JSONと版番へ反映され本文/タグを保持する", async () => {
    await seed();
    for (const [action, position, revision, count] of [["save", 1, 2, 1], ["save", 5, 3, 1], ["remove", 5, 4, 0]] as const) {
      const result = await usecase().execute(actor, { ...placement, action, position });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      const state = await snapshot();
      expect(state.detail?.article.revision).toBe(revision);
      expect(state.detail?.tagIds).toEqual(["placement_tag"]);
      expect(state.detail?.blocks[0]?.body).toBe("保持する本文");
      expect(state.detail?.blocks.filter((block) => block.id.startsWith("bab_affiliate:"))).toHaveLength(count);
      const ctas = state.published?.sections.flatMap((section) => parseProse(section.formattedBody?.source ?? "")).filter((block) => block.kind === "cta-button");
      expect(ctas).toHaveLength(count);
      if (count > 0) expect(ctas?.[0]).toMatchObject({ kind: "cta-button", href: "/go/buy-now" });
      expect(state.placements).toHaveLength(count);
      if (count > 0) expect(state.placements[0]?.position).toBe(position);
    }
  });

  it("下書きの配置変更はAIにも許可し、記事の公開は行わない", async () => {
    await seed("draft");
    for (const action of ["save", "remove"] as const) {
      expect((await usecase().execute({ ...actor, isAiServiceAccount: true }, { ...placement, action })).ok).toBe(true);
      const state = await snapshot();
      expect(state.published).toBeNull();
      expect(state.detail?.article.status).toBe("draft");
    }
  });

  it("別配置を後から追加/更新しても保存位置順を読者JSONへ反映する", async () => {
    await seed();
    for (const slot of ["conclusion", "intro", "conclusion"] as const) {
      expect((await usecase().execute(actor, { ...placement, placement: slot, action: "save" })).ok).toBe(true);
      const state = await snapshot();
      expect(state.published?.sections.map((section) => section.id)).toEqual(state.detail?.blocks.map((block) => block.id));
    }
  });

  it.each(["save", "remove"] as const)("サイト管理権限のない%sも全状態を保つ", async (action) => {
    await seed("draft");
    const before = await snapshot();
    const result = await usecase().execute({ ...actor, roles: ["writer"] }, { ...placement, action });
    expect(result.ok ? null : result.error.code).toBe("FORBIDDEN");
    expect(await snapshot()).toEqual(before);
  });

  it.each(["save", "remove"] as const)("同tenantの別記事集約を%sへ混ぜられない", async (action) => {
    const original = await seed();
    const before = await snapshot();
    const articleUpdate = { ...original, id: "other_article" };
    const result = action === "save"
      ? await ledger().save({ workspaceId: OWNER, placement, articleUpdate })
      : await ledger().remove({ workspaceId: OWNER, ...placement, articleUpdate });
    expect(result.ok).toBe(false);
    expect(await snapshot()).toEqual(before);
  });

  it.each(["save", "remove"] as const)("公開権限なしの%sを拒否し全状態を保つ", async (action) => {
    await seed();
    const before = await snapshot();
    const result = await usecase().execute({ ...actor, isAiServiceAccount: true }, { ...placement, action });
    expect(result.ok ? null : result.error.code).toBe("FORBIDDEN");
    expect(await snapshot()).toEqual(before);
  });

  it.each(["save", "remove"] as const)("他tenantの%sは所有記事を変更できない", async (action) => {
    const articleUpdate = await seed();
    const before = await snapshot();
    const result = action === "save"
      ? await ledger().save({ workspaceId: OUTSIDER, placement, articleUpdate })
      : await ledger().remove({ workspaceId: OUTSIDER, ...placement, articleUpdate });
    expect(result.ok).toBe(false);
    expect(await snapshot()).toEqual(before);
  });

  it.each(["save", "remove"] as const)("現存記事の%sは台帳だけの互換経路へ戻れない", async (action) => {
    await seed();
    const before = await snapshot();
    const result = action === "save"
      ? await ledger().save({ workspaceId: OWNER, placement })
      : await ledger().remove({ workspaceId: OWNER, ...placement });
    expect(result.ok).toBe(false);
    expect(await snapshot()).toEqual(before);
  });

  it.each(["save", "remove"] as const)("削除済記事の%sも孤児扱いせず復元用CTAとの不一致を防ぐ", async (action) => {
    await seed();
    expect((await usecase().execute(actor, { ...placement, action: "save" })).ok).toBe(true);
    expect((await articles().deleteArticle(OWNER, "placement_article", NOW)).ok).toBe(true);
    const before = await snapshot();
    const result = action === "save"
      ? await ledger().save({ workspaceId: OWNER, placement })
      : await ledger().remove({ workspaceId: OWNER, ...placement });
    expect(result.ok).toBe(false);
    expect(await snapshot()).toEqual(before);
    expect((await articles().restoreArticle(OWNER, "placement_article", NOW)).ok).toBe(true);
    const restored = await snapshot();
    expect(restored.placements).toHaveLength(1);
    expect(restored.detail?.blocks).toHaveLength(2);
  });

  it.each(["save", "remove"] as const)("本文保存後の古い%sは競合し本文を巻き戻さない", async (action) => {
    const stale = await seed();
    const fresh = { ...stale, title: "先に保存したタイトル", blocks: [{ ...stale.blocks[0]!, body: "先に保存した本文" }] };
    expect((await articles().saveArticle(OWNER, fresh)).ok).toBe(true);
    const before = await snapshot();
    const articleUpdate = { ...stale, blocks: action === "save" ? [...stale.blocks, toAffiliatePlacementArticleBlock({ workspaceId: OWNER, ...placement })] : stale.blocks };
    const result = action === "save"
      ? await ledger().save({ workspaceId: OWNER, placement, articleUpdate })
      : await ledger().remove({ workspaceId: OWNER, ...placement, articleUpdate });
    expect(result.ok ? null : result.error.code).toBe("CONFLICT");
    expect(await snapshot()).toEqual(before);
  });

  it.each(["save", "remove"] as const)("遅れた復元は先行復元後の配置%sと公開JSONを巻き戻さない", async (action) => {
    await seed();
    if (action === "remove") expect((await usecase().execute(actor, { ...placement, action: "save" })).ok).toBe(true);
    expect((await articles().deleteArticle(OWNER, "placement_article", NOW)).ok).toBe(true);
    const actual = db();
    let winner: Awaited<ReturnType<typeof snapshot>> | undefined;
    const delayedDb = new Proxy(actual, { get(target, property, receiver) {
      if (property === "batch") return async (...args: Parameters<typeof actual.batch>) => {
        expect((await articles().restoreArticle(OWNER, "placement_article", NOW)).ok).toBe(true);
        expect((await usecase().execute(actor, { ...placement, action })).ok).toBe(true);
        winner = await snapshot();
        return target.batch(...args);
      };
      return Reflect.get(target, property, receiver);
    } });

    const loser = await createD1BlogOpsRepository(delayedDb).restoreArticle(OWNER, "placement_article", NOW);
    expect(winner).toBeDefined();
    expect(await snapshot()).toEqual(winner);
    expect(loser).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(winner?.placements).toHaveLength(action === "save" ? 1 : 0);
    expect(winner?.detail?.blocks).toHaveLength(action === "save" ? 2 : 1);
  });

  it("同時刻の復元・再削除を経た記事も古い復元で再公開しない", async () => {
    await seed();
    expect((await articles().deleteArticle(OWNER, "placement_article", NOW)).ok).toBe(true);
    const actual = db();
    let winner: Awaited<ReturnType<typeof snapshot>> | undefined;
    const delayedDb = new Proxy(actual, { get(target, property, receiver) {
      if (property === "batch") return async (...args: Parameters<typeof actual.batch>) => {
        expect((await articles().restoreArticle(OWNER, "placement_article", NOW)).ok).toBe(true);
        expect((await articles().deleteArticle(OWNER, "placement_article", NOW)).ok).toBe(true);
        winner = await snapshot();
        return target.batch(...args);
      };
      return Reflect.get(target, property, receiver);
    } });

    const loser = await createD1BlogOpsRepository(delayedDb).restoreArticle(OWNER, "placement_article", NOW);
    expect(winner).toBeDefined();
    expect(await snapshot()).toEqual(winner);
    expect(loser).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(winner?.detail).toBeNull();
    expect(winner?.published).toBeNull();
  });

  it("配置保存後の古い本文保存も競合し新しいCTAを消さない", async () => {
    const stale = await seed();
    expect((await usecase().execute(actor, { ...placement, action: "save" })).ok).toBe(true);
    const before = await snapshot();
    const result = await articles().saveArticle(OWNER, stale);
    expect(result.ok ? null : result.error.code).toBe("CONFLICT");
    expect(await snapshot()).toEqual(before);
  });

  it("同じ版を読んだ本文更新と配置更新の並行実行では一方だけを確定する", async () => {
    const original = await seed();
    const articleUpdate = { ...original, blocks: [...original.blocks, toAffiliatePlacementArticleBlock({ workspaceId: OWNER, ...placement })] };
    const results = await Promise.all([
      articles().saveArticle(OWNER, { ...original, title: "本文更新の勝者" }),
      ledger().save({ workspaceId: OWNER, placement, articleUpdate }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({ error: { code: "CONFLICT" } });
    const state = await snapshot();
    expect(state.detail?.article.revision).toBe(2);
    const placementWon = results[1]!.ok;
    expect(state.placements).toHaveLength(placementWon ? 1 : 0);
    expect(state.detail?.blocks).toHaveLength(placementWon ? 2 : 1);
    expect(state.published?.title).toBe(placementWon ? original.title : "本文更新の勝者");
  });

  it.each(["save", "remove"] as const)("孤児%sの事前確認後に記事が作られても台帳だけを書き換えない", async (action) => {
    if (action === "remove") expect((await ledger().save({ workspaceId: OWNER, placement })).ok).toBe(true);
    const actual = db();
    let seeded = false;
    const guardedDb = new Proxy(actual, { get(target, property, receiver) {
      if (property === "batch") return async (...args: Parameters<typeof actual.batch>) => {
        if (!seeded) { seeded = true; await seed(); }
        return target.batch(...args);
      };
      return Reflect.get(target, property, receiver);
    } });
    const r = createD1BlogAffiliatePlacementRepository({ db: guardedDb, newId: () => `placement_race_${++sequence}` });
    const result = action === "save" ? await r.save({ workspaceId: OWNER, placement }) : await r.remove({ workspaceId: OWNER, ...placement });
    expect(seeded).toBe(true);
    expect(result.ok).toBe(false);
    const state = await snapshot();
    expect(state.detail?.article.revision).toBe(1);
    expect(state.placements).toHaveLength(action === "remove" ? 1 : 0);
  });

  it.each(["save", "remove"] as const)("%sで台帳が失敗したら公開JSON・版番・本文をrollbackする", async (action) => {
    await seed();
    if (action === "remove") expect((await usecase().execute(actor, { ...placement, action: "save" })).ok).toBe(true);
    const before = await snapshot();
    await proxy.env.DB.prepare(`CREATE TRIGGER reject_placement BEFORE ${action === "save" ? "INSERT" : "DELETE"} ON blog_affiliate_placement BEGIN SELECT RAISE(ABORT, 'injected placement failure'); END`).run();
    try {
      expect((await usecase().execute(actor, { ...placement, action })).ok).toBe(false);
      expect(await snapshot()).toEqual(before);
    } finally { await proxy.env.DB.prepare("DROP TRIGGER reject_placement").run(); }
  });

  it.each(["save", "remove"] as const)("%sで公開JSONが失敗したら台帳・版番・本文もrollbackする", async (action) => {
    await seed();
    if (action === "remove") expect((await usecase().execute(actor, { ...placement, action: "save" })).ok).toBe(true);
    const before = await snapshot();
    await proxy.env.DB.prepare("CREATE TRIGGER reject_projection BEFORE INSERT ON published_articles BEGIN SELECT RAISE(ABORT, 'injected projection failure'); END").run();
    try {
      expect((await usecase().execute(actor, { ...placement, action })).ok).toBe(false);
      expect(await snapshot()).toEqual(before);
    } finally { await proxy.env.DB.prepare("DROP TRIGGER reject_projection").run(); }
  });
});
