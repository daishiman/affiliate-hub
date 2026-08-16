import type { ClickTrackingPort, MetricsRepositoryPort } from "@/application/ports/analytics";
import type { MetricKey, MetricSample } from "@/domain/analytics";
import { ok } from "@/domain/shared";
import { registerStub, stubCall } from "../../stub-registry";

/**
 * ★ これは仮置きの見本データです（スタブ）。★
 *
 * 本物の数字は、公開して読まれ始めてからでないと出ない。
 * ここでは「数え方が書いてあるか」「収益の数字を順位へ戻せないようにしてあるか」を
 * 画面で確かめられるところまでを用意している。
 *
 * **わざと一部の指標を空にしている。** すべて埋まった状態だけを置くと、
 * 「まだ計測できていません」がどう出るかを誰も確かめないまま公開してしまう。
 */
const stub = registerStub({
  id: "persistence:analytics-sample",
  port: "指標の保存先とクリック計測",
  label: "数字（見本データ）",
  blockedBy:
    "metric_samples / click_events テーブルの追加と、公開後の実際の計測（Cloudflare Analytics の接続）",
});

export function sampleAnalyticsNotice(): string {
  return `${stub.label}で表示しています（${stub.blockedBy}が済むまでの仮です）。`;
}

/** 見本の実測値。ここに無い指標は「未計測」として画面に出る。 */
const SAMPLE_VALUES: ReadonlyArray<readonly [MetricKey, number, number | null]> = [
  ["page_views", 12480, null],
  ["unique_readers", 8210, null],
  ["read_completion_rate", 0.42, 12480],
  ["scroll_depth_p50", 0.68, 12480],
  ["time_on_page_seconds", 186, null],
  ["ai_answer_count", 340, null],
  ["ai_tool_success_rate", 0.91, 340],
  ["ai_answer_evidence_rate", 0.86, 340],
  ["webmcp_tool_invocations", 512, null],
  ["correction_count", 3, null],
  ["evidence_coverage_rate", 0.74, 128],
  ["review_overdue_count", 2, null],
  ["affiliate_click_count", 640, null],
  ["conversion_count", 18, null],
  ["revenue_amount", 42600, null],
  // 意図的に空けている指標:
  //   return_rate / ai_handoff_to_human_rate / stale_price_ratio /
  //   publish_gate_failure_rate / epc
  //   → 「未計測」の見え方と、母数の無い割合を出さないことを確かめる。
];

export function createSampleMetricsRepository(): MetricsRepositoryPort {
  return {
    async query(_workspaceId, input) {
      const wanted = new Set<MetricKey>(input.keys);
      const samples: MetricSample[] = SAMPLE_VALUES.filter(([key]) => wanted.has(key)).map(
        ([key, value, denominator]) => ({
          key,
          value,
          from: input.from,
          to: input.to,
          denominator,
        }),
      );
      return ok(samples);
    },
    // 記録はできない。できたふりをすると、集計が合わない原因が追えなくなる。
    record: () => stubCall(stub, "指標の記録"),
  };
}

/**
 * クリックの記録。
 *
 * URL を書き換えずに測るため、計測識別子とクリックを別に記録する仕組み。
 * 保存先が無いので、いまは記録できない。
 */
export function createSampleClickTracking(): ClickTrackingPort {
  return {
    recordClick: () => stubCall(stub, "クリックの記録"),
  };
}
