/**
 * @tier 2
 * @req REQ-TS09
 * @types contract, infra-config
 *
 * 「機械が作る。手で書き換えない」と書いてある文書が、**本当に生成物であること**。
 *
 * --- なぜ検査が要るのか ---
 *
 * これまで、スクリプトが作る 4 枚は毎回**上書き**されていた。上書きは修復ではなく
 * 消去なので、手で 1 行書いた人は `pnpm run verify` が緑なのを見て、
 * 書いたものが残っていると思う。**消えたことは緑として現れる。**
 *
 * `scripts/lib/generated-doc.mjs` は、書く前に指紋を突き合わせて、
 * 合わなければ**書かずに止める**。ここではその道具そのものと、
 * **道具を通っていない書き込みが増えていないか**を見る。
 *
 * --- 4 度目を捕まえるのはどれか ---
 *
 * 「消えたことは緑として現れる」形は、この作業場所で 3 度出ている
 * （残課題 78）。3 件目を塞ぐだけでは、4 件目もまた誰かが気づくのを待つことになる。
 * **4 度目を捕まえるのは、この下の「道具を通らない書き込み」の検査**である。
 * 新しく生成物を 1 枚足した人が `writeFileSync` で直接書けば、ここで落ちる。
 */
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  digestOf,
  inspectStamped,
  stamp,
  writeGeneratedDoc,
} from "../../scripts/lib/generated-doc.mjs";
import { expectLedgerFile } from "../support/ledger-file";

const ROOT = process.cwd();

/**
 * 指紋が焼かれているべき文書。
 *
 * **一覧を増減どちらでも赤にする。**「焼くのをやめた」を静かに通すと、
 * この課題で塞いだ穴がそのまま開き直る（しかも開いたようには見えない）。
 */
const STAMPED = [
  // B: スクリプトが毎回上書きする 4 枚
  "docs/product/port-wiring-report.md",
  "docs/product/required-test-types-report.md",
  "docs/product/test-traceability.md",
  "docs/product/coverage.md",
  // A: テストが生成結果と比べる 4 枚。**比べるだけでは足りない。**
  // 比較が答えているのは「古くないか」で、正本を先に直してから同じ内容を
  // 手で書けば通ってしまう。指紋は中身から作るので、そこで合わなくなる。
  "docs/product/open-doors.md",
  "docs/product/stub-ledger.md",
  "docs/product/event-ledger.md",
  "docs/product/eval-ledger.md",
] as const;

/**
 * 道具を通さずに `docs/` へ書いてよいもの。**理由を必ず書く。**
 * 理由の無い除外は、次に見た人には「そういうものだ」としか読めない。
 */
const WRITE_EXCEPTIONS: Readonly<Record<string, string>> = {
  // JSON なので `<!-- -->` の指紋を末尾に置けない。実際の鍵で人が 1 回だけ動かす
  // 記録であり、`pnpm run verify` は触らないので「黙って消える」は起きない。
  //
  // **理由を条件の形で書く。**「いま真であること」と「将来も真であること」は別で、
  // `verify` の対象に入った日に、この除外は**静かに間違いになる**。
  // 条件で書いておけば、次に読む人が真偽を確かめられる。
  "llm-live-proof.mjs":
    "JSON で、コメント欄が無い（指紋を置く場所が無い）。" +
    "**この除外は `pnpm run verify` が `llm-live-proof.mjs` を呼ばないあいだだけ成り立つ。**" +
    "verify の並びに入れる日には、先に指紋の置き方（別ファイルか JSON の一項目か）を決めること。",
};

/** `tests/` の下を全部たどる。浅く見ると、深いところの書き込みを見失う。 */
function listTestFiles(dir: string): { label: string; path: string }[] {
  const out: { label: string; path: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTestFiles(path));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      out.push({ label: path.slice(ROOT.length + 1), path });
    }
  }
  return out;
}

describe("生成物であることの保証", () => {
  it("指紋が焼かれている文書は、いまの中身と一致している", () => {
    for (const rel of STAMPED) {
      const text = readFileSync(join(ROOT, rel), "utf8");
      const found = inspectStamped(
        rel.endsWith("coverage.md")
          ? (text.match(
              /<!-- ここから下は scripts\/coverage-report\.mjs[\s\S]*?<!-- ここまで -->(?:\n<!-- 生成物の指紋[^\n]*-->)?/,
            )?.[0] ?? "")
          : text,
      );
      expect(found.state, `${rel} の指紋が中身と合っていません`).toBe("INTACT");
    }
  });

  it("指紋を焼いている文書が、増えても減っても気づける", () => {
    const stamped = readdirSync(join(ROOT, "docs/product"))
      .filter((n) => n.endsWith(".md"))
      .filter((n) => readFileSync(join(ROOT, "docs/product", n), "utf8").includes("生成物の指紋"))
      .map((n) => `docs/product/${n}`)
      .sort();
    expect(stamped).toEqual([...STAMPED].sort());
  });

  it("手で 1 文字書き足すと、指紋が合わなくなる", () => {
    const intact = stamp("これは機械が作った行です。");
    expect(inspectStamped(intact).state).toBe("INTACT");
    // 内容が正しいかどうかは見ていない。**手が入ったかどうか**を見ている。
    expect(inspectStamped(intact.replace("行です。", "行です。 ここに手で足した。")).state).toBe(
      "TAMPERED",
    );
  });

  it("書き換えられた文書を、上書きしない（手で書いた行が残ったまま止まる）", () => {
    const dir = mkdtempSync(join(tmpdir(), "generated-doc-"));
    const path = join(dir, "report.md");

    writeGeneratedDoc(path, "一行目\n二行目");
    writeFileSync(path, `${readFileSync(path, "utf8")}\n手で書いた行\n`, "utf8");

    // ここが要点。**投げるだけでなく、書かずに投げる。**
    // 書いてから直すのでは、書いた本人には消えたことが見えない。
    expect(() => writeGeneratedDoc(path, "一行目\n二行目")).toThrow(/手で書き換えられています/);
    expect(readFileSync(path, "utf8")).toContain("手で書いた行");
  });

  it("指紋の行だけ外しても、中身が違えば止まる", () => {
    const dir = mkdtempSync(join(tmpdir(), "generated-doc-"));
    const path = join(dir, "report.md");

    // 指紋の行だけを外し、そのうえで中身を書き換えた状態。
    writeFileSync(path, "一行目\n手で書いた行\n", "utf8");
    expect(() => writeGeneratedDoc(path, "一行目\n二行目")).toThrow(/指紋の行が外された/);

    // 外しただけで中身が同じなら、失われるものが無いので焼き直して先へ進む。
    // ここを止めると、戻す手段が無くなって行き止まりになる。
    writeFileSync(path, "一行目\n二行目\n", "utf8");
    expect(() => writeGeneratedDoc(path, "一行目\n二行目")).not.toThrow();
    expect(inspectStamped(readFileSync(path, "utf8")).state).toBe("INTACT");
  });

  it("止めるとき、消えるところだった行そのものを見せる", () => {
    const dir = mkdtempSync(join(tmpdir(), "generated-doc-"));
    const path = join(dir, "report.md");

    writeGeneratedDoc(path, "一行目\n二行目");
    writeFileSync(path, `${readFileSync(path, "utf8")}\n手で書いた大事な行\n`, "utf8");

    // 「一致しません」だけを出すと、打った人は再生成して先へ進む。
    // **消えかけた中身そのもの**が画面に出て初めて、書いた本人がそこで気づける。
    expect(() => writeGeneratedDoc(path, "一行目\n二行目")).toThrow(
      /上書きしていたら、この行が消えていました[\s\S]*手で書いた大事な行/,
    );
  });

  it("実際の 4 枚に、手書きと同じ差分を当てると捕まる", () => {
    // **手で 1 度書いて赤を見る**のは、その 1 回しか確かめない。
    // ここでは 4 枚それぞれの**いまの中身**を写して、手書きと同じ差分
    // （1 行足す・1 文字変える・指紋の行を外す）を当て、毎回すべてを見る。
    const dir = mkdtempSync(join(tmpdir(), "generated-doc-real-"));

    for (const rel of STAMPED) {
      const text = readFileSync(join(ROOT, rel), "utf8");
      const block = rel.endsWith("coverage.md")
        ? (text.match(
            /<!-- ここから下は scripts\/coverage-report\.mjs[\s\S]*?<!-- ここまで -->(?:\n<!-- 生成物の指紋[^\n]*-->)?/,
          )?.[0] ?? "")
        : text;
      const body = inspectStamped(block).body;
      const path = join(dir, `${rel.replaceAll("/", "_")}`);

      // 1. 末尾に 1 行足す（いちばん多い手書き）
      writeFileSync(path, `${stamp(body)}\n手で足したひとこと\n`, "utf8");
      expect(() => writeGeneratedDoc(path, body), `${rel}: 行の足しを見逃した`).toThrow(
        /手で書き換えられています/,
      );

      // 2. 中身の 1 文字を変える
      const flipped = body.replace(/[０-９0-9]/, (d) => (d === "0" ? "1" : "0"));
      if (flipped !== body) {
        writeFileSync(path, `${stamp(body).replace(body, flipped)}\n`, "utf8");
        expect(() => writeGeneratedDoc(path, body), `${rel}: 1 文字の書き換えを見逃した`).toThrow(
          /手で書き換えられています/,
        );
      }

      // 3. 指紋の行ごと外して書き換える
      writeFileSync(path, `${body}\n手で足したひとこと\n`, "utf8");
      expect(() => writeGeneratedDoc(path, body), `${rel}: 指紋外しを見逃した`).toThrow(
        /指紋の行が外された/,
      );
    }
  });

  it("除外の条件がまだ成り立っている（verify が llm-live-proof を呼んでいない）", async () => {
    // **条件を文章で書くだけにしない。**「いま真であること」と「将来も真であること」は
    // 別で、`verify` の並びに入った日にこの除外は**静かに間違いになる**。
    // 静かに間違う記述は、間違ったようには見えない。だから条件のほうを検査にする。
    const { CHECKS } = (await import("../../quality-gates.config.mjs")) as {
      CHECKS: readonly { readonly command: readonly string[] }[];
    };
    const commands = CHECKS.flatMap((g) => g.command);
    // **空の一覧を見ても緑になる。** 名前が変わって読めなくなった日に、
    // この検査は「呼んでいない」と答え続ける。見えていることを先に確かめる。
    expect(commands, "verify の一覧が読めていません（CHECKS の名前が変わった？）").toContain(
      "scripts/port-wiring.mjs",
    );
    const called = commands.filter((a) => a.includes("llm-live-proof"));
    expect(
      called,
      [
        "`pnpm run verify` が llm-live-proof.mjs を呼ぶようになりました。",
        "WRITE_EXCEPTIONS の理由（verify が触らないので黙って消えるは起きない）は、もう成り立ちません。",
        "先に指紋の置き方（別ファイルか JSON の一項目か）を決めてから、この除外を外してください。",
      ].join("\n"),
    ).toEqual([]);
  });

  it("正本を先に直してから同じ内容を手で書いても、台帳は通らない", () => {
    // **これが A の 4 枚に開いていた穴そのものである。**
    // 内容の比較だけだと、正本を先に直してから同じ内容を手で書けば一致して通る。
    // つまり「古くないこと」しか見ておらず、「手で書かれていないこと」は見ていない。
    // 順番次第で捕まったり捕まらなかったりする検査は、次に同じことをする人を捕まえない。
    const dir = mkdtempSync(join(tmpdir(), "generated-doc-"));
    const path = join(dir, "ledger.md");
    const 直したあとの中身 = "件数: 2";

    // 手で書いた（指紋は付けない）。中身は「あるべき中身」と一致している。
    writeFileSync(path, `${直したあとの中身}\n`, "utf8");
    expect(() => expectLedgerFile(path, 直したあとの中身, false, "古い")).toThrow(
      /手で書き換えられています/,
    );

    // 機械が書き直せば通る。
    expectLedgerFile(path, 直したあとの中身, true, "古い");
  });

  it("指紋を取り直して書けば通ってしまう（塞げていないことを、そう書いて固定する）", () => {
    const dir = mkdtempSync(join(tmpdir(), "generated-doc-"));
    const path = join(dir, "report.md");

    // **これは仕様ではなく、塞げていない穴である。**
    // 中身から作る指紋は、中身と一緒に手で作り直せる。塞ぐには中身から独立した
    // 鍵が要り、鍵は AI が読める場所に置けないので、ここでは塞げない。
    // 塞いだつもりで残すのがいちばん悪いので、通ることを検査として書いておく。
    // 直せたときは、この検査が赤くなって知らせる。
    writeFileSync(path, `${stamp("一行目\n手で書き換えた行")}\n`, "utf8");
    expect(() => writeGeneratedDoc(path, "一行目\n手で書き換えた行")).not.toThrow();
  });

  it("指紋は中身だけから決まる（末尾の空白では変わらない）", () => {
    // 改行の付き方で指紋が変わると、中身が同じでも赤くなる。
    // 「どうせ毎回赤い」と扱われた検査は、やがて誰も見なくなる。
    expect(digestOf("本文")).toBe(digestOf("本文\n\n"));
  });

  it("docs へ書くスクリプトとテストが、全部この道具を通っている", () => {
    // **スクリプトだけを見ない。** A の 4 枚を書いているのはテストのほうで、
    // そこを見ないと「5 枚目の台帳をテストから直接書く」が素通りする。
    // 見る範囲が生成物の置き場所より狭いと、その差が次の穴になる。
    const files = [
      ...readdirSync(join(ROOT, "scripts"))
        .filter((n) => n.endsWith(".mjs"))
        .map((n) => ({ label: `scripts/${n}`, path: join(ROOT, "scripts", n) })),
      ...listTestFiles(join(ROOT, "tests")),
    ];
    // **数える対象そのものの床。**「違反 0 件」は、違反が無いときと
    // 走査先が空になったときの両方で出る。2 つの入口を別々に張るのは、
    // 片方が消えたときにもう片方の数で埋め合わせられないようにするため。下げない。
    const scriptCount = files.filter((f) => f.label.startsWith("scripts/")).length;
    expect(scriptCount, "scripts/*.mjs が見つかりません").toBeGreaterThanOrEqual(15);
    expect(files.length - scriptCount, "tests 配下が見つかりません").toBeGreaterThanOrEqual(200);

    const offenders: string[] = [];

    for (const { label, path } of files) {
      const name = label.slice(label.lastIndexOf("/") + 1);
      const src = readFileSync(path, "utf8");

      // `const NAME = ... "docs/..."` を集める。書き込み先が識別子で渡されるため、
      // 呼び出しの括弧の中だけを見ても行き先が分からない。
      const docConsts = [
        ...src.matchAll(/const\s+(\w+)\s*=\s*[^\n]*["'`]docs\/[^"'`]+["'`]/g),
      ].map((m) => m[1]);
      // **引数の 1 つ目だけを見ない。** `writeFileSync(join(root, OUT), …)` の形だと
      // 1 つ目は `join(root` で切れ、行き先を見失う。見失った検査は緑になる。
      // それは「守っている」ではなく「見ていない」なので、行ごと見る。
      const writesToDocs = src
        .split("\n")
        .filter((line) => line.includes("writeFileSync("))
        .some(
          (line) =>
            line.includes("docs/") || docConsts.some((c) => new RegExp(`\\b${c}\\b`).test(line)),
        );

      if (!writesToDocs) continue;
      if (WRITE_EXCEPTIONS[name] !== undefined) continue;
      // 道具そのものは `writeFileSync` を持っていて当然なので、ここでは数えない。
      if (label.endsWith("scripts/lib/generated-doc.mjs")) continue;
      // **「道具を取り込んでいれば許す」にしない。** 取り込んだうえで
      // 別の行から直接書けば通ってしまい、印があることを性質の理由にすることになる。
      // 見るのは取り込みの有無ではなく、`writeFileSync` で docs を書いているかどうか。
      offenders.push(label);
    }

    expect(
      offenders,
      [
        "docs/ の生成物を `writeFileSync` で直接書いている場所があります:",
        ...offenders.map((n) => `  ${n}`),
        "",
        "`scripts/lib/generated-doc.mjs` の `writeGeneratedDoc` / `writeGeneratedBlock`",
        "（テストからは `tests/support/ledger-file.ts` の `expectLedgerFile`）を通してください。",
        "直接書くと、手で書かれた行が pnpm run verify で黙って消えます（緑のまま）。",
        "通せない事情があるなら WRITE_EXCEPTIONS に**理由つきで**登録してください。",
      ].join("\n"),
    ).toEqual([]);
  });

  /*
   * --- 「手で 1 度書いて赤を見る」を、なぜ置いていないか ---
   *
   * 当初はそれを受入条件にしていた。置き換えたのは 2 つの理由による。
   *
   * 1. **1 回の手作業は、次に同じことをする人を捕まえない。**
   *    見たその場では赤いが、明日 5 枚目の生成物が増えたときには何も起きない。
   * 2. この作業場所の見張り（dev-graph の `guard-graph-schema.py`）が
   *    `docs/` への手書きを止める。**迂回していない。**
   *
   * 代わりに置いたのが「実際の 4 枚に、手書きと同じ差分を当てると捕まる」で、
   * 4 枚ぜんぶへ 3 通りの手書きを毎回当てる。**弱めたのではなく、
   * 1 回きりの実測を、毎回走る形へ替えた。**
   */
});
