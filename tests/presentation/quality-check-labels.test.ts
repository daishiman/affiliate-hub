/**
 * @tier 1
 * @req REQ-P06
 *
 * REQ-P06（AI Content Studio の「自動品質確認」）に結んである。検査の種類そのものは
 * REQ-QC02〜QC10 に散っているが、**24 件が漏れなく編集者向けの言葉を持っているか**は
 * 個々の検査の要件ではなく、確認一式を画面へ出す側の要件である。
 * 1 件ごとに結ぶと、種類が増えたときにこの行だけ古くなる。
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  QUALITY_CHECK_LABEL,
  qualityCheckLabel,
} from "@/presentation/admin/quality-check-labels";

/**
 * 自動確認の結果を、編集者が読める言葉で出しているか。
 *
 * --- なぜこれが要るのか ---
 * `docs/product/traceability.md` L 節は「いずれの検査結果も
 * `/admin/content/[variant]` に表示される（止めた件数・**理由**・
 * 検査していない項目とその理由）」と書いている。**この文を見る検査は無かった。**
 *
 * 2026-08-21 に実測: 検査の種類は 24 件あるのに、画面の言い換え表は 17 件しか
 * 持っていなかった。残り 7 件（QC-02/03/04/08/09/10/14）は `?? issue.check` の
 * 逃げ道を通って `vague_heading` `paragraph_shape` のまま画面に出ていた。
 * `vague_heading` と `conversation_flow` は「確認しなかった項目」の見出しにも並ぶ。
 * 出ていること自体は本当なので、画面を見ても「表示されている」と読めてしまう。
 *
 * 型（`Record<QualityCheckId, string>`）が第一の見張りで、ここは第二の見張り。
 * 型注釈を `Record<string, string>` へ緩めた日に、ここが落ちる。
 */
const ROOT = resolve(import.meta.dirname, "../..");

/** 仕様側（`QualityCheckId`）の 24 件。**手で書き写す。**実装から作らない。 */
const SPEC_CHECKS = [
  "unsourced_number",
  "stale_price",
  "fabricated_experience",
  "nonexistent_feature",
  "exaggeration",
  "prohibited_phrase",
  "disclosure_present",
  "link_present",
  "length_fit",
  "hashtag_fit",
  "channel_fit",
  "duplicate_text",
  "brand_fit",
  "audience_fit",
  "cta_overuse",
  "missing_drawback",
  "missing_citation",
  "conversation_flow",
  "paragraph_shape",
  "sentence_length",
  "vague_heading",
  "unit_missing",
  "conclusion_mismatch",
  "relative_date",
] as const;

describe("自動確認の結果の見せ方", () => {
  it("検査の種類すべてに、編集者向けの言葉がある", () => {
    expect([...Object.keys(QUALITY_CHECK_LABEL)].sort()).toEqual([...SPEC_CHECKS].sort());
  });

  it("言い換えが識別子の写しになっていない", () => {
    // `paragraph_shape: "paragraph_shape"` で埋めれば上の検査は通る。
    // 出す言葉は日本語で、識別子とも違うものにする。
    for (const [check, label] of Object.entries(QUALITY_CHECK_LABEL)) {
      expect(label, `${check} の言葉が空です`).not.toBe("");
      expect(label, `${check} が識別子のまま出ます`).not.toBe(check);
      expect(/[ぁ-んァ-ヶ一-龠]/.test(label), `${check} の言葉が日本語ではありません`).toBe(true);
    }
  });

  it("知らない識別子でも、空欄にはせずそのまま見せる", () => {
    // 見せないより、読めない名前でも出したほうが気づける。
    expect(qualityCheckLabel("まだ無い検査")).toBe("まだ無い検査");
    expect(qualityCheckLabel("vague_heading")).toBe("結論の分からない見出し");
  });

  it("検査の種類の一覧が、実装側で減っていない", () => {
    // **母集団の床。**上の 3 件は言い換え表の中だけを見ているので、
    // 業務側で検査を 1 つ足したのに表へ書き足さない、が起きても気づかない。
    // 型が全域なのでその場合は型が通らないが、型注釈を緩められると素通りする。
    // ここでは業務側の一覧そのものを読み、手で書いた 24 件と突き合わせる。
    const source = readFileSync(join(ROOT, "src/domain/authoring/quality-check.ts"), "utf8");
    const start = source.indexOf("export type QualityCheckId");
    expect(start, "QualityCheckId の宣言が見つかりません").toBeGreaterThan(0);
    const declaration = source.slice(start, source.indexOf(";", start));
    const found = [...declaration.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    expect(found.length, "検査の一覧を読めていません").toBeGreaterThan(5);
    expect([...found].sort()).toEqual([...SPEC_CHECKS].sort());
  });
});
