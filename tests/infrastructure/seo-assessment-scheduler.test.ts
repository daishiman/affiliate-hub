/**
 * @tier 1
 * @req REQ-BOPC04
 * @req feat-seo-assessment-reflection
 * @types boundary, idempotency, fault-injection, tenant-isolation
 */
import { describe, expect, it } from "vitest";
import { domainError, err, ok, type WorkspaceId } from "@/domain/shared";
import {
  executeScheduledSeoAssessment,
  SCHEDULED_SEO_ASSESSMENT_LIMIT,
  type ScheduledSeoAssessmentDeps,
  type ScheduledSeoSite,
} from "@/infrastructure/platform/seo-assessment-scheduler";
import { recordingAuditLog } from "../support/doubles";

const site = (workspaceId: string, siteSlug: string): ScheduledSeoSite => ({
  workspaceId: workspaceId as WorkspaceId,
  siteSlug,
});

function harness(input: {
  readonly sites?: readonly ScheduledSeoSite[];
  readonly failAssessment?: ReadonlySet<string>;
  readonly failAttempt?: ReadonlySet<string>;
  readonly failAudit?: ReadonlySet<string>;
  readonly failCompletion?: ReadonlySet<string>;
  readonly findings?: number;
}) {
  const sites = input.sites ?? [site("ws_alpha", "alpha")];
  const completions = new Set<string>();
  const attempts = new Map<string, Date>();
  const assessed: string[] = [];
  const steps: string[] = [];
  const audit = recordingAuditLog();
  let ids = 0;
  const keyOf = (target: ScheduledSeoSite, period: string) =>
    `${String(target.workspaceId)}\u0000${target.siteSlug}\u0000${period}`;

  const deps: ScheduledSeoAssessmentDeps = {
    async listPending(period, limit) {
      return ok(
        [...sites]
          .filter((target) => !completions.has(keyOf(target, period)))
          .sort((left, right) => {
            const leftAttempt = attempts.get(keyOf(left, period));
            const rightAttempt = attempts.get(keyOf(right, period));
            if (leftAttempt === undefined && rightAttempt !== undefined) return -1;
            if (leftAttempt !== undefined && rightAttempt === undefined) return 1;
            const byAttempt = (leftAttempt?.getTime() ?? 0) - (rightAttempt?.getTime() ?? 0);
            return byAttempt === 0
              ? `${String(left.workspaceId)}/${left.siteSlug}`.localeCompare(
                  `${String(right.workspaceId)}/${right.siteSlug}`,
                )
              : byAttempt;
          })
          .slice(0, limit),
      );
    },
    async markAttempted(workspaceId, siteSlug, period, attemptedAt) {
      steps.push(`attempt:${siteSlug}`);
      if (input.failAttempt?.has(siteSlug)) {
        return err(domainError("UPSTREAM_UNAVAILABLE", "password=do-not-return"));
      }
      attempts.set(keyOf({ workspaceId, siteSlug }, period), attemptedAt);
      return ok(true as const);
    },
    async assess(workspaceId, siteSlug) {
      steps.push(`assess:${siteSlug}`);
      assessed.push(`${String(workspaceId)}/${siteSlug}`);
      if (input.failAssessment?.has(siteSlug)) {
        return err(domainError("UPSTREAM_UNAVAILABLE", "postgres://user:secret@example.invalid"));
      }
      return ok({ assessedArticles: 1, findings: input.findings ?? 2 });
    },
    auditLog: {
      ...audit.port,
      async append(entry) {
        steps.push(`audit:${entry.targetId}`);
        if (input.failAudit?.has(entry.targetId)) {
          return err(domainError("UPSTREAM_UNAVAILABLE", "token=do-not-return"));
        }
        return audit.port.append(entry);
      },
    },
    async markCompleted(workspaceId, siteSlug, period) {
      steps.push(`complete:${siteSlug}`);
      if (input.failCompletion?.has(siteSlug)) {
        return err(domainError("UPSTREAM_UNAVAILABLE", "cookie=do-not-return"));
      }
      completions.add(keyOf({ workspaceId, siteSlug }, period));
      return ok(true as const);
    },
    ids: { newId: () => `scheduled-seo-${++ids}` },
  };

  return { deps, assessed, steps, audit, completions, attempts };
}

describe("SEO 月次定期診断", () => {
  it("UTC の月境界で period を切り替える", async () => {
    const march = await executeScheduledSeoAssessment(
      harness({}).deps,
      new Date("2026-03-31T23:59:59.999Z"),
    );
    const april = await executeScheduledSeoAssessment(
      harness({}).deps,
      new Date("2026-04-01T00:00:00.000Z"),
    );

    expect(march.period).toBe("2026-03");
    expect(april.period).toBe("2026-04");
  });

  it("limit+1 で次があるときだけ truncated にする", async () => {
    const sites = Array.from({ length: SCHEDULED_SEO_ASSESSMENT_LIMIT + 1 }, (_, index) =>
      site(`ws_${String(index).padStart(2, "0")}`, `site-${index}`),
    );
    const full = await executeScheduledSeoAssessment(
      harness({ sites }).deps,
      new Date("2026-09-01T00:00:00Z"),
    );
    const exact = await executeScheduledSeoAssessment(
      harness({ sites: sites.slice(0, SCHEDULED_SEO_ASSESSMENT_LIMIT) }).deps,
      new Date("2026-09-01T00:00:00Z"),
    );

    expect(full).toMatchObject({ scanned: 20, completed: 20, failed: 0, truncated: true });
    expect(exact.truncated).toBe(false);
  });

  it("一つのサイトが失敗しても後続を診断し、安全な理由だけ返す", async () => {
    const h = harness({
      sites: [site("ws_a", "a"), site("ws_b", "broken"), site("ws_c", "c")],
      failAssessment: new Set(["broken"]),
    });

    const result = await executeScheduledSeoAssessment(h.deps, new Date("2026-09-04T00:00:00Z"));

    expect(h.assessed).toEqual(["ws_a/a", "ws_b/broken", "ws_c/c"]);
    expect(result).toMatchObject({ scanned: 3, completed: 2, failed: 1 });
    expect(result.failures[0]).toMatchObject({ siteSlug: "broken", stage: "assessment" });
    expect(JSON.stringify(result.failures)).not.toContain("secret");
  });

  it("監査に失敗したサイトは完了印を付けず、次回に再試行する", async () => {
    const failing = new Set(["alpha"]);
    const h = harness({ failAudit: failing });

    const first = await executeScheduledSeoAssessment(h.deps, new Date("2026-09-04T00:00:00Z"));
    failing.clear();
    const retried = await executeScheduledSeoAssessment(h.deps, new Date("2026-09-05T00:00:00Z"));

    expect(first).toMatchObject({ completed: 0, failed: 1 });
    expect(retried).toMatchObject({ scanned: 1, completed: 1, failed: 0 });
    expect(h.assessed).toHaveLength(2);
  });

  it("完了印の書き込み失敗も翌日再試行する", async () => {
    const failing = new Set(["alpha"]);
    const h = harness({ failCompletion: failing });

    const first = await executeScheduledSeoAssessment(h.deps, new Date("2026-09-04T00:00:00Z"));
    failing.clear();
    const retried = await executeScheduledSeoAssessment(h.deps, new Date("2026-09-05T00:00:00Z"));

    expect(first).toMatchObject({ completed: 0, failed: 1 });
    expect(retried).toMatchObject({ scanned: 1, completed: 1, failed: 0 });
    expect(h.assessed).toHaveLength(2);
  });

  it("各サイトを attempt → assess → audit → complete の順で進める", async () => {
    const success = harness({});
    const assessmentFailure = harness({ failAssessment: new Set(["alpha"]) });
    const auditFailure = harness({ failAudit: new Set(["alpha"]) });

    await executeScheduledSeoAssessment(success.deps, new Date("2026-09-04T00:00:00Z"));
    await executeScheduledSeoAssessment(
      assessmentFailure.deps,
      new Date("2026-09-04T00:00:00Z"),
    );
    await executeScheduledSeoAssessment(auditFailure.deps, new Date("2026-09-04T00:00:00Z"));

    expect(success.steps).toEqual([
      "attempt:alpha",
      "assess:alpha",
      "audit:alpha",
      "complete:alpha",
    ]);
    expect(assessmentFailure.steps).toEqual(["attempt:alpha", "assess:alpha"]);
    expect(auditFailure.steps).toEqual(["attempt:alpha", "assess:alpha", "audit:alpha"]);
  });

  it("診断対象があれば指摘 0 件でも監査後に完了する", async () => {
    const h = harness({ findings: 0 });

    const result = await executeScheduledSeoAssessment(h.deps, new Date("2026-09-04T00:00:00Z"));

    expect(result).toMatchObject({ completed: 1, failed: 0 });
    expect(h.audit.entries()[0]).toMatchObject({
      action: "seo_assessment.ran",
      actor: { userId: "system:seo-assessment", identified: false },
      after: { period: "2026-09", assessedArticles: 1, findings: 0 },
    });
  });

  it("同月はスキップし、翌月は再び対象にする", async () => {
    const h = harness({});

    const first = await executeScheduledSeoAssessment(h.deps, new Date("2026-09-04T00:00:00Z"));
    const sameMonth = await executeScheduledSeoAssessment(
      h.deps,
      new Date("2026-09-30T23:59:59Z"),
    );
    const nextMonth = await executeScheduledSeoAssessment(h.deps, new Date("2026-10-01T00:00:00Z"));

    expect(first.scanned).toBe(1);
    expect(sameMonth.scanned).toBe(0);
    expect(nextMonth.scanned).toBe(1);
  });

  it("先頭 20 件が失敗しても、翌日は未試行の 21 件目へ進む", async () => {
    const sites = Array.from({ length: SCHEDULED_SEO_ASSESSMENT_LIMIT + 1 }, (_, index) =>
      site(`ws_${String(index).padStart(2, "0")}`, `site-${index}`),
    );
    const failures = new Set(sites.slice(0, 20).map((target) => target.siteSlug));
    const h = harness({ sites, failAssessment: failures });

    const first = await executeScheduledSeoAssessment(h.deps, new Date("2026-09-04T00:00:00Z"));
    const second = await executeScheduledSeoAssessment(h.deps, new Date("2026-09-05T00:00:00Z"));

    expect(first).toMatchObject({ scanned: 20, completed: 0, failed: 20, truncated: true });
    expect(second.completed).toBe(1);
    expect(h.assessed[20]).toBe("ws_20/site-20");
  });
});
