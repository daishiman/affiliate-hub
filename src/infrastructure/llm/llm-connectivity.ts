import type { LlmConnectivityPort, LlmProviderCatalogPort } from "@/application/ports/llm-credential";
import type { LlmKeyAccess, LlmUsageRecorder } from "./key-access";
import { domainError, err, ok } from "@/domain/shared";
import type { WorkspaceId } from "@/domain/shared";
import { createAnthropicLlm } from "./providers/anthropic";

/**
 * 登録した鍵が実際に使えるかを 1 回だけ確かめる。
 *
 * --- なぜ「短い依頼を 1 回」なのか ---
 * 形の検査（長さ・空白）は通っても、無効な鍵・権限の足りない鍵・
 * その口座では使えないモデルは通ってしまう。
 * その場合に気づくのは記事を作ろうとしたときで、
 * そこでは「鍵か、モデルか、提供元の不調か」の切り分けができない。
 *
 * 登録の直後に 1 回だけ送れば、切り分けはその場で終わる。
 * 依頼は最小（出力 16 トークン）にして、確認の費用をほぼ 0 にする。
 *
 * --- 使った量も記録する ---
 * 確認そのものにも料金が掛かる。記録しないと、
 * 「誰も記事を作っていないのに請求がある」の説明が付かなくなる。
 */

const PING_REQUEST = {
  instructions: "接続の確認です。ok に true を入れて返してください。",
  untrustedContext: [],
  outputSchema: {
    type: "object",
    properties: { ok: { type: "boolean" } },
    required: ["ok"],
  },
  promptVersion: "connectivity-v1",
  maxOutputTokens: 16,
  temperature: 0,
} as const;

export type LlmConnectivityDeps = {
  readonly vault: LlmKeyAccess;
  readonly catalog: LlmProviderCatalogPort;
  readonly usage: LlmUsageRecorder;
  readonly fetchImpl?: typeof fetch;
};

export function createLlmConnectivity(deps: LlmConnectivityDeps): LlmConnectivityPort {
  return {
    async check(input: { workspaceId: WorkspaceId; providerId: string; modelId: string }) {
      // 単価は目録から取る。**確認のぶんも同じ単価で記録する**
      // （ここだけ別の数字を使うと、合計が合わない理由が増える）。
      const models = await deps.catalog.listModels(input.providerId);
      if (!models.ok) return models;
      const model = models.value.find((m) => m.modelId === input.modelId);
      if (model === undefined) {
        return err(
          domainError("NOT_FOUND", "選ばれたモデルが目録にありません。", {
            suggestedAction: "画面の一覧からモデルを選び直してください。",
            details: { providerId: input.providerId, modelId: input.modelId },
          }),
        );
      }

      const pricing = {
        inputMinorPerMillionTokens: model.inputPricePerMillionMinor,
        outputMinorPerMillionTokens: model.outputPricePerMillionMinor,
        currency: model.currency,
      };

      /**
       * 提供元ごとの呼び方はここで分ける。**利用者は 1 社ずつ増える。**
       * まだ作っていない提供元は「未対応」と答える。
       * 成功したことにすると、使えない鍵が「確認済み」として残る。
       */
      if (input.providerId !== "anthropic") {
        return err(
          domainError("NOT_IMPLEMENTED", "この提供元への接続はまだ用意できていません。", {
            suggestedAction: "いまは Anthropic（Claude）をお使いください。",
            details: { providerId: input.providerId },
          }),
        );
      }

      const llm = createAnthropicLlm({
        vault: deps.vault,
        workspaceId: input.workspaceId,
        modelId: input.modelId,
        pricing,
        usage: verificationUsage(deps.usage),
        fetchImpl: deps.fetchImpl,
      });

      const called = await llm.generateStructured<{ ok?: boolean }>(PING_REQUEST);
      if (!called.ok) return called;
      return ok(undefined);
    },
  };
}

/**
 * 確認のための呼び出しを「確認」として記録する。
 *
 * 下書きと同じ扱いで記録すると、
 * 「作った記事の数より生成の回数が多い」理由が読めなくなる。
 */
function verificationUsage(inner: LlmUsageRecorder): LlmUsageRecorder {
  return {
    record: (entry) => inner.record({ ...entry, purpose: "verification" }),
  };
}
