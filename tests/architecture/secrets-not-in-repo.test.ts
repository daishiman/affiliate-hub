/** @tier 1 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * **これは「これから入るのを止める」検査であって、「すでに履歴にあるものを見つける」検査ではない。**
 *
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
 * @req REQ-SEC10, REQ-CI07
 * @types secrets, infra-config
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
  // **`Buffer` として受けない。** 本番の組み立て（`next build`）では
  // Workers 側の型が入り、`Buffer.toString("utf8")` が引数 0 個の別物になる。
  // `Uint8Array` と `TextDecoder` はどちらの環境にもあるので、そちらで書く。
  let buf: Uint8Array;
  try {
    buf = readFileSync(path);
  } catch {
    // 追跡はされているが手元に無い（部分取得）。読めないものは判定しない。
    return null;
  }
  if (buf.includes(0)) return null;
  return new TextDecoder("utf-8").decode(buf);
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

  /**
   * **これは要件 1 とは別のことを見ている。**
   *
   * 要件 1 は「発行元の形をした値」を探す。出どころの分からない羅列は**わざと通す**
   * （通さないと指紋や識別子が全部当たり、除外の一覧が育って検査が読まれなくなる）。
   *
   * だがその「通す」判断は、**機械が生成したファイルを前提にしている。**
   * 人が手で書く欄——課題のメモ、コミットの本文、報告——は事情が違う。
   * ここに値の断片が現れるのは、たいてい**「見本だから書いてよい」と判断したとき**である。
   * 実害は無いことが多い。問題は実害ではなく**手癖**で、同じ書き方は本物を見たときにも出る。
   * そのときは書いた後で気づくことになり、履歴からは消えない。
   *
   * **必要なのは値ではなく事実である。**「平文の鍵が戻り値に載った」で伝わる。
   * 先頭の数文字は、読む人に何の判断材料も与えていない。
   *
   * --- 通す条件を、測ってから決めた ---
   * 2026-08-19 の実測: 当たったのは 14 件、**すべて同じ 1 つの値**で、
   * いずれも `dev_graph_source_digest: sha256:` の札が直前に付いた 64 桁の指紋だった。
   * 指紋を 1 件ずつ許す形（この上の `KNOWN_NOT_SECRET`）にしなかったのは、
   * この値が節点を登録し直すたびに変わるためである。変わるものを 1 件ずつ許すと、
   * 一覧が育ち続け、やがて**除外そのものが弁になる**。
   *
   * 代わりに「**`sha256:` と名乗っていて、かつ 64 桁ちょうど**」の両方を満たすものだけ通す。
   * 札だけでは通らないし、長さだけでも通らない。
   *
   * **逃げ道は残っている**——値の前に `sha256:` と書き、たまたま 64 桁なら通る。
   * 塞いでいないことを承知で通している。塞ぐには「本当に sha256 か」を確かめる必要があり、
   * 元の値が要る。元の値は、まさにここへ書かせたくないものである。
   *
   * --- **この検査は、これを作らせた事件そのものを捕まえない** ---
   * きっかけは、課題のメモに鍵の**先頭 8 文字**が「◯◯◯◯◯◯◯◯…」の形で貼られたことである。
   * 8 文字なので、16 文字の閾値には当たらない。**閾値を 8 まで下げると当たるが、
   * そのとき当たるのは 2 件で、2 件とも指紋の先頭 8 文字を正しく参照している記述**だった
   * （2026-08-19 実測。1 件は触らない指定の課題のメモ、1 件は既にこの枝の履歴にあるコミット本文）。
   * 8 文字の 16 進は、鍵の断片・コミットの短縮・指紋の先頭が**形の上で区別できない**。
   * 除外の一覧で逃がすとそれが弁になるので、下げずに残し、**捕まえないことを書いて残す**。
   * 閾値を下げるか、下げずに済ませるかは、こちらでは決めない。
   */
  it("要件 6: 手で書いた記録に、値の断片が貼られていない", () => {
    // `[0-9a-f]` が 16 文字以上続く並び。前後が英数字なら当てない
    // （長い識別子の一部を切り出して当たるのを避ける）。
    const HEX_RUN = /(?<![0-9a-zA-Z])[0-9a-f]{16,}(?![0-9a-zA-Z])/g;
    const labelled = (before: string, value: string) =>
      value.length === 64 && /sha256:\s*$/.test(before);

    const hits: string[] = [];
    let scanned = 0;
    const scan = (where: string, text: string) => {
      scanned += 1;
      for (const m of text.matchAll(HEX_RUN)) {
        if (labelled(text.slice(0, m.index), m[0])) continue;
        hits.push(`${where}（${m[0].length} 文字。値は出しません）`);
      }
    };

    // 手で書いた欄。生成された欄（`file_path` など）は見ない。
    const HAND_WRITTEN = ["title", "description", "notes", "design", "acceptance_criteria"];
    for (const line of readFileSync(".beads/issues.jsonl", "utf8").split("\n")) {
      if (line.trim() === "") continue;
      const issue = JSON.parse(line) as Record<string, unknown>;
      for (const field of HAND_WRITTEN) {
        const value = issue[field];
        if (typeof value === "string") scan(`${String(issue.id)} の ${field}`, value);
      }
    }

    // この枝で書いたコミットの本文。`main` に入ったものは直せないので見ない。
    const log = execFileSync("git", ["log", "--format=%h%x01%B%x02", "main..HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    for (const entry of log.split("\x02")) {
      const [hash, body] = entry.split("\x01");
      if (body === undefined) continue;
      scan(`コミット ${hash.trim()} の本文`, body);
    }

    /*
     * **母集団の床。**0 件は、読む記録が 1 つも無くても同じ 0 になる。
     * 2026-08-19 の実測は 563 件（課題の手書きの欄 311 + この枝のコミット 252）。
     * 400 にしてあるのは、課題が片付いて欄が減ることは普通に起きるが、
     * 4 割も減るなら「片付いた」より「読む先が変わった」を先に疑うべきだからである。
     * 実測ちょうどに張ると、課題を 1 件閉じるだけで赤くなり、床が狼少年になる。
     */
    expect(
      scanned,
      `読んだ記録が ${scanned} 件しかありません（床 400 件）。読む先が変わっていないか先に見てください`,
    ).toBeGreaterThanOrEqual(400);

    expect(
      hits,
      `手で書いた記録に値の断片が入っています:\n${hits.join("\n")}\n値ではなく事実を書いてください（例:「平文の鍵が戻り値に載った」）`,
    ).toEqual([]);
  });

  /*
   * **0 件は、探す側が壊れていても出る。**合成した見本で当たることを見る。
   * 見本は 16 進の**文字種を並べただけ**のもので、どこかの値の写しではない。
   * 当たる側と通す側を別の `it` にしてあるのは、1 つに入れると前が落ちたとき
   * 後ろが評価されず、**片方だけ壊れたことが見えなくなる**ためである。
   */
  it("要件 6 の見つける側が動いている（札の無い並びに当たる）", () => {
    const synthetic = "0123456789abcdef";
    const hits = `未ログインで鍵が発行された（${synthetic}…）`.match(
      /(?<![0-9a-zA-Z])[0-9a-f]{16,}(?![0-9a-zA-Z])/g,
    );
    expect(hits, "札の無い 16 桁の並びが見つかりません").toHaveLength(1);
  });

  it("要件 6 の通す側が動いている（札の付いた 64 桁は通る）", () => {
    const text = `dev_graph_source_digest: sha256: ${"0123456789abcdef".repeat(4)}`;
    const m = [...text.matchAll(/(?<![0-9a-zA-Z])[0-9a-f]{16,}(?![0-9a-zA-Z])/g)][0];
    const passes = m?.[0].length === 64 && /sha256:\s*$/.test(text.slice(0, m.index));
    expect(passes, "札の付いた 64 桁の指紋が通りません").toBe(true);
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
