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
 * OpenAI への接続。
 *
 * 呼び出しの手順は 4 社共通（`./http-llm.ts`）。ここに書くのは OpenAI だけが
 * 違うこと、つまり送り先・見出し・本文の形・応答の読み方に限る。
 *
 * 確認した資料（2026-08-18）:
 *   https://developers.openai.com/api/docs/guides/structured-outputs
 */

const PROVIDER_ID = "openai";
const ENDPOINT = "https://api.openai.com/v1/responses";
const SCHEMA_NAME = "result";

/**
 * 形の強制（`strict`）が受け付ける書き方へ直す。
 *
 * OpenAI の strict は「すべての項目が `required` に並んでいること」と
 * 「`additionalProperties: false` があること」を要求する。満たさない形は
 * 400 で返るので、**呼ぶ前にこちらで直す**。
 *
 * 「全部必須」でも困らないのは、指示（`assemblePrompt`）が
 * **分からない項目は null** と伝えているため。欄を落とすのではなく
 * 「分からなかった」と書かせるほうが、後から読む人に区別が付く。
 *
 * 元の形は書き換えない（同じ依頼を別の提供元へ送っても中身が変わらないように）。
 */
export function toStrictSchema(schema: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...schema };

  const properties = schema.properties;
  if (typeof properties === "object" && properties !== null) {
    const entries = Object.entries(properties as Record<string, unknown>);
    out.properties = Object.fromEntries(
      entries.map(([key, value]) => [
        key,
        typeof value === "object" && value !== null
          ? toStrictSchema(value as Record<string, unknown>)
          : value,
      ]),
    );
    out.required = entries.map(([key]) => key);
    out.additionalProperties = false;
  }

  const items = schema.items;
  if (typeof items === "object" && items !== null) {
    out.items = toStrictSchema(items as Record<string, unknown>);
  }
  return out;
}

/**
 * 送る本文を組み立てる。**鍵を引数に取らない。**
 *
 * 指示（`instructions`）と資料（`input`）を別の枠に置くのは 4 社共通。
 * `assemblePrompt` が済ませた分離をここで混ぜ直さない。
 */
export function buildResponsesBody(
  request: LlmRequest,
  modelId: string,
): Readonly<Record<string, unknown>> {
  const { system, user } = assemblePrompt(request);
  return {
    model: modelId,
    instructions: system,
    input: [{ role: "user", content: user }],
    max_output_tokens: request.maxOutputTokens,
    temperature: request.temperature,
    text: {
      format: {
        type: "json_schema",
        name: SCHEMA_NAME,
        strict: true,
        schema: toStrictSchema(request.outputSchema),
      },
    },
  };
}

type OpenAiContent = { readonly type?: string; readonly text?: string };
type OpenAiOutput = { readonly type?: string; readonly content?: readonly OpenAiContent[] };
type OpenAiReply = {
  readonly output?: readonly OpenAiOutput[];
  readonly usage?: { readonly input_tokens?: number; readonly output_tokens?: number };
  readonly status?: string;
  readonly incomplete_details?: { readonly reason?: string };
  readonly model?: string;
};

/** 応答から結果を取り出す。取り出せない形は失敗にする（黙って空を返さない）。 */
export function readResponsesReply<T>(
  reply: unknown,
  fallbackModelId: string,
): Result<LlmResponse<T>, DomainError> {
  if (typeof reply !== "object" || reply === null) return err(unreadableReply("unknown"));
  const r = reply as OpenAiReply;

  /**
   * 途中で切れたかどうかは `status` で分かる。
   * **切れた本文でも読めるなら読む**（使った量の記録が要る）が、
   * `truncated` の印を必ず付けて、そのまま公開されないようにする。
   */
  const truncated =
    r.status === "incomplete" && r.incomplete_details?.reason === "max_output_tokens";

  // 推論の途中経過など、本文以外の要素が並ぶことがある。
  // 種類で選ばずに 1 つ目を読むと、本文でないものを答えとして扱う。
  const text = (r.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("");

  const output = parseJsonText<T>(text, r.status ?? "unknown");
  if (!output.ok) return err(output.error);

  return ok({
    output: output.value,
    modelId: r.model ?? fallbackModelId,
    inputTokens: r.usage?.input_tokens ?? 0,
    outputTokens: r.usage?.output_tokens ?? 0,
    truncated,
  });
}

export const OPENAI_SPEC: ProviderSpec = {
  providerId: PROVIDER_ID,
  label: "OpenAI",
  endpoint: () => ENDPOINT,
  buildBody: buildResponsesBody,
  // 鍵が現れるのはこの 1 行だけ。本文には入らない。
  headers: (apiKey) => ({ authorization: `Bearer ${apiKey}` }),
  readReply: readResponsesReply,
  embedRefusal: "OpenAI での類似記事の検出は、まだ繋いでいません。",
};

export function createOpenAiLlm(deps: HttpLlmDeps): LlmPort {
  return createHttpLlm(OPENAI_SPEC, deps);
}
