/**
 * @tier 2
 * @req REQ-E13, REQ-TS07
 * @types db-migration, tenant-isolation, audit-log
 *
 * 受信箱から `affiliate_links` へ書き、**公開記事のカードに出るまで**を
 * 本物の D1 と本物のマイグレーションで一周させる。
 *
 * --- なぜこれが要るのか ---
 * `affiliate_links` は長いあいだ読む側しか無かった。記事の組み立てはこの表を
 * 引くので、表が空なら成果リンクが 1 件も出ない記事が「正しく公開できた」形で出る。
 * 書き口を足したいま、確かめるべきは次の 3 つで、どれも**この段でしか出ない**:
 *
 *   1. マイグレーションが `affiliate_links` を本当に作れるか
 *      （行は `product_name` を必須にしている。写しを渡し忘れると、ここで落ちる）
 *   2. 書いた行が、**別の口**（Editorial の読み口）から読み戻せるか
 *   3. 読み戻した写しが、公開記事のカードまで届くか
 *
 * 2 と 3 を分けて書くのは、書く口（Commercial）と読む口（Editorial）が
 * 別の実装だからである。片方だけを見ると、書けているのに記事に出ない、
 * あるいは記事に出ているのに保存先が空、を見逃す。
 *
 * --- ここで見ないこと ---
 * 権限や入力検証の網羅は単体側（`tests/application/register-affiliate-link.test.ts`）。
 * ここは 1 本の道が端から端まで通ることと、作業場所の境界だけを見る。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）、
 *       docs/spec/01-要求仕様書-v1.0.md §19.2 / REQ-E13、
 *       tasks/task-publish-article-affiliate-links.md
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { toProductCards } from "@/application/read-models/article-offer";
import {
  createMatchLinkIngestionUseCase,
  createResolveLinkIngestionUseCase,
  createSubmitAffiliateUrlUseCase,
  type ManageLinkInboxDeps,
} from "@/application/usecases/monetization/manage-link-inbox";
import {
  createRegisterAffiliateLinkUseCase,
  type RegisterAffiliateLinkDeps,
} from "@/application/usecases/monetization/register-affiliate-link";
import type { EditorialArticleOfferPort } from "@/application/ports/site";
import { captureProductSnapshot, createAffiliateLink } from "@/domain/monetization";
import type {
  ActorContext,
  AffiliateLinkId,
  AffiliateProgramId,
  ProductId,
} from "@/domain/shared";
import { taggedString } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { anOutsider, anOwner } from "../support/actors";

/** 使う結び付きは D1 だけ。`CloudflareEnv` 全体を要求しない。 */
type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let inboxDeps: ManageLinkInboxDeps;
let registerDeps: RegisterAffiliateLinkDeps;
let offers: EditorialArticleOfferPort;

const owner: ActorContext = anOwner({ workspaceId: SAMPLE_WORKSPACE_ID });

/** 見本にある提携プログラムと商品。受信箱を `matched` まで進めるのに要る。 */
const PROGRAM_ID = "prg_amazon_pc";
const PRODUCT_ID = "prd_sample_1";

function migrationStatements(): readonly string[] {
  const dir = path.resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(files.length).toBeGreaterThan(0);
  return files.flatMap((file) =>
    readFileSync(path.join(dir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s !== ""),
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

  /*
   * 分解して組み直すと、商業データの印が落ちる（印は入れ物ごと持ち回る）。
   * `createDeps` が返したものをそのまま渡す。
   *
   * 記録も本物の保存先を使う。差し替えると、この段でしか出ない
   * 「リンクは書けるが記録が書けない」食い違いを見逃す。
   */
  const all = createDeps({ db: drizzle(proxy.env.DB, { schema }) });
  inboxDeps = {
    inbox: all.linkInbox,
    programs: all.affiliatePrograms,
    ids: all.ids,
    events: all.events,
    auditLog: all.auditLog,
    now: () => new Date(),
  };
  registerDeps = {
    inbox: all.linkInbox,
    links: all.affiliateLinks,
    ids: all.ids,
    auditLog: all.auditLog,
    now: () => new Date(),
  };
  offers = all.articleOffers;
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM blog_affiliate_placement").run();
  await proxy.env.DB.prepare("DELETE FROM affiliate_links").run();
  await proxy.env.DB.prepare("DELETE FROM link_ingestions").run();
  await proxy.env.DB.prepare("DELETE FROM link_ingestion_url_claims").run();
  await proxy.env.DB.prepare("DELETE FROM audit_logs").run();
});

/** 受信箱に 1 本入れて `matched` まで進める。本物のユースケースで進める。 */
async function matchedIngestion(url: string): Promise<string> {
  const submitted = await createSubmitAffiliateUrlUseCase(inboxDeps).execute(owner, {
    url,
    source: "paste",
  });
  if (!submitted.ok) throw submitted.error;
  const id = submitted.value.item.id;

  const resolved = await createResolveLinkIngestionUseCase(inboxDeps).execute(owner, {
    linkIngestionId: id,
    programId: PROGRAM_ID,
  });
  if (!resolved.ok) throw resolved.error;

  const matched = await createMatchLinkIngestionUseCase(inboxDeps).execute(owner, {
    linkIngestionId: id,
    productId: PRODUCT_ID,
  });
  if (!matched.ok) throw matched.error;
  return id;
}

const register = () => createRegisterAffiliateLinkUseCase(registerDeps);

describe("マイグレーションそのもの", () => {
  it("成果リンクの表を作り、商品名の欄を必須にしている", async () => {
    const tables = await proxy.env.DB.prepare(
      "select name from sqlite_master where type = 'table'",
    ).all<{ name: string }>();
    expect(tables.results.map((r) => r.name)).toContain("affiliate_links");

    const columns = await proxy.env.DB.prepare("pragma table_info(affiliate_links)").all<{
      name: string;
      notnull: number;
    }>();
    const productName = columns.results.find((c) => c.name === "product_name");
    expect(productName).toBeDefined();
    /*
     * **必須のままにしておく。** ここを緩めると、商品名の無い行が入り、
     * 読者のカードに名前が出ないまま記事が公開される。
     * 名前を必ず渡させるのは `save(link, snapshot)` の形（第 2 引数）で、
     * この列の必須はその最後の砦になる。
     */
    expect(productName?.notnull).toBe(1);
  });

  it("報酬額の欄をこの表に持たせていない", async () => {
    // 報酬をここへ置くと、記事の組み立て（Editorial）が引く行に金額が載る。
    const columns = await proxy.env.DB.prepare("pragma table_info(affiliate_links)").all<{
      name: string;
    }>();
    const names = columns.results.map((c) => c.name);
    expect(names.some((n) => n.includes("commission") || n.includes("reward"))).toBe(false);
  });
});

describe("登録から公開記事のカードまで（1 本の道）", () => {
  it("受信箱の 1 件を登録すると、記事の写しとして読み戻せる", async () => {
    const url = "https://af.example.com/click?a=1&asp=amazon";
    const ingestionId = await matchedIngestion(url);

    const done = await register().execute(owner, {
      linkIngestionId: ingestionId,
      productName: "Alpha Studio 15",
      brand: "Alpha",
      oneLine: "書き出しの速さと持ち運びやすさの釣り合いが取れた機種。",
    });
    if (!done.ok) throw done.error;

    // 行が本当に入っている。返り値だけ見ると、保存が失敗していても気づけない。
    const rows = await proxy.env.DB.prepare(
      "select id, product_name, brand, one_line, original_url, workspace_id from affiliate_links",
    ).all<{
      id: string;
      product_name: string;
      brand: string | null;
      one_line: string | null;
      original_url: string;
      workspace_id: string;
    }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]?.product_name).toBe("Alpha Studio 15");
    expect(rows.results[0]?.brand).toBe("Alpha");
    // **URL を 1 文字も変えない。** 加工した URL では成果が計上されない。
    expect(rows.results[0]?.original_url).toBe(url);
    expect(rows.results[0]?.workspace_id).toBe(String(SAMPLE_WORKSPACE_ID));

    /*
     * ここからが**別の口**。書いたのは Commercial の口で、
     * 記事が読むのは Editorial の口（報酬を持てない形）である。
     */
    const linkId = taggedString<"AffiliateLinkId">(done.value.affiliateLinkId) as AffiliateLinkId;
    const read = await offers.listByIds(owner.workspaceId, [linkId], new Date());
    if (!read.ok) throw read.error;
    expect(read.value).toHaveLength(1);
    expect(read.value[0]?.productName).toBe("Alpha Studio 15");
    // 期限も停止も無いので、読者へ出す URL が付く。
    expect(read.value[0]?.destinationUrl).toBe(url);
    expect(read.value[0]?.blockedReason).toBeUndefined();

    // 公開記事のカードまで。ここが空だと、記事は出るのに買う導線が無い。
    const cards = toProductCards(read.value);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.name).toBe("Alpha Studio 15");
    expect(cards[0]?.affiliateUrl).toBe(url);
  });

  it("ブランドと 1 文を空で登録しても、カードは名前つきで出る", async () => {
    const url = "https://af.example.com/click?a=2&asp=amazon";
    const ingestionId = await matchedIngestion(url);

    const done = await register().execute(owner, {
      linkIngestionId: ingestionId,
      productName: "Delta Light 13",
    });
    if (!done.ok) throw done.error;

    const linkId = taggedString<"AffiliateLinkId">(done.value.affiliateLinkId) as AffiliateLinkId;
    const read = await offers.listByIds(owner.workspaceId, [linkId], new Date());
    if (!read.ok) throw read.error;
    const cards = toProductCards(read.value);
    expect(cards[0]?.name).toBe("Delta Light 13");
    // 空欄は空文字として出る。**「不明」などを保存先が作らない。**
    expect(cards[0]?.brand).toBe("");
    expect(cards[0]?.oneLine).toBe("");
  });

  it("同じ URL を 2 度登録しようとしても、行は 1 本のまま", async () => {
    const url = "https://af.example.com/click?a=3&asp=amazon";
    const first = await matchedIngestion(url);
    const done = await register().execute(owner, {
      linkIngestionId: first,
      productName: "Alpha Studio 15",
    });
    if (!done.ok) throw done.error;

    // 2 本目を作ると、記事に同じ商品が 2 枚並び、クリックが 2 つの合言葉へ割れる。
    const again = await register().execute(owner, {
      linkIngestionId: first,
      productName: "Alpha Studio 15",
    });
    expect(again.ok).toBe(false);

    const count = await proxy.env.DB.prepare(
      "select count(*) as n from affiliate_links",
    ).first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it("同じ URL の同時保存は、DB境界で1本の正本へ収束する", async () => {
    const url = "https://af.example.com/click?a=atomic&asp=amazon";
    const now = new Date("2026-08-27T00:00:00.000Z");
    const snapshot = captureProductSnapshot({
      productName: "Alpha Studio 15",
      brand: "Alpha",
      oneLine: null,
    });
    if (!snapshot.ok) throw snapshot.error;
    const link = (id: string) => createAffiliateLink({
      id: taggedString<"AffiliateLinkId">(id) as AffiliateLinkId,
      workspaceId: owner.workspaceId,
      programId: taggedString<"AffiliateProgramId">(PROGRAM_ID) as AffiliateProgramId,
      productId: taggedString<"ProductId">(PRODUCT_ID) as ProductId,
      originalUrl: url,
      trackingRef: `ref_${id}`,
      createdAt: now,
      expiresAt: null,
    });
    const first = link("al_atomic_1");
    const second = link("al_atomic_2");
    if (!first.ok || !second.ok) throw new Error("試験用リンクを作れません");

    const [left, right] = await Promise.all([
      registerDeps.links.createIfNoUsableUrl(first.value, snapshot.value, now),
      registerDeps.links.createIfNoUsableUrl(second.value, snapshot.value, now),
    ]);
    if (!left.ok || !right.ok) throw new Error("同時保存に失敗しました");
    expect([left.value.created, right.value.created].filter(Boolean)).toHaveLength(1);
    expect(String(left.value.link.id)).toBe(String(right.value.link.id));
    const count = await proxy.env.DB.prepare(
      "select count(*) as n from affiliate_links where original_url = ?",
    ).bind(url).first<{ n: number }>();
    expect(count?.n).toBe(1);
  });
});

describe("作業場所の境界", () => {
  it("掲載先の逆引きはworkspaceを越えず、active/removedを保ちlegacy nullを誤結合しない", async () => {
    const outsider = anOutsider();
    await proxy.env.DB.prepare(
      `INSERT INTO affiliate_links
        (id, workspace_id, program_id, product_name, original_url, tracking_ref)
       VALUES
        ('al_placement_owner', ?, 'prg_owner', '所有者の商品', 'https://owner.example/link', 'ref_owner'),
        ('al_placement_other', ?, 'prg_other', '別会社の商品', 'https://other.example/link', 'ref_other')`,
    )
      .bind(String(owner.workspaceId), String(outsider.workspaceId))
      .run();
    await proxy.env.DB.prepare(
      `INSERT INTO blog_affiliate_placement
        (id, workspace_id, affiliate_link_id, site_slug, article_slug, block_id, placement, status, position)
       VALUES
        ('bap_owner_active', ?, 'al_placement_owner', 'owner-site', 'owner-article', 'bab_pick', 'pick-section', 'active', 0),
        ('bap_owner_removed', ?, 'al_placement_owner', 'owner-site', 'old-article', 'bab_old', 'summary-section', 'removed', 1),
        ('bap_other_active', ?, 'al_placement_other', 'other-site', 'other-article', 'bab_other', 'pick-section', 'active', 0),
        ('bap_owner_legacy', ?, NULL, 'owner-site', 'legacy-article', NULL, 'legacy', 'active', 0)`,
    )
      .bind(
        String(owner.workspaceId),
        String(owner.workspaceId),
        String(outsider.workspaceId),
        String(owner.workspaceId),
      )
      .run();

    const result = await registerDeps.links.listWithSnapshot(owner.workspaceId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(String(result.value[0]?.link.id)).toBe("al_placement_owner");
    expect(result.value[0]?.placements?.map((placement) => [
      placement.placementId,
      placement.status,
      placement.articleSlug,
    ])).toEqual([
      ["bap_owner_active", "active", "owner-article"],
      ["bap_owner_removed", "removed", "old-article"],
    ]);
    expect(JSON.stringify(result.value)).not.toContain("other-article");
    expect(JSON.stringify(result.value)).not.toContain("legacy-article");
  });

  it("別の作業場所からは、登録した成果リンクを引けない", async () => {
    const url = "https://af.example.com/click?a=4&asp=amazon";
    const ingestionId = await matchedIngestion(url);
    const done = await register().execute(owner, {
      linkIngestionId: ingestionId,
      productName: "Alpha Studio 15",
    });
    if (!done.ok) throw done.error;

    const linkId = taggedString<"AffiliateLinkId">(done.value.affiliateLinkId) as AffiliateLinkId;
    // ID は本物。違うのは作業場所だけ。**権限ではなく境界を測る**ので、
    // 権限を持った別の作業場所の人で確かめる。
    const outsider = anOutsider();
    const read = await offers.listByIds(outsider.workspaceId, [linkId], new Date());
    if (!read.ok) throw read.error;
    expect(read.value).toHaveLength(0);
  });

  it("別の作業場所の人は、受信箱の ID を知っていても登録できない", async () => {
    const url = "https://af.example.com/click?a=5&asp=amazon";
    const ingestionId = await matchedIngestion(url);

    const result = await register().execute(anOutsider(), {
      linkIngestionId: ingestionId,
      productName: "Alpha Studio 15",
    });
    expect(result.ok).toBe(false);

    const count = await proxy.env.DB.prepare(
      "select count(*) as n from affiliate_links",
    ).first<{ n: number }>();
    expect(count?.n).toBe(0);
  });
});

describe("誰がやったかの記録", () => {
  it("登録の記録が、本物の保存先に残る", async () => {
    const url = "https://af.example.com/click?a=6&asp=amazon";
    const ingestionId = await matchedIngestion(url);
    const done = await register().execute(owner, {
      linkIngestionId: ingestionId,
      productName: "Alpha Studio 15",
    });
    if (!done.ok) throw done.error;

    /*
     * **`target_type` で絞る。** 受け取り（`submit`）も同じ `action` を使い、
     * そちらの対象は `link_ingestion` である。`action` だけで数えると、
     * 受け取りの記録を登録の記録と取り違えて、登録が記録されていなくても緑になる。
     */
    const rows = await proxy.env.DB.prepare(
      "select action, target_type, target_id, after_json from audit_logs where action = 'affiliate_link.created' and target_type = 'affiliate_link'",
    ).all<{ action: string; target_type: string; target_id: string; after_json: string | null }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]?.target_id).toBe(done.value.affiliateLinkId);
    expect(rows.results[0]?.after_json ?? "").toContain("Alpha Studio 15");
    // **URL 全体は残さない。** 成果の割り当て先が URL に入っている。
    expect(rows.results[0]?.after_json ?? "").not.toContain("https://");
  });
});
