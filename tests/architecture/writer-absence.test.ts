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
 * 同じ偽になった一文が残っていた。**2026-08-20 に直した。**塞ぎ方が要点である:
 * 最初は inline python で書こうとして見張りに遮断され、そこで止めた。回避はしなかった。
 * あとから `apply-spec-transition.py set-hearing-policy --overrun`(reason 必須) という
 * **正規の書き手が在る**ことが分かり、それを通した。差分は `reason` と `recorded_at` の
 * 2 行だけで、7 / 5 の値は writer が現在値を写すため動いていない。
 * **塞げない穴だと思っていたものが、道具を探していなかっただけだった。**
 * 「手で書くのを禁じたルールが、正規の書き手まで止めていた」——`loop_count` のときと
 * 同じ形で、答えは道具を通すことだった。
 *
 * 下の A は `reason.length` しか見ないので、**本文が偽に戻っても赤くならない。**
 * 訂正した今も、正しさを見張っているのはこのコメントだけである。
 * 反転先: 本文の主張を機械で照合できるようになった日（例えば `reason` が
 * writer の版と結び付いた日）に、A へ「本文が現行 writer の挙動と矛盾しないこと」を
 * 足す。それまでは長さしか見ていないことを、緑を根拠に忘れないこと。
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
 * ── A は 2 度目の反転をした（2026-08-21）──────────────────────────
 *
 * 上の 2 行が予告していた赤が、実際に出た。**ただし丸めたからではない。**
 * 7 は writer 経由では動かない値だった（実測: `run_chunk` に 0 turns を渡しても
 * 3 turns を渡しても 7 のまま。prior=2 の対照は 0 になったので、床の仕掛け自体は
 * 生きている）。残る道は `init_state` で `loop_count: 0` を書き直すことだけで、
 * それは**ヒアリングを通し直す**という意味になる。利用者がその道を選んだ。
 *
 * 通し直しの前に穴が 1 つ見つかった。`reopen` は退避一覧へ `qa_refs` を入れて
 * おらず、`qa_refs` を書ける writer は `split-qa-bundle` だけで、それは
 * `bundled=true` を要求する。つまり **reopen を通ると 6 セルの裏付けの範囲が
 * 二度と戻せなかった**（実測: 確定 8 / うち qa_refs 6 / reopen 後の退避 0 /
 * `split-qa-bundle` 再実行は 6 件とも拒否）。先に退避一覧へ `qa_refs` を足し、
 * **退避された値からだけ書き戻す** `restore-qa-refs` を作ってから通した。
 *
 * 結果 `loop_count` は 3 になった。**これは丸めた 5 ではなく、writer が最後の
 * invocation の turn 数として書いた値である。**48 セルは通し直しの前後で
 * 完全一致した（`checked_on` だけが当日へ動く。writer が日付を自分で付けるため）。
 *
 * よって A は「超過が記名で保存されている」から**「不変則が writer 由来で成立し、
 * そこへ至った経路が記名で残っている」**へ反転させた。**上限だけでは足りない。**
 * `loop_count <= max_loops` は 7 を 5 へ書き換えても満たせる——元のコメントが
 * 名指しで警告していた迂回そのものである。そこで向きが逆の床
 * (`REDO_TRACE_MIN`) と対にした。数を丸める道では床に当たり、通し直す道でしか
 * 両方を満たせない。**逆向きであることが仕掛けの本体である。**
 *
 * **⑤ 次の反転先**: `limit_overrun` が再び現れた日（= 超過がまた起きた日）、
 * 床の側は役目を終える。そのとき消さず、「超過が在るなら `limit_overrun` に
 * 由来が在り、その由来が現行 writer の挙動と矛盾しない」へ反転させる。
 * 痕跡の在り処が `reopen_log` から `limit_overrun` へ戻るだけで、
 * 「無記名の超過を作らせない」という主張は変わらない。
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

/**
 * 同一性キーに使う全 5 欄を型にも書く。**`as any` で黙らせない**——
 * 欄名を綴り間違えると `undefined` が混ざり、別物が同じ種類に見える。
 * 欄の一覧は writer の `_application_key` と同じで、片方だけ増えれば型検査が知らせる。
 */
type DesignApplication = {
  applicability: string;
  knowledge_ref?: string;
  principle?: string;
  rationale?: string;
  tradeoffs?: string[];
};

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
  qa_log: Array<{ design_applications?: DesignApplication[] }>;
  reopen_log: Array<{ reason?: string; discarded?: Record<string, unknown> }>;
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

/**
 * 通し直しの痕跡の**下限**。2026-08-21 実測 **8**
 * （`python3 3.11.4` / 単位は `reopen_log` entry / 分母は `reopen_log` 全 45 件 /
 * 基点は通し直し前の 37 件）。**上げる方向にしか動かさない。**
 *
 * **この床が上の不変則と対になっている。**不変則だけなら、7 を 5 へ書き換えても
 * 満たせる——それは元のコメントが名指しで警告していた迂回そのものである。
 * 床が在ると、不変則を満たすには「通し直した記録が 8 件在る」ことも要る。
 * 数を丸める道では床に当たり、通し直す道でしか両方を満たせない。
 */
const REDO_TRACE_MIN = 8;

/** 通し直しで reopen された記録。`reason` の名乗りで数える。 */
function redoTrace(log: Array<{ reason?: string; discarded?: Record<string, unknown> }>) {
  return log.filter((entry) => (entry.reason ?? "").includes("通し直す"));
}

describe("A. 上限の不変則が writer 由来で成立し、そこへ至った経路が記名で残っている", () => {
  const p = state.hearing_progress;

  it("writer の不変則が成立している", () => {
    // **2026-08-21 に反転した。**以前ここは「7 / 5 のまま残っている」を固定していた。
    // 塞ぎ方は「数を丸める」ではなく「ヒアリングを通し直す」だったので、
    // 3 は writer (`run_chunk`) が最後の invocation の turn 数として書いた値である。
    expect(writerInvariantHolds(p)).toBe(true);
    expect(p.loop_count).toBeLessThanOrEqual(p.max_loops);
  });

  it("上限が厳格かソフトかを、state だけを読んで判別できる", () => {
    // 元の欠陥は「7 > 5 が何を意味するか state から読めない」ことだった。
    // max_loops だけが在って性格が書いていないと、5 が目安か絶対かを読む側が推測する。
    // **不変則が成立した今も消さない。**超過が無いことと、上限の性格が書いてあることは別である。
    expect(p.max_loops_policy).toBe("strict");
  });

  it("超過の記録が消えているなら、消えた理由が記名で残っている", () => {
    // **これが床の側。**`limit_overrun` が無いことは、
    //   (a) 通し直して超過が実際に無くなった / (b) 誰かが記録ごと消した
    // の 2 通りで作れる。区別は「通し直した痕跡が在るか」でしか付かない。
    if (p.limit_overrun !== undefined) return; // 超過が在るなら由来は limit_overrun 側に在る
    const trace = redoTrace(state.reopen_log);
    expect(
      trace.length,
      "超過の記録が消えているのに、通し直した痕跡が reopen_log に在りません",
    ).toBeGreaterThanOrEqual(REDO_TRACE_MIN);
  });

  it("通し直しで捨てた記録は、捨てずに退避されている", () => {
    // 通し直しは確定セルを一度崩す。崩したときに何が載っていたかが残っていなければ、
    // 「通し直した」は「作り直した」と区別が付かない。
    const trace = redoTrace(state.reopen_log);
    const withRefs = trace.filter((entry) => (entry.discarded ?? {}).qa_refs !== undefined);
    expect(withRefs.length, "qa_refs を退避した記録が減っています").toBeGreaterThanOrEqual(6);
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

  /**
   * 床の側の数え方が効いていることを示す。**8 件という数は、数える側が
   * 何も当たらなくても 0 として出る**ので、当たる例と当たらない例を並べる。
   */
  it("通し直しの痕跡を数える側が、両方向に動いている", () => {
    expect(redoTrace([{ reason: "ヒアリングを通し直す (2026-08-21)" }])).toHaveLength(1);
    // 通し直し以外の reopen は数えない——数えると、無関係な reopen で床を満たせる
    expect(redoTrace([{ reason: "回答が古くなったので聞き直す" }])).toHaveLength(0);
    expect(redoTrace([{}])).toHaveLength(0);
  });
});

// B は 2026-08-20 時点で塞いでいない。A と違い、向きはそのままである。
describe("B. 採否の欄に書き手が居ない (塞げていないことの固定・未着手)", () => {
  const counts = countApplicability(state.qa_log);

  /**
   * 2026-08-20: 70 → 74。`qa-uiux-web-screen-priority` を追記した際に
   * `design_applications` が 4 件増えた（`applied` のみ）。
   *
   * 2026-08-21: 74 → **52**。束ね解除（`split-qa-bundle`）が、束ね entry が
   * 取り込み元と重複して抱えていた写しを外した。
   *
   * **数が減ったのに緩めていない、と言うには裏取りが要る。**減り方には
   * 「写しが消えた」と「中身が消えた」の 2 通りが在り、総数だけでは区別できない。
   * 実測（`node`、単位は design_application、対象は `qa_log[].design_applications`、
   * 基点は merge 前の `HEAD^1:system-spec/spec-state.json`）:
   *   総数 74 → 52 ／ **種類 50 → 50** ／ **完全に消えた種類 0**
   * 同一性キーは writer と同じ全 5 欄
   * (knowledge_ref, principle, applicability, rationale, tradeoffs)。
   * つまり減ったのは重複の写しだけである。
   *
   * この検査の主張は「`not_applicable` が 1 件も無い」であって、52 は**その 0 件を
   * 出した母数**である。緩める形は逆——`not_applicable` を許す側へ動かすこと。
   *
   * 2026-08-25: 60 → **64**。本番 D1 スキーマ変更の自動化を利用者へ往復ヒアリング
   * した 2 entry（`qa-infra-web-migration-guard` / `qa-ops-web-migration-guard`）が
   * 設計適用を 2 件ずつ持って入った。**増分 4 件はすべて `applied`**——
   * つまり ⑪ は塞がっていない。母数が増えたぶん、0 件であることの意味は強くなる。
   */
  it("`applicability` は 64 件すべて `applied`——不採用が一度も無い", () => {
    expect(counts).toEqual({ applied: 64 });
  });

  /**
   * 総数は**重複を消しても減る**ので、母数の床としては弱い。
   * 中身が失われる方向だけを捕まえる軸を別に置く——**種類の数**である。
   * 種類が減るのは、写しの整理では起きず、記録が消えたときだけ起きる。
   * **この下限は上げる方向にしか動かさない。**2026-08-21 実測 50。
   */
  it("設計適用の種類は 50 を下回らない（写しの整理と記録の消失を分ける）", () => {
    const kinds = new Set(
      state.qa_log.flatMap((qa) =>
        (qa.design_applications ?? []).map((a) =>
          JSON.stringify([
            a.knowledge_ref,
            a.principle,
            a.applicability,
            a.rationale,
            a.tradeoffs ?? [],
          ]),
        ),
      ),
    );
    expect(kinds.size).toBeGreaterThanOrEqual(50);
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
   * 上の `{ applied: 64 }` が赤くなる——**そのとき ⑪ が塞がっている。**
   * 塞がった日に、この describe を「不採用が 1 件以上ある」へ反転させて残すこと。
   */
  it("不採用を 1 件混ぜると数えられる（見つける側が動いている）", () => {
    const withRejection = [
      ...state.qa_log,
      { design_applications: [{ applicability: "not_applicable" }] },
    ];
    expect(countApplicability(withRejection)).toEqual({
      applied: 64,
      not_applicable: 1,
    });
  });
});
