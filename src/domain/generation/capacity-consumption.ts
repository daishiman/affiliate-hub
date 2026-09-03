import type { DomainError } from "@/domain/shared";

/**
 * 外部の生成処理が開始済みなのに、利用量の確定だけが失敗した印。
 *
 * この印がある失敗では、月次上限の lease を解放してはいけない。解放すると
 * 提供元では消費済みなのに次の生成を許可でき、複数 isolate で上限を超える。
 */
const GENERATION_CAPACITY_CONSUMED = "generationCapacityConsumed";

export function markGenerationCapacityConsumed(error: DomainError): DomainError {
  return {
    ...error,
    details: {
      ...error.details,
      [GENERATION_CAPACITY_CONSUMED]: true,
    },
  };
}

export function hasConsumedGenerationCapacity(error: DomainError): boolean {
  return error.details?.[GENERATION_CAPACITY_CONSUMED] === true;
}
