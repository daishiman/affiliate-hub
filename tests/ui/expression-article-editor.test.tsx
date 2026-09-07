/** @tier 2 @req REQ-BOPS04 @types screen-states, boundary */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expressionBlockOfArticleBody, toExpressionArticleBlock } from "@/application/adapters/expression-article-block";
import type { ExpressionBlock } from "@/domain/authoring/blog-template";
import { ExpressionArticleEditor } from "@/presentation/admin/publish/expression-article-editor";

afterEach(cleanup);
function Harness({ block }: { block: ExpressionBlock }) {
  const [body, setBody] = useState(toExpressionArticleBlock(block, "id", 0).body);
  return <ExpressionArticleEditor name="body" value={body} onValueChange={setBody} />;
}
function saved() { return expressionBlockOfArticleBody(document.querySelector<HTMLInputElement>('input[name="body"]')!.value); }

const cases: readonly { block: ExpressionBlock; field: string; read: (block: ExpressionBlock | null) => unknown }[] = [
  { block: { kind: "answer", text: "結論" }, field: "先に示す結論", read: (b) => b?.kind === "answer" && b.text },
  { block: { kind: "summary", text: "まとめ" }, field: "まとめ", read: (b) => b?.kind === "summary" && b.text },
  { block: { kind: "key_points", items: ["要点"] }, field: "要点 1", read: (b) => b?.kind === "key_points" && b.items[0] },
  { block: { kind: "faq", items: [{ question: "質問", answer: "回答" }] }, field: "質問 1", read: (b) => b?.kind === "faq" && b.items[0]?.question },
  { block: { kind: "sources", items: [{ label: "公式", checkedAt: "2026-09-01", url: "https://example.com" }] }, field: "出典名 1", read: (b) => b?.kind === "sources" && b.items[0]?.label },
  { block: { kind: "freshness", asOf: "2026-09-01", note: "確認" }, field: "確認メモ", read: (b) => b?.kind === "freshness" && b.note },
  { block: { kind: "figure", caption: "図解", alt: "説明" }, field: "図解の説明", read: (b) => b?.kind === "figure" && b.caption },
  { block: { kind: "comparison", caption: "比較" }, field: "比較の説明", read: (b) => b?.kind === "comparison" && b.caption },
  { block: { kind: "cta", label: "リンク", href: "/s/blog" }, field: "リンクの表示文", read: (b) => b?.kind === "cta" && b.label },
  { block: { kind: "spec_table", rows: [{ label: "重さ", value: "900g" }] }, field: "項目名 1", read: (b) => b?.kind === "spec_table" && b.rows[0]?.label },
];

describe("保存済み表現ブロックの直接編集", () => {
  for (const entry of cases) {
    it(`${entry.block.kind} の型とスロットを保持して専用欄で編集する`, () => {
      const block = { ...entry.block, slot: { name: "slot", fallback: "予備" } } as ExpressionBlock;
      render(<Harness block={block} />);
      fireEvent.change(screen.getByRole("textbox", { name: new RegExp(`^${entry.field}`) }), { target: { value: "書き直した内容 | :" } });
      expect(entry.read(saved())).toBe("書き直した内容 | :");
      expect(saved()?.slot).toEqual(block.slot);
      expect(document.body.textContent).not.toContain("expression-block:v1:");
    });
  }

  it("FAQを追加して質問・回答を別々に編集し、削除を元に戻せる", () => {
    render(<Harness block={{ kind: "faq", items: [] }} />);
    fireEvent.click(screen.getByRole("button", { name: "質問を追加" }));
    fireEvent.change(screen.getByLabelText("質問 1"), { target: { value: "質問内の | 記号" } });
    fireEvent.change(screen.getByLabelText("回答 1"), { target: { value: "複数行\nの回答" } });
    fireEvent.click(screen.getByRole("button", { name: "質問 1 を削除" }));
    fireEvent.click(screen.getByRole("button", { name: "表現の変更を元に戻す" }));
    expect(saved()).toEqual({ kind: "faq", items: [{ question: "質問内の | 記号", answer: "複数行\nの回答" }] });
  });

  it("壊れたcarrierを原値のまま保持して編集欄に露出しない", () => {
    const onChange = vi.fn();
    const body = "expression-block:v1:{broken";
    render(<ExpressionArticleEditor name="body" value={body} onValueChange={onChange} />);
    expect(document.querySelector<HTMLInputElement>('input[name="body"]')?.value).toBe(body);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(/読み取れません/)).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
