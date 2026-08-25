import type { ActorContext, DomainError } from "@/domain/shared";
import type { AnyToolDefinition } from "./tool-definition";
import { invokeTool } from "./tool-definition";
import { findTool } from "./catalog";
import { MCP_RESOURCES, findResource, parseResourceUri, schemeOf } from "./spec-contract";
import { maskExistence, statusOf } from "../http/error-response";

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
export function errorToMcpResult(input: DomainError): McpToolResult {
  // 存在を隠す潰しは REST と同じものを使う。ここで別に書くと片方だけ漏れる。
  const error = maskExistence(input);
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

  // Resources は「読める場所」であって新しい処理ではない。
  // 中身は必ず既存のツールから取る。ここで別に読み出しを書くと、
  // ツール経由と Resource 経由で違う内容が返る余地ができる。
  if (request.method === "resources/list") {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        resourceTemplates: MCP_RESOURCES.map((r) => ({
          uriTemplate: r.uriTemplate,
          name: schemeOf(r),
          description: r.description,
          mimeType: "application/json",
        })),
        resources: [],
      },
    };
  }

  if (request.method === "resources/read") {
    const uri = typeof request.params?.uri === "string" ? request.params.uri : "";
    const entry = findResource(uri);
    const parsed = parseResourceUri(uri);
    if (entry === null || parsed === null) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32602, message: `その場所は読めません: ${uri}` },
      };
    }
    const tool = findTool(catalog, entry.backedBy);
    if (tool === null) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: `${uri} を読む権限がありません。` },
      };
    }
    const result = await invokeTool(tool, actor, { [entry.paramName]: parsed.value });
    if (!result.ok) {
      const asText = errorToMcpResult(result.error);
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32603, message: asText.content.map((c) => c.text).join("\n") },
      };
    }
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        contents: [
          { uri, mimeType: "application/json", text: JSON.stringify(result.value, null, 2) },
        ],
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
