import type { RatingSummary } from "./reader-rating";

/**
 * トップの記事一覧の並べ方。
 *
 * **画面が増えても増やさない。**「最新」と「人気」の 2 つだけにしてあるのは、
 * 読者が並べ替えを選ぶ手間より、選んだ結果が何を意味するかを言えることの方が
 * 大事だからである。3 つ目を足すときは、その並びが何を根拠にしているかを
 * ここに書けるかどうかで判断する。
 */
export const HOME_SORTS = ["latest", "popular"] as const;

export type HomeSort = (typeof HOME_SORTS)[number];

export const DEFAULT_HOME_SORT: HomeSort = "latest";

/** 並びの名前。画面の切り替えリンクと読み上げの両方がこれを使う。 */
export const HOME_SORT_LABEL: Readonly<Record<HomeSort, string>> = {
  latest: "最新順",
  popular: "人気順",
};

/**
 * 住所の `?sort=` を並びに変える。
 *
 * **知らない値は既定へ落とす。**読者が住所を手で書き換えても画面は壊れず、
 * 「最新順」が出る。ここで 404 にすると、リンクを貼った人の側が壊れる。
 */
export function parseHomeSort(raw: string | null | undefined): HomeSort {
  return (HOME_SORTS as readonly string[]).includes(raw ?? "")
    ? (raw as HomeSort)
    : DEFAULT_HOME_SORT;
}

/**
 * 票の少なさを割り引く重み。
 *
 * 1 票だけの満点が、50 票の平均 4.6 を追い越すのを防ぐ。値が大きいほど
 * 「票が集まるまで上げない」になる。3 にしてあるのは、読者評価が
 * まだ少ないブログでも数票集まれば順位が動くようにするため。
 */
const POPULARITY_PRIOR = 3;

/**
 * 人気の点数。**この式だけが「人気」の定義である。**
 *
 * 平均点をそのまま使わないのは上の理由。票が 0 の記事は 0 点になり、
 * 評価がまだ無いブログでは全記事が同点になって、後段の更新日時順に落ちる
 * ——つまり「人気順」が黙って「最新順」と同じ並びになる。これは正しい。
 * 根拠が無いのに順位を作ると、読者は無い人気を見せられることになる。
 */
export function popularityScore(rating: RatingSummary | undefined): number {
  if (rating === undefined || rating.count === 0 || rating.average === null) return 0;
  return (rating.average * rating.count) / (rating.count + POPULARITY_PRIOR);
}

/** 並べ替えの対象が最低限持っていてほしいもの。読み取りモデルを縛らない。 */
export type SortableArticle = {
  readonly slug: string;
  readonly updatedAt: string;
};

/**
 * 記事を指定の並びにする。**元の配列は変えない。**
 *
 * `latest` は渡された順（読み取り側が既に更新日時の降順で返す）をそのまま返す。
 * ここで再度並べ替えると、読み取り側の並びの規則と二重になり、
 * どちらが効いているのか画面から追えなくなる。
 */
export function sortArticles<T extends SortableArticle>(
  articles: readonly T[],
  sort: HomeSort,
  ratings: Readonly<Record<string, RatingSummary>> = {},
): readonly T[] {
  if (sort === "latest") return articles;
  return [...articles].sort((a, b) => {
    const diff = popularityScore(ratings[b.slug]) - popularityScore(ratings[a.slug]);
    if (diff !== 0) return diff;
    /* 同点は新しい方を上に。安定した順序を作らないと、読み込むたび並びが揺れる。 */
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
