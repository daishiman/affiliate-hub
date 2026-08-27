/** @tier 1 @req REQ-P08 */
import { describe, expect, it } from "vitest";
import {
  ARTICLE_TYPES,
  HEADER_FIELD_SECTIONS,
  TEMPLATE_PROVIDED_SECTIONS,
  authoredSectionsFor,
  filledSectionIds,
  requiredSectionsFor,
} from "@/domain/authoring";

/**
 * 「原稿に書いてもらう節」と「器が出す節」の分け方。
 *
 * 公開ゲートは必須の節が揃っているかを見る。器が出しているものまで
 * 原稿に書かせると、入力欄が倍になり、誰も最後まで埋められない。
 * 逆に、画面に出ていないものを「器が出している」と数えると、
 * 出ていない項目を出したことにして公開できてしまう。
 */
describe("記事の節の分担", () => {
  it("器が出す節と欄で受け取る節は重ならない", () => {
    const overlap = TEMPLATE_PROVIDED_SECTIONS.filter((id) =>
      (HEADER_FIELD_SECTIONS as readonly string[]).includes(id),
    );
    expect(overlap).toEqual([]);
  });

  it("書いてもらう節・器が出す節・欄で受け取る節を足すと、必須の節が全部そろう", () => {
    for (const type of ARTICLE_TYPES) {
      const covered = new Set<string>([
        ...TEMPLATE_PROVIDED_SECTIONS,
        ...HEADER_FIELD_SECTIONS,
        ...authoredSectionsFor(type).map((s) => s.id),
      ]);
      const uncovered = requiredSectionsFor(type).filter((id) => !covered.has(id));
      expect(uncovered).toEqual([]);
    }
  });

  it("書いてもらう節に、器が出す節が混ざっていない", () => {
    for (const type of ARTICLE_TYPES) {
      const ids = authoredSectionsFor(type).map((s) => s.id);
      for (const provided of TEMPLATE_PROVIDED_SECTIONS) {
        expect(ids).not.toContain(provided);
      }
    }
  });

  it("記事の種類ごとに書いてもらう節が変わる（やり方の記事には手順がある）", () => {
    const guide = authoredSectionsFor("guide").map((s) => s.id);
    const review = authoredSectionsFor("review").map((s) => s.id);
    expect(guide).toContain("steps");
    expect(review).not.toContain("steps");
  });

  it("どの種類でも、書いてもらう節は 20 個を超えない（埋めきれない欄を作らない）", () => {
    for (const type of ARTICLE_TYPES) {
      expect(authoredSectionsFor(type).length).toBeLessThanOrEqual(20);
    }
  });
});

describe("埋まった節の数え方", () => {
  it("空欄は「書いた」に数えない", () => {
    const ids = filledSectionIds("guide", { steps: "1. 開く\n2. 押す", pros: "   ", cons: "" });
    expect(ids).toContain("steps");
    expect(ids).not.toContain("pros");
    expect(ids).not.toContain("cons");
  });

  it("器が出す節と、タイトル・結論の欄は最初から数に入る", () => {
    const ids = filledSectionIds("guide", {});
    expect(ids).toContain("byline");
    expect(ids).toContain("h1");
    expect(ids).toContain("one_sentence_conclusion");
  });

  it("その記事の種類に無い節を書いても数に入らない（別の種類の必須を借りない）", () => {
    const ids = filledSectionIds("review", { steps: "手順" });
    expect(ids).not.toContain("steps");
  });
});
