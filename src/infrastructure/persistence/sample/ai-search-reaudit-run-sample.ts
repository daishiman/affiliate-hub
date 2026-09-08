import type { AiSearchReauditRunPort } from "@/application/ports/seo";
import { ok } from "@/domain/shared";
import { stubCall } from "../../stub-registry";
import { CONTENT_SAMPLE_STUB } from "./content-sample-data";

/** D1 の無い見本実行で、残らない run-state の保存を成功と偽らない。 */
export function createSampleAiSearchReauditRunRepository(): AiSearchReauditRunPort {
  return {
    async save() {
      return stubCall<void>(CONTENT_SAMPLE_STUB, "AI 検索の定期再点検結果の保存");
    },
    async getLatest() {
      return ok(null);
    },
    async listKnownWorkspaceIds() {
      return ok([]);
    },
  };
}
