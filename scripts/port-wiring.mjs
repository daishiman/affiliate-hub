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

import { readFileSync } from "node:fs";
import ts from "typescript";
import { writeGeneratedDoc } from "./lib/generated-doc.mjs";
import {
  PORT_WIRING_MAX_UNCALLED,
  PORT_WIRING_MAX_EXCLUSIONS,
  PORT_WIRING_MAX_UNRECORDED,
  PORT_WIRING_MAX_WRITE_EXCLUSIONS,
  PORT_WIRING_MAX_UNKNOWN_VERBS,
  PORT_WIRING_MAX_AUDIT_BEST_EFFORT,
} from "../quality-gates.config.mjs";

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
 * 入口から辿れるポートの手続きを集める。
 *
 * **同じファイルの中の補助関数を辿る。** 辿らないと、
 * `record()` のような 1 枚かぶせた書き方が「記録していない」に化ける
 * （実際 `manage-content.ts` がこの形で、記録は `record()` の中にある）。
 */
function reachablePortCalls(program, entry, localFns) {
  const checker = program.getTypeChecker();
  /** @type {Set<string>} */
  const found = new Set();
  const seen = new Set();

  const walk = (node) => {
    if (ts.isCallExpression(node)) {
      // ポートの手続きか
      if (ts.isPropertyAccessExpression(node.expression)) {
        const symbol = checker.getSymbolAtLocation(node.expression.name);
        for (const decl of symbol?.declarations ?? []) {
          if (!ts.isMethodSignature(decl)) continue;
          const alias = decl.parent?.parent;
          if (alias === undefined || !ts.isTypeAliasDeclaration(alias)) continue;
          if (!isPortFile(alias.getSourceFile().fileName)) continue;
          found.add(`${alias.name.text}.${node.expression.name.text}`);
        }
      }
      // 同じファイルの補助関数なら、その中まで見る
      if (ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        const fn = localFns.get(name);
        if (fn !== undefined && !seen.has(name)) {
          seen.add(name);
          walk(fn);
        }
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(entry);
  return found;
}

/**
 * 「書き込みをするのに、操作の記録へ届いていない入口」を集める。
 *
 * これが 4 件目の穴の形である。記録の口は呼ばれている（＝上の総ざらいは緑）が、
 * **21 ある書き込みの入口のうち届いているのは 1 つだけ**、という状態を
 * 上の検査は原理的に拾えない。手続き単位で「1 回でも呼ばれたか」しか見ないためである。
 */
function collectWriteEntryPoints(program, unknownVerbs) {
  /** @type {{name: string, file: string, writes: string[]}[]} */
  const rows = [];
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    if (!sf.fileName.includes("src/application/usecases/")) continue;

    /** @type {Map<string, ts.Node>} 同じファイルの中の関数 */
    const localFns = new Map();
    ts.forEachChild(sf, (node) => {
      if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
        localFns.set(node.name.text, node);
      }
      if (ts.isVariableStatement(node)) {
        for (const d of node.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.initializer !== undefined) {
            localFns.set(d.name.text, d.initializer);
          }
        }
      }
    });

    ts.forEachChild(sf, (node) => {
      if (!ts.isFunctionDeclaration(node) || node.name === undefined) return;
      if (!/^create\w*UseCase$/.test(node.name.text)) return;
      const isExported =
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true;
      if (!isExported) return;

      const reach = reachablePortCalls(program, node, localFns);
      // 記録そのもの（AuditLogPort）は「書き込み」に数えない。
      // 数えると、記録を書いただけの入口が自分で自分を満たしてしまう。
      const own = [...reach].filter((r) => !r.startsWith("AuditLogPort."));
      const writes = own.filter((r) => classify(r.split(".")[1]) === "write");
      for (const r of own.filter((x) => classify(x.split(".")[1]) === "unknown")) unknownVerbs.add(r);
      if (writes.length === 0) return;
      if (reach.has("AuditLogPort.append")) return;
      rows.push({
        name: node.name.text,
        file: sf.fileName.replace(`${process.cwd()}/`, ""),
        writes: writes.sort(),
      });
    });
  }
  return rows.sort((a, b) => (a.file + a.name).localeCompare(b.file + b.name));
}

/**
 * 「記録を書きにはいくが、**書けなくても止まらない**入口」を集める。
 *
 * --- これが 5 つ目の穴の形である ---
 * 上の 2 つは「記録へ**届いているか**」を見る。届いてさえいれば緑になる。
 * ところが記録の書き足しは失敗しうる（保存先が落ちている・見本モードで
 * 置き場が無い）。そのとき戻り値を見ずに次へ進むと、
 * **操作は成功し、記録だけが無い**状態が残る。
 *
 * この状態は画面から見えない。押した人には成功として返り、
 * 記録の一覧を後から開いた人には「その操作は無かった」ように見える。
 * つまり**気づく機会が両側とも無い**。
 *
 * 判定は「`AuditLogPort.append` の呼び出しが、式のまま捨てられているか」。
 * `const r = await …` と受けていれば、その後に見ているかどうかまでは見ない
 * （そこは各入口の単体テストが受け持つ）。受けずに捨てている形だけを数える。
 *
 * **0 にはできない。** 見本モードで下書きが 1 段目から進まなくなるため、
 * いまは 2 件（下書きの開始と段階の保存）を意図して捨てている。
 * だから**0 にするのではなく、2 で止める**。
 */
function collectBestEffortAuditEntryPoints(program) {
  const checker = program.getTypeChecker();
  /** @type {{name: string, file: string, line: number}[]} */
  const rows = [];

  /** その呼び出しが `AuditLogPort.append` か。 */
  const isAuditAppend = (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
    if (node.expression.name.text !== "append") return false;
    const symbol = checker.getSymbolAtLocation(node.expression.name);
    for (const decl of symbol?.declarations ?? []) {
      if (!ts.isMethodSignature(decl)) continue;
      const alias = decl.parent?.parent;
      if (alias === undefined || !ts.isTypeAliasDeclaration(alias)) continue;
      if (!isPortFile(alias.getSourceFile().fileName)) continue;
      if (alias.name.text === "AuditLogPort") return true;
    }
    return false;
  };

  /**
   * 戻り値が捨てられているか。
   *
   * `await x.append(e);` は AwaitExpression が式文の直下に来る。
   * `const r = await x.append(e);` は変数宣言の下に来るので捨てていない。
   */
  const isDiscarded = (node) => {
    const outer = node.parent !== undefined && ts.isAwaitExpression(node.parent) ? node.parent : node;
    return outer.parent !== undefined && ts.isExpressionStatement(outer.parent);
  };

  /**
   * その呼び出しを囲んでいる、名前の付いたいちばん内側の関数名。
   *
   * **入口の関数の中だけを見ては駄目である。** 記録の書き足しは
   * `record(...)` のような同じファイルの下請けへ畳まれていることがあり
   * （`manage-content.ts` `publication-calendar.ts` がその形）、
   * 入口から辿る書き方だと**畳んだ瞬間に数から消える**。
   * 消えたことは緑として現れるので、隠す手口としていちばん通りやすい。
   * だからファイル全体を見て、名前は報告のためだけに使う。
   */
  const enclosingName = (node) => {
    for (let n = node.parent; n !== undefined; n = n.parent) {
      if (ts.isFunctionDeclaration(n) && n.name !== undefined) return n.name.text;
      if ((ts.isFunctionExpression(n) || ts.isArrowFunction(n)) && ts.isVariableDeclaration(n.parent)) {
        if (ts.isIdentifier(n.parent.name)) return n.parent.name.text;
      }
    }
    return "(名前の無い関数)";
  };

  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    if (!sf.fileName.includes("src/application/usecases/")) continue;

    const walk = (n) => {
      if (isAuditAppend(n) && isDiscarded(n)) {
        rows.push({
          name: enclosingName(n),
          file: sf.fileName.replace(`${process.cwd()}/`, ""),
          line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
        });
      }
      ts.forEachChild(n, walk);
    };
    walk(sf);
  }
  return rows.sort((a, b) => (a.file + a.line).localeCompare(b.file + b.line));
}

/**
 * 登録簿のうち、**除外を書く見出しの下だけ**を切り出す。
 *
 * --- なぜ見出しで区切るか ---
 * 最初は登録簿の全行から表を拾っていた。ところが同じファイルへ
 * 「塞いだもの」の一覧を足したとき、**その表が黙って除外として数えられた**。
 * 除外は上限で縛ってあるので今回は赤で気づけたが、上限に余裕がある間は
 * 気づけない。**説明のために書いた表が、そのまま抜け道になる**形である。
 *
 * よって拾うのは見出しに「除外の書き方」を含む節の中だけにする。
 * 「精査したが除外しなかったもの」「塞いだもの」は、
 * 同じ形の表で書いても除外にならない。
 *
 * @param {string} text
 */
function sectionsForExclusions(text) {
  const out = [];
  let inside = false;
  for (const line of text.split("\n")) {
    const heading = /^#{2,4}\s+(.+)$/.exec(line);
    if (heading !== null) {
      inside = heading[1].includes("除外の書き方");
      continue;
    }
    if (inside) out.push(line);
  }
  return out;
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
  for (const line of sectionsForExclusions(text)) {
    const m = /^\|\s*`([A-Za-z]+Port)\.(\w+)`\s*\|\s*([^|]*?)\s*\|/.exec(line);
    if (m === null) continue;
    if (m[3].trim() === "") continue;
    out.set(`${m[1]}.${m[2]}`, m[3].trim());
  }
  return out;
}

/**
 * 書き込みの入口のうち、**操作の記録へ届いていないもの**の登録簿。
 *
 * 表の形: `| createXxxUseCase | 理由 |`
 * 上と同じく、理由が空のものは認めない。
 */
function readWriteExclusions() {
  let text = "";
  try {
    text = readFileSync(REGISTRY, "utf8");
  } catch {
    return new Map();
  }
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const line of sectionsForExclusions(text)) {
    const m = /^\|\s*`(create\w*UseCase)`\s*\|\s*([^|]*?)\s*\|/.exec(line);
    if (m === null) continue;
    if (m[2].trim() === "") continue;
    out.set(m[1], m[2].trim());
  }
  return out;
}

/**
 * 手続きを「読み取り / 書き込み / **判定できない**」の 3 つに分ける。
 *
 * --- なぜ 3 つ目が要るか ---
 * 最初は「読み取りの語彙は狭いから、それ以外を全部書き込みとする」で書いた。
 * 実測したら外れた。ポートには**動詞でない手続き**がある
 * （`newId` `signedUrl` `current` `buildDraft`）。これらは読みでも書きでもなく、
 * 「それ以外＝書き込み」にすると読み取りの入口が 10 件ほど書き込みに化けた。
 *
 * では書き込み側を並べればよいかというと、そちらは**並べ忘れた動詞が
 * 黙って漏れる**。まさにこの検査自体が次の穴になる形である。
 *
 * よって**両方並べ、どちらにも無いものを「判定できない」として数える**。
 * 判定できないものは緑にも赤にもせず、件数を固定して見えるようにする。
 * 語彙が増えたらそこが動くので、**黙って漏れることがない**。
 */
/**
 * 「書き込みではない」手続きの頭。
 *
 * *読み取り* ではなく **書き込みでない** と呼ぶのが正しい。
 * 純粋な計算（`estimate` `buildDraft`）や採番（`newId`）は読みでも書きでもないが、
 * **操作の記録を要求する理由が無い**という一点で読みと同じ側に置ける。
 * ここを「読み」と呼ぶと、`newId` を読みに入れた時点で嘘になる。
 */
const NON_WRITE_VERBS = [
  "get",
  "list",
  "find",
  "search",
  "read",
  "count",
  "exists",
  "load",
  "fetch",
  "has",
  "query",
  "verify",
  "check",
  "is",
  "signed",
  "estimate",
  "generate",
  "build",
  "run",
  "observations",
  // 期間の合計を返すだけ。何も書き換えないので記録は要らない。
  "summarize",
  // 手元の値から鍵や身元を組み立てて返すだけ（`deriveContactRateLimitKey` /
  // `resolveIdentity`）。**外へ問い合わせても、こちら側は何も書き換えない。**
  "derive",
  "resolve",
];
/**
 * 動詞で始まらないが、読み取りだと分かっている名前。
 *
 * `forConnection` は「その接続に合う実装を選んで返す」だけの索引で、
 * 動詞が無い（`getConnector` にすると、接続そのものを取ってくるように読める）。
 * 名前を曲げるより、ここへ 1 行足すほうが正直である。
 */

/**
 * 動詞で始まらない手続き。**頭の一致では拾えないので、名前ごと書く。**
 *
 * `new` や `run` を頭の一致に足すと広く効きすぎる（`newOrder` を作る手続きまで
 * 書き込みでない側へ落ちる）。数が少ないうちは名前ごと並べるほうが安全である。
 */
const NON_WRITE_EXACT = new Set(["current", "newId", "aiUsage", "forConnection"]);
const WRITE_VERBS = [
  "save",
  "create",
  "update",
  "delete",
  "remove",
  "insert",
  "upsert",
  "put",
  "append",
  "publish",
  "record",
  "revoke",
  "archive",
  "cancel",
  "schedule",
  "send",
  "enqueue",
  "write",
  "submit",
  "add",
  // 鍵を預ける。`save` と同じ側だが、預かり所の語彙としては `store` が自然なので
  // 名前を曲げずに語彙のほうを足す。
  "store",
  // 取り合いの一手（`claimNormalizedUrl` / `releaseNormalizedUrl`）。
  //
  // **`claim` は「聞く」ではなく「書く」。**この 2 つは、読んでから書く 2 手に
  // 分けると同時に呼ばれたとき両方が「無い」を見て両方入ってしまうので、
  // **一手で決着させる**ことを口の側で要求している（`monetization.ts` の doc）。
  // 返り値が ID なので読み取りに見えるが、**返る前に必ず書いている。**
  // `release` は取り分を消す側で、こちらは字面どおり書き込み。
  //
  // **返り値の形で読み書きを決めないこと**が、この 2 件の教訓である。
  "claim",
  "release",
  // 出していたものを引っ込める（`unpublish`）。`publish` で始まらないので
  // 前方一致では拾えない。**打ち消しの接頭辞は、消し忘れると
  // 「公開は記録されるが取り下げは記録されない」という片側だけの記録になる。**
  "unpublish",
  // 使えなくする（`disable`）。消しはしないが、外から見える振る舞いは
  // 消したのと同じなので、記録の要求は `remove` と同じ側に置く。
  "disable",
  // 印を付ける（`markHandled`）。付けた印で次の人の仕事が変わるので書き込み。
  "mark",
  // 読んでから書く 2 手を一手で決着させる（`compareAndSwap`）。
  // `claim` と同じ理由でここに居る。返り値が真偽でも、返る前に書いている。
  "compareAndSwap",
];
const startsWithVerb = (name, verbs) => verbs.some((v) => name.startsWith(v));
/** 書き込み / 書き込みでない / 判定できない のどれかを返す。 */
function classify(method) {
  if (startsWithVerb(method, WRITE_VERBS)) return "write";
  if (NON_WRITE_EXACT.has(method)) return "read";
  if (startsWithVerb(method, NON_WRITE_VERBS)) return "read";
  return "unknown";
}

const program = createProgram();
const ports = collectPorts(program);
const called = collectCalls(program);
const exclusions = readExclusions();
const writeExclusions = readWriteExclusions();
/** 読みとも書きとも判定できなかった手続き（黙って漏らさないために数える）。 */
const unknownVerbs = new Set();
const unrecorded = collectWriteEntryPoints(program, unknownVerbs).filter(
  (r) => !writeExclusions.has(r.name),
);
const bestEffortAudit = collectBestEffortAuditEntryPoints(program);

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
  "末尾の指紋がその見張りで、手で 1 文字でも書くと次の実行が**上書きせずに止まる**（書いた行は残る）。",
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
lines.push("## 書き込みなのに操作の記録へ届いていない入口");
lines.push("");
lines.push("上の表は「1 回でも呼ばれたか」しか見ないので、**一部の経路からしか");
lines.push("呼ばれていない**状態を拾えない。ここはその形を見る。");
lines.push("");
lines.push(`- 届いていない ${unrecorded.length} 件（上限 ${PORT_WIRING_MAX_UNRECORDED}）`);
lines.push(`- 理由つきの除外 ${writeExclusions.size} 件（上限 ${PORT_WIRING_MAX_WRITE_EXCLUSIONS}）`);
lines.push("");
lines.push(`- 読み書きを判定できない手続き ${unknownVerbs.size} 件（上限 ${PORT_WIRING_MAX_UNKNOWN_VERBS}）`);
lines.push("");
lines.push("| 入口 | 書き込んでいるもの | 場所 |");
lines.push("| --- | --- | --- |");
for (const r of unrecorded) {
  lines.push(`| \`${r.name}\` | ${r.writes.map((w) => `\`${w}\``).join("<br>")} | \`${r.file}\` |`);
}
lines.push("");

lines.push("## 記録が残せなくても進む入口");
lines.push("");
lines.push("上の 2 つは「記録へ**届いているか**」を見る。届いてさえいれば緑になる。");
lines.push("ここは届いた先で**書けなかったときに止まるか**を見る。");
lines.push("");
lines.push("書けなかったのに進むと、**操作は成功し、記録だけが無い**状態が残る。");
lines.push("押した人には成功として返り、あとで記録を開いた人には「その操作は無かった」");
lines.push("ように見えるので、**どちらの側からも気づけない**。");
lines.push("");
lines.push(`- 記録が残せなくても進む入口 ${bestEffortAudit.length} 件（上限 ${PORT_WIRING_MAX_AUDIT_BEST_EFFORT}）`);
lines.push("");
lines.push("**0 にはできない。** 見本モードでは置き場が無く、0 にすると下書きが");
lines.push("1 段目から進まなくなる。だから 0 ではなく、いまの実測で止める。");
lines.push("");
lines.push("| 入口 | 場所 |");
lines.push("| --- | --- |");
for (const r of bestEffortAudit) lines.push(`| \`${r.name}\` | \`${r.file}:${r.line}\` |`);
lines.push("");

if (unknownVerbs.size > 0) {
  lines.push("### 読み書きを判定できなかった手続き");
  lines.push("");
  lines.push("動詞の一覧（`scripts/port-wiring.mjs` の `NON_WRITE_VERBS` / `WRITE_VERBS`）の");
  lines.push("どちらにも当たらなかったもの。**書き込みの判定から漏れている可能性がある。**");
  lines.push("放置してよいが、件数が増えたらどちらかへ足すこと。");
  lines.push("");
  for (const u of [...unknownVerbs].sort()) lines.push(`- \`${u}\``);
  lines.push("");
}

console.log("つなぎ目の呼び出し");
console.log(`  ポート          ${ports.size}`);
console.log(`  手続き          ${totalMethods}`);
console.log(`  呼ばれていない  ${uncalled.length}（上限 ${PORT_WIRING_MAX_UNCALLED}）`);
console.log(`  理由つき除外    ${exclusions.size}（上限 ${PORT_WIRING_MAX_EXCLUSIONS}）`);
console.log("");
console.log("書き込みなのに記録へ届いていない入口");
console.log(`  届いていない    ${unrecorded.length}（上限 ${PORT_WIRING_MAX_UNRECORDED}）`);
console.log(`  理由つき除外    ${writeExclusions.size}（上限 ${PORT_WIRING_MAX_WRITE_EXCLUSIONS}）`);
console.log(`  判定できない    ${unknownVerbs.size}（上限 ${PORT_WIRING_MAX_UNKNOWN_VERBS}）`);
console.log("");
console.log("記録が残せなくても進む入口");
console.log(`  書けても書けなくても進む  ${bestEffortAudit.length}（上限 ${PORT_WIRING_MAX_AUDIT_BEST_EFFORT}）`);
for (const r of bestEffortAudit) console.log(`  - ${r.name}  (${r.file}:${r.line})`);
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

/** 同じ考えで、記録へ届いていない入口の「今回から増えた分」を出す。 */
function newlyUnrecorded() {
  let previous;
  try {
    previous = new Set(
      [...readFileSync(OUT, "utf8").matchAll(/^\|\s*`(create\w*UseCase)`\s*\|/gm)].map((m) => m[1]),
    );
  } catch {
    return [];
  }
  return unrecorded.filter((r) => !previous.has(r.name));
}

/**
 * **差分は、報告書を上書きする前に取る。**
 *
 * 以前はここが書き出しの後ろにあり、`newlyUncalled()` が
 * 「今まさに自分が書いた一覧」を前回として読んでいた。
 * そのため差は常に 0 件になり、落ちても「どれを壊したか」が一度も出なかった。
 * 落ちること自体は上限で分かるが、**案内の側が黙って効かなくなっていた**。
 */
const fresh = newlyUncalled();
const freshUnrecorded = newlyUnrecorded();

// 落ちたときは報告書を上書きしない。
// 上書きすると増えた 1 件が既知の一覧に混ざり、次回からは差が取れなくなる
// （壊れた状態が「前回」として焼き付く）。
const failing =
  uncalled.length > PORT_WIRING_MAX_UNCALLED ||
  exclusions.size > PORT_WIRING_MAX_EXCLUSIONS ||
  unrecorded.length > PORT_WIRING_MAX_UNRECORDED ||
  writeExclusions.size > PORT_WIRING_MAX_WRITE_EXCLUSIONS ||
  bestEffortAudit.length > PORT_WIRING_MAX_AUDIT_BEST_EFFORT;
if (!process.argv.includes("--check") && !failing) {
  // `writeGeneratedDoc` は、**上書きする前に**いまディスクにあるものの指紋を見る。
  // 手で書き換えられていれば書かずに投げるので、書いた行は残ったまま赤になる。
  writeGeneratedDoc(OUT, lines.join("\n"));
}

let ng = false;
if (uncalled.length > PORT_WIRING_MAX_UNCALLED) {
  console.log(`NG 呼ばれていない手続きが上限を ${uncalled.length - PORT_WIRING_MAX_UNCALLED} 件超えました。`);
  console.log("   足したポートを呼ぶか、理由を書いて docs/product/port-wiring.md へ登録してください。");
  console.log("   **上限を上げて緑にすることは禁止です。**");
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
if (unrecorded.length > PORT_WIRING_MAX_UNRECORDED) {
  console.log(
    `NG 記録へ届いていない書き込みの入口が上限を ${unrecorded.length - PORT_WIRING_MAX_UNRECORDED} 件超えました。`,
  );
  console.log("   その入口から操作の記録を書くか、理由を書いて docs/product/port-wiring.md へ登録してください。");
  console.log("   **上限を上げて緑にすることは禁止です。**");
  if (freshUnrecorded.length > 0) {
    console.log("\n   今回から記録へ届かなくなったもの:");
    for (const r of freshUnrecorded) {
      console.log(`   - ${r.name}  [${r.writes.join(" ")}]  (${r.file})`);
    }
  } else {
    console.log(`\n   （前回の一覧との差が取れませんでした。全件は ${OUT} を見てください）`);
  }
  ng = true;
}
if (unknownVerbs.size > PORT_WIRING_MAX_UNKNOWN_VERBS) {
  console.log(
    `NG 読み書きを判定できない手続きが上限を ${unknownVerbs.size - PORT_WIRING_MAX_UNKNOWN_VERBS} 件超えました。`,
  );
  console.log("   NON_WRITE_VERBS か WRITE_VERBS のどちらかへ足してください（どちらか決められないなら、それは名前の側の問題）。");
  for (const u of [...unknownVerbs].sort()) console.log(`   - ${u}`);
  ng = true;
}
if (writeExclusions.size > PORT_WIRING_MAX_WRITE_EXCLUSIONS) {
  console.log(
    `NG 書き込み側の除外が上限を ${writeExclusions.size - PORT_WIRING_MAX_WRITE_EXCLUSIONS} 件超えました。`,
  );
  ng = true;
}
if (bestEffortAudit.length > PORT_WIRING_MAX_AUDIT_BEST_EFFORT) {
  console.log(
    `NG 記録が残せなくても進む入口が上限を ${bestEffortAudit.length - PORT_WIRING_MAX_AUDIT_BEST_EFFORT} 件超えました。`,
  );
  console.log("   `await deps.auditLog.append(...)` の戻り値を受けて、失敗したら断ってください。");
  console.log("   `const appended = await …; if (!appended.ok) return err(auditWriteFailure(…));`");
  console.log("   **上限を上げて緑にすることは禁止です。**");
  for (const r of bestEffortAudit) console.log(`   - ${r.name}  (${r.file}:${r.line})`);
  ng = true;
}
if (!ng) {
  console.log(`OK ${OUT} を更新しました。`);
}
process.exit(ng ? 1 : 0);
