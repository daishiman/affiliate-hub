import { type AffiliateLink, isLinkUsable, isSafeDestination } from "@/domain/monetization";
import type { PublishedProductCard } from "./published-article";

/**
 * 記事に載せる成果リンクの、**読者に見せてよい部分だけ**の写し。
 *
 * 記事の版（`ContentVariant`）が持っているのは成果リンクの ID の列だけである。
 * 公開のときにここへ写し替えて、読者に出す商品カードを組み立てる。
 *
 * **報酬に関わる欄をここに置かない。** 置いた時点で、公開の手続きが
 * 「報酬の高い順に並べる」を書ける形になる。読者向けの読み取り経路に
 * 報酬額が現れないことを型で保証している（`published-article.ts` 冒頭と同じ約束）。
 *
 * 規範: tasks/task-publish-article-affiliate-links.md、docs/spec/03-分析・解析基盤仕様.md §1.2
 */
export type ArticleOffer = {
  readonly affiliateLinkId: string;
  /** どの商品か。商品に結びついていないリンクは、リンクの ID をそのまま鍵にする。 */
  readonly productId: string;
  readonly productName: string;
  readonly brand: string;
  readonly oneLine: string;
  /**
   * ASP が発行した URL。**加工せずそのまま。**
   *
   * 出せないとき（停止・期限切れ・https でない）は `undefined` にし、
   * `blockedReason` を必ず添える。URL を出したまま理由だけ添えると、
   * 切れたリンクを読者が踏む。
   */
  readonly destinationUrl?: string;
  /** 買う導線を出せない理由。**黙って消さない。** */
  readonly blockedReason?: string;
};

/** 保存先が持っている、読者に見せる文言。 */
export type ArticleOfferDisplay = {
  readonly productName: string;
  readonly brand: string | null;
  readonly oneLine: string | null;
};

/**
 * 成果リンク 1 件を、読者に見せる写しへ変える。
 *
 * **使えるかどうかの判定をここ 1 箇所に置く。** 保存先ごと（見本・D1）に
 * 書くと、片方だけ期限切れを素通ししたときに、そちらから公開した記事だけが
 * 切れたリンクを出す。画面は普通に見えるので、押した読者しか気づけない。
 *
 * 出せない理由は**読者に読める言葉**にする。読者に出るのはこの文言そのものである
 * （`view-model.ts` が `blockedReason` をそのままカードへ渡す）。
 */
export function toArticleOffer(
  link: AffiliateLink,
  display: ArticleOfferDisplay,
  at: Date,
): ArticleOffer {
  const base = {
    affiliateLinkId: String(link.id),
    productId: link.productId === null ? String(link.id) : String(link.productId),
    productName: display.productName,
    brand: display.brand ?? "",
    oneLine: display.oneLine ?? "",
  };
  if (!isLinkUsable(link, at)) {
    return {
      ...base,
      blockedReason: "この商品は、いま提携している販売先がありません。",
    };
  }
  if (!isSafeDestination(link.originalUrl)) {
    // 保存されている値が https でない。**直して出さない。**
    // 付け替えて通すと、保存側の不備が読者側で隠れ、誰も気づかないまま残る。
    return {
      ...base,
      blockedReason: "この商品の販売ページの登録が正しくありません。",
    };
  }
  return { ...base, destinationUrl: link.originalUrl };
}

/**
 * 写しを、読者に出す商品カードへ変える。
 *
 * **`specs` は空で置く。** 商品の仕様は商品の表（`products`）が持つもので、
 * 成果リンクからは分からない。埋めるふりをすると、リンクの登録内容が
 * 「実測した仕様」として読者に出る。空なら、部品側が何も並べない。
 */
export function toProductCards(
  offers: readonly ArticleOffer[],
): readonly PublishedProductCard[] {
  return offers.map((offer) => ({
    productId: offer.productId,
    name: offer.productName,
    brand: offer.brand,
    oneLine: offer.oneLine,
    specs: [],
    ...(offer.destinationUrl === undefined ? {} : { affiliateUrl: offer.destinationUrl }),
    ...(offer.blockedReason === undefined ? {} : { blockedReason: offer.blockedReason }),
  }));
}
