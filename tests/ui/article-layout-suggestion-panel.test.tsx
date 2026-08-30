/** @vitest-environment jsdom */
/** @tier 1 @req REQ-IM09, REQ-BOPS05 @types state-transition, screen-states */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { REQUIRED_BLOCKS } from "@/domain/blogops";
import { ArticleLayoutSuggestionPanel } from "@/presentation/admin/publish/article-layout-suggestion-panel";

// A/B 実験ループ（`/admin/improvement` の「改善の状況」）とは別物の、記事 1 本の版面規則の照合。
describe("記事の版面チェック", () => {
  it("欠けた部品の差分を確認し、1件だけ適用して直後に元へ戻せる", () => {
    const onRowsChange = vi.fn();
    const missingKind = REQUIRED_BLOCKS.T1[0]!;
    render(
      <ArticleLayoutSuggestionPanel template="T1" rows={[]} onRowsChange={onRowsChange} />,
    );

    expect(screen.getAllByText("優先度 高").length).toBeGreaterThan(0);
    expect(screen.getAllByText("差分を確認")[0]).toBeDefined();
    fireEvent.click(screen.getAllByRole("button", { name: "この1件を適用" })[0]!);

    expect(onRowsChange).toHaveBeenLastCalledWith([
      { id: "", kind: missingKind, heading: "", body: "" },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(onRowsChange).toHaveBeenLastCalledWith([]);
  });
});
