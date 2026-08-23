/**
 * @tier 1
 * @req REQ-UX01, REQ-UX02, REQ-UX03, REQ-UX04, REQ-UX05, REQ-UX06, REQ-UX07, REQ-UX08, REQ-UX09, REQ-UX10
 *
 * A1〜A10 の受入判定を、仕様・実装・検査・報告・trackingの5か所で突合する。
 * テスト名を数えるのではなく、manifestが指す実ファイル、その内容のdigest、
 * 報告とtrackingが持つ独立した状態軸を検証する。
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeEvaluationDigest,
  reconcileAcceptance,
  reconcileRepository,
} from "../../scripts/acceptance-reconciliation.mjs";

const ROOT = process.cwd();

type FixtureOptions = {
  missingRuntime?: boolean;
  staleDigest?: boolean;
  reportReleaseStatus?: "unpublished" | "published";
};

function write(root: string, path: string, body: string): void {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body);
}

function fixture(options: FixtureOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), "acceptance-reconciliation-"));
  const ids = Array.from({ length: 10 }, (_, index) => `A${index + 1}`);

  for (const id of ids) {
    write(root, `spec/${id}.md`, `# ${id} requirement\n`);
    write(root, `runtime/${id}.ts`, `export const ${id.toLowerCase()} = true;\n`);
    write(
      root,
      `tests/${id}.test.ts`,
      `/** @tier 1 */\nit(\"${id}\", () => expect(true).toBe(true));\n`,
    );
  }

  const manifest = {
    schema_version: 1,
    feature_id: "fixture",
    status: {
      implementation: "pass",
      release: "unpublished",
      tracking: "active",
    },
    evaluated_digest: "",
    acceptance: ids.map((id) => ({
      id,
      implementation_status: "pass",
      requirement_refs: [`spec/${id}.md`],
      runtime_refs:
        options.missingRuntime && id === "A3" ? ["runtime/missing.ts"] : [`runtime/${id}.ts`],
      test_refs: [`tests/${id}.test.ts`],
      report_refs: ["reports/report.md"],
      tracking_ref: "features/fixture.md",
    })),
  };

  const digest = computeEvaluationDigest(manifest, root).digest;
  manifest.evaluated_digest = options.staleDigest ? `sha256:${"0".repeat(64)}` : digest;
  const reportClaim = {
    implementation_status: "pass",
    release_status: options.reportReleaseStatus ?? "unpublished",
    tracking_status: "active",
    evaluated_digest: manifest.evaluated_digest,
    acceptance_ids: ids,
  };
  write(
    root,
    "reports/report.md",
    `# report\n\n<!-- acceptance-reconciliation ${JSON.stringify(reportClaim)} -->\n`,
  );
  write(
    root,
    "features/fixture.md",
    [
      "---",
      'status: "active"',
      'evaluation_status: "pass"',
      'completion_evidence: {"status":"open"}',
      `acceptance_reconciliation: ${JSON.stringify({
        implementation_status: "pass",
        release_status: "unpublished",
        tracking_status: "active",
        evaluated_digest: manifest.evaluated_digest,
      })}`,
      "---",
      "",
      ...ids.map((id) => `- [x] ${id} — accepted`),
      "",
    ].join("\n"),
  );

  return { manifest, root };
}

describe("受入reconciliationの失敗条件", () => {
  it("必須参照が1つでも欠けたら失敗する", () => {
    const { manifest, root } = fixture({ missingRuntime: true });
    const result = reconcileAcceptance(manifest, root);

    expect(result.ok).toBe(false);
    expect(result.issues.join("\n")).toContain("A3 runtime_refs");
    expect(result.issues.join("\n")).toContain("runtime/missing.ts");
  });

  it("評価対象が変わりdigestの時点がずれたら失敗する", () => {
    const { manifest, root } = fixture({ staleDigest: true });
    const result = reconcileAcceptance(manifest, root);

    expect(result.ok).toBe(false);
    expect(result.issues.join("\n")).toContain("評価digestが古い");
  });

  it("PASS報告が公開済みを名乗りtrackingの未公開と相反したら失敗する", () => {
    const { manifest, root } = fixture({ reportReleaseStatus: "published" });
    const result = reconcileAcceptance(manifest, root);

    expect(result.ok).toBe(false);
    expect(result.issues.join("\n")).toContain("release_status");
    expect(result.issues.join("\n")).toContain("unpublished");
  });
});

describe("受入reconciliationの正経路", () => {
  it("A1〜A10を5つの証跡へjoinし、同じ実装時点なら通す", () => {
    const { manifest, root } = fixture();
    const result = reconcileAcceptance(manifest, root);

    expect(result.ok, result.issues.join("\n")).toBe(true);
    expect(result.acceptanceCount).toBe(10);
    expect(result.evidenceFileCount).toBe(30);
    expect(result.issues).toEqual([]);
  });

  it("リポジトリのmanifestが現在の実装・報告・trackingと一致する", () => {
    const result = reconcileRepository(ROOT);

    expect(result.ok, result.issues.join("\n")).toBe(true);
    expect(result.acceptanceCount).toBe(10);
    expect(result.evidenceFileCount).toBeGreaterThan(10);
    expect(result.digest).toMatch(/^sha256:[0-9a-f]{64}$/);

    const manifest = JSON.parse(
      readFileSync(
        join(ROOT, "docs/spec/feat-uiux-overhaul/acceptance-reconciliation.json"),
        "utf8",
      ),
    ) as { evaluated_digest: string };
    expect(manifest.evaluated_digest).toBe(result.digest);
  });
});
