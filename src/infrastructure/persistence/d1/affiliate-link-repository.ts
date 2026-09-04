import { and, eq, inArray } from "drizzle-orm";
import type { EditorialArticleOfferPort } from "@/application/ports/site";
import { type ArticleOffer, toArticleOffer } from "@/application/read-models/article-offer";
import type { AffiliateLink } from "@/domain/monetization";
import {
  asAffiliateLinkId,
  asWorkspaceId,
  markEditorial,
  ok,
  taggedString,
  type AffiliateProgramId,
  type ProductId,
} from "@/domain/shared";
import { type AffiliateLinkRow, affiliateLinks } from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 成果リンクの保存先（D1）から、記事に載せる写しを引く。
 *
 * **これはスタブではない。** 公開の手続きが実際に読む実装である。
 *
 * --- なぜ読み口しか無いのか ---
 * この口は記事を組み立てるために使う。書き口を同じ口に足すと、
 * 記事の組み立て側から転送先を書き換えられる経路が型の上で作れる。
 * 成果リンクを作る口は提携側（Commercial）にあり、そちらとは別物である。
 *
 * --- なぜ Editorial の印を付けて返すのか ---
 * 返すのは商品名と ASP の URL だけで、報酬額を持たない
 * （[[ArticleOffer]] に欄が無い）。報酬を持たない形にしてあるから、
 * 記事の組み立てへ渡してよい。印はその宣言である。
 *
 * 規範: tasks/task-publish-article-affiliate-links.md、docs/spec/01-要求仕様書-v1.0.md §19.2
 */

/** 行 → ドメイン。使えるかどうかの判定はここでせず、写しを作る側に任せる。 */
function toDomain(row: AffiliateLinkRow): AffiliateLink {
  return {
    id: asAffiliateLinkId(row.id),
    workspaceId: asWorkspaceId(row.workspaceId),
    programId: taggedString<"AffiliateProgramId">(row.programId) as AffiliateProgramId,
    productId: row.productId === null ? null : (taggedString<"ProductId">(row.productId) as ProductId),
    merchantId: null,
    originalUrl: row.originalUrl,
    alterationProhibited: row.alterationProhibited,
    trackingRef: row.trackingRef,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    disabledAt: row.disabledAt,
  };
}

export function createD1ArticleOfferReader(db: DrizzleD1): EditorialArticleOfferPort {
  return markEditorial({
    async listByIds(workspaceId, affiliateLinkIds, at) {
      if (affiliateLinkIds.length === 0) return ok([]);
      try {
        const rows = await db
          .select()
          .from(affiliateLinks)
          .where(
            and(
              // **作業場所で必ず絞る。** 絞らないと、ID を知っているだけで
              // 他の作業場所のリンクを記事に出せてしまう。
              eq(affiliateLinks.workspaceId, String(workspaceId)),
              inArray(affiliateLinks.id, [...affiliateLinkIds]),
            ),
          );
        const byId = new Map(rows.map((row) => [row.id, row]));
        // **版が並べた順のまま返す。** 保存先の返す順に任せると、
        // 記事を出し直すたびに商品の並びが変わる。
        const offers: ArticleOffer[] = [];
        for (const id of affiliateLinkIds) {
          const row = byId.get(id);
          if (row === undefined) continue;
          offers.push(
            toArticleOffer(
              toDomain(row),
              { productName: row.productName, brand: row.brand, oneLine: row.oneLine },
              at,
            ),
          );
        }
        return ok(offers as readonly ArticleOffer[]);
      } catch (cause) {
        return storageFailure("成果リンクの読み取り", cause);
      }
    },
  });
}
