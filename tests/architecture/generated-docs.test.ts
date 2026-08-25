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
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  digestOf,
  hasStampLine,
  inspectStamped,
  stamp,
  writeGeneratedBlock,
  writeGeneratedDoc,
} from "../../scripts/lib/generated-doc.mjs";
import { expectLedgerFile } from "../support/ledger-file";

const ROOT = process.cwd();

/**
 * `coverage.md` の囲みを丸ごと拾う式。**`scripts/coverage-report.mjs` と同じもの。**
 *
 * 3 か所へ書き写していたのを 1 つにした。写しが増えると、片方だけ直した日に
 * 「拾えなくなった」が空文字として返り、`inspectStamped("")` は UNPINNED を返す。
 * つまり**式が壊れたことが、指紋が無いことに化ける**。
 */
const COVERAGE_MARKER =
  /<!-- ここから下は scripts\/coverage-report\.mjs[\s\S]*?<!-- ここまで -->(?:\n<!-- 生成物の指紋[^\n]*-->)?/;

/** 生成物の中身（指紋を除いた本体）を取り出す。囲みだけの文書はその囲みから。 */
function bodyOf(rel: string): string {
  const text = readFileSync(join(ROOT, rel), "utf8");
  const block = rel.endsWith("coverage.md") ? (text.match(COVERAGE_MARKER)?.[0] ?? "") : text;
  // **空を静かに通さない。** 式が当たらなくなった日、ここは UNPINNED の空本体を返し、
  // 下の検査は「手書きが無い」と答え続ける。見えていないことは、守れている顔をする。
  expect(block, `${rel} の生成物本体が取り出せていません（囲みの式が古い？）`).not.toBe("");
  return inspectStamped(block).body;
}

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

  // 書き出し先 `docs/product/preview/` は `.gitignore` に入っていて git が追わない。
  // 焼くのは `pnpm run preview:static` を人が打ったときだけで、`pnpm run verify` は
  // これを呼ばない。つまり「verify を打った瞬間に黙って消える」は起きない。
  //
  // **この 2 つは条件であって、性質ではない。**追跡され始めた日か、
  // verify の並びに入った日に、この除外は静かに間違いになる。
  // だから下の「除外の条件がまだ成り立っている」で両方とも検査にしてある。
  "write-static-preview.tsx":
    "書き出す HTML は `.gitignore` 済みで git が追わず、`pnpm run verify` も焼かない。" +
    "**この除外は、その 2 つが両方とも真であるあいだだけ成り立つ。**" +
    "追跡する日か verify に入れる日には、先に writeGeneratedDoc を通すこと（HTML なので指紋の置き場所はある）。",
};

/**
 * `docs/` の下の `.md` を全部たどる（返すのは `root` からの相対）。
 *
 * **`docs/product/` だけを見ない。** 生成物の置き場所は `docs/product/` に
 * 縛られていないので、そこだけを回すと**別の場所へ置かれた 1 枚**を見失う。
 * 見失った検査は緑になり、それは「載っている」と同じ顔をする。
 */
function listDocFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const dir = entry.parentPath.slice(root.length).replace(/^[/\\]/, "");
    out.push(dir === "" ? entry.name : `${dir}/${entry.name}`);
  }
  return out.sort();
}

/**
 * 指紋を焼いてある文書の一覧を、**構造から**作る。
 *
 * 判定そのものは生成側の道具（`hasStampLine`）が持っている。
 * 検査の側で語を書き写すと、道具と検査で別々の「生成物の定義」を持つことになり、
 * 片方だけ変わった日に差が静かに開く。
 */
function stampedDocsUnder(root: string): string[] {
  return listDocFiles(root).filter((rel) => hasStampLine(readFileSync(join(root, rel), "utf8")));
}

/**
 * 書き込みうるファイルを全部たどる。浅く見ると、深いところの書き込みを見失う。
 *
 * **`scripts/` を「直下の `.mjs` だけ」で見ない。** そう見ていたころ、
 * `scripts/lib/` の下と `.tsx` の書き手は最初から視界に入っていなかった。
 * 検査の名前は「docs へ書くスクリプトとテストが、全部この道具を通っている」で、
 * 読む人はそれを**全部**と受け取る。実際に見ていたのは 17 本のうちの 17 本で、
 * 残る 9 本（`lib/` と `.tsx`）は数えられてすらいなかった。
 * **見ていないものは違反 0 件として出る。**それは守れている顔をする。
 *
 * 拡張子を `tests/` と揃えるのも同じ理由で、片方だけ広いと差がそのまま穴になる。
 */
function listSourceFiles(dir: string): { label: string; path: string }[] {
  const out: { label: string; path: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(path));
    else if (/\.(mjs|cjs|ts|tsx)$/.test(entry.name)) {
      out.push({ label: path.slice(ROOT.length + 1), path });
    }
  }
  return out;
}

describe("生成物であることの保証", () => {
  it("指紋が焼かれている文書は、いまの中身と一致している", () => {
    for (const rel of STAMPED) {
      const text = readFileSync(join(ROOT, rel), "utf8");
      const block = rel.endsWith("coverage.md") ? (text.match(COVERAGE_MARKER)?.[0] ?? "") : text;
      expect(block, `${rel} の生成物本体が取り出せていません（囲みの式が古い？）`).not.toBe("");
      expect(inspectStamped(block).state, `${rel} の指紋が中身と合っていません`).toBe("INTACT");
    }
  });

  it("指紋を焼いている文書が、増えても減っても気づける", () => {
    // **数える対象そのものの床。** 走査先が空になっても「増減なし」は緑で出る。
    // 一覧が合っていることより先に、見えていることを確かめる。
    const docs = listDocFiles(join(ROOT, "docs"));
    expect(docs.length, "docs 配下の .md が見つかりません").toBeGreaterThanOrEqual(40);
    expect(
      docs.filter((rel) => !rel.startsWith("product/")).length,
      "docs/product の外が見えていません（走査が浅い？）",
    ).toBeGreaterThanOrEqual(10);

    const stamped = stampedDocsUnder(join(ROOT, "docs")).map((rel) => `docs/${rel}`);
    expect(
      stamped,
      [
        "指紋を焼いている文書と STAMPED の一覧が食い違っています。",
        "増えた側なら、その 1 枚を STAMPED へ足してください（勝手に外さない）。",
        "減った側なら、焼くのをやめた理由をここに書いてから外してください。",
      ].join("\n"),
    ).toEqual([...STAMPED].sort());
  });

  it("説明文に語を書いた文書は生成物に数えず、語を書かない生成物は数える", () => {
    // **この検査が塞いでいるのは見落としの側である。**
    // 「`生成物の指紋` という語を含むか」で数えていたころは、
    //   - その語を書かない生成物（別の場所へ置かれた 1 枚）が一覧から静かに漏れ、
    //   - 生成物について説明しただけの文書が巻き込まれて赤くなった。
    // 誤検出は打った本人がその場で気づくが、**見落としは誰も気づかない。**
    const root = mkdtempSync(join(tmpdir(), "generated-docs-scan-"));
    mkdirSync(join(root, "reports"), { recursive: true });

    // 1. 生成物。指紋は焼いてあるが、説明文にはその語を一切書いていない。
    //    しかも `docs/product/` ではない場所に置いてある。
    writeGeneratedDoc(join(root, "reports", "nine.md"), "# 9 枚目\n\nこれは機械が作った。");

    // 2. 生成物ではない。散文でその語を説明し、囲みの中に本物と同じ形の行まで引いている。
    writeFileSync(
      join(root, "explainer.md"),
      [
        "# 指紋の焼き方",
        "",
        "生成物の指紋 は、中身から作って末尾に焼く。行はこの形になる:",
        "",
        "```",
        `<!-- 生成物の指紋 sha256:${digestOf("例")} -->`,
        "```",
        "",
      ].join("\n"),
      "utf8",
    );

    // **数えた母集団そのものの床。** 下の「`product/` に該当は 0 件」は、
    // 見落としが無いときと**走査が何も拾わなかったとき**の両方で 0 になる。
    // ここで置いた 2 枚は、片方が下の階層（`reports/`）にあるので、
    // **再帰が止まった日にこの床が 1 件で落ちる**——それがこの検査の壊れ方そのものである。
    const 走査できたもの = listDocFiles(root);
    expect(走査できたもの.length, "置いた 2 枚を走査が拾えていません（再帰が止まった？）").toBeGreaterThanOrEqual(
      2,
    );

    // **古いやり方の答えを、そう書いて固定しておく。** 語で数えると、
    // 説明しただけの `explainer.md` を生成物と読む（誤検出）。
    // 加えて走査を `product/` に限れば `reports/nine.md` は最初から視界に入らない（見落とし）。
    const 語で数えた = 走査できたもの.filter((rel) =>
      readFileSync(join(root, rel), "utf8").includes("生成物の指紋"),
    );
    expect(語で数えた).toContain("explainer.md");
    expect(語で数えた.filter((rel) => rel.startsWith("product/"))).toEqual([]);

    // 構造で数えれば、生成物だけが 1 枚残る。
    expect(stampedDocsUnder(root)).toEqual(["reports/nine.md"]);
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

  /*
   * --- 囲みの経路（`coverage.md`）を、なぜ別に張るのか ---
   *
   * 8 枚のうち `coverage.md` だけは、ファイル全体ではなく**囲みの中身だけ**が生成物で、
   * 通る道具も `writeGeneratedBlock` のほうである。ところがこの下の
   * 「実際の 4 枚に…」は、`coverage.md` の中身も `writeGeneratedDoc` に当てていた。
   * **測っていたのは 8 枚ぶんの中身であって、8 本ぶんの道ではなかった。**
   *
   * 実測（2026-08-21）: `writeGeneratedBlock` の突き合わせを丸ごと外しても、
   * この検査群は 1 件も赤くならなかった。**外して緑になるなら、それは検査ではない。**
   * だから囲みの経路そのものに、下の 3 本を当てる。
   */
  it("囲みの中を手で書き換えると、上書きせずに止まる", () => {
    const dir = mkdtempSync(join(tmpdir(), "generated-block-"));
    const path = join(dir, "coverage.md");
    const block = "<!-- ここから下は scripts/coverage-report.mjs -->\n行 91.3\n<!-- ここまで -->";
    const marker = /<!-- ここから下は scripts\/coverage-report\.mjs[\s\S]*?<!-- ここまで -->(?:\n<!-- 生成物の指紋[^\n]*-->)?/;

    writeFileSync(path, "# 覆い方\n\n人が書いた前書き。\n\n", "utf8");
    writeGeneratedBlock(path, marker, block);

    // 囲みの中へ手で 1 行足す。**内容が正しいかどうかは関係ない。**
    writeFileSync(path, readFileSync(path, "utf8").replace("行 91.3", "行 91.3\n手で足した行"), "utf8");
    expect(() => writeGeneratedBlock(path, marker, block)).toThrow(/手で書き換えられています/);
    // ここが要点。投げるだけでなく、**書かずに**投げる。手で書いた行は残っている。
    expect(readFileSync(path, "utf8")).toContain("手で足した行");
    expect(readFileSync(path, "utf8")).toContain("人が書いた前書き");
  });

  it("囲みの外は人が書く場所なので、直しても止まらない", () => {
    // 外まで見張ると、本文を直すたびに赤くなる。
    // 「どうせ毎回赤い」と扱われた検査は、やがて誰も見なくなる。
    // **見なくなった検査は、外した検査と同じ**なので、ここは通さないといけない。
    const dir = mkdtempSync(join(tmpdir(), "generated-block-"));
    const path = join(dir, "coverage.md");
    const block = "<!-- ここから下は scripts/coverage-report.mjs -->\n行 91.3\n<!-- ここまで -->";
    const marker = /<!-- ここから下は scripts\/coverage-report\.mjs[\s\S]*?<!-- ここまで -->(?:\n<!-- 生成物の指紋[^\n]*-->)?/;

    writeFileSync(path, "# 覆い方\n\n前書き。\n\n", "utf8");
    writeGeneratedBlock(path, marker, block);
    writeFileSync(path, readFileSync(path, "utf8").replace("前書き。", "前書きを書き直した。"), "utf8");

    expect(() => writeGeneratedBlock(path, marker, block)).not.toThrow();
    expect(readFileSync(path, "utf8")).toContain("前書きを書き直した");
  });

  it("実際の coverage.md の囲みに、手書きと同じ差分を当てると捕まる", () => {
    // 中身は実物を写す。作り話の囲みだけで測ると、実物の形（表・注記・空行）で
    // 式が当たらなくなった日に、この検査は当たらないまま緑で出る。
    // 行き先の見張り（下の「道具を通っている」）は、`const X = "docs/…"` を
    // 書き込み先の名前とみなす。**中身をその名前に入れると、読んだだけで
    // 「docs へ書いている」に見える。**見張りの読み方に合わせて、
    // 名前が指すものを実際どおり（こちらは経路、あちらは中身）に分けておく。
    const COVERAGE_DOC = "docs/product/coverage.md";
    const body = bodyOf(COVERAGE_DOC);
    const dir = mkdtempSync(join(tmpdir(), "generated-block-real-"));
    const path = join(dir, "coverage.md");
    const 前書き = "# カバレッジ\n\n人が書く節。\n\n";

    // 1. 囲みの中の末尾に 1 行足す
    writeFileSync(path, `${前書き}${stamp(body)}\n`, "utf8");
    writeFileSync(path, readFileSync(path, "utf8").replace("<!-- ここまで -->", "手で足したひとこと\n<!-- ここまで -->"), "utf8");
    expect(() => writeGeneratedBlock(path, COVERAGE_MARKER, body), "行の足しを見逃した").toThrow(
      /手で書き換えられています/,
    );

    // 2. 中身の 1 文字を変える
    const flipped = body.replace(/[0-9]/, (d) => (d === "0" ? "1" : "0"));
    expect(flipped, "数字が 1 つも無いので 1 文字の書き換えを試せていません").not.toBe(body);
    writeFileSync(path, `${前書き}${stamp(body).replace(body, flipped)}\n`, "utf8");
    expect(() => writeGeneratedBlock(path, COVERAGE_MARKER, body), "1 文字の書き換えを見逃した").toThrow(
      /手で書き換えられています/,
    );

    // 3. 指紋の行ごと外して書き換える
    writeFileSync(path, `${前書き}${flipped}\n`, "utf8");
    expect(() => writeGeneratedBlock(path, COVERAGE_MARKER, body), "指紋外しを見逃した").toThrow(
      /指紋の行が外された/,
    );
  });

  it("実際の 4 枚に、手書きと同じ差分を当てると捕まる", () => {
    // **手で 1 度書いて赤を見る**のは、その 1 回しか確かめない。
    // ここでは 4 枚それぞれの**いまの中身**を写して、手書きと同じ差分
    // （1 行足す・1 文字変える・指紋の行を外す）を当て、毎回すべてを見る。
    const dir = mkdtempSync(join(tmpdir(), "generated-doc-real-"));

    for (const rel of STAMPED) {
      const body = bodyOf(rel);
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

  it("除外の条件がまだ成り立っている（静的プレビューが git にも verify にも入っていない）", async () => {
    // 除外の理由は「追跡されていない」と「verify が焼かない」の 2 つ。
    // **両方とも、いつでも真でなくなりうる。**片方が崩れた日に、
    // 手で書いた行は黙って消えるほうへ戻る。条件のほうを検査にしておく。
    const ignored = readFileSync(join(ROOT, ".gitignore"), "utf8");
    expect(
      ignored.split("\n").some((l) => l.trim() === "docs/product/preview/"),
      [
        "docs/product/preview/ が .gitignore から外れました。",
        "追跡されるなら、手で書いた行は差分に乗り、次の preview:static で黙って消えます。",
        "WRITE_EXCEPTIONS の write-static-preview.tsx を外し、writeGeneratedDoc を通してください。",
      ].join("\n"),
    ).toBe(true);

    const { CHECKS } = (await import("../../quality-gates.config.mjs")) as {
      CHECKS: readonly { readonly command: readonly string[] }[];
    };
    const commands = CHECKS.flatMap((g) => g.command);
    // **数えた母集団そのものの床。** 下の「該当は 0 件」は、呼んでいないときと
    // **一覧が読めなくなったとき**の両方で 0 になる。名前で 1 本引くだけでは、
    // その 1 本が残ったまま並びが痩せた日に気づけないので、件数も見る。
    // 実測（2026-08-21）: 門 14 群・引数 35 個。門は増える向きにしか動かない。
    expect(CHECKS.length, "verify の門が読めていません").toBeGreaterThanOrEqual(12);
    expect(commands.length, "verify の並びが痩せています（一覧が読めていない？）").toBeGreaterThanOrEqual(
      30,
    );
    // 中身が読めていることも見る（件数だけだと、別物が 30 個並んでも通る）。
    expect(commands, "verify の一覧が読めていません（CHECKS の名前が変わった？）").toContain(
      "scripts/port-wiring.mjs",
    );
    expect(
      commands.filter((a) => a.includes("write-static-preview") || a.includes("preview:static")),
      "pnpm run verify が静的プレビューを焼くようになりました。除外の理由はもう成り立ちません。",
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
      ...listSourceFiles(join(ROOT, "scripts")),
      ...listSourceFiles(join(ROOT, "tests")),
    ];
    // **数える対象そのものの床。**「違反 0 件」は、違反が無いときと
    // 走査先が空になったときの両方で出る。2 つの入口を別々に張るのは、
    // 片方が消えたときにもう片方の数で埋め合わせられないようにするため。下げない。
    const scriptFiles = files.filter((f) => f.label.startsWith("scripts/"));
    expect(scriptFiles.length, "scripts 配下が見つかりません").toBeGreaterThanOrEqual(24);
    // **直下だけを数えても床は埋まる。** 深いところと `.tsx` を見失った日に、
    // 直下 17 本で 24 に届いてしまうと、この床は「見えている」と答え続ける。
    // だから「浅く見たら足りない数」ではなく、**浅い側と深い側を別々に**張る。
    expect(
      scriptFiles.filter((f) => f.label.includes("/lib/")).length,
      "scripts/lib が見えていません（走査が浅い？）",
    ).toBeGreaterThanOrEqual(5);
    expect(
      scriptFiles.filter((f) => f.label.endsWith(".tsx")).length,
      "scripts の .tsx が見えていません（拡張子の絞り込みが狭い？）",
    ).toBeGreaterThanOrEqual(2);
    expect(files.length - scriptFiles.length, "tests 配下が見つかりません").toBeGreaterThanOrEqual(
      200,
    );

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
