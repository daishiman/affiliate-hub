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

/**
 * 要件 6 が使う道具。**この repo が浅いか。**
 *
 * 浅いと親コミットのオブジェクトが手元に無く、下の `classifyHex` が
 * 「オブジェクトではない」側へ倒れる。**そのとき除外は効かず、誤検出が戻る。**
 * 今の CI は `fetch-depth: 0` なので起きないが、起きたときに黙って
 * 誤検出が増えるのではなく「除外できなかった」と数で分かるようにする。
 */
const SHALLOW: boolean = (() => {
  try {
    return (
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        cwd: process.cwd(),
        encoding: "utf8",
      }).trim() === "true"
    );
  } catch {
    // 判定そのものができないなら、除外が効かないかもしれない側へ倒す。
    return true;
  }
})();

/**
 * 16 進の並びの素性。
 * - `git-object`: git が実体として解決できた。コミット等の id であって秘密ではない。
 * - `not-an-object`: 解決できなかった。**秘密の断片の疑いとして残す。**
 * - `cannot-tell`: 判定そのものができなかった。**残した上で別に数える。**
 */
type HexKind = "git-object" | "not-an-object" | "cannot-tell";

/**
 * **なぜ「git が解決できるか」で除外してよいか。**
 *
 * 秘密はランダムな値なので、この repo の git オブジェクトの id には当たらない。
 * 作為で当てることもできない（当てるには先にその id のオブジェクトを作る必要がある）。
 * つまりこの除外は**通り道にならない**。ファイル単位・行単位の除外とはそこが違う。
 *
 * **`--no-merges` で逃がさないのはこのためである。**合成マージの本文を落とすだけなら
 * `--no-merges` でも緑になるが、この枝が持つ本物のマージコミット（2026-08-19 実測で 3 本）
 * も一緒に読まなくなる。**緑になる直し方と、検出が保たれる直し方は別物である。**
 */
function classifyHex(hex: string): HexKind {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", `${hex}^{object}`], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return "git-object";
  } catch (error) {
    const status = (error as { status?: unknown }).status;
    // 終了コード 1 = 「そんなオブジェクトは無い」。それ以外は git 側の都合で判定不能。
    if (status === 1) return SHALLOW ? "cannot-tell" : "not-an-object";
    return "cannot-tell";
  }
}

/** `[0-9a-f]` が 16 文字以上続く並び。前後が英数字なら当てない
 * （長い識別子の一部を切り出して当たるのを避ける）。 */
const HEX_RUN = /(?<![0-9a-zA-Z])[0-9a-f]{16,}(?![0-9a-zA-Z])/g;
const labelled = (before: string, value: string) =>
  value.length === 64 && /sha256:\s*$/.test(before);

/** 走査の途中経過。**除外した数を持ち歩く**ので、0 件のとき「無かった」のか
 * 「全部外した」のかが後から言える。 */
type HandWrittenScan = { hits: string[]; excluded: number; undetermined: number };

function scanHandWritten(where: string, text: string, acc: HandWrittenScan): void {
  for (const m of text.matchAll(HEX_RUN)) {
    if (labelled(text.slice(0, m.index), m[0])) continue;
    const kind = classifyHex(m[0]);
    if (kind === "git-object") {
      acc.excluded += 1;
      continue;
    }
    // 判定できなかったものは**通さない**。数だけ別に持つ。
    if (kind === "cannot-tell") acc.undetermined += 1;
    acc.hits.push(`${where}（${m[0].length} 文字。値は出しません）`);
  }
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
    const acc: HandWrittenScan = { hits: [], excluded: 0, undetermined: 0 };
    const hits = acc.hits;
    /*
     * **2 つの母集団を分けて数える。**
     * 課題の手書きの欄は、どの枝で走らせても同じだけある。
     * コミット本文は「この枝が基点より先へ進んでいる分」なので、
     * 取り込みが済んだ枝（`main` への push）では**正しく 0 件になる**。
     * 合計に 1 本の床を張ると、この 2 つが混ざって、
     * 正しい 0 と「読めなかった 0」が同じ数字で出てくる。
     */
    let issueFields = 0;
    let commitBodies = 0;
    const scanIssueField = (where: string, text: string) => {
      issueFields += 1;
      scanHandWritten(where, text, acc);
    };
    const scanCommitBody = (where: string, text: string) => {
      commitBodies += 1;
      scanHandWritten(where, text, acc);
    };

    // 手で書いた欄。生成された欄（`file_path` など）は見ない。
    const HAND_WRITTEN = ["title", "description", "notes", "design", "acceptance_criteria"];
    for (const line of readFileSync(".beads/issues.jsonl", "utf8").split("\n")) {
      if (line.trim() === "") continue;
      const issue = JSON.parse(line) as Record<string, unknown>;
      for (const field of HAND_WRITTEN) {
        const value = issue[field];
        if (typeof value === "string") scanIssueField(`${String(issue.id)} の ${field}`, value);
      }
    }

    /*
     * この枝で書いたコミットの本文。取り込み先に入ったものは直せないので見ない。
     *
     * **基点の名前は環境によって違う。** CI のチェックアウトは PR の枝しか作らないので、
     * ローカル枝 `main` は存在しない（`fetch-depth: 0` なので履歴自体はある）。
     * 手元では `main` があるため、手元だけ通って CI だけ落ちる。
     * 順に試して**最初に解決できたもの**を使う。
     */
    const baseCandidates = [
      process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null,
      "main",
      "origin/main",
    ].filter((r): r is string => typeof r === "string" && r !== "");

    let base: string | null = null;
    for (const ref of baseCandidates) {
      try {
        execFileSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], {
          cwd: process.cwd(),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        base = ref;
        break;
      } catch {
        // この候補は解決できない。次を試す。**全部だめだったときは下で落とす。**
        continue;
      }
    }

    /*
     * **ここを握り潰さない。** 基点が無いときにコミット本文の走査を飛ばすと、
     * 秘密の断片を探す側が CI で永久に動かないまま緑になる。
     * 「読めなかった」は「無かった」ではない。
     */
    expect(
      base,
      `比較の基点が見つからないので、この枝のコミット本文を読めていません（試した候補: ${baseCandidates.join(", ")}）。読めていない検査は通してはいけません`,
    ).not.toBeNull();

    const log = execFileSync("git", ["log", "--format=%h%x01%B%x02", `${base}..HEAD`], {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    for (const entry of log.split("\x02")) {
      const [hash, body] = entry.split("\x01");
      if (body === undefined) continue;
      scanCommitBody(`コミット ${hash.trim()} の本文`, body);
    }

    /*
     * **母集団の床（その 1）: 課題の手書きの欄。**
     * 0 件は、読む記録が 1 つも無くても同じ 0 になる。
     * 実測は 2026-08-19 に 311 件、2026-08-21 に 315 件。
     * 200 にしてあるのは、課題が片付いて欄が減ることは普通に起きるが、
     * 4 割も減るなら「片付いた」より「読む先が変わった」を先に疑うべきだからである。
     * 実測ちょうどに張ると、課題を 1 件閉じるだけで赤くなり、床が狼少年になる。
     */
    expect(
      issueFields,
      `課題の手書きの欄を ${issueFields} 件しか読めていません（床 200 件）。読む先が変わっていないか先に見てください`,
    ).toBeGreaterThanOrEqual(200);

    /*
     * **母集団の床（その 2）: この枝のコミット本文。**
     *
     * ここは件数を固定できない。基点より先へ進んでいる分しか無いので、
     * 枝を切った直後は 1 件、取り込みが済んだ後（`main` への push）は 0 件が**正しい**。
     * 2026-08-21 の CI はここで落ちた——合計に床 400 を張っていたため、
     * 取り込み後の main で「コミットが 0 件になった」が「読む先が壊れた」に見えた。
     *
     * **だが 0 件を無条件に通すと、基点の取り違えで走査が死んでも緑になる。**
     * そこで git に証明させる: `HEAD` が基点に含まれているなら、
     * 先へ進んでいるコミットは定義上 1 件も無い。含まれていないのに 0 件なら、
     * 基点の取り違えなので落とす。
     */
    const headIsInBase = (() => {
      try {
        execFileSync("git", ["merge-base", "--is-ancestor", "HEAD", base as string], {
          cwd: process.cwd(),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        return true;
      } catch {
        // 終了コード 1 = 含まれていない。それ以外の失敗も「含まれていない」側へ倒す
        // （判定できないまま 0 件を通すより、落として人に見せる方が安い）。
        return false;
      }
    })();

    if (headIsInBase) {
      /*
       * 含まれているなら、先へ進んでいるコミットは**定義上 1 件も無い**。
       * 「0 以上」ではなく 0 ちょうどで固定する。1 件でも読めたということは
       * `base..HEAD` の解釈と含有判定が食い違っているということで、
       * そのときは走査の当たり外れ以前に、基点の意味が壊れている。
       */
      expect(
        commitBodies,
        `HEAD は基点（${base}）に含まれているのに、コミット本文を ${commitBodies} 件読みました。基点の解釈が食い違っています`,
      ).toBe(0);
    } else {
      /*
       * 含まれていないなら、この枝は基点より先へ進んでいる。**本文は最低 1 件ある。**
       * 床を 1 より上げない。枝を切って 1 コミット目で開ける PR は正当にあり、
       * そこを赤くすると「床を満たすために意味のないコミットを積む」方へ倒れる。
       * ここで見たいのは「たくさん読んだ」ではなく「読む口が生きている」ことである。
       */
      expect(
        commitBodies,
        `HEAD は基点（${base}）に含まれていないのに、コミット本文を 1 件も読めていません。基点を取り違えています`,
      ).toBeGreaterThanOrEqual(1);
    }


    /*
     * **除外した数を必ず出す。**除外は検査を弱める形なので、黙って効かせない。
     * 何件外したかが見えていないと、次にここが 0 件を返したとき、それが
     * 「無かった」なのか「全部外した」なのかを誰も言えない。
     * `undetermined` は「判定そのものができなかった」数で、除外の数には混ぜない
     * （混ぜると、除外が壊れたことが除外の成功に見える）。
     */
    const tally =
      `読んだ記録: 課題の手書きの欄 ${issueFields} 件 + コミット本文 ${commitBodies} 件` +
      `（基点 ${base}、HEAD は基点に${headIsInBase ? "含まれる" : "含まれない"}） / ` +
      `git オブジェクトとして解決したので除外: ${acc.excluded} 件 / ` +
      `判定できなかったので残した: ${acc.undetermined} 件（浅いクローン: ${SHALLOW ? "はい" : "いいえ"}）`;

    expect(
      hits,
      `手で書いた記録に値の断片が入っています:\n${hits.join("\n")}\n${tally}\n値ではなく事実を書いてください（例:「平文の鍵が戻り値に載った」）`,
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

  /*
   * **除外を入れたので、対照も 2 つ要る。**
   *
   * 「git オブジェクトに解決する hex は除外する」は検査を弱める形である。
   * 弱め方が効きすぎれば検出が死に、効かなければ誤検出が戻る。
   * **片方の餌だけでは、どちらが起きたか区別できない。**
   * 落ちる餌だけなら除外が効いていない場合を見逃し、
   * 通る餌だけなら検出そのものが死んでいる場合を見逃す。
   *
   * **対照の生存は二値（出た／出ない）ではない。**期待件数まで固定する。
   * 件数を見ずに「出た」だけを見ると、対照が部分的に死んでも正常な顔で通り抜ける。
   * 期待値は先に書く: 落ちる餌 = 当たり 1 件・除外 0 件、通る餌 = 当たり 0 件・除外 1 件。
   */
  it("要件 6 の除外が効きすぎていない（git に解決しない 40 桁は当たる）", () => {
    // 40 桁ちょうどだが、この repo のどのオブジェクトでもない並び。
    const notAnObject = `${"f".repeat(39)}e`;
    const acc: HandWrittenScan = { hits: [], excluded: 0, undetermined: 0 };
    scanHandWritten("対照", `平文の鍵が戻り値に載った（${notAnObject}）`, acc);

    expect(acc.hits, "git に解決しない 40 桁が当たりません（探す側が死んでいます）").toHaveLength(1);
    expect(acc.excluded, "秘密の疑いのある値が除外されました（除外が効きすぎています）").toBe(0);
    // 浅いクローンでは「オブジェクトが無い」と「そもそも判定できない」が区別できない。
    expect(acc.undetermined, "判定できなかった件数が想定と違います").toBe(SHALLOW ? 1 : 0);
  });

  it("要件 6 の除外が効いている（実在するコミットの 40 桁 SHA は除外される）", () => {
    const realSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();
    expect(realSha, "HEAD の SHA が 40 桁で取れません").toHaveLength(40);

    const acc: HandWrittenScan = { hits: [], excluded: 0, undetermined: 0 };
    // `sha256:` の札は付けない。**札ではなく、git が解けたことで通っている**のを見る。
    scanHandWritten("対照", `直前の版（${realSha}）へ戻した`, acc);

    expect(acc.excluded, "実在するコミットの SHA が除外されません（除外が効いていません）").toBe(1);
    expect(acc.hits, "実在するコミットの SHA が当たってしまいました").toHaveLength(0);
    expect(acc.undetermined, "判定できなかった件数が想定と違います").toBe(0);
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
