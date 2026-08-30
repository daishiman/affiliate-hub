/** @tier 1 */
/**
 * @req REQ-TS09
 *
 * 宣言表を読む範囲が **§3 の中だけ** であることを固定する。
 *
 * --- 何が起きたか（2026-08-18 の実測） ---
 *
 * `docs/product/required-test-types.md` §4 は経緯を残すための節で、
 * そこにも要件 ID が並んだ表がいくつもある。
 * `readRegistry()` がこの文書を**全文**走っていたころ、
 * §4 の解説表 7 行が 2 つ目の宣言として数えられ、
 * 宣言済みが 88 → 95、未宣言が 153 → 149 になった。
 * テストも宣言表も 1 文字も触っていないのに数が動いた。
 *
 * 表に出るときの姿はもっと分かりにくい。3 列目が「除外と理由」だと解釈されるので、
 *
 *     REQ-A01: 除外に知らない種別 `tests/domain/link-ingestion.test.ts`（正本は TEST_TYPES）
 *
 * という、読んでも原因の分からない誤りになる。
 *
 * --- なぜ「作法」では足りないか ---
 *
 * 当時の回避は「§4 の表は 1 列目を要件 ID にしない」という書き方の作法だった。
 * 作法は**次にこの文書へ書き足す人へ伝わらない**。
 * ここで見るのは、作法を破っても数が動かないことである。
 *
 * --- なぜ数が動くのが危ないか ---
 *
 * 未宣言の件数は上限（`TEST_TYPES_MAX_UNDECLARED`）と突き合わせる数字である。
 * 上限を上げるのは禁じてあるのに、**文章を書き足すだけで分子のほうが減る**。
 * 緑になったことに誰も気づけない、いちばん静かな抜け道になる。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readRegistry } from "../../scripts/required-test-types.mjs";

const ROOT = process.cwd();
const REGISTRY = join(ROOT, "docs/product/required-test-types.md");

/** §4 に置かれた解説の表。**1 列目が要件 ID** という、いちばん危ない形。 */
const COMMENTARY = [
  "",
  "## 4. 未宣言の要件について（正直に書く）",
  "",
  "受け入れ側の検査には印を付けず、分かれ目を持つ単体側へ付けた。",
  "",
  "| REQ | 受け入れ条件 | 性質 | 印を付けた先 | そこにある分かれ目 |",
  "| --- | --- | --- | --- | --- |",
  "| REQ-A01 | §30.1 URL登録 | has-input | `tests/domain/link-ingestion.test.ts` | 内部ネットワークの端 |",
  "| REQ-A02 | §30.2 比較 | has-input | `tests/application/read-product.test.ts` | 件数の上限 |",
  "",
].join("\n");

const MINIMAL = [
  "# 必須テスト種別",
  "",
  "## 3. 宣言表",
  "",
  "| REQ | 性質 | 除外と理由 |",
  "| --- | --- | --- |",
  "| REQ-A01 | has-input | — |",
  "| REQ-A02 | has-input, has-state | boundary: 端が無い |",
  "",
].join("\n");

describe("宣言表の読み取り範囲", () => {
  it("§3 の行だけを宣言として拾う", () => {
    const rows = readRegistry(MINIMAL);
    expect(rows.map((r) => r.req)).toEqual(["REQ-A01", "REQ-A02"]);
    expect(rows[1].traits).toEqual(["has-input", "has-state"]);
    expect(rows[1].exclusions).toEqual([{ type: "boundary", reason: "端が無い" }]);
  });

  it("§4 へ要件 ID 始まりの解説表を足しても、宣言は 1 行も増えない", () => {
    const before = readRegistry(MINIMAL);
    const after = readRegistry(MINIMAL + COMMENTARY);
    expect(after).toEqual(before);
  });

  it("正本の文書でも、§4 へ解説表を足して宣言の件数が動かない", () => {
    const markdown = readFileSync(REGISTRY, "utf8");
    const before = readRegistry(markdown);
    // 実物は 240 件規模なので、増減が 1 件でも起きれば数で捕まる。
    expect(before.length).toBeGreaterThan(100);
    expect(readRegistry(markdown + COMMENTARY).length).toBe(before.length);
  });

  it("§3 の見出しが無い文書は、黙って 0 件にせず落ちる", () => {
    // 範囲を絞る側の壊れ方は「拾い落として静かに緑」である。
    // 見出しの名前を変えただけで宣言が全部消えるなら、それは知らせなければならない。
    expect(() => readRegistry(MINIMAL.replace("## 3. 宣言表", "## 3. 宣言の一覧"))).toThrow(
      /宣言表/,
    );
  });

  it("正本の §3 には、次の `##` までの表しか入っていない", () => {
    const markdown = readFileSync(REGISTRY, "utf8");
    const declared = new Set(readRegistry(markdown).map((r) => r.req));
    // §4 以降にしか出てこない ID が宣言に混ざっていないことの言い換えとして、
    // 宣言の件数が §3 の中の要件 ID 始まりの行数と一致することを見る。
    const section = markdown.split(/^##\s/m).find((s) => s.startsWith("3. 宣言表")) ?? "";
    const inSection = section
      .split("\n")
      .filter((l) => /^\|\s*REQ-[A-Z]+\d+\s*\|/.test(l)).length;
    expect(declared.size).toBe(inSection);
  });
});
