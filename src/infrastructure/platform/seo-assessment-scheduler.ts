import { and, asc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { IdGeneratorPort, PortResult } from "@/application/ports/common";
import { publishedArticles, siteSeoAssessmentProgress } from "@/db/schema";
import * as schema from "@/db/schema";
import { createAuditLogEntry } from "@/domain/compliance/audit-log";
import { ok, taggedString, type AuditLogId, type WorkspaceId } from "@/domain/shared";
import { createArticleSeoAnalyzer } from "../improvement/article-seo-analyzer";
import { createD1AuditLog } from "../persistence/d1/audit-log-repository";
import type { DrizzleD1 } from "../persistence/d1/link-inbox-repository";
import { createD1SeoAssessmentRepository } from "../persistence/d1/seo-assessment-repository";
import { storageFailure } from "../persistence/d1/storage-failure";
import { idGenerator } from "./id-generator";

export const SCHEDULED_SEO_ASSESSMENT_LIMIT = 20;
export type ScheduledSeoSite = { readonly workspaceId: WorkspaceId; readonly siteSlug: string };
type Summary = { readonly assessedArticles: number; readonly findings: number };
type Stage = "attempt" | "assessment" | "audit" | "completion";

export type ScheduledSeoAssessmentDeps = {
  readonly listPending: (period: string, limit: number) => PortResult<readonly ScheduledSeoSite[]>;
  readonly markAttempted: (
    workspaceId: WorkspaceId,
    siteSlug: string,
    period: string,
    at: Date,
  ) => PortResult<true>;
  readonly assess: (workspaceId: WorkspaceId, siteSlug: string) => PortResult<Summary>;
  readonly auditLog: Pick<AuditLogPort, "append">;
  readonly markCompleted: (
    workspaceId: WorkspaceId,
    siteSlug: string,
    period: string,
    at: Date,
  ) => PortResult<true>;
  readonly ids: IdGeneratorPort;
};
export type ScheduledSeoAssessmentFailure = ScheduledSeoSite & {
  readonly stage: Stage;
  readonly message: string;
};
export type ScheduledSeoAssessmentResult = {
  readonly period: string;
  readonly scanned: number;
  readonly completed: number;
  readonly failed: number;
  readonly truncated: boolean;
  readonly failures: readonly ScheduledSeoAssessmentFailure[];
};

const failure = (target: ScheduledSeoSite, stage: Stage): ScheduledSeoAssessmentFailure => ({
  ...target,
  stage,
  // Never append underlying error text: storage errors may contain credentials.
  message: "定期 SEO 診断を完了できませんでした。",
});

/** Runs one monthly batch. Per-site failures remain retryable and do not stop later sites. */
export async function executeScheduledSeoAssessment(
  deps: ScheduledSeoAssessmentDeps,
  at: Date,
  limit = SCHEDULED_SEO_ASSESSMENT_LIMIT,
): Promise<ScheduledSeoAssessmentResult> {
  const period = at.toISOString().slice(0, 7);
  const pending = await deps.listPending(period, limit + 1);
  if (!pending.ok) throw new Error("SEO 診断の対象を読み込めませんでした。");
  const targets = pending.value.slice(0, limit);
  const failures: ScheduledSeoAssessmentFailure[] = [];
  let completed = 0;

  for (const target of targets) {
    if (!(await deps.markAttempted(target.workspaceId, target.siteSlug, period, at)).ok) {
      failures.push(failure(target, "attempt"));
      continue;
    }
    const assessed = await deps.assess(target.workspaceId, target.siteSlug);
    if (!assessed.ok || assessed.value.assessedArticles < 1) {
      failures.push(failure(target, "assessment"));
      continue;
    }
    const audit = createAuditLogEntry({
      id: taggedString<"AuditLogId">(`al_${deps.ids.newId()}`) as AuditLogId,
      workspaceId: target.workspaceId,
      action: "seo_assessment.ran",
      actor: {
        userId: taggedString<"UserId">("system:seo-assessment"),
        isAiServiceAccount: false,
        modelId: null,
        identified: false,
      },
      targetType: "seo_assessment",
      targetId: target.siteSlug,
      after: { scope: "site", period, ...assessed.value },
      occurredAt: at,
    });
    if (!audit.ok || !(await deps.auditLog.append(audit.value)).ok) {
      failures.push(failure(target, "audit"));
      continue;
    }
    if (!(await deps.markCompleted(target.workspaceId, target.siteSlug, period, at)).ok) {
      failures.push(failure(target, "completion"));
      continue;
    }
    completed += 1;
  }
  return {
    period,
    scanned: targets.length,
    completed,
    failed: failures.length,
    truncated: pending.value.length > limit,
    failures,
  };
}

const progressKey = [
  siteSeoAssessmentProgress.workspaceId,
  siteSeoAssessmentProgress.siteSlug,
  siteSeoAssessmentProgress.period,
];

async function saveProgress(
  db: DrizzleD1,
  workspaceId: WorkspaceId,
  siteSlug: string,
  period: string,
  at: Date,
  complete: boolean,
) {
  try {
    await db
      .insert(siteSeoAssessmentProgress)
      .values({
        workspaceId: String(workspaceId),
        siteSlug,
        period,
        lastAttemptedAt: at,
        completedAt: complete ? at : null,
      })
      .onConflictDoUpdate({
        target: progressKey,
        set: complete ? { completedAt: at } : { lastAttemptedAt: at },
      });
    return ok(true as const);
  } catch (cause) {
    return storageFailure(complete ? "SEO 診断の完了記録" : "SEO 診断の試行記録", cause);
  }
}

/** D1-only wiring for the Worker entry; do not replace with createDeps/composition. */
export function createD1ScheduledSeoAssessmentDeps(db: DrizzleD1): ScheduledSeoAssessmentDeps {
  const seo = createD1SeoAssessmentRepository({
    db,
    newId: idGenerator.newId,
    analyze: createArticleSeoAnalyzer(db),
    draft: async () => {
      throw new Error("定期診断は下書きを作りません。");
    },
  });
  return {
    async listPending(period, limit) {
      try {
        const rows = await db
          .selectDistinct({
            workspaceId: publishedArticles.workspaceId,
            siteSlug: publishedArticles.siteSlug,
          })
          .from(publishedArticles)
          .leftJoin(
            siteSeoAssessmentProgress,
            and(
              eq(siteSeoAssessmentProgress.workspaceId, publishedArticles.workspaceId),
              eq(siteSeoAssessmentProgress.siteSlug, publishedArticles.siteSlug),
              eq(siteSeoAssessmentProgress.period, period),
            ),
          )
          .where(and(isNull(publishedArticles.archivedAt), isNull(siteSeoAssessmentProgress.completedAt)))
          // SQLite ASC puts never-attempted NULL first, then oldest attempts.
          .orderBy(
            asc(siteSeoAssessmentProgress.lastAttemptedAt),
            asc(publishedArticles.workspaceId),
            asc(publishedArticles.siteSlug),
          )
          .limit(limit);
        return ok(
          rows.map(({ workspaceId, siteSlug }) => ({
            workspaceId: taggedString<"WorkspaceId">(workspaceId),
            siteSlug,
          })),
        );
      } catch (cause) {
        return storageFailure("SEO 診断対象の読み込み", cause);
      }
    },
    markAttempted: (workspaceId, siteSlug, period, at) =>
      saveProgress(db, workspaceId, siteSlug, period, at, false),
    async assess(workspaceId, siteSlug) {
      const result = await seo.assess(workspaceId, { kind: "site", siteSlug });
      return result.ok
        ? ok({ assessedArticles: result.value.assessedArticles, findings: result.value.findings.length })
        : result;
    },
    auditLog: createD1AuditLog(db),
    markCompleted: (workspaceId, siteSlug, period, at) =>
      saveProgress(db, workspaceId, siteSlug, period, at, true),
    ids: idGenerator,
  };
}

export async function runScheduledSeoAssessment(binding: D1Database, at: Date) {
  const db = drizzle(binding, { schema });
  return executeScheduledSeoAssessment(createD1ScheduledSeoAssessmentDeps(db), at);
}
