/**
 * @tier 1
 * @req REQ-SEO03
 * @types equivalence, boundary
 */
import { describe, expect, it } from "vitest";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { auditArticleForAiSearch } from "@/application/seo/ai-search-audit";

/** 全項目が通る記事。ここから 1 か所ずつ崩して、落ち方を確かめる。 */
const goodArticle: PublishedArticle = {
  slug: "laptops",
  siteSlug: "gadget",
  type: "guide",
  title: "動画編集向けノートの選び方",
  summary:
    "動画編集向けノートは書き出し速度・画面の色・持ち運びの 3 点で選ぶ。実測 5 機種の結果から、用途別の結論を先に示す。",
  categorySlug: "laptop",
  publishedAt: "2026-08-01",
  updatedAt: "2026-08-20",
  author: {
    slug: "writer",
    name: "編集部",
    bio: "実測レビュー歴 5 年。",
    credentials: ["色彩検定 2 級"],
  },
  disclosureRequired: true,
  sections: [
    {
      id: "s1",
      heading: "結論",
      paragraphs: ["まず 10 万円台ならこの 1 台。"],
      claims: [
        {
          id: "c1",
          statement: "書き出しが最速だった",
          kind: "fact",
          evidence: [{ id: "e1", sourceLabel: "実測ログ", checkedAt: "2026-08-19" }],
        },
      ],
    },
  ],
};

function checkOf(article: PublishedArticle, name: string): boolean {
  const found = auditArticleForAiSearch(article).find((c) => c.check.includes(name));
  if (found === undefined) throw new Error(`点検項目「${name}」がありません`);
  return found.ok;
}

describe("AI 検索への備えの点検", () => {
  it("構造の揃った記事は全項目が ok", () => {
    for (const check of auditArticleForAiSearch(goodArticle)) {
      expect(check.ok, check.check).toBe(true);
    }
  });

  it("先頭の節に本文が無ければ「冒頭に結論」で落ちる", () => {
    const broken = {
      ...goodArticle,
      sections: [{ id: "s1", heading: "結論", paragraphs: [] as const }],
    };
    expect(checkOf(broken, "結論")).toBe(false);
  });

  it("節が 1 つも無くても「冒頭に結論」で落ちる（先頭参照で壊れない）", () => {
    expect(checkOf({ ...goodArticle, sections: [] }, "結論")).toBe(false);
  });

  it("更新日が空なら落ちる", () => {
    expect(checkOf({ ...goodArticle, updatedAt: "" }, "更新日")).toBe(false);
  });

  it("著者の bio が空なら落ちる", () => {
    const broken = { ...goodArticle, author: { ...goodArticle.author, bio: "  " } };
    expect(checkOf(broken, "著者")).toBe(false);
  });

  it("evidence の無い claims だけなら「出典」で落ちる", () => {
    const broken: PublishedArticle = {
      ...goodArticle,
      sections: [
        {
          id: "s1",
          heading: "結論",
          paragraphs: ["まずこれ。"],
          claims: [{ id: "c1", statement: "最速", kind: "opinion", evidence: [] }],
        },
      ],
    };
    expect(checkOf(broken, "出典")).toBe(false);
  });

  it("summary が 50 字未満・160 字超で落ち、境界の 50 字・160 字は通る", () => {
    expect(checkOf({ ...goodArticle, summary: "短い。" }, "説明文")).toBe(false);
    expect(checkOf({ ...goodArticle, summary: "あ".repeat(161) }, "説明文")).toBe(false);
    expect(checkOf({ ...goodArticle, summary: "あ".repeat(50) }, "説明文")).toBe(true);
    expect(checkOf({ ...goodArticle, summary: "あ".repeat(160) }, "説明文")).toBe(true);
  });

  it("全項目に hint がある（落ちた理由を人に調べさせない）", () => {
    for (const check of auditArticleForAiSearch(goodArticle)) {
      expect(check.hint.length).toBeGreaterThan(0);
    }
  });
});
