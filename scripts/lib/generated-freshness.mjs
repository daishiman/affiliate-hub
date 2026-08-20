/**
 * 生成物に書いてある**数**が、いま実際に数えた数と合っているか。
 *
 * --- 指紋が守っていないもの ---
 *
 * `scripts/lib/generated-doc.mjs` の指紋は、中身から作った sha256 を末尾に焼き、
 * 上書きの前に突き合わせる。これが守っているのは **「手で書き換えていないこと」** である。
 *
 * **「最新であること」は守っていない。**中身ごと古ければ、指紋もその古い中身と
 * 整合するので INTACT になる。この 2 つは読む人にとって同じ言葉
 * （「機械が作った」）で表れるので、混同されやすい。
 *
 * 実際に、この作業場所で測って確かめた。`docs/product/test-traceability.md` を
 * 1 世代前（テストファイル 196 件と書いてある版）へ戻したうえで
 * `tests/architecture/generated-docs.test.ts` を走らせると、**12 件すべて緑**だった。
 * そのときディスクにあったテストファイルは 197 件である。
 * 文書は 1 件少ない数を名乗ったまま、指紋の検査を通り抜けた。
 *
 * --- ここで足すもの ---
 *
 * 指紋は中身と**自分自身**の整合しか見ない。だから、中身の外にある
 * **母集団の実数**と突き合わせる検査を別に置く。
 *
 *   1. 文書が名乗っている数を読む（`readDeclared`）
 *   2. 同じものを、文書を一切見ずに数える（呼ぶ側が渡す）
 *   3. 食い違えば止める（`compareDeclared`）
 *
 * 2 が「文書を見ずに」であることが要点である。文書から読んだ数どうしを
 * 突き合わせても、古い文書の中では辻褄が合っているので緑になる。
 *
 * --- 名乗りが読めなくなったときに緑にしない ---
 *
 * `readDeclared` は、探している行が無ければ**投げる**。0 を返したり
 * `undefined` を返したりすると、見出しの言い回しが変わった日に
 * 「食い違い 0 件」が出る。それは「合っている」ではなく「見ていない」で、
 * この 2 つを同じ緑で表すのが、いま塞ごうとしている穴そのものである。
 */

/**
 * 生成物が名乗っている数を読む。
 *
 * 想定している行の形（`**` の強調はあってもなくてもよい）:
 *
 *   - テストファイル: 197 件
 *   - **由来不明: 28 件**（上限 28 件）
 *
 * @param {string} text 文書の中身
 * @param {string} label 見出しの語（`テストファイル` など）
 * @returns {number}
 */
export function readDeclared(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^-\\s*\\*{0,2}${escaped}\\s*[:：]\\s*([0-9,]+)\\s*件`, "m");
  const found = text.match(pattern);
  if (found === null) {
    throw new Error(
      [
        `「${label}」の数を名乗っている行が見つかりません。`,
        "見出しの言い回しが変わったか、その行が消えています。",
        "**ここで 0 を返して先へ進めると、食い違いは永久に 0 件になります。**",
        "生成しているスクリプト側の文言に合わせて、この検査の label を直してください。",
      ].join("\n"),
    );
  }
  return Number(found[1].replaceAll(",", ""));
}

/**
 * 名乗っている数と、実際に数えた数を突き合わせる。
 *
 * @param {{ doc: string, label: string, declared: number, measured: number, howMeasured: string }} rule
 * @returns {string | null} 食い違いの説明。合っていれば null
 */
export function compareDeclared(rule) {
  if (rule.declared === rule.measured) return null;
  const direction = rule.declared < rule.measured ? "少なく" : "多く";
  return [
    `${rule.doc} は「${rule.label}」を ${rule.declared} 件と名乗っていますが、`,
    `実際に数えると ${rule.measured} 件です（${rule.declared - rule.measured} 件だけ${direction}名乗っています）。`,
    `  数え方: ${rule.howMeasured}`,
    "",
    "  **指紋は合っています。**指紋は中身と自分自身の整合しか見ないので、",
    "  中身ごと古ければ緑になります。生成し直してください。",
  ].join("\n");
}
