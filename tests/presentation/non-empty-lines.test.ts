/** @tier 1 @req REQ-UX02 @types equivalence, boundary */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { parseNonEmptyLines } from "@/presentation/admin/non-empty-lines";

const repeatedNonEmptyLinesParser = /\.split\(\s*["']\\n["']\s*\)\s*\.map\(\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>\s*\1\.trim\(\)\s*\)\s*\.filter\(\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>\s*\2\s*!==\s*["']["']\s*\)/;

function repeatsNonEmptyLinesParser(source: string) {
  return repeatedNonEmptyLinesParser.test(source);
}

const ADMIN_DIR = join(process.cwd(), "src/presentation/admin");

/**
 * `admin/` は業務分類 (`ADMIN_NAV_GROUP_LABELS`) 別のサブディレクトリへ割れている。
 * 1 階層しか見ないと走査対象がほぼ空になるので、再帰で集める。
 */
function adminFiles(dir: string = ADMIN_DIR): readonly string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...adminFiles(full));
    else out.push(relative(ADMIN_DIR, full));
  }
  return out;
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

  it("同じ行パーサーを使う 5 つの入口は、共通関数から読む", () => {
    const consumers = [
      "material/evidence-form-state.ts",
      "publish/publish-article-action.ts",
      "write/persona-form-state.ts",
      "maintain/settings-form-state.ts",
      "earn/affiliate-form-action.ts",
    ];
    for (const file of consumers) {
      const source = readFileSync(join(ADMIN_DIR, file), "utf8");
      expect(source, `${file} だけ別の行パーサーを持っています`).toContain(
        '/non-empty-lines"',
      );
    }
  });

  it("別名で同じ実装を足しても、構造の重複として検知する", () => {
    const duplicate = String.raw`const parse = (text: string) => text
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry !== "");`;

    expect(repeatsNonEmptyLinesParser(duplicate)).toBe(true);
  });

  it("管理画面に同じ行パーサーを再実装していない", () => {
    const candidates = adminFiles().filter(
      (file) => /\.tsx?$/.test(file) && file !== "non-empty-lines.ts",
    );
    expect(candidates.length, "管理画面の走査対象が空です").toBeGreaterThan(0);

    const offenders = candidates
      .filter((file) => repeatsNonEmptyLinesParser(readFileSync(join(ADMIN_DIR, file), "utf8")));

    expect(offenders).toEqual([]);
  });
});
