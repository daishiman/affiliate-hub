/**
 * @tier 1
 * @req REQ-SEO04
 * @types code-boundary, audit-log
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const composition = readFileSync("src/presentation/composition.ts", "utf8");
const action = readFileSync("src/presentation/admin/publish-article-action.ts", "utf8");

describe("IndexNow 永続監査の production wiring", () => {
  it("composition が通知結果を application の監査境界へ渡す", () => {
    const body = composition.split("export async function notifyIndexNowOfPublish")[1]?.split(
      "/* ------------------------------------------------------------------ *",
    )[0];
    expect(body).toBeDefined();
    expect(body).toContain("recordIndexNowOutcome(");
    expect(body).toContain("createUnavailableAuditLog()");
    expect(body).toContain("deps.auditLog");
  });

  it("公開 action が認証済み actor と公開先を渡し、console を正本にしない", () => {
    expect(action).toContain("notifyIndexNowOfPublish(actor, origin, result.value.url)");
    expect(action).toContain("indexNow,");
    expect(action).not.toContain("indexnow_publish");
    expect(action).not.toContain("console.info");
  });
});
