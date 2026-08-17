/**
 * 要件ごとに「書かねばならないテスト種別」が書かれているかを見る。
 *
 * 種別を決めないと、テストは**書きやすいところから書かれる**。
 * 難しい種別（権限のできてはいけない側・禁止された遷移・障害注入）は
 * 最後まで残り、しかもそこが壊れたときの被害が最も大きい。
 *
 * この検査は「テストがあるか」ではなく「**無いことに気づけるか**」を作る。
 *
 *   宣言（要件の性質）  docs/product/required-test-types.md
 *   必須種別への展開    quality-gates.config.mjs REQUIRED_TEST_TYPES
 *   充足の証拠          テストの `@types` 印（`@req` で要件に結ばれているもの）
 *
 * ```
 * node scripts/required-test-types.mjs          判定して報告書を更新
 * node scripts/required-test-types.mjs --check  更新せず判定だけ
 * ```
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §14
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  REQUIRED_TEST_TYPES,
  TEST_TYPES,
  TEST_TYPES_MAX_EXCLUSIONS,
  TEST_TYPES_MAX_UNDECLARED,
} from "../quality-gates.config.mjs";

const REGISTRY = "docs/product/required-test-types.md";
const TABLE = "docs/product/traceability.md";
const OUT = "docs/product/required-test-types-report.md";

const REQ_ID = /REQ-[A-Z]+\d+/g;
const REQ_MARKER = /@req\s+([A-Z0-9\-,\s]+)/g;
const TYPES_MARKER = /@types\s+([a-z0-9\-,\s]+)/g;
const HEADER_LINES = 40;

/**
 * ミューテーションだけは印ではなく実測から導く。
 *
 * 変異を当てているのは `src/domain` と `src/application` の 2 層で、
 * これはファイル単位の印ではなく `docs/product/mutation.md` の実測に載っている。
 * 印で自己申告させると、印を書くだけで満たしたことになってしまう。
 */
const MUTATION_LAYERS = ["src/domain/", "src/application/"];

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
 * 1 ファイルのヘッダから、要件 ID と種別を読む。
 *
 * @param {string} source
 * @returns {{ reqs: string[], types: string[] }}
 */
export function readMarkers(source) {
  const header = source.split("\n").slice(0, HEADER_LINES).join("\n");
  /** @type {Set<string>} */
  const reqs = new Set();
  for (const m of header.matchAll(REQ_MARKER)) {
    for (const id of m[1].match(REQ_ID) ?? []) reqs.add(id);
  }
  /** @type {Set<string>} */
  const types = new Set();
  for (const m of header.matchAll(TYPES_MARKER)) {
    for (const t of m[1].split(",")) {
      const name = t.trim();
      if (name) types.add(name);
    }
  }
  return { reqs: [...reqs].sort(), types: [...types].sort() };
}

/**
 * 宣言表を読む。列の位置ではなく「先頭セルが要件 ID の行」で拾う。
 *
 * @param {string} markdown
 * @returns {{ req: string, traits: string[], exclusions: { type: string, reason: string }[] }[]}
 */
export function readRegistry(markdown) {
  /** @type {{ req: string, traits: string[], exclusions: { type: string, reason: string }[] }[]} */
  const rows = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 3) continue;
    const head = cells[0].match(/^REQ-[A-Z]+\d+$/);
    if (!head) continue;
    const traits = cells[1]
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    /** @type {{ type: string, reason: string }[]} */
    const exclusions = [];
    if (cells[2] !== "—" && cells[2] !== "") {
      for (const part of cells[2].split(";")) {
        const at = part.indexOf(":");
        exclusions.push({
          type: at < 0 ? part.trim() : part.slice(0, at).trim(),
          reason: at < 0 ? "" : part.slice(at + 1).trim(),
        });
      }
    }
    rows.push({ req: cells[0], traits, exclusions });
  }
  return rows;
}

/**
 * 要件表から「REQ → 行そのもの」を読む（実装列の層を見るため）。
 *
 * @param {string} markdown
 * @returns {Map<string, string>}
 */
export function readRequirementRows(markdown) {
  /** @type {Map<string, string>} */
  const rows = new Map();
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const m = line.match(/^\|\s*(REQ-[A-Z]+\d+)\s*\|/);
    if (!m) continue;
    rows.set(m[1], (rows.get(m[1]) ?? "") + line);
  }
  return rows;
}

const root = process.cwd();
const registry = readRegistry(readFileSync(join(root, REGISTRY), "utf8"));
const requirementRows = readRequirementRows(readFileSync(join(root, TABLE), "utf8"));

const files = collect(join(root, "tests")).map((f) => relative(root, f).split("\\").join("/"));

/** REQ → その要件に結ばれたテストが名乗る種別。 */
/** @type {Map<string, Map<string, string[]>>} */
const covered = new Map();
/** @type {{ path: string, unknown: string[] }[]} */
const unknownTypes = [];
/** @type {string[]} */
const typedButUnlinked = [];

for (const path of files) {
  const { reqs, types } = readMarkers(readFileSync(join(root, path), "utf8"));
  if (types.length === 0) continue;
  const bad = types.filter((t) => !(t in TEST_TYPES));
  if (bad.length > 0) unknownTypes.push({ path, unknown: bad });
  if (reqs.length === 0) typedButUnlinked.push(path);
  for (const req of reqs) {
    if (!covered.has(req)) covered.set(req, new Map());
    const byType = covered.get(req);
    for (const t of types) {
      if (!byType?.has(t)) byType?.set(t, []);
      byType?.get(t)?.push(path);
    }
  }
}

// ── 判定 ───────────────────────────────────────────────
/** @type {string[]} */
const errors = [];
/** @type {{ req: string, missing: string[] }[]} */
const shortfalls = [];
/** @type {{ req: string, rows: { type: string, reason: string }[] }[]} */
const excluded = [];

const declared = new Set(registry.map((r) => r.req));
const undeclared = [...requirementRows.keys()].filter((r) => !declared.has(r)).sort();

for (const row of registry) {
  if (!requirementRows.has(row.req)) {
    errors.push(`${row.req}: 要件表 (${TABLE}) にこの ID の行がありません`);
    continue;
  }
  const badTraits = row.traits.filter((t) => !(t in REQUIRED_TEST_TYPES));
  if (badTraits.length > 0) {
    errors.push(`${row.req}: 知らない性質 ${badTraits.join(", ")}（正本は REQUIRED_TEST_TYPES）`);
    continue;
  }
  if (row.traits.length === 0) {
    errors.push(`${row.req}: 性質が空です。1 つも当てはまらないなら宣言表から行を消してください`);
    continue;
  }

  const required = [...new Set(row.traits.flatMap((t) => REQUIRED_TEST_TYPES[t]))].sort();
  const have = new Set(covered.get(row.req)?.keys() ?? []);
  // ミューテーションだけは実測（対象 2 層）から導く。§ 冒頭の注記を参照。
  const implementation = requirementRows.get(row.req) ?? "";
  if (MUTATION_LAYERS.some((layer) => implementation.includes(layer))) have.add("mutation");

  /** @type {Map<string, string>} */
  const reasons = new Map();
  for (const ex of row.exclusions) {
    if (!(ex.type in TEST_TYPES)) {
      errors.push(`${row.req}: 除外に知らない種別 ${ex.type}（正本は TEST_TYPES）`);
      continue;
    }
    if (ex.reason === "") {
      errors.push(`${row.req}: ${ex.type} の除外に理由がありません。理由の無い除外は認めません`);
      continue;
    }
    if (!required.includes(ex.type)) {
      errors.push(
        `${row.req}: ${ex.type} は宣言した性質から必須になりません。除外する意味がない行です`,
      );
      continue;
    }
    if (have.has(ex.type)) {
      errors.push(`${row.req}: ${ex.type} は除外されていますが、実際には印が付いています`);
      continue;
    }
    reasons.set(ex.type, ex.reason);
  }

  const missing = required.filter((t) => !have.has(t) && !reasons.has(t));
  if (missing.length > 0) shortfalls.push({ req: row.req, missing });
  if (reasons.size > 0) {
    excluded.push({
      req: row.req,
      rows: [...reasons].map(([type, reason]) => ({ type, reason })),
    });
  }
}

const exclusionCount = excluded.reduce((n, e) => n + e.rows.length, 0);

// ── 報告書 ─────────────────────────────────────────────
const body = [
  "# 要件ごとの必須テスト種別（自動生成）",
  "",
  "`node scripts/required-test-types.mjs` が書き換える。**手で編集しない。**",
  `宣言は \`${REGISTRY}\`、語彙と上限は \`quality-gates.config.mjs\` が正本。`,
  "",
  `- 最終更新: ${new Date().toISOString().slice(0, 10)}`,
  `- 要件表の要件: ${requirementRows.size} 件`,
  `- 性質を宣言済: ${registry.length} 件`,
  `- **未宣言: ${undeclared.length} 件**（上限 ${TEST_TYPES_MAX_UNDECLARED} 件）`,
  `- 理由つきの除外: ${exclusionCount} 件（上限 ${TEST_TYPES_MAX_EXCLUSIONS} 件）`,
  "",
  "未宣言とは「必須種別をまだ決めていない」という意味で、",
  "テストが無いという意味ではない。**新しい要件は宣言しないと CI が落ちる。**",
  "",
  "## 宣言済の要件",
  "",
  "| REQ | 性質 | 必須種別 | 満たしている | 理由つき除外 |",
  "| --- | --- | --- | --- | --- |",
  ...registry
    .filter((r) => requirementRows.has(r.req) && r.traits.every((t) => t in REQUIRED_TEST_TYPES))
    .map((r) => {
      const required = [...new Set(r.traits.flatMap((t) => REQUIRED_TEST_TYPES[t]))].sort();
      const have = new Set(covered.get(r.req)?.keys() ?? []);
      const implementation = requirementRows.get(r.req) ?? "";
      if (MUTATION_LAYERS.some((layer) => implementation.includes(layer))) have.add("mutation");
      const ex = r.exclusions.map((e) => e.type);
      return [
        `| ${r.req}`,
        r.traits.join(", "),
        required.map((t) => `\`${t}\``).join(" "),
        required
          .filter((t) => have.has(t))
          .map((t) => `\`${t}\``)
          .join(" ") || "—",
        ex.map((t) => `\`${t}\``).join(" ") || "—",
        "",
      ].join(" | ");
    }),
  "",
  "## 理由つき除外の中身",
  "",
  ...(excluded.length === 0
    ? ["なし。"]
    : excluded.flatMap((e) => [
        `- **${e.req}**`,
        ...e.rows.map((r) => `  - \`${r.type}\`: ${r.reason}`),
      ])),
  "",
  "## 未宣言の要件",
  "",
  undeclared.length === 0 ? "なし。" : undeclared.map((r) => `\`${r}\``).join(" "),
  "",
].join("\n");

if (!process.argv.includes("--check")) writeFileSync(join(root, OUT), body, "utf8");

console.log("\n要件ごとの必須テスト種別");
console.log(`  要件          ${requirementRows.size}`);
console.log(`  宣言済        ${registry.length}`);
console.log(`  未宣言        ${undeclared.length}（上限 ${TEST_TYPES_MAX_UNDECLARED}）`);
console.log(`  理由つき除外  ${exclusionCount}（上限 ${TEST_TYPES_MAX_EXCLUSIONS}）`);
if (!process.argv.includes("--check")) console.log(`\n${OUT} を更新しました。`);

let failed = false;

if (unknownTypes.length > 0) {
  console.error(`\nNG 知らない種別名が ${unknownTypes.length} ファイルにあります。`);
  for (const u of unknownTypes) console.error(`  ${u.path}: ${u.unknown.join(", ")}`);
  console.error("表記ゆれで別種別に見えるのを防ぐため、TEST_TYPES にある名前だけを使います。");
  failed = true;
}

if (typedButUnlinked.length > 0) {
  console.error(`\nNG 種別だけ書いて要件に結んでいないテストが ${typedButUnlinked.length} 件。`);
  for (const p of typedButUnlinked) console.error(`  ${p}`);
  console.error("`@types` は `@req` と対で書きます。どの要件の充足なのかが決まらないためです。");
  failed = true;
}

if (errors.length > 0) {
  console.error(`\nNG 宣言表の書き方に ${errors.length} 件の問題があります。`);
  for (const e of errors) console.error(`  ${e}`);
  failed = true;
}

if (shortfalls.length > 0) {
  console.error(`\nNG 必須種別が欠けている要件が ${shortfalls.length} 件あります。`);
  for (const s of shortfalls) console.error(`  ${s.req}: ${s.missing.join(", ")}`);
  console.error("テストを書くか、書けない理由を宣言表の「除外と理由」に書いてください。");
  console.error("「重要度が低い」「時間が無い」は理由になりません。");
  failed = true;
}

if (undeclared.length > TEST_TYPES_MAX_UNDECLARED) {
  console.error(
    `\nNG 必須種別を宣言していない要件が増えました（${undeclared.length} > ${TEST_TYPES_MAX_UNDECLARED}）。`,
  );
  console.error(`新しい要件は ${REGISTRY} に性質を 1 行足してください。`);
  console.error("**上限を上げて緑にすることを禁じます。**");
  failed = true;
}

if (exclusionCount > TEST_TYPES_MAX_EXCLUSIONS) {
  console.error(`\nNG 理由つき除外が増えました（${exclusionCount} > ${TEST_TYPES_MAX_EXCLUSIONS}）。`);
  console.error("理由を書けば通るなら、全部を除外にすれば緑になります。数は増やせません。");
  failed = true;
}

if (failed) process.exit(1);
console.log("\nOK 必須種別の欠けはありません。");
