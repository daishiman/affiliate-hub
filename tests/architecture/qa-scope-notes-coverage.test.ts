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
};
type QaEntry = {
  id: string;
  question: string;
  answer: string;
  scope_notes?: ScopeNotes;
};
type Cell = { state: string; qa_ref?: string };

function readState(): {
  matrix: Record<string, Record<string, Cell>>;
  qa_log: QaEntry[];
} {
  return JSON.parse(readFileSync(SPEC_STATE, "utf8"));
}

function confirmedCells(matrix: Record<string, Record<string, Cell>>) {
  const out: { category: string; platform: string; qaRef: string }[] = [];
  for (const [category, row] of Object.entries(matrix)) {
    for (const [platform, cell] of Object.entries(row)) {
      if (cell.state === "確定") {
        out.push({ category, platform, qaRef: cell.qa_ref ?? "" });
      }
    }
  }
  return out.sort((a, b) => `${a.category}/${a.platform}`.localeCompare(`${b.category}/${b.platform}`));
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

  it("注記は正規 writer を通っており、逐語 span が本文に 1 箇所だけある", () => {
    const { qa_log } = readState();
    expect(qa_log.length).toBeGreaterThanOrEqual(QA_LOG_MIN);

    const annotated = qa_log.filter((entry) => entry.scope_notes);
    // 床: 注記が 1 件も無ければ、下の検証はすべて空回りで緑になる。
    expect(annotated.length).toBe(CONFIRMED_CELL_COUNT);

    const broken: string[] = [];
    for (const entry of annotated) {
      const notes = entry.scope_notes!;
      if (notes.recorded_with !== "set-qa-scope-notes") {
        broken.push(`${entry.id}: recorded_with=${notes.recorded_with}`);
      }
      for (const topic of notes.topics) {
        const occurrences = entry.answer.split(topic.answer_span).length - 1;
        if (occurrences !== 1) {
          broken.push(`${entry.id}/${topic.topic_id}: span が ${occurrences} 箇所`);
        }
      }
    }
    expect(broken).toStrictEqual([]);
  });

  it("注記を足しても束ねは解消していない（bundled=true の entry は理由を欄に持つ）", () => {
    const { qa_log } = readState();
    const bundled = qa_log.filter((entry) => entry.scope_notes?.bundled);
    // 床: 束ねた entry が 0 件になったら、この検査は空回りする。
    expect(bundled.length).toBeGreaterThanOrEqual(6);

    const withoutReason = bundled
      .filter((entry) => !entry.scope_notes?.bundling_reason?.trim())
      .map((entry) => entry.id);
    expect(withoutReason).toStrictEqual([]);

    // 束ねが残っている事実そのものを、注記の文面が言っていること。
    const silent = bundled
      .filter((entry) => !entry.scope_notes!.bundling_reason!.includes("束ね"))
      .map((entry) => entry.id);
    expect(silent).toStrictEqual([]);
  });

  it("確定セルから指されていない束ね entry は 1 件以下（指されないものは見えなくなる）", () => {
    const { matrix, qa_log } = readState();
    expect(qa_log.length).toBeGreaterThanOrEqual(QA_LOG_MIN);

    const referenced = new Set(confirmedCells(matrix).map((cell) => cell.qaRef));
    // 「束ねた entry」の見分けは本文の節見出しの数で行う（読んで判断しない）。
    const bundledIds = qa_log
      .filter((entry) => (entry.answer.match(/^### /gm) ?? []).length >= 2)
      .map((entry) => entry.id);
    // 床: 束ねた entry を 1 件も見つけられていないなら、下の 0 件は測れていない。
    expect(bundledIds.length).toBeGreaterThanOrEqual(6);

    const unreferenced = bundledIds.filter((id) => !referenced.has(id));
    expect(unreferenced.length).toBeLessThanOrEqual(UNREFERENCED_BUNDLED_CAP);
  });
});
