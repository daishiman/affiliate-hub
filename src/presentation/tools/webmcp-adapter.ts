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

/**
 * 1 ページに載せてよいツールの上限。
 *
 * 多いほど良いものではない。選択肢が増えるほどエージェントは誤った道具を選ぶ。
 * 読み取り専用から始めて少数に絞る、が仕様（ブログ層 §14.4）の指示。
 */
export const MAX_TOOLS_PER_PAGE = 6;

/**
 * ブラウザへ渡せる形のツール宣言。
 *
 * 実行の関数は含まない。サーバーからブラウザへ関数は渡せないため、
 * 「何ができるか」だけを送り、呼び出し方はブラウザ側で組み立てる。
 */
export type WebMcpDescriptor = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
};

/** カタログを宣言に直す。読み取り専用だけを、上限の数まで。 */
export function toWebMcpDescriptors(
  catalog: readonly AnyToolDefinition[],
  limit = MAX_TOOLS_PER_PAGE,
): readonly WebMcpDescriptor[] {
  return catalog
    .filter((t) => t.readOnly)
    .slice(0, limit)
    .map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
}

/** 宣言に「サーバーを呼ぶ」処理を付けて、登録できる形にする（ブラウザ側）。 */
export function webMcpToolsFrom(
  descriptors: readonly WebMcpDescriptor[],
  endpoint = "/api/mcp",
): WebMcpTool[] {
  return descriptors.map((d) => ({
    name: d.name,
    description: d.description,
    inputSchema: d.inputSchema,
    execute: (args: Record<string, unknown>) => callServer(endpoint, d.name, args),
  }));
}

/** カタログから直接ツールを作る（サーバー内で完結する経路・テスト用）。 */
export function toWebMcpTools(
  catalog: readonly AnyToolDefinition[],
  endpoint = "/api/mcp",
): WebMcpTool[] {
  return webMcpToolsFrom(toWebMcpDescriptors(catalog), endpoint);
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
