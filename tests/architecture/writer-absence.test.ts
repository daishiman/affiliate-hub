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
 * `run_chunk`（`state_transition_matrix.py:547-588`）は `processed >= max_loops` で break し、
 * 最後に `loop_count` と `max_loops` の両方を書く。**この writer は上限超えを
 * 作り出せない**（書き込む値は必ず `max_loops` 以下から取る）。契約
 * （`spec-state-contract.md` §hearing_progress の意味論）も
 * 「`loop_count` は直近 1 invocation の turn 数。累計ではない」と定めており、
 * writer は `apply-spec-transition.py` だけである。
 *
 * ── 2026-08-20 訂正: 上の一文は以前「`loop_count <= max_loops` は構造的に成立する」
 * と書いてあった。**それは今は偽である。**当時の `run_chunk` は無条件に
 * `loop_count = 0` を代入してから処理済み件数を書いていたため、7 / 5 の記録を持つ
 * state にこの writer を通すと、**下の A が見張っている当の 7 が消えた**——
 * 記録を守るための仕掛けを、記録を書く道具が壊していた。そこで床を
 * `prior if prior > max_loops else 0` に絞り、**超過があるときだけ**既存値を守る形へ
 * 直した（下限を上げる向きの変更）。最初は無条件の `max(prior, processed)` にしたが、
 * それだと通常時の意味まで「これまでの最大値」へ変わり、超過と無関係な golden
 * fixture が動いた——**記録を守るための修正が、別の記録を書き換えていた。**結果、writer は
 * 既存の超過を**保存する**ようになり、「この経路を通れば必ず 5 以下」は成り立たなくなった。
 * 成り立つのは「**この writer が新たな超過を生み出すことはない**」のほうである。
 * A が見ているのは後者ではなく「超過が記名で保存されているか」なので、A の主張は変わらない。
 *
 * なお `system-spec/spec-state.json` の `hearing_progress.limit_overrun.reason` にも
 * 同じ偽になった一文が残っている。**まだ直せていない**（正本を読むだけの測定が
 * 見張りの inline-python 判定に遮断されるため。回避はしない）。下の A は
 * `reason.length` しか見ないので、この矛盾で赤くはならない——**つまりこの訂正コメントが、
 * 今のところ唯一の目印である。**
 *
 * **当時の現状は 7 / 5 だった。**つまりこれは「上限が緩い」ではなく、
 * **上限を守る唯一の経路を通らずに state が書かれた**痕跡である。
 * C05 の gaps[7] は「超過した状態の扱いを定義せよ」と読んでいるが、
 * 定義すべきは扱いではなく、**通っていないという事実のほう**である。
 *
 * これは C05 の新規 medium（`recorded_with` の自己申告「`schema_version` を
 * 検査しない writer で書いた」）と**同じ 1 つの欠陥**を、別の経路から見たものである。
 * 効くのは、**申告は消せるが、矛盾した数値は消せない**からである。
 * 申告を消しても 7 / 5 は残り、同じ結論に到達できる。
 *
 * ── A は反転した（2026-08-20）。B は反転していない ──────────────────
 *
 * A の欠陥は塞がった。schema・writer・網羅性検査を 1.2 まで通したので、
 * 正本は検査を持つ writer から書けるようになった（commit 5534f4c 系列）。
 *
 * **ただし 7 / 5 という数字は残してある。丸めていない。**
 * `toBeLessThanOrEqual` へ反転させれば数は揃うが、揃えるには 7 を 5 へ書き換える
 * しかない。そして書き換えた瞬間、**迂回が起きたという唯一の痕跡が消える。**
 * 直すべきは数ではなく、数が語っている事実を読めるようにすることである。
 * よって A は「数が揃ったこと」ではなく、**超過が記名で保存されていること**へ
 * 反転させた。`max_loops_policy` で上限が厳格だと分かり、`limit_overrun.reason` で
 * なぜ超過が残っているかが分かる。**誰かが黙って 7 を 5 に丸めた日に、ここが赤くなる。**
 *
 * B（採否の欄に書き手が居ない）は**今回の作業で塞いでいない。**元の向きのまま残す。
 * A と B を同じ回に反転させると、片方しか直っていないのに両方直ったように見える。
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
  hearing_progress: {
    loop_count: number;
    max_loops: number;
    complete: boolean;
    max_loops_policy?: string;
    limit_overrun?: { loop_count: number; max_loops: number; reason: string };
  };
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

describe("A. writer を通らずに書かれた痕跡が、記名で保存されている (塞がったことの固定)", () => {
  const p = state.hearing_progress;

  it("超過した数字そのものは丸めずに残っている", () => {
    // 5 へ丸めれば不変則は成立するが、成立させた瞬間に迂回の痕跡が消える。
    // 誰かが「数を揃える」方向へ直した日に、ここが赤くなる。
    expect(p.loop_count).toBe(7);
    expect(p.max_loops).toBe(5);
    expect(writerInvariantHolds(p)).toBe(false);
  });

  it("上限が厳格かソフトかを、state だけを読んで判別できる", () => {
    // 元の欠陥は「7 > 5 が何を意味するか state から読めない」ことだった。
    // max_loops だけが在って性格が書いていないと、5 が目安か絶対かを読む側が推測する。
    expect(p.max_loops_policy).toBe("strict");
  });

  it("超過が無記名で残っていない——なぜ残っているかが書かれている", () => {
    expect(p.limit_overrun, "超過の由来が消えています").toBeDefined();
    expect(p.limit_overrun?.loop_count).toBe(p.loop_count);
    expect(p.limit_overrun?.max_loops).toBe(p.max_loops);
    expect(
      (p.limit_overrun?.reason ?? "").length,
      "超過の理由が空です。無記名の超過は、上限が緩いのか経路が異常なのかを区別できません",
    ).toBeGreaterThan(0);
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

// B は 2026-08-20 時点で塞いでいない。A と違い、向きはそのままである。
describe("B. 採否の欄に書き手が居ない (塞げていないことの固定・未着手)", () => {
  const counts = countApplicability(state.qa_log);

  /**
   * 2026-08-20: 70 → 74。`qa-uiux-web-screen-priority` を追記した際に
   * `design_applications` が 4 件増えた（`applied` のみ）。
   *
   * **これは緩めていない。**この検査の主張は「`not_applicable` が 1 件も無い」であって、
   * 74 は**その 0 件を出した母数**である。母数を据え置くと、欄が増えても数字が合わず、
   * 「0 件」がどれだけの中の 0 件なのかが読めなくなる。緩める形は逆——
   * `not_applicable` を許す側へ動かすことであり、それはしていない。
   */
  it("`applicability` は 74 件すべて `applied`——不採用が一度も無い", () => {
    expect(counts).toEqual({ applied: 74 });
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
   * 上の `{ applied: 74 }` が赤くなる——**そのとき ⑪ が塞がっている。**
   * 塞がった日に、この describe を「不採用が 1 件以上ある」へ反転させて残すこと。
   */
  it("不採用を 1 件混ぜると数えられる（見つける側が動いている）", () => {
    const withRejection = [
      ...state.qa_log,
      { design_applications: [{ applicability: "not_applicable" }] },
    ];
    expect(countApplicability(withRejection)).toEqual({
      applied: 74,
      not_applicable: 1,
    });
  });
});
