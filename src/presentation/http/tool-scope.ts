import type { AnyToolDefinition } from "../tools/tool-definition";

/**
 * 「その呼び出し元に、この操作を実行させてよいか」の判定。
 *
 * **入口ごとに書かない。** REST も MCP も WebMCP もこの 1 つの関数を使う。
 * 片方の入口にだけ緩い判定が残る、という壊れ方を型と場所で防ぐ。
 *
 * 決まりは 2 つだけ。
 *   1. 自サイトの画面から（＝ログインしていない可能性がある）呼べるのは読み取りだけ。
 *   2. 人の承認が要る操作は、トークンを持っていても入口からは実行させない。
 *      承認は画面で人が行う（`HUMAN_ONLY_CAPABILITIES` と同じ考え方）。
 */
export type CallerScope = "bearer" | "same-origin";

export function isToolAllowedForScope(tool: AnyToolDefinition, scope: CallerScope): boolean {
  if (tool.requiresHumanApproval) return false;
  return tool.readOnly || scope === "bearer";
}

/** その呼び出し元に見せてよいツールだけを残す。一覧と実行で同じ判定を使う。 */
export function visibleTools(
  catalog: readonly AnyToolDefinition[],
  scope: CallerScope,
): readonly AnyToolDefinition[] {
  return catalog.filter((tool) => isToolAllowedForScope(tool, scope));
}

/** 断るときの理由。無言で 403 を返さない。 */
export function refusalReason(tool: AnyToolDefinition): string {
  return tool.requiresHumanApproval
    ? "この操作は人が画面で確認してから実行します。AI や外部からは実行できません。"
    : "この操作にはトークンによる認証が必要です。";
}
