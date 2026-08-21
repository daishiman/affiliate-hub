import type { LlmModelSelection } from "@/application/ports";
import type { LlmProviderCatalogPort } from "@/application/ports/llm-credential";
import { domainError, err, ok } from "@/domain/shared";
import type { DomainError, Result } from "@/domain/shared";

/**
 * 単価の引き当て。**単価がある場所はここを通る 1 本だけにする。**
 *
 * --- なぜ関数にしたか ---
 * 単価は「見積り（呼ぶ前）」と「使った量の記録（呼んだ後）」の 2 か所で要る。
 * それぞれが自分で持つと、値上げの日に片方だけ直る。
 * しかも 2 つは突き合わせないので、**ずれても誰も気づかない**。
 *
 * 引き当て先は目録（`LLM_PROVIDER_CATALOG` の設定）であり、
 * コードの中に定数としての単価は 1 つも無い。
 */

export type ModelPricing = {
  readonly inputMinorPerMillionTokens: number;
  readonly outputMinorPerMillionTokens: number;
  readonly currency: string;
};

export type LlmPricingLookup = {
  find(model: LlmModelSelection): Promise<Result<ModelPricing, DomainError>>;
};

export function createPricingLookup(catalog: LlmProviderCatalogPort): LlmPricingLookup {
  return {
    async find(model) {
      const models = await catalog.listModels(model.providerId);
      if (!models.ok) return err(models.error);

      const found = models.value.find((m) => m.modelId === model.modelId);
      if (found === undefined) {
        /**
         * **0 円で通さない。**
         *
         * 見つからないときに 0 を返すと、見積りは常に上限を下回り、
         * 使った量の記録も 0 円で積み上がる。請求が来るまで気づく手がかりが無い。
         * 「知らないモデルでは書かない」で止めるほうが安い。
         */
        return err(
          domainError("NOT_FOUND", "選ばれたモデルが目録にありません。", {
            suggestedAction:
              "画面の一覧からモデルを選び直してください。一覧に出ない場合は、設定（LLM_PROVIDER_CATALOG）へ単価つきで登録が要ります。",
            details: { providerId: model.providerId, modelId: model.modelId },
          }),
        );
      }
      return ok({
        inputMinorPerMillionTokens: found.inputPricePerMillionMinor,
        outputMinorPerMillionTokens: found.outputPricePerMillionMinor,
        currency: found.currency,
      });
    },
  };
}
