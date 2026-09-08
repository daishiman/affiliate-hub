import { and, eq, inArray } from "drizzle-orm";
import { catalogProducts } from "@/db/schema";
import type { PublishedArticle, PublishedProductCard } from "@/application/read-models/published-article";
import { publishedProseProductIds } from "@/application/read-models/published-prose-products";
import type { DrizzleD1 } from "./link-inbox-repository";

/** 公開行のworkspaceだけで商品を解決する。記事ごとの名称コピーや見本の混入を避ける。 */
export async function resolvePublishedProseProducts(
  db: DrizzleD1,
  workspaceId: string,
  article: PublishedArticle,
): Promise<PublishedArticle> {
  const ids = publishedProseProductIds(article);
  if (ids.length === 0) return article;
  const cards = new Map<string, PublishedProductCard>();
  // D1のバインド数上限以内で、必要な公開項目だけをまとめて取得する。
  for (let index = 0; index < ids.length; index += 80) {
    const rows = await db.select({
      productId: catalogProducts.id,
      name: catalogProducts.name,
      brand: catalogProducts.brand,
      description: catalogProducts.description,
    }).from(catalogProducts).where(and(
      eq(catalogProducts.workspaceId, workspaceId),
      inArray(catalogProducts.id, ids.slice(index, index + 80)),
    ));
    for (const row of rows) {
      const published = article.productCards?.find((card) => card.productId === row.productId);
      cards.set(row.productId, {
        ...published,
        productId: row.productId, name: row.name, brand: row.brand,
        oneLine: row.description ?? published?.oneLine ?? "",
        specs: published?.specs ?? [],
      });
    }
  }
  return { ...article, inlineProductCards: ids.flatMap((id) => {
    const card = cards.get(id);
    return card === undefined ? [] : [card];
  }) };
}
