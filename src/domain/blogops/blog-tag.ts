/**
 * タグの種類と、`brand-tag-cloud` に出すものの決め方。
 *
 * ==========================================================================
 * なぜ種類を分けるのか
 * ==========================================================================
 *
 * サイドバーの枠 `brand-tag-cloud` (§3.4 の 3) は、**読者に「これは商品の作り手だ」と
 * 言っている枠**である。話題のまとめ (「初心者向け」「予算 1 万円」) がその中に
 * 混じると、枠そのものが嘘になる。枠の中身を「タグ全部」にすると、
 * タグを 1 つ足すたびに、足した人の意図と関係なく枠の主張がずれる。
 *
 * だからタグに種類を持たせ、**枠に出す条件を 1 か所に書く。**
 * 画面ごとに `filter` を書くと、書き忘れた画面から非ブランドが漏れる。
 * 漏れても画面は正しく見えるので、**漏れたことに気づく機会が無い。**
 *
 * ==========================================================================
 * 既定を `topic` にしてある理由
 * ==========================================================================
 *
 * 種類を足す前からあるタグは、どちらとも分からない。分からないものを
 * `brand` に寄せると、**枠が「作り手だ」と嘘を言う。**`topic` に寄せると、
 * 枠が寂しくなるだけで、嘘は言わない。**間違え方が軽い側**へ倒す。
 */

/**
 * タグの種類。
 *
 * 2 つしか無い。「ブランドか、そうでないか」だけが `brand-tag-cloud` の
 * 出し入れを決めるので、増やすと枠の条件が「brand 以外のどれか」に散る。
 */
export const BLOG_TAG_KINDS = ["brand", "topic"] as const;

export type BlogTagKind = (typeof BLOG_TAG_KINDS)[number];

/** 画面に出す言葉。`Record` にしてあるので、種類を足すと未定義が型で捕まる。 */
export const BLOG_TAG_KIND_LABEL: Readonly<Record<BlogTagKind, string>> = {
  brand: "ブランド（商品の作り手）",
  topic: "話題（記事のまとめ方）",
};

/** 種類として通る言葉かどうか。保存の入口で使う。 */
export function isBlogTagKind(value: string): value is BlogTagKind {
  return (BLOG_TAG_KINDS as readonly string[]).includes(value);
}

/**
 * `brand-tag-cloud` に出すタグを選ぶ。**ここだけが条件を持つ。**
 *
 * 並べ替えをここでしているのは、枠の中身が保存の順で変わると、
 * 読者から見て「昨日と違う」だけの動きになるため。表示名の順に固定する。
 *
 * @param limit 出す上限。0 以下なら 1 件も出さない (枠を空にする指示として扱う)。
 */
export function brandTagCloud<T extends { readonly kind: BlogTagKind; readonly name: string }>(
  tags: readonly T[],
  limit: number,
): readonly T[] {
  if (limit <= 0) return [];
  return [...tags]
    .filter((tag) => tag.kind === "brand")
    .sort((a, b) => a.name.localeCompare(b.name, "ja"))
    .slice(0, limit);
}
