/**
 * WebMCP (ページ内 AI) の入口。
 *
 * 正規の登録先は `document.modelContext` (ブログ層 §14.1)。
 *
 * 3 つの原則:
 *   1. ブラウザ側に業務処理を持たせない。呼び出しはサーバーの同じ入口へ送る。
 *   2. 載せるのは読み取り専用のツールだけ。ページ内の AI に状態を変えさせない。
 *   3. すべての WebMCP ツールには、同じことができる通常の画面操作がある。
 *      AI からしかできない機能を作らない。
 */
import type { AnyToolDefinition } from "./tool-definition";

export type WebMcpToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: unknown;
  execute: (args: Record<string, unknown>) => Promise<WebMcpToolResult>;
};

export type ModelContextLike = {
  registerTool?: (tool: WebMcpTool) => (() => void) | void;
  provideContext?: (context: { tools: WebMcpTool[] }) => void;
};

/**
 * サーバーの MCP 入口を呼ぶ。
 *
 * 認可も集計もサーバー 1 箇所に集約するため、ブラウザでは実処理を持たない。
 */
async function callServer(endpoint: string, name: string, args: Record<string, unknown>): Promise<WebMcpToolResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });

  if (!response.ok) {
    return {
      content: [{ type: "text", text: `サーバーがエラーを返しました (${response.status})` }],
      isError: true,
    };
  }

  const payload = (await response.json()) as {
    result?: WebMcpToolResult;
    error?: { message: string };
  };
  if (payload.error) return { content: [{ type: "text", text: payload.error.message }], isError: true };
  return payload.result ?? { content: [{ type: "text", text: "空の応答でした" }], isError: true };
}

/** カタログを WebMCP のツール宣言に直す。読み取り専用のものだけを通す。 */
export function toWebMcpTools(
  catalog: readonly AnyToolDefinition[],
  endpoint = "/api/mcp",
): WebMcpTool[] {
  return catalog
    .filter((t) => t.readOnly)
    .map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      execute: (args: Record<string, unknown>) => callServer(endpoint, t.name, args),
    }));
}

/**
 * ブラウザへ登録する。
 *
 * 実装差があるため `registerTool` と `provideContext` の両方に備える。
 * `navigator.modelContext` は Chrome 150 で非推奨になった旧経路であり、新規には使わない。
 */
export function registerWebMcpTools(
  modelContext: ModelContextLike | undefined,
  tools: WebMcpTool[],
): () => void {
  if (modelContext === undefined) return () => {};

  if (typeof modelContext.provideContext === "function") {
    modelContext.provideContext({ tools });
    return () => modelContext.provideContext?.({ tools: [] });
  }

  if (typeof modelContext.registerTool === "function") {
    const unregisters = tools.map((t) => modelContext.registerTool?.(t));
    return () => {
      for (const u of unregisters) if (typeof u === "function") u();
    };
  }

  return () => {};
}
