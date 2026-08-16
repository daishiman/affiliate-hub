import { z } from "zod";

import { authenticate, type AuthScope } from "@/lib/mcp/auth";
import { findTool, TOOLS } from "@/lib/mcp/tools";
import { errorResult } from "@/lib/mcp/types";

export const dynamic = "force-dynamic";

/** サーバーが実装している MCP プロトコル版 */
const PROTOCOL_VERSION = "2025-06-18";

type JsonRpcId = string | number | null;

function result(id: JsonRpcId, value: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result: value });
}

function rpcError(id: JsonRpcId, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

/** そのスコープでツールを実行してよいか */
function isAllowed(exposeToBrowser: boolean, scope: AuthScope): boolean {
  return scope === "bearer" || exposeToBrowser;
}

/** そのスコープに見せるツール一覧 */
function visibleTools(scope: AuthScope) {
  return TOOLS.filter((tool) => isAllowed(tool.exposeToBrowser, scope));
}

const requestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Streamable HTTP (stateless) な MCP エンドポイント。
 *
 * セッションを持たないので Mcp-Session-Id は発行せず、1リクエスト1レスポンスで完結する。
 * Durable Objects なしで動くぶん、サーバー起点の通知やサンプリングは扱えない。
 */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status,
      headers: {
        "content-type": "application/json",
        // MCP クライアントに認証方式を伝える
        ...(auth.status === 401 ? { "www-authenticate": 'Bearer realm="affiliate-hub"' } : {}),
      },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return rpcError(null, -32600, "Invalid Request");
  }

  const { id = null, method, params = {} } = parsed.data;

  // 通知 (id なし) は本文を返さない
  const isNotification = parsed.data.id === undefined;

  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "affiliate-hub", version: "0.1.0" },
      });

    case "notifications/initialized":
      return new Response(null, { status: 202 });

    case "ping":
      return result(id, {});

    case "tools/list":
      return result(id, {
        tools: visibleTools(auth.scope).map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          // io:"input" にしないと .default() 付きの引数が required 扱いになり、
          // クライアント(AI)が省略可能な引数を必須だと誤解する
          inputSchema: z.toJSONSchema(tool.inputSchema, { io: "input" }),
        })),
      });

    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string") {
        return rpcError(id, -32602, "params.name is required");
      }
      const tool = findTool(name);
      if (!tool) {
        return rpcError(id, -32602, `Unknown tool: ${name}`);
      }
      // ブラウザ経由(same-origin)では書き込み系を実行させない。
      // WebMCP 側で公開していなくても、口が開いていれば直接叩けてしまうため
      // サーバー側でも同じ判定をする。
      if (!isAllowed(tool.exposeToBrowser, auth.scope)) {
        return rpcError(id, -32602, `このツールには Bearer 認証が必要です: ${name}`);
      }
      const args = tool.inputSchema.safeParse(params.arguments ?? {});
      if (!args.success) {
        return result(id, errorResult(`引数が不正です: ${args.error.message}`));
      }
      try {
        return result(id, await tool.handler(args.data));
      } catch (cause) {
        // ツール実行時のエラーは JSON-RPC エラーではなく isError で返す
        // (MCP 仕様: モデルがエラー内容を読んで回復できるようにするため)
        const message = cause instanceof Error ? cause.message : String(cause);
        return result(id, errorResult(`ツール実行に失敗しました: ${message}`));
      }
    }

    default:
      if (isNotification) return new Response(null, { status: 202 });
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

/** 疎通確認用。GET での SSE ストリームは stateless 構成では提供しない。 */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status });
  }
  return Response.json({
    name: "affiliate-hub",
    protocolVersion: PROTOCOL_VERSION,
    transport: "streamable-http (stateless)",
    scope: auth.scope,
    tools: visibleTools(auth.scope).map((t) => t.name),
  });
}
