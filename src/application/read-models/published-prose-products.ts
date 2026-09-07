import { parseProse } from "@/domain/blogops";
import type { PublishedArticle } from "./published-article";

/** 明示された本文形式だけを読む。旧記事の記法らしい文字から商品を推測しない。 */
export function publishedProseProductIds(article: PublishedArticle): readonly string[] {
  return [...new Set(article.sections.flatMap((section) => {
    const body = section.formattedBody;
    if (body?.format !== "prose-v1" || body.version !== 1 || typeof body.source !== "string") return [];
    return parseProse(body.source).flatMap((node) =>
      node.kind === "product-card" && node.productId.trim() !== "" ? [node.productId] : [],
    );
  }))];
}
