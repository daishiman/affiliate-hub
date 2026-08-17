import { type MetricKey, type MetricSample } from "./metrics";
import type { TelemetryEvent, TelemetryEventKey } from "./telemetry-events";

/**
 * Analytics コンテキスト / 計測イベントから指標を導く（§27）。
 *
 * --- なぜ「導く」のか ---
 * 計測（`TelemetryEvent`）と指標（`MetricSample`）を別々に貯めると、
 * **どちらが正しいのか誰にも分からない数字**が 2 つできる。
 * ここでは計測だけを事実として貯め、指標はそこから毎回導く。
 * 導けないものは導けないままにする（0 とは書かない）。
 *
 * --- 導けるものしか表に載せない ---
 * 下の `METRIC_DERIVATIONS` に載っているのは、
 * **いま計測しているイベントだけで正直に計算できる指標**である。
 * 載っていない指標は `未計測` のまま残る。これは手抜きではなく、
 * 「それらしい数字を出さない」という判断であり、
 * 理由を `UNDERIVABLE_REASONS` に 1 行ずつ書いてある。
 *
 * --- 純粋な関数である理由 ---
 * ここに保存先の都合（SQL・D1）を持ち込むと、集計の考え方が
 * SQL の中へ散る。散ると「読了率の計算式が画面ごとに違う」が起きる。
 * 保存先は**イベントを期間で取り出すところまで**を担い、
 * 畳み方はこのファイルだけが持つ。
 */

/** 畳み方。表示にそのまま出せる短い言い方にする。 */
export type Aggregation = "count" | "median";

export type MetricDerivation = {
  readonly key: MetricKey;
  /** 材料にする計測イベント。ここに無いイベントは無視する。 */
  readonly from: readonly TelemetryEventKey[];
  readonly aggregation: Aggregation;
  /** 期間内のイベントから値を作る。材料が 0 件なら null（0 ではない）。 */
  readonly compute: (
    events: readonly TelemetryEvent[],
  ) => { readonly value: number; readonly denominator: number | null } | null;
};

/** 数値の項目を安全に取り出す。形が違うものは数えない。 */
function numbers(events: readonly TelemetryEvent[], field: string): number[] {
  const out: number[] = [];
  for (const event of events) {
    const value = (event.payload as Record<string, unknown>)[field];
    if (typeof value === "number" && Number.isFinite(value)) out.push(value);
  }
  return out;
}

/**
 * 中央値。**平均にしない。**
 * 滞在時間もスクロール到達も、開いたまま放置された 1 件で平均が跳ねる。
 * 跳ねた数字を見て記事を直すと、直す場所を間違える。
 */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

const countOf = (key: TelemetryEventKey): MetricDerivation["compute"] => {
  return (events) => {
    const count = events.filter((e) => e.key === key).length;
    // 0 件は「0 回だった」という事実なので、そのまま 0 を返す。
    // 材料そのものが無い（イベント種別を一度も受け取っていない）状態とは
    // 区別できないが、期間で切って数えている以上ここは 0 が正しい。
    return { value: count, denominator: null };
  };
};

const medianOf = (
  key: TelemetryEventKey,
  field: string,
): MetricDerivation["compute"] => {
  return (events) => {
    const values = numbers(
      events.filter((e) => e.key === key),
      field,
    );
    const value = median(values);
    // 1 件も無いときに 0 を返すと「まったく読まれていない」に見える。
    // 実際は「まだ測れていない」なので null にする。
    if (value === null) return null;
    return { value, denominator: values.length };
  };
};

export const METRIC_DERIVATIONS: readonly MetricDerivation[] = [
  {
    key: "page_views",
    from: ["page_view"],
    aggregation: "count",
    compute: countOf("page_view"),
  },
  {
    key: "affiliate_click_count",
    from: ["affiliate_click"],
    aggregation: "count",
    compute: countOf("affiliate_click"),
  },
  {
    key: "scroll_depth_p50",
    from: ["scroll_depth"],
    aggregation: "median",
    compute: medianOf("scroll_depth", "percent"),
  },
  {
    key: "time_on_page_seconds",
    from: ["page_exit"],
    aggregation: "median",
    compute: medianOf("page_exit", "seconds"),
  },
];

/**
 * いま導けない指標と、その理由。
 *
 * **ここに理由が書けない指標は、表から外すか計測を足すかのどちらかにする。**
 * 「なんとなく出ていない」を残さないための欄で、画面にもそのまま出せる。
 */
export const UNDERIVABLE_REASONS: Readonly<Partial<Record<MetricKey, string>>> = {
  unique_readers:
    "同じ人の再訪を 1 と数えるための目印を、こちらでは作っていません（目印は読者の端末が持ち、いつでも消せます）。回数は「表示回数」で見られます。",
  return_rate:
    "再訪を数えるには、日をまたいで同じ人だと分かる目印が要ります。いまはその目印を持たない作りにしています。",
  read_completion_rate:
    "「最終見出しまで到達した」の印を計測していません。スクロールの割合は画面の高さに対する値で、記事の終わりとは一致しません。",
  ai_answer_count:
    "AI の利用記録は、編集を助けるための呼び出しも含みます。読者に返した回答だけを取り出す印がまだありません。",
  webmcp_tool_invocations: "ページ内の道具の実行を、まだ計測に送っていません。",
};

/** その指標を計測から導けるか。 */
export function isDerivableMetric(key: MetricKey): boolean {
  return METRIC_DERIVATIONS.some((d) => d.key === key);
}

export function derivableMetricKeys(): readonly MetricKey[] {
  return METRIC_DERIVATIONS.map((d) => d.key);
}

/**
 * 期間内のイベントから、導ける指標だけを作る。
 *
 * 導けない指標は**返さない**。呼び出し側は「無かった」を `未計測` として出す。
 * ここで 0 を返してしまうと、画面は「測れていない」と「0 だった」を
 * 区別できなくなる。
 */
export function deriveMetricSamples(
  events: readonly TelemetryEvent[],
  from: Date,
  to: Date,
): readonly MetricSample[] {
  // 期間の外を混ぜない。保存先が広めに取ってきても、ここで切る。
  const inWindow = events.filter(
    (e) => e.occurredAt.getTime() >= from.getTime() && e.occurredAt.getTime() <= to.getTime(),
  );

  const samples: MetricSample[] = [];
  for (const derivation of METRIC_DERIVATIONS) {
    const computed = derivation.compute(inWindow);
    if (computed === null) continue;
    samples.push({
      key: derivation.key,
      value: computed.value,
      from,
      to,
      denominator: computed.denominator,
    });
  }
  return samples;
}
