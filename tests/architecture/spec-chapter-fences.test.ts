/** @tier 1 */
/** @req REQ-TS11 */
/** @types regression */
/**
 * 仕様章のコードフェンスが正しく開閉していることを固定する。
 *
 * **見ているのは「フェンスの数が偶数か」ではない。**backend.md は壊れていたときも偶数 2 本だった。
 * 閉じフェンスだけを持つ回答本文が章に 2 度出力され、行き場の無い 2 本が互いに対になって
 * **169 行を丸ごとコード塊として飲み込んでいた**。数を数えるだけの検査は、この形を緑にする。
 * だから「開いてから閉じるまでの行数」を見る。
 *
 * 2026-09-06: 正規 renderer が回答・注記の未閉鎖フェンスを境界内で閉じ、
 * 旧 QA の重複コピーを正本接続後に除去する。章への手直しは不要である。
 * マーカーの種類・長さも確認し、短い内側フェンスや別マーカーを閉じと誤認しない。
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
  let marker = "";
  lines.forEach((line, i) => {
    const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!delimiter) return;
    if (open < 0) {
      if (delimiter[1][0] === "`" && delimiter[2].includes("`")) return;
      open = i + 1;
      marker = delimiter[1];
    } else if (delimiter[1][0] === marker[0] && delimiter[1].length >= marker.length && !delimiter[2].trim()) {
      blocks.push({ open, close: i + 1 });
      open = -1;
    }
  });
  if (open >= 0) blocks.push({ open, close: -1 });
  return blocks;
}

describe("仕様章のコードフェンス", () => {
  it.each(["````", "~~~~"])("%s の内側の短いフェンスは閉じとして数えない", (marker) => {
    expect(fenceBlocks(`${marker}\n${marker.slice(1)}\n本文\n${marker}\n`)).toEqual([{ open: 1, close: 4 }]);
    expect(fenceBlocks(`${marker}\n${marker.slice(1)}\n`)).toEqual([{ open: 1, close: -1 }]);
  });

  it("別マーカー・info 付き行では閉じず、同じマーカーの長い閉じを受ける", () => {
    expect(fenceBlocks("   ~~~js\n```\n~~~text\n~~~~\n")).toEqual([{ open: 1, close: 4 }]);
    expect(fenceBlocks("    ```\n本文\n")).toEqual([]);
  });
  it("開いたまま終わっている章が無い", () => {
    const names = chapters();
    expect(names.length, "8 章と要求定義・索引が走査対象にある").toBeGreaterThanOrEqual(10);
    let blockCount = 0;
    for (const name of names) {
      const blocks = fenceBlocks(readFileSync(join(SPEC_DIR, name), "utf8"));
      blockCount += blocks.length;
      const unclosed = blocks.filter(
        (b) => b.close < 0,
      );
      expect(unclosed.map((b) => b.open), `${name}: 閉じていないコード塊がある`).toEqual([]);
    }
    expect(blockCount, "開閉を検査したコード塊の母集団").toBeGreaterThan(0);
  });

  it("1 つのコード塊が章の本文を飲み込んでいない", () => {
    const names = chapters();
    expect(names.length, "8 章と要求定義・索引が走査対象にある").toBeGreaterThanOrEqual(10);
    let blockCount = 0;
    for (const name of names) {
      const blocks = fenceBlocks(readFileSync(join(SPEC_DIR, name), "utf8"));
      blockCount += blocks.length;
      const wide = blocks
        .filter((b) => b.close > 0 && b.close - b.open > MAX_FENCE_SPAN)
        .map((b) => `${b.open}〜${b.close} 行 (${b.close - b.open} 行)`);
      expect(wide, `${name}: コード塊が広すぎる。開きフェンスの脱落を疑う`).toEqual([]);
    }
    expect(blockCount, "広さを検査したコード塊の母集団").toBeGreaterThan(0);
  });

  it("見出しがコード塊の中に入り込んでいない", () => {
    // 飲み込みが起きると、章の見出しがコードとして表示される。行数の上限をすり抜けた
    // 飲み込みも、この形なら捕まる。
    const names = chapters();
    expect(names.length, "8 章と要求定義・索引が走査対象にある").toBeGreaterThanOrEqual(10);
    let blockCount = 0;
    for (const name of names) {
      const lines = readFileSync(join(SPEC_DIR, name), "utf8").split("\n");
      const swallowed: string[] = [];
      const blocks = fenceBlocks(lines.join("\n"));
      blockCount += blocks.length;
      lines.forEach((line, i) => {
        const inside = blocks.some((b) => i + 1 > b.open && (b.close < 0 || i + 1 < b.close));
        if (inside && /^#{2,3} /.test(line)) swallowed.push(`${i + 1}: ${line.slice(0, 40)}`);
      });
      expect(swallowed, `${name}: 見出しがコード塊の中にある`).toEqual([]);
    }
    expect(blockCount, "見出し混入を検査したコード塊の母集団").toBeGreaterThan(0);
  });
});
