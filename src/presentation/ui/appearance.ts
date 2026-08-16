/**
 * 見た目（配色 × 明暗）の当て方と覚え方。
 *
 * **ここは「どう当てるか」だけを持つ。「どの配色があるか」は持たない。**
 * 配色の一覧は Site Blueprint の語彙（`@/domain/authoring`）が正本で、
 * 共通UIはそれを読まない。読んだ時点で、UI が業務のきまりを抱えることになり、
 * 別の用途で使い回せなくなる（tests/ui/ui-layers.test.ts が見ている）。
 *
 * この分け方の実際の効き目:
 *   配色を 1 つ足す → 触るのは domain の一覧と themes.css だけ。
 *   このファイルも下の部品も変わらない。
 */

/** 属性名。**書く側と読む側で 1 箇所にそろえる。** */
export const APPEARANCE_ATTR = {
  scheme: "data-brand-theme",
  mode: "data-color-mode",
} as const;

/**
 * 設定を覚えておく入れ物の名前。
 *
 * cookie にしているのは、最初の描画（サーバー側）で読めるため。
 * localStorage だと画面が出てから JS で直すことになり、
 * 一瞬だけ前の色が見える（FOUC）。
 */
export const APPEARANCE_COOKIE = {
  scheme: "ah_theme",
  mode: "ah_mode",
} as const;

/** 覚えておく期間。1 年。 */
export const APPEARANCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** 当てる値。妥当性の確認は呼ぶ側（domain 側の読み取り）で済ませておく。 */
export type AppearanceValues = {
  readonly brandTheme: string;
  readonly colorMode: string;
};

/**
 * 一番外側の要素に付ける属性。
 *
 * `auto` のときは明暗の属性を出さない。
 * 出さないことが「端末の設定に従う」の意味になる（semantic.css の `:root`）。
 * ここで `data-color-mode=""` を出すと、セレクタには当たらないのに
 * 属性としては残るため、後から見て理由が分からなくなる。
 */
export function appearanceAttributes(
  values: AppearanceValues,
): Readonly<Record<string, string>> {
  const attrs: Record<string, string> = { [APPEARANCE_ATTR.scheme]: values.brandTheme };
  if (values.colorMode !== "auto") attrs[APPEARANCE_ATTR.mode] = values.colorMode;
  return attrs;
}
