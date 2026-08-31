/**
 * @tier 1
 * @req REQ-UX06
 * @types code-boundary
 *
 * 部品契約の行と、`src/` の実装を**物理的に**突き合わせる。
 *
 * --- なぜ要るのか ---
 *
 * `docs/spec/feat-blog-ops-crud/component-contract.md` は最初から
 * `ファイル`（export path）列を持っていた。ところが後発の
 * `docs/spec/feat-reference-blog-admin-ux/component-contract.md` はその列を捨て、
 * desktop / mobile / states に置き換えた。結果、契約の 1 行がどのファイルの
 * どの export を指すのかを示すものが無くなり、
 *
 *   - 契約に在るが実装が無い（`AffiliateLedger` / `PlacementList` は
 *     `src/app/admin/affiliate/links/page.tsx` に**無名インライン JSX**として
 *     書かれていた。動いてはいたが、契約の名前を誰も名乗っていなかった）
 *   - 契約の名前が実装とずれている（`BlogArticleForm` は一度も実在せず、
 *     実体は `BlogArticleCreateForm` / `EditForm` / `RestoreForm`。
 *     `BlogLayoutForm` も同様で実体は `Slot` / `Band` の 2 つ）
 *
 * が両方とも誰にも気付かれずに残った。`scripts/` にも `.github/` にも
 * `component-contract` を読むコードは 1 行も無く、この契約は一度も
 * 機械検査されたことがなかった。
 *
 * この検査が見るのは 2 点だけである。
 *   1. `ファイル` 列のパスが実在すること
 *   2. `部品` 列の識別子が、そのパスから実際に export されていること
 *
 * 見た目・props・振る舞いは見ない。それらは UI のテストの仕事で、
 * ここが受け持つのは「契約の行が実装のどこを指しているか」の一点。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SPEC_ROOT = join(ROOT, "docs/spec");

/**
 * `ファイル` 列を持たなくてよい契約。**理由を書いた行だけがここに入る。**
 *
 * 列を落とすことがそもそもの後退なので、既定は「持つ」。新しい契約を
 * 足して列を落とすと、下の「全契約が ファイル 列を持つ」で赤くなる。
 */
const WITHOUT_FILE_COLUMN: Readonly<Record<string, string>> = {
  // 未実装の部品の責務だけを先に固定する設計文書。実装は P08 が持つので、
  // いま export path を書くと存在しないパスを書くことになる。
  "feat-uiux-overhaul/component-contract.md":
    "新設予定の部品の責務定義のみ。実装の割り当ては P08 が持つ",
};

type ContractRow = {
  readonly file: string;
  readonly line: number;
  readonly identifiers: readonly string[];
  readonly paths: readonly string[];
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const contractFiles = walk(SPEC_ROOT).filter((f) => f.endsWith("component-contract.md"));

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparator(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function backticked(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

/** 契約表のうち、`部品` 列と `ファイル` 列の両方を持つ表の本文行だけを取り出す。 */
function contractRows(file: string): ContractRow[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const rows: ContractRow[] = [];
  let nameIndex = -1;
  let pathIndex = -1;

  for (const [index, line] of lines.entries()) {
    if (!line.trim().startsWith("|")) {
      nameIndex = -1;
      pathIndex = -1;
      continue;
    }
    if (isSeparator(line)) continue;
    const columns = cells(line);
    const header = columns.findIndex((c) => c === "部品" || c === "component");
    const filePath = columns.findIndex((c) => c === "ファイル");
    if (header >= 0 && filePath >= 0) {
      nameIndex = header;
      pathIndex = filePath;
      continue;
    }
    if (nameIndex < 0 || pathIndex < 0) continue;

    const nameCell = columns[nameIndex] ?? "";
    const pathCell = columns[pathIndex] ?? "";
    rows.push({
      file: relative(ROOT, file),
      line: index + 1,
      identifiers: backticked(nameCell).filter((token) => /^[A-Z][A-Za-z0-9]*$/.test(token)),
      paths: backticked(pathCell).filter((token) => /^src\/.+\.tsx?$/.test(token)),
    });
  }
  return rows;
}

function exportsIdentifier(source: string, name: string): boolean {
  return new RegExp(
    `export\\s+(?:default\\s+)?(?:async\\s+)?(?:function|const|let|class|type|interface)\\s+${name}\\b`,
  ).test(source);
}

const rows = contractFiles.flatMap(contractRows);

describe("部品契約の識別子が実在する", () => {
  /**
   * 母集団の床。`tests/ui/ui-layers.test.ts:145` と同じ理由で要る——
   * **対象が 0 件なら「違反 0 件」は常に成り立つ。** 走査が壊れて
   * 表を 1 行も拾えなくなったとき、以下の検査は黙って全部緑になる。
   */
  it("契約と行を実際に読めている", () => {
    expect(contractFiles.length, "component-contract.md を読めていません").toBeGreaterThan(2);
    expect(rows.length, "契約表の行を読めていません").toBeGreaterThan(10);
    expect(
      rows.filter((row) => row.identifiers.length > 0).length,
      "部品名を 1 つも取り出せていません",
    ).toBeGreaterThan(10);
  });

  it("すべての契約行が部品名と export path を持つ", () => {
    const offenders = rows
      .filter((row) => row.identifiers.length === 0 || row.paths.length === 0)
      .map((row) => `${row.file}:${row.line} に部品名か ファイル 列のパスがありません`);
    expect(
      offenders,
      "名前とパスの両方が無いと、契約の行が実装のどこを指すのか誰にも分かりません。",
    ).toEqual([]);
  });

  /**
   * 「これから作る」を書ける逃げ道は用意しない。
   *
   * 予定の印を許すと、契約が実装より先に進んだ状態が常態になり、
   * 表を読んだ人が実装の在処を当てにできなくなる——それが直そうとしている
   * 後退そのものである。行き先を先に決めたいときは、行き先へ実体を置いてから
   * 契約を書き換える順にする。
   */
  it("ファイル列のパスが実在する", () => {
    const offenders = rows.flatMap((row) =>
      row.paths
        .filter((path) => !existsSync(join(ROOT, path)))
        .map((path) => `${row.file}:${row.line} のパスが実在しません: ${path}`),
    );
    expect(offenders, "契約が実在しないファイルを指しています。").toEqual([]);
  });

  it("部品名がそのファイルから export されている", () => {
    const offenders: string[] = [];
    let checked = 0;
    for (const row of rows) {
      const sources = row.paths
        .filter((path) => existsSync(join(ROOT, path)))
        .map((path) => readFileSync(join(ROOT, path), "utf8"));
      if (sources.length === 0) continue; // パスの不在は上の検査が受け持つ
      for (const name of row.identifiers) {
        checked += 1;
        if (!sources.some((source) => exportsIdentifier(source, name))) {
          offenders.push(
            `${row.file}:${row.line} の \`${name}\` は ${row.paths.join(" / ")} から export されていません`,
          );
        }
      }
    }
    // 母集団の床。**1 つも突き合わせていなければ「違反 0 件」は常に成り立つ。**
    // 表の切り出しか、パスの実在判定が壊れると、ここが先に落ちる。
    expect(checked, "契約の識別子を 1 つも突き合わせていません").toBeGreaterThan(10);
    expect(
      offenders,
      "契約の名前で名乗っていない実装は、契約の行と突き合わせられません。無名のインライン JSX のままにせず、契約どおりの名前で export してください。",
    ).toEqual([]);
  });

  it("契約から ファイル 列を落としていない", () => {
    const offenders: string[] = [];
    // 母集団の床。契約を 1 つも見つけられていなければ、この検査は何も言っていない。
    expect(contractFiles.length, "component-contract.md を読めていません").toBeGreaterThan(2);
    for (const file of contractFiles) {
      const key = relative(SPEC_ROOT, file);
      const hasColumn = readFileSync(file, "utf8")
        .split("\n")
        .some((line) => line.trim().startsWith("|") && cells(line).includes("ファイル"));
      if (hasColumn) {
        if (key in WITHOUT_FILE_COLUMN) {
          offenders.push(`${key} は除外一覧に残っていますが ファイル 列を持っています。外してください`);
        }
        continue;
      }
      if (key in WITHOUT_FILE_COLUMN) continue;
      offenders.push(`${key} に ファイル 列がありません`);
    }
    expect(
      offenders,
      "ファイル 列を落とすと、契約と実装を突き合わせる手がかりが消えます。除外するなら理由を WITHOUT_FILE_COLUMN に書いてください。",
    ).toEqual([]);
  });
});
