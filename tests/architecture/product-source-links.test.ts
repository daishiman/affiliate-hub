/** @tier 1 @req REQ-TS12 @types equivalence, boundary */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PRODUCT_DOCS = [
  "docs/product/T3-technical-spec.md",
  "docs/product/T4-delivery-plan.md",
] as const;

describe("製品文書が案内する正本", () => {
  it("migration参照は実ファイルとjournalの両方に存在する", () => {
    const journal = JSON.parse(
      readFileSync(join(ROOT, "drizzle/meta/_journal.json"), "utf8"),
    ) as { readonly entries: readonly { readonly tag: string }[] };
    const journalTags = new Set(journal.entries.map((entry) => entry.tag));

    for (const document of PRODUCT_DOCS) {
      const source = readFileSync(join(ROOT, document), "utf8");
      const migrations = [...source.matchAll(/`(\d{4}_[a-z0-9_]+\.sql)`/g)].map(
        (match) => match[1] as string,
      );
      expect(migrations.length, `${document} にmigration参照がありません`).toBeGreaterThan(0);
      for (const migration of migrations) {
        expect(existsSync(join(ROOT, "drizzle", migration)), `${document}: ${migration}`).toBe(true);
        expect(journalTags.has(migration.slice(0, -4)), `${document}: ${migration}`).toBe(true);
      }
    }
  });

  it("allowed-valuesの正本リンクは実在するsourceを指す", () => {
    const document = ".claude/plugins/affiliate-content-harness/references/allowed-values.md";
    const source = readFileSync(join(ROOT, document), "utf8");
    const sourceLinks = [...source.matchAll(/`(src\/[a-z0-9_./-]+\.ts)`/g)].map(
      (match) => match[1] as string,
    );

    expect(sourceLinks.length, `${document} にsource linkがありません`).toBeGreaterThan(0);
    expect(sourceLinks.filter((path) => !existsSync(join(ROOT, path)))).toEqual([]);
  });
});
