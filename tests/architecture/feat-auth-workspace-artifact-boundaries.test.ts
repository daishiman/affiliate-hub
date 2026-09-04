/** @tier 1 @req REQ-SEC01 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (name: string) =>
  readFileSync(join(ROOT, "docs/spec/feat-auth-workspace", name), "utf8");

describe("feat-auth-workspace の現在値と時点証跡を混同しない", () => {
  it("P07/P10 は時点付きsnapshotとして現在投影を参照する", () => {
    const acceptance = read("acceptance-report.md");
    const finalReview = read("final-review-log.md");
    for (const document of [acceptance, finalReview]) {
      expect(document).toContain("snapshot_as_of");
      expect(document).toContain("handover.md");
    }
    expect(finalReview).toContain("historical_snapshot");
  });

  it("handover が implementation/release/tracking の3軸で現在値を示す", () => {
    const handover = read("handover.md");
    expect(handover).toContain("現在値の3軸");
    for (const axis of ["implementation acceptance", "release", "tracking"]) {
      expect(handover).toContain(axis);
    }
  });

  it("P08 の旧判断は現在値として読めず、legacy行はfail-closedと分かる", () => {
    const migration = read("migration-decision.md");
    expect(migration).toContain("historical_snapshot_with_current_correction");
    expect(migration).toContain("現在の訂正");
    expect(migration).toContain("fail-closed");
    expect(migration.indexOf("現在の訂正")).toBeLessThan(migration.indexOf("当初判断"));
  });
});
