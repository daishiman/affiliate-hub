import { authenticateRequest, createToolCatalog } from "@/presentation/composition";
import { visibleTools } from "@/presentation/http/tool-scope";
import { describeTools } from "@/presentation/tools/rest-adapter";

export const dynamic = "force-dynamic";

/**
 * 利用できる操作の一覧（REST）。
 *
 * 中身は画面・MCP・WebMCP と同じ 1 つのカタログ。
 * ここで一覧を組み直さないので、入口ごとに内容がずれない。
 *
 * 見せる範囲は実行できる範囲と同じにする。
 * 一覧にだけ出て呼ぶと断られる、という食い違いを作らない。
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status });
  }
  return Response.json({ tools: describeTools(visibleTools(createToolCatalog(), auth.scope)) });
}
