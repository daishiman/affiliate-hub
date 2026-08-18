/**
 * @tier 1
 * @req REQ-IM13
 * @types equivalence, decision-table, mutation
 */
import { describe, expect, it } from "vitest";
import {
  LOOP_KINDS,
  assertGuardrailsIntact,
  assertRecordableDimension,
  findLoopKind,
  type Guardrail,
  type LoopKind,
} from "@/domain/analytics";

/**
 * 記録として残してよいかの判定のうち、**保存先を持ち出さずに測れるぶん**。
 *
 * 保存の道筋そのものは `tests/integration/d1-improvement.test.ts` が
 * 本物の D1 で測っている。ここに置いてあるのは、そちらでは作れない形
 * ——**登録を通っていないループの種類**——を作って当てるため。
 * `registerLoopKind` が外せない約束を自動で付けるので、
 * 登録済みの 6 種からは「約束が欠けた種類」を取り出せない。
 *
 * 抜け道はそこにある。`LoopKind` は素の型なので、
 * **一覧の値を写しただけの形は誰でも書ける**。
 *
 * 規範: docs/spec/03-分析・解析基盤仕様.md §14.4 / §14.5、REQ-IM13
 */

/**
 * 仕様 §14.4 の「外せない約束」5 件。**実装の一覧を読み込まずに書き写してある。**
 * 実装の `UNIVERSAL_GUARDRAILS` を回すと、一覧から 1 件消えた日に
 * この試験も 1 周短くなって緑のまま通る。
 */
const UNIVERSAL_LABELS = [
  "適用は人の承認を通す（見た目だけの変更も含む）",
  "根拠・広告表示・アクセシビリティは調整対象にしない",
  "順位づけの入力に成果や報酬を入れない",
  "必要件数に届くまで差があると言わない",
  "元の設定へいつでも戻せる状態を保つ",
] as const;

/** 登録を通さずに書いた種類。約束は渡された分しか付かない。 */
function handWritten(guardrails: readonly Guardrail[]): LoopKind {
  return {
    key: "hand_written",
    label: "手で書いたループ",
    polarity: "negative",
    readiness: "implemented",
    decisionBasis: "comparison",
    signal: "読了率",
    baseline: "直前の 4 週",
    decisionRule: "下がったら直す",
    interventionTarget: "記事の書き直し",
    approver: "編集の責任者",
    stopConditions: ["3 回続けて効かなければ止める"],
    guardrails,
    blockedBy: null,
    watchedMetrics: ["read_completion_rate"],
  };
}

describe("外せない約束", () => {
  /**
   * この試験は、**塞げていない穴の見張りも兼ねている**。
   *
   * `assertRecordableLoopRun` の中の `assertGuardrailsIntact` 呼び出しは、
   * 呼び出しごと消しても保存の道筋は緑のまま通る。登録済みの 6 種が
   * どれも約束をそろえているので、**あの呼び出しに当たる値が作れない**ためである。
   * 呼び出しの有無を測れるようにするには、約束の欠けた種類を登録できる
   * ようにするしかなく、それは守りたいものを壊す。
   *
   * だから測れないままにして、**測れなくしている前提のほうを見張る**。
   * 6 種のどれかから約束が欠けた日に、この試験が赤くなって知らせる。
   */
  it("登録済みの 6 種は、どれも 5 件そろっている", () => {
    expect(LOOP_KINDS).toHaveLength(6);
    for (const kind of LOOP_KINDS) {
      const labels = kind.guardrails.map((g) => g.label);
      for (const required of UNIVERSAL_LABELS) {
        expect(labels, `${kind.key} に「${required}」が無い`).toContain(required);
      }
      expect(assertGuardrailsIntact(kind).ok).toBe(true);
    }
  });

  it.each(UNIVERSAL_LABELS)("「%s」だけを外した種類は記録に使えない", (dropped) => {
    const kind = handWritten(
      UNIVERSAL_LABELS.filter((l) => l !== dropped).map((label) => ({ label, hard: true })),
    );
    const result = assertGuardrailsIntact(kind);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVARIANT_VIOLATED");
    // どれが欠けているかを言う。「どれかが欠けています」だけだと直せない。
    expect(result.error.message).toContain(dropped);
  });

  it("約束を 1 つも持たない種類は、欠けている 5 件を全部言う", () => {
    const result = assertGuardrailsIntact(handWritten([]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    for (const label of UNIVERSAL_LABELS) {
      expect(result.error.message).toContain(label);
    }
  });

  it("約束の数だけ合わせた別物では通らない（数ではなく中身を見ている）", () => {
    const result = assertGuardrailsIntact(
      handWritten(
        Array.from({ length: UNIVERSAL_LABELS.length }, (_, i) => ({
          label: `それらしい約束 ${i + 1}`,
          hard: true,
        })),
      ),
    );
    expect(result.ok).toBe(false);
  });
});

describe("軸として記録に書いてよいか", () => {
  it("登録済みの軸は通る", () => {
    expect(assertRecordableDimension("section_order").ok).toBe(true);
  });

  it("動くループは 1 種類だけで、それは content_improvement である", () => {
    // 仕様 §14.4「いま動かすのは 1 種類だけ」。増やすときは記録の側も一緒に見る。
    const implemented = LOOP_KINDS.filter(
      (k) => k.readiness === "implemented" && k.decisionBasis === "comparison",
    );
    expect(implemented.map((k) => k.key)).toEqual(["content_improvement"]);
    expect(findLoopKind("content_improvement")?.readiness).toBe("implemented");
  });
});
