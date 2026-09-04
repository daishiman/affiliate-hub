import type { QualityCheckId } from "@/domain/authoring";

/**
 * 検査の識別子をそのまま出さない。編集者が読んで直せる言葉にする。
 *
 * **型を全域（`Record<QualityCheckId, string>`）にしてあるのが要点。**
 * 2026-08-21 まではここが `Record<string, string>` で、`?? issue.check` の
 * 逃げ道と組み合わさっていた。検査の種類は 24 件あるのにラベルは 17 件しか無く、
 * QC-02/03/04/08/09/10/14 の 7 件（`paragraph_shape` `sentence_length`
 * `vague_heading` `unit_missing` `conclusion_mismatch` `relative_date`
 * `conversation_flow`）は**編集者の画面に英語の識別子のまま出ていた**。
 * うち `vague_heading` と `conversation_flow` は「確認しなかった項目」にも並ぶ。
 * 全域の型にすると、検査を足した日にここへ書き足すまで型が通らない。
 */
export const QUALITY_CHECK_LABEL: Readonly<Record<QualityCheckId, string>> = {
  unsourced_number: "根拠のない数値",
  stale_price: "古い価格",
  fabricated_experience: "書ける範囲を超えた体験",
  nonexistent_feature: "登録にない機能名",
  exaggeration: "言い過ぎの表現",
  prohibited_phrase: "この書き手では使わない言葉",
  disclosure_present: "広告表示",
  link_present: "リンクの欠落",
  length_fit: "文字数",
  hashtag_fit: "ハッシュタグの数",
  channel_fit: "媒体のきまりとの不一致",
  duplicate_text: "既存記事との重複",
  brand_fit: "書き手らしさ",
  audience_fit: "読者との合い方",
  cta_overuse: "行動を促す文の多さ",
  missing_drawback: "デメリットの欠落",
  missing_citation: "出典の欠落",
  conversation_flow: "吹き出しの並び",
  paragraph_shape: "段落の長さ",
  sentence_length: "1 文の長さ",
  vague_heading: "結論の分からない見出し",
  unit_missing: "数値の単位の欠落",
  conclusion_mismatch: "冒頭と最後の結論の食い違い",
  relative_date: "日付が「先日」などのまま",
};

/** 画面に出す言葉。知らない識別子でも空欄にはせず、そのまま見せて気づけるようにする。 */
export function qualityCheckLabel(check: string): string {
  return QUALITY_CHECK_LABEL[check as QualityCheckId] ?? check;
}
