import { createToolCatalog } from "@/presentation/composition";
import { describeTools } from "@/presentation/tools/rest-adapter";

export const dynamic = "force-dynamic";

/**
 * 利用できる操作の一覧（REST）。
 *
 * 中身は画面・MCP・WebMCP と同じ 1 つのカタログ。
 * ここで一覧を組み直さないので、入口ごとに内容がずれない。
 */
export async function GET() {
  return Response.json({ tools: describeTools(createToolCatalog()) });
}
