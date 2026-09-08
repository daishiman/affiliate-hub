/** @tier 1 @req REQ-S09 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CURRENT_ROUTE_PROSE_FILES = [
  "src/presentation/ui/admin-disclosure-contract.ts",
  "src/presentation/ui/admin-card-contract.ts",
  "tests/acceptance/feat-admin-cognitive-load-ui/ledger-contract.test.ts",
  "tests/ui/uiux-screen-single-purpose.test.ts",
  "tests/ui/app-shell-nav.test.tsx",
] as const;

const DATED_HISTORY = /\b20\d{2}-\d{2}-\d{2}\b/;
const UNDATED_HISTORY = /(?:以前|実際[、,]|だったとき|床固定|→)/;
const FIXED_ROUTE_TOTAL = [
  /\bA1:\s*\d+\s*管理画面/i,
  /全\s*\d+\s*(?:route|page|管理画面|画面|枚)/i,
  /\d+\s*(?:route|page|管理画面|画面|枚)\s*(?:すべて|全件)/i,
  /他\s*\d+\s*画面/i,
  /\d+\s*(?:route|page|管理画面|画面)[^。"'`\n]{0,60}(?:一対一|1対1|重複しない|同じmetadata)/i,
  /(?:route|page|管理画面|画面)[^。"'`\n]{0,60}\d+\s*件(?:で)?(?:一対一|1対1)/i,
] as const;

function commentsOf(source: string): readonly string[] {
  return [
    ...source.matchAll(/\/\*[\s\S]*?\*\//g),
    ...source.matchAll(/(?:^[\t ]*\/\/[^\n]*(?:\n|$))+/gm),
  ].map((match) => match[0]);
}

function testTitlesOf(source: string): readonly string[] {
  return [...source.matchAll(/\b(?:describe|it|test)\(\s*["'`]([^"'`\n]+)["'`]/g)].map(
    (match) => match[1],
  );
}

function currentCardinalityClaims(file: string): readonly string[] {
  const source = readFileSync(join(ROOT, file), "utf8");
  const currentComments = commentsOf(source).filter(
    (comment) => !DATED_HISTORY.test(comment) && !UNDATED_HISTORY.test(comment),
  );
  return [...currentComments, ...testTitlesOf(source)]
    .filter((prose) => FIXED_ROUTE_TOTAL.some((pattern) => pattern.test(prose)))
    .map((prose) => `${file}: ${prose.replace(/\s+/g, " ").trim()}`);
}

describe("管理画面数の正本", () => {
  it("現在形の説明は可変のroute metadataから総数を複製しない", () => {
    const claims = CURRENT_ROUTE_PROSE_FILES.flatMap(currentCardinalityClaims);

    expect(
      claims,
      "日付付き履歴と回帰床は残し、現在の総数だけを ADMIN_ROUTE_METADATA から導出してください",
    ).toEqual([]);
  });
});
