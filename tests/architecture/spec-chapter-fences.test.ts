/** @tier 1 */
/** @req REQ-TS11 */
/**
 * 仕様章のコードフェンスが正しく開閉していることを固定する。
 *
 * **見ているのは「フェンスの数が偶数か」ではない。**backend.md は壊れていたときも偶数 2 本だった。
 * 閉じフェンスだけを持つ回答本文が章に 2 度出力され、行き場の無い 2 本が互いに対になって
 * **169 行を丸ごとコード塊として飲み込んでいた**。数を数えるだけの検査は、この形を緑にする。
 * だから「開いてから閉じるまでの行数」を見る。
 *
 * **直したのは章であって、元の回答本文ではない。**`spec-state.json` の qa_log に入っている
 * 回答は、いまも閉じフェンスだけを持っている（開きフェンスが無い）。それを直すのは C01 の担当で、
 * この作業場所からは触らない。つまり **compile を走らせ直すと、この壊れ方はそのまま戻ってくる**。
 * この検査は、戻ってきたことを知らせるために置いてある。赤くなったら、章を手で直すのではなく
 * qa_log 側を直す番だという合図である。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SPEC_DIR = join(process.cwd(), "system-spec");

/** 1 つのコード塊が飲み込んでよい行数の上限。実際の最大は 17 行。 */
const MAX_FENCE_SPAN = 60;

function chapters(): readonly string[] {
  return readdirSync(SPEC_DIR)
    .filter((n) => n.endsWith(".md"))
    .sort();
}

type Block = { readonly open: number; readonly close: number };

/** 章の中のコード塊を (開き行, 閉じ行) で返す。閉じていない塊は close を -1 にする。 */
function fenceBlocks(text: string): readonly Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let open = -1;
  lines.forEach((line, i) => {
    if (!line.startsWith("```")) return;
    if (open < 0) {
      open = i + 1;
    } else {
      blocks.push({ open, close: i + 1 });
      open = -1;
    }
  });
  if (open >= 0) blocks.push({ open, close: -1 });
  return blocks;
}

describe("仕様章のコードフェンス", () => {
  it("開いたまま終わっている章が無い", () => {
    for (const name of chapters()) {
      const unclosed = fenceBlocks(readFileSync(join(SPEC_DIR, name), "utf8")).filter(
        (b) => b.close < 0,
      );
      expect(unclosed.map((b) => b.open), `${name}: 閉じていないコード塊がある`).toEqual([]);
    }
  });

  it("1 つのコード塊が章の本文を飲み込んでいない", () => {
    for (const name of chapters()) {
      const wide = fenceBlocks(readFileSync(join(SPEC_DIR, name), "utf8"))
        .filter((b) => b.close > 0 && b.close - b.open > MAX_FENCE_SPAN)
        .map((b) => `${b.open}〜${b.close} 行 (${b.close - b.open} 行)`);
      expect(wide, `${name}: コード塊が広すぎる。開きフェンスの脱落を疑う`).toEqual([]);
    }
  });

  it("見出しがコード塊の中に入り込んでいない", () => {
    // 飲み込みが起きると、章の見出しがコードとして表示される。行数の上限をすり抜けた
    // 飲み込みも、この形なら捕まる。
    for (const name of chapters()) {
      const lines = readFileSync(join(SPEC_DIR, name), "utf8").split("\n");
      const swallowed: string[] = [];
      let inside = false;
      lines.forEach((line, i) => {
        if (line.startsWith("```")) {
          inside = !inside;
          return;
        }
        if (inside && /^#{2,3} /.test(line)) swallowed.push(`${i + 1}: ${line.slice(0, 40)}`);
      });
      expect(swallowed, `${name}: 見出しがコード塊の中にある`).toEqual([]);
    }
  });
});
