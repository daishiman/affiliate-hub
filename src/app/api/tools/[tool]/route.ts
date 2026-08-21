import { allowedOriginsFrom, checkOrigin, originRejection } from "@/presentation/http/origin-guard";
import { domainError } from "@/domain/shared";
import { actorForScope, authenticateRequest, createToolCatalog } from "@/presentation/composition";
import { errorResponse } from "@/presentation/http/error-response";
import { isToolAllowedForScope, refusalReason } from "@/presentation/http/tool-scope";
import { findTool } from "@/presentation/tools/catalog";
import { handleToolRequest } from "@/presentation/tools/rest-adapter";

export const dynamic = "force-dynamic";

/**
 * 操作を 1 つ実行する（REST）。
 *
 * ここに業務の処理は 1 行も書かない。カタログのユースケースを呼ぶだけ。
 *
 * 「誰に何を許すか」は `isToolAllowedForScope` の 1 箇所で決める。
 * MCP の入口（`/api/mcp`）もまったく同じ関数を使うので、
 * 片方の入口だけ緩い、という状態が作れない。
 */
export async function POST(request: Request, ctx: { params: Promise<{ tool: string }> }) {
  // よそのサイトのページから、こちらのログイン状態を使って呼ばれるのを止める。
  const origin = checkOrigin(request, allowedOriginsFrom(process.env as Record<string, string | undefined>));
  if (!origin.ok) return originRejection(origin);

  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status });
  }

  const { tool: toolName } = await ctx.params;
  const catalog = (await createToolCatalog());

  const tool = findTool(catalog, toolName);
  if (tool !== null && !isToolAllowedForScope(tool, auth.scope)) {
    return errorResponse(
      domainError("FORBIDDEN", refusalReason(tool), {
        suggestedAction: tool.requiresHumanApproval
          ? "管理画面の該当ページから、担当者が確認して実行してください。"
          : "トークンを添えて呼び出してください。",
      }),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      domainError("VALIDATION_FAILED", "送信された内容を読み取れませんでした。", {
        suggestedAction: "JSON 形式で送ってください。",
      }),
    );
  }

  // 身元は「入口をどう通ったか」から決める。ここで `currentActor()` を呼ぶと、
  // ログインしていない人が見本の権限で管理用の読み取りを通せる（`ah-2ro`）。
  const actor = await actorForScope(auth.scope);
  return handleToolRequest(catalog, actor, toolName, body);
}
