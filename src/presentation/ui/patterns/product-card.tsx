import { AffiliateLink } from "./disclosure";
import { FactualityBadge } from "./factuality";
import styles from "./patterns.module.css";

/**
 * 商品カード（要求仕様 §30.5・記事構成 `product_cards`）。
 *
 * 記事の中で商品 1 つを同じ形で見せる。
 *
 * **同じ形で並べることそのものが要件。** 商品ごとに項目が違うと、
 * 読者は比べられず、「よく書かれている方」を選ぶことになる。
 * だから項目の並びは呼び出し側で変えられない形にしてある。
 *
 * 部品側で必ず守る決めごとが 3 つ。
 *   1. 買う導線は [[AffiliateLink]] を通す（`rel="sponsored"` の付け忘れを起こさない）
 *   2. 数値には事実か推測かの区別を付ける（[[FactualityBadge]]）
 *   3. 値が無い欄は空白にせず「未計測」と書く
 *      （空白は「無い」と「測っていない」の区別が付かない）
 */
export type ProductCardSpec = {
  readonly label: string;
  /** 値。未計測なら null。 */
  readonly value: string | null;
  /** 実測値か、公表仕様などからの推測か。 */
  readonly basis: "fact" | "inference";
};

export function ProductCard({
  name,
  brand,
  oneLine,
  specs,
  priceNote,
  affiliateHref,
  affiliateLabel = "販売ページで確認する",
  blockedReason,
  detailHref,
}: {
  readonly name: string;
  readonly brand: string;
  /** その商品を 1 文で説明したもの。 */
  readonly oneLine: string;
  readonly specs: readonly ProductCardSpec[];
  /**
   * 価格の扱い。金額そのものは書かない。
   * 書き写した価格は必ず古くなり、古い価格の掲載を禁じる ASP が多い。
   */
  readonly priceNote?: string;
  /** ASP が発行した URL。**ここで加工しない。** */
  readonly affiliateHref?: string;
  readonly affiliateLabel?: string;
  /** 買う導線を出せない理由（提携終了・リンク切れなど）。黙って消さない。 */
  readonly blockedReason?: string;
  readonly detailHref?: string;
}) {
  return (
    <article className={styles.productCard} aria-label={`${brand} ${name}`}>
      <header className={styles.productCardHeader}>
        <span className={styles.productCardBrand}>{brand}</span>
        <h3 className={styles.productCardName}>
          {detailHref === undefined ? name : <a href={detailHref}>{name}</a>}
        </h3>
        <p className={styles.productCardLead}>{oneLine}</p>
      </header>

      <dl className={styles.productCardSpecs}>
        {specs.map((spec) => (
          <div key={spec.label} className={styles.productCardSpec}>
            <dt className={styles.productCardSpecLabel}>{spec.label}</dt>
            <dd className={styles.productCardSpecValue}>
              {spec.value === null ? (
                <span className={styles.productCardMissing}>未計測</span>
              ) : (
                <>
                  <span>{spec.value}</span>
                  <FactualityBadge kind={spec.basis} />
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {priceNote !== undefined && <p className={styles.productCardPrice}>{priceNote}</p>}

      <footer className={styles.productCardFooter}>
        {affiliateHref !== undefined ? (
          <AffiliateLink href={affiliateHref}>{affiliateLabel}</AffiliateLink>
        ) : (
          <span className={styles.productCardBlocked}>
            {blockedReason ?? "販売ページへの案内は、いま用意できていません。"}
          </span>
        )}
      </footer>
    </article>
  );
}
