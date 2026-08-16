import type { GateRequirement } from "@/domain/compliance/publish-gate";
import type { QualityCheckId } from "@/domain/authoring/quality-check";

/**
 * 仕様が定める品質検査 QC-01〜QC-17 と、いま機械で判定できるものの対応表。
 *
 * **同じ検査に名前が 2 つあると、片方だけ直して直った気になる。**
 * 仕様は `QC-05` と呼び、コードは `prohibited_phrase` と呼んでいる。
 * どちらかへ寄せるのが本筋だが、仕様書は外部（監査・引き継ぎ）が読む正本なので、
 * ここで「仕様の名前 → コードの名前」を 1 箇所に固定し、両方から参照する。
 *
 * `implementedBy` が `null` のものは、まだ判定する仕組みが無い。
 * 評価セットの期待値には書けるが、実行しても結果は出ない。
 * それを「合格」と数えないために、ここで正直に `null` と書く。
 */

/** 未達なら公開させない検査か、警告に留める検査か。 */
export type GateSeverity = "BLOCK" | "WARN";

/** その検査を実際に行っている場所。増やすときは実在する識別子だけを書く。 */
export type GateImplementation =
  | { readonly kind: "quality_check"; readonly id: QualityCheckId }
  | { readonly kind: "publish_gate"; readonly requirement: GateRequirement };

export type SpecQualityCheck = {
  /** 仕様書での呼び名。文章作成メソッド仕様 §7 の表と一致させる。 */
  readonly id: string;
  readonly label: string;
  readonly severity: GateSeverity;
  /** 判定している場所。`null` は「まだ判定できない」。 */
  readonly implementedBy: GateImplementation | null;
  /** `null` のとき、何が済めば判定できるようになるか。空欄を許さない。 */
  readonly blockedBy: string | null;
};

export const SPEC_QUALITY_CHECKS: readonly SpecQualityCheck[] = [
  {
    id: "QC-01",
    label: "必須セクションの存在",
    severity: "BLOCK",
    implementedBy: { kind: "publish_gate", requirement: "required_sections" },
    blockedBy: null,
  },
  {
    id: "QC-02",
    label: "一段落の文数（3文以内）",
    severity: "WARN",
    implementedBy: null,
    blockedBy: "本文を段落に分けて持つこと（いまは本文が 1 つの文字列）",
  },
  {
    id: "QC-03",
    label: "一文の長さ（80字以内）",
    severity: "WARN",
    implementedBy: null,
    blockedBy: "日本語の文分割（句点だけでは会話文・箇条書きを誤分割する）",
  },
  {
    id: "QC-04",
    label: "見出しだけで結論が分かる",
    severity: "WARN",
    implementedBy: null,
    blockedBy: "見出しを構造として持つこと（本文文字列からの抽出では誤検出が多い）",
  },
  {
    id: "QC-05",
    label: "禁止表現（根拠なしの断定）",
    severity: "BLOCK",
    implementedBy: { kind: "quality_check", id: "prohibited_phrase" },
    blockedBy: null,
  },
  {
    id: "QC-06",
    label: "事実分類の付与（未分類の段落 0）",
    severity: "BLOCK",
    implementedBy: null,
    blockedBy: "段落ごとの事実区分（実測 / 引用 / 推測）を持つ本文表現",
  },
  {
    id: "QC-07",
    label: "根拠のない主張（Evidence 0 件の Claim が 0）",
    severity: "BLOCK",
    implementedBy: { kind: "quality_check", id: "missing_citation" },
    blockedBy: null,
  },
  {
    id: "QC-08",
    label: "数値の単位・条件",
    severity: "WARN",
    implementedBy: { kind: "quality_check", id: "unsourced_number" },
    blockedBy: null,
  },
  {
    id: "QC-09",
    label: "冒頭結論と最終結論の一致",
    severity: "BLOCK",
    implementedBy: null,
    blockedBy: "冒頭・最終の推奨商品をそれぞれ構造として持つこと",
  },
  {
    id: "QC-10",
    label: "日付の絶対表記",
    severity: "WARN",
    implementedBy: null,
    blockedBy: "相対日付語の辞書（「先日」「最近」「現在」の単独使用の判定）",
  },
  {
    id: "QC-11",
    label: "ペルソナ差分の事実境界（fact_fingerprint 一致）",
    severity: "BLOCK",
    implementedBy: null,
    blockedBy: "同じ素材から作った複数バリアントを 1 つの束として扱う生成の実装",
  },
  {
    id: "QC-12",
    label: "マルチサイト重複（連続40字一致 0）",
    severity: "BLOCK",
    implementedBy: { kind: "quality_check", id: "duplicate_text" },
    blockedBy: null,
  },
  {
    id: "QC-13",
    label: "広告表記と rel=sponsored",
    severity: "BLOCK",
    implementedBy: { kind: "quality_check", id: "disclosure_present" },
    blockedBy: null,
  },
  {
    id: "QC-14",
    label: "会話ブロック制約（連続2個・40〜120字・話者名）",
    severity: "WARN",
    implementedBy: null,
    blockedBy: "会話ブロックを本文の構造として持つこと",
  },
  {
    id: "QC-15",
    label: "薬機法表現（効果効能の断定 0）",
    severity: "BLOCK",
    implementedBy: { kind: "quality_check", id: "exaggeration" },
    blockedBy: null,
  },
  {
    id: "QC-16",
    label: "景表法・優良誤認（比較範囲なき最上級 0）",
    severity: "BLOCK",
    implementedBy: { kind: "quality_check", id: "exaggeration" },
    blockedBy: null,
  },
  {
    id: "QC-17",
    label: "アクセシビリティ（alt / 見出し階層 / コントラスト 4.5:1）",
    severity: "BLOCK",
    implementedBy: null,
    blockedBy: "生成物を HTML として検査する経路（いまは本文文字列で持っている）",
  },
];

export const SPEC_QUALITY_CHECK_IDS: readonly string[] = SPEC_QUALITY_CHECKS.map((c) => c.id);

/** いま機械で判定できる検査だけを返す。期待値の突き合わせに使う。 */
export function machineCheckableIds(): readonly string[] {
  return SPEC_QUALITY_CHECKS.filter((c) => c.implementedBy !== null).map((c) => c.id);
}
