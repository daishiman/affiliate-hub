/** @tier 1 @req REQ-TS12 @types equivalence, boundary */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseNonEmptyParagraphs } from "@/domain/authoring";

/** 空行で切って trim し、空段落を落とす——この形が別名で再実装されたら重複と見なす。 */
const repeatedParagraphParser =
  /\.split\(\s*\/\\n\\s\*\\n\/u?\s*\)\s*\.map\(\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>\s*\1\.trim\(\)\s*\)\s*\.filter\(\s*(?:Boolean|\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>\s*\2\s*!==\s*["']["'])\s*\)/;

/** src/ 配下の .ts / .tsx を、正本そのものを除いて列挙する。 */
function sourceFiles(directory: string, canonical: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path, canonical);
    if (!/\.tsx?$/.test(entry.name) || path === canonical) return [];
    return [path];
  });
}

describe("空行区切りの本文入力", () => {
  it("空白だけの空行で段落を分け、各段落の外側の空白を落とす", () => {
    expect(parseNonEmptyParagraphs("  最初。  \r\n \t\r\n  次。\n\n\n 最後。 ")).toEqual([
      "最初。",
      "次。",
      "最後。",
    ]);
  });

  it("単一改行は同じ段落の本文として保つ", () => {
    expect(parseNonEmptyParagraphs("1 行目\n2 行目")).toEqual(["1 行目\n2 行目"]);
  });

  it("同じ入力契約を持つ3つの入口は共通関数から読む", () => {
    const consumers = [
      "src/application/usecases/site/publish-article.ts",
      "src/application/usecases/site/manage-published-articles.ts",
      "src/presentation/admin/site-document-action.ts",
    ];

    for (const consumer of consumers) {
      expect(readFileSync(join(process.cwd(), consumer), "utf8"), consumer).toContain(
        "parseNonEmptyParagraphs",
      );
    }
  });

  it("別名で同じ実装を足しても、構造の重複として検知する", () => {
    expect(
      repeatedParagraphParser.test(String.raw`const parse = (text: string) => text
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter((block) => block !== "");`),
    ).toBe(true);
  });

  it("本体に同じ段落パーサーを再実装していない", () => {
    const canonical = join(process.cwd(), "src/domain/authoring/non-empty-paragraphs.ts");
    const candidates = sourceFiles(join(process.cwd(), "src"), canonical);
    expect(candidates.length, "走査対象が空です").toBeGreaterThan(0);

    const offenders = candidates
      .filter((path) => repeatedParagraphParser.test(readFileSync(path, "utf8")))
      .map((path) => path.slice(process.cwd().length + 1));

    expect(offenders).toEqual([]);
  });
});
