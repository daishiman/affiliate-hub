import { type DomainError, type Result, domainError, err, ok } from "../shared";
import { type MetricKey, metricDefinition } from "./metrics";

/**
 * 指標を編集判断へ戻してよいかの規則 (プラットフォーム層 §27 フィードバック制限)。
 *
 * 「よく売れた商品を上に出す」は、最も自然に混入する形の商業汚染である。
 * 誰も悪意なくそれをやってしまうので、コードで断る。
 *
 * 使ってよい戻し方 (編集の改善):
 *   読了率が低い → 導入文を直す / 根拠の網羅率が低い → 検証を足す
 *
 * 使ってはならない戻し方 (評価の汚染):
 *   成果が多い商品を上位にする / 報酬が高い商品を推奨に変える
 */
export type FeedbackTarget =
  | "article_revision" // 記事の書き直し
  | "topic_selection" // 次に書く題材の選定
  | "ranking_score" // ランキングの点数
  | "product_recommendation" // 推奨商品の決定
  | "quality_threshold"; // 品質の合格ラインの調整

/** 編集判断そのものを動かす戻し先。商業指標を入れてはならない。 */
const EDITORIAL_JUDGEMENT_TARGETS: ReadonlySet<FeedbackTarget> = new Set<FeedbackTarget>([
  "ranking_score",
  "product_recommendation",
  "quality_threshold",
]);

/**
 * この指標を、この用途へ戻してよいか判定する。
 *
 * ランキングや推奨の決定へ商業指標を渡そうとした時点で失敗させる。
 * 失敗コードは COMMERCIAL_INPUT_REJECTED で、ランキング集約の拒否と同じ。
 */
export function assertFeedbackAllowed(
  key: MetricKey,
  target: FeedbackTarget,
): Result<true, DomainError> {
  const def = metricDefinition(key);
  if (EDITORIAL_JUDGEMENT_TARGETS.has(target) && !def.usableForEditorialJudgement) {
    return err(
      domainError(
        "COMMERCIAL_INPUT_REJECTED",
        `${def.label} は収益の指標です。評価や推奨の決定に使うことはできません。`,
        {
          suggestedAction:
            "記事の書き直しや題材選びには使えます。評価軸には実測・仕様・使いやすさ・耐久性・サポート・価格妥当性だけを使ってください。",
        },
      ),
    );
  }
  return ok(true);
}

/** 用途ごとに使える指標の一覧。画面の選択肢をここから作る。 */
export function allowedMetricsFor(
  target: FeedbackTarget,
  candidates: readonly MetricKey[],
): readonly MetricKey[] {
  return candidates.filter((k) => {
    const r = assertFeedbackAllowed(k, target);
    return r.ok;
  });
}
