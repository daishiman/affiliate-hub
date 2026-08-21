/**
 * Editorial / Commercial の分離を「型で不可能にする」ための印。
 *
 * 仕様の中核制約:
 *   - プラットフォーム層 §19.4「ランキングサービスには報酬データを渡さない」
 *   - プラットフォーム層 §12.3「アフィリエイト報酬・広告主依頼・販売実績を
 *     比較候補スコアへ入れてはならない」
 *   - ブログ層 §4.7 / §17.4 `affiliate_compensation_is_input: false`
 *
 * この制約はレビュー規約では守れない。守り方は 2 段。
 *
 *   1. 型: Ranking のユースケースは Editorial 印の付いたポートしか受け取れない。
 *      Commercial 印のポートを渡すとコンパイルが通らない (実行前に落ちる)。
 *   2. 実行時: markCommercial した値は runtime にも印が残るので、
 *      テストで「Ranking の依存に商業データが混ざっていない」ことを検査できる。
 *
 * なぜ「型だけ」で足りないか: 型は `as any` で外せる。実行時の印があれば
 * テストで検出できるため、意図的な回避も差分レビューの前に失敗する。
 */
declare const dataClassSymbol: unique symbol;

/** 編集判断に使ってよいデータ (実測値・仕様・使いやすさ・耐久性・サポート・価格妥当性)。 */
export type EditorialFacet = { readonly [dataClassSymbol]: "editorial" };

/** 編集判断に使ってはならないデータ (報酬・広告主予算・キャンペーン優先度・販売ノルマ)。 */
export type CommercialFacet = { readonly [dataClassSymbol]: "commercial" };

/** Editorial 印の付いたポート型。 */
export type Editorial<T> = T & EditorialFacet;

/** Commercial 印の付いたポート型。Ranking へ渡すとコンパイルエラーになる。 */
export type Commercial<T> = T & CommercialFacet;

/** 実行時にも残る印のキー。テストとデバッグ以外で読まない。 */
export const DATA_CLASS_KEY = "__affiliateHubDataClass" as const;

export type DataClass = "editorial" | "commercial";

function mark<T extends object>(value: T, dataClass: DataClass): T {
  Object.defineProperty(value, DATA_CLASS_KEY, {
    value: dataClass,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return value;
}

/** 編集用ポートに印を付ける。Ranking へ渡せるのはこれだけ。 */
export function markEditorial<T extends object>(port: T): Editorial<T> {
  return mark(port, "editorial") as Editorial<T>;
}

/** 商業用ポートに印を付ける。Ranking へは渡せない。 */
export function markCommercial<T extends object>(port: T): Commercial<T> {
  return mark(port, "commercial") as Commercial<T>;
}

/** 実行時の印を読む。印が無ければ null。 */
export function readDataClass(value: unknown): DataClass | null {
  if (typeof value !== "object" || value === null) return null;
  const v = (value as Record<string, unknown>)[DATA_CLASS_KEY];
  return v === "editorial" || v === "commercial" ? v : null;
}

/**
 * 依存オブジェクトに商業データが 1 つも混ざっていないことを実行時に検査する。
 * Ranking のユースケース組み立て時とテストで使う。
 */
export function containsCommercial(deps: Readonly<Record<string, unknown>>): string[] {
  return Object.entries(deps)
    .filter(([, v]) => readDataClass(v) === "commercial")
    .map(([k]) => k);
}

/**
 * 指定した項目に `dataClass` の印が付いていないものを返す（**印が無いものも含む**）。
 *
 * `containsCommercial` は「商業と名乗っているもの」しか見つけられない。
 * 実行時の印は「型を外した回を捕まえる」ために置いたものなので、
 * 型を外したうえで印を付け忘れた場合こそ落としたい。
 * そのため、データを持つポートは**どちらの入口でもこの向き（印が無ければ落とす）**で見る。
 *
 * `ids` や `now` のような、データではない依存は対象にしない。
 * 呼び出し側が `keys` で「データを持つポート」だけを挙げる。
 */
export function missingMark(
  deps: Readonly<Record<string, unknown>>,
  dataClass: DataClass,
  keys: readonly string[],
): string[] {
  return keys.filter((key) => readDataClass(deps[key]) !== dataClass);
}
