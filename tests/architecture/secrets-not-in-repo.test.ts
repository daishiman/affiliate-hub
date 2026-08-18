/** @tier 1 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 秘密の値がリポジトリに載っていないことを固定する。
 *
 * --- なぜ機械で読むのか ---
 * 「鍵はコミットしない」は決まりとしては書いてあるが、この要件の証拠は
 * 長いあいだ `.gitignore` の 1 行だけだった（要件表 `REQ-SEC10` の
 * 確かめた欄は `NOT RUN`）。`.gitignore` は**その名前のファイル**を止めるだけで、
 * 別名で作った控え・貼り付けた手順書・生成物の中に混ざった値は止めない。
 *
 * 秘密の混入は、混ざっても画面が何も変わらない。テストも通る。ビルドも通る。
 * **壊れて見えないので、気づく機会が無い。** だから git が追跡しているもの全部を、
 * 毎回読む。
 *
 * --- この検査が見ていないこと ---
 * **過去の履歴は見ない。** いま追跡されているものだけを見る。
 * 一度コミットされた値は、作業ツリーから消しても履歴に残る。それを消すのは
 * 履歴の書き換え（と鍵の作り直し）で、検査ではなく手当ての話になる。
 * ここが緑でも「過去に漏らしていない」ことにはならない。
 *
 * 値の形も網羅ではない。既知の発行元の形と、名前つきの代入だけを見る。
 * 出どころの分からない 32 文字の羅列は通る。**これは通す**——
 * 通さないようにすると識別子や指紋の類が全部引っかかり、
 * 例外一覧が育って検査が読まれなくなる。
 *
 * 規範: docs/product/credential-registration.md
 * @req REQ-SEC10
 * @types secrets
 */

/**
 * git が追跡しているファイル。**「リポジトリに載っている」とはこれのこと**なので、
 * 自前でフォルダを辿らない。自前で辿ると「見に行かない場所」の一覧が要る。
 * その一覧はそのまま逃げ道になる（隠したい値をそこへ置けば通る）。
 */
const TRACKED = execFileSync("git", ["ls-files", "-z"], {
  cwd: process.cwd(),
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
})
  .split("\0")
  .filter(Boolean);

/**
 * 秘密の値の形。
 *
 * **パターンの文字列を 2 つに割って組み立てている。** そのまま書くと
 * この検査ファイル自身が引っかかり、自分を対象から外す羽目になる。
 * 自分を外すと、外した口が他の値の通り道にもなる。
 */
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "Anthropic の API キー", re: new RegExp("sk-" + "ant-[A-Za-z0-9_-]{24,}") },
  { name: "OpenAI の API キー", re: new RegExp("sk-" + "(proj|svcacct)-[A-Za-z0-9_-]{24,}") },
  { name: "Google OAuth の秘密の値", re: new RegExp("GOCSPX" + "-[A-Za-z0-9_-]{16,}") },
  { name: "GitHub のトークン", re: new RegExp("gh[pousr]" + "_[A-Za-z0-9]{36,}") },
  { name: "AWS のアクセスキー", re: new RegExp("AKIA" + "[0-9A-Z]{16}") },
  { name: "Slack のトークン", re: new RegExp("xox[baprs]" + "-[A-Za-z0-9-]{20,}") },
  { name: "秘密鍵ファイルの中身", re: new RegExp("-----BEGIN [A-Z ]{0,20}PRIVATE" + " KEY-----") },
  /*
   * 名前つきの代入に実際の値が入っている形。
   * 見本や説明のための空欄・伏せ字（`=`, `=...`, `=<ここに>`, `=your-key`）は通す。
   * ここを厳しくすると `.env.example` や手順書が書けなくなり、
   * 「例を書かない」ではなく「検査を外す」方へ倒れる。
   */
  {
    name: "秘密の名前への実値の代入",
    re: new RegExp(
      "\\b[A-Z][A-Z0-9_]*(SECRET|TOKEN|API_KEY|PASSWORD|CREDENTIAL)S?\\s*[=:]\\s*" +
        "[\"']?(?!your|xxx|dummy|sample|example|changeme|<|\\.\\.\\.|\\$|\\{)" +
        "[A-Za-z0-9+/_-]{24,}",
    ),
  },
];

/** 当たった値の指紋。**値そのものはどこにも書かない**ための道具。 */
const fingerprint = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 16);

/**
 * 形は秘密と同じだが、秘密ではないと確かめた値。**指紋で 1 件ずつ許す。**
 *
 * ファイル単位・フォルダ単位で外さない理由。外した場所は、そこへ置けば通る
 * 通り道になる。ここは値そのものを縛るので、同じファイルに**別の**値が現れれば落ちる。
 * 値を書かずに済むので、許可一覧を見ても鍵は増えない。
 *
 * 足すときは「どこの・何のための値で、なぜ秘密でないと言えるか」を必ず書く。
 * 失敗の文言に指紋が出るので、値を貼り付けずに追記できる。
 */
const KNOWN_NOT_SECRET: Record<string, string> = {
  // .claude/plugins/dev-graph/tests/test_validate_repo_config.py（3 箇所とも同じ値）
  // 「設定に token の置き場を新設できない」ことを確かめるための架空の値。
  // 外から入れた道具の同梱テストで、こちらの発行物ではない。
  b16856bcebccbbe5: "dev-graph の設定検査が使う架空の GitHub トークン",
};

/** 中身が文字でないもの（画像・フォント）は読み飛ばす。NUL を含むかで判定する。 */
function readText(path: string): string | null {
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch {
    // 追跡はされているが手元に無い（部分取得）。読めないものは判定しない。
    return null;
  }
  if (buf.includes(0)) return null;
  return buf.toString("utf8");
}

describe("秘密の値がリポジトリに載っていない", () => {
  it("要件 1: 追跡しているファイルに、秘密の値の形をしたものが 1 つも無い", () => {
    const hits: string[] = [];
    for (const path of TRACKED) {
      const text = readText(path);
      if (text === null) continue;
      for (const { name, re } of SECRET_PATTERNS) {
        for (const m of text.matchAll(new RegExp(re.source, "g"))) {
          const print = fingerprint(m[0]);
          if (print in KNOWN_NOT_SECRET) continue;
          /*
           * 値そのものを失敗の文言へ出さない。出すと記録・画面・CI のログに鍵が増え、
           * 「漏れを見つける仕掛け」が漏らす側に回る。代わりに場所と指紋を出す。
           */
          const line = text.slice(0, m.index).split("\n").length;
          hits.push(`${path}:${line} ${name}（指紋 ${print}）`);
        }
      }
    }
    expect(hits, `秘密らしき値が載っています（値は出しません）:\n${hits.join("\n")}`).toEqual([]);
  });

  it("要件 2: 秘密の置き場そのものが追跡されていない", () => {
    /*
     * `.dev.vars` は wrangler が手元で読む秘密の置き場、`.env` は Node 側の同じもの。
     * **この 2 つが追跡された瞬間、要件 1 は無関係に破れる**（中身が全部載る）。
     */
    const forbidden = TRACKED.filter((p) => {
      const name = p.split("/").at(-1) ?? "";
      if (name === ".env.example") return false; // 空欄の見本は載ってよい
      return name === ".dev.vars" || name === ".env" || name.startsWith(".env.");
    });
    expect(forbidden, "秘密の置き場が追跡されています").toEqual([]);
  });

  it("要件 3: 追跡を止める仕掛けが `.gitignore` に残っている", () => {
    // 要件 2 は「いま載っていない」だけを言う。次に作られたときに止まるかは別。
    const ignore = readFileSync(".gitignore", "utf8");
    for (const entry of [".dev.vars", ".env"]) {
      expect(
        ignore.split("\n").some((line) => line.trim() === entry),
        `.gitignore に ${entry} の行がありません`,
      ).toBe(true);
    }
  });

  it("要件 4: 平文で配られる設定に秘密の名前が無い", () => {
    /*
     * `wrangler.jsonc` の `vars` は**そのままリポジトリに載り、そのまま配られる**。
     * 秘密は `wrangler secret put` 側に置く（`src/types/env.d.ts` の説明どおり）。
     * `vars` を持たない今は空振りするが、**足された日に効く**ので先に置いておく。
     */
    const wrangler = readFileSync("wrangler.jsonc", "utf8");
    const vars = wrangler.match(/"vars"\s*:\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(vars).not.toMatch(/SECRET|TOKEN|API_KEY|PASSWORD|CREDENTIAL/);
  });

  it("要件 5: 秘密の名前がブラウザへ渡る名前になっていない", () => {
    /*
     * `NEXT_PUBLIC_` の付いた名前は**値がブラウザ向けの束へ焼き込まれる**。
     * サーバ側の設定として正しく置いても、名前の付け方 1 つで公開される。
     */
    const hits: string[] = [];
    for (const path of TRACKED) {
      if (!/\.(ts|tsx|mts|mjs|js|jsonc?|md)$/.test(path)) continue;
      const text = readText(path);
      if (text === null) continue;
      for (const m of text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]*/g)) {
        if (/SECRET|TOKEN|API_KEY|PASSWORD|CREDENTIAL/.test(m[0])) hits.push(`${path}: ${m[0]}`);
      }
    }
    expect(hits, "秘密の名前がブラウザへ渡る形で書かれています").toEqual([]);
  });
});
