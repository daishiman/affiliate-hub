/**
 * @tier 2
 * @req REQ-TS09
 * @types contract, infra-config
 *
 * 生成物が **古いまま** であることを捕まえる。
 *
 * --- なぜ既存の検査では足りないのか ---
 *
 * `tests/architecture/generated-docs.test.ts` は、末尾に焼いた指紋と中身を
 * 突き合わせている。それが答えている問いは **「手で書き換えていないか」** である。
 * 文書の頭に書いてあるのは「機械が作る」で、読む人はそれを
 * **「最新である」** と受け取る。**この 2 つは別のことである。**
 *
 * 実測で確かめた。`docs/product/test-traceability.md` を 1 世代前
 * （テストファイル 196 件と名乗っている版）へ書き戻したうえで
 * `pnpm exec vitest run tests/architecture/generated-docs.test.ts` を走らせると、
 * **12 件すべて緑**だった。そのときディスクにあったテストファイルは 197 件である。
 * 中身ごと古ければ、指紋はその古い中身と整合するので、指紋は何も言わない。
 *
 * --- ここで見るもの ---
 *
 * **文書の外で数えた実数**と、文書が名乗っている数を突き合わせる。
 * 文書から読んだ数どうしを比べても、古い文書の中では辻褄が合っているので緑になる。
 * だから数える側は、文書を一切読まない。
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectStamped, stamp } from "../../scripts/lib/generated-doc.mjs";
import { compareDeclared, readDeclared } from "../../scripts/lib/generated-freshness.mjs";

const ROOT = process.cwd();

/**
 * まだ塞げていない分（`bd remember` の ②の形）。
 *
 * **この枝では `docs/product/` を触れない**ため、`test-traceability.md` は
 * 「テストファイル 196 件」と名乗ったまま置いてある。実際は 198 件で、
 * 差の 2 件はこの枝が足した `tests/visual/visual-regression.test.ts` と、
 * **このファイル自身**である。
 * 生成し直すのは取り込む側の担当なので、ここでは差を 2 件だけ許している。
 *
 * 最初この値を 1 と書いて赤くなった。**検査が自分自身を数えたからである。**
 * 「古さを見張るファイル」も母集団の一員なので、置いた瞬間に古さが 1 増える。
 * 予想ではなく実測で決めるべき数だった、という記録として残しておく。
 *
 * **反転先:** 取り込む側が `node scripts/traceability.mjs` を 1 回走らせたら、
 * この値を **0** に下げること。0 にして緑にならなければ、それは
 * この枝とは別の古さが残っているということなので、そこで追うこと。
 *
 * この数は**悪いことをしたときだけ増える**。テストを足して生成し直さない、
 * という一手でしか増えない。だから上限を張る先として正しい。
 * **上げる方向へは動かさない。**
 */
const KNOWN_STALE_MAX = 2;

/** テストファイルを数える。**文書は読まない。** */
function countTestFiles(dir: string): number {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) n += countTestFiles(path);
    else if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) n += 1;
  }
  return n;
}

/** 要件表に並んでいる要件を数える。**生成物のほうは読まない。** */
function countRequirementRows(): number {
  const rows = readFileSync(join(ROOT, "docs/product/traceability.md"), "utf8")
    .split("\n")
    .map((line) => line.match(/^\|\s*(REQ-[A-Z]+\d+)\s*\|/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => m[1]);
  return new Set(rows).size;
}

describe("生成物が古くなっていないこと", () => {
  it("指紋は「古いまま」を捕まえない（塞ごうとしている穴を、まずそう書いて固定する）", () => {
    // 5 件と名乗っている文書を、正しく機械が焼いた状態にする。
    const doc = stamp("# 集計\n\n- テストファイル: 5 件\n");

    // 指紋の検査は緑になる。手は入っていないので、これは指紋としては正しい。
    expect(inspectStamped(doc).state).toBe("INTACT");

    // それでも、実際は 6 件ある。**指紋が守っているのは最新であることではない。**
    expect(readDeclared(doc, "テストファイル")).toBe(5);
    expect(
      compareDeclared({
        doc: "（合成）",
        label: "テストファイル",
        declared: readDeclared(doc, "テストファイル"),
        measured: 6,
        howMeasured: "合成例",
      }),
    ).toMatch(/5 件と名乗っていますが/);
  });

  it("数が合っていれば何も言わない", () => {
    expect(
      compareDeclared({
        doc: "（合成）",
        label: "テストファイル",
        declared: 6,
        measured: 6,
        howMeasured: "合成例",
      }),
    ).toBeNull();
  });

  it("名乗っている行が読めなくなったら、緑ではなく赤にする", () => {
    // **「食い違い 0 件」は、合っているときと、見えていないときの両方で出る。**
    // 見出しの言い回しが変わった日に静かに緑になると、この検査は
    // 「動いている」と思われたまま何も見なくなる。だから投げる。
    expect(() => readDeclared("- 試験ファイル: 5 件\n", "テストファイル")).toThrow(
      /名乗っている行が見つかりません/,
    );
    // 強調記号の有無や全角コロンでは読めなくならない（毎回赤い検査は見られなくなる）。
    expect(readDeclared("- **由来不明: 28 件**（上限 28 件）\n", "由来不明")).toBe(28);
    expect(readDeclared("- テストファイル： 1,234 件\n", "テストファイル")).toBe(1234);
  });

  it("required-test-types-report.md が名乗る要件の数は、要件表の実数と合っている", () => {
    const text = readFileSync(join(ROOT, "docs/product/required-test-types-report.md"), "utf8");
    const measured = countRequirementRows();
    // **床を先に置く。** 数え方が壊れて 0 になった日に、
    // 「0 と 0 で一致」という形で緑にしないため。
    expect(measured, "要件表から要件を読めていません").toBeGreaterThanOrEqual(200);
    expect(
      compareDeclared({
        doc: "docs/product/required-test-types-report.md",
        label: "要件表の要件",
        declared: readDeclared(text, "要件表の要件"),
        measured,
        howMeasured: "docs/product/traceability.md の `| REQ-… |` で始まる行の REQ を数える",
      }),
    ).toBeNull();
  });

  it("test-traceability.md が名乗るテストファイルの数の古さが、許した分を超えていない", () => {
    const text = readFileSync(join(ROOT, "docs/product/test-traceability.md"), "utf8");
    const measured = countTestFiles(join(ROOT, "tests"));
    expect(measured, "tests 配下を数えられていません").toBeGreaterThanOrEqual(190);

    const declared = readDeclared(text, "テストファイル");
    const stale = Math.abs(declared - measured);
    expect(
      stale,
      [
        compareDeclared({
          doc: "docs/product/test-traceability.md",
          label: "テストファイル",
          declared,
          measured,
          howMeasured: "tests 配下の *.test.ts / *.test.tsx を再帰で数える",
        }) ?? "",
        "",
        `許してある古さは ${KNOWN_STALE_MAX} 件までです（この枝が足した 2 件ぶん）。`,
        "`node scripts/traceability.mjs` を走らせて生成し直し、KNOWN_STALE_MAX を 0 に下げてください。",
      ].join("\n"),
    ).toBeLessThanOrEqual(KNOWN_STALE_MAX);
  });
});
