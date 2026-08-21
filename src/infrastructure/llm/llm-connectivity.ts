import type { LlmConnectivityPort, LlmProviderCatalogPort } from "@/application/ports/llm-credential";
import type { LlmKeyAccess, LlmUsageRecorder } from "./key-access";
import { ok } from "@/domain/shared";
import type { WorkspaceId } from "@/domain/shared";
import { createRoutingLlm } from "./llm-provider-registry";
import { createPricingLookup } from "./pricing";

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
  /**
   * 振り分けは**下書きと同じ 1 か所**（`createRoutingLlm`）を通す。
   *
   * ここに `providerId !== "anthropic"` の分岐を別に置いていたが、消した。
   * 分岐が 2 か所あると、片方だけ提供元を足したときに
   * **「確認は通るのに下書きは未対応」**（またはその逆）という、
   * 利用者から見て説明の付かない状態が作れてしまう。
   * まだ作っていない提供元はスタブが失敗を返すので、
   * 「成功したことにする」危険は分岐を消しても増えない。
   *
   * 単価も目録から引く 1 本（`createPricingLookup`）に揃えてある。
   * ここだけ別の数字を使うと、合計が合わない理由が増える。
   */
  const llm = createRoutingLlm({
    vault: deps.vault,
    pricing: createPricingLookup(deps.catalog),
    usage: verificationUsage(deps.usage),
    fetchImpl: deps.fetchImpl,
  });

  return {
    async check(input: { workspaceId: WorkspaceId; providerId: string; modelId: string }) {
      const called = await llm.generateStructured<{ ok?: boolean }>({
        ...PING_REQUEST,
        workspaceId: input.workspaceId,
        model: { providerId: input.providerId, modelId: input.modelId },
      });
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
