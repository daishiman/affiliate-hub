import { allowedOriginsFrom, checkOrigin, originRejection } from "@/presentation/http/origin-guard";
import {
  actorForScope,
  authenticateRequest,
  createToolCatalog,
} from "@/presentation/composition";
import { handleJsonRpc, type JsonRpcRequest } from "@/presentation/tools/mcp-adapter";
import { refusalReason, visibleTools } from "@/presentation/http/tool-scope";
import { findTool } from "@/presentation/tools/catalog";

export const dynamic = "force-dynamic";

/** このサーバーが実装している MCP の版 */
const PROTOCOL_VERSION = "2025-06-18";

/**
 * バックエンド MCP の入口（JSON-RPC / Streamable HTTP・stateless）。
 *
 * **ここに業務の処理は 1 行も書かない。** 呼ぶのは画面・REST・WebMCP と
 * まったく同じ 1 つのツールカタログで、違うのは「返し方」だけ。
 * 入口ごとにツール一覧を組み直すと、片方にだけ古い定義が残る。
 *
 * セッションを持たないので `Mcp-Session-Id` は発行せず、1 リクエスト 1 レスポンスで終わる。
 * そのぶんサーバー起点の通知やサンプリングは扱えない。
 */
type JsonRpcId = string | number | null;

function rpcError(id: JsonRpcId, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function POST(request: Request) {
  // よそのサイトのページから、こちらのログイン状態を使って呼ばれるのを止める。
  const origin = checkOrigin(request, allowedOriginsFrom(process.env as Record<string, string | undefined>));
  if (!origin.ok) return originRejection(origin);

  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status,
      headers: {
        "content-type": "application/json",
        ...(auth.status === 401 ? { "www-authenticate": 'Bearer realm="affiliate-hub"' } : {}),
      },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "本文を読み取れませんでした。");
  }

  if (typeof body !== "object" || body === null) {
    return rpcError(null, -32600, "JSON-RPC の形式ではありません。");
  }
  const message = body as Record<string, unknown>;
  const id: JsonRpcId =
    typeof message.id === "string" || typeof message.id === "number" ? message.id : null;
  const method = typeof message.method === "string" ? message.method : "";
  const isNotification = message.id === undefined;

  // 握手と疎通は JSON-RPC の作法そのものなので、この入口が受け持つ。
  if (method === "initialize") {
    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false, subscribe: false },
        },
        serverInfo: { name: "affiliate-hub", version: "0.1.0" },
      },
    });
  }
  if (method === "notifications/initialized") return new Response(null, { status: 202 });
  if (method === "ping") return Response.json({ jsonrpc: "2.0", id, result: {} });

  const catalog = visibleTools((await createToolCatalog()), auth.scope);

  // 見せていないツールを名指しで呼ばれたら、黙って落とさず理由を返す。
  if (method === "tools/call") {
    const params = (message.params ?? {}) as Record<string, unknown>;
    const name = typeof params.name === "string" ? params.name : "";
    const hidden = findTool((await createToolCatalog()), name);
    if (hidden !== null && findTool(catalog, name) === null) {
      return rpcError(id, -32600, refusalReason(hidden));
    }
  }

  const handled = ["tools/list", "tools/call", "resources/list", "resources/read"];
  if (!handled.includes(method)) {
    if (isNotification) return new Response(null, { status: 202 });
    return rpcError(id, -32601, `対応していないメソッドです: ${method}`);
  }

  // REST の入口（`/api/tools`）とまったく同じ決め方を使う。
  // 片方だけ見本の身元へ落ちる、という状態を作らない（`ah-2ro`）。
  const actor = await actorForScope(auth.scope, request);
  const rpc: JsonRpcRequest = {
    jsonrpc: "2.0",
    id,
    method,
    params: (message.params ?? {}) as Record<string, unknown>,
  };
  return Response.json(await handleJsonRpc(catalog, actor, rpc));
}

/** 疎通確認用。stateless 構成なので GET での SSE ストリームは提供しない。 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status });
  }
  return Response.json({
    name: "affiliate-hub",
    protocolVersion: PROTOCOL_VERSION,
    transport: "streamable-http (stateless)",
    scope: auth.scope,
    tools: visibleTools((await createToolCatalog()), auth.scope).map((t) => t.name),
  });
}
