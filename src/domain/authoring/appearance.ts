import {
  BRAND_THEMES,
  BRAND_THEME_LABELS,
  type BrandTheme,
  COLOR_MODES,
  COLOR_MODE_LABELS,
  type ColorMode,
  DEFAULT_THEME,
} from "./site-blueprint";

/**
 * 外観の決まり方（配色 × 明暗）。
 *
 * 見た目は 2 軸で決まる。
 *   配色 (BrandTheme): 青系・ピンク系・ホワイト系・グレー系・グリーン系 など
 *   明暗 (ColorMode) : 端末に合わせる / 明るい / 暗い
 *
 * **掛け合わせの数だけ設定を持たない。** 2 軸をそのまま 2 つの値として持ち、
 * 実際の色はトークン側 (themes.css + light-dark()) が解く。
 * ここで「青系のダーク」という 1 つの名前にしてしまうと、
 * 配色が 1 つ増えるたびに設定値が 2 つ増える。
 *
 * 誰の設定が優先されるか:
 *   1. その人がこの画面で選んだもの（一番強い）
 *   2. ブログが決めた既定（読者向け画面のみ）
 *   3. 全体の既定（graphite-amber / auto）
 *
 * 読者にも選ばせるのは、暗い場所で読む人がブログの都合で
 * 眩しい画面を強制されないようにするため。
 * ブログ側の既定は「何も選んでいない人」に対してだけ効く。
 */

export type Appearance = {
  readonly brandTheme: BrandTheme;
  readonly colorMode: ColorMode;
};

export const DEFAULT_APPEARANCE: Appearance = {
  brandTheme: DEFAULT_THEME.brandTheme,
  colorMode: DEFAULT_THEME.colorScheme,
};

/**
 * 外から来た文字列を配色として読む。
 *
 * cookie も URL も利用者が書き換えられる。**知らない名前は既定に落とす。**
 * 落とさずに素通しすると、トークンの無い名前が属性に入り、
 * どのテーマも当たらない「色が半分だけ既定」の画面になる。
 */
export function parseBrandTheme(value: string | null | undefined): BrandTheme | null {
  if (typeof value !== "string") return null;
  return BRAND_THEMES.find((t) => t === value) ?? null;
}

/** 外から来た文字列を明暗として読む。読めなければ null。 */
export function parseColorMode(value: string | null | undefined): ColorMode | null {
  if (typeof value !== "string") return null;
  return COLOR_MODES.find((m) => m === value) ?? null;
}

/**
 * 実際に適用する外観を決める。
 *
 * 引数はどれも「無いかもしれない」前提。
 * 何も無くても必ず 1 組が決まる（画面が色無しで出ることはない）。
 */
export function resolveAppearance(input: {
  /** その人が選んだもの（cookie などから。未検証の文字列でよい）。 */
  readonly chosenTheme?: string | null;
  readonly chosenMode?: string | null;
  /** ブログ側の既定。管理画面では渡さない。 */
  readonly siteDefault?: Appearance | null;
}): Appearance {
  const base = input.siteDefault ?? DEFAULT_APPEARANCE;
  return {
    brandTheme: parseBrandTheme(input.chosenTheme) ?? base.brandTheme,
    colorMode: parseColorMode(input.chosenMode) ?? base.colorMode,
  };
}

/**
 * 選択肢。画面はこれを描くだけで、配色の一覧を持たない。
 *
 * **共通UIの部品はこれを呼ばない。** 部品は「渡された選択肢を出す」だけにする。
 * 属性の付け方と cookie の名前は `src/presentation/ui/appearance.ts` にある。
 * 分けている理由: 配色を 1 つ足したときに触る場所を、
 * この一覧と `themes.css` の 2 つに閉じるため。
 */
export function themeOptions(): readonly { readonly value: BrandTheme; readonly label: string }[] {
  return BRAND_THEMES.map((value) => ({ value, label: BRAND_THEME_LABELS[value] }));
}

export function modeOptions(): readonly { readonly value: ColorMode; readonly label: string }[] {
  return COLOR_MODES.map((value) => ({ value, label: COLOR_MODE_LABELS[value] }));
}
