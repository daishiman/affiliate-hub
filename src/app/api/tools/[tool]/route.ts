import { domainError } from "@/domain/shared";
import { createToolCatalog, currentActor } from "@/presentation/composition";
import { errorResponse } from "@/presentation/http/error-response";
import { findTool } from "@/presentation/tools/catalog";
import { handleToolRequest } from "@/presentation/tools/rest-adapter";

export const dynamic = "force-dynamic";

/**
 * 操作を 1 つ実行する（REST）。
 *
 * ここに業務の処理は 1 行も書かない。カタログのユースケースを呼ぶだけ。
 *
 * ★ 認証が入るまでの安全側の制限:
 *   読み取り専用の操作しか受け付けない。
 *   ログインの仕組みが無い状態で書き込みを開けると、誰でも実行できてしまう。
 *   Better Auth を入れたらこの判定を外し、権限で決める。
 */
export async function POST(request: Request, ctx: { params: Promise<{ tool: string }> }) {
  const { tool: toolName } = await ctx.params;
  const catalog = createToolCatalog();

  const tool = findTool(catalog, toolName);
  if (tool !== null && !tool.readOnly) {
    return errorResponse(
      domainError("FORBIDDEN", "この操作はまだ外部から実行できません。", {
        suggestedAction: "ログインの仕組みが入るまでお待ちください。",
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

  const actor = await currentActor();
  return handleToolRequest(catalog, actor, toolName, body);
}
