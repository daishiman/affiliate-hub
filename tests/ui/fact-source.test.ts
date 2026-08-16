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
 */

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
});
