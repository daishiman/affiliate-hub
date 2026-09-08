/**
 * @tier 1
 * @req REQ-BOPC03
 * @req feat-reader-behavior-analytics
 * @req feat-blog-metrics-rollup
 * @types equivalence, boundary, permission-matrix, tenant-isolation, decision-table
 *
 * 観測層の 2 つの読み口。**同じ表を、違う権限で、違う形に見せる。**
 *
 * この試験が守りたいのは 3 つ。
 *
 *   1. **読者の見え方と売上は別の権限。** 分析担当に PV を見せながら
 *      報酬額は伏せる、という配り方ができること (`analytics.read` と
 *      `affiliate.read_revenue` の分離)。
 *   2. **合計はこの層で作る (AD-2)。** 画面ごとに足し方が変わると、
 *      同じ「今月の売上」が画面ごとに別の数になる。
 *   3. **期間と件数は受け取る前に検める。** 表示件数の上限を越えた
 *      問い合わせを保存先へ通さない。
 *
 * SQL と集計の冪等性は `tests/integration/d1-reader-metrics.test.ts` が見る。
 */
import { describe, expect, it } from "vitest";
import type {
  ArticleRevenueSummary,
  AudienceBreakdown,
  AudienceDaily,
  BlogAudiencePort,
  BlogRevenuePort,
  EngagementProfile,
} from "@/application/ports/blog-observability";
import { createReadBlogAudienceUseCase } from "@/application/usecases/blog-ops/read-blog-audience";
import { createReadBlogRevenueUseCase } from "@/application/usecases/blog-ops/read-blog-revenue";
import type { DailyMetrics } from "@/domain/analytics";
import type { ViewportBand } from "@/domain/analytics/reader-interaction";
import { ok } from "@/domain/shared";
import { WORKSPACE, aWriter, anAnalyst, anOwner, anOutsider } from "../support/actors";

const SITE = "metrics-blog";
const ARTICLE = "how-to-choose";
const FROM = "2026-08-01";
const TO = "2026-08-31";

function aDay(over: Partial<DailyMetrics> = {}): DailyMetrics {
  return {
    day: "2026-08-01",
    views: 100,
    uniqueSessions: 80,
    clicks: 10,
    conversions: 2,
    revenueMinor: 3000,
    averageDwellSeconds: 45,
    averageScrollRatio: 0.6,
    sampleCount: 190,
    ...over,
  };
}

const BREAKDOWN: AudienceBreakdown = {
  bySegment: { search: 60, social: 20, direct: 10, referral: 5, internal: 5 },
  byViewport: { narrow: 70, medium: 20, wide: 10 },
};

const ENGAGEMENT: EngagementProfile = {
  buckets: [{ from: 0, to: 0.5, reachRatio: 0.9, averageDwellSeconds: 30 }],
  clickThroughByElement: { "cta-top": 0.12 },
};

/** 読者の見え方の口。**売上の列を返す手段が型の上に無い。** */
function fakeAudience(days: readonly DailyMetrics[] = [aDay()]) {
  const calls: string[] = [];
  const workspaces: string[] = [];
  /** `engagement` が受け取った画面幅。undefined は「絞らない」。 */
  const bands: (ViewportBand | undefined)[] = [];
  const strip = (d: DailyMetrics): AudienceDaily => {
    const { revenueMinor: _dropped, ...rest } = d;
    return rest;
  };
  const port: BlogAudiencePort = {
    async siteDaily(ws) {
      calls.push("siteDaily");
      workspaces.push(ws);
      return ok(days.map(strip));
    },
    async articleDaily(ws) {
      calls.push("articleDaily");
      workspaces.push(ws);
      return ok(days.map(strip));
    },
    async breakdown(ws) {
      calls.push("breakdown");
      workspaces.push(ws);
      return ok(BREAKDOWN);
    },
    async engagement(ws, _site, _article, _range, band) {
      calls.push("engagement");
      workspaces.push(ws);
      bands.push(band);
      return ok(ENGAGEMENT);
    },
  };
  return { port, calls, workspaces, bands };
}

function fakeRevenue(
  days: readonly DailyMetrics[] = [aDay()],
  ranking: readonly ArticleRevenueSummary[] = [],
) {
  const calls: string[] = [];
  const limits: number[] = [];
  const port: BlogRevenuePort = {
    async siteDaily() {
      calls.push("siteDaily");
      return ok(days);
    },
    async articleRanking(_ws, _site, _range, limit) {
      calls.push("articleRanking");
      limits.push(limit);
      return ok(ranking);
    },
  };
  return { port, calls, limits };
}

describe("読者の見え方: 誰が見に来て、どこを見ているか", () => {
  it("ブログ全体では、どこを見ているかを返さない", async () => {
    const audience = fakeAudience();
    const uc = createReadBlogAudienceUseCase({ audience: audience.port });

    const result = await uc.execute(anAnalyst(), { siteSlug: SITE, from: FROM, to: TO });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /*
     * 記事ごとに版面が違うので、位置の比率をブログ全体で足し合わせても
     * 意味を持たない。数字を作れないときは null を返し、でっち上げない。
     */
    expect(result.value.engagement).toBeNull();
    expect(audience.calls).not.toContain("engagement");
  });

  it("記事を指定したときだけ、どこに時間をかけているかを返す", async () => {
    const audience = fakeAudience();
    const uc = createReadBlogAudienceUseCase({ audience: audience.port });

    const result = await uc.execute(anAnalyst(), {
      siteSlug: SITE,
      articleSlug: ARTICLE,
      from: FROM,
      to: TO,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.engagement).toEqual(ENGAGEMENT);
    // 内訳はブログ全体で引く。記事 1 本では母数が小さすぎて読めない。
    expect(audience.calls).toContain("breakdown");
    expect(audience.calls).toContain("articleDaily");
  });

  it("画面幅を指定すると、その幅が保存先まで届く", async () => {
    const audience = fakeAudience();
    const uc = createReadBlogAudienceUseCase({ audience: audience.port });

    const result = await uc.execute(anAnalyst(), {
      siteSlug: SITE,
      articleSlug: ARTICLE,
      viewportBand: "narrow",
      from: FROM,
      to: TO,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /*
     * 絞り込みは保存先まで降ろす。ここで受け取った後に間引くと、
     * 到達率の分母が全体のままになり、「狭い画面の読者の到達率」
     * ではない数字が出る。
     */
    expect(audience.bands).toEqual(["narrow"]);
    // 画面が「いまどれで絞っているか」を描けるよう、選択を返す。
    expect(result.value.viewportBand).toBe("narrow");
  });

  it("画面幅を指定しなければ、絞らずに引く", async () => {
    const audience = fakeAudience();
    const uc = createReadBlogAudienceUseCase({ audience: audience.port });

    const result = await uc.execute(anAnalyst(), {
      siteSlug: SITE,
      articleSlug: ARTICLE,
      from: FROM,
      to: TO,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(audience.bands).toEqual([undefined]);
    expect(result.value.viewportBand).toBeNull();
  });

  it("画面幅で絞っても、どんな読者が来ているかの内訳は絞らない", async () => {
    const audience = fakeAudience();
    const uc = createReadBlogAudienceUseCase({ audience: audience.port });

    const result = await uc.execute(anAnalyst(), {
      siteSlug: SITE,
      articleSlug: ARTICLE,
      viewportBand: "wide",
      from: FROM,
      to: TO,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /*
     * 内訳を一緒に絞ると、選んだ 1 行しか残らない。**切り替えの
     * 手がかりが画面から消える** ——「広い画面が 10 人しかいない」と
     * 分かるから、その分布を信じすぎないでいられる。
     */
    expect(result.value.breakdown.byViewport).toEqual(BREAKDOWN.byViewport);
  });

  it.each([
    ["開始日の形が違う", { from: "2026-8-1", to: TO }, "from"],
    ["終了日の形が違う", { from: FROM, to: "8月31日" }, "to"],
    ["開始日が終了日より後", { from: TO, to: FROM }, "from"],
  ])("期間が %s なら、保存先へ問い合わせずに断る", async (_name, range, field) => {
    const audience = fakeAudience();
    const uc = createReadBlogAudienceUseCase({ audience: audience.port });

    const result = await uc.execute(anAnalyst(), { siteSlug: SITE, ...range });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe(field);
    expect(audience.calls).toHaveLength(0);
  });

  it("問い合わせる作業場所は、頼んだ人の作業場所である", async () => {
    const audience = fakeAudience();
    const uc = createReadBlogAudienceUseCase({ audience: audience.port });

    await uc.execute(anAnalyst(), { siteSlug: SITE, from: FROM, to: TO });
    await uc.execute(anOutsider(), { siteSlug: SITE, from: FROM, to: TO });

    // 同じ siteSlug でも、別の作業場所の人には別の条件で引く。
    expect(audience.workspaces[0]).toBe(WORKSPACE);
    expect(audience.workspaces.at(-1)).not.toBe(WORKSPACE);
  });
});

describe("売上: 見る権限が読者分析と別に切ってある", () => {
  it("分析担当は読者も売上も見られる", async () => {
    const revenue = fakeRevenue();
    const uc = createReadBlogRevenueUseCase({ revenue: revenue.port });

    const result = await uc.execute(anAnalyst(), { siteSlug: SITE, from: FROM, to: TO });

    expect(result.ok).toBe(true);
  });

  it("記事を書く人は、読者も売上も見られない", async () => {
    const audience = fakeAudience();
    const revenue = fakeRevenue();
    const audienceUc = createReadBlogAudienceUseCase({ audience: audience.port });
    const revenueUc = createReadBlogRevenueUseCase({ revenue: revenue.port });

    const seen = await audienceUc.execute(aWriter(), { siteSlug: SITE, from: FROM, to: TO });
    const earned = await revenueUc.execute(aWriter(), { siteSlug: SITE, from: FROM, to: TO });

    expect(seen.ok).toBe(false);
    expect(earned.ok).toBe(false);
    if (earned.ok) return;
    expect(earned.error.code).toBe("FORBIDDEN");
    expect(revenue.calls).toHaveLength(0);
  });
});

describe("売上: 合計はこの層で作る (AD-2)", () => {
  it("日ごとの行を足し、クリック率まで含めて返す", async () => {
    const revenue = fakeRevenue([
      aDay({ day: "2026-08-01", views: 100, clicks: 10, conversions: 2, revenueMinor: 3000 }),
      aDay({ day: "2026-08-02", views: 300, clicks: 30, conversions: 4, revenueMinor: 5000 }),
    ]);
    const uc = createReadBlogRevenueUseCase({ revenue: revenue.port });

    const result = await uc.execute(anOwner(), { siteSlug: SITE, from: FROM, to: TO });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totals).toEqual({
      views: 400,
      clicks: 40,
      conversions: 6,
      revenueMinor: 8000,
      clickThroughRate: 0.1,
    });
  });

  it("まだ誰も見ていない期間のクリック率は 0 で、null にしない", async () => {
    const revenue = fakeRevenue([aDay({ views: 0, clicks: 0, conversions: 0, revenueMinor: 0 })]);
    const uc = createReadBlogRevenueUseCase({ revenue: revenue.port });

    const result = await uc.execute(anOwner(), { siteSlug: SITE, from: FROM, to: TO });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    /*
     * null を混ぜると、表の並べ替えで「まだ誰も見ていない記事」が
     * 最上位にも最下位にも来うる。0 なら順序が決まる。
     */
    expect(result.value.totals.clickThroughRate).toBe(0);
  });
});

describe("売上: 表示件数の境界", () => {
  it.each([
    ["省略", undefined, 20],
    ["下端", 1, 1],
    ["上端", 200, 200],
  ])("%s の件数は、そのまま保存先へ渡る", async (_name, limit, expected) => {
    const revenue = fakeRevenue();
    const uc = createReadBlogRevenueUseCase({ revenue: revenue.port });

    const result = await uc.execute(anOwner(), { siteSlug: SITE, from: FROM, to: TO, limit });

    expect(result.ok).toBe(true);
    expect(revenue.limits).toEqual([expected]);
  });

  it.each([
    ["0 件", 0],
    ["上端の 1 つ外", 201],
    ["小数", 1.5],
  ])("%s は保存先へ通さない", async (_name, limit) => {
    const revenue = fakeRevenue();
    const uc = createReadBlogRevenueUseCase({ revenue: revenue.port });

    const result = await uc.execute(anOwner(), { siteSlug: SITE, from: FROM, to: TO, limit });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    /*
     * 欄の名前は付かない。表示件数は URL のクエリから来るので、
     * 画面に直せる入力欄が無い。名前を付けると `FormResult` が
     * 出さない断りになり、誰にも届かない。
     */
    expect(result.error.field).toBeUndefined();
    expect(revenue.calls).not.toContain("articleRanking");
  });
});
