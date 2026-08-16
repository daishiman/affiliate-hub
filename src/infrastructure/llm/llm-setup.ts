import type { LlmCostEstimatorPort, LlmPort } from "@/application/ports";
import { createSecretResolver } from "../platform/secret-resolver";
import {
  type LlmProviderKind,
  createCostEstimator,
  createLlm,
  LLM_PROVIDER_LABEL,
} from "./llm-provider-registry";
import { registerStub, stubCall } from "../stub-registry";

/**
 * 「どの生成 AI を使うか」を決める唯一の場所。
 *
 * 提供元を替えるときに書き換えるのは、下の `ACTIVE_PROVIDER` の **1 行だけ**。
 * ドメインもユースケースも画面も触らない
 * （docs/architecture/changeability-scenarios.md ②）。
 *
 * ここに分岐を増やさないこと。
 * 「この機能のときだけ別の提供元」を書き始めると、
 * どの記事がどの提供元で書かれたのかを追えなくなる。
 */

/**
 * ★ 提供元の切り替えはこの 1 行。
 *
 * **いまの値は仮である。** どこの提供元を使うかはまだ決まっていない
 * （docs/spec/08-仕様の未修正点.md ③。費用と乗り換えやすさに効くため、
 * 利用者ご自身の確定が要る）。決まるまでスタブが失敗を返すので、
 * この値が何であっても記事は生成されない。
 *
 * 2026-08-17 に `google_gemini` へ書き換えて実測したところ、
 * 変わったのはこのファイルの 1 行だけだった（テスト 489 件は全て通過）。
 */
const ACTIVE_PROVIDER: LlmProviderKind = "anthropic";

/**
 * 使うモデルと認証情報の置き場所。
 *
 * 鍵の値そのものはここに書かない。書けるのは**参照キー**だけで、
 * 値は利用者ご自身が別のターミナルで登録する。
 */
const MODEL_ID: Readonly<Record<LlmProviderKind, string>> = {
  anthropic: "claude-opus-5",
  openai: "gpt-5",
  workers_ai: "@cf/meta/llama-3.3-70b-instruct",
  google_gemini: "gemini-2.5-pro",
};

const CREDENTIAL_REF: Readonly<Record<LlmProviderKind, string>> = {
  anthropic: "llm/anthropic/api_key",
  openai: "llm/openai/api_key",
  workers_ai: "llm/workers_ai/account_token",
  google_gemini: "llm/google_gemini/api_key",
};

/**
 * 単価（100 万トークンあたり・円の最小単位）。
 *
 * 概算のための値であり、請求額ではない。
 * 提供元が値上げしたらここを直す。ユースケースは触らない。
 */
const PRICING: Readonly<Record<LlmProviderKind, { input: number; output: number }>> = {
  anthropic: { input: 2_250, output: 11_250 },
  openai: { input: 1_800, output: 9_000 },
  workers_ai: { input: 100, output: 100 },
  google_gemini: { input: 1_900, output: 9_500 },
};

export const ACTIVE_LLM_LABEL = LLM_PROVIDER_LABEL[ACTIVE_PROVIDER];

/**
 * **これはスタブである。**
 *
 * 提供元の登録所が「対応していない」と答えたときの受け皿。
 * ここで固定文を返すと、生成していない記事が生成済みとして残る。だから失敗を返す。
 */
function unavailableLlm(reason: string): LlmPort {
  const entry = registerStub({
    id: "llm:unavailable",
    port: "LlmPort",
    label: "生成 AI への接続",
    blockedBy: reason,
  });
  return {
    generateStructured: <T>() => stubCall<T>(entry, "generateStructured") as never,
    embed: () => stubCall<readonly (readonly number[])[]>(entry, "embed"),
  };
}

export function createLlmPorts(env: Readonly<Record<string, unknown>> = {}): {
  readonly llm: LlmPort;
  readonly costs: LlmCostEstimatorPort;
} {
  const built = createLlm(ACTIVE_PROVIDER, {
    credentialRef: CREDENTIAL_REF[ACTIVE_PROVIDER],
    modelId: MODEL_ID[ACTIVE_PROVIDER],
    secrets: createSecretResolver(env),
  });

  const pricing = PRICING[ACTIVE_PROVIDER];
  return {
    llm: built.ok ? built.value : unavailableLlm(built.error.message),
    costs: createCostEstimator({
      inputMinorPerMillionTokens: pricing.input,
      outputMinorPerMillionTokens: pricing.output,
      currency: "JPY",
    }),
  };
}
