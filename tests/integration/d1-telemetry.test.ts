/**
 * @tier 2
 * @req REQ-TM13
 * @types db-migration
 *
 * 計測の保存先（`telemetry_events` 1 表）。
 * `drizzle/*.sql` を順に当てた実物の D1 に対して書いて読む。
 * 印が付いていなかっただけで、検査は前からここにあった。
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { createListMetricsUseCase } from "@/application/usecases/analytics/read-metrics";
import { createRecordTelemetryUseCase } from "@/application/usecases/analytics/record-telemetry";
import type { AppDeps } from "@/application/deps";
import type { MetricDimensions } from "@/application/ports/analytics";
import * as schema from "@/db/schema";
import { RETENTION_DAYS } from "@/domain/analytics";
import type { ActorContext } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import { OTHER_WORKSPACE, WORKSPACE, anOwner } from "../support/actors";

/**
 * 計測を **本物の D1 と本物のマイグレーション**で受け取り、
 * そこから数字を導いて画面の形まで出す結合テスト。
 *
 * --- なぜこれが要るのか ---
 * この 1 本がつながるまで、測ったものは画面のどの数字にも届いていなかった。
 * 両端（送る口と見る画面）は前から在ったので、**間だけが間違っていても
 * 誰も気づけない**。単体側は覚え書きで通るため、次の 4 つは
 * つないでみるまで分からない:
 *
 *   1. マイグレーションが `telemetry_events` を本当に作れるか
 *   2. 組み立てた SQL がその表に対して本当に通るか
 *   3. 保存して読み戻したあと、**同じ数え方に畳まれるか**
 *   4. 別の作業場所の記録が混ざらないか
 *
 * 3 が、この文脈でいちばん壊れやすい。値は JSON 1 列にまとめて入れており、
 * 読み戻しに失敗しても行数は合う。**数字は出るのに中身が違う**という、
 * 目で見て気づけない壊れ方をする。
 *
 * 4 も同様に静かに壊れる。読者側の作業場所は URL 名から引くので、
 * 引き当てを間違えると「貯まっているのに 0 と出る」。
 *
 * --- ここで見ないこと ---
 * 同意の判定そのもの・畳み方そのものは単体側（`tests/domain/`）で見る。
 * ここは**保存を挟んでも同じ結論になること**だけを見る。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let deps: AppDeps;

const owner: ActorContext = anOwner({ workspaceId: WORKSPACE });
const otherOwner: ActorContext = anOwner({ workspaceId: OTHER_WORKSPACE });

const SITE = "makuring";

/** 何の切り口も指定していない状態。数字を直接書き込めないことの確認だけに使う。 */
const EMPTY_DIMENSIONS: MetricDimensions = {
  siteId: null,
  articleId: null,
  channel: null,
  productId: null,
  authorId: null,
  personaId: null,
  angle: null,
  cta: null,
  merchant: null,
  asp: null,
  publishedAt: null,
};

/** マイグレーションの本文を、実行できる単位に割る。 */
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
  deps = createDeps({ db: drizzle(proxy.env.DB, { schema }) });
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM telemetry_events").run();
});

/** 送る側。同意はすべて有りの前提（同意の判定は単体側で見る）。 */
const record = () => createRecordTelemetryUseCase({ sink: deps.telemetry });

/** 見る側。画面が呼ぶのと同じ道を通す。 */
const listMetrics = () => createListMetricsUseCase({ metrics: deps.metrics });

const CONSENTED = { choice: "granted" } as const;

function pageView(over: Record<string, unknown> = {}) {
  return {
    key: "page_view",
    payload: {
      path: "/s/makuring/a/laptop",
      siteSlug: SITE,
      referrerKind: "search",
      ...over,
    },
  };
}

function pageExit(seconds: number, percent = 60) {
  return {
    key: "page_exit",
    payload: { path: "/s/makuring/a/laptop", siteSlug: SITE, percent, seconds },
  };
}

function scrollDepth(percent: number) {
  return {
    key: "scroll_depth",
    payload: { path: "/s/makuring/a/laptop", siteSlug: SITE, percent },
  };
}

/** 画面に出る 1 行を、指標の名前で引く。 */
async function row(actor: ActorContext, key: string) {
  const result = await listMetrics().execute(actor, {});
  expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  const found = result.value.rows.find((r) => r.key === key);
  if (found === undefined) throw new Error(`${key} が画面の行にありません`);
  return found;
}

describe("計測から数字までを本物の D1 で通す", () => {
  it("送ったページ表示が、そのまま表示回数の数字になる", async () => {
    const written = await record().execute(owner, {
      events: [pageView(), pageView({ path: "/s/makuring/a/tablet" }), pageView()],
      signals: CONSENTED,
    });
    expect(written.ok && written.value.accepted, "受け取れていません").toBe(3);

    const views = await row(owner, "page_views");
    // ここが 0 のままなら、貯まっているのに画面へ届いていない。
    expect(views.value).toBe(3);
    expect(views.valueLabel).toBe("3");
  });

  it("測っていない指標は 0 ではなく「未計測」になる", async () => {
    await record().execute(owner, { events: [pageView()], signals: CONSENTED });

    // 表示は測ったが、離脱は 1 件も送っていない。
    const time = await row(owner, "time_on_page_seconds");
    expect(time.value, "測っていないものを 0 と書いています").toBeNull();
    expect(time.valueLabel).toBe("未計測");

    // 一方、押された回数は「0 回押された」という事実なので 0 でよい。
    const clicks = await row(owner, "affiliate_click_count");
    expect(clicks.value).toBe(0);
  });

  it("滞在時間は中央値なので、開きっぱなしの 1 件で跳ねない", async () => {
    await record().execute(owner, {
      events: [pageExit(20), pageExit(30), pageExit(36_000)],
      signals: CONSENTED,
    });

    const time = await row(owner, "time_on_page_seconds");
    // 平均なら 12,016 秒（3 時間超）になり、記事の直し方を誤らせる。
    expect(time.value).toBe(30);
    expect(time.denominator).toBe(3);
  });

  it("スクロール到達は % のまま保存され、% のまま画面に出る", async () => {
    await record().execute(owner, {
      events: [scrollDepth(40), scrollDepth(68), scrollDepth(90)],
      signals: CONSENTED,
    });

    const depth = await row(owner, "scroll_depth_p50");
    // 0〜1 と 0〜100 が混ざると 68% が 6800% になる。桁まで見る。
    expect(depth.value).toBe(68);
    expect(depth.valueLabel).toBe("68%");
  });

  it("別の作業場所の記録は混ざらない", async () => {
    await record().execute(owner, {
      events: [pageView(), pageView()],
      signals: CONSENTED,
    });
    await record().execute(otherOwner, { events: [pageView()], signals: CONSENTED });

    expect((await row(owner, "page_views")).value).toBe(2);
    expect((await row(otherOwner, "page_views")).value).toBe(1);
  });

  it("期間の外の記録は数えない", async () => {
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    await record().execute(owner, {
      events: [{ ...pageView(), occurredAt: old }, pageView()],
      signals: CONSENTED,
    });

    // 画面は直近 30 日を見る。60 日前の 1 件は入らない。
    expect((await row(owner, "page_views")).value).toBe(1);
  });

  it("同意が要る記録は、同意が無ければ保存されない", async () => {
    const written = await record().execute(owner, {
      events: [pageView(), pageExit(30)],
      signals: { choice: "denied" },
    });
    expect(written.ok && written.value.accepted).toBe(1);
    expect(written.ok && written.value.droppedByConsent).toBe(1);

    // 表示は残り、滞在時間は「未計測」のまま。
    expect((await row(owner, "page_views")).value).toBe(1);
    expect((await row(owner, "time_on_page_seconds")).value).toBeNull();
  });

  it("保存期間の掃除は、同意の要否ごとに違う日数で消す", async () => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

    await record().execute(owner, {
      events: [
        // 同意が要る記録（90 日）: 100 日前なので消える
        { ...pageExit(30), occurredAt: daysAgo(100) },
        // 同意が要らない記録（400 日）: 100 日前なので残る
        { ...pageView(), occurredAt: daysAgo(100) },
        { ...pageView(), occurredAt: daysAgo(1) },
      ],
      signals: CONSENTED,
    });

    expect(RETENTION_DAYS.behaviour).toBe(90);
    expect(RETENTION_DAYS.none).toBe(400);

    const purged = await deps.telemetry.purgeExpired(owner.workspaceId, new Date());
    expect(purged.ok && purged.value.deleted, "期限切れだけを消していません").toBe(1);

    const left = await proxy.env.DB.prepare(
      "SELECT key FROM telemetry_events ORDER BY occurred_at",
    ).all<{ key: string }>();
    expect(left.results.map((r) => r.key)).toEqual(["page_view", "page_view"]);
  });

  it("読者の記録を消すと、その人の行だけが消える", async () => {
    await record().execute(owner, {
      events: [pageView(), pageExit(30)],
      signals: CONSENTED,
      readerKey: "rk_alice",
    });
    await record().execute(owner, {
      events: [pageView()],
      signals: CONSENTED,
      readerKey: "rk_bob",
    });

    const forgotten = await deps.telemetry.forgetReader(owner.workspaceId, "rk_alice");
    expect(forgotten.ok && forgotten.value.deleted).toBe(2);

    // 目印だけ抜くのではなく行ごと消す。残った行数で確かめる。
    const left = await proxy.env.DB.prepare("SELECT reader_key FROM telemetry_events").all<{
      reader_key: string | null;
    }>();
    expect(left.results.map((r) => r.reader_key)).toEqual(["rk_bob"]);
  });

  it("切り口で絞ると、値ではなく分けられない理由が返る", async () => {
    await record().execute(owner, { events: [pageView()], signals: CONSENTED });

    const axis = await deps.metrics.listAxisOptions(owner.workspaceId, "product");
    expect(axis.ok).toBe(true);
    if (!axis.ok) throw new Error("軸を引けませんでした");
    // 空配列を返すと「その商品の記録は 0 件」と読まれる。
    expect(axis.value.values, "分けられないのに空の一覧を返しています").toBeNull();
    expect(axis.value.unavailableReason).not.toBeNull();

    const filtered = await deps.metrics.query(owner.workspaceId, {
      keys: ["page_views"],
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: new Date(),
      dimensions: { productId: "prd_macbook_air" },
    });
    // 全体の数字を「その商品の数字」として返さない。
    expect(filtered.ok && filtered.value.length).toBe(0);
  });

  it("数字そのものを書き込む口は持たない", async () => {
    const attempted = await deps.metrics.record(
      owner.workspaceId,
      {
        key: "page_views",
        value: 999_999,
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        to: new Date(),
        denominator: null,
      },
      EMPTY_DIMENSIONS,
    );
    // 受け付けると、導いた数字と入れた数字の 2 通りができる。
    expect(attempted.ok, "数字を直接入れられてしまいました").toBe(false);
  });
});
