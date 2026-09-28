import type { AutoApplyLogEntry } from "@/application/ports/seo-measurement";
import type { SeoAutoApplyLogRow } from "@/db/schema";
import type { Finding, PageKey } from "@/domain/seo/aeo-measurement";

/** 壊れた復元記録を空の成功に変えない、履歴の共通デコード。 */
export function toLogEntry(row: SeoAutoApplyLogRow): AutoApplyLogEntry | null {
  let justifiedBy: readonly Finding[];
  let snapshot: AutoApplyLogEntry["snapshot"];
  try {
    justifiedBy = JSON.parse(row.justifiedByJson) as readonly Finding[];
    snapshot = JSON.parse(row.snapshotJson) as AutoApplyLogEntry["snapshot"];
  } catch {
    return null;
  }
  if (typeof snapshot?.articleJson !== "string") return null;

  return {
    id: row.id,
    pageKey: row.pageKey as PageKey,
    siteSlug: row.siteSlug,
    articleSlug: row.articleSlug,
    justifiedBy,
    snapshot,
    diffSummary: row.diffSummary,
    appliedAt: row.appliedAt.toISOString(),
    revertedAt: row.revertedAt?.toISOString() ?? null,
    notifiedAt: row.notifiedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    afterRevision: row.afterRevision,
  };
}

