/** @tier 2 @req REQ-P05, REQ-SEC09 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CreateRankingModelForm } from "@/presentation/admin/material/ranking-model-form";

const CRITERIA = [
  { key: "measured_performance", label: "実際に測った性能" },
  { key: "usability", label: "使いやすさ" },
];

describe("評価基準を登録する欄", () => {
  it("順位を変える理由を操作の記録へ残す欄がある", () => {
    const html = renderToStaticMarkup(
      <CreateRankingModelForm criteria={CRITERIA} knownCategories={["cat_laptop"]} />,
    );

    expect(html).toContain('name="reason"');
    expect(html).toContain("操作の記録");
  });
});
