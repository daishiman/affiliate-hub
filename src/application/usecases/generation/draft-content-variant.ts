import {
  type GenerationInput,
  checkOutputShape,
  isPromptVersion,
  maxOutputTokensFor,
  missingInputFields,
  renderInstructionBlocks,
  renderInstructions,
  reviewMaterial,
  SELF_REPORTED_FIELDS,
  generatedVariantJsonSchema,
} from "@/domain/generation";
import { requireCapability } from "@/domain/identity";
import { domainError, err, ok } from "@/domain/shared";
import type { LlmCostEstimatorPort, LlmPort, LlmRequest } from "@/application/ports";
import type { UseCase } from "../usecase";

/**
 * 下書きを 1 本作らせるユースケース。
 *
 * このアプリで唯一、生成 AI を実際に呼ぶ場所。
 * ここが 1 つあることで、次の 3 つが 1 箇所に集まる。
 *
 *   1. 「そろっていなければ始めない」（GC-1）
 *   2. 「取り込んだ文章は資料であって指示ではない」（プロンプト注入への備え）
 *   3. 「費用は呼ぶ前に見積もる」（実行してから請求で気づく、を避ける）
 *
 * 提供元の名前はここに 1 つも出てこない。
 * 受け取るのは `LlmPort` という形だけで、
 * 誰が生成するかは `src/infrastructure/llm/llm-setup.ts` が決める。
 *
 * **報酬に関する数字はこのユースケースに入って来られない。**
 * 入力は `GenerationInput` に限られ、その型には報酬の欄が無い。
 * 商品は `Editorial` の印つきなので、成果報酬の付いた素材を渡すと型検査で止まる。
 */

/** 外部から取り込んだ文章。指示ではなく資料として渡す。 */
export type DraftMaterial = {
  readonly label: string;
  readonly sourceUrl: string | null;
  readonly text: string;
};

export type DraftContentVariantInput = {
  readonly provided: Partial<GenerationInput>;
  readonly materials?: readonly DraftMaterial[];
  readonly promptVersion?: string;
  /** 1 本あたりの上限（最小単位。円なら円）。超える見積りは呼ばずに止める。 */
  readonly budgetMinor?: number | null;
};

export type DraftContentVariantResult = {
  readonly promptVersion: string;
  readonly modelId: string;
  readonly output: Readonly<Record<string, unknown>>;
  readonly estimatedCostMinor: number;
  readonly currency: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** 指示文がどの塊で組み上がったか。何を渡したかを後から見えるようにする。 */
  readonly instructionBlocks: readonly {
    readonly id: string;
    readonly label: string;
    readonly charCount: number;
  }[];
  readonly materialCount: number;
  /** 合否の判断に使ってはならない欄。画面と道具の両方で同じものを出す。 */
  readonly notForVerdict: readonly string[];
};

export type DraftContentVariantDeps = {
  readonly llm: LlmPort;
  readonly costs: LlmCostEstimatorPort;
};

/** 生成の温度。低くしてあるのは、同じ素材から違う事実が出てくるのを避けるため。 */
const TEMPERATURE = 0.2;

export function createDraftContentVariantUseCase(
  deps: DraftContentVariantDeps,
): UseCase<DraftContentVariantInput, DraftContentVariantResult> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.generate", "下書きの生成");
      if (!allowed.ok) return err(allowed.error);

      const version = input.promptVersion ?? "v1";
      if (!isPromptVersion(version)) {
        return err(
          domainError("VALIDATION_FAILED", `指示文の版「${version}」は形が違います。`, {
            suggestedAction: "v1・v2 のように、v と数字で指定してください。",
          }),
        );
      }

      // ① そろっていなければ始めない。
      //    足りない分を AI に補わせると、素材に無いことがどこから来たか追えなくなる。
      const missing = missingInputFields(input.provided);
      if (missing.length > 0) {
        return err(
          domainError(
            "VALIDATION_FAILED",
            `渡していない項目が ${missing.length} 件あるため、生成を始められません。`,
            {
              suggestedAction: `${missing.map((m) => m.label).join("・")} を先に決めてください。`,
              details: { missing: missing.map((m) => m.key).join(",") },
            },
          ),
        );
      }
      const generationInput = input.provided as GenerationInput;

      // ② 取り込んだ文章に、指示として読ませようとする書き方が無いかを見る。
      //    見つけても自動で消さない。消すと「何が来ていたか」が残らない。
      const materials = input.materials ?? [];
      const held: string[] = [];
      for (const material of materials) {
        const review = reviewMaterial(material.text);
        if (!review.accepted) held.push(material.label);
      }
      if (held.length > 0) {
        return err(
          domainError(
            "VALIDATION_FAILED",
            `資料 ${held.length} 件が保留になっているため、生成を始められません: ${held.join("・")}`,
            {
              suggestedAction:
                "保留の資料を担当者が見て、使うかどうかを決めてください。自動では取り除きません。",
              details: { held: held.join(",") },
            },
          ),
        );
      }

      const request: LlmRequest = {
        instructions: renderInstructions(generationInput),
        untrustedContext: materials.map((m) => ({
          label: m.label,
          sourceUrl: m.sourceUrl,
          text: m.text,
        })),
        outputSchema: generatedVariantJsonSchema(),
        promptVersion: version,
        maxOutputTokens: maxOutputTokensFor(generationInput),
        temperature: TEMPERATURE,
      };

      // ③ 呼ぶ前に見積もる。
      const estimate = await deps.costs.estimate(request);
      if (!estimate.ok) return err(estimate.error);
      const budget = input.budgetMinor ?? null;
      if (budget !== null && estimate.value.estimatedCostMinor > budget) {
        return err(
          domainError(
            "VALIDATION_FAILED",
            `見積り ${estimate.value.estimatedCostMinor} が上限 ${budget} を超えるため、生成しませんでした。`,
            {
              suggestedAction: "長さを短くするか、上限を見直してください。",
              details: {
                estimated: String(estimate.value.estimatedCostMinor),
                budget: String(budget),
              },
            },
          ),
        );
      }

      const generated = await deps.llm.generateStructured<unknown>(request);
      if (!generated.ok) return err(generated.error);

      // ④ 途中で切れた本文をそのまま受け取らない。
      //    切れていることに気づかないまま保存すると、尻切れの記事が世に出る。
      if (generated.value.truncated) {
        return err(
          domainError("VALIDATION_FAILED", "生成が途中で打ち切られました。", {
            suggestedAction: "長さを短くしてやり直してください。途中までの本文は保存しません。",
          }),
        );
      }

      // ⑤ 決めた形に一致しない返答は受け取らない。
      const shaped = checkOutputShape(generated.value.output);
      if (!shaped.ok) return err(shaped.error);

      return ok({
        promptVersion: version,
        modelId: generated.value.modelId,
        output: shaped.value,
        estimatedCostMinor: estimate.value.estimatedCostMinor,
        currency: estimate.value.currency,
        inputTokens: generated.value.inputTokens,
        outputTokens: generated.value.outputTokens,
        instructionBlocks: renderInstructionBlocks(generationInput).map((b) => ({
          id: b.id,
          label: b.label,
          charCount: b.text.length,
        })),
        materialCount: materials.length,
        notForVerdict: [...SELF_REPORTED_FIELDS],
      });
    },
  };
}
