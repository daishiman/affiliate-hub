/** @tier 1 @req REQ-BOPS04, REQ-BOPS05 @types state-transition, a11y */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleSaveStatus } from "@/presentation/admin/publish/article-save-status";
import type { BlogOpsState } from "@/presentation/admin/publish/blog-ops-state";

function html(state: BlogOpsState, pending = false, dirty = false): string {
  return renderToStaticMarkup(
    <ArticleSaveStatus state={state} pending={pending} dirty={dirty} />,
  );
}

describe("記事編集の保存5状態", () => {
  it.each([
    [{ status: "idle", message: "" } as const, false, true, "未保存"],
    [{ status: "idle", message: "" } as const, true, true, "保存中"],
    [
      {
        status: "done",
        message: "保存しました。",
        savedAt: "2026-08-30T03:04:05.000Z",
      } as const,
      false,
      false,
      "保存済み",
    ],
    [{ status: "failed", message: "保存先へ接続できません。" } as const, false, true, "保存失敗"],
    [
      {
        status: "failed",
        message: "ほかの人が先に保存しました。",
        errorCode: "CONFLICT",
      } as const,
      false,
      true,
      "保存競合",
    ],
  ])("色だけに頼らず文字とアイコンで %s を示す", (state, pending, dirty, label) => {
    const output = html(state, pending, dirty);
    expect(output).toContain(label);
    expect(output).toContain("aria-live=\"polite\"");
    expect(output).toContain("data-save-status-icon");
  });
});
