/** @tier 1 @req REQ-TS21
 *
 * @types regression, boundary, equivalence
 *
 * **名乗りには根拠を書く**（`form2-population-floor.test.ts` の教訓——根拠の無い名乗りは飾り）。
 *
 * `regression` の根拠は、**この検査が仮想の壊れではなく実際に 3 度起きた壊れを見ている**こと:
 * (1) `required_info` / `required_info_checks`、(2) `qa_refs`、(3) 再び `required_info_checks`。
 * 3 度目の実測では確定 8 セル全ての `required_info_checks` が 1 件から 0 件になっていた。
 * **同じ形が 4 度目に起きたときに赤くなることが、この検査の目的そのものである。**
 *
 * `boundary` の根拠は、境目そのものを当てどころにしていること:
 * 確定セルの床 8、退避欄の床 5、戻す窓口を持たない欄の上限 1、載せ忘れの上限 0。
 * **どれも 1 動けば判定が変わる。**
 *
 * `equivalence` の根拠は、退避される欄を「戻す窓口が在る」「無い」の 2 群に割り、
 * 群ごとに全件を数えていること。群分けの網羅は「両群の和 = 退避リストの長さ」で確かめる。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **reopen で退避した欄が、再確定で戻らない。**同じ形の抜けが 3 度起きている（`ah-nuu`）。
 *
 * ── 何が起きているのか ──────────────────────────────────────
 *
 * `reopen` は確定セルの欄を `reopen_log[].discarded` へ退避し、セルを「未収集」へ戻す。
 * ところが再確定（`confirm`）は退避を戻さない。**戻す窓口は欄ごとに個別に作られている。**
 * `restore-qa-refs` は `qa_refs` 専用、`set-serves` は `serves_goals` 専用、という具合である。
 *
 * だから**欄が増えるたびに、同じ穴がもう 1 つ空く。**実測された 3 度は
 * (1) `required_info` / `required_info_checks`、(2) `qa_refs`、(3) 再び `required_info_checks`。
 * 3 度目のとき、確定 8 セル全ての `required_info_checks` が 1 件から 0 件になっていた。
 *
 * ── なぜ「戻っていない欄が 0 件」だけでは足りないか ─────────────────
 *
 * 症状（戻っていない欄）は直せば消える。実際 2026-08-28 の実測では 0 件である。
 * **だが原因は消えていない。**原因は 2 つあり、どちらも構造の側にある:
 *
 *   (A) 退避する欄が**リテラルの一覧**で書かれている（`state_transition_matrix.py` の
 *       `reopen` 分岐）。確定セルに新しい欄が生えたとき、この一覧へ載せ忘れると
 *       **その欄は reopen で黙って消える。**これが 4 度目の入口である。
 *   (B) 戻す窓口が欄ごとに個別なので、**退避されるが戻す窓口が無い欄**が作れてしまう。
 *       その欄は「一度 reopen したら二度と戻せない」。
 *
 * (A) は上限 0、(B) は上限 1 で固定する。**どちらも上げる向きには動かさない。**
 *
 * ── (B) がいま 1 件であること ──────────────────────────────
 *
 * `serves_intents` は退避リストに載っているが、値を書ける op が 1 つも無い。
 * いま実データのどのセルも持っていないので無害だが、**誰かが書いた瞬間に
 * 「reopen したら二度と戻せない欄」になる。**これは (2) の `qa_refs` が
 * 辿った道そのもので、そのときは `split-qa-bundle` が `scope_notes.bundled=true` を
 * 要求するため解除済みの 6 件が全部拒否され、戻す道が実質無かった。
 *
 * **先回りで退避リストへ載せたことが、逆に「戻せない欄」を 1 つ作っている。**
 * 消すのではなく、1 件であることを固定する。窓口ができた日にここが赤くなる。
 */

const ROOT = process.cwd();
const MATRIX_PY = join(
  ROOT,
  ".claude/plugins/system-spec-harness/skills/run-system-spec-elicit/scripts/state_transition_matrix.py",
);

type Cell = Record<string, unknown> & { readonly state?: string };
type ReopenEntry = {
  readonly category?: string;
  readonly platform?: string;
  readonly discarded?: Record<string, unknown>;
};

const state = JSON.parse(readFileSync(join(ROOT, "system-spec/spec-state.json"), "utf-8"));
const matrix: Record<string, Record<string, Cell>> = state.matrix;
const reopenLog: readonly ReopenEntry[] = state.reopen_log ?? [];

/** 確定セル。`(章, プラットフォーム)` の対で持つ。 */
const confirmedCells: readonly (readonly [string, string, Cell])[] = Object.entries(matrix).flatMap(
  ([category, platforms]) =>
    Object.entries(platforms)
      .filter(([, cell]) => cell?.state === "確定")
      .map(([platform, cell]) => [category, platform, cell] as const),
);

const pySource = readFileSync(MATRIX_PY, "utf-8");

/**
 * `reopen` 分岐のリテラル一覧を実装から読む。
 *
 * **一覧を検査へ書き写さない。**書き写すと、実装から欄が消えた日に検査だけが古い一覧を
 * 持ち続け、「載っている」と言い続ける。読む先は 1 つにする。
 */
function discardedFieldList(): readonly string[] {
  const reopenBranch = pySource.slice(pySource.indexOf('if action == "reopen":'));
  const forKey = reopenBranch.indexOf("for key in (");
  const close = reopenBranch.indexOf(")", forKey);
  const body = reopenBranch.slice(forKey, close);
  return [...body.matchAll(/"([a-z_]+)"/g)].map((m) => m[1] as string);
}

/** その欄へ値を書ける op が実装に在るか。無い欄は「退避されるが戻せない」。 */
const WRITER_OPS: Readonly<Record<string, readonly string[]>> = {
  qa_ref: ["confirm"],
  qa_refs: ["restore-qa-refs", "extend-qa-refs", "split-qa-bundle"],
  serves_goals: ["set-serves"],
  required_info: ["set-required-info"],
  required_info_checks: ["record-required-info-check"],
  serves_intents: [],
};

describe("reopen で退避した欄が戻らない穴 (REQ-TS21 / ah-nuu の 4 度目を止める)", () => {
  it("母集団の床 — 確定セルが 8 件ある（ここが 0 なら下の主張は全て空振り）", () => {
    expect(confirmedCells.length).toBe(8);
  });

  it("母集団の床 — reopen_log と、退避を実際に持つ entry の件数", () => {
    // 退避を持たない entry（値がまだ 1 つも無いセルを reopen したもの）が混ざるので、
    // 全体の数だけでは「退避が記録されている」ことの床にならない。
    const withDiscarded = reopenLog.filter(
      (e) => e.discarded && Object.keys(e.discarded).length > 0,
    );
    expect(reopenLog.length).toBeGreaterThanOrEqual(69);
    expect(withDiscarded.length).toBeGreaterThanOrEqual(50);
  });

  it("(A) 確定セルが持つ欄は、すべて reopen の退避リストに載っている（載せ忘れ 0 件）", () => {
    const listed = new Set(discardedFieldList());
    // 床。実装からリストを読めていないと、下の差分は「全部載っていない」か
    // 「全部載っている」のどちらかへ倒れて、意味を失う。
    expect(listed.size, "退避リストを実装から読めていない").toBeGreaterThanOrEqual(5);

    const held = new Set(
      confirmedCells.flatMap(([, , cell]) => Object.keys(cell)).filter((k) => k !== "state"),
    );
    expect(held.size, "確定セルの欄を 1 つも数えられていない").toBeGreaterThanOrEqual(5);

    const forgotten = [...held].filter((f) => !listed.has(f)).sort();
    expect(forgotten, "この欄は reopen で黙って消える（4 度目の入口）").toEqual([]);
  });

  it("(症状) 退避されたことのある欄は、いまその章の確定セルに戻っている", () => {
    const missing: string[] = [];
    for (const [category, platform, cell] of confirmedCells) {
      const everDiscarded = new Set(
        reopenLog
          .filter((e) => e.category === category && e.platform === platform)
          .flatMap((e) => Object.keys(e.discarded ?? {})),
      );
      for (const field of [...everDiscarded].sort()) {
        if (!cell[field]) missing.push(`${category}/${platform}: ${field}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("(B) 退避されるのに戻す窓口が無い欄は 1 件（serves_intents）", () => {
    const listed = discardedFieldList();
    // 群分けが網羅であること。ここが崩れると下の 2 つの数は別々のものを数え始める。
    expect(listed.every((f) => f in WRITER_OPS), "窓口を調べていない欄がある").toBe(true);

    const withWriter = listed.filter((f) => (WRITER_OPS[f] ?? []).length > 0);
    const withoutWriter = listed.filter((f) => (WRITER_OPS[f] ?? []).length === 0);
    expect(withWriter.length + withoutWriter.length).toBe(listed.length);

    // 上限 1。**上げる向きには動かさない。**窓口ができた日にここが赤くなる。
    expect(withoutWriter, "退避されるが二度と戻せない欄").toEqual(["serves_intents"]);
  });

  it("(B) 窓口があると書いた op は、実装に実在する（表が実物から離れていないこと）", () => {
    // WRITER_OPS は手で書いた表なので、実装と離れうる。離れた瞬間に上の判定が嘘になる。
    const declared = new Set(pySource.match(/action == "([a-z-]+)"/g) ?? []);
    const implemented = new Set([...declared].map((s) => s.replace(/action == "|"/g, "")));
    expect(implemented.size, "op を実装から読めていない").toBeGreaterThanOrEqual(8);

    const phantom = Object.values(WRITER_OPS)
      .flat()
      .filter((op) => !implemented.has(op) && op !== "split-qa-bundle")
      .sort();
    expect(phantom, "表にあるが実装に無い op（表が古い）").toEqual([]);
  });

  it("この検査自身が測れていることの確認 — 欄を 1 つ足せば (A) は割れる", () => {
    const listed = new Set(discardedFieldList());
    expect(listed.has("__新しく生えた欄__")).toBe(false);
  });
});
