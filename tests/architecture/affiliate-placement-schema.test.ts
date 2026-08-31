/** @tier 1 @req REQ-A07, REQ-FD06 @types db-constraint, tenant-isolation */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("src/db/schema.ts", "utf8");
const placement = schema.slice(
  schema.indexOf("export const blogAffiliatePlacements"),
  schema.indexOf("export const guidelineReferences"),
);

describe("成果リンクの掲載台帳schema", () => {
  it("rich previewはlegacy互換のnullable列、掲載台帳は逆引きに必要な列を持つ", () => {
    for (const column of [
      "canonicalUrl",
      "merchantName",
      "imageUrl",
      "priceMinor",
      "currency",
      "retrievedAt",
      "sourceMethod",
      "lastCheckedAt",
    ]) {
      expect(schema, column).toContain(`${column}:`);
    }
    for (const column of [
      "affiliateLinkId",
      "blockId",
      "status",
      "lastRenderedAt",
      "updatedAt",
    ]) {
      expect(placement, column).toContain(`${column}:`);
    }
  });

  it("workspace+link+statusとworkspace+掲載場所の2索引を固定する", () => {
    expect(placement.replace(/\s+/g, " ")).toContain(
      ".on( t.workspaceId, t.affiliateLinkId, t.status, )",
    );
    expect(placement.replace(/\s+/g, " ")).toContain(
      "t.workspaceId, t.siteSlug, t.articleSlug, t.blockId, t.position",
    );
  });
});
