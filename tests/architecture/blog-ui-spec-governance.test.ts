/**
 * @tier 1
 * @req REQ-SEO01, REQ-SEO02, REQ-SEO03
 * @types code-boundary
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const FEATURE_PATH = "features/feat-blog-ui-builder.md";
const CONTEXT_PATH = "features/feat-blog-ui-builder.context.json";
const REQUIREMENTS_PATH = "docs/requirements/feat-blog-ui-builder-implementation-requirements.md";
const GRAPH_PATH = ".dev-graph/state/graph.json";
const CURRENT_PACKAGE_POINTER_PATH =
  ".dev-graph/state/current/feature-package-feat-blog-ui-builder.json";
const TASK_PATHS = Array.from(
  { length: 13 },
  (_, index) =>
    `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p${String(index + 1).padStart(2, "0")}.md`,
);

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
  const digest = createHash("sha256").update(JSON.stringify(context.acceptance)).digest("hex");
  return { acceptance: context.acceptance, digest: `sha256:${digest}` };
}

function canonicalScopeIn(): string[] {
  return (JSON.parse(read(CONTEXT_PATH)) as { scope_in: string[] }).scope_in;
}

function featureNode() {
  const graph = JSON.parse(read(GRAPH_PATH)) as {
    nodes: Array<{
      graph_node_id: string;
      acceptance: string[];
      scope_in: string[];
      source_lineage: { source_path: string; source_digest: string };
    }>;
  };
  const node = graph.nodes.find((candidate) => candidate.graph_node_id === "feat-blog-ui-builder");
  if (!node) throw new Error("feat-blog-ui-builder node is missing from the graph");
  return node;
}

describe("feat-blog-ui-builder specification governance", () => {
  it("keeps A1-A14 in one canonical feature/context/graph registry", () => {
    const canonical = canonicalAcceptance();
    const feature = read(FEATURE_PATH);

    // 3 か所 (feature frontmatter / planner projection / graph node) が同じ配列であること。
    // 2026-08-24 の計画時は context だけが 14 件で、他の 2 か所は 9 件のまま分裂していた。
    expect(canonical.acceptance).toHaveLength(14);
    expect(inlineJsonField<string[]>(feature, "acceptance")).toEqual(canonical.acceptance);
    expect(featureNode().acceptance).toEqual(canonical.acceptance);
    expect(feature).toContain(`acceptance source digest: \`${canonical.digest}\``);
    expect(read(REQUIREMENTS_PATH)).toContain(`acceptance source digest: \`${canonical.digest}\``);
  });

  it("keeps the full planner scope in the feature and graph projections", () => {
    const scopeIn = canonicalScopeIn();
    const feature = read(FEATURE_PATH);

    expect(scopeIn).toHaveLength(10);
    expect(inlineJsonField<string[]>(feature, "scope_in")).toEqual(scopeIn);
    expect(featureNode().scope_in).toEqual(scopeIn);
    for (const scopeItem of scopeIn) {
      expect(feature).toContain(`  - ${scopeItem}`);
    }
  });

  it("does not transcribe the acceptance wording or a stale canonical count", () => {
    // 文言のチェックリストも「受入9件」「canonical IDs: A1-A9」という旧正本宣言も許さない。
    // A1-A9 を現行14件の UI 部分集合として参照することまでは禁止しない。
    const feature = read(FEATURE_PATH);
    expect(feature).not.toMatch(/^- \[[ xX]\] A(?:1[0-4]|[1-9])\b/m);

    for (const path of [FEATURE_PATH, REQUIREMENTS_PATH, ...TASK_PATHS]) {
      expect(read(path), path).not.toMatch(
        /受入\s*9\s*件|受入(?:条件)?\s*`?A1[-–—]A9\b|A1[-–—]A9\s*全9件|canonical IDs?\s*:\s*`?A1[-–—]A9\b/i,
      );
    }
  });

  it("pins the feature node lineage to the bytes of its source chapter", () => {
    const { source_path: sourcePath, source_digest: sourceDigest } = featureNode().source_lineage;
    const actual = createHash("sha256").update(readFileSync(join(ROOT, sourcePath))).digest("hex");

    expect(sourceDigest).toBe(actual);
  });

  it("pins the current promoted generation to the context and retains its superseded history", () => {
    const pointer = JSON.parse(read(CURRENT_PACKAGE_POINTER_PATH)) as {
      generation_id: string;
      published_digest: string;
      published_path: string;
      supersedes: { published_path: string };
    };
    const currentPackagePath = `${pointer.published_path}/feature-package.json`;
    const published = JSON.parse(read(currentPackagePath)) as {
      source_feature_digest: string;
    };
    const currentContextDigest = `sha256:${createHash("sha256")
      .update(readFileSync(join(ROOT, CONTEXT_PATH)))
      .digest("hex")}`;

    expect(pointer.published_digest).toBe(`sha256:${pointer.generation_id}`);
    expect(existsSync(join(ROOT, currentPackagePath))).toBe(true);
    expect(published.source_feature_digest).toBe(currentContextDigest);
    expect(read(FEATURE_PATH)).toContain(
      `promoted package: \`${CURRENT_PACKAGE_POINTER_PATH}\` が指す`,
    );
    expect(read(FEATURE_PATH)).not.toContain("既知のずれ");
    expect(existsSync(join(ROOT, pointer.supersedes.published_path, "feature-package.json"))).toBe(
      true,
    );
  });
});
