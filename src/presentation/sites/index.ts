/**
 * ブログ固有コンポーネントの登録簿。
 *
 * 契約 (`docs/spec/feat-uiux-overhaul/blog-scaffold-contract.md`) は
 * **ブログを作っても固有部品のファイルを生成しない**と決めている。
 * 使われない骨組みがブログの本数だけたまるのを避けるためで、
 * したがってこの登録簿が空であることは正常な状態である。
 *
 * では何のためにあるか。**足したときに読まれる口**のため。
 * 口が無ければ、`src/presentation/sites/<slug>/` にファイルを置いても
 * どこからも読まれない。置いた人はそれに気付けない。
 *
 * 共通コンポーネント側にブログ名の分岐 (`if (slug === "...")`) を書かないのが要点。
 * 書いた時点でブログを増やすたびに共通側を直すことになり、
 * ブログ 5 本目の変更が 1 本目を壊す形になる。
 *
 * ## 足し方
 *
 * 1. 例外の 2 条件を満たすか確かめる (共通部品でも設計図の項目でも表現できない / 他へ広がらない)
 * 2. `src/presentation/sites/<slug>/` に `index.ts` と `README.md` を置く
 * 3. この `OVERRIDES` に 1 行足す
 *
 * `reason` は `README.md` の要約で、`/admin/sites/[site]` に出る。
 * README はコードを読む人しか見ないので、例外が積み上がっていることに
 * 気付ける場所を運用する人の側にも置く。
 */

export type SiteOverride = {
  /** `SiteBlueprint.id`。ディレクトリ名と一致する (表示名ではない)。 */
  readonly slug: string;
  /** なぜ共通部品で表現できなかったか。管理画面に出る 1 文。 */
  readonly reason: string;
  /** 固有部品の入口。読むのは必要になった時点だけ。 */
  readonly load: () => Promise<Record<string, unknown>>;
};

/**
 * 固有部品を持つブログ。
 *
 * **空が正常。** ここが伸び続けているなら、共通部品か設計図の項目で
 * 表現できるものを個別実装に逃がしている疑いがある。
 */
const OVERRIDES: readonly SiteOverride[] = [];

const BY_SLUG: ReadonlyMap<string, SiteOverride> = new Map(OVERRIDES.map((o) => [o.slug, o]));

/** そのブログが固有部品を持つか。 */
export function hasSiteOverrides(slug: string): boolean {
  return BY_SLUG.has(slug);
}

/** なぜ固有部品を持つのか。持たないブログでは null。 */
export function siteOverrideReason(slug: string): string | null {
  return BY_SLUG.get(slug)?.reason ?? null;
}

/**
 * 固有部品を読む。持たないブログでは null を返し、共通のまま描く。
 * 呼ぶ側に分岐を書かせないよう、「無い」も正常な戻り値にしている。
 */
export async function loadSiteOverrides(slug: string): Promise<Record<string, unknown> | null> {
  const entry = BY_SLUG.get(slug);
  return entry ? await entry.load() : null;
}

/** 固有部品を持つブログの一覧。例外がいくつ積み上がっているかを数える用。 */
export function siteOverrideSlugs(): readonly string[] {
  return OVERRIDES.map((o) => o.slug);
}
