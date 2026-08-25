/**
 * @tier 1
 * @req REQ-SEO05
 * @types equivalence, boundary
 */
import { describe, expect, it } from "vitest";
import {
  INITIAL_GUIDELINE_REFERENCES,
  REVIEW_INTERVAL_DAYS,
  referenceReviewStatus,
} from "@/domain/seo/guideline-reference";

/**
 * 指針の鮮度判定。
 *
 * ここが間違うと、**古い指針を根拠にした最適化が「確認済み」の顔で残り続ける**。
 * 90 日の境界は仕様上「超えたら見直し」なので、90 日ちょうどは fresh。
 */
describe("指針の見直し時期", () => {
  // 2026-01-01 から数えて 89 日後 = 2026-03-31、90 日後 = 2026-04-01、91 日後 = 2026-04-02。
  const checked = { checkedAt: "2026-01-01" };

  it("89 日なら fresh", () => {
    expect(referenceReviewStatus(checked, "2026-03-31")).toBe("fresh");
  });

  it("90 日ちょうどは fresh（「超えたら」見直し）", () => {
    expect(referenceReviewStatus(checked, "2026-04-01")).toBe("fresh");
  });

  it("91 日で review_due になる", () => {
    expect(referenceReviewStatus(checked, "2026-04-02")).toBe("review_due");
  });

  it("読めない日付は review_due に倒す", () => {
    // 壊れた日付が「新鮮」に見えると、直すきっかけが永久に来ない。
    expect(referenceReviewStatus({ checkedAt: "いつか" }, "2026-04-01")).toBe("review_due");
  });

  it("見直し間隔は 90 日", () => {
    expect(REVIEW_INTERVAL_DAYS).toBe(90);
  });
});

describe("最初に登録する指針", () => {
  it("4 件あり、全件に確認日と『全文は未取得』の但し書きがある", () => {
    expect(INITIAL_GUIDELINE_REFERENCES).toHaveLength(4);
    for (const ref of INITIAL_GUIDELINE_REFERENCES) {
      expect(ref.checkedAt).toBe("2026-08-24");
      // 全文を読んでいないことを隠さない。要旨確認だけの行を「全文確認済み」に見せない。
      expect(ref.note).toContain("本文全文は未取得");
      expect(ref.note).toContain("WebSearch で存在・発行元・要旨を確認");
      expect(ref.url).toMatch(/^https:\/\//);
    }
  });

  it("id が重複していない", () => {
    const ids = INITIAL_GUIDELINE_REFERENCES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
