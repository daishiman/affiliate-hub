/**
 * Analytics コンテキスト / 絞り込みの軸 (§22.8)。
 *
 * 仕様書の 11 軸をここ 1 箇所で宣言する。
 * 画面・保存先・AI の道具がそれぞれ軸の一覧を持つと、
 * 「画面では絞れるのに AI からは絞れない」がすぐ起きる。
 *
 * --- ここで守っている取り決め ---
 *
 * 1. **軸は「切り口」であって「良し悪し」ではない。**
 *    商品別に報酬額を並べられるようにはするが、
 *    その並びを順位づけへ戻す経路はここには無い。
 *    使ってよい指標の判定は feedback-policy.ts が持つ。
 *
 * 2. **お金に近い軸を明示する。**
 *    販売店・ASP・CTA は、報酬の出どころに直結する軸。
 *    この軸で絞った数字を編集判断へ持ち込むと、
 *    「よく売れる販売店の商品を上に出す」が無自覚に起きる。
 *    軸そのものに印を付けておき、画面で必ず注意を出す。
 *
 * 3. **分けられない軸を 0 件と書かない。**
 *    保存先がその軸を持っていない場合に 0 を返すと、
 *    「その切り口では成果が無い」と読めてしまう。
 *    軸ごとに「分けられるか」を持ち、分けられないときは理由を出す。
 */

export type AnalyticsAxisKey =
  | "product" // 商品
  | "content" // コンテンツ
  | "author" // 書き手
  | "persona" // 読者
  | "channel" // 媒体
  | "angle" // 切り口
  | "cta" // CTA
  | "merchant" // 販売店
  | "asp" // ASP
  | "site" // ブログ
  | "publishedAt"; // 投稿日時

export type AnalyticsAxis = {
  readonly key: AnalyticsAxisKey;
  /** 画面に出す呼び名。用語辞書と揃える。 */
  readonly label: string;
  /** その軸で何が分かるか。1 文で書けない軸は置かない。 */
  readonly whatItTells: string;
  /**
   * 報酬の出どころに直結する軸か。
   * true の軸で絞った数字は、編集判断へ戻さない。
   */
  readonly commercial: boolean;
  /** 期間の軸か。他の軸と違い、値の一覧ではなく範囲で指定する。 */
  readonly temporal: boolean;
};

const A = (
  key: AnalyticsAxisKey,
  label: string,
  whatItTells: string,
  options: { commercial?: boolean; temporal?: boolean } = {},
): AnalyticsAxis => ({
  key,
  label,
  whatItTells,
  commercial: options.commercial ?? false,
  temporal: options.temporal ?? false,
});

/** 仕様書 §22.8 の 11 軸。順序も仕様書のまま。 */
export const ANALYTICS_AXES: readonly AnalyticsAxis[] = [
  A("product", "商品", "どの商品を扱った記事が読まれ、成果につながったか"),
  A("content", "コンテンツパッケージ", "記事 1 本ごとの読まれ方と成果"),
  A("author", "書き手", "誰が書いた記事か。AI と人の書き分けもここで見る"),
  A("persona", "読者", "どの読者像に向けた記事か"),
  A("channel", "媒体", "どこへ出した投稿か（ブログ・X・YouTube など）"),
  A("angle", "切り口", "同じ商品を、どの角度から書いたか"),
  A("cta", "CTA", "読者に何を促したか。押された割合を見る", { commercial: true }),
  A("merchant", "販売店", "どの販売店へ送ったか", { commercial: true }),
  A("asp", "ASP", "どの ASP を経由した成果か", { commercial: true }),
  A("site", "ブログ", "どのブログの数字か"),
  A("publishedAt", "投稿日時", "いつ出した記事か。出した時期による差を見る", { temporal: true }),
];

export const ANALYTICS_AXIS_KEYS: readonly AnalyticsAxisKey[] = ANALYTICS_AXES.map((a) => a.key);

const BY_KEY: ReadonlyMap<AnalyticsAxisKey, AnalyticsAxis> = new Map(
  ANALYTICS_AXES.map((a) => [a.key, a]),
);

export function analyticsAxis(key: AnalyticsAxisKey): AnalyticsAxis {
  const found = BY_KEY.get(key);
  // 一覧と型が同じ定義から作られているため、通常は到達しない。
  if (!found) throw new Error(`絞り込みの軸がありません: ${key}`);
  return found;
}

export function isAnalyticsAxisKey(value: string): value is AnalyticsAxisKey {
  return BY_KEY.has(value as AnalyticsAxisKey);
}

/**
 * 絞り込みの指定。
 *
 * 値が入っていない軸は「絞らない」。空文字を「該当なし」と読み替えない。
 * 空文字を該当なしとして扱うと、選び直しの途中で 0 件になり、
 * 「この条件では成果が無い」と誤読させる。
 */
export type AnalyticsFilter = Partial<Record<Exclude<AnalyticsAxisKey, "publishedAt">, string>> & {
  /** 投稿日時の範囲。片側だけの指定も許す。 */
  readonly publishedFrom?: Date;
  readonly publishedTo?: Date;
};

/**
 * お金に近い軸で絞っているか。
 * 絞っているなら、その数字を編集判断へ戻さない注意を必ず画面へ出す。
 */
export function commercialAxesInUse(filter: AnalyticsFilter): readonly AnalyticsAxis[] {
  return ANALYTICS_AXES.filter(
    (a) => a.commercial && typeof filter[a.key as keyof AnalyticsFilter] === "string",
  );
}
