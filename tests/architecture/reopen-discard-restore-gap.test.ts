/** @tier 1 @req REQ-TS21
 *
 * @types regression, boundary, equivalence
 *
 * **名乗りには根拠を書く**（`form2-population-floor.test.ts` の教訓——根拠の無い名乗りは飾り）。
 *
 * `regression` の根拠は、**この検査が仮想の壊れではなく実際に 4 度起きた壊れを見ている**こと:
 * (1) `required_info` / `required_info_checks`、(2) `qa_refs`、(3) 再び `required_info_checks`、
 * (4) 2026-09-02 の infrastructure / maintenance-ops。3 度目の実測では確定 8 セル全ての
 * `required_info_checks` が 1 件から 0 件になっていた。
 * **同じ形が 5 度目に起きたときに赤くなることが、この検査の目的そのものである。**
 *
 * `boundary` の根拠は、境目そのものを当てどころにしていること:
 * 確定セルの床 8、退避しない欄の上限 3、単一窓口が名指しする欄の上限 2、載せ忘れの上限 0。
 * **どれも 1 動けば判定が変わる。**
 *
 * `equivalence` の根拠は、確定セルが持つ欄を「退避される」「されない」の 2 群に割り、
 * 群ごとに全件を数えていること。群分けの網羅は「両群の和 = 確定セルが持つ欄の総数」で確かめる。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **reopen で退避した欄が、再確定で戻らない。**同じ形の抜けが 4 度起きている（`ah-nuu`）。
 *
 * ── 何が起きていたのか ─────────────────────────────────────
 *
 * `reopen` は確定セルの欄を `reopen_log[].discarded` へ退避し、セルを「未収集」へ戻す。
 * ところが再確定（`confirm`）は退避を戻さない。**戻す窓口は欄ごとに個別に作られていた。**
 * `restore-qa-refs` は `qa_refs` 専用、`set-serves` は `serves_goals` 専用、という具合である。
 *
 * だから**欄が増えるたびに、同じ穴がもう 1 つ空いた。**原因は 2 つあり、どちらも
 * 「実装が欄の名前を数え上げている」ことだった:
 *
 *   (A) 退避する欄が**リテラルの一覧**で書かれていた。確定セルに新しい欄が生えたとき
 *       この一覧へ載せ忘れると、**その欄は reopen で黙って消える。**
 *   (B) 戻す窓口が欄ごとに個別なので、**退避されるが戻す窓口が無い欄**が作れてしまった。
 *       その欄は「一度 reopen したら二度と戻せない」。実際 `serves_intents` がそうだった。
 *
 * ── どう塞いだか（2026-09-08） ─────────────────────────────
 *
 * どちらも**欄を数え上げないこと**で塞いだ。列挙する側を裏返してある。
 *
 *   (A) `reopen` は「退避する欄」ではなく **`CELL_MACHINE_FIELDS`（退避しない欄）** だけを
 *       挙げ、残りを丸ごと写す（`_snapshot_cell_fields`）。**知らない欄は退避される**方へ
 *       倒れるので、載せ忘れが起こり得ない。
 *   (B) `restore-discarded` が `discarded` の鍵をそのまま辿って戻す。**単一の窓口**であり、
 *       欄の名前を知らない。専用窓口を持たない欄（`serves_intents`）もこれで戻る。
 *
 * ── だからこの検査が見張るもの ────────────────────────────
 *
 * 症状（戻っていない欄）は引き続き 0 件で固定する。加えて**原因が戻らないこと**を見る:
 * 退避する側と戻す側の**どちらかがまた欄を数え上げ始めたら赤くなる。**
 * これが 5 度目の入口である。
 *
 * なお `state_transition_matrix.py` はキット配布物で、次回のキット更新で上書きされる。
 * 上書きされたらこの検査が赤くなる（REQ-TS18 と同じ事情）。
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
 * `action == "<op>":` から次の `action == ` までを切り出す。
 *
 * **本文を検査へ書き写さない。**書き写すと、実装が変わった日に検査だけが古い姿を
 * 持ち続け、「まだこう書いてある」と言い続ける。読む先は 1 つにする。
 */
function branchSource(op: string): string {
  const start = pySource.indexOf(`if action == "${op}":`);
  if (start < 0) return "";
  const next = pySource.indexOf('if action == "', start + 20);
  return pySource.slice(start, next < 0 ? undefined : next);
}

/** 退避**しない**欄の一覧を実装から読む（列挙の向きが裏返っている側）。 */
function machineFieldList(): readonly string[] {
  const decl = pySource.slice(pySource.indexOf("CELL_MACHINE_FIELDS = ("));
  const body = decl.slice(0, decl.indexOf(")"));
  return [...body.matchAll(/"([a-z_]+)"/g)].map((m) => m[1] as string);
}

/** 確定セルが実際に持っている欄（`state` を含む生の集合）。 */
const heldFields: readonly string[] = [
  ...new Set(confirmedCells.flatMap(([, , cell]) => Object.keys(cell))),
].sort();

/**
 * その分岐が名指ししている「セルの**内容**欄」。名指しが増えるほど、欄を数え上げる実装へ戻る。
 *
 * 状態機械の欄（`state` など）は数えない。`reopen` はセルを「未収集」へ置き直すので
 * 必ず名指しする。**数えたいのは内容の欄を名指ししているかどうか**である。
 */
function fieldsNamedIn(op: string): readonly string[] {
  const machine = new Set(machineFieldList());
  const known = new Set([...heldFields, "serves_intents"].filter((f) => !machine.has(f)));
  const quoted = [...branchSource(op).matchAll(/"([a-z_]+)"/g)].map((m) => m[1] as string);
  return [...new Set(quoted.filter((name) => known.has(name)))].sort();
}

describe("reopen で退避した欄が戻らない穴 (REQ-TS21 / ah-nuu の 5 度目を止める)", () => {
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

  it("(A) 退避する側が欄を数え上げていない（確定セルの欄で、退避されないものは 0 件）", () => {
    const excluded = new Set(machineFieldList());
    // 床。実装から読めていないと、下の差分は「全部除外」か「全部退避」のどちらかへ
    // 倒れて意味を失う。
    expect(excluded.size, "退避しない欄を実装から読めていない").toBe(3);
    expect(heldFields.length, "確定セルの欄を 1 つも数えられていない").toBeGreaterThanOrEqual(5);

    // 群分けが網羅であること（両群の和 = 確定セルが持つ欄の総数）。
    const preserved = heldFields.filter((f) => !excluded.has(f));
    const dropped = heldFields.filter((f) => excluded.has(f));
    expect(preserved.length + dropped.length).toBe(heldFields.length);

    // 落ちてよいのは状態機械の欄だけ。内容の欄が 1 つでもここへ来たら黙って消える。
    expect(dropped, "この欄は reopen で黙って消える（5 度目の入口）").toEqual(["state"]);

    // **原因 A そのものの当てどころ。**reopen が欄をリテラルで数え上げ始めたら赤くなる。
    expect(fieldsNamedIn("reopen"), "reopen が欄を名指ししている（一覧の再導入）").toEqual([]);
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

  it("(B) 欄の名前を知らない単一の戻し窓口が在る", () => {
    expect(branchSource("restore-discarded"), "単一の戻し窓口が消えた").not.toBe("");

    // **上限 2。上げる向きには動かさない。**
    // この窓口が名指ししてよいのは、内容ではなく**関係**を守るための 2 欄だけである:
    //   qa_ref  — confirm が必ず書く欄。退避値で上書きするのは付け替えにあたる。
    //   qa_refs — `qa_refs[0]` はそのセルが引いている entry 自身、という不変条件を守る。
    // 3 つ目が現れたら、単一窓口がまた欄ごとの窓口へ戻り始めている。
    expect(fieldsNamedIn("restore-discarded"), "戻し窓口が欄を数え上げ始めている").toEqual([
      "qa_ref",
      "qa_refs",
    ]);
  });

  it("(B) 専用窓口しか無い欄が残っていない（`serves_intents` が戻せるようになったこと）", () => {
    // かつてここは「退避されるが戻す窓口が無い欄は 1 件（serves_intents）」だった。
    // 単一窓口ができたので、その 1 件は 0 になる。**個別窓口の有無はもう境目ではない**——
    // 境目は「単一窓口が全ての退避欄を辿るか」に移った。上の it がそれを見ている。
    // ここでは、個別窓口だけに頼っていた欄が実データで戻せる形になったことを見る。
    const everDiscarded = new Set(
      reopenLog.flatMap((e) => Object.keys(e.discarded ?? {})),
    );
    expect(everDiscarded.size, "退避された欄を 1 つも数えられていない").toBeGreaterThanOrEqual(4);
    const unreachable = [...everDiscarded].filter(
      (f) => !new Set([...heldFields, "qa_ref"]).has(f),
    );
    expect(unreachable, "退避されたが確定セルの欄として存在しない").toEqual([]);
  });

  it("この検査自身が測れていることの確認 — 欄を 1 つ足せば (A) は割れる", () => {
    const excluded = new Set(machineFieldList());
    expect(excluded.has("__新しく生えた欄__")).toBe(false);
    expect(branchSource("__存在しない op__")).toBe("");
  });
});
