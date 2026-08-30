/** @tier 1 @req REQ-UX02 @types equivalence, boundary */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseNonEmptyLines } from "@/presentation/admin/non-empty-lines";

const repeatedNonEmptyLinesParser = /\.split\(\s*["']\\n["']\s*\)\s*\.map\(\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>\s*\1\.trim\(\)\s*\)\s*\.filter\(\s*(?:Boolean|\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>\s*\2\s*!==\s*["']["'])\s*\)/;

function repeatsNonEmptyLinesParser(source: string) {
  return repeatedNonEmptyLinesParser.test(source);
}

describe("1 行 1 件の管理画面入力", () => {
  it("前後の空白を落とし、空行は件数に含めない", () => {
    expect(parseNonEmptyLines("  ひとつ  \n\n\tふたつ\t\n   ")).toEqual([
      "ひとつ",
      "ふたつ",
    ]);
  });

  it("Windows の改行でも行末の文字を残さない", () => {
    expect(parseNonEmptyLines("ひとつ\r\nふたつ\r\n")).toEqual(["ひとつ", "ふたつ"]);
  });

  it("同じ行パーサーを使う 6 つの入口は、共通関数から読む", () => {
    const consumers = [
      "evidence-form-state.ts",
      "publish-article-action.ts",
      "persona-form-state.ts",
      "settings-form-state.ts",
      "affiliate-form-action.ts",
      "published-article-action.ts",
    ];
    for (const file of consumers) {
      const source = readFileSync(
        join(process.cwd(), "src/presentation/admin", file),
        "utf8",
      );
      expect(source, `${file} だけ別の行パーサーを持っています`).toContain(
        '"./non-empty-lines"',
      );
    }
  });

  it("別名で同じ実装を足しても、構造の重複として検知する", () => {
    const duplicate = String.raw`const parse = (text: string) => text
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry !== "");`;

    expect(repeatsNonEmptyLinesParser(duplicate)).toBe(true);
    expect(
      repeatsNonEmptyLinesParser(String.raw`const lines = (text: string) => text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);`),
    ).toBe(true);
  });

  it("管理画面に同じ行パーサーを再実装していない", () => {
    const directory = join(process.cwd(), "src/presentation/admin");
    const candidates = readdirSync(directory).filter(
      (file) => /\.tsx?$/.test(file) && file !== "non-empty-lines.ts",
    );
    expect(candidates.length, "管理画面の走査対象が空です").toBeGreaterThan(0);

    const offenders = candidates
      .filter((file) => repeatsNonEmptyLinesParser(readFileSync(join(directory, file), "utf8")));

    expect(offenders).toEqual([]);
  });
});
