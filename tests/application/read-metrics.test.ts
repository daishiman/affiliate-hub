/**
 * @tier 1
 * @req REQ-P10, REQ-FD02
 * @types boundary, equivalence, decision-table
 *
 * 数字を読む 3 つのユースケース（`read-metrics.ts`）。
 *
 * ここまで**このファイルを動かす検査が 1 つも無かった**（2026-08-17 の実測で
 * 生き残り 96 変異、テストファイル 0 件の最上位）。数字は画面と AI の両方から
 * 読まれるので、ここが空だと「片方だけ単位が違う」に誰も気づけない。
 *
 * 固定したいのは 3 点。
 *   1. **単位を取り違えない。** 0〜1 の割合は 100 倍し、% で来る値は 100 倍しない。
 *      ここを一緒くたにすると 68% が 6800% になる。
 *   2. **収益の指標を編集判断へ戻せない。** 使えない理由は domain の判定から取る。
 *   3. **0 件を失敗にしない。** 「まだ計測されていない」は結果であって異常ではない。
 */
import { describe, expect, it } from "vitest";
import type { MetricsRepositoryPort } from "@/application/ports/analytics";
import {
  FEEDBACK_TARGET_LABEL,
  METRIC_CATEGORY_LABEL,
  type ReadMetricsDeps,
  createCheckFeedbackUseCase,
  createListMetricsUseCase,
  createListUsableMetricsUseCase,
} from "@/application/usecases/analytics/read-metrics";
import {
  DEFAULT_METRICS_WINDOW_DAYS,
  type FeedbackTarget,
  METRIC_DEFINITIONS,
  type MetricKey,
  type MetricSample,
} from "@/domain/analytics";
import { domainError, err, ok } from "@/domain/shared";
import { WORKSPACE, aNobody, anAnalyst } from "../support/actors";

const analyst = anAnalyst({ workspaceId: WORKSPACE });

/** 保存先の代わり。**問い合わせに渡された引数も覚える**（期間の計算を外から見るため）。 */
function metricsOf(samples: readonly MetricSample[]) {
  const calls: { keys: readonly MetricKey[]; from: Date; to: Date }[] = [];
  const notUsed = () => {
    throw new Error("このテストでは呼ばれません");
  };
  const port: MetricsRepositoryPort = {
    record: notUsed,
    listAxisOptions: notUsed,
    listSplittableKeys: notUsed,
    async query(_ws, input) {
      calls.push({ keys: input.keys, from: input.from, to: input.to });
      return ok(samples);
    },
  };
  return { port, calls };
}

function aSample(key: MetricKey, value: number, denominator: number | null = null): MetricSample {
  return { key, value, from: new Date(0), to: new Date(1), denominator };
}

async function list(samples: readonly MetricSample[], input: { days?: number } = {}) {
  const { port, calls } = metricsOf(samples);
  const r = await createListMetricsUseCase({ metrics: port }).execute(analyst, input);
  if (!r.ok) throw new Error(r.error.message);
  return { view: r.value, calls };
}

describe("指標の一覧", () => {
  it("数字を見る権限が無ければ断る", async () => {
    const { port } = metricsOf([]);
    const r = await createListMetricsUseCase({ metrics: port }).execute(aNobody(), {});
    expect(r.ok).toBe(false);
  });

  it("登録されている指標を 1 つも落とさずに並べる", async () => {
    // 落とすと、画面に出ない指標が生まれる。出ないことは画面を見ても分からない。
    const { view } = await list([]);
    expect(view.rows.map((r) => r.key)).toEqual(METRIC_DEFINITIONS.map((d) => d.key));
  });

  /**
   * 試験名が名乗る数を手で書き写す。**`DEFAULT_METRICS_WINDOW_DAYS` から
   * 期待値を組み立てない。**
   *
   * ここを直した理由。**30 を 3007 にしても 0 にしても 7990 件すべて緑だった**
   * （実測、2026-08-28）。期待値を `DEFAULT_METRICS_WINDOW_DAYS * 24 * 60 * 60 * 1000`
   * で作っていたので、**定数をいくつに変えても期待値が一緒に動いた。**
   * 「既定で 30 日ぶん」と名乗りながら、実際に見ていたのは
   * 「その定数が使われているか」だけだった。
   */
  const DECLARED_WINDOW_DAYS = 30;

  it("問い合わせる期間は、既定で 30 日ぶん", async () => {
    expect(DEFAULT_METRICS_WINDOW_DAYS, "既定の集計期間が動いている").toBe(DECLARED_WINDOW_DAYS);
    const { calls } = await list([]);
    const call = calls[0];
    expect(call).toBeDefined();
    if (!call) return;
    expect(call.to.getTime() - call.from.getTime()).toBe(
      DECLARED_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
  });

  it("日数を指定したら、その日数ぶんだけ遡る", async () => {
    const { calls } = await list([], { days: 7 });
    const call = calls[0];
    expect(call).toBeDefined();
    if (!call) return;
    expect(call.to.getTime() - call.from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("保存先に、登録されている指標の鍵をすべて渡す", async () => {
    const { calls } = await list([]);
    expect(calls[0]?.keys).toEqual(METRIC_DEFINITIONS.map((d) => d.key));
  });

  it("保存先が答えられないときは、その失敗をそのまま上げる", async () => {
    // 「取れない」を 0 件として返すと、画面には「まだ計測されていません」と出る。
    const notUsed = () => {
      throw new Error("このテストでは呼ばれません");
    };
    const broken: MetricsRepositoryPort = {
      record: notUsed,
      listAxisOptions: notUsed,
      listSplittableKeys: notUsed,
      query: async () => err(domainError("UPSTREAM_UNAVAILABLE", "保存先に接続できません。")),
    };
    const r = await createListMetricsUseCase({ metrics: broken }).execute(analyst, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("数字の単位", () => {
  it("スクロール到達は % で来るので、100 倍しない", async () => {
    // ここが `_rate` と同じ扱いになると 68% が 6800% になる。
    const { view } = await list([aSample("scroll_depth_p50", 68)]);
    const row = view.rows.find((r) => r.key === "scroll_depth_p50");
    expect(row?.valueLabel).toBe("68%");
  });

  it("`_rate` で終わる指標は 0〜1 なので 100 倍して % にする", async () => {
    const { view } = await list([aSample("read_completion_rate", 0.62)]);
    expect(view.rows.find((r) => r.key === "read_completion_rate")?.valueLabel).toBe("62%");
  });

  it("`_ratio` で終わる指標も同じ扱いにする", async () => {
    const { view } = await list([aSample("stale_price_ratio", 0.125)]);
    // 四捨五入して 13%。切り捨てると 12% になるので、丸め方もここで留める。
    expect(view.rows.find((r) => r.key === "stale_price_ratio")?.valueLabel).toBe("13%");
  });

  it("割合でない指標は、桁区切りの数として出す", async () => {
    const { view } = await list([aSample("page_views", 12345)]);
    expect(view.rows.find((r) => r.key === "page_views")?.valueLabel).toBe("12,345");
  });

  it("取れていない指標は 0 ではなく「未計測」と書く", async () => {
    // 0 と書くと「読まれていない」に見える。実際は数えていないだけ。
    const { view } = await list([]);
    const row = view.rows.find((r) => r.key === "page_views");
    expect(row?.value).toBeNull();
    expect(row?.valueLabel).toBe("未計測");
  });

  it("母数をそのまま渡す（何件中かが分からないと割合を読み違える）", async () => {
    const { view } = await list([aSample("read_completion_rate", 0.5, 400)]);
    expect(view.rows.find((r) => r.key === "read_completion_rate")?.denominator).toBe(400);
  });

  it("区分の表示名は 1 か所から取る", async () => {
    const { view } = await list([]);
    for (const row of view.rows) {
      expect(row.categoryLabel).toBe(METRIC_CATEGORY_LABEL[row.category]);
    }
  });
});

describe("計測できている数と、まだの数", () => {
  it("計測できている数と、まだの数を足すと全体になる", async () => {
    const { view } = await list([aSample("page_views", 3), aSample("correction_count", 1)]);
    expect(view.measuredCount).toBe(2);
    expect(view.missingCount).toBe(view.rows.length - 2);
  });

  it("1 件も無いときだけ、その理由を返す", async () => {
    const { view } = await list([]);
    expect(view.measuredCount).toBe(0);
    expect(view.emptyReason).not.toBeNull();
  });

  it("1 件でも計測できていれば、理由は付けない", async () => {
    // 常に付いていると読み飛ばされ、本当に空のときに効かなくなる。
    const { view } = await list([aSample("page_views", 1)]);
    expect(view.emptyReason).toBeNull();
  });
});

describe("編集判断に使ってよいか", () => {
  it("収益の指標には、使えない理由が付く", async () => {
    const { view } = await list([]);
    const row = view.rows.find((r) => r.key === "revenue_amount");
    expect(row?.usableForEditorialJudgement).toBe(false);
    expect(row?.notUsableReason).not.toBeNull();
  });

  it("編集判断に使える指標には、理由を付けない", async () => {
    const { view } = await list([]);
    const row = view.rows.find((r) => r.key === "read_completion_rate");
    expect(row?.usableForEditorialJudgement).toBe(true);
    expect(row?.notUsableReason).toBeNull();
  });

  it("収益区分の指標は 1 つ残らず「使えない」側に入る", async () => {
    const { view } = await list([]);
    for (const row of view.rows) {
      expect(row.usableForEditorialJudgement, row.key).toBe(row.category !== "commercial");
    }
  });
});

// --- 用途ごとに使ってよい指標 ------------------------------------------------

async function usable(target: FeedbackTarget) {
  const { port } = metricsOf([]);
  const r = await createListUsableMetricsUseCase({ metrics: port } as ReadMetricsDeps).execute(
    analyst,
    { target },
  );
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe("この用途に使ってよい指標", () => {
  it("権限が無ければ断る", async () => {
    const { port } = metricsOf([]);
    const r = await createListUsableMetricsUseCase({ metrics: port }).execute(aNobody(), {
      target: "ranking_score",
    });
    expect(r.ok).toBe(false);
  });

  it("順位の点数には、収益の指標を 1 つも出さない", async () => {
    const view = await usable("ranking_score");
    const commercial = METRIC_DEFINITIONS.filter((d) => d.category === "commercial").map(
      (d) => d.key,
    );
    for (const key of commercial) {
      expect(view.usable.map((u) => u.key), key).not.toContain(key);
    }
  });

  it("使える指標と、断った指標を足すと全体になる（黙って消さない）", async () => {
    const view = await usable("ranking_score");
    expect(view.usable.length + view.rejected.length).toBe(METRIC_DEFINITIONS.length);
  });

  it("断った指標には、断った理由が付く", async () => {
    const view = await usable("ranking_score");
    expect(view.rejected.length).toBeGreaterThan(0);
    for (const r of view.rejected) {
      expect(r.reason.length, r.label).toBeGreaterThan(5);
      expect(r.reason, r.label).not.toBe("使えます");
    }
  });

  it("記事の書き直しには、収益の指標も使える", async () => {
    // ここまで断ると「売れた記事を直せない」になる。制限は編集判断の側だけ。
    const view = await usable("article_revision");
    expect(view.rejected).toHaveLength(0);
    expect(view.usable).toHaveLength(METRIC_DEFINITIONS.length);
  });

  it("用途の表示名は 1 か所から取る", async () => {
    const view = await usable("topic_selection");
    expect(view.targetLabel).toBe(FEEDBACK_TARGET_LABEL.topic_selection);
    expect(view.target).toBe("topic_selection");
  });

  it("使える指標には、数え方が付いてくる", async () => {
    const view = await usable("article_revision");
    for (const u of view.usable) {
      expect(u.howCounted.length, u.key).toBeGreaterThan(5);
    }
  });
});

// --- 1 件だけの判定 ----------------------------------------------------------

async function check(metricKey: MetricKey, target: FeedbackTarget) {
  const { port } = metricsOf([]);
  return createCheckFeedbackUseCase({ metrics: port }).execute(analyst, { metricKey, target });
}

describe("この数字をこの用途に使ってよいか", () => {
  it("権限が無ければ断る", async () => {
    const { port } = metricsOf([]);
    const r = await createCheckFeedbackUseCase({ metrics: port }).execute(aNobody(), {
      metricKey: "page_views",
      target: "ranking_score",
    });
    expect(r.ok).toBe(false);
  });

  it("登録されていない指標は「見つかりません」で断る", async () => {
    const r = await check("no_such_metric" as MetricKey, "ranking_score");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("使える組み合わせは、数え方まで添えて返す", async () => {
    const r = await check("read_completion_rate", "ranking_score");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.allowed).toBe(true);
    expect(r.value.metricLabel).toBe("読了率");
    expect(r.value.targetLabel).toBe(FEEDBACK_TARGET_LABEL.ranking_score);
    expect(r.value.reason).toContain("最終見出しまで到達した表示の割合");
  });

  it("使えない組み合わせは、失敗ではなく「使えない」という答えとして返す", async () => {
    // 例外にすると、画面は理由を出せずに壊れて見える。判定は結果である。
    const r = await check("revenue_amount", "ranking_score");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.allowed).toBe(false);
    expect(r.value.reason).toContain("報酬額");
    expect(r.value.reason).not.toContain("数え方");
  });

  it("同じ収益の指標でも、記事の書き直しになら使える", async () => {
    const r = await check("revenue_amount", "article_revision");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.allowed).toBe(true);
  });
});
