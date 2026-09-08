/** @tier 2 @req REQ-S09 */
import { describe, expect, it } from "vitest";
import { cloneWritingMethodForSite } from "@/application/usecases/authoring/clone-writing-method-for-site";
import type { WritingMethod } from "@/application/usecases/authoring/read-writing-method";
import { PATTERN_WRITING_EMPHASIS } from "@/domain/authoring/pattern-writing-emphasis";
import { SITE_PATTERNS } from "@/domain/authoring/site-blueprint";

/**
 * 雛形からブログ 1 本分の書き方を作る (受入 A7)。
 *
 * ここで確かめたいのは「複製していないこと」である。
 * 決めごとを丸ごと複製すると、雛形を直したときに古いブログが残り、
 * どちらが本物か決められなくなる。
 *
 * 規範: docs/spec/feat-site-scoped-authoring-ia/site-scoped-route-contract.md
 */

const BASE: WritingMethod = {
  articleType: "review",
  articleTypeLabel: "レビュー",
  types: [{ key: "review", label: "レビュー" }],
  sections: [
    { id: "methodology", label: "評価方法", required: true, purpose: "どう調べたかを示す" },
    { id: "body", label: "根拠付き本文", required: true, purpose: "中身" },
    { id: "toc", label: "目次", required: false, purpose: "全体を見渡す" },
  ],
  requiredCount: 2,
  opening: "結論から書く",
  paragraphOrder: [{ step: "結論", description: "先に言う" }],
  styleRules: [{ id: "r1", rule: "二重敬語を使わない", why: "読みにくい" }],
  factRules: [{ kind: "measured", label: "実測", allowed: ["でした"], forbidden: ["らしい"] }],
  knowledgeGuide: [
    {
      level: "beginner",
      levelLabel: "はじめての人",
      jargon: "言い換える",
      numbers: "少なく",
      structure: "順に",
    },
  ],
  conversation: {
    minLength: 20,
    maxLength: 80,
    maxConsecutive: 2,
    basePattern: ["問い", "答え"],
    rule: "会話だけに根拠を置かない",
  },
} as unknown as WritingMethod;

describe("cloneWritingMethodForSite", () => {
  it("節・文体の決まり・記事の型を書き換えない", () => {
    /*
      **これが本体の検査である。** 変わってよいのは重みだけで、
      決めごと自体はブログをまたいで 1 つのままでなければならない。
    */
    for (const pattern of SITE_PATTERNS) {
      const cloned = cloneWritingMethodForSite(BASE, pattern);
      expect(cloned.sections.map((s) => s.id), pattern).toEqual(BASE.sections.map((s) => s.id));
      expect(cloned.styleRules, pattern).toEqual(BASE.styleRules);
      expect(cloned.requiredCount, pattern).toBe(BASE.requiredCount);
      expect(cloned.articleType, pattern).toBe(BASE.articleType);
    }
  });

  it("欠かせない節を、どの型でも減らさない", () => {
    // 型ごとに緩められると「この型では書かなくてよい」を設定で作れてしまう。
    for (const pattern of SITE_PATTERNS) {
      const cloned = cloneWritingMethodForSite(BASE, pattern);
      expect(cloned.sections.filter((s) => s.required).length, pattern).toBe(2);
    }
  });

  it("その型で強く見る節にだけ印が付く", () => {
    const cloned = cloneWritingMethodForSite(BASE, "specialist_review");
    expect(cloned.sections.find((s) => s.id === "methodology")?.emphasized).toBe(true);
    expect(cloned.sections.find((s) => s.id === "toc")?.emphasized).toBe(false);
  });

  it("記事の型に無い節を、強調の件数に数えない", () => {
    /*
      数えると、画面に出ない「3件強調中」が出る。探した人は見つけられない。
      比較研究所型の強調 3 件のうち、この記事の型にあるのは 0 件。
    */
    const cloned = cloneWritingMethodForSite(BASE, "comparison_lab");
    expect(cloned.emphasizedCount).toBe(0);
    expect(cloned.sections.every((s) => !s.emphasized)).toBe(true);
  });

  it("10 型すべてに重みの定義がある", () => {
    // 定義漏れがあると、その型のブログだけ画面が落ちる。
    const missing = SITE_PATTERNS.filter((p) => PATTERN_WRITING_EMPHASIS[p] === undefined);
    expect(missing).toEqual([]);
  });

  it("重みの理由が空でない", () => {
    // 理由の無い強調は、後から見た人に「なぜここだけ」を説明できない。
    const empty = SITE_PATTERNS.filter(
      (p) => PATTERN_WRITING_EMPHASIS[p].note.trim().length === 0,
    );
    expect(empty).toEqual([]);
  });
});
