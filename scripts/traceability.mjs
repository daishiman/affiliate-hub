/**
 * テストと要件の対応を、**テスト側から**引けるようにする。
 *
 * `docs/product/traceability.md` は要件 → テストの向きしか持っていない。
 * その向きだけだと、次の 2 つが分からない。
 *
 *   1. 目の前のテストファイルは、**どの要件のために存在するのか**
 *   2. どの要件にも紐づいていないテストが、いくつあるのか
 *
 * 2 が効く。要件から書いたのではなく**実装を見てから書いたテスト**は、
 * 由来にする要件が無い。それは「実装がそうなっているから、そう書いた」
 * という循環で、実装が間違っていても緑になる。
 * ここで数えるのは、その循環の量である。
 *
 * 印は `@req REQ-P04, REQ-B03` の 1 行。`@tier` と同じくヘッダにだけ書く。
 *
 * ```
 * node scripts/traceability.mjs          判定して docs/product/test-traceability.md を更新
 * node scripts/traceability.mjs --check  更新せず判定だけ
 * ```
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §12-2 / 要件表: docs/product/traceability.md
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { TRACEABILITY_MAX_UNLINKED } from "../quality-gates.config.mjs";

const TABLE = "docs/product/traceability.md";
const OUT = "docs/product/test-traceability.md";

/** 印の書き方。`// @req REQ-P01` でも `* @req REQ-P01, REQ-B03` でも拾う。 */
const MARKER = /@req\s+([A-Z0-9\-,\s]+)/g;
const REQ_ID = /REQ-[A-Z]+\d+/g;

/** 印を書く場所。ヘッダに限る（本文の途中に隠さない）。 */
const HEADER_LINES = 40;

/**
 * `tests/` 以下のテストファイルを全部集める。
 *
 * @param {string} dir
 * @returns {string[]}
 */
function collect(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) out.push(full);
  }
  return out.sort();
}

/**
 * 1 ファイルのヘッダから要件 ID を読む。ファイルを読まないので単体で試せる。
 *
 * @param {string} source ファイルの中身
 * @returns {string[]}
 */
export function readReqs(source) {
  const header = source.split("\n").slice(0, HEADER_LINES).join("\n");
  /** @type {Set<string>} */
  const ids = new Set();
  for (const m of header.matchAll(MARKER)) {
    for (const id of m[1].match(REQ_ID) ?? []) ids.add(id);
  }
  return [...ids].sort();
}

/**
 * 要件表から「REQ → テストファイル」を読む。
 *
 * 表は 1 行 1 要件で、行のどこかにテストのパスが書いてある。
 * 列の位置に頼らず行単位で拾うのは、列が増えても壊れないようにするため。
 *
 * @param {string} markdown
 * @returns {{ reqs: Set<string>, byReq: Map<string, string[]> }}
 */
export function readTable(markdown) {
  /** @type {Set<string>} */
  const reqs = new Set();
  /** @type {Map<string, string[]>} */
  const byReq = new Map();
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const ids = line.match(/^\|\s*(REQ-[A-Z]+\d+)/);
    if (!ids) continue;
    const req = ids[1];
    reqs.add(req);
    const files = [...new Set(line.match(/tests\/[\w\-/.]+\.tsx?/g) ?? [])].sort();
    byReq.set(req, files);
  }
  // 表の本文（説明文や実装列）で言及されるだけの ID も、誤記判定では実在扱いにする。
  for (const id of markdown.match(REQ_ID) ?? []) reqs.add(id);
  return { reqs, byReq };
}

const root = process.cwd();
const table = readTable(readFileSync(join(root, TABLE), "utf8"));

/** REQ → テスト を裏返す。 */
/** @type {Map<string, Set<string>>} */
const fromTable = new Map();
for (const [req, files] of table.byReq) {
  for (const f of files) {
    if (!fromTable.has(f)) fromTable.set(f, new Set());
    fromTable.get(f)?.add(req);
  }
}

const files = collect(join(root, "tests")).map((f) => relative(root, f).split("\\").join("/"));

/** @type {{ path: string, annotated: string[], fromTable: string[], unknown: string[] }[]} */
const rows = files.map((path) => {
  const annotated = readReqs(readFileSync(join(root, path), "utf8"));
  return {
    path,
    annotated,
    fromTable: [...(fromTable.get(path) ?? [])].sort(),
    unknown: annotated.filter((id) => !table.reqs.has(id)),
  };
});

/**
 * 表に書かれているのに実在しないテスト（表だけが緑に見える状態）。
 *
 * `files` との差ではなく**ディスク上の有無**で見る。
 * 表は `tests/support/a11y.ts` のような補助ファイルも根拠として挙げるので、
 * テストファイル一覧との差で判定すると、実在するものを実在しないと言ってしまう。
 */
const ghosts = [...fromTable.keys()].filter((f) => !existsSync(join(root, f))).sort();

const unlinked = rows.filter((r) => r.annotated.length === 0 && r.fromTable.length === 0);
const unknown = rows.filter((r) => r.unknown.length > 0);

// ── 報告書 ─────────────────────────────────────────────
const linked = rows.length - unlinked.length;
const body = [
  "# テストから要件を引く表（自動生成）",
  "",
  "`node scripts/traceability.mjs` が書き換える。**手で編集しない。**",
  "要件 → テストの向きは `docs/product/traceability.md` が正本で、ここはその裏返しに",
  "テスト側の `@req` 印を重ねたもの。",
  "",
  `- 最終更新: ${new Date().toISOString().slice(0, 10)}`,
  `- テストファイル: ${rows.length} 件`,
  `- 由来の要件が分かる: ${linked} 件`,
  `- **由来不明: ${unlinked.length} 件**（上限 ${TRACEABILITY_MAX_UNLINKED} 件）`,
  "",
  "由来不明とは「どの要件のために書いたのか、機械から辿れない」という意味で、",
  "テストが無駄という意味ではない。要件から書いたなら `@req` を 1 行足せば消える。",
  "",
  "## 由来不明のテスト",
  "",
  ...(unlinked.length === 0 ? ["なし。"] : unlinked.map((r) => `- \`${r.path}\``)),
  "",
  "## テスト → 要件",
  "",
  "| テスト | 要件 | 由来 |",
  "| --- | --- | --- |",
  ...rows
    .filter((r) => r.annotated.length > 0 || r.fromTable.length > 0)
    .map((r) => {
      const ids = [...new Set([...r.annotated, ...r.fromTable])].sort();
      const from =
        r.annotated.length > 0 && r.fromTable.length > 0
          ? "印と表"
          : r.annotated.length > 0
            ? "印"
            : "表";
      return `| \`${r.path}\` | ${ids.join(", ")} | ${from} |`;
    }),
  "",
].join("\n");

const check = process.argv.includes("--check");
if (!check) writeFileSync(join(root, OUT), body, "utf8");

// ── 判定 ───────────────────────────────────────────────
console.log("\nテストと要件の対応");
console.log(`  テストファイル  ${rows.length}`);
console.log(`  由来が分かる    ${linked}`);
console.log(`  由来不明        ${unlinked.length}（上限 ${TRACEABILITY_MAX_UNLINKED}）`);
if (!check) console.log(`\n${OUT} を更新しました。`);

let failed = false;

if (ghosts.length > 0) {
  console.error(`\nNG 要件表に、実在しないテストが ${ghosts.length} 件書かれています。`);
  for (const g of ghosts) console.error(`  ${g}`);
  console.error("表の上だけで PASS に見える状態です。パスを直すか、行を未着手に戻してください。");
  failed = true;
}

if (unknown.length > 0) {
  console.error(`\nNG 要件表に無い ID が ${unknown.length} ファイルに書かれています。`);
  for (const r of unknown) console.error(`  ${r.path}: ${r.unknown.join(", ")}`);
  console.error("打ち間違いか、要件表への追記漏れです。");
  failed = true;
}

if (unlinked.length > TRACEABILITY_MAX_UNLINKED) {
  console.error(
    `\nNG 由来不明のテストが増えました（${unlinked.length} > ${TRACEABILITY_MAX_UNLINKED}）。`,
  );
  for (const r of unlinked) console.error(`  ${r.path}`);
  console.error("そのテストが確かめている要件を `@req REQ-xxx` の 1 行でヘッダに書いてください。");
  console.error("**上限を上げて緑にすることを禁じます。**");
  failed = true;
}

if (failed) process.exit(1);
console.log("\nOK 由来不明は上限以内です。");
