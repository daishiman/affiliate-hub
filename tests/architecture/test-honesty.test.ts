import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * テストの数と割合が、実態より良く見えないようにする。
 *
 * カバレッジは「その行を通ったか」しか見ない。**通っただけで何も確かめていない
 * テスト**を並べると、数字は上がるのに壊れたことに気づけない状態が作れてしまう。
 * これは意図しなくても起きる（書きかけを消し忘れる、確かめる前に満足する）。
 *
 * ここで見るのは 3 つ。
 *   1. 中身が空のテストが無いか
 *   2. 何も確かめていないテストが無いか
 *   3. 「呼ばれた回数」だけを確かめたテストが無いか（中の作りに縛られる）
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §1（数字合わせの禁止）/ §3（振る舞いを見る）
 */

const ROOT = process.cwd();
const TESTS = join(ROOT, "tests");

function testFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...testFiles(full));
    else if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) out.push(full);
  }
  return out;
}

/** コメントを消す。説明文の中に書いた例を、本物のテストと数えないため。 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/^\s*\/\/.*$/gm, "");
}

/**
 * `it("…", () => { … })` を 1 件ずつ取り出す。
 *
 * 区切りは**次の `it(` まで**にしてある。括弧を数える方法だと、
 * 正規表現や文字列の中の `{` `}` で切れる場所を間違える。
 * 実際それで、確かめているのに「確かめていない」と赤くなる誤検出が出た。
 *
 * この取り方は逆に**多めに取る**ので、見落とす方向に倒れる。
 * 誤って赤くする検査は、やがて無視される。見落とす方がまだ直せる。
 */
function eachTest(source: string): { name: string; body: string; line: number }[] {
  const clean = withoutComments(source);
  const opener = /\bit(?:\.\w+)?\s*\(\s*(["'`])([\s\S]*?)\1\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/g;
  const starts = [...clean.matchAll(opener)];
  return starts.map((match, index) => {
    const from = (match.index ?? 0) + match[0].length;
    const to = index + 1 < starts.length ? (starts[index + 1].index ?? clean.length) : clean.length;
    return {
      name: match[2],
      body: clean.slice(from, to),
      line: clean.slice(0, match.index ?? 0).split("\n").length,
    };
  });
}

/**
 * 何かを確かめているか。
 *
 * `expect(...)` だけでなく、`expectHeadingStructure(...)` のような
 * 確かめ役の関数も数える。共通化した確認を「確かめていない」と言わないため。
 */
const ASSERTS = /\bexpect\s*\(|\bexpect[A-Z]\w*\s*\(|\bassert\b|\.rejects\b|\.resolves\b/;

const ALL = testFiles(TESTS).map((file) => ({
  path: relative(ROOT, file).split("\\").join("/"),
  source: readFileSync(file, "utf8"),
}));

describe("テストが実際に何かを確かめていること", () => {
  it("1 件も取り出せない、ということが起きていない", () => {
    // この検査自体が空振りしていないかを見る。
    // 取り出し方を壊すと、下の 3 つが全部「対象 0 件」で緑になる。
    const total = ALL.reduce((n, f) => n + eachTest(f.source).length, 0);
    expect(total, "テストを 1 件も取り出せていません。取り出し方が壊れています").toBeGreaterThan(
      500,
    );
  });

  it("中身が空のテストが無い", () => {
    // ここだけは取り出し方に頼らず、`{}` がそのまま閉じている形を直接見る。
    const empty: string[] = [];
    const emptyBody = /\bit(?:\.\w+)?\s*\(\s*(["'`])([\s\S]*?)\1\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{\s*\}/g;
    for (const file of ALL) {
      for (const match of withoutComments(file.source).matchAll(emptyBody)) {
        empty.push(`${file.path} 「${match[2]}」`);
      }
    }
    expect(empty, "中身が空です。書きかけなら消すか、確かめる内容を書いてください").toEqual([]);
  });

  it("何も確かめていないテストが無い", () => {
    const silent: string[] = [];
    for (const file of ALL) {
      for (const t of eachTest(file.source)) {
        if (!ASSERTS.test(t.body)) silent.push(`${file.path}:${t.line} 「${t.name}」`);
      }
    }
    expect(
      silent,
      "動かしているだけで、結果を確かめていません。" +
        "通ったことしか分からないテストは、壊れても緑のままになります",
    ).toEqual([]);
  });

  it("呼ばれた回数だけを確かめたテストが無い", () => {
    // 「何回呼ばれたか」は中の作りであって、利用者に見える振る舞いではない。
    // ここに縛ると、結果が同じままの整理でテストが落ちる。
    const countOnly: string[] = [];
    for (const file of ALL) {
      for (const t of eachTest(file.source)) {
        const calls = t.body.match(/expect\([^)]*\)\s*\.[^;]*/g) ?? [];
        const meaningful = calls.filter(
          (c) => !/toHaveBeenCalledTimes|toHaveBeenCalledOnce|\.mock\.calls\.length/.test(c),
        );
        if (calls.length > 0 && meaningful.length === 0) {
          countOnly.push(`${file.path}:${t.line} 「${t.name}」`);
        }
      }
    }
    expect(
      countOnly,
      "呼び出し回数しか確かめていません。**何が返ったか**を確かめてください",
    ).toEqual([]);
  });
});

describe("秘密情報がリポジトリに入っていないこと", () => {
  /**
   * 見つけたいのは「本物らしい値」であって、名前ではない。
   *
   * `CLOUDFLARE_API_TOKEN` という**名前**は文書に出てよい（出さないと登録できない）。
   * 入っていてはいけないのは**値**の方である。
   */
  const SECRET_SHAPES: readonly { readonly what: string; readonly pattern: RegExp }[] = [
    { what: "OpenAI 系の鍵", pattern: /\bsk-[A-Za-z0-9]{20,}/ },
    { what: "Anthropic の鍵", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
    { what: "Google の鍵", pattern: /\bAIza[0-9A-Za-z_-]{30,}/ },
    { what: "GitHub の合言葉", pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
    { what: "AWS の利用者 ID", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
    { what: "秘密鍵ファイルの中身", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  ];

  /** 追跡されているファイルだけを見る。無視されているものは配布物に入らない。 */
  function trackedFiles(): string[] {
    const dirs = ["src", "tests", "docs", "scripts", ".github", "evals"];
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name.startsWith(".next")) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else out.push(full);
      }
    };
    for (const d of dirs) {
      try {
        walk(join(ROOT, d));
      } catch {
        // 無いフォルダは飛ばす（evals はまだ無いことがある）
      }
    }
    return out;
  }

  it("鍵らしい形の文字列が 1 つも無い", () => {
    const hits: string[] = [];
    for (const file of trackedFiles()) {
      const rel = relative(ROOT, file).split("\\").join("/");
      if (rel === "tests/architecture/test-honesty.test.ts") continue; // 探し方を書いてある本人
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue; // 画像などは読めなくてよい
      }
      for (const shape of SECRET_SHAPES) {
        if (shape.pattern.test(source)) hits.push(`${rel}（${shape.what}）`);
      }
    }
    expect(
      hits,
      "秘密情報らしい値が入っています。**消すだけでは足りません。** " +
        "履歴に残るので、その鍵を作り直してください",
    ).toEqual([]);
  });

  it("値を書き込む形の見本を配っていない", () => {
    // `.dev.vars.example` に本物を書いてしまう事故は、見本の形で防ぐ。
    // 「ここに値を書く」ではなく「空欄」にしておく。
    let example: string;
    try {
      example = readFileSync(join(ROOT, ".dev.vars.example"), "utf8");
    } catch {
      expect.fail(".dev.vars.example がありません。何を登録するのかが分からなくなります");
    }
    const withValue = example
      .split("\n")
      .filter((line) => /^[A-Z_]+=.+/.test(line.trim()))
      .filter((line) => !/=\s*(""|''|<[^>]*>|ここに)/.test(line));
    expect(withValue, "見本に値が入っています。空欄にしてください").toEqual([]);
  });
});
