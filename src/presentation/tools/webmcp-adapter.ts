/**
 * WebMCP (ページ内 AI) の入口。
 *
 * 正規の登録先は `document.modelContext` (ブログ層 §14.1)。
 *
 * 3 つの原則:
 *   1. ブラウザ側に業務処理を持たせない。呼び出しはサーバーの同じ入口へ送る。
 *   2. 載せるのは `webmcp-policy.ts` の表に名前を書いたものだけ。
 *      **書いていないものは載らない**（既定は「載せない」）。
 *      「状態を変えないこと」は道具定義の旗ではなく
 *      `tests/presentation/readonly-honesty.test.ts` が実行で測る。
 *   3. すべての WebMCP ツールには、同じことができる通常の画面操作がある。
 *      AI からしかできない機能を作らない。
 */
import type { AnyToolDefinition } from "./tool-definition";
import { MAX_TOOLS_PER_PAGE, isListedOnWebMcp } from "./webmcp-policy";

/**
 * 1 ページに載せてよいツールの上限。
 *
 * 正本は `webmcp-policy.ts`（載せる表と同じ場所）。ここは取り出し口として残す。
 */
export { MAX_TOOLS_PER_PAGE };

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

/**
 * カタログを宣言に直す。**表に名前があるものだけを、上限の数まで。**
 *
 * 絞る根拠は道具定義の `readOnly` ではなく、`webmcp-policy.ts` の `PAGE_TOOLS` である。
 * 旗を根拠にすると既定が「載る」になり、読み取りの道具を足しただけで
 * ページ内の AI の手が届く範囲が黙って広がる。表を根拠にすると既定は「載らない」。
 *
 * `listed` を差し替えられるのは、検査が**別の表**を回せるようにするため。
 * 既定は必ず正本の表で、**差し替えないと何も載らない**側に倒してある。
 */
export function toWebMcpDescriptors(
  catalog: readonly AnyToolDefinition[],
  options: { readonly limit?: number; readonly listed?: (name: string) => boolean } = {},
): readonly WebMcpDescriptor[] {
  const { limit = MAX_TOOLS_PER_PAGE, listed = isListedOnWebMcp } = options;
  return catalog
    .filter((t) => listed(t.name))
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
 * 登録先を選ぶ。
 *
 * 正規の経路は `document.modelContext`（ブログ層 §14.1・CHG-001）。
 * `navigator.modelContext` は Chrome 150 で非推奨になった旧経路で、
 * **両方あるときは必ず新しい方を使う**。逆にすると、新しいブラウザでも
 * 古い経路に載り続け、非推奨が外れた日に黙って止まる。
 *
 * どちらも無ければ `undefined` を返す。ここで例外を投げないことが、
 * 「対応していないブラウザでは通常の画面操作がそのまま使える」の実体である。
 *
 * React の部品ではなくここに置いてあるのは、画面を描かずに確かめられるようにするため。
 */
export function resolveModelContext(
  doc: { modelContext?: ModelContextLike } | undefined = typeof document !== "undefined"
    ? document
    : undefined,
  nav: { modelContext?: ModelContextLike } | undefined = typeof navigator !== "undefined"
    ? navigator
    : undefined,
): ModelContextLike | undefined {
  if (doc?.modelContext) return doc.modelContext;
  if (nav?.modelContext) return nav.modelContext;
  return undefined;
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
