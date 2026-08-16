import type { ActorContext, DomainError } from "@/domain/shared";
import type { AnyToolDefinition } from "./tool-definition";
import { invokeTool } from "./tool-definition";
import { findTool } from "./catalog";
import { statusOf } from "../http/error-response";

/**
 * バックエンド MCP (JSON-RPC) の入口。
 *
 * REST と同じカタログ・同じユースケースを呼ぶ。
 * 違いは「返し方」だけで、判断はここに一切書かない。
 */
export type JsonRpcRequest = {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly method: string;
  readonly params?: Readonly<Record<string, unknown>>;
};

export type McpToolResult = {
  readonly content: readonly { type: "text"; text: string }[];
  readonly isError?: boolean;
};

function textResult(text: string, isError = false): McpToolResult {
  return { content: [{ type: "text", text }], isError };
}

/**
 * エラーを AI が読める形にする。
 *
 * `suggestedAction` を必ず添えるのは、エージェントが次の一手を決められるようにするため。
 * 「失敗しました」だけでは同じ呼び出しを繰り返す。
 */
export function errorToMcpResult(error: DomainError): McpToolResult {
  const lines = [error.message];
  if (error.suggestedAction) lines.push(`次にできること: ${error.suggestedAction}`);
  if (error.retryable) lines.push("しばらく待ってからもう一度試せます。");
  lines.push(`(code: ${error.code}, status: ${statusOf(error)})`);
  return textResult(lines.join("\n"), true);
}

export async function handleJsonRpc(
  catalog: readonly AnyToolDefinition[],
  actor: ActorContext,
  request: JsonRpcRequest,
): Promise<{ jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string } }> {
  if (request.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools: catalog.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: {
            readOnlyHint: t.readOnly,
            // 人の承認が要る操作であることを、エージェントにも伝える
            destructiveHint: t.requiresHumanApproval,
          },
        })),
      },
    };
  }

  if (request.method === "tools/call") {
    const name = typeof request.params?.name === "string" ? request.params.name : "";
    const tool = findTool(catalog, name);
    if (tool === null) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: `そのツールはありません: ${name}` },
      };
    }
    const result = await invokeTool(tool, actor, request.params?.arguments ?? {});
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: result.ok
        ? textResult(JSON.stringify(result.value, null, 2))
        : errorToMcpResult(result.error),
    };
  }

  return {
    jsonrpc: "2.0",
    id: request.id,
    error: { code: -32601, message: `対応していないメソッドです: ${request.method}` },
  };
}
