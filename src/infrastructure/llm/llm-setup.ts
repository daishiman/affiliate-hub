import type { LlmCostEstimatorPort, LlmPort } from "@/application/ports";
import type { LlmProviderCatalogPort } from "@/application/ports/llm-credential";
import type { LlmKeyAccess, LlmUsageRecorder } from "./key-access";
import { createCostEstimator, createRoutingLlm } from "./llm-provider-registry";
import { createPricingLookup } from "./pricing";
import { registerStub, stubCall } from "../stub-registry";

/**
 * 生成 AI の組み立て。
 *
 * --- 「使う提供元はこの 1 行」をやめた（2026-08-18） ---
 * 以前はここに `ACTIVE_PROVIDER` があり、モデル名・単価・鍵の参照キーを
 * 提供元ごとの表として持っていた。**同じことを目録
 * （`llm-provider-catalog.ts`）も決めていた**ため、片方を直しても
 * もう片方は古いまま型検査を通り、どちらが効いているのか読んでも分からなかった。
 *
 * いまは 3 つとも持たない。
 *   - どのモデルか → 依頼が運ぶ（`LlmRequest.model`。記事ごとに選ぶ）
 *   - 単価         → 目録の設定 1 か所（`LLM_PROVIDER_CATALOG`）
 *   - 鍵           → 作業場所ごとの預かり所（値に触れるのはアダプタだけ）
 *
 * ここに残るのは「使えるかどうかの判定」だけである。
 */

/**
 * 呼び出しに要るもの。**揃わなければ生成しない。**
 *
 * `ready: false` を理由つきにしてあるのは、利用者のやることが
 * 「鍵を登録する」「保存先を用意する」で違うためである。
 * 同じ空白として出すと、どちらをすればよいか分からない。
 */
export type LlmRuntime =
  | {
      readonly ready: true;
      readonly vault: LlmKeyAccess;
      readonly usage: LlmUsageRecorder;
      readonly catalog: LlmProviderCatalogPort;
    }
  | {
      readonly ready: false;
      readonly reason: string;
    };

/**
 * 本物が回れない場所での受け皿。
 *
 * ここで固定文を返すと、生成していない記事が生成済みとして残る。だから失敗を返す。
 *
 * **「まだ中身が無いもの」ではなく「控え」として数える。** 本物
 * （`createRoutingLlm`）はもうあり、鍵の預かり所が供給されない場所
 * （`pnpm dev`・自動テスト）でだけこちらへ回る。実装待ちの側に混ぜると、
 * 環境の都合で未実装の件数が増減し、進み具合を表さなくなる。
 */
const REAL_LLM = "src/infrastructure/llm/llm-provider-registry.ts";

function unavailableLlm(reason: string): LlmPort {
  const entry = registerStub({
    id: "llm:unavailable",
    port: "LlmPort",
    label: "生成 AI への接続",
    blockedBy: reason,
    fallbackFor: REAL_LLM,
  });
  return {
    generateStructured: <T>() => stubCall<T>(entry, "generateStructured") as never,
    embed: () => stubCall<readonly (readonly number[])[]>(entry, "embed"),
  };
}

/**
 * 見積りも同じ理由で断る。
 *
 * 呼べない状態で「0 円」と答えると、上限の判定を必ず通過してしまい、
 * **止まる理由が「生成できません」だけになる**。見積りの段階で理由が出るほうが早い。
 */
function unavailableCosts(reason: string): LlmCostEstimatorPort {
  const entry = registerStub({
    id: "llm:unavailable-costs",
    port: "LlmCostEstimatorPort",
    label: "生成 AI の費用見積り",
    blockedBy: reason,
    fallbackFor: REAL_LLM,
  });
  return {
    estimate: () => stubCall<{ estimatedCostMinor: number; currency: string }>(entry, "estimate"),
  };
}

export function createLlmPorts(runtime: LlmRuntime): {
  readonly llm: LlmPort;
  readonly costs: LlmCostEstimatorPort;
} {
  if (!runtime.ready) {
    return { llm: unavailableLlm(runtime.reason), costs: unavailableCosts(runtime.reason) };
  }

  const pricing = createPricingLookup(runtime.catalog);
  return {
    llm: createRoutingLlm({
      vault: runtime.vault,
      usage: runtime.usage,
      pricing,
    }),
    costs: createCostEstimator(pricing),
  };
}
