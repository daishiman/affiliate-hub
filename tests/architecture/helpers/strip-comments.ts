/**
 * ソースから**コメントと説明文を落とし、コードだけを残す**走査。
 *
 * ── なぜ 1 本にまとめてあるか ────────────────────────────────
 *
 * 2026-08-20 に、同じ欠陥が別々の場所で 2 回出た。
 *
 *   1. `test-honesty.test.ts`: ブロックコメント → 行コメントの 2 パス除去だったため、
 *      **行コメントの中に書いた slash-star がブロック開始と読まれ**、次の star-slash
 *      までのコードが空白化された。`expect(...)` が消え、何も確かめていないテストが
 *      緑のまま通る**回避経路として成立していた**。
 *   2. `schema-version-prose-drift.test.ts`: python を素の文字列一致で見ていたため、
 *      **docstring に契約 md の名前を書いただけのファイル**が「散文と定数を突き合わせる
 *      経路」と数えられた。穴を説明した文章が、穴が塞がった証拠になった。
 *
 * どちらも**散文とコードを見分けられない**という 1 つの欠陥である。
 * 2 通りに直すと、片方だけ直る日が来る。だから走査を 1 本にして、
 * 言語ごとの違いは `CommentSyntax` の設定だけにしてある。
 *
 * ── 読み方 ────────────────────────────────────────────
 *
 * 左から 1 回だけ走る。**ブロックコメント・行コメント・文字列リテラルを同時に見分ける。**
 * 文字列の中の `//` や `#` や slash-star はコメントではないので、そのまま残す。
 * 2 パスに分けると、後のパスが前のパスの結果を誤読する——それが上の 1 番である。
 *
 * **改行の数は変えない。**落とす部分は空白で置き換える。行番号がずれると、
 * 検査の報告が指す場所が狂って、直す人が別の行を見る。
 */

/** 文字列リテラルの開始記号 1 種。 */
export type StringDelimiter = {
  readonly delim: string;
  /** 改行をまたげるか（TS のバッククォート、python の三重引用符）。 */
  readonly multiline: boolean;
  /**
   * 中身を落とすか。
   *
   * python の docstring は**文法上ただの文字列**だが、役割は説明文である。
   * ここを残すと 2 番の欠陥がそのまま残るので落とす。
   * TS の文字列は落とさない（`it("名前", …)` の名前が消えると取り出せなくなる）。
   */
  readonly strip: boolean;
};

export type CommentSyntax = {
  readonly line: readonly string[];
  readonly block: readonly (readonly [string, string])[];
  /** **長い記号から順に並べること。**`"""` を `"` より先に見ないと三重引用符が割れる。 */
  readonly strings: readonly StringDelimiter[];
  readonly escape: string;
};

export const TYPESCRIPT: CommentSyntax = {
  line: ["//"],
  block: [["/*", "*/"]],
  strings: [
    { delim: "`", multiline: true, strip: false },
    { delim: '"', multiline: false, strip: false },
    { delim: "'", multiline: false, strip: false },
  ],
  escape: "\\",
};

export const PYTHON: CommentSyntax = {
  line: ["#"],
  block: [],
  strings: [
    { delim: '"""', multiline: true, strip: true },
    { delim: "'''", multiline: true, strip: true },
    { delim: '"', multiline: false, strip: false },
    { delim: "'", multiline: false, strip: false },
  ],
  escape: "\\",
};

const blank = (s: string): string => s.replace(/[^\n]/g, " ");

export function stripComments(source: string, syntax: CommentSyntax): string {
  let out = "";
  let i = 0;
  const at = (token: string): boolean => source.startsWith(token, i);

  while (i < source.length) {
    const block = syntax.block.find(([open]) => at(open));
    if (block) {
      const end = source.indexOf(block[1], i + block[0].length);
      const stop = end === -1 ? source.length : end + block[1].length;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }

    const line = syntax.line.find((token) => at(token));
    if (line) {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? source.length : end;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }

    const str = syntax.strings.find((s) => at(s.delim));
    if (str) {
      let j = i + str.delim.length;
      while (j < source.length) {
        if (source[j] === syntax.escape) {
          j += 2;
          continue;
        }
        if (source.startsWith(str.delim, j)) {
          j += str.delim.length;
          break;
        }
        // 複数行を許さない記号は、閉じ忘れでファイル末尾まで飲み込まないよう行末で切る。
        if (!str.multiline && source[j] === "\n") break;
        j += 1;
      }
      const text = source.slice(i, j);
      out += str.strip ? blank(text) : text;
      i = j;
      continue;
    }

    out += source[i];
    i += 1;
  }
  return out;
}

/** TS/TSX からコメントを落とす。文字列は残す。 */
export const stripTypeScriptComments = (source: string): string =>
  stripComments(source, TYPESCRIPT);

/** python から `#` コメントと三重引用符（docstring）を落とす。 */
export const stripPythonComments = (source: string): string => stripComments(source, PYTHON);
