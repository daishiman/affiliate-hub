import type { LlmPort, LlmRequest, LlmResponse } from "@/application/ports";
import { type DomainError, type Result, err, ok } from "@/domain/shared";
import { assemblePrompt } from "../prompt-assembly";
import {
  type HttpLlmDeps,
  type ProviderSpec,
  createHttpLlm,
  parseJsonText,
  unreadableReply,
} from "./http-llm";
import { toStrictSchema } from "./openai";

/**
 * xAI（Grok）への接続。
 *
 * 呼び出しの手順は 4 社共通（`./http-llm.ts`）。ここに書くのは xAI だけが
 * 違うこと、つまり送り先・見出し・本文の形・応答の読み方に限る。
 *
 * --- OpenAI と同じ形だが、同じ実装にはしない ---
 * xAI は OpenAI 互換をうたっており、形の強制の書き方も似ている。
 * それでも 1 ファイルにまとめないのは、**互換は提供元の都合で外れる**ため。
 * 外れた日に片方だけ直せる形にしておく。
 * ただし形を直す関数（`toStrictSchema`）は考え方が同じなので共有する。
 *
 * 確認した資料（2026-08-18）:
 *   https://docs.x.ai/docs/guides/structured-outputs
 */

const PROVIDER_ID = "xai";
const ENDPOINT = "https://api.x.ai/v1/chat/completions";
const SCHEMA_NAME = "result";

/**
 * 送る本文を組み立てる。**鍵を引数に取らない。**
 *
 * 指示は `system` の役、資料は `user` の役に置く。
 * `assemblePrompt` が済ませた分離をここで混ぜ直さない。
 */
export function buildChatCompletionsBody(
  request: LlmRequest,
  modelId: string,
): Readonly<Record<string, unknown>> {
  const { system, user } = assemblePrompt(request);
  return {
    model: modelId,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: request.maxOutputTokens,
    temperature: request.temperature,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: SCHEMA_NAME,
        strict: true,
        schema: toStrictSchema(request.outputSchema),
      },
    },
  };
}

type XaiChoice = {
  readonly message?: { readonly content?: string };
  readonly finish_reason?: string;
};
type XaiReply = {
  readonly choices?: readonly XaiChoice[];
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
  readonly model?: string;
};

/** 応答から結果を取り出す。取り出せない形は失敗にする（黙って空を返さない）。 */
export function readChatCompletionsReply<T>(
  reply: unknown,
  fallbackModelId: string,
): Result<LlmResponse<T>, DomainError> {
  if (typeof reply !== "object" || reply === null) return err(unreadableReply("unknown"));
  const r = reply as XaiReply;
  const choice = r.choices?.[0];
  const finishReason = choice?.finish_reason ?? "unknown";

  const output = parseJsonText<T>(choice?.message?.content, finishReason);
  if (!output.ok) return err(output.error);

  return ok({
    output: output.value,
    modelId: r.model ?? fallbackModelId,
    inputTokens: r.usage?.prompt_tokens ?? 0,
    outputTokens: r.usage?.completion_tokens ?? 0,
    // 途中で切れた本文をそのまま公開しないための印。
    truncated: finishReason === "length",
  });
}

export const XAI_SPEC: ProviderSpec = {
  providerId: PROVIDER_ID,
  label: "xAI",
  endpoint: () => ENDPOINT,
  buildBody: buildChatCompletionsBody,
  // 鍵が現れるのはこの 1 行だけ。本文には入らない。
  headers: (apiKey) => ({ authorization: `Bearer ${apiKey}` }),
  readReply: readChatCompletionsReply,
  embedRefusal: "xAI での類似記事の検出は、まだ繋いでいません。",
};

export function createXaiLlm(deps: HttpLlmDeps): LlmPort {
  return createHttpLlm(XAI_SPEC, deps);
}
