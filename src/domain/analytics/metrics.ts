import {
  type DomainError,
  type Result,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Analytics コンテキスト / 指標定義 (プラットフォーム層 §27)。
 *
 * 指標を型で持つ理由:
 *   - 画面ごとに「読了率」の計算式が違う、という事故を防ぐ
 *   - どの指標が編集判断に使えて、どれが使えないかを 1 箇所で宣言する
 */
export type MetricCategory =
  | "reader" // 読者行動
  | "ai" // AI 利用
  | "quality" // 品質
  | "commercial"; // 収益

export type MetricKey =
  // reader
  | "page_views"
  | "unique_readers"
  | "read_completion_rate"
  | "scroll_depth_p50"
  | "time_on_page_seconds"
  | "return_rate"
  // ai
  | "ai_answer_count"
  | "ai_tool_success_rate"
  | "ai_answer_evidence_rate"
  | "ai_handoff_to_human_rate"
  | "webmcp_tool_invocations"
  // quality
  | "correction_count"
  | "stale_price_ratio"
  | "evidence_coverage_rate"
  | "publish_gate_failure_rate"
  | "review_overdue_count"
  // commercial
  | "affiliate_click_count"
  | "conversion_count"
  | "revenue_amount"
  | "epc"; // クリックあたり収益

export type MetricDefinition = {
  readonly key: MetricKey;
  readonly label: string;
  readonly category: MetricCategory;
  /** どう数えるか。定義を書けない指標は運用しない。 */
  readonly howCounted: string;
  /**
   * 編集判断 (ランキング・記事の良し悪し) の入力に使ってよいか。
   * commercial 区分は常に false。
   */
  readonly usableForEditorialJudgement: boolean;
};

const M = (
  key: MetricKey,
  label: string,
  category: MetricCategory,
  howCounted: string,
): MetricDefinition => ({
  key,
  label,
  category,
  howCounted,
  // 収益系は編集判断に使わない (§27 フィードバック制限)。
  usableForEditorialJudgement: category !== "commercial",
});

export const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  M("page_views", "表示回数", "reader", "記事ページの表示を 1 件として数える"),
  M("unique_readers", "読者数", "reader", "同一端末の 24 時間以内の再訪を 1 と数える"),
  M("read_completion_rate", "読了率", "reader", "最終見出しまで到達した表示の割合"),
  M("scroll_depth_p50", "スクロール到達 (中央値)", "reader", "全表示のスクロール到達率の中央値"),
  M("time_on_page_seconds", "滞在時間", "reader", "表示から離脱までの秒数。非アクティブは除外"),
  M("return_rate", "再訪率", "reader", "30 日以内に再度訪れた読者の割合"),
  M("ai_answer_count", "AI回答数", "ai", "サイト内 AI が回答を返した回数"),
  M("ai_tool_success_rate", "ツール成功率", "ai", "WebMCP ツール呼び出しのうち成功した割合"),
  M("ai_answer_evidence_rate", "根拠付き回答率", "ai", "出典を伴った AI 回答の割合"),
  M("ai_handoff_to_human_rate", "有人引き継ぎ率", "ai", "AI が答えられず問い合わせへ回した割合"),
  M("webmcp_tool_invocations", "WebMCP呼び出し数", "ai", "ページ内ツールの実行回数"),
  M("correction_count", "訂正件数", "quality", "公開後に訂正した回数"),
  M("stale_price_ratio", "価格が古い商品の割合", "quality", "確認から 24 時間を超えた価格の割合"),
  M("evidence_coverage_rate", "根拠の網羅率", "quality", "根拠が紐づいた主張の割合"),
  M("publish_gate_failure_rate", "公開前チェックの不合格率", "quality", "公開試行のうち不合格の割合"),
  M("review_overdue_count", "確認期限切れ記事数", "quality", "次回確認日を過ぎた公開記事の数"),
  M("affiliate_click_count", "リンククリック数", "commercial", "計測識別子ごとのクリック数"),
  M("conversion_count", "成果件数", "commercial", "ASP から取り込んだ成果の件数"),
  M("revenue_amount", "報酬額", "commercial", "確定した報酬額の合計"),
  M("epc", "クリックあたり収益", "commercial", "報酬額 ÷ クリック数"),
];

const BY_KEY: ReadonlyMap<MetricKey, MetricDefinition> = new Map(
  METRIC_DEFINITIONS.map((d) => [d.key, d]),
);

export function metricDefinition(key: MetricKey): MetricDefinition {
  const def = BY_KEY.get(key);
  // 定義表と型が同じ一覧から作られているため、ここは通常到達しない。
  if (!def) throw new Error(`指標の定義がありません: ${key}`);
  return def;
}

export type MetricSample = {
  readonly key: MetricKey;
  readonly value: number;
  /** 集計期間。期間の無い数字は比較できない。 */
  readonly from: Date;
  readonly to: Date;
  /** 母数。割合系の指標で「何件中か」が分からないと判断を誤る。 */
  readonly denominator: number | null;
};

/** 割合の指標が 0〜1 に収まっているかなど、集計値の形を確認する。 */
export function validateSample(sample: MetricSample): Result<MetricSample, DomainError> {
  if (sample.to <= sample.from) {
    return err(validationError("集計期間の終わりが始まりより前になっています。", "to"));
  }
  if (sample.key.endsWith("_rate") || sample.key.endsWith("_ratio")) {
    if (sample.value < 0 || sample.value > 1) {
      return err(validationError("割合の指標は 0〜1 で扱います。", "value"));
    }
    if (sample.denominator === null || sample.denominator === 0) {
      return err(
        validationError("割合の指標には母数が必要です。母数なしの割合は判断に使えません。", "denominator"),
      );
    }
  }
  return ok(sample);
}
