import type { TelemetrySinkPort } from "@/application/ports/telemetry";
import { MODEL_PRICES, findModelPrice, totalAiCost, type AiUsageRollup } from "@/domain/analytics/ai-usage";
import { DEFAULT_METRICS_WINDOW_DAYS } from "@/domain/analytics/metrics";
import { requireCapability } from "@/domain/identity";
import { type ActorContext, type DomainError, type Result, formatMoney, ok } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 「どのブログで、どのモデルを、いくら使ったか」を出すユースケース。
 *
 * 数字と一緒に**その数字の限界**を返す。
 *   - 概算であり請求額と一致しないこと
 *   - 価格表に無いモデルが何回呼ばれたか (その分だけ費用が過小に見える)
 * これを画面側で書かせると、片方の画面にだけ注意書きが載る状態になる。
 */
export type AiUsageReportDeps = {
  readonly sink: TelemetrySinkPort;
};

export type AiUsageReportInput = {
  readonly days?: number;
  readonly siteSlug?: string;
};

export type AiUsageRow = AiUsageRollup & {
  readonly modelLabel: string;
  readonly costLabel: string;
  readonly priced: boolean;
};

export type AiUsageReportOutput = {
  readonly from: Date;
  readonly to: Date;
  readonly rows: readonly AiUsageRow[];
  readonly totalCalls: number;
  readonly totalCostLabel: string;
  readonly totalFailures: number;
  /** 数字を読むときの注意。必ず画面に出す。 */
  readonly caveats: readonly string[];
  readonly emptyReason: string | null;
};

export function createAiUsageReportUseCase(
  deps: AiUsageReportDeps,
): UseCase<AiUsageReportInput, AiUsageReportOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: AiUsageReportInput,
    ): Promise<Result<AiUsageReportOutput, DomainError>> {
      const allowed = requireCapability(actor, "analytics.read", "AI 利用状況の参照");
      if (!allowed.ok) return allowed;

      const days = input.days ?? DEFAULT_METRICS_WINDOW_DAYS;
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

      const queried = await deps.sink.aiUsage(actor.workspaceId, {
        from,
        to,
        siteSlug: input.siteSlug,
      });
      // 保存先が未実装でも画面は開く。空の一覧と理由を返す。
      const rollups: readonly AiUsageRollup[] = queried.ok ? queried.value : [];

      const rows = rollups.map((r): AiUsageRow => {
        const price = findModelPrice(r.modelId);
        return {
          ...r,
          modelLabel: price?.label ?? `${r.modelId}（価格未登録）`,
          costLabel: formatMoney({ amountMinor: r.costJpy, currency: "JPY" }),
          priced: price !== null,
        };
      });

      const total = totalAiCost(rollups);
      const caveats = [
        `費用は概算です。価格表 (${MODEL_PRICES.length} 件) をもとに計算しており、実際の請求額とは一致しません。`,
        "失敗した呼び出しにも費用はかかります。失敗の回数も並べています。",
      ];
      if (total.unpricedCalls > 0) {
        caveats.push(
          `価格が登録されていないモデルの呼び出しが ${total.unpricedCalls} 件あります。その分、費用は少なく見えています。`,
        );
      }

      return ok({
        from,
        to,
        rows,
        totalCalls: total.calls,
        totalCostLabel: formatMoney({ amountMinor: total.costJpy, currency: "JPY" }),
        totalFailures: total.failures,
        caveats,
        emptyReason:
          rows.length > 0
            ? null
            : queried.ok
              ? "この期間に AI の利用はありません。"
              : `AI 利用の記録をまだ読み出せません（${queried.error.message}）。`,
      });
    },
  };
}
