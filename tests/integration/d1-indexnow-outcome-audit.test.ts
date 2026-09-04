/**
 * @tier 2
 * @req REQ-SEO04
 * @types audit-log, db-migration, secrets
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import { recordIndexNowOutcome } from "@/application/seo/indexnow-outcome-audit";
import * as schema from "@/db/schema";
import { createD1AuditLog } from "@/infrastructure/persistence/d1/audit-log-repository";
import { sequentialIdGenerator } from "@/infrastructure/platform/id-generator";
import { anOwner } from "../support/actors";
import { NOW } from "../support/clock";
import { migrationStatements } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

const TARGET_URL = "https://blog.example.com/s/gadget/guides/quiet-laptop";
const SENSITIVE_DETAIL =
  '送信失敗: key=do-not-record body={"host":"blog.example.com","urlList":["/private"]}';

let proxy: Proxy;

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM audit_logs").run();
});

describe("IndexNow 通知結果の D1 監査", () => {
  it("production と同じ D1 repository で主体・workspace・URL・status・理由を読み戻せる", async () => {
    const actor = anOwner();
    const db = drizzle(proxy.env.DB, { schema });

    const result = await recordIndexNowOutcome(
      {
        auditLog: createD1AuditLog(db),
        ids: sequentialIdGenerator("indexnow"),
        now: () => NOW,
      },
      actor,
      {
        targetUrl: TARGET_URL,
        outcome: { status: "failed", detail: SENSITIVE_DETAIL },
      },
    );

    expect(result.auditStatus).toBe("recorded");
    const row = await proxy.env.DB.prepare(
      `SELECT workspace_id, action, actor_user_id, actor_identified,
              target_type, target_id, after_json, reason
         FROM audit_logs
        WHERE action = ?`,
    )
      .bind("indexnow.notification_finished")
      .first<Record<string, unknown>>();

    expect(row).toMatchObject({
      workspace_id: String(actor.workspaceId),
      action: "indexnow.notification_finished",
      actor_user_id: actor.userId,
      actor_identified: 1,
      target_type: "public_url",
      target_id: TARGET_URL,
      after_json: JSON.stringify({ status: "failed" }),
      reason: "IndexNow への公開 URL 通知が完了しなかった。",
    });
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain("do-not-record");
    expect(serialized).not.toContain("urlList");
    expect(serialized).not.toContain("private");
  });
});
