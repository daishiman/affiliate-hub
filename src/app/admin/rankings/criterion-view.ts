/**
 * 順位の画面と評価基準の画面で共通に使う言い換え。
 *
 * 画面を 2 枚に分けたので、どちらにも同じ表が要る。片方へ書き写すと、
 * 指標を 1 つ足した日にもう片方だけが内部キーのまま出る。
 * `products/claim-view.ts` と同じ理由でここへ出した。
 */

/** 内部の指標キーをそのまま画面に出さない。読み手の言葉に直す。 */
const CRITERION_LABEL: Readonly<Record<string, string>> = {
  measured_performance: "実測性能",
  specification: "仕様",
  usability: "使いやすさ",
  durability: "耐久性",
  support: "サポート",
  price_value: "価格に対する価値",
};

export function criterionLabel(key: string): string {
  return CRITERION_LABEL[key] ?? key;
}

export function formatScore(value: number): string {
  return value.toFixed(2);
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatTestedAt(value: Date | null): string {
  if (value === null) return "未検証";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(value);
}
