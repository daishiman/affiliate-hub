/**
 * @tier 2
 * @req REQ-BOPC03
 * @req feat-reader-behavior-analytics, feat-blog-metrics-rollup
 * @types idempotency, boundary, tenant-isolation, db-migration
 *
 * 観測層 (`reader_interaction_event` → 日次集計) を本物の D1 で確かめる。
 *
 * ## この試験がいちばん守りたいもの
 *
 * 日次集計の行には、読者側の数字 (PV・滞在・クリック) と成果側の数字
 * (売上・成約) が同居している。同居させたのは AD-2 のためだが、その代わり
 * **書き手が 2 系統になる**。読者側の再集計が売上を消してしまう事故は、
 * 型でも関数の単体試験でも捕まらない。`ON CONFLICT` の `SET` 句に何が
 * 入っているかの問題だからで、確かめられるのは本物の D1 だけである。
 */
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import type { InteractionKind, ReaderSegment, ViewportBand } from "@/domain/analytics";
import type { WorkspaceId } from "@/domain/shared";
import {
  createD1BlogAudienceRepository,
  createD1BlogRevenueRepository,
  createD1MetricsRollup,
  createD1ReaderInteractionIntake,
} from "@/infrastructure/persistence/d1/reader-metrics-repository";
import { migrationStatements } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

const WS = "ws_metrics_owner" as WorkspaceId;
const OTHER = "ws_metrics_outsider" as WorkspaceId;
const SITE = "metrics-blog";
const DAY = "2026-09-01";
const RANGE = { from: "2026-08-01", to: "2026-09-30" } as const;

let proxy: Proxy;
let seq = 0;

function db() {
  return drizzle(proxy.env.DB, { schema });
}

function intake() {
  return createD1ReaderInteractionIntake({ db: db() });
}

type EventInput = {
  eventId?: string;
  articleSlug?: string | null;
  kind?: InteractionKind;
  segment?: ReaderSegment;
  viewportBand?: ViewportBand;
  positionRatio?: number;
  dwellSeconds?: number;
  elementKey?: string | null;
  sessionKey?: string;
  at?: string;
};

/** 1 件ぶんの観測。既定は「検索から広い画面で記事を 1 回見た読者」。 */
function event(over: EventInput = {}) {
  return {
    eventId: over.eventId ?? `evt_${++seq}`,
    siteSlug: SITE,
    articleSlug: over.articleSlug === undefined ? "article-a" : over.articleSlug,
    kind: over.kind ?? ("view" as InteractionKind),
    segment: over.segment ?? ("search" as ReaderSegment),
    viewportBand: over.viewportBand ?? ("wide" as ViewportBand),
    positionRatio: over.positionRatio ?? 0,
    dwellSeconds: over.dwellSeconds ?? 0,
    elementKey: over.elementKey ?? null,
    sessionKey: over.sessionKey ?? "sess-1",
    occurredAt: new Date(`${over.at ?? DAY}T09:00:00Z`),
  };
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
  for (const table of [
    "reader_interaction_event",
    "site_daily_metric",
    "article_daily_metric",
  ]) {
    await proxy.env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe("観測の受け口", () => {
  it("まとめて受け取り、件数を返す", async () => {
    const recorded = await intake().record(WS, [event(), event({ sessionKey: "sess-2" })]);
    expect(recorded.ok && recorded.value.accepted).toBe(2);
  });

  it("集計日は受け取り側が発生時刻から決める（端末の時計を信用しない）", async () => {
    await intake().record(WS, [event({ at: "2026-08-15" })]);
    const rows = await proxy.env.DB.prepare(
      "SELECT rollup_day FROM reader_interaction_event",
    ).all<{ rollup_day: string }>();
    expect(rows.results[0]?.rollup_day).toBe("2026-08-15");
  });

  it("同じ event ID の再送は成功として扱い、accepted は 0 を返す", async () => {
    const replayed = event({ eventId: "evt_replayed" });

    const first = await intake().record(WS, [replayed]);
    const replay = await intake().record(WS, [replayed]);
    const rows = await proxy.env.DB.prepare(
      "SELECT id FROM reader_interaction_event WHERE id = ?",
    )
      .bind(replayed.eventId)
      .all<{ id: string }>();

    expect(first.ok && first.value.accepted).toBe(1);
    expect(replay.ok && replay.value.accepted).toBe(0);
    expect(rows.results).toHaveLength(1);
  });
});

describe("日次集計は何度やっても同じ結果になる", () => {
  beforeEach(async () => {
    await intake().record(WS, [
      event({ sessionKey: "s1" }),
      event({ sessionKey: "s1" }),
      event({ sessionKey: "s2" }),
      event({ kind: "click", elementKey: "cta-main", sessionKey: "s1" }),
      event({ kind: "dwell", dwellSeconds: 40, sessionKey: "s1" }),
      event({ kind: "scroll", positionRatio: 0.8, sessionKey: "s1" }),
    ]);
  });

  it("2 回集計しても数字が二重にならない（足し込みではなく置き換え）", async () => {
    const rollup = createD1MetricsRollup(db());
    await rollup.rollupDay(WS, SITE, DAY);
    await rollup.rollupDay(WS, SITE, DAY);

    const daily = await createD1BlogAudienceRepository(db()).siteDaily(WS, SITE, RANGE);
    if (!daily.ok) throw new Error("読み出しに失敗");
    expect(daily.value).toHaveLength(1);
    expect(daily.value[0]?.views).toBe(3);
    expect(daily.value[0]?.clicks).toBe(1);
    // 訪問者の数は行の数ではない。同じ session の 2 回は 1 人。
    expect(daily.value[0]?.uniqueSessions).toBe(2);
  });

  it("再集計しても売上と成約は消えない（読者側と成果側で書き手が違う）", async () => {
    const rollup = createD1MetricsRollup(db());
    await rollup.rollupDay(WS, SITE, DAY);

    // 成果側の経路が後から売上を書き込む。
    await proxy.env.DB.prepare(
      "UPDATE site_daily_metric SET revenue_minor = 5000, conversions = 2",
    ).run();
    await proxy.env.DB.prepare(
      "UPDATE article_daily_metric SET revenue_minor = 5000, conversions = 2",
    ).run();

    // 読者側の数字を取り直す。
    await rollup.rollupDay(WS, SITE, DAY);

    const revenue = await createD1BlogRevenueRepository(db()).siteDaily(WS, SITE, RANGE);
    if (!revenue.ok) throw new Error("読み出しに失敗");
    expect(revenue.value[0]?.revenueMinor).toBe(5000);
    expect(revenue.value[0]?.conversions).toBe(2);
  });

  it("何件の観測から作った数字かを、集計の行が持って出る", async () => {
    await createD1MetricsRollup(db()).rollupDay(WS, SITE, DAY);
    const audience = createD1BlogAudienceRepository(db());

    const site = await audience.siteDaily(WS, SITE, RANGE);
    const article = await audience.articleDaily(WS, SITE, "article-a", RANGE);
    if (!site.ok || !article.ok) throw new Error("読み出しに失敗");
    /*
     * 上の beforeEach が入れた生イベントは 6 件。**平均値そのものからは
     * 母数が分からない。** 滞在 40 秒が 1 人の値なのか 1000 人の値なのかで
     * 意味がまるで違うので、根拠の量を数字と一緒に運ぶ。
     * 画面はこれを見て「まだ読み方は出しません」に倒す。
     */
    expect(site.value[0]?.sampleCount).toBe(6);
    expect(article.value[0]?.sampleCount).toBe(6);
  });

  it("記事ごとの内訳と全体の合計が食い違わない", async () => {
    await createD1MetricsRollup(db()).rollupDay(WS, SITE, DAY);
    const audience = createD1BlogAudienceRepository(db());

    const site = await audience.siteDaily(WS, SITE, RANGE);
    const article = await audience.articleDaily(WS, SITE, "article-a", RANGE);
    if (!site.ok || !article.ok) throw new Error("読み出しに失敗");
    expect(article.value[0]?.views).toBe(site.value[0]?.views);
  });
});

describe("編集判断へ渡る口には売上が無い", () => {
  it("audience の行は revenueMinor という鍵を持たない", async () => {
    await intake().record(WS, [event()]);
    await createD1MetricsRollup(db()).rollupDay(WS, SITE, DAY);
    await proxy.env.DB.prepare("UPDATE site_daily_metric SET revenue_minor = 9999").run();

    const daily = await createD1BlogAudienceRepository(db()).siteDaily(WS, SITE, RANGE);
    if (!daily.ok) throw new Error("読み出しに失敗");
    // 型では消しているが、実行時に鍵ごと落ちていることをここで確かめる。
    // 残っていると `JSON.stringify` 経由の受け渡しで売上が編集側へ漏れる。
    expect(Object.keys(daily.value[0] ?? {})).not.toContain("revenueMinor");
  });
});

describe("どこを見て、どこを押しているか", () => {
  it("読者の内訳は、来ていない区分も 0 で埋まる", async () => {
    await intake().record(WS, [
      event({ segment: "search", viewportBand: "narrow" }),
      event({ segment: "search", viewportBand: "narrow", sessionKey: "s2" }),
    ]);

    const breakdown = await createD1BlogAudienceRepository(db()).breakdown(WS, SITE, RANGE);
    if (!breakdown.ok) throw new Error("読み出しに失敗");
    expect(breakdown.value.byViewport.narrow).toBe(2);
    // 「まだ計っていない」と「誰も来なかった」を画面が区別できるように、
    // 0 の区分も鍵として残す。欠けていると棒グラフの軸が日替わりになる。
    expect(breakdown.value.byViewport.wide).toBe(0);
    expect(breakdown.value.bySegment.social).toBe(0);
  });

  it("要素別のクリック率は、表示が 0 の日を 0 として畳む", async () => {
    await intake().record(WS, [
      event(),
      event({ kind: "click", elementKey: "cta-main" }),
      event({ kind: "scroll", positionRatio: 0.95 }),
    ]);

    const engagement = await createD1BlogAudienceRepository(db()).engagement(
      WS,
      SITE,
      "article-a",
      RANGE,
    );
    if (!engagement.ok) throw new Error("読み出しに失敗");
    expect(engagement.value.clickThroughByElement["cta-main"]).toBe(1);
    // 到達の分布は末尾の区間まで届いている。
    expect(engagement.value.buckets.at(-1)?.reachRatio).toBeGreaterThan(0);
  });

  it("画面幅で絞ると、同じ記事でも別の分布になる", async () => {
    /*
     * 狭い画面の 1 人は最後まで読み、広い画面の 1 人は冒頭で離れた。
     * **まとめた分布では、この 2 つが平均されて「半分の人が到達」に見える。**
     * どちらの幅でも起きていないことが、まとめた数字にだけ現れる。
     */
    await intake().record(WS, [
      event({ viewportBand: "narrow", sessionKey: "n1" }),
      event({ viewportBand: "narrow", sessionKey: "n1", kind: "scroll", positionRatio: 0.95 }),
      event({ viewportBand: "wide", sessionKey: "w1" }),
      event({ viewportBand: "wide", sessionKey: "w1", kind: "scroll", positionRatio: 0.05 }),
    ]);
    const audience = createD1BlogAudienceRepository(db());

    const all = await audience.engagement(WS, SITE, "article-a", RANGE);
    const narrow = await audience.engagement(WS, SITE, "article-a", RANGE, "narrow");
    const wide = await audience.engagement(WS, SITE, "article-a", RANGE, "wide");
    if (!all.ok || !narrow.ok || !wide.ok) throw new Error("読み出しに失敗");

    // 開いた時点で誰もが先頭は通るので、先頭は 2 人とも。
    // 末尾まで来たのは 2 人のうち 1 人なので 0.5 に均される。
    expect(all.value.buckets[0]?.reachRatio).toBeCloseTo(1);
    expect(all.value.buckets.at(-1)?.reachRatio).toBeCloseTo(0.5);

    /*
     * 絞ると分母もその幅の人数になる。**引いた後に間引いたのでは
     * こうならない**（分母が 2 のままで 0.5 が出る）。
     */
    expect(narrow.value.buckets.at(-1)?.reachRatio).toBeCloseTo(1);
    expect(wide.value.buckets.at(-1)?.reachRatio).toBeCloseTo(0);
    expect(wide.value.buckets[0]?.reachRatio).toBeCloseTo(1);
    // 0.5 という「どちらの幅でも起きていない値」は、絞れば消える。
    expect(narrow.value.buckets.at(-1)?.reachRatio).not.toBeCloseTo(0.5);
  });
});

describe("保持期限と所有境界", () => {
  it("期限を過ぎた生イベントは捨て、集計は残す", async () => {
    await intake().record(WS, [event({ at: "2026-01-01" })]);
    await createD1MetricsRollup(db()).rollupDay(WS, SITE, "2026-01-01");

    const purged = await createD1MetricsRollup(db()).purgeExpiredEvents(
      new Date("2026-06-01T00:00:00Z"),
    );
    expect(purged.ok && purged.value.deleted).toBe(1);

    const daily = await createD1BlogAudienceRepository(db()).siteDaily(WS, SITE, {
      from: "2026-01-01",
      to: "2026-01-31",
    });
    // 生の行が消えても、集計した数字は残っていること。
    // 残らないと、90 日より前の推移が永久に見られなくなる。
    expect(daily.ok && daily.value).toHaveLength(1);
  });

  it("集計し直す組は、生イベントの側から数え上げる", async () => {
    await intake().record(WS, [event(), event({ sessionKey: "s2" })]);
    await intake().record(WS, [{ ...event({ at: "2026-08-31" }), siteSlug: "other-blog" }]);
    await intake().record(OTHER, [event()]);

    const pending = await createD1MetricsRollup(db()).pendingDays([DAY, "2026-08-31"], 10);
    if (!pending.ok) throw new Error("数え上げに失敗");

    // 観測のある (作業場所, ブログ, 日) だけが 1 組ずつ返る。同じ組に
    // 2 件あっても 1 組。ここが重複すると、同じ日を人数ぶん集計し直す。
    expect(pending.value).toHaveLength(3);
    expect(pending.value.filter((row) => row.workspaceId === OTHER)).toHaveLength(1);
    expect(
      pending.value.some((row) => row.siteSlug === "other-blog" && row.day === "2026-08-31"),
    ).toBe(true);
  });

  it("窓の外の日は数え上げない", async () => {
    await intake().record(WS, [event({ at: "2026-07-01" })]);

    const pending = await createD1MetricsRollup(db()).pendingDays([DAY], 10);
    // 定期実行が見るのは直近の窓だけ。窓の外まで拾うと、古い日を毎晩
    // 集計し直し続けることになる。
    expect(pending.ok && pending.value).toHaveLength(0);
  });

  it("上限を超えたぶんは返さない（次の回で拾う）", async () => {
    await intake().record(WS, [event()]);
    await intake().record(WS, [{ ...event(), siteSlug: "blog-2" }]);
    await intake().record(WS, [{ ...event(), siteSlug: "blog-3" }]);

    const pending = await createD1MetricsRollup(db()).pendingDays([DAY], 2);
    expect(pending.ok && pending.value).toHaveLength(2);
  });

  it("他の workspace の観測は混ざらない", async () => {
    await intake().record(OTHER, [event(), event({ sessionKey: "s2" })]);
    await createD1MetricsRollup(db()).rollupDay(WS, SITE, DAY);

    const daily = await createD1BlogAudienceRepository(db()).siteDaily(WS, SITE, RANGE);
    if (!daily.ok) throw new Error("読み出しに失敗");
    expect(daily.value[0]?.views ?? 0).toBe(0);
  });
});
