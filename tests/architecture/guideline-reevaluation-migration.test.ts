/**
 * @tier 1
 * @req REQ-SEO05
 * @types db-migration, regression
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  join(process.cwd(), "drizzle", "0037_flimsy_hobgoblin.sql"),
  "utf8",
).replaceAll(/\s+/g, " ");

describe("指針の再評価完了版を足すforward-only migration", () => {
  it("既存列を落とさず、再評価済みの指紋と時刻を追加する", () => {
    expect(SQL).toContain("ADD `re_evaluated_sha256` text");
    expect(SQL).toContain("ADD `re_evaluated_at` text");
    expect(SQL).not.toMatch(/\bDROP\b/i);
  });

  it("初回取得か同一再取得の既存行だけをbaseline化し、変更済みの行は未ackで残す", () => {
    expect(SQL).toContain("`re_evaluated_sha256` = `source_sha256`");
    expect(SQL).toContain("`previous_source_sha256` IS NULL");
    expect(SQL).toContain("`previous_source_sha256` = `source_sha256`");
    expect(SQL).not.toContain("`previous_source_sha256` != `source_sha256`");
  });
});
