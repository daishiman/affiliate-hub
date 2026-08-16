import type { z } from "zod";

/** MCP の tools/call が返すコンテンツ形式 */
export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/**
 * Remote MCP (サーバー) と WebMCP (ブラウザ) の両方から参照する共通ツール定義。
 * どちらのトランスポートも name / description / inputSchema / handler しか必要としない。
 */
export type ToolDef<TSchema extends z.ZodType = z.ZodType> = {
  name: string;
  title: string;
  description: string;
  inputSchema: TSchema;
  /** ブラウザ側 (WebMCP) でも実行してよいか。false ならサーバー専用。 */
  exposeToBrowser: boolean;
  handler: (input: z.infer<TSchema>) => Promise<ToolResult>;
};

export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function jsonResult(value: unknown): ToolResult {
  return textResult(JSON.stringify(value, null, 2));
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
