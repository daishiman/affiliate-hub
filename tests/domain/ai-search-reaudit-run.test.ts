/** @tier 1 @req REQ-SEO07 */
import { describe, expect, it } from "vitest";
import {
  failAiSearchReauditRun,
  finishAiSearchReauditRun,
} from "@/domain/seo/ai-search-reaudit-run";
import { asWorkspaceId } from "@/domain/shared";

const workspaceId = asWorkspaceId("ws_reaudit");
const startedAt = new Date("2026-09-04T00:00:00.000Z");
const completedAt = new Date("2026-09-04T00:00:02.000Z");

describe("AI 検索の定期再点検 run-state", () => {
  it("対象 0 件を succeeded とし、取得失敗と区別する", () => {
    expect(
      finishAiSearchReauditRun({
        workspaceId,
        startedAt,
        completedAt,
        scanned: 0,
        recorded: 0,
        failed: 0,
      }),
    ).toMatchObject({
      status: "succeeded",
      scanned: 0,
      recorded: 0,
      failed: 0,
      failureCode: null,
    });

    expect(
      failAiSearchReauditRun({ workspaceId, startedAt, completedAt }),
    ).toMatchObject({
      status: "failed",
      scanned: 0,
      recorded: 0,
      failed: 0,
      failureCode: "target_list_unavailable",
    });
  });

  it("記録失敗を含む完了は partial と固定 code で表す", () => {
    expect(
      finishAiSearchReauditRun({
        workspaceId,
        startedAt,
        completedAt,
        scanned: 3,
        recorded: 2,
        failed: 1,
      }),
    ).toMatchObject({ status: "partial", failureCode: "article_audit_failed" });
  });

  it("全記事の記録に失敗した完了は failed とする", () => {
    expect(
      finishAiSearchReauditRun({
        workspaceId,
        startedAt,
        completedAt,
        scanned: 2,
        recorded: 0,
        failed: 2,
      }),
    ).toMatchObject({ status: "failed", failureCode: "article_audit_failed" });
  });

  it("件数が矛盾する run-state を作らない", () => {
    expect(() =>
      finishAiSearchReauditRun({
        workspaceId,
        startedAt,
        completedAt,
        scanned: 2,
        recorded: 2,
        failed: 1,
      }),
    ).toThrow("scanned");
  });
});
