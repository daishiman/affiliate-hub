/**
 * @tier 2
 * @req REQ-BOPC03
 * @req feat-reader-behavior-analytics
 * @types screen-states, a11y, keyboard
 *
 * 観測層の 2 枚（読者の行動・記事ごとの成果）。
 *
 * --- ここでしか描けない状態 ---
 * 画面をまとめて描く走査 (`page-render`) は D1 の無い場所で走るので、
 * この 2 枚はどちらも `entry.ready === false` の
 * 「開けませんでした」に落ちる。**数字が並んだ状態**と
 * **記録が 1 件も無い状態**は、口を差し替えたここでしか通らない。
 *
 * --- 見るのは数字ではなく、数字の出し分け ---
 *   1. 記録が 0 件のときに 0 を並べない。「まだ無い」と言う。
 *      0 が並ぶと、読まれていないのか集計が壊れているのかを区別できない。
 *   2. 読者の画面に報酬が出ない。入口を分けた理由は権限であって見た目ではない。
 *   3. 記事を選んでいないとき、記事の中の読まれ方は「出ない」と明示する。
 */
import { describe, expect, it, vi } from "vitest";
import type { AudienceBreakdown, EngagementProfile } from "@/application/ports/blog-observability";
import { describeViolations, findA11yViolations } from "../support/a11y";
import { focusableOrder, intoDom, renderMarkup, textOf } from "../support/render";

type Outcome = { ok: boolean; value?: unknown; error?: unknown };

/** 画面が呼ぶ読み口の戻り。テストごとに差し替える。 */
const audienceOutcome = vi.hoisted(() => ({ current: null as Outcome | null }));
const revenueOutcome = vi.hoisted(() => ({ current: null as Outcome | null }));
/** 画面が読み口へ渡した条件。URL の値をそのまま信じていないかを見る。 */
const audienceInput = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { SAMPLE_ACTOR } = await import("@/infrastructure/identity/sample-actor");
  return {
    ...actual,
    currentActor: async () => SAMPLE_ACTOR,
    blogAudienceEntry: async () => ({
      ready: true,
      read: {
        execute: async (_actor: unknown, input: Record<string, unknown>) => {
          audienceInput.current = input;
          return audienceOutcome.current;
        },
      },
    }),
    blogRevenueEntry: async () => ({
      ready: true,
      read: { execute: async () => revenueOutcome.current },
    }),
  };
});

const AudiencePage = (await import("@/app/admin/sites/[site]/audience/page")).default;
const RevenuePage = (await import("@/app/admin/sites/[site]/revenue/page")).default;

const SITE = "console-blog";
const FROM = "2026-08-01";
const TO = "2026-08-02";

const BREAKDOWN: AudienceBreakdown = {
  bySegment: { search: 60, social: 20, direct: 10, referral: 5, internal: 5 },
  byViewport: { narrow: 70, medium: 20, wide: 10 },
};

const ENGAGEMENT: EngagementProfile = {
  buckets: [
    { from: 0, to: 0.5, reachRatio: 0.9, averageDwellSeconds: 30 },
    { from: 0.5, to: 1, reachRatio: 0.2, averageDwellSeconds: 8 },
  ],
  clickThroughByElement: { "cta-top": 0.12 },
};

function audienceDay(day: string, over: Record<string, number> = {}) {
  return {
    day,
    views: 100,
    uniqueSessions: 80,
    clicks: 10,
    conversions: 2,
    averageDwellSeconds: 45,
    averageScrollRatio: 0.6,
    // 既定は足切りを越える件数。越えない日は各試験が上書きする。
    sampleCount: 190,
    ...over,
  };
}

async function drawAudience(
  over: Record<string, unknown> = {},
  article = "",
  viewport?: string,
): Promise<string> {
  audienceOutcome.current = {
    ok: true,
    value: {
      siteSlug: SITE,
      articleSlug: article === "" ? null : article,
      viewportBand: null,
      range: { from: FROM, to: TO },
      daily: [audienceDay(FROM), audienceDay(TO, { views: 300 })],
      breakdown: BREAKDOWN,
      engagement: null,
      ...over,
    },
  };
  return renderMarkup(
    AudiencePage({
      params: Promise.resolve({ site: SITE }),
      searchParams: Promise.resolve({
        from: FROM,
        to: TO,
        ...(article === "" ? {} : { article }),
        ...(viewport === undefined ? {} : { viewport }),
      }),
    }),
  );
}

async function drawRevenue(over: Record<string, unknown> = {}): Promise<string> {
  revenueOutcome.current = {
    ok: true,
    value: {
      siteSlug: SITE,
      range: { from: FROM, to: TO },
      daily: [
        { ...audienceDay(FROM), revenueMinor: 3000 },
        { ...audienceDay(TO, { views: 300 }), revenueMinor: 5000 },
      ],
      totals: {
        views: 400,
        clicks: 20,
        conversions: 4,
        revenueMinor: 8000,
        clickThroughRate: 0.05,
      },
      articleRanking: [
        {
          articleSlug: "how-to-choose",
          views: 300,
          clicks: 15,
          conversions: 3,
          revenueMinor: 6000,
        },
      ],
      ...over,
    },
  };
  return renderMarkup(
    RevenuePage({
      params: Promise.resolve({ site: SITE }),
      searchParams: Promise.resolve({ from: FROM, to: TO }),
    }),
  );
}

describe("根拠が足りないときは、数字は出して読み方を出さない", () => {
  it("足切り未満だと、読み方の代わりに理由が出る", async () => {
    // 2 日で 20 件。足切りは 30 件。
    const text = textOf(
      await drawAudience({
        daily: [audienceDay(FROM, { sampleCount: 12 }), audienceDay(TO, { sampleCount: 8 })],
      }),
    );

    // 数字そのものは消えない。消すと「計測が壊れた」と見分けが付かない。
    expect(text).toContain("読まれた回数");
    expect(text).toContain("観測が 20 件しかありません");
    expect(text).not.toContain("直すべきは記事の中身より");
  });

  it("足切りを越えると、読み方が出て理由は出ない", async () => {
    const text = textOf(await drawAudience());

    expect(text).toContain("直すべきは記事の中身より");
    expect(text).not.toContain("しかありません");
  });

  it("記事の中の読まれ方も、根拠が足りなければ読み方を伏せる", async () => {
    const text = textOf(
      await drawAudience(
        {
          daily: [audienceDay(FROM, { sampleCount: 5 })],
          engagement: ENGAGEMENT,
        },
        "how-to-choose",
      ),
    );

    // 到達の図は描くが、「急に落ちる区間が離脱」という読み方は添えない。
    expect(text).toContain("記事のどこまで届いているか");
    expect(text).not.toContain("離脱している場所です");
  });
});

describe("記録が無い期間を、0 の並びとして出さない", () => {
  it("読者の行動: なぜ空なのかを本文で言う", async () => {
    const text = textOf(await drawAudience({ daily: [] }));

    expect(text).toContain("この期間の記録がありません");
    // 0 が並ぶと、読まれていないのか集計が止まっているのかを区別できない。
    expect(text).not.toContain("読まれた回数 0");
  });

  it("記事ごとの成果: なぜ空なのかを本文で言う", async () => {
    const text = textOf(await drawRevenue({ daily: [] }));

    expect(text).toContain("この期間の記録がありません");
    expect(text).not.toContain("0 円");
  });

  it("記録はあるが成果の付いた記事が 1 本も無いときは、表を空で出さない", async () => {
    const text = textOf(await drawRevenue({ articleRanking: [] }));

    expect(text).toContain("成果の付いた記事がありません");
    expect(text).not.toContain("1 表示あたりの売上が高い順");
  });
});

describe("読者の画面に、報酬を出さない", () => {
  it("数字が並んだ状態でも、円の表記が 1 つも出ない", async () => {
    /*
     * 入口を 2 つに分けているのは権限が違うからで、見た目の都合ではない。
     * ここに報酬を足すと、読者の見え方だけを見せたい役に報酬まで渡る。
     */
    const text = textOf(await drawAudience());

    expect(text).toContain("読まれた回数");
    expect(text).not.toContain("円");
    expect(text).not.toContain("売上");
  });
});

describe("記事を選んでいるかどうかで、出るものが変わる", () => {
  it("ブログ全体では、記事の中の読まれ方を「出ない」と言う", async () => {
    const text = textOf(await drawAudience());

    // 黙って空の枠を置くと、壊れているのか出ない決まりなのか読めない。
    expect(text).toContain("記事を 1 本に絞ったとき");
    expect(text).not.toContain("どこまで届いているか");
  });

  it("記事を選ぶと、どこまで届き、どこが押されたかが出る", async () => {
    const text = textOf(
      await drawAudience({ engagement: ENGAGEMENT, articleSlug: "how-to-choose" }, "how-to-choose"),
    );

    expect(text).toContain("どこまで届いているか");
    expect(text).toContain("cta-top");
  });
});

describe("画面幅を切り替えると、同じ記事を別の見え方で読める", () => {
  it("記事を選ぶと、幅の切替が出る", async () => {
    const html = await drawAudience(
      { engagement: ENGAGEMENT, articleSlug: "how-to-choose" },
      "how-to-choose",
    );

    // 行き先は期間と記事を保ったまま、幅だけを差し替える。
    expect(html).toContain("viewport=narrow");
    expect(html).toContain(`article=how-to-choose`);
    expect(html).toContain(`from=${FROM}`);
  });

  it("ブログ全体では、幅の切替を出さない", async () => {
    /*
     * 記事を選んでいないとき、記事の中の読まれ方そのものが出ない。
     * 切替だけ置くと、押しても何も変わらない道具が画面に残る。
     */
    const html = await drawAudience();
    expect(html).not.toContain("viewport=narrow");
  });

  it("いま見ている幅は、押せる案内にしない", async () => {
    const html = await drawAudience(
      { engagement: ENGAGEMENT, articleSlug: "how-to-choose", viewportBand: "narrow" },
      "how-to-choose",
      "narrow",
    );

    // 自分自身への行き先は出さない。どれを見ているかは太字で示す。
    expect(html).not.toContain("viewport=narrow&");
    expect(html).not.toMatch(/viewport=narrow"/);
    expect(html).toContain("viewport=wide");
  });

  it("選んだ幅が、そのまま読み口へ届く", async () => {
    await drawAudience(
      { engagement: ENGAGEMENT, articleSlug: "how-to-choose", viewportBand: "wide" },
      "how-to-choose",
      "wide",
    );
    expect(audienceInput.current?.viewportBand).toBe("wide");
  });

  it("知らない幅を URL で渡されても、絞らずに描く", async () => {
    /*
     * 区分の名前は増える余地がある。知らない値で空の表を出すと、
     * 古いリンクを踏んだ人には「計測が止まった」ように見える。
     */
    await drawAudience(
      { engagement: ENGAGEMENT, articleSlug: "how-to-choose" },
      "how-to-choose",
      "phone",
    );
    expect(audienceInput.current).not.toHaveProperty("viewportBand");
  });
});

describe("読み上げとキーボードで辿れる", () => {
  it.each([
    ["読者の行動", () => drawAudience({ engagement: ENGAGEMENT }, "how-to-choose")],
    ["記事ごとの成果", () => drawRevenue()],
  ])("%s の数字が並んだ状態を、自動検査にかける", async (_name, draw) => {
    const violations = await findA11yViolations(await draw());

    expect(violations, describeViolations(violations)).toEqual([]);
  });

  it.each([
    ["読者の行動", () => drawAudience()],
    ["記事ごとの成果", () => drawRevenue()],
  ])("%s から、名前の付いた戻り口へキーボードで辿れる", async (_name, draw) => {
    const { document, cleanup } = intoDom(await draw());
    const order = focusableOrder(document);
    cleanup();

    // 名前の無い行き先が混じると、読み上げは「リンク」としか言えない。
    expect(order.length).toBeGreaterThan(0);
    expect(order.every((entry) => entry.split(":")[1] !== "")).toBe(true);
    expect(order.some((entry) => entry.includes("このブログへ戻る"))).toBe(true);
  });
});
