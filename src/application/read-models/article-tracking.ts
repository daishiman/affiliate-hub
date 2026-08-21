import {
  type PublishedArticle,
  type PublishedProductCard,
  type PublishedRankingEntry,
  articleHref,
} from "./published-article";

/**
 * 記事に載っている「外向きのリンク」を数え上げ、合言葉を埋め戻す。
 *
 * ここは**計算だけ**で、保存先も乱数も時計も触らない。
 * 合言葉を発行するのは保存先側（`redirect-repository.ts`）、
 * 呼ぶ順を決めるのは組み立て側（`composition.ts`）である。
 *
 * --- なぜ記事の形をここで歩くのか ---
 * 成果リンクは順位表（`ranking.entries`）と商品カード（`productCards`）の
 * 2 か所に出る。どちらか片方だけ合言葉を埋めると、**同じ商品への
 * クリックが 2 系統に割れ**、どちらの数字も実数より少なく出る。
 * 歩く場所を 1 か所にまとめておくと、記事の形が増えたときに
 * ここを直せば両方に効く。
 *
 * 規範: docs/spec/03-分析・解析基盤仕様.md §1.2
 */

/**
 * 記事の中の 1 つの外向きリンク。
 *
 * `slotKey` は**その記事のその位置**を指す。合言葉を持ち回るための鍵であり、
 * 保存先の主キーではない（保存先の鍵は合言葉そのもの）。
 */
export type OutboundLink = {
  readonly slotKey: string;
  readonly destinationUrl: string;
  readonly siteSlug: string;
  readonly articlePath: string;
  /** どこに置いたリンクか。集計の軸になる（`ranking` / `product_card`）。 */
  readonly placement: string;
  readonly productId: string | null;
  /** すでに合言葉が入っているか。入っていれば発行し直さない。 */
  readonly trackingCode: string | null;
};

/** 記事の中での位置を表す鍵。**転送先 URL を混ぜない。** */
function slotKeyFor(placement: string, productId: string): string {
  return `${placement}:${productId}`;
}

/**
 * 記事のどこから外へ出ていくかを集める。
 *
 * `affiliateUrl` が無いものは含めない。提携していない商品にまで
 * 合言葉を発行すると、転送先が空の写しができ、押した読者だけが気づく。
 */
export function collectOutboundLinks(article: PublishedArticle): readonly OutboundLink[] {
  // 記事の道は `articleHref` が唯一の正本。ここで組み立て直すと、
  // 画面が出す道と記録に残る道がずれ、記事ごとの集計が合わなくなる。
  const articlePath = articleHref(article);
  const links: OutboundLink[] = [];

  const push = (
    placement: string,
    item: PublishedRankingEntry | PublishedProductCard,
    productId: string,
  ) => {
    if (item.affiliateUrl === undefined) return;
    links.push({
      slotKey: slotKeyFor(placement, productId),
      destinationUrl: item.affiliateUrl,
      siteSlug: article.siteSlug,
      articlePath,
      placement,
      productId,
      trackingCode: item.trackingCode ?? null,
    });
  };

  for (const entry of article.ranking?.entries ?? []) push("ranking", entry, entry.productId);
  for (const card of article.productCards ?? []) push("product_card", card, card.productId);
  return links;
}

/**
 * 発行された合言葉を記事へ埋め戻す。
 *
 * **`affiliateUrl` には一切触らない。** 合言葉を足すだけで、
 * ASP が発行した URL は 1 文字も変えない（変えると規約違反になり、
 * 成果そのものが計上されなくなる）。
 *
 * 埋まらなかったものは `trackingCode` が無いまま残る。空文字を入れて
 * 「発行済みに見える」状態にしない。無いことは、数えられるように残す。
 */
export function applyTrackingCodes(
  article: PublishedArticle,
  codes: ReadonlyMap<string, string>,
): PublishedArticle {
  const withCode = <T extends { readonly productId: string; readonly trackingCode?: string }>(
    placement: string,
    item: T,
  ): T => {
    const code = codes.get(slotKeyFor(placement, item.productId));
    return code === undefined ? item : { ...item, trackingCode: code };
  };

  return {
    ...article,
    ...(article.ranking === undefined
      ? {}
      : {
          ranking: {
            ...article.ranking,
            entries: article.ranking.entries.map((e) => withCode("ranking", e)),
          },
        }),
    ...(article.productCards === undefined
      ? {}
      : { productCards: article.productCards.map((c) => withCode("product_card", c)) }),
  };
}

/**
 * 突合できるようになっている割合。
 *
 * **0 件になるまで、突合できるクリック計測は完成していない。**
 * 全部が一度に切り替わることはない（合言葉を持たない記事は、
 * もう一度出すまで ASP の URL を直に出し続ける）。切り替わっていない分が
 * 何件あるかを出しておかないと、画面は普通に動くので誰も気づけない。
 */
export type TrackingCoverage = {
  /** 外向きリンクの総数。 */
  readonly total: number;
  /** そのうち合言葉が入っているもの（＝クリックを突合できるもの）。 */
  readonly tracked: number;
  /** 合言葉が無く、ASP の URL を直に出しているもの。 */
  readonly untracked: number;
  /** 未発行のリンクを抱えている記事の URL 名。多いときは先頭のみ。 */
  readonly untrackedArticles: readonly string[];
};

const UNTRACKED_ARTICLE_SAMPLE = 10;

export function countTrackingCoverage(
  articles: readonly PublishedArticle[],
): TrackingCoverage {
  let total = 0;
  let tracked = 0;
  const untrackedArticles: string[] = [];

  for (const article of articles) {
    const links = collectOutboundLinks(article);
    total += links.length;
    const trackedHere = links.filter((l) => l.trackingCode !== null).length;
    tracked += trackedHere;
    if (links.length > trackedHere && untrackedArticles.length < UNTRACKED_ARTICLE_SAMPLE) {
      untrackedArticles.push(`${article.siteSlug}/${article.slug}`);
    }
  }

  return { total, tracked, untracked: total - tracked, untrackedArticles };
}
