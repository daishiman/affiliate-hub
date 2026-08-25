/**
 * @tier 1
 * @req REQ-TS19
 * @types equivalence, boundary
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **確定セルの裏付けが、どの論点なのかを機械が読めること**を固定する。
 *
 * 背景（実物を測って分かったこと）: `qa_ref` は 1 件しか持てない（決定論ゲートが
 * 文字列で照合する）。そのため複数回の質疑の回答本文を 1 entry へ統合して裏付けの
 * 範囲を保つ運用になっており、C05 は「どの論点がどのセルの裏付けか読めない」を
 * gap として挙げた。
 *
 * ── 評価者の gap 文面は、実物と 2 箇所で違っていた ──────────────
 *
 * C05 は対象を「6 entry」と書いたが実物は **7 件**（`uiux` が抜けていた）。
 * 直接原因を「schema の単一 `qa_ref` 制約」と書いたが、**schema に `qa_ref` は
 * 0 件**で、制約は validator・writer・契約散文の側にあった。
 * **評価者が挙げた原因が、実物と違う場所を指していた。**指示どおり着手すると、
 * 存在しない制約を探すことになる。**私たちの検査は自分の主張を実物で裏取りする
 * 規律を持っているが、評価レポートの側にはその門が無い。**
 *
 * ── 「やってあること」が、やってあると読めない形で置かれていた ────
 *
 * さらに大きい発見がある。gap が求めた「回答本文の統合」は**既に実行済み**で、
 * 対象 entry の本文には節ごとの元 qa id と出典がすでに書かれていた。
 * 足りなかったのは**それを機械が読める形にすること**だけである。
 * **やってあることが、やってあると読めない形で置かれていると、次の人は同じ作業を
 * 最初からやり直す。**この検査は、その「読める形」の側を固定する。
 *
 * ── 母集団の床を同じ `it()` に置く理由（REQ-TS17 の形）────────────
 *
 * 「全部の確定セルが被覆されている」は、**確定セルが 0 件でも成立する。**
 * 被覆漏れ 0 件は、良くなったときと、数える対象が消えたときの両方で出る。
 * よって確定セルの件数そのものを同じ `it()` で 8 に固定する。
 * この 8 は 48 セル（8 カテゴリ × 6 プラットフォーム）のうち
 * 確定 8 / 対象外 40 / 未収集 0 の実測から来ている。
 *
 * ── 壊して両方向を確認した（2026-08-20）──────────────────────
 *
 * ① 注記を 1 件外す → 被覆側が赤（`qa-auth-web` の topic を消して確認）
 * ② 確定セルを 1 件増やす → 床の側が赤（`expected 9 to be 8`）
 * どちらか片方だけでは、もう片方の壊れ方を捕まえられない。
 */

const ROOT = join(import.meta.dirname, "..", "..");
const SPEC_STATE = join(ROOT, "system-spec", "spec-state.json");

type Topic = {
  topic_id: string;
  covers_cell: { category: string; platform: string } | null;
  answer_span: string;
  note: string;
  origin_qa_id: string | null;
};
type ScopeNotes = {
  bundled: boolean;
  topics: Topic[];
  recorded_with: string;
  bundling_reason?: string;
  split_with?: string;
  split_on?: string;
  absorbed_origins_released?: string[];
  reanchored_with?: string;
  reanchored_on?: string;
};
type QaEntry = {
  id: string;
  question: string;
  answer: string;
  scope_notes?: ScopeNotes;
};
type Cell = { state: string; qa_ref?: string; qa_refs?: string[] };

function readState(): {
  matrix: Record<string, Record<string, Cell>>;
  qa_log: QaEntry[];
} {
  return JSON.parse(readFileSync(SPEC_STATE, "utf8"));
}

function confirmedCells(matrix: Record<string, Record<string, Cell>>) {
  const out: { category: string; platform: string; qaRef: string; qaRefs: string[] }[] = [];
  for (const [category, row] of Object.entries(matrix)) {
    for (const [platform, cell] of Object.entries(row)) {
      if (cell.state === "確定") {
        // `qa_refs` が無いセルは束ねが要らなかったセル。`qa_ref` 1 件に落とす。
        out.push({
          category,
          platform,
          qaRef: cell.qa_ref ?? "",
          qaRefs: cell.qa_refs ?? (cell.qa_ref ? [cell.qa_ref] : []),
        });
      }
    }
  }
  return out.sort((a, b) => `${a.category}/${a.platform}`.localeCompare(`${b.category}/${b.platform}`));
}

/**
 * 逐語 span が解決しない論点を挙げる。**指し先は `origin_qa_id` の entry の本文**。
 *
 * 2026-08-20 まではこの関数の役目を「注記を持つ entry 自身の本文」に対して行っていた。
 * 束ねていた頃は span が束ね本文の `### 見出し` 行だったので、それで解決した。
 * 束ねを解くと見出しごと消えるので、18 論点中 16 件が 0 箇所になった（2026-08-21 実測）。
 * **節の中身は origin entry へ byte 一致のまま在る**ので、鎖を切らずに指す先を移せる。
 * 規則は 1 本になった——*span は `origin_qa_id` の本文に逐語で 1 箇所在る*。
 * 束ねていない entry（origin が自分自身）も同じ規則で通るので、分岐は要らない。
 */
function collectBrokenSpans(entries: QaEntry[], byId: Map<string, QaEntry>): string[] {
  const broken: string[] = [];
  for (const entry of entries) {
    const notes = entry.scope_notes!;
    if (notes.recorded_with !== "set-qa-scope-notes") {
      broken.push(`${entry.id}: recorded_with=${notes.recorded_with}`);
    }
    for (const topic of notes.topics) {
      const origin = topic.origin_qa_id ? byId.get(topic.origin_qa_id) : undefined;
      if (!origin) {
        broken.push(`${entry.id}/${topic.topic_id}: origin_qa_id=${topic.origin_qa_id} が qa_log に無い`);
        continue;
      }
      const occurrences = origin.answer.split(topic.answer_span).length - 1;
      if (occurrences !== 1) {
        broken.push(
          `${entry.id}/${topic.topic_id}: span が ${occurrences} 箇所（origin=${origin.id}）`,
        );
      }
    }
  }
  return broken;
}

/** 確定セルの件数。48 セル中 確定 8 / 対象外 40 / 未収集 0（2026-08-20 実測）。 */
const CONFIRMED_CELL_COUNT = 8;
/** 走査母集団の下限。qa_log は 30 件（同日実測）。減る方向は正本の縮小を意味する。 */
const QA_LOG_MIN = 30;
/**
 * 確定セルから指されていない「束ねた entry」の上限。2026-08-20 実測 1、遊び 0。
 * 中身は `qa-uiux-web-spec-intake` で、R4-reopen により ui-ux×web の `qa_ref` が
 * `qa-uiux-web-screen-priority` へ移った結果、指す者を失った。
 * **指されていないものは注記されず、注記されないものは見えなくなる。**
 * だから件数のほうを見張る。**この上限は下げる方向にしか動かさない。**
 */
const UNREFERENCED_BUNDLED_CAP = 1;
/** 束ね解除を通った entry の下限。2026-08-21 実測 6。減る方向は記録の消失を意味する。 */
const SPLIT_ENTRY_MIN = 6;
/**
 * 取り込み元へ戻した論点の下限。2026-08-21 実測 **10**
 * （backend 2 / database 2 / infra 2 / security 1 / frontend 2 / ops 1）。
 * **上げる方向にしか動かさない。**
 */
const RELEASED_ORIGIN_MIN = 10;
/**
 * 本文に `### ` 節を 2 つ以上持つ entry の上限。2026-08-21 実測 2、遊び 0。
 * 中身は `qa-uiux-web-spec-intake`（指す者を失った旧束ね）と
 * `qa-uiux-web-screen-priority`（節見出しで区切った 1 論点の逐語記録）。
 * **束ねが戻れば増える。上限は下げる方向にしか動かさない。**
 */
const MULTI_SECTION_CAP = 2;

describe("確定セルの裏付け範囲は機械が読める", () => {
  it("確定 8 セルそれぞれに、その論点を名乗る注記がある（母集団の床を同居させる）", () => {
    const { matrix, qa_log } = readState();
    const cells = confirmedCells(matrix);

    // 床: 被覆漏れ 0 件は、確定セルが消えたときにも出る。件数を先に固定する。
    // **2 行あるのは重複ではない。**`toBe` は人には床に見えるが、
    // `form2-population-floor.test.ts` の走査は `.length` への `toBeGreaterThan` 系
    // しか床と認めないため、機械からは床なしに見えていた（実測: 床なし 25 > 上限 24）。
    // 上限を上げずに、**機械から見える形の床を同じ `it()` へ足した**。
    // これは残課題 78 が「測り方の限界」として書いている当のものである。
    expect(cells.length).toBeGreaterThanOrEqual(CONFIRMED_CELL_COUNT);
    expect(cells.length).toBe(CONFIRMED_CELL_COUNT);

    const byId = new Map(qa_log.map((entry) => [entry.id, entry]));
    const uncovered = cells.filter((cell) => {
      const entry = byId.get(cell.qaRef);
      const topics = entry?.scope_notes?.topics ?? [];
      return !topics.some(
        (topic) =>
          topic.covers_cell?.category === cell.category &&
          topic.covers_cell?.platform === cell.platform,
      );
    });
    expect(uncovered).toStrictEqual([]);
  });

  it("注記は正規 writer を通っており、逐語 span が origin の本文に 1 箇所だけある", () => {
    const { matrix, qa_log } = readState();
    expect(qa_log.length).toBeGreaterThanOrEqual(QA_LOG_MIN);

    const annotated = qa_log.filter((entry) => entry.scope_notes);
    // 床: 注記が 1 件も無ければ、下の検証はすべて空回りで緑になる。
    expect(annotated.length).toBeGreaterThanOrEqual(CONFIRMED_CELL_COUNT);

    // ここは 2026-08-25 まで `toBe(CONFIRMED_CELL_COUNT)` だった。**等式は成り立たなく
    // なった。**確定セルへ新しい問答で裏付けを足せるようになり（`extend-qa-refs`）、
    // 1 セルが複数の注記付き entry を引くようになったためである。実測 8 → 10。
    //
    // **等式を外すのは緩めることなので、外した先を空にしない。**等式が塞いでいたのは
    // 「どこからも引かれない注記が増えること」であって、件数そのものではない。
    // そこで床（上の 1 行）と対にして、**孤立した注記を 0 に保つ**側へ向きを変える。
    // 数が増える道は開くが、指す者の無い注記を書く道は閉じたままである。
    const cited = new Set(
      confirmedCells(matrix).flatMap((cell) => [cell.qaRef, ...(cell.qaRefs ?? [])]),
    );
    const orphans = annotated.map((entry) => entry.id).filter((id) => !cited.has(id));
    expect(orphans).toStrictEqual([]);

    const byId = new Map(qa_log.map((entry) => [entry.id, entry]));
    const broken = collectBrokenSpans(annotated, byId);
    expect(broken).toStrictEqual([]);

    // 0 件は「良くなった」ときと「見つける側が壊れた」ときの両方で出る。
    // 合成例を同じ `it()` で通し、検出側が動いていることを示す（残課題 78 ⑳）。
    const decoy: QaEntry = {
      id: "decoy",
      question: "",
      answer: "本文",
      scope_notes: {
        bundled: false,
        recorded_with: "set-qa-scope-notes",
        topics: [
          {
            topic_id: "decoy-topic",
            covers_cell: null,
            answer_span: "この文字列は本文に無い",
            note: "",
            origin_qa_id: "decoy",
          },
        ],
      },
    };
    expect(collectBrokenSpans([decoy], new Map([["decoy", decoy]]))).toStrictEqual([
      "decoy/decoy-topic: span が 0 箇所（origin=decoy）",
    ]);
  });

  it("束ねは解消済みで、解消の記録が残っている（②→⑤ の反転: 戻った日に赤くなる）", () => {
    const { qa_log } = readState();

    // ── ここは向きが反転している ────────────────────────────────
    // 2026-08-20 まで、この `it()` は「束ねはまだ解消していない」を固定していた
    // （`bundled.length >= 6`）。塞げない穴を検査として書く形（残課題 78 ②）である。
    // 2026-08-21 に qa_refs[] が入って束ねが解け、その検査は赤くなって役目を終えた。
    // **消さずに向きを反転させる**（⑤）。消すと、束ねが戻っても誰も気づかない。
    expect(qa_log.filter((entry) => entry.scope_notes?.bundled).length).toBe(0);

    // 解消の記録を持つ entry。**理由の文面は解消後も消さずに残す**
    // （なぜ束ねが起きたかが消えると、同じ迂回がまた起きる）。
    const split = qa_log.filter((entry) => entry.scope_notes?.split_with);
    // 床: 解消済みが 0 件なら、下の検証は空回りする。2026-08-21 実測 6。
    expect(split.length).toBeGreaterThanOrEqual(SPLIT_ENTRY_MIN);

    const withoutReason = split
      .filter((entry) => !entry.scope_notes?.bundling_reason?.trim())
      .map((entry) => entry.id);
    expect(withoutReason).toStrictEqual([]);

    // 束ねが**在った**事実そのものを、注記の文面が言っていること。
    const silent = split
      .filter((entry) => !entry.scope_notes!.bundling_reason!.includes("束ね"))
      .map((entry) => entry.id);
    expect(silent).toStrictEqual([]);

    // 外した節は、戻した先が書いてあること（追記の記録であって参照ではない）。
    const unreleased = split
      .filter((entry) => (entry.scope_notes!.absorbed_origins_released ?? []).length === 0)
      .map((entry) => entry.id);
    expect(unreleased).toStrictEqual([]);
  });

  it("戻した論点は確定セルの qa_refs[] から引けている（指されないものは見えなくなる）", () => {
    const { matrix, qa_log } = readState();
    expect(qa_log.length).toBeGreaterThanOrEqual(QA_LOG_MIN);

    // ── ここも反転している ──────────────────────────────────────
    // 旧: 「束ねた entry のうち、確定セルから指されていないものは 1 件以下」。
    // 束ねを解いた今、危ないのは逆側である——**本文を戻した先の entry を、
    // どのセルも引かなくなること**。戻した瞬間に見えなくなっては、解いた意味が無い。
    const cells = confirmedCells(matrix);
    const reachable = new Set(cells.flatMap((cell) => cell.qaRefs));
    const stranded: string[] = [];
    for (const entry of qa_log) {
      for (const origin of entry.scope_notes?.absorbed_origins_released ?? []) {
        if (!reachable.has(origin)) stranded.push(`${entry.id} → ${origin}`);
      }
    }
    // 床: 戻した論点が 0 件なら上は空回りする。2026-08-21 実測 10 件。
    const releasedCount = qa_log.reduce(
      (sum, entry) => sum + (entry.scope_notes?.absorbed_origins_released ?? []).length,
      0,
    );
    expect(releasedCount).toBeGreaterThanOrEqual(RELEASED_ORIGIN_MIN);
    expect(stranded).toStrictEqual([]);

    // 束ねが戻っていないことを、本文の形からも見る（読んで判断しない）。
    // **これは上限で、下げる方向にしか動かさない。**2026-08-21 実測 2、遊び 0。
    const multiSection = qa_log
      .filter((entry) => (entry.answer.match(/^### /gm) ?? []).length >= 2)
      .map((entry) => entry.id);
    expect(multiSection.length).toBeLessThanOrEqual(MULTI_SECTION_CAP);

    const referenced = new Set(cells.map((cell) => cell.qaRef));
    const unreferenced = multiSection.filter((id) => !referenced.has(id));
    expect(unreferenced.length).toBeLessThanOrEqual(UNREFERENCED_BUNDLED_CAP);
  });
});
