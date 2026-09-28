import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { SeoArticleRevisionPort, SeoArticleState } from "@/application/ports/seo-measurement";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { articles, publishedArticles, seoAutoApplyLogs, seoFindings, seoMeasurementSettings } from "@/db/schema";
import { AUTO_APPLY_COOLDOWN_MS, isArticleAutoFixable } from "@/domain/seo/aeo-measurement";
import { domainError, err, ok, validationError } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { toLogEntry } from "./seo-auto-apply-log";
import { publishedArticleRevisionStatement } from "./published-article-repository";
import { storageFailure } from "./storage-failure";

type SourceSnapshot = { id: string; revision: number; title: string; lead: string; updatedAt: string };
const conflict = () => err(domainError("CONFLICT", "記事・所見または設定が確認時から変わりました。最新の差分を開き直してください。"));
function isGuardFailure(cause: unknown): boolean {
  for (let current = cause; current instanceof Error; current = current.cause) {
    if (current.message.includes("NOT NULL constraint failed: seo_auto_apply_log.snapshot_json")) return true;
  }
  return false;
}
function seconds(value: string): number { return Math.floor(Date.parse(value) / 1000); }
function sourceSnapshot(value: string | null): SourceSnapshot | null {
  if (value === null) return null;
  const parsed = JSON.parse(value) as Partial<SourceSnapshot>;
  if (typeof parsed.id !== "string" || typeof parsed.revision !== "number" || typeof parsed.title !== "string" || typeof parsed.lead !== "string" || typeof parsed.updatedAt !== "string") throw new Error("invalid_source_snapshot");
  return parsed as SourceSnapshot;
}

/**
 * 承認1回をD1 batchの1 transactionに閉じる。
 * 最初の履歴書込のNOT NULL制約を条件ゲートに使い、CAS不一致を0件成功にしない。
 * その後のいずれかの書込が失敗しても、履歴・編集元・公開内容・所見を全てrollbackする。
 */
export function createD1SeoArticleRevisionRepository({ db, workspaceId }: { db: DrizzleD1; workspaceId: string }): SeoArticleRevisionPort {
  function publicGuard(state: SeoArticleState, articleJson: string): SQL {
    const source = state.sourceArticleId === null
      ? sql`${publishedArticles.sourceArticleId} IS NULL`
      : sql`${publishedArticles.sourceArticleId} = ${state.sourceArticleId}`;
    return sql`EXISTS (SELECT 1 FROM ${publishedArticles}
      WHERE ${publishedArticles.workspaceId} = ${workspaceId}
      AND ${publishedArticles.siteSlug} = ${state.article.siteSlug} AND ${publishedArticles.slug} = ${state.article.slug}
      AND ${publishedArticles.revision} = ${state.revision} AND ${publishedArticles.articleJson} = ${articleJson}
      AND ${publishedArticles.archivedAt} IS NULL AND ${source})`;
  }
  function sourceGuard(state: SeoArticleState): SQL {
    if (state.sourceArticleId === null) return sql`1`;
    return sql`EXISTS (SELECT 1 FROM ${articles}
      WHERE ${articles.workspaceId} = ${workspaceId} AND ${articles.siteSlug} = ${state.article.siteSlug}
      AND ${articles.id} = ${state.sourceArticleId} AND ${articles.slug} = ${state.article.slug}
      AND ${articles.revision} = ${state.sourceRevision} AND ${articles.status} = 'published' AND ${articles.deletedAt} IS NULL)`;
  }
  return {
    async find(input) {
      try {
        const [row] = await db.select({ published: publishedArticles, sourceCreatedAt: articles.createdAt, sourceRevision: articles.revision })
          .from(publishedArticles).leftJoin(articles, and(
            eq(articles.workspaceId, workspaceId), eq(articles.id, publishedArticles.sourceArticleId),
            eq(articles.siteSlug, publishedArticles.siteSlug), eq(articles.slug, publishedArticles.slug),
          )).where(and(eq(publishedArticles.workspaceId, workspaceId), eq(publishedArticles.siteSlug, input.siteSlug), eq(publishedArticles.slug, input.articleSlug))).limit(1);
        if (!row) return ok(null);
        const published = row.published;
        return ok({ article: JSON.parse(published.articleJson) as PublishedArticle, archivedAt: published.archivedAt,
          createdAt: published.sourceArticleId === null ? published.createdAt : row.sourceCreatedAt?.toISOString() ?? null,
          revision: published.revision, sourceArticleId: published.sourceArticleId, sourceRevision: row.sourceRevision });
      } catch (cause) { return storageFailure("記事の現在の版の取得", cause); }
    },

    async applyApproved(input) {
      const { before, after, plan, appliedCodes } = input;
      const beforeJson = JSON.stringify(before.article);
      const unchanged = { ...after, title: before.article.title, summary: before.article.summary, updatedAt: before.article.updatedAt };
      if (JSON.stringify(unchanged) !== beforeJson || plan.snapshot.articleJson !== beforeJson || before.archivedAt !== null ||
          !before.createdAt || !Number.isFinite(Date.parse(before.createdAt)) || !Number.isFinite(Date.parse(plan.appliedAt)) ||
          !input.approvedBy.trim() || appliedCodes.length === 0 || new Set(appliedCodes).size !== appliedCodes.length ||
          appliedCodes.some(code => !isArticleAutoFixable(code)) ||
          plan.justifiedBy.length !== appliedCodes.length || new Set(plan.justifiedBy.map(finding => finding.code)).size !== appliedCodes.length ||
          appliedCodes.some(code => code === "missing_title" ? before.article.title.trim() !== "" || after.title.trim() === "" : before.article.summary.trim() !== "" || after.summary.trim() === "") ||
          plan.justifiedBy.some(finding => finding.pageKey !== plan.snapshot.pageKey ||
            finding.source !== "static_audit" || !appliedCodes.includes(finding.code) || (!Number.isFinite(Date.parse(finding.observedAt)) || Date.parse(finding.observedAt) % 1000 !== 0)) ||
          (after.title !== before.article.title) !== appliedCodes.includes("missing_title") ||
          (after.summary !== before.article.summary) !== appliedCodes.includes("missing_meta_description")) {
        return err(validationError("反映する差分と現在の対象記事・根拠を確認できません。差分を作り直してください。"));
      }
      try {
        let source: SourceSnapshot | null = null;
        if (before.sourceArticleId !== null) {
          const [row] = await db.select().from(articles).where(and(eq(articles.workspaceId, workspaceId), eq(articles.siteSlug, before.article.siteSlug), eq(articles.id, before.sourceArticleId))).limit(1);
          if (!row || row.revision !== before.sourceRevision) return conflict();
          const nextLead = after.summary === before.article.summary ? row.lead : after.summary;
          if (row.title !== before.article.title || (row.lead.trim() || row.title) !== before.article.summary ||
              (nextLead.trim() || after.title) !== after.summary) return conflict();
          source = { id: row.id, revision: row.revision, title: row.title, lead: row.lead, updatedAt: row.updatedAt.toISOString() };
        }
        const exactFindings = plan.justifiedBy.map(finding => sql`EXISTS (SELECT 1 FROM ${seoFindings}
          WHERE ${seoFindings.workspaceId} = ${workspaceId} AND ${seoFindings.siteSlug} = ${after.siteSlug}
          AND ${seoFindings.articleSlug} = ${after.slug} AND ${seoFindings.pageKey} = ${finding.pageKey}
          AND ${seoFindings.code} = ${finding.code} AND ${seoFindings.source} = ${finding.source}
          AND ${seoFindings.detail} = ${finding.detail} AND ${seoFindings.observedAt} = ${seconds(finding.observedAt)}
          AND ${seoFindings.appliedAt} IS NULL)`);
        const actualCreatedAt = source === null
          ? sql`(SELECT unixepoch(${publishedArticles.createdAt}) FROM ${publishedArticles} WHERE ${publishedArticles.workspaceId} = ${workspaceId} AND ${publishedArticles.siteSlug} = ${after.siteSlug} AND ${publishedArticles.slug} = ${after.slug})`
          : sql`(SELECT ${articles.createdAt} FROM ${articles} WHERE ${articles.workspaceId} = ${workspaceId} AND ${articles.id} = ${source.id})`;
        const guard = sql`${publicGuard(before, beforeJson)} AND ${sourceGuard(before)} AND ${sql.join(exactFindings, sql` AND `)}
          AND EXISTS (SELECT 1 FROM ${seoMeasurementSettings} WHERE ${seoMeasurementSettings.workspaceId} = ${workspaceId}
            AND ${seoMeasurementSettings.autoApplyPaused} = 0 AND ${seoMeasurementSettings.introducedAt} <= ${actualCreatedAt})
          AND NOT EXISTS (SELECT 1 FROM ${seoAutoApplyLogs} WHERE ${seoAutoApplyLogs.workspaceId} = ${workspaceId}
            AND ${seoAutoApplyLogs.pageKey} = ${plan.snapshot.pageKey} AND ${seoAutoApplyLogs.revertedAt} IS NULL
            AND ${seoAutoApplyLogs.appliedAt} > ${seconds(plan.appliedAt) - AUTO_APPLY_COOLDOWN_MS / 1000})`;
        const id = `sal_${crypto.randomUUID()}`;
        const row = { id, workspaceId, siteSlug: after.siteSlug, articleSlug: after.slug, pageKey: plan.snapshot.pageKey,
          justifiedByJson: JSON.stringify(plan.justifiedBy), snapshotJson: sql`CASE WHEN ${guard} THEN ${JSON.stringify(plan.snapshot)} ELSE NULL END`,
          diffSummary: input.diffSummary, appliedAt: new Date(plan.appliedAt), approvedBy: input.approvedBy,
          afterRevision: before.revision + 1, afterArticleJson: JSON.stringify(after),
          sourceSnapshotJson: source ? JSON.stringify(source) : null, sourceAfterRevision: source ? source.revision + 1 : null };
        const batch: BatchItem<"sqlite">[] = [db.insert(seoAutoApplyLogs).values(row).returning()];
        if (source) batch.push(db.update(articles).set({ title: after.title,
          lead: after.summary === before.article.summary ? source.lead : after.summary,
          updatedAt: new Date(after.updatedAt), revision: source.revision + 1, saveToken: id,
        }).where(and(eq(articles.workspaceId, workspaceId), eq(articles.siteSlug, after.siteSlug), eq(articles.id, source.id), eq(articles.revision, source.revision), isNull(articles.deletedAt))));
        batch.push(publishedArticleRevisionStatement(db, workspaceId, after, before.revision));
        for (const finding of plan.justifiedBy) batch.push(db.update(seoFindings).set({ appliedAt: new Date(plan.appliedAt) }).where(and(
          eq(seoFindings.workspaceId, workspaceId), eq(seoFindings.siteSlug, after.siteSlug), eq(seoFindings.articleSlug, after.slug),
          eq(seoFindings.pageKey, finding.pageKey), eq(seoFindings.code, finding.code), eq(seoFindings.source, finding.source),
          eq(seoFindings.detail, finding.detail), eq(seoFindings.observedAt, new Date(finding.observedAt)), isNull(seoFindings.appliedAt),
        )));
        const results = await db.batch(batch as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
        const [saved] = results[0] as (typeof seoAutoApplyLogs.$inferSelect)[];
        const log = toLogEntry(saved);
        return log ? ok(log) : err(validationError("反映履歴が読み取れません。"));
      } catch (cause) { return isGuardFailure(cause) ? conflict() : storageFailure("差分の反映", cause); }
    },

    async revert(input) {
      if (!input.revertedBy.trim() || !Number.isFinite(Date.parse(input.at))) return err(validationError("取消の実行者と日時を確認できません。"));
      try {
        const [row] = await db.select().from(seoAutoApplyLogs).where(and(eq(seoAutoApplyLogs.workspaceId, workspaceId), eq(seoAutoApplyLogs.id, input.logId))).limit(1);
        if (!row) return err(domainError("NOT_FOUND", "反映履歴が見つかりません。"));
        if (row.revertedAt) return conflict();
        const log = toLogEntry(row);
        if (!log || row.afterRevision === null || row.afterArticleJson === null || row.approvedBy === null) return err(validationError("この旧履歴には反映後の記録がないため、取り消せません。"));
        const source = sourceSnapshot(row.sourceSnapshotJson);
        if (source && row.sourceAfterRevision === null) return err(validationError("編集元の記録がないため、取り消せません。"));
        const after = JSON.parse(row.afterArticleJson) as PublishedArticle;
        const restore = JSON.parse(log.snapshot.articleJson) as PublishedArticle;
        if (after.siteSlug !== row.siteSlug || after.slug !== row.articleSlug || restore.siteSlug !== row.siteSlug || restore.slug !== row.articleSlug) return err(validationError("履歴と記事の対応が確認できません。"));
        const current: SeoArticleState = { article: after, archivedAt: null, createdAt: null, revision: row.afterRevision,
          sourceArticleId: source?.id ?? null, sourceRevision: row.sourceAfterRevision };
        const guard = sql`${publicGuard(current, row.afterArticleJson)} AND ${sourceGuard(current)}
          AND EXISTS (SELECT 1 FROM ${seoAutoApplyLogs} WHERE ${seoAutoApplyLogs.workspaceId} = ${workspaceId}
            AND ${seoAutoApplyLogs.id} = ${row.id} AND ${seoAutoApplyLogs.revertedAt} IS NULL
            AND ${seoAutoApplyLogs.afterRevision} = ${row.afterRevision} AND ${seoAutoApplyLogs.afterArticleJson} = ${row.afterArticleJson}
            AND ${seoAutoApplyLogs.snapshotJson} = ${row.snapshotJson})`;
        const guardedSnapshot = sql`CASE WHEN ${guard} THEN ${row.snapshotJson} ELSE NULL END`;
        // INSERT側にも同じゲートを置くため、読取後に履歴が消えても勝手に再作成しない。
        const batch: BatchItem<"sqlite">[] = [db.insert(seoAutoApplyLogs).values({ ...row, snapshotJson: guardedSnapshot })
          .onConflictDoUpdate({ target: seoAutoApplyLogs.id, set: { snapshotJson: guardedSnapshot, revertedAt: new Date(input.at), revertedBy: input.revertedBy } }).returning()];
        if (source) batch.push(db.update(articles).set({ title: source.title, lead: source.lead, updatedAt: new Date(source.updatedAt),
          revision: (row.sourceAfterRevision as number) + 1, saveToken: `revert_${crypto.randomUUID()}`,
        }).where(and(eq(articles.workspaceId, workspaceId), eq(articles.siteSlug, row.siteSlug), eq(articles.id, source.id), eq(articles.revision, row.sourceAfterRevision as number), isNull(articles.deletedAt))));
        batch.push(publishedArticleRevisionStatement(db, workspaceId, restore, row.afterRevision));
        const results = await db.batch(batch as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
        const [saved] = results[0] as (typeof seoAutoApplyLogs.$inferSelect)[];
        const reverted = toLogEntry(saved);
        return reverted ? ok(reverted) : err(validationError("取消履歴が読み取れません。"));
      } catch (cause) { return isGuardFailure(cause) ? conflict() : storageFailure("差分の取消", cause); }
    },
  };
}
