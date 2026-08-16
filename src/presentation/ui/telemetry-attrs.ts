/**
 * 部品が「自分が何であるか」を名乗るための印。
 *
 * --- なぜ属性で名乗らせるのか ---
 * 画面ごとに `onClick={() => send("cta_click")}` を書く作りにすると、
 * **新しく作った画面だけ計測が抜ける**。しかも画面は正常に動くので、
 * 抜けたことに誰も気づかない。数か月後に「この導線のデータが無い」と分かる。
 *
 * ここでは共通UIの部品が `data-tel-*` を出すだけにして、
 * 拾う側 (`src/presentation/telemetry/collector.tsx`) が
 * 画面全体で 1 回だけ拾う。画面は何も書かない。
 * 部品を使えば計測が付いてくるので、抜けようがない。
 *
 * --- この段では送らない ---
 * 共通UIは表示だけを行う (`tests/ui/ui-layers.test.ts`)。
 * ここにあるのは属性を作る関数だけで、通信は 1 行も無い。
 */

/** 要素の種類。**ここに無い種類は名乗れない。** 文字列を各所で作らせないため。 */
export const TELEMETRY_ELEMENT_KINDS = [
  "affiliate_link",
  "internal_link",
  "external_link",
  "cta_button",
  "ranking_row",
  "comparison_row",
  "product_card",
  "filter_control",
  "nav_item",
  "toc_item",
  "search_submit",
  "appearance_control",
] as const;
export type TelemetryElementKind = (typeof TELEMETRY_ELEMENT_KINDS)[number];

/** 節の種類。滞在時間はこの単位で測る。段落単位で測っても読み方は分からない。 */
export const TELEMETRY_SECTION_KINDS = [
  "lead",
  "conclusion",
  "ranking",
  "comparison",
  "review",
  "faq",
  "evidence",
  "cta",
  "related",
] as const;
export type TelemetrySectionKind = (typeof TELEMETRY_SECTION_KINDS)[number];

export type TelemetryMark = {
  readonly kind: TelemetryElementKind;
  /** 何を指しているか (商品ID・リンクID・リンク先など)。 */
  readonly id: string;
  /** 短い名前。**本文をそのまま入れない。** */
  readonly label?: string;
  /** 順位表の行なら順位。無ければ省略。 */
  readonly rank?: number;
  /** 記事のどこに置かれているか。 */
  readonly placement?: string;
};

export type TelemetryAttributes = Readonly<Record<string, string>>;

/**
 * 部品に付ける属性を作る。
 *
 * 印を付けたくない使い方 (見本帳など) では `undefined` を渡せば
 * 何も付かない。付けるかどうかを画面が選べる形にしておかないと、
 * 見本帳の操作まで本物の数字に混ざる。
 */
export function telemetryAttrs(mark: TelemetryMark | undefined): TelemetryAttributes {
  if (mark === undefined) return {};
  const attrs: Record<string, string> = {
    "data-tel-kind": mark.kind,
    "data-tel-id": mark.id,
  };
  if (mark.label !== undefined) attrs["data-tel-label"] = mark.label;
  if (mark.rank !== undefined) attrs["data-tel-rank"] = String(mark.rank);
  if (mark.placement !== undefined) attrs["data-tel-placement"] = mark.placement;
  return attrs;
}

export type TelemetrySectionMark = {
  readonly kind: TelemetrySectionKind;
  readonly id: string;
};

/** 節に付ける属性。滞在時間を測る単位になる。 */
export function telemetrySectionAttrs(
  mark: TelemetrySectionMark | undefined,
): TelemetryAttributes {
  if (mark === undefined) return {};
  return { "data-tel-section": mark.id, "data-tel-section-kind": mark.kind };
}

/** 拾う側と揃えるための属性名。文字列を二重に持たない。 */
export const TELEMETRY_ATTR = {
  kind: "data-tel-kind",
  id: "data-tel-id",
  label: "data-tel-label",
  rank: "data-tel-rank",
  placement: "data-tel-placement",
  section: "data-tel-section",
  sectionKind: "data-tel-section-kind",
} as const;
