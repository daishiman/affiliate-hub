/**
 * @tier 2
 * @req REQ-A07, A6, A7
 * @types state-transition, boundary, tenant-isolation, db-migration
 *
 * feat-blog-ui-builder の受入:
 * - A6「ブログごとの掲載を記事単位で一覧でき、アフィリエイトから逆引きできる」
 * - A7「作成画面・保存後・公開面で表示される集合が一致する」
 *
 * ## この台帳が答える問い
 *
 * 「どこに出ているか」ではなく **「どこに出ていないか」**である。
 * 掲載 0 件の記事を数えられることが値打ちで、
 * 出ている場所の一覧はその副産物にすぎない（A6-3）。
 *
 * ## NULL の追跡コードを本気で検査する理由
 *
 * `tracking_code` は NULL を取りうる。SQL では `NULL = NULL` が真にならないので、
 * 素朴に `= ?` で消そうとすると **コード無しの掲載は一度作ったら二度と消せない**。
 * 一覧には出るのに消せない行が残り、掲載漏れの数が実態と合わなくなる。
 */
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import type { WorkspaceId } from "@/domain/shared";
import { createD1BlogAffiliatePlacementRepository } from "@/infrastructure/persistence/d1/blog-affiliate-placement-repository";
import { toAffiliatePlacementArticleBlock } from "@/application/adapters/expression-article-block";
import { migrationStatements } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

const OWNER = "ws_placement_owner" as WorkspaceId;
const OUTSIDER = "ws_placement_outsider" as WorkspaceId;
const SITE = "placement-blog";

let proxy: Proxy;
let seq = 0;

function repo() {
  return createD1BlogAffiliatePlacementRepository({
    db: drizzle(proxy.env.DB, { schema }),
    newId: () => `bap_${++seq}`,
  });
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
  await proxy.env.DB.prepare("DELETE FROM blog_affiliate_placement").run();
  await proxy.env.DB.prepare("DELETE FROM blog_article_block WHERE id LIKE 'bab_affiliate:%'").run();
  await proxy.env.DB.prepare("DELETE FROM articles WHERE id LIKE 'placement_article_%'").run();
});

describe("A6 ブログごとの掲載一覧", () => {
  it("記事単位でまとまる", async () => {
    const r = repo();
    await r.save({
      workspaceId: OWNER,
      placement: { siteSlug: SITE, articleSlug: "laptops", placement: "intro", position: 0 },
    });
    await r.save({
      workspaceId: OWNER,
      placement: {
        siteSlug: SITE,
        articleSlug: "laptops",
        placement: "conclusion",
        position: 1,
        trackingCode: "tc-a",
      },
    });
    await r.save({
      workspaceId: OWNER,
      placement: { siteSlug: SITE, articleSlug: "monitors", placement: "intro", position: 0 },
    });

    const got = await r.listBySite({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    const laptops = got.value.find((e) => e.articleSlug === "laptops");
    expect(laptops?.placements).toHaveLength(2);
    expect(got.value.find((e) => e.articleSlug === "monitors")?.placements).toHaveLength(1);
  });

  it("同じ記事の中は position 順に並ぶ", async () => {
    const r = repo();
    for (const [place, position] of [
      ["conclusion", 2],
      ["intro", 0],
      ["comparison", 1],
    ] as const) {
      await r.save({
        workspaceId: OWNER,
        placement: { siteSlug: SITE, articleSlug: "a", placement: place, position },
      });
    }
    const got = await repo().listBySite({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok && got.value[0]?.placements.map((p) => p.placement)).toEqual([
      "intro",
      "comparison",
      "conclusion",
    ]);
  });

  /**
   * **A6 の本体（T-A6-3）。**
   *
   * 掲載 0 件の記事を数えられること。台帳は「載っているもの」しか
   * 知らないので、記事の全体集合は呼び出し側が渡すしかない。
   * ここを台帳側で推測させると、記事を消した日に幽霊の行が残る。
   */
  it("掲載 0 件の記事も行として出る（掲載漏れが数えられる）", async () => {
    await repo().save({
      workspaceId: OWNER,
      placement: { siteSlug: SITE, articleSlug: "laptops", placement: "intro", position: 0 },
    });

    const got = await repo().listBySite({
      workspaceId: OWNER,
      siteSlug: SITE,
      knownArticleSlugs: ["laptops", "monitors", "keyboards"],
    });
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value).toHaveLength(3);
    const missing = got.value.filter((e) => e.placements.length === 0).map((e) => e.articleSlug);
    expect(missing).toEqual(["monitors", "keyboards"]);
  });

  it("記事の全体集合を渡さなければ、台帳にある記事だけ返る", async () => {
    await repo().save({
      workspaceId: OWNER,
      placement: { siteSlug: SITE, articleSlug: "laptops", placement: "intro", position: 0 },
    });
    const got = await repo().listBySite({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok && got.value.map((e) => e.articleSlug)).toEqual(["laptops"]);
  });

  it("他所の作業場所の掲載は出ない", async () => {
    await repo().save({
      workspaceId: OUTSIDER,
      placement: { siteSlug: SITE, articleSlug: "laptops", placement: "intro", position: 0 },
    });
    const got = await repo().listBySite({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok && got.value).toEqual([]);
  });
});

describe("A7 アフィリエイトからの逆引き", () => {
  beforeEach(async () => {
    const r = repo();
    await r.save({
      workspaceId: OWNER,
      placement: {
        siteSlug: "blog-a",
        articleSlug: "laptops",
        placement: "intro",
        position: 0,
        trackingCode: "tc-x",
      },
    });
    await r.save({
      workspaceId: OWNER,
      placement: {
        siteSlug: "blog-b",
        articleSlug: "monitors",
        placement: "conclusion",
        position: 0,
        trackingCode: "tc-x",
      },
    });
    await r.save({
      workspaceId: OWNER,
      placement: {
        siteSlug: "blog-b",
        articleSlug: "keyboards",
        placement: "intro",
        position: 0,
        trackingCode: "tc-y",
      },
    });
  });

  it("追跡コードから、ブログをまたいで掲載先が引ける", async () => {
    const got = await repo().listByAffiliate({ workspaceId: OWNER, trackingCode: "tc-x" });
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value.map((p) => `${p.siteSlug}/${p.articleSlug}`).sort()).toEqual([
      "blog-a/laptops",
      "blog-b/monitors",
    ]);
  });

  it("位置でも絞れる", async () => {
    const got = await repo().listByAffiliate({ workspaceId: OWNER, placement: "intro" });
    expect(got.ok && got.value).toHaveLength(2);
  });

  it("両方指定すると重ねて絞る（境界）", async () => {
    const got = await repo().listByAffiliate({
      workspaceId: OWNER,
      trackingCode: "tc-x",
      placement: "intro",
    });
    expect(got.ok && got.value.map((p) => p.articleSlug)).toEqual(["laptops"]);
  });

  /**
   * 絞り込み無しは全件。例外にしない。
   *
   * 例外にすると、一覧の初期表示のためだけに別の口が要る。
   * 口が 2 つに割れると、片方だけ作業場所の絞りを忘れる日が来る。
   */
  it("絞り込みを省くと全件返る", async () => {
    const got = await repo().listByAffiliate({ workspaceId: OWNER });
    expect(got.ok && got.value).toHaveLength(3);
  });

  it("他所の作業場所へは届かない", async () => {
    const got = await repo().listByAffiliate({ workspaceId: OUTSIDER, trackingCode: "tc-x" });
    expect(got.ok && got.value).toEqual([]);
  });
});

describe("保存と削除", () => {
  it("公開 CTA と台帳を同じ batch で保存し、台帳失敗時は両方を取り消す", async () => {
    const articleId = "placement_article_atomic";
    await proxy.env.DB.prepare(
      `INSERT INTO articles
        (id, slug, workspace_id, site_slug, article_template, type, title, status, author_name)
       VALUES (?, ?, ?, ?, 'T4', 'guide', '掲載テスト', 'published', '編集部')`,
    ).bind(articleId, "atomic", OWNER, SITE).run();
    const placement = {
      siteSlug: SITE,
      articleSlug: "atomic",
      placement: "conclusion",
      position: -1,
      trackingCode: "tc-batch",
    } as const;
    const publicArticleBlock = {
      articleId,
      block: toAffiliatePlacementArticleBlock({ workspaceId: OWNER, ...placement }),
    };
    await proxy.env.DB.prepare(
      `CREATE TRIGGER reject_negative_placement_batch
       BEFORE INSERT ON blog_affiliate_placement
       WHEN NEW.position < 0
       BEGIN SELECT RAISE(ABORT, 'negative_position'); END`,
    ).run();

    try {
      const failed = await repo().save({ workspaceId: OWNER, placement, publicArticleBlock });
      expect(failed.ok).toBe(false);
      const block = await proxy.env.DB.prepare(
        "SELECT id FROM blog_article_block WHERE id = ?",
      ).bind(publicArticleBlock.block.id).first();
      const ledger = await proxy.env.DB.prepare(
        "SELECT id FROM blog_affiliate_placement WHERE tracking_code = ?",
      ).bind("tc-batch").first();
      expect(block).toBeNull();
      expect(ledger).toBeNull();
    } finally {
      await proxy.env.DB.prepare("DROP TRIGGER reject_negative_placement_batch").run();
    }

    const savedPlacement = { ...placement, position: 0 };
    const savedBlock = {
      articleId,
      block: toAffiliatePlacementArticleBlock({ workspaceId: OWNER, ...savedPlacement }),
    };
    const saved = await repo().save({
      workspaceId: OWNER,
      placement: savedPlacement,
      publicArticleBlock: savedBlock,
    });
    expect(saved.ok).toBe(true);
    const [block, ledger] = await Promise.all([
      proxy.env.DB.prepare("SELECT id FROM blog_article_block WHERE id = ?")
        .bind(savedBlock.block.id)
        .first(),
      proxy.env.DB.prepare("SELECT id FROM blog_affiliate_placement WHERE tracking_code = ?")
        .bind("tc-batch")
        .first(),
    ]);
    expect(block).not.toBeNull();
    expect(ledger).not.toBeNull();
  });

  it("更新用 INSERT が失敗しても既存の掲載を消さない", async () => {
    const r = repo();
    const identity = {
      siteSlug: SITE,
      articleSlug: "laptops",
      placement: "intro",
      trackingCode: "tc-atomic",
    } as const;
    await r.save({ workspaceId: OWNER, placement: { ...identity, position: 1 } });
    await proxy.env.DB.prepare(
      `CREATE TRIGGER reject_negative_placement_position
       BEFORE INSERT ON blog_affiliate_placement
       WHEN NEW.position < 0
       BEGIN SELECT RAISE(ABORT, 'negative_position'); END`,
    ).run();

    try {
      const failed = await r.save({
        workspaceId: OWNER,
        placement: { ...identity, position: -1 },
      });
      expect(failed.ok).toBe(false);

      const got = await r.listBySite({ workspaceId: OWNER, siteSlug: SITE });
      expect(got.ok && got.value[0]?.placements).toEqual([
        { ...identity, position: 1 },
      ]);
    } finally {
      await proxy.env.DB.prepare("DROP TRIGGER reject_negative_placement_position").run();
    }
  });

  it("追跡コード無しの同一掲載を並行保存してもDB上は1件", async () => {
    const placement = {
      siteSlug: SITE,
      articleSlug: "laptops",
      placement: "intro",
      position: 0,
    } as const;

    const outcomes = await Promise.all([
      repo().save({ workspaceId: OWNER, placement }),
      repo().save({ workspaceId: OWNER, placement: { ...placement, position: 2 } }),
    ]);
    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);

    const rows = await proxy.env.DB.prepare(
      `SELECT position FROM blog_affiliate_placement
       WHERE workspace_id = ? AND site_slug = ? AND article_slug = ?
         AND placement = ? AND tracking_code IS NULL`,
    )
      .bind(OWNER, SITE, "laptops", "intro")
      .all<{ position: number }>();
    expect(rows.results).toHaveLength(1);
  });

  it("自然identityの重複をrepository外の書込みでもDBが拒む", async () => {
    const insert = (id: string) =>
      proxy.env.DB.prepare(
        `INSERT INTO blog_affiliate_placement
          (id, workspace_id, site_slug, article_slug, placement, tracking_code, position)
         VALUES (?, ?, ?, ?, ?, NULL, 0)`,
      )
        .bind(id, OWNER, SITE, "laptops", "intro")
        .run();

    await insert("direct-1");
    await expect(insert("direct-2")).rejects.toThrow(/UNIQUE constraint failed/i);
  });

  it("同じ記事・位置・追跡コードを二度保存しても増えない", async () => {
    const r = repo();
    const placement = {
      siteSlug: SITE,
      articleSlug: "laptops",
      placement: "intro",
      position: 0,
      trackingCode: "tc-a",
    } as const;
    await r.save({ workspaceId: OWNER, placement });
    await r.save({ workspaceId: OWNER, placement: { ...placement, position: 3 } });

    const got = await r.listBySite({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok && got.value[0]?.placements).toHaveLength(1);
    expect(got.ok && got.value[0]?.placements[0]?.position).toBe(3);
  });

  it("位置が同じでも追跡コードが違えば別の掲載（境界）", async () => {
    const r = repo();
    for (const code of ["tc-a", "tc-b"]) {
      await r.save({
        workspaceId: OWNER,
        placement: {
          siteSlug: SITE,
          articleSlug: "laptops",
          placement: "intro",
          position: 0,
          trackingCode: code,
        },
      });
    }
    const got = await r.listBySite({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok && got.value[0]?.placements).toHaveLength(2);
  });

  /**
   * **NULL の追跡コードを消せること。**
   *
   * `NULL = NULL` は SQL で真にならない。素朴に `= ?` を書くと
   * この行だけ永久に消えず、掲載漏れの数が実態と合わなくなる。
   */
  it("追跡コードの無い掲載を消せる（NULL の境界）", async () => {
    const r = repo();
    await r.save({
      workspaceId: OWNER,
      placement: { siteSlug: SITE, articleSlug: "laptops", placement: "intro", position: 0 },
    });
    await r.remove({
      workspaceId: OWNER,
      siteSlug: SITE,
      articleSlug: "laptops",
      placement: "intro",
    });

    const got = await r.listBySite({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok && got.value).toEqual([]);
  });

  it("追跡コード付きの掲載を消しても、コード無しの掲載は残る（境界）", async () => {
    const r = repo();
    await r.save({
      workspaceId: OWNER,
      placement: { siteSlug: SITE, articleSlug: "laptops", placement: "intro", position: 0 },
    });
    await r.save({
      workspaceId: OWNER,
      placement: {
        siteSlug: SITE,
        articleSlug: "laptops",
        placement: "intro",
        position: 1,
        trackingCode: "tc-a",
      },
    });
    await r.remove({
      workspaceId: OWNER,
      siteSlug: SITE,
      articleSlug: "laptops",
      placement: "intro",
      trackingCode: "tc-a",
    });

    const got = await r.listBySite({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok && got.value[0]?.placements).toHaveLength(1);
    expect(got.ok && got.value[0]?.placements[0]?.trackingCode).toBeUndefined();
  });

  it("他所の作業場所の掲載は消せない", async () => {
    await repo().save({
      workspaceId: OWNER,
      placement: { siteSlug: SITE, articleSlug: "laptops", placement: "intro", position: 0 },
    });
    await repo().remove({
      workspaceId: OUTSIDER,
      siteSlug: SITE,
      articleSlug: "laptops",
      placement: "intro",
    });

    const got = await repo().listBySite({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok && got.value[0]?.placements).toHaveLength(1);
  });
});
