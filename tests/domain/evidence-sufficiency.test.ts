/**
 * @tier 1
 * @req REQ-BOPC02
 * @req feat-blog-metrics-rollup
 * @req feat-blog-scoped-admin-console
 * @types equivalence, boundary
 *
 * 「この数字を根拠にしてよいか」の足切り。
 *
 * この判定を純関数として切り出しているのは、**画面と集計の 2 か所で
 * 同じ線を引く**ためである。画面側が独自に線を引くと、ブログの画面と
 * 記事の画面で「示唆を出す・出さない」が食い違う。
 */
import { describe, expect, it } from "vitest";
import { MIN_EVIDENCE_SAMPLES, evidenceVerdict } from "@/domain/analytics/reader-interaction";

/** 件数だけを持つ行を作る。他の列はこの判定に関わらない。 */
function days(...counts: readonly number[]) {
  return counts.map((sampleCount) => ({ sampleCount }));
}

describe("示唆を出してよいかの足切り", () => {
  it("期間ぶんを足し合わせて判定する（1 日ずつでは足りなくても通る）", () => {
    // 10 件の日が 3 つ。1 日単位で見ると全部足りないが、期間では 30 件。
    const verdict = evidenceVerdict(days(10, 10, 10));

    expect(verdict).toEqual({ sufficient: true, sampleCount: 30, reason: null });
  });

  it("ちょうど足切りの値は足りている扱いにする", () => {
    const atLine = evidenceVerdict(days(MIN_EVIDENCE_SAMPLES));
    const belowLine = evidenceVerdict(days(MIN_EVIDENCE_SAMPLES - 1));

    // 境界をどちらに含めるかを固定する。両方を並べて比べるのは、
    // 「常に true を返す」実装をここで落とすため。
    expect([atLine.sufficient, belowLine.sufficient]).toEqual([true, false]);
  });

  it("足りないときは、何件あって何件要るかを理由として返す", () => {
    const verdict = evidenceVerdict(days(4, 3));

    expect(verdict.sufficient).toBe(false);
    expect(verdict.sampleCount).toBe(7);
    // 「足りません」だけでは、あと何件待てばよいかが分からない。
    expect(verdict.reason).toContain("7 件");
    expect(verdict.reason).toContain(`${MIN_EVIDENCE_SAMPLES} 件`);
  });

  it("1 件も無い期間も、足りない側へ倒す", () => {
    expect(evidenceVerdict([]).sufficient).toBe(false);
  });

  it("足切りを呼ぶ側で上げ下げできる（記事と一覧で線を変えられる）", () => {
    const strict = evidenceVerdict(days(50), 100);
    const loose = evidenceVerdict(days(50), 10);

    expect([strict.sufficient, loose.sufficient]).toEqual([false, true]);
  });
});
