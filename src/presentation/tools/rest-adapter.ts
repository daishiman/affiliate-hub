import type { ActorContext } from "@/domain/shared";
import { domainError } from "@/domain/shared";
import { errorResponse, okResponse } from "../http/error-response";
import type { AnyToolDefinition } from "./tool-definition";
import { invokeTool } from "./tool-definition";
import { findTool } from "./catalog";

/**
 * REST の入口。
 *
 * カタログのツールを HTTP に写すだけ。ここに業務の処理を書かない。
 * WebMCP・MCP と同じユースケースを呼ぶので、結果は必ず一致する。
 */
export async function handleToolRequest(
  catalog: readonly AnyToolDefinition[],
  actor: ActorContext,
  toolName: string,
  body: unknown,
): Promise<Response> {
  const tool = findTool(catalog, toolName);
  if (tool === null) {
    return errorResponse(
      domainError("NOT_FOUND", "その機能は見つかりません。", {
        suggestedAction: "利用できる機能の一覧を取得してください。",
      }),
    );
  }

  const result = await invokeTool(tool, actor, body);
  return result.ok ? okResponse(result.value) : errorResponse(result.error);
}

/** 利用できる機能の一覧。REST・WebMCP・MCP で同じ内容を配る。 */
export function describeTools(catalog: readonly AnyToolDefinition[]): readonly {
  name: string;
  description: string;
  inputSchema: Readonly<Record<string, unknown>>;
  readOnly: boolean;
  requiresHumanApproval: boolean;
}[] {
  return catalog.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    readOnly: t.readOnly,
    requiresHumanApproval: t.requiresHumanApproval,
  }));
}
