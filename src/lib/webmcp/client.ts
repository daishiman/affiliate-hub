import { z } from "zod";

import { BROWSER_TOOL_SPECS } from "@/lib/mcp/specs";

import type { ModelContext, WebMcpTool, WebMcpToolResult } from "./types";

/**
 * ブラウザから /api/mcp を JSON-RPC で叩く。
 *
 * ブラウザ側にツールの実処理は持たせない。Remote MCP と同じエンドポイントを
 * 経由させることで、認可も集計ロジックもサーバー1か所に集約できる。
 */
async function callRemoteTool(
  name: string,
  args: Record<string, unknown>,
): Promise<WebMcpToolResult> {
  const response = await fetch("/api/mcp", {
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
      content: [{ type: "text", text: `MCP エンドポイントがエラーを返しました (${response.status})` }],
      isError: true,
    };
  }

  const payload = (await response.json()) as {
    result?: WebMcpToolResult;
    error?: { message: string };
  };

  if (payload.error) {
    return { content: [{ type: "text", text: payload.error.message }], isError: true };
  }
  return payload.result ?? { content: [{ type: "text", text: "空のレスポンス" }], isError: true };
}

function toWebMcpTools(): WebMcpTool[] {
  return BROWSER_TOOL_SPECS.map((spec) => ({
    name: spec.name,
    description: spec.description,
    // Remote MCP 側と同じく input スキーマとして出力する (specs.ts の .default() 対応)
    inputSchema: z.toJSONSchema(spec.inputSchema, { io: "input" }),
    execute: (args) => callRemoteTool(spec.name, args),
  }));
}

/**
 * WebMCP の登録先を解決する。
 *
 * ブログ層仕様 §14.1 の正規経路は `document.modelContext`。
 * `navigator.modelContext` は Chrome 150 で非推奨になったため、
 * 旧ブラウザだけを救う legacy fallback として後ろに置く。
 */
function resolveModelContext(): ModelContext | undefined {
  if (typeof document !== "undefined" && document.modelContext) {
    return document.modelContext;
  }
  if (typeof navigator !== "undefined" && navigator.modelContext) {
    return navigator.modelContext;
  }
  return undefined;
}

/**
 * ページを開いている AI エージェントにツールを公開する。
 * 未対応ブラウザでは何もせず、クリーンアップ関数を返す (通常 UI へフォールバック)。
 */
export function registerWebMcpTools(): () => void {
  const modelContext = resolveModelContext();
  if (!modelContext) return () => {};

  const tools = toWebMcpTools();

  // provideContext があれば一括宣言 (推奨形)。無ければ 1件ずつ登録する。
  if (typeof modelContext.provideContext === "function") {
    modelContext.provideContext({ tools });
    return () => modelContext.provideContext?.({ tools: [] });
  }

  if (typeof modelContext.registerTool === "function") {
    const disposers = tools
      .map((tool) => modelContext.registerTool?.(tool))
      .filter((d): d is () => void => typeof d === "function");
    return () => disposers.forEach((dispose) => dispose());
  }

  return () => {};
}
