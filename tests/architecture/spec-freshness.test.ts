/** @tier 1 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fingerprint, judgeFreshness, judgeVerdict } from "../../scripts/spec-freshness.mjs";

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

  it("PASS 以外の判定は通さない（FAIL も、見たことのない語も）", () => {
    // 「PASS でなければ落とす」であって「FAIL なら落とす」ではない。
    // 後者だと、綴りが変わった日や新しい語が増えた日に黙って通る。
    expect(judgeVerdict({ verdict: "FAIL" }).ok).toBe(false);
    expect(judgeVerdict({ verdict: "PARTIAL" }).ok).toBe(false);
    expect(judgeVerdict({ verdict: "pass" }).ok).toBe(false);
    expect(judgeVerdict({ verdict: "PASS" }).ok).toBe(true);
  });

  it("判定の欄が無い・空・文字列でないものは通さない", () => {
    expect(judgeVerdict({}).ok).toBe(false);
    expect(judgeVerdict({ verdict: "  " }).ok).toBe(false);
    expect(judgeVerdict({ verdict: true }).ok).toBe(false);
    expect(judgeVerdict({}).message).toContain("誰も言っていません");
  });
});

/**
 * **判定した答えを、門が実際に使っているか。**
 *
 * 上の 5 件は `judgeFreshness` が正しく答えることだけを見ていた。それは緑のまま、
 * 呼び出し側は答えを受け取ってから捨て、必ず 0 を返していた（2026-08-19 まで）。
 * 「呼ばれていない」なら `grep` で気づけるが、**呼ばれて捨てている**のは気づけない。
 * だからここは関数ではなく**終了コード**を見る。判定と門のあいだが切れたら赤くなる。
 */
describe("門が、判定の答えを使っている", () => {
  const script = join(process.cwd(), "scripts/spec-freshness.mjs");

  /** レポートを 1 枚だけ差し替えて門を回し、終了コードと出力を返す。 */
  function runWith(report: unknown): { code: number; out: string } {
    const dir = mkdtempSync(join(tmpdir(), "spec-freshness-"));
    const path = join(dir, "report.json");
    writeFileSync(path, JSON.stringify(report));
    try {
      const out = execFileSync("node", [script], {
        cwd: process.cwd(),
        env: { ...process.env, SPEC_FRESHNESS_REPORT: path },
        encoding: "utf8",
      });
      return { code: 0, out };
    } catch (error) {
      const e = error as { status?: number; stdout?: string };
      return { code: e.status ?? -1, out: e.stdout ?? "" };
    }
  }

  it("指紋が焼かれていないレポートでは、門が落ちる", () => {
    const { code, out } = runWith({ verdict: "PASS" });
    expect(out).toContain("UNPINNED");
    // PASS と書いてあっても通さない。どの仕様書に対する PASS かが分からない。
    expect(code).toBe(1);
  });

  it("評価のあとに仕様書が変わっていたら、門が落ちる", () => {
    const { code, out } = runWith({ verdict: "PASS", inputs: { sha256: "a".repeat(64) } });
    expect(out).toContain("STALE");
    expect(code).toBe(1);
  });

  it("いまの仕様書に対する判定なら、門は通る", () => {
    const { code } = runWith({ verdict: "PASS", inputs: { sha256: fingerprint().sha256 } });
    expect(code).toBe(0);
  });

  /**
   * **鮮度を直した門が、すぐ隣の `verdict` を見ていなかった。**
   *
   * 上の 4 件は「いつの仕様書を見た判定か」だけを見ている。それが全部緑のまま、
   * **判定が `FAIL` のレポートを焼き付ければ `FRESH` になって通る**状態だった。
   * 「いつ見たか」に答えられることは、「満たしている」を少しも意味しない。
   */
  it("判定が FAIL のレポートは、焼き付いていても門が落ちる", () => {
    const { code, out } = runWith({ verdict: "FAIL", inputs: { sha256: fingerprint().sha256 } });
    // 鮮度のほうは通っている。それでも落ちる、が見たいこと。
    expect(out).toContain("FRESH");
    expect(out).toContain("満たしていません");
    expect(code).toBe(1);
  });

  it("判定の欄が無いレポートも門が落ちる（消すのを逃げ道にしない）", () => {
    const { code, out } = runWith({ inputs: { sha256: fingerprint().sha256 } });
    expect(out).toContain("記載なし");
    expect(code).toBe(1);
  });

  it("レポートが無いときも門は落ちる（消すのを逃げ道にしない）", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-freshness-"));
    let code = 0;
    try {
      execFileSync("node", [script], {
        cwd: process.cwd(),
        env: { ...process.env, SPEC_FRESHNESS_REPORT: join(dir, "ない.json") },
        encoding: "utf8",
      });
    } catch (error) {
      code = (error as { status?: number }).status ?? -1;
    }
    expect(code).toBe(1);
  });
});
