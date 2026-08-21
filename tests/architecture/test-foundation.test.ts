/**
 * @tier 1
 * @req REQ-TS01
 * @types code-boundary
 *
 * テストの土台が 1 箇所（`tests/support/`）に集まっていること。
 *
 * --- なぜ検査が要るのか ---
 *
 * `REQ-TS01` の判定欄には長いあいだ「土台自身は `tests/architecture/` の契約検査で
 * 『各テストが自前で組み立てていないこと』を見る」と書いてあった。
 * **その検査は存在しなかった。** 2026-08-19 に `tests/architecture/` の
 * 15 ファイルを全部読んで確かめ、判定欄を訂正した。この検査はその穴を塞ぐものである。
 *
 * 土台がばらけると、壊れ方は「落ちる」ではなく「**ずれたまま緑**」で現れる。
 * 実際に、基準時刻 `NOW`（`tests/support/clock.ts`）と同じ日時を
 * 3 つのテストが自前で書いていた。`NOW` を 1 日動かしても、その 3 つは古い日時のまま
 * 緑で残る。**土台を直した人は、直った範囲を実際より広く見積もる。**
 *
 * --- 何を見ているか ---
 *
 * 1. 要件が挙げる 6 つの土台が実在し、どれも 1 つ以上のテストから使われている
 *    （置いてあるだけで誰も通していない土台は、集約になっていない）
 * 2. 読み上げ検査（axe）の呼び出し口が 1 つだけ
 * 3. 基準時刻を土台の外に書き写していない
 *
 * 見ていないもの: ファクトリやテストダブルの「自前実装」の検出。
 * 自前で組み立てた口と、素直な入力データの区別が機械では付かないため、
 * ここで見ると偽の赤が出る。**見ていないことをここに書いておく**（判定欄に
 * 「見ている」と書いて実際は見ていない、が `REQ-TS01` で起きたことそのものなので）。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §4 / docs/architecture/testing-architecture.md
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { NOW } from "../support/clock";

const ROOT = process.cwd();
const TESTS = join(ROOT, "tests");
const SUPPORT = join(TESTS, "support");

/**
 * 走査したテストファイルの下限。
 *
 * 下限が無いと、置き場所を変えた日に **1 件も読めていないのに緑**になる。
 * 実測 173 件に対して 150 を張る。減らしたのが意図なら、この数を下げること。
 */
const LEAST_TEST_FILES = 150;

/** 要件が名指ししている 6 つの土台（`docs/product/traceability.md` の REQ-TS01）。 */
const FOUNDATION = [
  { file: "factories.ts", what: "ファクトリ" },
  { file: "doubles.ts", what: "テストダブル" },
  { file: "actors.ts", what: "担当者" },
  { file: "clock.ts", what: "時刻固定" },
  { file: "render.tsx", what: "描画補助" },
  { file: "a11y.ts", what: "読み上げ検査" },
] as const;

/**
 * 探す文字列は `NOW` から作る。**ここに日時を書き写さない。**
 *
 * 書き写すと、この検査自身が「基準時刻を土台の外に書いた 1 件目」になる
 * （実際、最初にそう書いて自分で赤くなった）。分単位までで見るのは、
 * 秒とミリ秒の書き方が場所によって揺れる（`09:00:00Z` と `09:00:00.000Z`）ため。
 */
const BASE_TIME = NOW.toISOString().slice(0, 16);

function listTestFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.endsWith(".ts") || entry.endsWith(".tsx")) found.push(full);
    }
  };
  walk(TESTS);
  return found;
}

/** 走査対象。空振り（0 件でも緑）を防ぐため、下限を割ったらここで落とす。 */
function testFiles(): string[] {
  const files = listTestFiles();
  if (files.length < LEAST_TEST_FILES) {
    throw new Error(
      `tests/ の下に ${files.length} 件しか見えていません（下限 ${LEAST_TEST_FILES}）。` +
        "検査対象が消えています。減らしたのが意図なら LEAST_TEST_FILES を下げてください",
    );
  }
  return files;
}

describe("検査対象そのもの", () => {
  it("tests/ の下のファイルが見えている", () => {
    expect(() => testFiles()).not.toThrow();
  });
});

describe("テストの土台は tests/support/ に集める", () => {
  it.each(FOUNDATION)("$what（$file）が実在する", ({ file }) => {
    expect(
      readdirSync(SUPPORT).includes(file),
      `tests/support/${file} がありません。土台を動かしたなら、この表も直してください`,
    ).toBe(true);
  });

  it.each(FOUNDATION)("$what（$file）を実際に使っているテストがある", ({ file, what }) => {
    const stem = file.replace(/\.tsx?$/, "");
    const users = testFiles().filter((full) => {
      const rel = relative(ROOT, full);
      if (rel.startsWith("tests/support/")) return false;
      return new RegExp(`support/${stem}["']`).test(readFileSync(full, "utf8"));
    });
    expect(
      users.length,
      `${what}（tests/support/${file}）を通しているテストが 1 つもありません。` +
        "置いてあるだけの土台は集約になっていません（各テストが自前で組み立てている疑いがあります）",
    ).toBeGreaterThan(0);
  });

  it("読み上げ検査（axe）を呼ぶ口は 1 つだけ", () => {
    const callers = testFiles()
      .filter((full) => /["']axe-core["']/.test(readFileSync(full, "utf8")))
      .map((full) => relative(ROOT, full));
    expect(
      callers,
      "axe-core を直接読んでいる場所が tests/support/a11y.ts 以外にあります。" +
        "口が増えると、検査の設定（無視する規則・重大度の線引き）が場所ごとにずれます",
    ).toEqual(["tests/support/a11y.ts"]);
  });

  it("基準時刻を土台の外に書き写していない", () => {
    const copies = testFiles()
      .filter((full) => relative(ROOT, full) !== "tests/support/clock.ts")
      .filter((full) => readFileSync(full, "utf8").includes(BASE_TIME))
      .map((full) => relative(ROOT, full));
    expect(
      copies,
      `基準時刻（${BASE_TIME}）を自前で書いているテストがあります。` +
        "tests/support/clock.ts の NOW を import してください。" +
        "書き写すと、NOW を動かした日にそこだけ古い時刻のまま緑で残ります",
    ).toEqual([]);
  });
});
