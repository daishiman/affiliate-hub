import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { SeoMeasurementArticlePort } from "@/application/ports/seo-measurement";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { publishedArticles, seoAiCitationAttempts, seoPageObservations } from "@/db/schema";
import { err, ok, validationError } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/** 編集専用一覧の上限・由来制限と分離し、測定対象の所属と順番をSQLで確定する。 */
export function createD1SeoMeasurementArticleRepository({ db, workspaceId }: { db: DrizzleD1; workspaceId: string }): SeoMeasurementArticlePort {
  return {
    async list(input) {
      if (!Number.isSafeInteger(input.limit) || input.limit < 1 || !input.siteSlug) return err(validationError("測定するブログと記事数を指定してください。"));
      try {
        // canonical URLが変わっても、同じ記事を複数回返さない。
        // AIは成功観測ではなく試行時刻で巡回する。失敗ページだけが先頭へ残り続けないためである。
        const observed = input.source === "ai_citation"
          ? db.select({ articleSlug: seoAiCitationAttempts.articleSlug,
              lastCollectedAt: seoAiCitationAttempts.lastAttemptedAt,
            }).from(seoAiCitationAttempts).where(and(
              eq(seoAiCitationAttempts.workspaceId, workspaceId),
              eq(seoAiCitationAttempts.siteSlug, input.siteSlug),
            )).as("observed")
          : db.select({ articleSlug: seoPageObservations.articleSlug,
              lastCollectedAt: sql<number>`max(${seoPageObservations.lastCollectedAt})`.as("last_collected_at"),
            }).from(seoPageObservations).where(and(
              eq(seoPageObservations.workspaceId, workspaceId), eq(seoPageObservations.siteSlug, input.siteSlug),
              eq(seoPageObservations.source, input.source),
            )).groupBy(seoPageObservations.articleSlug).as("observed");
        const rows = await db.select({ articleJson: publishedArticles.articleJson }).from(publishedArticles)
          .leftJoin(observed, eq(observed.articleSlug, publishedArticles.slug)).where(and(
            eq(publishedArticles.workspaceId, workspaceId), eq(publishedArticles.siteSlug, input.siteSlug), isNull(publishedArticles.archivedAt),
          ))
          // SQLiteのASCはNULLが先。所見0件でも成功観測日時を記録するため順番が回る。
          .orderBy(asc(observed.lastCollectedAt), asc(publishedArticles.slug)).limit(input.limit);
        return ok(rows.map(row => JSON.parse(row.articleJson) as PublishedArticle));
      } catch (cause) { return storageFailure("測定対象の記事の取得", cause); }
    },
  };
}
