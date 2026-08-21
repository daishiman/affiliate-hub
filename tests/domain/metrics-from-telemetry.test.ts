/** @tier 1 */
import { describe, expect, it } from "vitest";
import {
  METRIC_DEFINITIONS,
  METRIC_DERIVATIONS,
  type MetricKey,
  TELEMETRY_EVENT_KEYS,
  type TelemetryEvent,
  UNDERIVABLE_REASONS,
  buildTelemetryEvent,
  derivableMetricKeys,
  deriveMetricSamples,
  isDerivableMetric,
  median,
  validateSample,
} from "@/domain/analytics";

/**
 * 計測イベント → 指標の導き方 (§27)。
 *
 * ここで守りたいのは 1 つだけ:
 * **測れていないものを 0 として出さないこと。**
 * 0 と「未計測」を混ぜると、記事を直す判断を間違える。
 */

const NOW = new Date("2026-08-17T00:00:00.000Z");
const FROM = new Date("2026-08-10T00:00:00.000Z");

/** 実際に画面から送られる形と同じ経路で作る（テストだけ緩い形にしない）。 */
function event(
  key: "page_view" | "affiliate_click" | "scroll_depth" | "page_exit",
  payload: Record<string, unknown>,
  occurredAt: Date = NOW,
): TelemetryEvent {
  const built = buildTelemetryEvent({ key, occurredAt, readerKey: null, payload });
  if (!built.ok) throw new Error(`テストの前提が壊れています: ${built.error.message}`);
  return built.value as TelemetryEvent;
}

const pageView = (occurredAt?: Date) =>
  event("page_view", { path: "/a", siteSlug: "s", referrerKind: "直接" }, occurredAt);

const scroll = (percent: number) =>
  event("scroll_depth", { path: "/a", siteSlug: "s", percent });

const exit = (seconds: number) =>
  event("page_exit", { path: "/a", siteSlug: "s", percent: 50, seconds });

describe("計測から指標を導く", () => {
  it("表示回数はイベントの件数になる", () => {
    const samples = deriveMetricSamples([pageView(), pageView(), pageView()], FROM, NOW);
    const pv = samples.find((s) => s.key === "page_views");
    expect(pv?.value).toBe(3);
    expect(pv?.from).toEqual(FROM);
    expect(pv?.to).toEqual(NOW);
  });

  it("期間の外のイベントは数えない", () => {
    const outside = pageView(new Date("2026-07-01T00:00:00.000Z"));
    const samples = deriveMetricSamples([pageView(), outside], FROM, NOW);
    expect(samples.find((s) => s.key === "page_views")?.value).toBe(1);
  });

  it("成果リンクのクリックは、同意が無い分も含めて数える", () => {
    const click = event("affiliate_click", {
      path: "/a",
      siteSlug: "s",
      linkId: "lnk_1",
      placement: "本文",
      recordedVia: "browser",
    });
    const samples = deriveMetricSamples([click, click], FROM, NOW);
    expect(samples.find((s) => s.key === "affiliate_click_count")?.value).toBe(2);
  });

  it("数えた経路が違っても、クリックは同じ 1 件として数える", () => {
    // 転送の入口（サーバー）と画面の両方から届く。合算できないと、
    // 計測リンクを設けた記事だけ数字が別建てになる。
    const base = { path: "/a", siteSlug: "s", linkId: "lnk_1", placement: "本文" };
    const viaRedirect = event("affiliate_click", { ...base, recordedVia: "redirect" });
    const viaBrowser = event("affiliate_click", { ...base, recordedVia: "browser" });
    const samples = deriveMetricSamples([viaRedirect, viaBrowser], FROM, NOW);
    expect(samples.find((s) => s.key === "affiliate_click_count")?.value).toBe(2);
  });

  it("スクロール到達と滞在時間は中央値で、母数も一緒に返す", () => {
    const samples = deriveMetricSamples([scroll(10), scroll(90), scroll(50)], FROM, NOW);
    const depth = samples.find((s) => s.key === "scroll_depth_p50");
    expect(depth?.value).toBe(50);
    // 「何件の表示から出した中央値か」が分からないと、1 件の数字を信じてしまう。
    expect(depth?.denominator).toBe(3);
  });

  it("外れ値 1 件で数字が跳ねない（平均ではなく中央値である）", () => {
    // 開いたまま放置された 1 件。平均だと 1 時間近くになり、
    // 「よく読まれている記事」に見えてしまう。
    const samples = deriveMetricSamples([exit(20), exit(30), exit(10_000)], FROM, NOW);
    expect(samples.find((s) => s.key === "time_on_page_seconds")?.value).toBe(30);
  });

  it("材料が 1 件も無い指標は、0 ではなく「返さない」", () => {
    const samples = deriveMetricSamples([pageView()], FROM, NOW);
    // 表示はあったがスクロールの記録が無い＝まだ測れていない。
    expect(samples.some((s) => s.key === "scroll_depth_p50")).toBe(false);
    expect(samples.some((s) => s.key === "time_on_page_seconds")).toBe(false);
  });

  it("イベントが 1 件も無ければ、表示回数だけが 0 件として出る", () => {
    const samples = deriveMetricSamples([], FROM, NOW);
    expect(samples.map((s) => s.key)).toEqual(["page_views", "affiliate_click_count"]);
    expect(samples.every((s) => s.value === 0)).toBe(true);
  });

  it("導いた値は、指標の決まり（割合の範囲・母数）を満たす", () => {
    const samples = deriveMetricSamples([pageView(), scroll(40), exit(12)], FROM, NOW);
    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      const checked = validateSample(sample);
      expect(checked.ok, `${sample.key} が指標の決まりに合っていません`).toBe(true);
    }
  });
});

describe("導き方の表そのものを見張る", () => {
  it("導く先は実在する指標で、重複しない", () => {
    const known = new Set<MetricKey>(METRIC_DEFINITIONS.map((d) => d.key));
    const keys = derivableMetricKeys();
    for (const key of keys) expect(known.has(key)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("材料にしている計測イベントは、実在するものだけ", () => {
    for (const derivation of METRIC_DERIVATIONS) {
      for (const from of derivation.from) {
        expect(TELEMETRY_EVENT_KEYS).toContain(from);
      }
    }
  });

  it("導けない指標には、必ず理由が書いてある（黙って空欄にしない）", () => {
    // これが落ちるのは「指標を増やしたが、出せるのか出せないのかを決めていない」とき。
    const unexplained = METRIC_DEFINITIONS.filter(
      (d) =>
        d.category === "reader" &&
        !isDerivableMetric(d.key) &&
        UNDERIVABLE_REASONS[d.key] === undefined,
    );
    expect(unexplained.map((d) => d.key)).toEqual([]);
  });

  it("理由を書いた指標を、同時に導けることにはしない", () => {
    for (const key of Object.keys(UNDERIVABLE_REASONS) as MetricKey[]) {
      expect(isDerivableMetric(key), `${key} の扱いが二重です`).toBe(false);
    }
  });

  it("導き方を変えたら、数え方の説明も変わっているはず", () => {
    // 説明文に畳み方が書かれていない指標を落とす。
    // 「中央値なのか合計なのか」が書かれていない数字は読み方が決まらない。
    for (const derivation of METRIC_DERIVATIONS) {
      if (derivation.aggregation !== "median") continue;
      const def = METRIC_DEFINITIONS.find((d) => d.key === derivation.key);
      expect(def?.howCounted, `${derivation.key}`).toContain("中央値");
    }
  });
});

describe("中央値の出し方", () => {
  it("件数が偶数のときは真ん中 2 つの平均", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("並び順に関係なく同じ結果になる", () => {
    expect(median([9, 1, 5])).toBe(5);
    expect(median([5, 9, 1])).toBe(5);
  });

  it("空なら null（0 ではない）", () => {
    expect(median([])).toBeNull();
  });
});
