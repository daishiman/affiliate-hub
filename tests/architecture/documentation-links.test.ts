/**
 * @tier 1
 * @req REQ-TS09
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DOCUMENTS = [
  "docs/architecture/README.md",
  "docs/architecture/layers.md",
  "docs/architecture/context-map.md",
  "src/presentation/README.md",
  "src/infrastructure/README.md",
] as const;

function relativeMarkdownLinks(file: string): readonly string[] {
  const markdown = readFileSync(file, "utf8");
  return [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map((match) => match[1] ?? "")
    .map((target) => target.split("#", 1)[0] ?? "")
    .filter(
      (target) =>
        target !== "" &&
        !target.startsWith("http://") &&
        !target.startsWith("https://") &&
        !target.startsWith("mailto:"),
    );
}

function referencedMarkdownPaths(file: string): readonly string[] {
  const markdown = readFileSync(file, "utf8");
  return [...markdown.matchAll(/`([^`\n]+\.md)`/g)].map((match) => match[1] ?? "");
}

function resolveDocumentReference(file: string, target: string): string {
  if (/^(docs|src|tests)\//.test(target)) return resolve(target);
  return resolve(dirname(file), target);
}

describe("アーキテクチャ案内", () => {
  it("読者へ案内した相対リンクは実在する文書へ到達する", () => {
    const missing = DOCUMENTS.flatMap((file) =>
      [...relativeMarkdownLinks(file), ...referencedMarkdownPaths(file)]
        .map((target) => ({ file, target, resolved: resolveDocumentReference(file, target) }))
        .filter(({ resolved }) => !existsSync(resolved)),
    );

    expect(missing).toEqual([]);
  });
});
