/**
 * @tier 1
 * @req REQ-FD06, REQ-BOPS13, REQ-BOPS14
 * @types code-boundary
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const FEATURE_PATH = "features/feat-blog-ops-crud.md";
const CONTEXT_PATH = "features/feat-blog-ops-crud.context.json";
const REQUIREMENTS_PATH = "docs/requirements/feat-blog-ops-crud-implementation-requirements.md";
const BASELINE_PATH = "docs/spec/feat-blog-ops-crud/requirements-baseline.md";
const TRACEABILITY_PATH = "docs/product/traceability.md";
const FINAL_REVIEW_PATH = "docs/spec/feat-blog-ops-crud/final-review.md";
const RELEASE_REPORT_PATH = "docs/spec/feat-blog-ops-crud/release-report.md";

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function inlineJsonField<T>(markdown: string, field: string): T {
  const line = markdown
    .slice(0, markdown.indexOf("\n---\n", 4))
    .split("\n")
    .find((candidate) => candidate.startsWith(`${field}: `));
  if (!line) throw new Error(`${field} frontmatter is missing`);
  return JSON.parse(line.slice(field.length + 2)) as T;
}

function canonicalAcceptance() {
  const context = JSON.parse(read(CONTEXT_PATH)) as { acceptance: string[] };
  const digest = createHash("sha256")
    .update(JSON.stringify(context.acceptance))
    .digest("hex");
  return { acceptance: context.acceptance, digest: `sha256:${digest}` };
}

describe("feat-blog-ops-crud specification governance", () => {
  it("keeps A1-A14 in one canonical feature/context registry", () => {
    const feature = read(FEATURE_PATH);
    const canonical = canonicalAcceptance();

    expect(canonical.acceptance).toHaveLength(14);
    expect(inlineJsonField<string[]>(feature, "acceptance")).toEqual(canonical.acceptance);
    expect(feature).toContain(`acceptance source digest: \`${canonical.digest}\``);
    expect(feature).not.toMatch(/^- \[[ xX]\] A(?:1[0-4]|[1-9])\b/m);

    const requirements = read(REQUIREMENTS_PATH);
    expect(requirements).toContain(`acceptance source digest: \`${canonical.digest}\``);
    expect(requirements).not.toMatch(/^- A(?:1[0-4]|[1-9])[:：]/m);
  });

  it("uses the collision-free REQ-BOPS01..14 namespace for derived requirements", () => {
    const baseline = read(BASELINE_PATH);
    const feature = read(FEATURE_PATH);
    const requirements = read(REQUIREMENTS_PATH);
    const traceability = read(TRACEABILITY_PATH);
    const canonical = canonicalAcceptance();

    expect(baseline).toContain(`acceptance source digest: \`${canonical.digest}\``);
    expect(baseline).not.toMatch(/^\| A(?:1[0-4]|[1-9]) \|/m);
    expect(baseline).not.toMatch(/REQ-BLOG(?:0[1-9]|1[0-4])/);
    expect(feature).toContain("`REQ-BOPS01`–`REQ-BOPS14`");
    expect(requirements).toContain("`REQ-BOPS01`–`REQ-BOPS14`");
    for (let index = 1; index <= 14; index += 1) {
      const id = `REQ-BOPS${String(index).padStart(2, "0")}`;
      expect(baseline).toContain(id);
      expect(traceability.match(new RegExp(`^\\| ${id} \\|`, "gm"))).toHaveLength(1);
    }
    for (let index = 1; index <= 6; index += 1) {
      const existingId = `REQ-BLOG${String(index).padStart(2, "0")}`;
      expect(traceability.match(new RegExp(`^\\| ${existingId} \\|`, "gm"))).toHaveLength(1);
    }
  });

  it("keeps REQ-BOPS implementation and test evidence on real paths", () => {
    const rows = read(TRACEABILITY_PATH)
      .split("\n")
      .filter((line) => /^\| REQ-BOPS(?:0[1-9]|1[0-4]) \|/.test(line));
    const paths = rows.flatMap((line) =>
      [...line.matchAll(/`((?:src|drizzle|tests|docs|\.dev-graph)\/[^`]+)`/g)].map(
        (match) => match[1],
      ),
    );

    expect(rows).toHaveLength(14);
    expect(paths.length).toBeGreaterThan(14);
    for (const path of paths) {
      expect(existsSync(join(ROOT, path)), path).toBe(true);
    }
  });

  it("runs the canonical reference-site reuse gate for REQ-BOPS13", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/check-reference-site-reuse.mjs"], {
        cwd: ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
  });

  it("joins P07 and P09 before P10 and preserves the downstream topology", () => {
    const graph = JSON.parse(read(".dev-graph/state/graph.json")) as {
      nodes: Array<{ graph_node_id: string; depends_on: string[] }>;
    };
    const expected: Record<string, string[]> = {
      "SYS-BLOG-OPS-CRUD-P10": ["SYS-BLOG-OPS-CRUD-P07", "SYS-BLOG-OPS-CRUD-P09"],
      "SYS-BLOG-OPS-CRUD-P11": ["SYS-BLOG-OPS-CRUD-P07", "SYS-BLOG-OPS-CRUD-P09"],
      "SYS-BLOG-OPS-CRUD-P12": ["SYS-BLOG-OPS-CRUD-P10", "SYS-BLOG-OPS-CRUD-P11"],
      "SYS-BLOG-OPS-CRUD-P13": ["SYS-BLOG-OPS-CRUD-P12"],
    };

    for (const [id, dependencies] of Object.entries(expected)) {
      const node = graph.nodes.find((candidate) => candidate.graph_node_id === id);
      expect(node?.depends_on, id).toEqual(dependencies);
      const phase = id.slice(-3).toLowerCase();
      const task = read(`tasks/feat-blog-ops-crud/sys-blog-ops-crud-${phase}.md`);
      expect(inlineJsonField<string[]>(task, "depends_on"), id).toEqual(dependencies);
    }
  });

  it("does not present an in-progress execution as promoted or released", () => {
    const finalReview = read(FINAL_REVIEW_PATH);
    const releaseReport = read(RELEASE_REPORT_PATH);
    const currentFinalDecision = finalReview.split("## Historical snapshot")[0];
    const currentReleaseDecision = releaseReport.split("## Historical snapshot")[0];

    expect(currentFinalDecision).toContain("execution status: **in_progress**");
    expect(currentFinalDecision).toContain("promotion: **blocked**");
    expect(currentFinalDecision).not.toContain("FAIL 0 件");
    expect(currentFinalDecision).not.toContain("readiness = complete");
    expect(currentReleaseDecision).toContain("execution status: **in_progress**");
    expect(currentReleaseDecision).not.toContain("前提は満たしている");
  });

  it("retains the immutable published generation as audit history", () => {
    const pointer = JSON.parse(
      read(".dev-graph/state/current/feature-package-feat-blog-ops-crud.json"),
    ) as { published_path: string; receipt: string };

    expect(existsSync(join(ROOT, pointer.published_path))).toBe(true);
    expect(existsSync(join(ROOT, pointer.receipt))).toBe(true);
  });
});
