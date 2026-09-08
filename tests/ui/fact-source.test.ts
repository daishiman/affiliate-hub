/**
 * @tier 2
 * @req REQ-QC04, REQ-W07
 * @types equivalence, decision-table
 */
import { describe, expect, it } from "vitest";
import { FACT_LABELS, FACT_TONE_RULES } from "@/domain/authoring";
import { UI_COPY } from "@/presentation/ui/copy";
import { FACT_SOURCES } from "@/presentation/ui/patterns/factuality";

/**
 * 事実の出どころの一覧が、業務側と画面側でずれていないことを見る。
 *
 * 共通UIは業務のきまりを読まない決まりにしてある（読むと使い回せなくなる）。
 * その代わり、同じものを 2 箇所に書くことになる。
 * 片方だけ増えると「画面に出ない種類の事実」が生まれるため、ここで縛る。
 *
 * --- 2026-08-21 に塞いだ穴 ---
 *
 * この節は長らく**一覧どうしを突き合わせるだけ**だった。両方から同じ種類を
 * 消せば短くなった一覧どうしが一致して緑になるし、`FACT_TONE_RULES` は
 * 「その種類の欄があるか」しか見ていなかった。実測すると、
 * `commercial`（販売店提供情報）の語尾を `official`（メーカー公称値）と
 * **まったく同じ内容に差し替えても 2827 件が緑のまま通った**。
 * ブログ層 §10.2 が言う「種類ごとに書き分ける」は、
 * 件数（6）と欄の有無だけで留められていて、**中身が別物であること**を
 * 誰も見ていなかった（`W03` 型）。
 *
 * そこで下の `EXPECTED_FACT_KINDS` は**仕様 §10.2 から手で書き写す**。
 * `FACT_LABELS` から作ってはいけない。作った時点で、
 * 呼び名を書き換えたら期待値も一緒に動く自分照合に戻る。
 */

/**
 * 事実の 6 分類と表示ラベル。ブログ層 §10.2 の並び順どおり。
 * **登録簿から導出しないこと。**
 */
const EXPECTED_FACT_KINDS: readonly (readonly [string, string])[] = [
  ["official", "メーカー公称値"],
  ["measured", "当サイトの測定"],
  ["experience", "テスターの主観"],
  ["inference", "以上から当サイトでは〜と判断"],
  ["external", "利用者レビュー"],
  ["commercial", "販売店提供情報"],
];

describe("事実の出どころ", () => {
  it("画面側の一覧が、業務側の一覧と同じ", () => {
    expect([...FACT_SOURCES].sort()).toEqual(Object.keys(FACT_LABELS).sort());
  });

  it("表示する文言が、業務側の呼び名と同じ", () => {
    for (const source of FACT_SOURCES) {
      expect(UI_COPY.factSource[source], `${source} の呼び名がずれています`).toBe(
        FACT_LABELS[source],
      );
    }
  });

  it("語尾の決まりも、同じ種類に対して用意されている", () => {
    for (const source of FACT_SOURCES) {
      expect(FACT_TONE_RULES[source], `${source} の語尾の決まりがありません`).toBeDefined();
    }
  });

  it("公表値と実測が別の呼び名になっている（同じ見た目で並べない）", () => {
    expect(UI_COPY.factSource.official).not.toBe(UI_COPY.factSource.measured);
  });

  it("6 種類の顔ぶれと呼び名が、仕様 §10.2 のとおり", () => {
    expect(Object.entries(FACT_LABELS)).toEqual(EXPECTED_FACT_KINDS.map((r) => [...r]));
  });

  /**
   * 上は「official と measured の 2 つ」しか見ていない。
   * 残り 4 種類は、どれかを別の種類と同じ呼び名にしても通っていた。
   */
  it("6 つの呼び名が、どれも互いに違う（2 種類が同じ見た目にならない）", () => {
    const labels = Object.values(FACT_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
  });

  /**
   * §10.2 の本題は呼び名ではなく**語尾の書き分け**である。
   * 「欄があるか」ではなく、**中身が種類ごとに別物か**を数える。
   *
   * 見ているのは `allowed`（書いてよい語尾）だけ。`forbidden` は
   * `experience` と `inference` がどちらも「〜です（断定）」を避ける決まりで、
   * **重なっているのが正しい**。そこへ床を置くと、正しい実装が落ちる。
   */
  it("6 種類の「書いてよい語尾」が、互いに重ならない", () => {
    const signatures = FACT_SOURCES.map((s) => [...FACT_TONE_RULES[s].allowed].sort().join("|"));
    for (const [i, mine] of signatures.entries()) {
      for (const [j, other] of signatures.entries()) {
        if (i >= j) continue;
        expect(mine, `${FACT_SOURCES[i]} と ${FACT_SOURCES[j]} の語尾が同じです`).not.toBe(other);
      }
    }
  });
});
