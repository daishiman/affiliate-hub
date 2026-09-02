/**
 * @tier 1
 * @req REQ-SEO04
 * @types audit-log, secrets, fault-injection
 */
import { describe, expect, it } from "vitest";
import type { AuditLogPort } from "@/application/ports/compliance";
import { recordIndexNowOutcome } from "@/application/seo/indexnow-outcome-audit";
import { domainError, err } from "@/domain/shared";
import { sequentialIdGenerator } from "@/infrastructure/platform/id-generator";
import { anOwner } from "../../support/actors";
import { NOW } from "../../support/clock";
import { recordingAuditLog } from "../../support/doubles";

const TARGET_URL = "https://blog.example.com/s/gadget/guides/quiet-laptop";

describe("IndexNow 通知結果の永続監査", () => {
  it.each([
    { status: "sent", detail: "1 件を通知しました。" },
    { status: "skipped", detail: "通知条件を満たさないためスキップしました。" },
    { status: "failed", detail: "IndexNow が 503 を返しました。" },
  ] as const)("$status を、主体・作業場所・対象 URL・理由付きで 1 行にする", async (outcome) => {
    const audit = recordingAuditLog();

    const result = await recordIndexNowOutcome(
      {
        auditLog: audit.port,
        ids: sequentialIdGenerator("indexnow"),
        now: () => NOW,
      },
      anOwner(),
      { targetUrl: TARGET_URL, outcome },
    );

    expect(result).toEqual({ ...outcome, auditStatus: "recorded" });
    expect(audit.entries()).toHaveLength(1);
    expect(audit.entries()[0]).toMatchObject({
      workspaceId: anOwner().workspaceId,
      action: "indexnow.notification_finished",
      actor: {
        userId: anOwner().userId,
        identified: true,
        isAiServiceAccount: false,
      },
      targetType: "public_url",
      targetId: TARGET_URL,
      before: null,
      after: { status: outcome.status },
      occurredAt: NOW,
    });
    expect(audit.entries()[0]?.reason).toMatch(/IndexNow/);
  });

  it("通知の detail に秘密や送信本文が混ざっても、監査行へ複製しない", async () => {
    const audit = recordingAuditLog();
    const sensitiveDetail =
      '送信失敗: key=do-not-record body={"host":"blog.example.com","urlList":["/private"]}';

    await recordIndexNowOutcome(
      {
        auditLog: audit.port,
        ids: sequentialIdGenerator("indexnow"),
        now: () => NOW,
      },
      anOwner(),
      {
        targetUrl: TARGET_URL,
        outcome: { status: "failed", detail: sensitiveDetail },
      },
    );

    const serialized = JSON.stringify(audit.entries()[0]);
    expect(serialized).not.toContain("do-not-record");
    expect(serialized).not.toContain("urlList");
    expect(serialized).not.toContain("private");
  });

  it("監査書込が失敗しても通知の結末は保ち、detail に記録失敗を明示する", async () => {
    const unavailable: AuditLogPort = {
      append: async () =>
        err(
          domainError("UPSTREAM_UNAVAILABLE", "操作の記録を保存できません。", {
            retryable: true,
          }),
        ),
      listByTarget: async () => err(domainError("UPSTREAM_UNAVAILABLE", "読めません。")),
      search: async () => err(domainError("UPSTREAM_UNAVAILABLE", "読めません。")),
    };

    const result = await recordIndexNowOutcome(
      {
        auditLog: unavailable,
        ids: sequentialIdGenerator("indexnow"),
        now: () => NOW,
      },
      anOwner(),
      {
        targetUrl: TARGET_URL,
        outcome: { status: "sent", detail: "1 件を通知しました。" },
      },
    );

    expect(result.status).toBe("sent");
    expect(result.auditStatus).toBe("failed");
    expect(result.detail).toContain("1 件を通知しました。");
    expect(result.detail).toContain("記録を保存できません");
  });
});
