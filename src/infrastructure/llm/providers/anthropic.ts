import type { LlmPort, LlmRequest, LlmResponse } from "@/application/ports";
import type { LlmKeyAccess, LlmUsageRecorder } from "../key-access";
import { containsSecret, redactSecretsInText } from "@/domain/generation/llm-credential";
import {
  type DomainError,
  type Result,
  type WorkspaceId,
  domainError,
  err,
  ok,
} from "@/domain/shared";
import { assemblePrompt } from "../prompt-assembly";

/**
 * Anthropic（Claude）への接続。
 *
 * --- 鍵と文章が同じ場所に来る、唯一のファイル ---
 * 呼び出しには「鍵（見出しに載せる）」と「指示・資料（本文に載せる）」の
 * 両方が要る。だからここだけは両方が同じ関数の中に現れる。
 *
 * 混ざらないようにするために、本文の組み立てを
 * **鍵を受け取らない純関数**（`buildMessagesBody`）へ出した。
 * 引数に鍵が無いので、本文へ鍵を入れることが書き方として不可能になる。
 * 「気をつける」ではなく「渡さない」で守る。
 *
 * 規範: docs/product/credential-registration.md
 */

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const PROVIDER_ID = "anthropic";

/** 構造化出力に使う道具の名前。自由文を返させないための器。 */
const RESULT_TOOL = "emit_result";

/**
 * 送る本文を組み立てる。**鍵を引数に取らない。**
 *
 * 指示と資料の分離は `assemblePrompt` が済ませている
 * （資料の中の命令文を指示として扱わないための枠）。ここはその 2 つを
 * Anthropic の形へ移すだけで、文字列を混ぜ直さない。
 */
export function buildMessagesBody(
  request: LlmRequest,
  modelId: string,
): Readonly<Record<string, unknown>> {
  const { system, user } = assemblePrompt(request);
  return {
    model: modelId,
    max_tokens: request.maxOutputTokens,
    temperature: request.temperature,
    system,
    messages: [{ role: "user", content: user }],
    /**
     * 自由文で JSON を書かせず、道具の引数として出させる。
     * 自由文だと前置きや ```json が混ざり、取り出しに失敗した回も
     * 料金だけ掛かる。
     */
    tools: [
      {
        name: RESULT_TOOL,
        description: "指示された形の結果を返す。",
        input_schema: request.outputSchema,
      },
    ],
    tool_choice: { type: "tool", name: RESULT_TOOL },
  };
}

type AnthropicUsage = { readonly input_tokens?: number; readonly output_tokens?: number };
type AnthropicBlock = { readonly type?: string; readonly name?: string; readonly input?: unknown };
type AnthropicReply = {
  readonly content?: readonly AnthropicBlock[];
  readonly usage?: AnthropicUsage;
  readonly stop_reason?: string;
  readonly model?: string;
};

/** 応答から結果を取り出す。取り出せない形は失敗にする（黙って空を返さない）。 */
export function readReply<T>(
  reply: unknown,
  fallbackModelId: string,
): Result<LlmResponse<T>, DomainError> {
  if (typeof reply !== "object" || reply === null) {
    return err(domainError("UPSTREAM_UNAVAILABLE", "生成 AI の応答を読み取れませんでした。"));
  }
  const r = reply as AnthropicReply;
  const block = (r.content ?? []).find((b) => b.type === "tool_use" && b.name === RESULT_TOOL);
  if (block === undefined || block.input === undefined) {
    return err(
      domainError("UPSTREAM_UNAVAILABLE", "生成 AI が指定した形で答えませんでした。", {
        retryable: true,
        suggestedAction: "もう一度お試しください。続くようなら別のモデルを選んでください。",
        details: { stopReason: r.stop_reason ?? "unknown" },
      }),
    );
  }
  return ok({
    output: block.input as T,
    modelId: r.model ?? fallbackModelId,
    inputTokens: r.usage?.input_tokens ?? 0,
    outputTokens: r.usage?.output_tokens ?? 0,
    // 途中で切れた本文をそのまま公開しないための印。
    truncated: r.stop_reason === "max_tokens",
  });
}

/**
 * 提供元が返した失敗を、画面に出せる形へ移す。
 *
 * **本文をそのまま載せない。** Anthropic は鍵の一部を載せた文面を
 * 返すことがある。ここでは鍵を持っているので、値そのもので突き合わせて捨てる。
 */
function toFailure(status: number, body: string, apiKey: string): DomainError {
  const safe = containsSecret(body, apiKey) ? "" : redactSecretsInText(body).slice(0, 300);
  const details = { providerId: PROVIDER_ID, status, upstreamMessage: safe };
  if (status === 401 || status === 403) {
    return domainError("UNAUTHENTICATED", "Anthropic に API キーが受け付けられませんでした。", {
      suggestedAction: "設定画面から API キーを登録し直してください。",
      details,
    });
  }
  if (status === 429) {
    return domainError("RATE_LIMITED", "Anthropic の利用上限に達しました。", {
      retryable: true,
      suggestedAction: "しばらく待ってからお試しください。",
      details,
    });
  }
  if (status >= 500) {
    return domainError("UPSTREAM_UNAVAILABLE", "Anthropic 側で問題が起きています。", {
      retryable: true,
      suggestedAction: "しばらく待ってからお試しください。",
      details,
    });
  }
  return domainError("VALIDATION_FAILED", "Anthropic への依頼が受け付けられませんでした。", {
    suggestedAction: "選んでいるモデルが使えるかを設定画面で確認してください。",
    details,
  });
}

export type AnthropicPricing = {
  readonly inputMinorPerMillionTokens: number;
  readonly outputMinorPerMillionTokens: number;
  readonly currency: string;
};

export type AnthropicLlmDeps = {
  readonly vault: LlmKeyAccess;
  readonly workspaceId: WorkspaceId;
  readonly modelId: string;
  readonly pricing: AnthropicPricing;
  /**
   * 使った量の記録先。**省略できない。**
   * 省ける形にすると、呼び出しを足すたびに記録が漏れ、
   * 漏れても画面は何も変わらないので請求が来るまで気づけない。
   */
  readonly usage: LlmUsageRecorder;
  readonly fetchImpl?: typeof fetch;
};

function costOf(input: number, output: number, pricing: AnthropicPricing): number {
  return Math.ceil(
    (input * pricing.inputMinorPerMillionTokens) / 1_000_000 +
      (output * pricing.outputMinorPerMillionTokens) / 1_000_000,
  );
}

export function createAnthropicLlm(deps: AnthropicLlmDeps): LlmPort {
  const doFetch = deps.fetchImpl ?? fetch;

  async function note(
    inputTokens: number,
    outputTokens: number,
    succeeded: boolean,
  ): Promise<Result<void, DomainError>> {
    return deps.usage.record({
      workspaceId: deps.workspaceId,
      providerId: PROVIDER_ID,
      modelId: deps.modelId,
      purpose: "draft",
      inputTokens,
      outputTokens,
      estimatedCostMinor: costOf(inputTokens, outputTokens, deps.pricing),
      currency: deps.pricing.currency,
      succeeded,
    });
  }

  return {
    async generateStructured<T>(request: LlmRequest) {
      // 本文を先に組み立てる。**鍵を取り出す前**に済ませることで、
      // 鍵の見えている範囲を通信の一瞬だけに縮める。
      const body = buildMessagesBody(request, deps.modelId);

      const called = await deps.vault.useKey({
        workspaceId: deps.workspaceId,
        providerId: PROVIDER_ID,
        fn: async (apiKey): Promise<Result<LlmResponse<T>, DomainError>> => {
          const response = await doFetch(ENDPOINT, {
            method: "POST",
            headers: {
              // 鍵が現れるのはこの 1 行だけ。本文には入らない。
              "x-api-key": apiKey,
              "anthropic-version": API_VERSION,
              "content-type": "application/json",
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const text = await response.text().catch(() => "");
            return err(toFailure(response.status, text, apiKey));
          }
          const parsed: unknown = await response.json().catch(() => null);
          return readReply<T>(parsed, deps.modelId);
        },
      });

      if (!called.ok) {
        // 鍵が無い・開けない・通信ごと失敗した。ここでは使った量が分からない。
        const noted = await note(0, 0, false);
        if (!noted.ok) return noted;
        return called;
      }
      const result = called.value;
      const tokens = result.ok
        ? { input: result.value.inputTokens, output: result.value.outputTokens }
        : { input: 0, output: 0 };

      /**
       * 記録できなかったら、生成できていても失敗として返す。
       *
       * もったいないようだが、記録の落ちた呼び出しを黙って通すと
       * 「請求は増えるのに画面のどこにも出ない使い方」が積み上がる。
       * それに、記録先は記事の保存先と同じ D1 なので、
       * ここが書けない状態なら下書きも保存できない。
       */
      const noted = await note(tokens.input, tokens.output, result.ok);
      if (!noted.ok) return noted;
      return result;
    },

    async embed() {
      /**
       * Anthropic は埋め込みの API を出していない。
       * 「近い記事を探す」は別の提供元か別の手段で用意する。
       * ここで 0 埋めの配列を返すと、**似ていない記事が似ていると判定される**。
       */
      return err(
        domainError("NOT_SUPPORTED", "Anthropic では類似記事の検出に対応していません。", {
          suggestedAction: "類似記事の検出には別の提供元を選んでください。",
        }),
      );
    },
  };
}
