import { and, eq, inArray, not, or } from "drizzle-orm";
import type {
  AnswerUnitPort,
  AeoProfilePort,
  AssessmentTarget,
  EditorialAeoProfilePort,
  EditorialAnswerUnitPort,
  EditorialSeoAssessmentPort,
  SeoAssessmentPort,
} from "@/application/ports";
import { detectGaps, validateAnswerUnit, type AnswerUnit, type SiteAeoProfile } from "@/domain/aeo";
import { rankFindings, validateFinding, type SeoFinding } from "@/domain/seo/assessment";
import { domainError, err, isErr, markEditorial, ok, type WorkspaceId } from "@/domain/shared";
import {
  articleAnswerUnits,
  articleSeoAssessments,
  siteAeoProfiles,
  type ArticleAnswerUnitRow,
  type ArticleSeoAssessmentRow,
  type SiteAeoProfileRow,
} from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/** Analyzer receives tenant identity explicitly; repositories never infer it from a site slug. */
export type SeoAnalyzer = (
  workspaceId: WorkspaceId,
  target: AssessmentTarget,
) => Promise<{
  readonly findings: readonly Omit<SeoFinding, "id" | "state" | "assessedAt">[];
  readonly assessedArticles: number;
}>;

export type SeoDrafter = (
  workspaceId: WorkspaceId,
  finding: SeoFinding,
) => Promise<{ readonly draftRevisionId: string }>;

export type AnswerUnitExtractor = (
  workspaceId: WorkspaceId,
  siteSlug: string,
  articleSlug: string,
) => Promise<readonly Omit<AnswerUnit, "id" | "extractedAt">[]>;

function toFinding(row: ArticleSeoAssessmentRow): SeoFinding {
  return {
    id: row.id,
    siteSlug: row.siteSlug,
    articleSlug: row.articleSlug,
    checkKind: row.checkKind,
    severity: row.severity,
    state: row.state,
    detail: row.detail,
    evidence: row.evidence,
    suggestion: row.suggestion,
    assessedAt: row.assessedAt,
  };
}

function toAnswerUnit(row: ArticleAnswerUnitRow): AnswerUnit {
  return {
    id: row.id,
    siteSlug: row.siteSlug,
    articleSlug: row.articleSlug,
    kind: row.kind,
    question: row.question,
    answer: row.answer,
    positionRatio: row.positionRatio,
    sourceRef: row.sourceRef,
    extractedAt: row.extractedAt,
  };
}

function toProfile(row: SiteAeoProfileRow): SiteAeoProfile {
  return {
    siteSlug: row.siteSlug,
    topicScope: row.topicScope,
    audience: row.audience,
    publisherName: row.publisherName,
    structuredDataEnabled: row.structuredDataEnabled,
    updatedAt: row.updatedAt,
  };
}

export function createD1SeoAssessmentRepository(deps: {
  readonly db: DrizzleD1;
  readonly newId: () => string;
  readonly analyze: SeoAnalyzer;
  readonly draft: SeoDrafter;
}): EditorialSeoAssessmentPort {
  const { db, newId, analyze, draft } = deps;

  const port: SeoAssessmentPort = {
    async assess(workspaceId, target) {
      try {
        const run = await analyze(workspaceId, target);
        const now = new Date();

        for (const finding of run.findings) {
          const valid = validateFinding(finding);
          if (isErr(valid)) return valid;
        }

        const upserts = run.findings.map((finding) => {
          const values = {
            severity: finding.severity,
            detail: finding.detail,
            evidence: finding.evidence,
            suggestion: finding.suggestion,
            assessedAt: now,
            updatedAt: now,
          };
          return db
            .insert(articleSeoAssessments)
            .values({
              id: newId(),
              workspaceId: String(workspaceId),
              siteSlug: finding.siteSlug,
              articleSlug: finding.articleSlug,
              checkKind: finding.checkKind,
              state: "open",
              ...values,
            })
            .onConflictDoUpdate({
              target: [
                articleSeoAssessments.workspaceId,
                articleSeoAssessments.siteSlug,
                articleSeoAssessments.articleSlug,
                articleSeoAssessments.checkKind,
              ],
              set: values,
            });
        });

        const scope = and(
          eq(articleSeoAssessments.workspaceId, String(workspaceId)),
          eq(articleSeoAssessments.siteSlug, target.siteSlug),
          eq(articleSeoAssessments.state, "open"),
          target.kind === "article"
            ? eq(articleSeoAssessments.articleSlug, target.articleSlug)
            : undefined,
        );
        const currentKeys = or(
          ...run.findings.map((finding) =>
            and(
              eq(articleSeoAssessments.articleSlug, finding.articleSlug),
              eq(articleSeoAssessments.checkKind, finding.checkKind),
            ),
          ),
        );
        const removeStaleOpen = db
          .delete(articleSeoAssessments)
          .where(currentKeys === undefined ? scope : and(scope, not(currentKeys)));

        // Stale-open deletion and upserts are one transaction; non-open decisions survive.
        await db.batch([removeStaleOpen, ...upserts]);

        const saved = await db
          .select()
          .from(articleSeoAssessments)
          .where(
            and(
              eq(articleSeoAssessments.workspaceId, String(workspaceId)),
              eq(articleSeoAssessments.siteSlug, target.siteSlug),
              target.kind === "article"
                ? eq(articleSeoAssessments.articleSlug, target.articleSlug)
                : undefined,
            ),
          );

        const currentKeySet = new Set(
          run.findings.map((finding) => `${finding.articleSlug}\u0000${finding.checkKind}`),
        );
        return ok({
          // The run count excludes preserved decisions absent from this analyzer result.
          findings: rankFindings(
            saved
              .map(toFinding)
              .filter((finding) =>
                currentKeySet.has(`${finding.articleSlug}\u0000${finding.checkKind}`),
              ),
          ),
          assessedArticles: run.assessedArticles,
          ranAt: now,
        });
      } catch (cause) {
        return storageFailure("SEO 診断の保存", cause);
      }
    },

    async listOpen(workspaceId, siteSlug) {
      try {
        const rows = await db
          .select()
          .from(articleSeoAssessments)
          .where(
            and(
              eq(articleSeoAssessments.workspaceId, String(workspaceId)),
              eq(articleSeoAssessments.siteSlug, siteSlug),
              inArray(articleSeoAssessments.state, ["open", "drafted"]),
            ),
          );
        return ok(rankFindings(rows.map(toFinding)));
      } catch (cause) {
        return storageFailure("SEO 指摘の読み出し", cause);
      }
    },

    async draftFix(workspaceId, findingId) {
      try {
        const rows = await db
          .select()
          .from(articleSeoAssessments)
          .where(
            and(
              eq(articleSeoAssessments.workspaceId, String(workspaceId)),
              eq(articleSeoAssessments.id, findingId),
            ),
          )
          .limit(1);
        const row = rows[0];
        if (row === undefined) {
          return err(
            domainError("NOT_FOUND", "この指摘は見つかりませんでした。", {
              suggestedAction: "一覧を開き直してください。",
            }),
          );
        }
        if (row.state === "dismissed") {
          return err(
            domainError("VALIDATION_FAILED", "「対応しない」とした指摘からは下書きを作れません。", {
              suggestedAction: "もう一度対応するなら、先に指摘を戻してください。",
            }),
          );
        }

        const { draftRevisionId } = await draft(workspaceId, toFinding(row));
        await db
          .update(articleSeoAssessments)
          .set({ state: "drafted", draftRevisionId, updatedAt: new Date() })
          .where(
            and(
              eq(articleSeoAssessments.workspaceId, String(workspaceId)),
              eq(articleSeoAssessments.id, findingId),
            ),
          );
        return ok({ draftRevisionId });
      } catch (cause) {
        return storageFailure("下書きの作成", cause);
      }
    },

    async dismiss(workspaceId, findingId, reason) {
      if (reason.trim() === "") {
        return err(
          domainError("VALIDATION_FAILED", "対応しない理由を入れてください。", {
            suggestedAction: "後から見た人が判断を追えるように、一言で書いてください。",
          }),
        );
      }
      try {
        await db
          .update(articleSeoAssessments)
          .set({ state: "dismissed", dismissedReason: reason, updatedAt: new Date() })
          .where(
            and(
              eq(articleSeoAssessments.workspaceId, String(workspaceId)),
              eq(articleSeoAssessments.id, findingId),
            ),
          );
        return ok(true as const);
      } catch (cause) {
        return storageFailure("指摘の見送り", cause);
      }
    },
  };

  return markEditorial(port);
}

export function createD1AeoProfileRepository(db: DrizzleD1): EditorialAeoProfilePort {
  const port: AeoProfilePort = {
    async get(workspaceId, siteSlug) {
      try {
        const rows = await db
          .select()
          .from(siteAeoProfiles)
          .where(
            and(
              eq(siteAeoProfiles.workspaceId, String(workspaceId)),
              eq(siteAeoProfiles.siteSlug, siteSlug),
            ),
          )
          .limit(1);
        return ok(rows.length === 0 ? null : toProfile(rows[0]));
      } catch (cause) {
        return storageFailure("AEO の構えの読み出し", cause);
      }
    },

    async save(workspaceId, profile) {
      try {
        const values = {
          topicScope: profile.topicScope,
          audience: profile.audience,
          publisherName: profile.publisherName,
          structuredDataEnabled: profile.structuredDataEnabled,
          updatedAt: new Date(),
        };
        const saved = await db
          .insert(siteAeoProfiles)
          .values({
            workspaceId: String(workspaceId),
            siteSlug: profile.siteSlug,
            ...values,
          })
          .onConflictDoUpdate({
            target: [siteAeoProfiles.workspaceId, siteAeoProfiles.siteSlug],
            set: values,
          })
          .returning();
        return ok(toProfile(saved[0]!));
      } catch (cause) {
        return storageFailure("AEO の構えの保存", cause);
      }
    },
  };

  return markEditorial(port);
}

export function createD1AnswerUnitRepository(deps: {
  readonly db: DrizzleD1;
  readonly newId: () => string;
  readonly extract: AnswerUnitExtractor;
}): EditorialAnswerUnitPort {
  const { db, newId, extract: extractUnits } = deps;

  const port: AnswerUnitPort = {
    async extract(workspaceId, siteSlug, articleSlug) {
      try {
        const units = await extractUnits(workspaceId, siteSlug, articleSlug);
        for (const unit of units) {
          const valid = validateAnswerUnit(unit);
          if (isErr(valid)) return valid;
        }
        const now = new Date();

        const statements = [
          db
            .delete(articleAnswerUnits)
            .where(
              and(
                eq(articleAnswerUnits.workspaceId, String(workspaceId)),
                eq(articleAnswerUnits.siteSlug, siteSlug),
                eq(articleAnswerUnits.articleSlug, articleSlug),
              ),
            ),
          ...units.map((unit) =>
            db.insert(articleAnswerUnits).values({
              id: newId(),
              workspaceId: String(workspaceId),
              siteSlug,
              articleSlug,
              kind: unit.kind,
              question: unit.question,
              answer: unit.answer,
              positionRatio: unit.positionRatio,
              sourceRef: unit.sourceRef,
              gaps: JSON.stringify(
                detectGaps({ ...unit, id: "", siteSlug, articleSlug, extractedAt: now }),
              ),
              extractedAt: now,
            }),
          ),
        ];
        await db.batch(statements as [(typeof statements)[number], ...typeof statements]);

        const saved = await db
          .select()
          .from(articleAnswerUnits)
          .where(
            and(
              eq(articleAnswerUnits.workspaceId, String(workspaceId)),
              eq(articleAnswerUnits.siteSlug, siteSlug),
              eq(articleAnswerUnits.articleSlug, articleSlug),
            ),
          );
        return ok(saved.map(toAnswerUnit));
      } catch (cause) {
        return storageFailure("引用単位の抽出", cause);
      }
    },

    async listForSite(workspaceId, siteSlug) {
      try {
        const rows = await db
          .select()
          .from(articleAnswerUnits)
          .where(
            and(
              eq(articleAnswerUnits.workspaceId, String(workspaceId)),
              eq(articleAnswerUnits.siteSlug, siteSlug),
            ),
          );
        return ok(rows.map(toAnswerUnit));
      } catch (cause) {
        return storageFailure("引用単位の読み出し", cause);
      }
    },

    async listForArticle(workspaceId, siteSlug, articleSlug) {
      try {
        const rows = await db
          .select()
          .from(articleAnswerUnits)
          .where(
            and(
              eq(articleAnswerUnits.workspaceId, String(workspaceId)),
              eq(articleAnswerUnits.siteSlug, siteSlug),
              eq(articleAnswerUnits.articleSlug, articleSlug),
            ),
          );
        return ok(rows.map(toAnswerUnit));
      } catch (cause) {
        return storageFailure("記事の引用単位の読み出し", cause);
      }
    },
  };

  return markEditorial(port);
}
