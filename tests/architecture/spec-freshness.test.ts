import { describe, expect, it } from "vitest";
import { fingerprint, judgeFreshness } from "../../scripts/spec-freshness.mjs";

/**
 * 仕様の完全性レポートが「いつの仕様書を見た判定か」を言えることを見る。
 *
 * 守りたいのは 1 点だけ。**古い PASS を新しい PASS と読み違えないこと**。
 * 判定そのものの正しさ（PASS が妥当か）はここでは見ない。それは人と評価者の仕事で、
 * ここが見るのは「その判定が、いまの仕様書に対するものかどうか」である。
 */

describe("仕様レポートの鮮度", () => {
  it("入力の指紋が取れて、対象が空でない", () => {
    const fp = fingerprint();
    expect(fp.fileCount).toBeGreaterThan(10);
    expect(fp.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("同じ入力なら同じ指紋になる（読む順で変わらない）", () => {
    // 順番で変われば毎回 STALE になり、「どうせ赤い」で誰も見なくなる。
    expect(fingerprint().sha256).toBe(fingerprint().sha256);
  });

  it("指紋が焼かれていないレポートは、何も言えないものとして扱う", () => {
    // PASS と書いてあっても、どの仕様書に対する PASS かが分からない。
    const judged = judgeFreshness({}, { sha256: "a".repeat(64), fileCount: 1 });
    expect(judged.state).toBe("UNPINNED");
  });

  it("評価のあとに仕様書が変わっていたら STALE と言う", () => {
    const judged = judgeFreshness(
      { inputs: { sha256: "a".repeat(64) } },
      { sha256: "b".repeat(64), fileCount: 1 },
    );
    expect(judged.state).toBe("STALE");
    // 「間違っている」ではなく「何も言っていない」と書く。ここを取り違えると、
    // STALE を見た人が「直せば済む」と誤解して再評価を省く。
    expect(judged.message).toContain("何も言っていません");
  });

  it("一致していれば FRESH と言う", () => {
    const same = "c".repeat(64);
    const judged = judgeFreshness({ inputs: { sha256: same } }, { sha256: same, fileCount: 27 });
    expect(judged.state).toBe("FRESH");
  });
});
