/**
 * 台帳ファイル（テストが作る 4 枚）の突き合わせ。
 *
 * --- なぜ「内容が合っていれば通る」では足りなかったか ---
 *
 * この 4 枚（`open-doors.md` / `stub-ledger.md` / `event-ledger.md` /
 * `eval-ledger.md`）は、テストが作った内容と file の中身を比べていた。
 * それが答えている問いは「**この文書は古くないか**」である。
 * ところが文書の頭に書いてあるのは「**手で書き換えない**」で、
 * 読む人はこの 2 つを同じものとして受け取る。
 *
 * ずれるのは、**正本を先に直してから、同じ内容を手で書いた**ときである。
 * 内容は一致するので通る。つまり「手で書かれていないこと」は見ていない。
 * 実際、`open-doors.md` へ手で段落を書いて赤になったことがあるが、
 * 捕まったのは**順番のおかげ**だった。
 * **再現するかどうかが順番で決まる検査は、次に同じことをする人を捕まえない。**
 *
 * そこで、スクリプトが作る 4 枚（B 群）と同じ道具を通す。
 * 指紋は中身から作るので、**1 文字でも手で書けば、内容が合っていても合わなくなる**。
 *
 * 塞げていないことは `scripts/lib/generated-doc.mjs` の冒頭に書いてある
 * （指紋を中身と一緒に手で取り直せば通る）。ここでも同じで、塞げていない。
 */
import { readFileSync } from "node:fs";
import { expect } from "vitest";
import { inspectStamped, writeGeneratedDoc } from "../../scripts/lib/generated-doc.mjs";

/**
 * 台帳が「古くないこと」と「手で書かれていないこと」の**両方**を見る。
 *
 * @param path    台帳ファイル
 * @param expected テストが作った、あるべき中身（指紋は含めない）
 * @param update  `UPDATE_*=1` が立っているか。立っていれば書き直す
 * @param hint    古かったときに出す、作り直しの打ち方
 */
export function expectLedgerFile(
  path: string,
  expected: string,
  update: boolean,
  hint: string,
): void {
  // 書くのも道具を通す。ここで直接書くと、手で書かれた行が
  // 「作り直し」の一手で黙って消える（消えたことは緑として現れる）。
  if (update) writeGeneratedDoc(path, expected);

  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    text = "";
  }
  const found = inspectStamped(text);

  // 順番が大事。**先に手書きを見る。**
  // 中身の比較を先にすると、正本を直してから同じ内容を手で書いた場合に
  // 通ってしまい、この道具を入れた意味が無くなる。
  expect(
    found.state,
    [
      `${path} が、機械が作ったあとに手で書き換えられています。`,
      "書きたかったことは、この台帳を作っているテストのほうへ書いてください。",
      `戻すには: git checkout -- ${path}`,
    ].join("\n"),
  ).toBe("INTACT");

  expect(found.body.replace(/\s+$/, ""), hint).toBe(expected.replace(/\s+$/, ""));
}
