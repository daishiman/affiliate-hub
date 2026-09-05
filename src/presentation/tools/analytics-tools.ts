import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createCheckFeedbackUseCase,
  createListMetricsUseCase,
  createListUsableMetricsUseCase,
} from "@/application/usecases/analytics/read-metrics";
import { createFilterMetricsUseCase } from "@/application/usecases/analytics/filter-metrics";
import { ANALYTICS_AXES } from "@/domain/analytics/dimensions";
import { METRIC_DEFINITIONS } from "@/domain/analytics/metrics";
import { defineTool } from "./define-tool";
import type { AnyToolDefinition } from "./tool-definition";

/**
 * 数字の道具。
 *
 * **「順位の点数を数字から自動で調整する」道具はここに無い。**
 * 収益の数字を順位へ戻すことは仕様として禁じられており、
 * 「使ってよいか」を確かめる道具だけを置いている。
 */
export function analyticsTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const analytics = { metrics: deps.metrics };

  // 選択肢は指標の定義表から作る。手で並べ直すと、片方だけ古くなる。
  const metricKeys = METRIC_DEFINITIONS.map((d) => d.key);
  const metricKey = z.enum(metricKeys as [string, ...string[]]);
  // 絞り込みの軸も domain の定義表から組み立てる。
  // 画面と AI で選べる軸がずれると、「画面では絞れるのに AI では絞れない」が起きる。
  const axisShape = Object.fromEntries(
    ANALYTICS_AXES.map((a) => [a.key, z.string().describe(`${a.label}: ${a.whatItTells}`)]),
  );

  const target = z.enum([
    "article_revision",
    "topic_selection",
    "ranking_score",
    "product_recommendation",
    "quality_threshold",
  ]);

  return [
    defineTool({
      name: "list_metrics",
      description:
        "指標の一覧を、数え方・実測値・その数字を編集判断に使ってよいかつきで返します。計測できていないものは「未計測」と返します。",
      schema: z.object({ days: z.number().int().min(1).max(365).optional() }),
      readOnly: true,
      useCase: createListMetricsUseCase(analytics),
    }),
    defineTool({
      name: "list_usable_metrics",
      description:
        "指定した用途（記事の書き直し・順位の点数など）に使ってよい指標と、使えない指標とその理由を返します。",
      schema: z.object({ target }),
      readOnly: true,
      useCase: createListUsableMetricsUseCase(analytics),
    }),
    defineTool({
      name: "check_metric_feedback",
      description:
        "この指標をこの用途に使ってよいかを 1 件だけ判定します。収益の指標を順位やおすすめの決定に使うことはできません。",
      schema: z.object({ metricKey, target }),
      readOnly: true,
      useCase: createCheckFeedbackUseCase(analytics),
    }),
    defineTool({
      name: "filter_metrics",
      description:
        "商品・コンテンツパッケージ・書き手・読者・媒体・切り口・CTA・販売店・ASP・ブログ・投稿日時の 11 の切り口で数字を絞り込みます。その切り口で分けて数えていない指標は、0 ではなく「分けられません」と返します。",
      schema: z.object({
        // 軸の一覧は domain の定義から作る。ここで並べ直すと片方だけ古くなる。
        axes: z.object(axisShape).partial().optional(),
        days: z.number().int().min(1).max(365).optional(),
      }),
      readOnly: true,
      useCase: createFilterMetricsUseCase(analytics),
    }),
  ];
}
