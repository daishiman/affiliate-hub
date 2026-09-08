/** @tier 2 @req REQ-E13, REQ-P09 @types db-migration, idempotency, tenant-isolation, state-transition */
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import type {
  ClickTrackingPort,
  RedirectResolverPort,
  TrackingCoveragePort,
} from "@/application/ports/analytics";
import type {
  EditorialPublishedArticleWriterPort,
  EditorialPublishedContentPort,
} from "@/application/ports/site";
import type { PublishedArticle } from "@/application/read-models/published-article";
import * as schema from "@/db/schema";
import { resolveRedirect } from "@/domain/monetization";
import { asWorkspaceId, type WorkspaceId } from "@/domain/shared";
import {
  createD1PublishedArticleWriter,
  createD1ContentRepository,
} from "@/infrastructure/persistence/d1/published-article-repository";
import { createD1SiteRepository } from "@/infrastructure/persistence/d1/site-repository";
import {
  createD1RedirectResolver,
  createD1TrackingCoverage,
  createD1TrackingLinkIssuer,
  createRedirectClickTracking,
} from "@/infrastructure/persistence/d1/redirect-repository";
import {
  createD1TelemetryMetricsRepository,
  createD1TelemetrySink,
} from "@/infrastructure/persistence/d1/telemetry-repository";
import { withTrackingLinkIssuance } from "@/infrastructure/persistence/tracking-issuing-writer";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { migrationStatements } from "../support/migrations";

/**
 * 記事を出したときに合言葉が発行され、押されたクリックが
 * **持ち主の作業場所で数えられる**ところまでを、本物の D1 で通す。
 *
 * --- なぜここまで通すのか ---
 * 部品ごとには全部そろっていたのに、実運用では突合できるクリックが 1 件も
 * 記録されていなかった。読む側だけが完成していて、写しを書く経路が
 * 1 か所も無かったからである。**部品が在ることと、経路がつながっていることは別**で、
 * つながっていないことは画面から一切見えない（ASP の URL が黙って出るだけ）。
 *
 * --- 作業場所の往復を、ここで機械に止めさせる ---
 * 「記録は貯まっているのに管理画面は 0」は、残課題 25 と 56 で 2 回起きている。
 * 画面は正常に見えるので、いちばん切り分けにくい。3 回目を人の注意で止めるのは
 * 諦めて、**書いた身元で読み直して 1 件になること**と、
 * **読者の身元では 0 件になること**を同じテストで固定する。
 * 片方だけだと、全部を同じ作業場所へ書く実装（＝越境）でも緑になる。
 *
 * 規範: docs/spec/03-分析・解析基盤仕様.md §1.1 / §1.2
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let writer: EditorialPublishedArticleWriterPort;
let content: EditorialPublishedContentPort;
let resolver: RedirectResolverPort;
let coverage: TrackingCoveragePort;
let clicks: ClickTrackingPort;
let metrics: ReturnType<typeof createD1TelemetryMetricsRepository>;

/** そのブログを持っている側。読者の身元（所属なし）とは別物。 */
const owner = SAMPLE_WORKSPACE_ID as WorkspaceId;
/** 読者の身元。写しにこれが入ると「貯まっているのに 0」になる。 */
const reader = asWorkspaceId("ws_public");

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
  const db = drizzle(proxy.env.DB, { schema });
  let seq = 0;
  writer = withTrackingLinkIssuance(
    createD1PublishedArticleWriter(db),
    createD1TrackingLinkIssuer(db),
  );
  content = createD1ContentRepository(db, createD1SiteRepository(db));
  resolver = createD1RedirectResolver(db);
  coverage = createD1TrackingCoverage(db);
  metrics = createD1TelemetryMetricsRepository(db);
  clicks = createRedirectClickTracking({
    telemetry: createD1TelemetrySink({
      db,
      newId: () => {
        seq += 1;
        return `ev_${seq}`;
      },
    }),
  });
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM published_articles").run();
  await proxy.env.DB.prepare("DELETE FROM published_article_tombstones").run();
  await proxy.env.DB.prepare("DELETE FROM redirect_resolutions").run();
  await proxy.env.DB.prepare("DELETE FROM telemetry_events").run();
  await proxy.env.DB.prepare("DELETE FROM site_blueprints").run();
  await proxy.env.DB.prepare(
    `INSERT INTO site_blueprints
      (id, workspace_id, slug, name, pattern, published_at, blueprint_json)
     VALUES ('sb_tracking_owner', ?, 'sample-site', '計測ブログ', 'specialist_review', unixepoch(), '{}')`,
  )
    .bind(String(owner))
    .run();
});

function anArticle(over: Partial<PublishedArticle> = {}): PublishedArticle {
  return {
    slug: "best-laptops",
    siteSlug: "sample-site",
    type: "ranking",
    title: "おすすめノートパソコン",
    summary: "実測して選びました。",
    categorySlug: "laptops",
    publishedAt: "2026-08-18",
    updatedAt: "2026-08-18",
    author: { slug: "a", name: "書き手", bio: "紹介文。", credentials: [] },
    disclosureRequired: true,
    sections: [],
    ranking: {
      caption: "順位",
      updatedAt: "2026-08-18",
      criteria: [],
      excluded: [],
      entries: [
        {
          productId: "p1",
          rank: 1,
          productName: "商品 1",
          totalScore: 90,
          criterionScores: [],
          oneLine: "一言。",
          affiliateUrl: "https://asp.example/click/p1",
        },
      ],
    },
    ...over,
  };
}

/** 出した記事を読者ページ側から読み直す（画面が受け取る形で確かめるため）。 */
async function readBack(article: PublishedArticle): Promise<PublishedArticle> {
  const found = await content.findArticle(article.siteSlug, article.slug);
  expect(found.ok).toBe(true);
  if (!found.ok || found.value === null) throw new Error("出した記事が読み直せない");
  return found.value;
}

describe("記事を出すと、合言葉が発行される", () => {
  it("順位表のリンクに合言葉が入り、その合言葉で転送先が引ける", async () => {
    const article = anArticle();
    expect((await writer.save(owner, article)).ok).toBe(true);

    const code = (await readBack(article)).ranking?.entries[0]?.trackingCode;
    expect(code).toMatch(/^[a-z0-9]{6,32}$/);

    const resolved = await resolver.resolve(code!);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    // 転送先は**保存された値をそのまま**返す。合言葉から組み立てない。
    expect(resolved.value?.destinationUrl).toBe("https://asp.example/click/p1");
    expect(resolveRedirect(resolved.value, new Date())).toEqual({
      kind: "redirect",
      url: "https://asp.example/click/p1",
    });
  });

  it("写しの作業場所は、読者ではなく持ち主側になる", async () => {
    await writer.save(owner, anArticle());
    const rows = await proxy.env.DB.prepare(
      "SELECT workspace_id FROM redirect_resolutions",
    ).all<{ workspace_id: string }>();
    expect(rows.results.map((r) => r.workspace_id)).toEqual([String(owner)]);
    expect(rows.results.map((r) => r.workspace_id)).not.toContain(String(reader));
  });

  it("同じ記事を出し直しても、合言葉は増えない", async () => {
    const article = anArticle();
    await writer.save(owner, article);
    const first = (await readBack(article)).ranking?.entries[0]?.trackingCode;

    await writer.save(owner, anArticle({ title: "おすすめノートパソコン（更新）" }));
    const second = (await readBack(article)).ranking?.entries[0]?.trackingCode;

    expect(second).toBe(first);
    const count = await proxy.env.DB.prepare(
      "SELECT count(*) as n FROM redirect_resolutions",
    ).first<{ n: number }>();
    expect(count?.n).toBe(1);
  });

  it("合言葉の発行で包んだ後も、公開記事の取り下げを保存先へ渡す", async () => {
    const article = anArticle();
    await writer.save(owner, article);

    const unpublished = await writer.unpublish(owner, article.siteSlug, article.slug);
    expect(unpublished.ok).toBe(true);

    const found = await content.findArticle(article.siteSlug, article.slug);
    if (!found.ok) throw new Error("読み取りに失敗しました");
    expect(found.value).toBeNull();
  });

  it("転送先が変わると新しい合言葉を出し、古い合言葉は 410 になる", async () => {
    const article = anArticle();
    await writer.save(owner, article);
    const oldCode = (await readBack(article)).ranking?.entries[0]?.trackingCode;

    const moved = anArticle();
    const entry = { ...moved.ranking!.entries[0]!, affiliateUrl: "https://asp.example/click/new" };
    await writer.save(owner, {
      ...moved,
      ranking: { ...moved.ranking!, entries: [entry] },
    });
    const newCode = (await readBack(article)).ranking?.entries[0]?.trackingCode;

    expect(newCode).not.toBe(oldCode);
    // 過去に配った URL の行き先が黙って変わらない。上書きせず停止にする。
    const old = await resolver.resolve(oldCode!);
    expect(old.ok && resolveRedirect(old.value, new Date()).kind).toBe("gone");
    const now = await resolver.resolve(newCode!);
    expect(now.ok && now.value?.destinationUrl).toBe("https://asp.example/click/new");
  });

  it("https でない転送先には合言葉を出さず、未発行として数える", async () => {
    const article = anArticle();
    const entry = { ...article.ranking!.entries[0]!, affiliateUrl: "http://asp.example/click/p1" };
    await writer.save(owner, { ...article, ranking: { ...article.ranking!, entries: [entry] } });

    const read = await readBack(article);
    expect(read.ranking?.entries[0]?.trackingCode).toBeUndefined();
    // 読者の買う導線は消さない。消えたのは計測だけ。
    expect(read.ranking?.entries[0]?.affiliateUrl).toBe("http://asp.example/click/p1");

    const summary = await coverage.summarize(owner);
    expect(summary.ok && summary.value).toMatchObject({ total: 1, tracked: 0, untracked: 1 });
  });
});

describe("突合できるリンクの数え上げ", () => {
  it("発行できたものは未発行に数えない", async () => {
    await writer.save(owner, anArticle());
    const summary = await coverage.summarize(owner);
    expect(summary.ok && summary.value).toMatchObject({
      total: 1,
      tracked: 1,
      untracked: 0,
      untrackedArticles: [],
    });
  });

  it("他の作業場所の記事は数えない", async () => {
    await writer.save(owner, anArticle());
    const summary = await coverage.summarize(reader);
    expect(summary.ok && summary.value).toMatchObject({ total: 0, untracked: 0 });
  });
});

describe("作業場所の往復（残課題 25 / 56 の 3 回目を止める）", () => {
  it("転送で押されたクリックが、持ち主の作業場所で 1 件として読める", async () => {
    const article = anArticle();
    await writer.save(owner, article);
    const code = (await readBack(article)).ranking?.entries[0]?.trackingCode;

    const resolved = await resolver.resolve(code!);
    expect(resolved.ok && resolved.value).not.toBeNull();
    if (!resolved.ok || resolved.value === null) return;
    expect((await clicks.recordClick({ resolution: resolved.value, occurredAt: new Date() })).ok).toBe(
      true,
    );

    const to = new Date();
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    const mine = await metrics.query(owner, { keys: ["affiliate_click_count"], from, to });
    expect(mine.ok && mine.value.find((s) => s.key === "affiliate_click_count")?.value).toBe(1);

    // **もう片方も見る。** 読み直せることだけを見ると、全部を同じ作業場所へ
    // 書く実装（＝越境）でも緑になる。読者の身元では 0 件でなければならない。
    const readers = await metrics.query(reader, { keys: ["affiliate_click_count"], from, to });
    const value = readers.ok
      ? readers.value.find((s) => s.key === "affiliate_click_count")?.value
      : undefined;
    expect(value === undefined || value === 0).toBe(true);
  });
});
