import type { LlmPort, LlmRequest, LlmResponse } from "@/application/ports";
import { type DomainError, type Result, err, ok } from "@/domain/shared";
import { assemblePrompt } from "../prompt-assembly";
import { type HttpLlmDeps, type ProviderSpec, createHttpLlm, unreadableReply } from "./http-llm";

/**
 * Anthropic（Claude）への接続。
 *
 * 呼び出しの手順（単価を先に引く・鍵は見出しだけ・使った量を必ず記録する）は
 * 4 社共通なので `./http-llm.ts` に置いてある。このファイルに書くのは
 * **Anthropic だけが違うこと**、つまり送り先・見出し・本文の形・応答の読み方に限る。
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
    return err(unreadableReply("unknown"));
  }
  const r = reply as AnthropicReply;
  const block = (r.content ?? []).find((b) => b.type === "tool_use" && b.name === RESULT_TOOL);
  if (block === undefined || block.input === undefined) {
    return err(unreadableReply(r.stop_reason ?? "unknown"));
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

export const ANTHROPIC_SPEC: ProviderSpec = {
  providerId: PROVIDER_ID,
  label: "Anthropic",
  endpoint: () => ENDPOINT,
  buildBody: buildMessagesBody,
  headers: (apiKey) => ({
    // 鍵が現れるのはこの 1 行だけ。本文には入らない。
    "x-api-key": apiKey,
    "anthropic-version": API_VERSION,
  }),
  readReply,
  /**
   * Anthropic は埋め込みの API を出していない。
   * 「近い記事を探す」は別の提供元か別の手段で用意する。
   */
  embedRefusal: "Anthropic では類似記事の検出に対応していません。",
};

export type AnthropicLlmDeps = HttpLlmDeps;

export function createAnthropicLlm(deps: AnthropicLlmDeps): LlmPort {
  return createHttpLlm(ANTHROPIC_SPEC, deps);
}
