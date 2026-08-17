/**
 * つなぎ目（ポート）に、**製品側の呼び出し元があるか**を見る。
 *
 * --- なぜこの検査が要るか ---
 * この案件では「口はあるが誰も呼んでいない」が 3 回続いた。
 *
 *   1. 表現ポリシー: きまり 13 件を登録したが、照らす場所が無かった
 *   2. 読者ページの道具: 8 つ載せたが、読者の権限では 1 つも動かなかった
 *   3. 操作の記録: 書き口があるのに、呼ぶ場所が 1 つも無かった
 *
 * 3 回続いたら偶然ではない。**1 件ずつ見つけて潰す限り、
 * 見つかっていないものは残り続ける。** この検査は「塞ぐ」ためではなく、
 * **一覧が出て、それ以上増えない**状態を作るためにある。
 *
 * --- 既存の検査との違い ---
 * `tests/presentation/composition-wiring.test.ts` は
 * 「入口が保存先の接続を渡しているか」を見る（＝つないだつもりの検出）。
 * こちらは「**そもそも誰も呼んでいない口**」を見る。
 * 操作の記録はあちらを通り抜けていた。守るものが違う。
 *
 * --- 数え方で気をつけていること ---
 * **テストからの呼び出しを数えない。** 数えると全部緑になり、
 * この検査自体が 4 件目の穴になる。見るのは `src/` の製品コードだけ。
 *
 * **文字列の一致では数えない。** ユースケースは枠の名前を付け替える
 * （`contentVariants` を `variants` として受け取る等）ので、
 * 名前で探すと呼んでいるものを「呼んでいない」と数える。
 * TypeScript の型検査そのものに聞き、**その手続きがどのポートの宣言に
 * 由来するか**で数える。
 *
 * --- 手続き単位で見る理由 ---
 * ポート単位で「1 つでも呼ばれていれば OK」にすると、
 * 操作の記録のような**一部だけ埋まった状態**を見逃す。
 * 実際いまも、記録は承認と段階の移動しか書いていない。
 * 公開が記録されない記録は、承認が記録されない記録とほぼ同じ危うさを持つ。
 *
 * ```
 * node scripts/port-wiring.mjs          判定して一覧を更新
 * node scripts/port-wiring.mjs --check  更新せず判定だけ
 * ```
 *
 * 規範: docs/product/port-wiring.md（理由つきの除外の登録簿）
 */

import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
import { PORT_WIRING_MAX_UNCALLED, PORT_WIRING_MAX_EXCLUSIONS } from "../quality-gates.config.mjs";

const REGISTRY = "docs/product/port-wiring.md";
const OUT = "docs/product/port-wiring-report.md";
const PORTS_DIR = "src/application/ports/";

/**
 * 呼び出し元として数える場所。
 *
 * `src/infrastructure` を入れないのは、あそこに居るのは**実装**だからである。
 * 実装どうしが受け渡しているだけの呼び出しを数えると、
 * 「作ったが製品のどの流れからも使われていない」ものが緑になる。
 */
const CALLER_ROOTS = ["src/application/", "src/presentation/", "src/app/"];

const isPortFile = (f) => f.includes(PORTS_DIR);
const isCaller = (f) => CALLER_ROOTS.some((r) => f.includes(r)) && !isPortFile(f);

/** tsconfig からプログラムを起こす。型に聞くのが目的なので、設定は本番と同じものを使う。 */
function createProgram() {
  const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
  if (configPath === undefined) throw new Error("tsconfig.json が見つかりません。");
  const raw = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(raw.config, ts.sys, process.cwd());
  return ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true });
}

/**
 * ポートの宣言を集める。
 *
 * `export type XxxPort = { method(...): ... }` の形だけを見る。
 * `Editorial<XxxPort>` のような包みは、包まれた側の宣言に辿り着くので
 * ここでは数えない（同じ手続きを 2 回数えないため）。
 */
function collectPorts(program) {
  /** @type {Map<string, {file: string, methods: string[]}>} */
  const ports = new Map();
  for (const sf of program.getSourceFiles()) {
    if (!isPortFile(sf.fileName) || sf.isDeclarationFile) continue;
    ts.forEachChild(sf, (node) => {
      if (!ts.isTypeAliasDeclaration(node)) return;
      if (!node.name.text.endsWith("Port")) return;
      if (!ts.isTypeLiteralNode(node.type)) return;
      const methods = node.type.members
        .filter((m) => ts.isMethodSignature(m) && ts.isIdentifier(m.name))
        .map((m) => m.name.text);
      if (methods.length > 0) {
        ports.set(node.name.text, { file: sf.fileName, methods });
      }
    });
  }
  return ports;
}

/**
 * 呼び出しを集める。
 *
 * `foo.bar()` の `bar` がどの宣言から来たかを型検査に聞き、
 * その宣言がポートの中に書かれていれば 1 件と数える。
 * 枠の名前を付け替えていても、包んでいても、正しく辿れる。
 */
function collectCalls(program) {
  const checker = program.getTypeChecker();
  /** @type {Map<string, Set<string>>} port名 -> 呼ばれた手続き名 */
  const called = new Map();

  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const symbol = checker.getSymbolAtLocation(node.expression.name);
      for (const decl of symbol?.declarations ?? []) {
        if (!ts.isMethodSignature(decl)) continue;
        const alias = decl.parent?.parent;
        if (alias === undefined || !ts.isTypeAliasDeclaration(alias)) continue;
        const file = alias.getSourceFile().fileName;
        if (!isPortFile(file)) continue;
        const port = alias.name.text;
        if (!called.has(port)) called.set(port, new Set());
        called.get(port).add(node.expression.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };

  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile || !isCaller(sf.fileName)) continue;
    visit(sf);
  }
  return called;
}

/**
 * 理由つきの除外を読む。
 *
 * 表の形: `| Port.method | 理由 |`
 * **理由が空のものは除外として認めない。** 理由を書かせるのは、
 * 「とりあえず除外」を積めなくするため。
 */
function readExclusions() {
  let text = "";
  try {
    text = readFileSync(REGISTRY, "utf8");
  } catch {
    return new Map();
  }
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const line of text.split("\n")) {
    const m = /^\|\s*`([A-Za-z]+Port)\.(\w+)`\s*\|\s*([^|]*?)\s*\|/.exec(line);
    if (m === null) continue;
    if (m[3].trim() === "") continue;
    out.set(`${m[1]}.${m[2]}`, m[3].trim());
  }
  return out;
}

const program = createProgram();
const ports = collectPorts(program);
const called = collectCalls(program);
const exclusions = readExclusions();

/** @type {{port: string, method: string, file: string}[]} */
const uncalled = [];
let totalMethods = 0;
for (const [port, { file, methods }] of [...ports].sort((a, b) => a[0].localeCompare(b[0]))) {
  for (const method of methods) {
    totalMethods++;
    if (called.get(port)?.has(method) === true) continue;
    if (exclusions.has(`${port}.${method}`)) continue;
    uncalled.push({ port, method, file: file.replace(`${process.cwd()}/`, "") });
  }
}

const lines = [
  "# つなぎ目の呼び出し（自動生成）",
  "",
  "`node scripts/port-wiring.mjs` が書き出す。手で直さない。",
  "",
  "**製品コード（`src/application` `src/presentation` `src/app`）から**",
  "呼ばれていないポートの手続きの一覧。テストからの呼び出しは数えない。",
  "",
  `- ポート ${ports.size} 件 / 手続き ${totalMethods} 件`,
  `- 呼ばれていない ${uncalled.length} 件（上限 ${PORT_WIRING_MAX_UNCALLED}）`,
  `- 理由つきの除外 ${exclusions.size} 件（上限 ${PORT_WIRING_MAX_EXCLUSIONS}）`,
  "",
  "| ポート | 手続き | 宣言 |",
  "| --- | --- | --- |",
];
for (const u of uncalled) lines.push(`| \`${u.port}\` | \`${u.method}\` | \`${u.file}\` |`);
lines.push("");

if (!process.argv.includes("--check")) {
  writeFileSync(OUT, `${lines.join("\n")}\n`);
}

console.log("つなぎ目の呼び出し");
console.log(`  ポート          ${ports.size}`);
console.log(`  手続き          ${totalMethods}`);
console.log(`  呼ばれていない  ${uncalled.length}（上限 ${PORT_WIRING_MAX_UNCALLED}）`);
console.log(`  理由つき除外    ${exclusions.size}（上限 ${PORT_WIRING_MAX_EXCLUSIONS}）`);
console.log("");

if (process.argv.includes("--list")) {
  for (const u of uncalled) console.log(`  ${u.port}.${u.method}  (${u.file})`);
  console.log("");
}

/**
 * 前回の一覧に無かったものだけを出す。
 *
 * 全部を並べると 80 件超が流れ、**今回の変更で増えた 1 件が埋もれる**。
 * 落ちた人が知りたいのは「どれを壊したか」であって、既知の一覧ではない。
 */
function newlyUncalled() {
  let previous;
  try {
    previous = new Set(
      [...readFileSync(OUT, "utf8").matchAll(/^\|\s*`(\w+Port)`\s*\|\s*`(\w+)`\s*\|/gm)].map(
        (m) => `${m[1]}.${m[2]}`,
      ),
    );
  } catch {
    return [];
  }
  return uncalled.filter((u) => !previous.has(`${u.port}.${u.method}`));
}

let ng = false;
if (uncalled.length > PORT_WIRING_MAX_UNCALLED) {
  console.log(`NG 呼ばれていない手続きが上限を ${uncalled.length - PORT_WIRING_MAX_UNCALLED} 件超えました。`);
  console.log("   足したポートを呼ぶか、理由を書いて docs/product/port-wiring.md へ登録してください。");
  console.log("   **上限を上げて緑にすることは禁止です。**");
  const fresh = newlyUncalled();
  if (fresh.length > 0) {
    console.log("\n   今回から呼ばれなくなったもの:");
    for (const u of fresh) console.log(`   - ${u.port}.${u.method}  (${u.file})`);
  } else {
    console.log("\n   （前回の一覧との差が取れませんでした。全件は下記を見てください）");
    console.log(`   ${OUT}`);
  }
  ng = true;
}
if (exclusions.size > PORT_WIRING_MAX_EXCLUSIONS) {
  console.log(`NG 除外が上限を ${exclusions.size - PORT_WIRING_MAX_EXCLUSIONS} 件超えました。`);
  ng = true;
}
if (!ng) {
  console.log(`OK ${OUT} を更新しました。`);
}
process.exit(ng ? 1 : 0);
