import { blogOpsEntry, currentActor, platformUseCases } from "@/presentation/composition";

/**
 * 「どのブログの話か」を決めるための選択肢。
 *
 * 版面・記事・固定ページ・タグ・評価の 5 画面が同じ問いから始まる。
 * 選択肢の作り方を 5 か所に書くと、1 か所だけ「隠したブログ」を出す事故が起きる。
 *
 * 並び順はつながりの木のまま。名前の五十音順にしないのは、
 * **親子の関係が読めなくなる**ため。中心のブログの直後に、その子が並ぶ。
 */
export type BlogSiteOptions = {
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
    readonly categories: readonly { readonly value: string; readonly label: string }[];
  }[];
  /** 選択肢が 1 つも無いときの理由。空なら null。 */
  readonly emptyReason: string | null;
};

export async function blogSiteOptions(): Promise<BlogSiteOptions> {
  const entry = await blogOpsEntry();
  if (!entry.ready) return { options: [], emptyReason: entry.reason };

  const actor = await currentActor();
  const result = await entry.listNetwork.execute(actor, {});
  if (!result.ok) return { options: [], emptyReason: result.error.message };
  const sites = await platformUseCases();
  // 行と設計図を添字で突き合わせない。長さは必ず揃うので、
  // `blueprints[index]?.` の `?.` は決して真にならない枝として残るだけになる。
  const options = await Promise.all(
    result.value.rows.map(async (row) => {
      const site = await sites.getSite.execute(actor, { siteSlug: row.siteSlug });
      return {
        value: row.siteSlug,
        // 深さを全角空白で表すのは、選択肢の中で木を見せられる唯一の手だから。
        label: `${"　".repeat(row.depth)}${row.name}（${row.roleLabel}）`,
        // 設計図が読めなかったブログは、カテゴリ無しで選択肢に残す。
        // 1 本読めないだけで選択肢ごと消すと、他のブログの操作まで止まる。
        categories: site.ok
          ? site.value.blueprint.categories.map((category) => ({
              value: category.slug,
              label: category.name,
            }))
          : [],
      };
    }),
  );
  return {
    options,
    emptyReason:
      options.length === 0
        ? "ブログのつながりがまだ 1 本もありません。先に「ブログのつながり」で 1 本足してください。"
        : null,
  };
}

/**
 * 画面が扱うブログを 1 本に決める。
 *
 * `?site=` が無いときは先頭を使う。「選んでください」で止めないのは、
 * ブログが 1 本しか無い運用が普通で、毎回同じ選択をさせても何も決まらないため。
 */
export function pickSiteSlug(
  params: Record<string, string | string[] | undefined>,
  options: readonly { readonly value: string }[],
): string | null {
  const raw = params.site;
  const asked = Array.isArray(raw) ? raw[0] : raw;
  if (asked !== undefined && options.some((o) => o.value === asked)) return asked;
  return options[0]?.value ?? null;
}
