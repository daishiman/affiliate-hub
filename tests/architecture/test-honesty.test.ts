/** @tier 1 */
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
 * ここで見るのは 7 つ。
 *   1. 中身が空のテストが無いか
 *   2. 何も確かめていないテストが無いか
 *   3. 「呼ばれた回数」だけを確かめたテストが無いか（中の作りに縛られる）
 *   4. **常に真になる確認**が無いか（`expect(true).toBe(true)` の類）
 *   5. `.skip` / `.only` / コメントアウトされたテストが残っていないか
 *   6. スナップショットを無条件に更新していないか
 *   7. カバレッジの除外に、書かれた理由が付いているか
 *
 * 4〜7 は「テストがある」と言えてしまう形で中身が無いもの。
 * 1〜3 と違って**書いた本人にも自覚が無いまま増える**ので、機械で見る。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §1（数字合わせの禁止）/ §3（振る舞いを見る）/ §12
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

describe("確かめたふりになっていないこと", () => {
  /**
   * 常に真になる確認。
   *
   * `expect(true).toBe(true)` は、書きかけを残したときと、
   * 「落ちないテスト」を足して件数を作ったときの両方で出る。
   * 前者は悪意が無く、後者は自覚がある。**どちらも同じ形**なので同じ検査で捕まる。
   *
   * 変数どうしの比較（`expect(a).toBe(a)`）まで見に行かないのは、
   * 名前が同じでも中身が違う場合があり、誤検出が出るため。
   * ここでも見落とす方向に倒す。
   */
  const ALWAYS_TRUE = [
    /expect\s*\(\s*true\s*\)\s*\.\s*toBe\s*\(\s*true\s*\)/,
    /expect\s*\(\s*false\s*\)\s*\.\s*toBe\s*\(\s*false\s*\)/,
    /expect\s*\(\s*(\d+)\s*\)\s*\.\s*toBe\s*\(\s*\1\s*\)/,
    /expect\s*\(\s*(["'`])([\s\S]*?)\1\s*\)\s*\.\s*toBe\s*\(\s*\1\2\1\s*\)/,
  ];

  /*
    **`toBeDefined()` だけのテストは、ここでは落とさない。**

    最初は「弱い確認」として落とす作りにしたところ、4 件当たり、
    うち 3 件は正しい確認だった（`scripts[x]` が実在するか、
    `FACT_TONE_RULES[source]` が用意されているか、など）。
    `toBeDefined()` は undefined なら**落ちる**ので、常に真ではない。

    誤って赤くする検査は、そのうち検査ごと外される。
    見張りたいのは「何を書いても通る形」だけなので、そこに絞る。
    弱い確認は、ミューテーションテスト（§10）が生き残った変異として拾う。
  */

  it("常に真になる確認だけのテストが無い", () => {
    const fake: string[] = [];
    for (const file of ALL) {
      for (const t of eachTest(file.source)) {
        for (const pattern of ALWAYS_TRUE) {
          if (pattern.test(t.body)) fake.push(`${file.path}:${t.line} 「${t.name}」`);
        }
      }
    }
    expect(
      [...new Set(fake)],
      "書いた式が何であっても通ります。**何が正しいのか**を書いてください",
    ).toEqual([]);
  });

  it("止めた（.skip）テストが残っていない", () => {
    // 止めたテストは、あるように見えて無い。
    // 直せないなら消して残課題に書く。残すなら理由を `docs/product/backlog.md` に書く。
    const skipped: string[] = [];
    for (const file of ALL) {
      const clean = withoutComments(file.source);
      for (const match of clean.matchAll(/\b(it|describe|test)\.(skip|todo|failing)\s*\(/g)) {
        const line = clean.slice(0, match.index ?? 0).split("\n").length;
        skipped.push(`${file.path}:${line} ${match[1]}.${match[2]}`);
      }
    }
    expect(skipped, "止めたテストが残っています。消すか、直すか、残課題へ移してください").toEqual(
      [],
    );
  });

  it("1 件だけ走らせる指定（.only）が残っていない", () => {
    // `.only` を消し忘れると、**そのファイルの他のテストが全部走らない**まま緑になる。
    // 落ちないので気づけない。ここでしか捕まらない。
    const only: string[] = [];
    for (const file of ALL) {
      const clean = withoutComments(file.source);
      for (const match of clean.matchAll(/\b(it|describe|test)\.only\s*\(/g)) {
        const line = clean.slice(0, match.index ?? 0).split("\n").length;
        only.push(`${file.path}:${line} ${match[1]}.only`);
      }
    }
    expect(only, "他のテストが走らないまま緑になります。.only を消してください").toEqual([]);
  });

  it("コメントアウトされたテストが残っていない", () => {
    // 消さずにコメントにすると、「あとで戻す」つもりのまま残り続ける。
    // 残す理由があるなら残課題に書く。コードの中に置くと、誰も読まない。
    const commented: string[] = [];
    for (const file of ALL) {
      file.source.split("\n").forEach((line, index) => {
        if (/^\s*(\/\/|\*)\s*(it|test|describe)(\.\w+)?\s*\(\s*["'`]/.test(line)) {
          commented.push(`${file.path}:${index + 1}`);
        }
      });
    }
    expect(commented, "コメントにしたテストが残っています。消して残課題へ移してください").toEqual(
      [],
    );
  });

  it("スナップショットを無条件に更新していない", () => {
    // `--update` を既定にすると、**壊れた出力がそのまま正解として焼き付く**。
    // スナップショットは「変わっていないこと」を見る道具で、変わったら人が見る。
    const config = readFileSync(join(ROOT, "vitest.config.mts"), "utf8");
    expect(config).not.toMatch(/updateSnapshot|snapshotOptions[\s\S]*update\s*:\s*true/);
    const scripts = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts as Record<
      string,
      string
    >;
    for (const [name, body] of Object.entries(scripts)) {
      expect(body, `${name} がスナップショットを無条件に更新します`).not.toMatch(/-u\b|--update/);
    }
  });

  it("カバレッジの除外に、書かれた理由が付いている", () => {
    /*
      除外は「測らない」ことなので、線引きを動かすだけで数字を作れる。
      だから**数を制限するのではなく、理由を必須にする**。
      数で縛ると、理由のある除外まで止まって、除外そのものを隠す方向へ行く。
    */
    const config = readFileSync(join(ROOT, "vitest.config.mts"), "utf8");
    const block = config.match(/exclude:\s*\[([^\]]*)\]/);
    expect(block, "カバレッジの除外の書き方が変わりました。この検査を直してください").not.toBeNull();
    const entries = [...(block?.[1] ?? "").matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);

    // 除外 1 件ずつに、この表の中の理由が要る。表に無いものを足したらここが落ちる。
    const REASONS: Record<string, string> = {
      "src/**/*.d.ts": "型の宣言だけで、実行される行が 1 行も無い",
      "src/**/*.css": "v8 が解析できず PARSE_ERROR が並ぶ（測定の失敗であって、除外の判断ではない）",
    };
    const withoutReason = entries.filter((e) => !(e in REASONS));
    expect(
      withoutReason,
      "カバレッジの除外に理由がありません。" +
        "tests/architecture/test-honesty.test.ts の REASONS に理由を書いてから除外してください",
    ).toEqual([]);
    expect(entries.length, "除外が 1 件も無いのに理由の表があります").toBeGreaterThan(0);
  });

  it("プラグマでカバレッジから外している場所が無い", () => {
    // `/* v8 ignore */` は 1 行で分母を減らせる。使うなら理由を隣に書く。
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(full)) {
          readFileSync(full, "utf8")
            .split("\n")
            .forEach((line, index) => {
              if (/(v8|c8|istanbul)\s+ignore/.test(line)) {
                hits.push(`${relative(ROOT, full)}:${index + 1}`);
              }
            });
        }
      }
    };
    walk(join(ROOT, "src"));
    expect(hits, "プラグマでカバレッジから外しています。理由を書いてこの検査を更新してください").toEqual(
      [],
    );
  });
});
