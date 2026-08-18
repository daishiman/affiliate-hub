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

/**
 * Google（Gemini）への接続。
 *
 * 呼び出しの手順は 4 社共通（`./http-llm.ts`）。ここに書くのは Gemini だけが
 * 違うこと、つまり送り先・見出し・本文の形・応答の読み方に限る。
 *
 * 確認した資料（2026-08-18）:
 *   https://ai.google.dev/gemini-api/docs/structured-output
 */

const PROVIDER_ID = "google";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * 送る本文を組み立てる。**鍵を引数に取らない。**
 *
 * 指示（`systemInstruction`）と資料（`contents`）を別の枠に置くのは
 * Anthropic と同じ。`assemblePrompt` が済ませた分離をここで混ぜ直さない。
 *
 * 形の強制は `responseMimeType` + `responseSchema` で行う。道具呼び出しを
 * 使わないので本文は文字列で返るが、**読めなかったら失敗**にするので
 * 前置きの混ざった答えが記事として保存されることはない。
 */
export function buildGenerateContentBody(
  request: LlmRequest,
  _modelId: string,
): Readonly<Record<string, unknown>> {
  const { system, user } = assemblePrompt(request);
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      responseMimeType: "application/json",
      /**
       * Gemini が受け取るのは OpenAPI 由来の一部の書き方だけで、
       * JSON Schema のすべてを解釈するわけではない。受け付けられない書き方は
       * 400 で返り、`toFailure` が「選んでいるモデルが使えるかを確認してください」
       * として返す。**黙って自由文に落とさない**ことがここでは大事で、
       * 落とすと形の合っていない答えがそのまま記事になる。
       */
      responseSchema: request.outputSchema,
    },
  };
}

type GeminiPart = { readonly text?: string };
type GeminiCandidate = {
  readonly content?: { readonly parts?: readonly GeminiPart[] };
  readonly finishReason?: string;
};
type GeminiReply = {
  readonly candidates?: readonly GeminiCandidate[];
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
  };
  readonly modelVersion?: string;
};

/** 応答から結果を取り出す。取り出せない形は失敗にする（黙って空を返さない）。 */
export function readGeminiReply<T>(
  reply: unknown,
  fallbackModelId: string,
): Result<LlmResponse<T>, DomainError> {
  if (typeof reply !== "object" || reply === null) return err(unreadableReply("unknown"));
  const r = reply as GeminiReply;
  const candidate = r.candidates?.[0];
  const finishReason = candidate?.finishReason ?? "unknown";

  // 部品が複数に割れて返ることがある。1 つ目だけ読むと、
  // 途中までの JSON を「壊れた答え」と誤って報告する。
  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  const output = parseJsonText<T>(text, finishReason);
  if (!output.ok) return err(output.error);

  return ok({
    output: output.value,
    modelId: r.modelVersion ?? fallbackModelId,
    inputTokens: r.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: r.usageMetadata?.candidatesTokenCount ?? 0,
    // 途中で切れた本文をそのまま公開しないための印。
    truncated: finishReason === "MAX_TOKENS",
  });
}

export const GOOGLE_SPEC: ProviderSpec = {
  providerId: PROVIDER_ID,
  label: "Google Gemini",
  /**
   * モデル名が経路に入る。**鍵は経路に入れない。**
   * Gemini は `?key=` での指定も受け付けるが、経路は記録や中継の
   * ログに残りやすい。見出し（`x-goog-api-key`）だけを使う。
   */
  endpoint: (modelId) => `${BASE}/${encodeURIComponent(modelId)}:generateContent`,
  buildBody: buildGenerateContentBody,
  headers: (apiKey) => ({ "x-goog-api-key": apiKey }),
  readReply: readGeminiReply,
  /**
   * Gemini は埋め込みの API を持っているが、まだ繋いでいない。
   * 「持っていない」ではなく「まだ繋いでいない」と書き分ける。
   */
  embedRefusal: "Google Gemini での類似記事の検出は、まだ繋いでいません。",
};

export function createGoogleLlm(deps: HttpLlmDeps): LlmPort {
  return createHttpLlm(GOOGLE_SPEC, deps);
}
