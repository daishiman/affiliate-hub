/**
 * @tier 1
 * @req REQ-TS09
 * @types contract
 *
 * REQ-TS09 の「1 概念 1 定義」に当たる。**待ち時間は 1 つの概念で、
 * 定義は `quality-gates.config.mjs` の 1 か所だけにする。**
 */
/*
 * **画面の検査の待ち時間を、1 か所から引いていることを見張る。**
 *
 * 2026-08-26 まで、待ち時間は 3 か所に別々の数字で書かれていた
 *（検査ファイルの 20 秒・設定の 30 秒・まとめ描きの 120 秒）。
 * **数字が散らばっている間、直すのはいつも「今日落ちた 1 か所」だけになる。**
 * 実際、全走行 3 回で 3 回とも別のファイルが同じ形で落ちた。
 *
 * ここが見ているのは**数字が散らばっていないこと**だけである。
 * 数字が正しいかどうかは見ていない（時計で測る値に正解は無い）。
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const UI_DIR = "tests/ui";

/** 呼び出しの末尾に直に書かれた待ち時間。`, 20_000)` / `}, 30000);` の形。 */
const BARE_TIMEOUT = /,\s*([0-9][0-9_]{3,})\s*\)/;

function uiTestFiles(): readonly string[] {
  return readdirSync(UI_DIR).filter((name) => /\.test\.tsx?$/.test(name));
}

describe("画面の検査の待ち時間が 1 か所から来ている", () => {
  it("待ち時間を直に書いた検査が無い", () => {
    const files = uiTestFiles();
    /*
     * **床をこの `it` の中に置いてある。**別の `it` に切り出すと、
     * 走査が空振りした日に「違反 0 件」だけが緑のまま残る
     *（`form2-population-floor` が名指しで禁じている形）。
     * 実測（2026-08-26）は 40 ファイル台。
     */
    expect(files.length, `${UI_DIR} の検査が見つかりません`).toBeGreaterThan(20);

    const offenders = files.filter((name) =>
      BARE_TIMEOUT.test(readFileSync(join(UI_DIR, name), "utf8")),
    );
    expect(
      offenders,
      "待ち時間が直に書かれています。quality-gates.config.mjs の名前を import して使うこと。" +
        "**数字を写すと、写された側だけが古いまま取り残されます。**",
    ).toEqual([]);
  });

  it("正本の名前が、実際に画面の検査から使われている", () => {
    const users = uiTestFiles().filter((name) =>
      readFileSync(join(UI_DIR, name), "utf8").includes("_BUDGET_MS"),
    );
    // 0 件でも上の検査は緑になる（誰も待ち時間を書かなければよい）ので、ここで数える。
    // 言及ではなく**名前を使っていること**を数える（説明文に書くだけで満たせないように）。
    expect(users.length, "正本を使っている検査が 1 つもありません").toBeGreaterThan(2);
  });
});
