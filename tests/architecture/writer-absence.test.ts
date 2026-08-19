/**
 * @tier 1
 * @req REQ-TS16
 * @types equivalence, boundary
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **書き手の側の欠落**を 2 つ固定する。値の中身ではなく、
 * **その値を書いた／書けるはずの経路**を見ている。
 *
 * ── なぜ値ではなく経路を見るか ────────────────────────────────
 *
 * 残課題 78 の ㉑（埋められない欄を手元の値で埋める）と ⑪（器はあるのに渡す側がいない）は、
 * **値を見ても見分けられない。**どちらも「欄が埋まっている」「同じ値が並ぶ」という
 * 同じ見え方をする。見分けは**その欄に別の値を書く経路が何件あるか**である。
 *
 *   - 経路が 1 件以上 → 書き手が居て、選んだ値が間違っている → **㉑。書き手を直す。**
 *   - 経路が 0 件     → 誰も書けない。値は初期化のまま       → **⑪。書き手を作る。**
 *
 * **直し方が正反対である。**間違えると、居ない書き手を直そうとして永久に終わらない。
 *
 * ── A. writer を通っていない痕跡 (`loop_count` > `max_loops`) ──────────
 *
 * `run_chunk`（`state_transition_matrix.py:433-445`）は、ループ前に `loop_count = 0` を
 * 代入し、`processed >= max_loops` で break し、最後に `loop_count = processed` と
 * `max_loops` の両方を書く。**この経路を通る限り `loop_count <= max_loops` は
 * 構造的に成立する。**契約（`spec-state-contract.md` §hearing_progress の意味論）も
 * 「`loop_count` は直近 1 invocation の turn 数。累計ではない」と定めており、
 * writer は `apply-spec-transition.py` だけである。
 *
 * **なのに現状は 7 / 5 である。**つまりこれは「上限が緩い」ではなく、
 * **上限を守る唯一の経路を通らずに state が書かれた**痕跡である。
 * C05 の gaps[7] は「超過した状態の扱いを定義せよ」と読んでいるが、
 * 定義すべきは扱いではなく、**通っていないという事実のほう**である。
 *
 * これは C05 の新規 medium（`recorded_with` の自己申告「`schema_version` を
 * 検査しない writer で書いた」）と**同じ 1 つの欠陥**を、別の経路から見たものである。
 * 効くのは、**申告は消せるが、矛盾した数値は消せない**からである。
 * 申告を消しても 7 / 5 は残り、同じ結論に到達できる。当てどころは `ah-4l5` / 残課題 94。
 *
 * **向きに注意（②の形）**: ここで固定しているのは**違反している状態そのもの**である。
 * 検査したい不変則は `loop_count <= max_loops` だが、それを直接書くと今日から赤で入り、
 * 見張り全体が止まる。代わりに「**いま違反していること**」を緑で固定し、
 * **検査を持つ writer を通して書き直された日に赤くなる**ようにしてある。
 * その日に、この describe を `toBeLessThanOrEqual` へ**反転させて残すこと。消さない。**
 * （不変則そのものを今日から赤で入れる形に変えるべきかは、判断を仰いでいる。
 *   反転は 1 行なので、指示があればそちらへ倒す。）
 *
 * ── B. 書き手が存在しない欄 (`design_applications.applicability`) ────────
 *
 * `applicability` は **70/70 が `applied`** である。採否を記録する欄が、
 * 一度も「不採用」を持ったことがない。**採否を数える門は、この欄を見ているかぎり
 * 構造的に必ず全件採用と答える。壊しようがない緑である。**
 *
 * 経路を数えた（2026-08-19）。schema（`spec-state.schema.json:91`）の enum は
 * `applied | not_applicable` の **2 値**を許し、writer 側の検証集合
 * （`state_transition_matrix.py:16` の `APPLICATION_STATES`）も 2 値を知っている。
 * **にもかかわらず、`not_applicable` を「値として書く」本番コードは 0 件である。**
 * 本番側の登場箇所はすべて「検証する集合の要素」か「エラー文言」で、
 * 実際に書いているのは compiler のテスト用 fixture 1 箇所
 * （`test_compile_spec_doc_knowledge.py:83`）だけである。
 * 値は呼び出し側の turns JSON から来るので、**コードの側に書き手が居ない。**
 *
 * よって (f) は **㉑ ではなく ⑪** である。直すのは記録の正確さではなく、
 * **不採用を判断して書く側を作ること**。同じ理由で (d)（`latest_checked_at` が
 * `confirmed_at` と同値 5/5）も ⑪ である——`latest_checked_at` を
 * `confirmed_at` と違う値で書く経路もコード上 0 件で、
 * 呼び出し側 JSON をそのまま検証して格納するだけの道しかない（確認し直す経路が無い）。
 */

const ROOT = process.cwd();
const state = JSON.parse(
  readFileSync(join(ROOT, "system-spec/spec-state.json"), "utf8"),
) as {
  hearing_progress: { loop_count: number; max_loops: number; complete: boolean };
  qa_log: Array<{ design_applications?: Array<{ applicability: string }> }>;
};

/** `run_chunk` を通っていれば必ず成立する不変則。通っていなければ壊れる。 */
function writerInvariantHolds(p: { loop_count: number; max_loops: number }): boolean {
  return p.loop_count <= p.max_loops;
}

/** 採否の値ごとの件数。`applied` 以外が 1 件でも出れば書き手が現れたことになる。 */
function countApplicability(log: typeof state.qa_log): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const qa of log) {
    for (const a of qa.design_applications ?? []) {
      counts[a.applicability] = (counts[a.applicability] ?? 0) + 1;
    }
  }
  return counts;
}

describe("A. state が writer を通らずに書かれている (塞げていないことの固定)", () => {
  const p = state.hearing_progress;

  it("`loop_count` が `max_loops` を超えている——writer を通れば起きない", () => {
    expect(p.loop_count).toBe(7);
    expect(p.max_loops).toBe(5);
    expect(writerInvariantHolds(p)).toBe(false);
  });

  it("超えたまま `complete: true` になっている（止まった形跡が無い）", () => {
    expect(p.complete).toBe(true);
  });

  /**
   * 不変則の判定が効いていることを、同じ検査の中で示す。
   * これが無いと上の `false` は、**違反しているから false なのか、
   * 判定が何も当たらず常に false なのか**が区別できない。
   */
  it.each([
    { loop_count: 3, max_loops: 5, holds: true },
    { loop_count: 5, max_loops: 5, holds: true }, // 境目は上限そのもの
    { loop_count: 6, max_loops: 5, holds: false },
  ])("loop_count=$loop_count / max_loops=$max_loops は $holds", ({ holds, ...p2 }) => {
    expect(writerInvariantHolds(p2)).toBe(holds);
  });
});

describe("B. 採否の欄に書き手が居ない (塞げていないことの固定)", () => {
  const counts = countApplicability(state.qa_log);

  it("`applicability` は 70 件すべて `applied`——不採用が一度も無い", () => {
    expect(counts).toEqual({ applied: 70 });
  });

  it("schema は 2 値を許している（器の側は不採用を受け取れる）", () => {
    const schema = JSON.parse(
      readFileSync(
        join(ROOT, ".claude/plugins/system-spec-harness/schemas/spec-state.schema.json"),
        "utf8",
      ),
    );
    const enumValues = schema.$defs.designApplication.properties.applicability.enum;
    expect(enumValues).toEqual(["applied", "not_applicable"]);
  });

  /**
   * 数える側が効いていることを示す。`not_applicable` を書く側が現れた日に、
   * 上の `{ applied: 70 }` が赤くなる——**そのとき ⑪ が塞がっている。**
   * 塞がった日に、この describe を「不採用が 1 件以上ある」へ反転させて残すこと。
   */
  it("不採用を 1 件混ぜると数えられる（見つける側が動いている）", () => {
    const withRejection = [
      ...state.qa_log,
      { design_applications: [{ applicability: "not_applicable" }] },
    ];
    expect(countApplicability(withRejection)).toEqual({
      applied: 70,
      not_applicable: 1,
    });
  });
});
