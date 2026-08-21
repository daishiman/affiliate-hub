import type { LlmUsagePort, LlmUsageSummary } from "@/application/ports/llm-usage";
import { requireCapability } from "@/domain/identity";
import type { ActorContext, DomainError, Result } from "@/domain/shared";
import { err, ok, validationError } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 生成 AI をどれだけ使ったかを読む。
 *
 * --- なぜ画面を先に用意するか ---
 * 使った量は、記録するだけでは誰も見ない。見ないものは、
 * 「思っていたより高い」に気づくのが請求のときになる。
 * 記録の口を作った変更と同じ中で読む口も作る、を規則にしている。
 *
 * --- 合計を 1 つにしない ---
 * 通貨ごとに分けて返す。提供元は米ドル建てのところと円建てのところがあり、
 * 混ぜて 1 つの数にすると、出た数字が何なのか誰にも説明できなくなる。
 *
 * --- 「概算」であることを値として持つ ---
 * 単価は目録から取った見積りで、請求額ではない。
 * 画面の文言としてではなく戻り値に持たせるのは、
 * 画面を作り直したときに注意書きだけ落ちるのを避けるため。
 */
export type ReadLlmUsageDeps = {
  readonly usage: LlmUsagePort;
};

export type ReadLlmUsageInput = {
  readonly from: Date;
  readonly to: Date;
};

export type LlmUsageTotal = {
  readonly currency: string;
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostMinor: number;
};

export type ReadLlmUsageOutput = {
  /** 提供元とモデルごとの内訳。使っていなければ空。 */
  readonly rows: readonly LlmUsageSummary[];
  /** 通貨ごとの合計。**通貨をまたいで足さない。** */
  readonly totals: readonly LlmUsageTotal[];
  /** 使っていないときの理由。使っているときは `null`。 */
  readonly emptyReason: string | null;
  /** 画面に必ず出す但し書き。 */
  readonly estimateNote: string;
};

export const LLM_USAGE_ESTIMATE_NOTE =
  "金額は登録されている単価からの概算です。請求の正は各提供元の管理画面をご確認ください。";

export function createReadLlmUsageUseCase(
  deps: ReadLlmUsageDeps,
): UseCase<ReadLlmUsageInput, ReadLlmUsageOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ReadLlmUsageInput,
    ): Promise<Result<ReadLlmUsageOutput, DomainError>> {
      const allowed = requireCapability(actor, "analytics.read", "生成 AI の利用量の閲覧");
      if (!allowed.ok) return allowed;

      // 期間が逆さまなら 0 件が返る。0 件は「使っていない」と同じ見た目なので、
      // ここで断る（見た目が同じものを、違う原因で作らない）。
      if (input.to.getTime() < input.from.getTime()) {
        return err(validationError("終わりの日が始まりの日より前になっています。", "to"));
      }

      const summarized = await deps.usage.summarize({
        workspaceId: actor.workspaceId,
        from: input.from,
        to: input.to,
      });
      if (!summarized.ok) return summarized;

      const byCurrency = new Map<string, LlmUsageTotal>();
      for (const row of summarized.value) {
        const current = byCurrency.get(row.currency);
        byCurrency.set(row.currency, {
          currency: row.currency,
          calls: (current?.calls ?? 0) + row.calls,
          inputTokens: (current?.inputTokens ?? 0) + row.inputTokens,
          outputTokens: (current?.outputTokens ?? 0) + row.outputTokens,
          estimatedCostMinor: (current?.estimatedCostMinor ?? 0) + row.estimatedCostMinor,
        });
      }

      return ok({
        rows: summarized.value,
        totals: [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
        emptyReason:
          summarized.value.length > 0
            ? null
            : "この期間に生成 AI を使った記録はありません。API キーが未登録の場合は、設定画面から登録してください。",
        estimateNote: LLM_USAGE_ESTIMATE_NOTE,
      });
    },
  };
}
