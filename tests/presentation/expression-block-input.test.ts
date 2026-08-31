/** @tier 1 @req REQ-BLOG05 @types equivalence, boundary */
import { describe, expect, it } from "vitest";
import {
  INSERTABLE_EXPRESSION_BLOCK_KINDS,
  parseExpressionBlockInput,
} from "@/presentation/admin/publish/expression-block-input";
import { EXPRESSION_BLOCK_KINDS } from "@/domain/authoring/blog-template";

function data(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

describe("記事編集画面の表現ブロック入力 (A5)", () => {
  it("domain正本の10種すべてを編集画面から挿入できる", () => {
    expect(INSERTABLE_EXPRESSION_BLOCK_KINDS).toEqual(EXPRESSION_BLOCK_KINDS);
  });

  it.each([
    ["answer", { content: "先に答えます。" }, { kind: "answer", text: "先に答えます。" }],
    ["key_points", { content: "速い\n軽い" }, { kind: "key_points", items: ["速い", "軽い"] }],
    ["faq", { content: "保証は？ | 1年です。\n返品は？ | 30日です。" }, { kind: "faq", items: [
      { question: "保証は？", answer: "1年です。" },
      { question: "返品は？", answer: "30日です。" },
    ] }],
    ["sources", { content: "公式仕様 | 2026-08-31 | https://example.com/spec\n実測 | 2026-08-30" }, { kind: "sources", items: [
      { label: "公式仕様", checkedAt: "2026-08-31", url: "https://example.com/spec" },
      { label: "実測", checkedAt: "2026-08-30" },
    ] }],
    ["freshness", { content: "2026-08-31", detail: "確認済み" }, { kind: "freshness", asOf: "2026-08-31", note: "確認済み" }],
    ["figure", { content: "内部構造", detail: "製品内部の図" }, { kind: "figure", caption: "内部構造", alt: "製品内部の図" }],
    ["comparison", { content: "用途別に比較" }, { kind: "comparison", caption: "用途別に比較" }],
    ["cta", { content: "公式サイトを見る", detail: "/go/offer-1" }, { kind: "cta", label: "公式サイトを見る", href: "/go/offer-1" }],
    ["summary", { content: "軽さを優先します" }, { kind: "summary", text: "軽さを優先します" }],
    ["spec_table", { content: "重さ: 900g\n幅：20cm" }, { kind: "spec_table", rows: [{ label: "重さ", value: "900g" }, { label: "幅", value: "20cm" }] }],
  ] as const)("%s を構造化した表現ブロックへ変換する", (kind, values, expected) => {
    const result = parseExpressionBlockInput(data({ kind, detail: "", ...values }));
    expect(result).toEqual({ ok: true, value: expected });
  });

  it("CTA の javascript URL と、区切りの無いスペック行を保存前に断る", () => {
    expect(parseExpressionBlockInput(data({ kind: "cta", content: "見る", detail: "javascript:alert(1)" })).ok).toBe(false);
    expect(parseExpressionBlockInput(data({ kind: "spec_table", content: "重さ900g", detail: "" })).ok).toBe(false);
  });

  it("FAQ・出典・鮮度の壊れた構造を保存前に断る", () => {
    expect(parseExpressionBlockInput(data({ kind: "faq", content: "保証は？", detail: "" })).ok).toBe(false);
    expect(parseExpressionBlockInput(data({ kind: "sources", content: "公式仕様 | 昨日", detail: "" })).ok).toBe(false);
    expect(parseExpressionBlockInput(data({ kind: "freshness", content: "08/31", detail: "" })).ok).toBe(false);
  });
});
