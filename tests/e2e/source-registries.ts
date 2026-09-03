import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as ts from "typescript";
import { ROUTE_CASES } from "../ui/route-cases";

export type BrowserRoute = {
  readonly file: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly searchParams?: Readonly<Record<string, string | readonly string[]>>;
};

interface SourceObject {
  readonly [key: string]: SourceValue;
}

type SourceValue = string | readonly SourceValue[] | SourceObject;

const ROOT = process.cwd();
const LOCAL_SEED_DATA = join(
  ROOT,
  "scripts/seed/local-seed-data.ts",
);
const HIT_TARGET_TEST = join(ROOT, "tests/ui/screen-hit-and-current.test.tsx");

function sourceFile(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function variableInitializer(file: ts.SourceFile, name: string): ts.Expression {
  const found = declaredInitializer(file, name);
  if (found === undefined) throw new Error(`${file.fileName} に ${name} の定義がありません。`);
  return found;
}

/** そのファイル自身が `const name = ...` を持っているか。 */
function declaredInitializer(file: ts.SourceFile, name: string): ts.Expression | undefined {
  let found: ts.Expression | undefined;
  file.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === name &&
        declaration.initializer !== undefined
      ) {
        found = declaration.initializer;
      }
    }
  });
  return found;
}

/**
 * `export { name } from "./x"` の行き先。無ければ `undefined`。
 *
 * 元の名前で書き出しているとき (`export { A as B }`) は `A` を返す。
 * 追う先で探すべき名前が変わるので、名前も一緒に返す。
 */
function reexportSource(
  file: ts.SourceFile,
  name: string,
): { readonly path: string; readonly name: string } | undefined {
  let hit: { path: string; name: string } | undefined;
  file.forEachChild((node) => {
    if (!ts.isExportDeclaration(node)) return;
    const from = node.moduleSpecifier;
    if (from === undefined || !ts.isStringLiteral(from)) return;
    const clause = node.exportClause;
    if (clause === undefined || !ts.isNamedExports(clause)) return;
    for (const element of clause.elements) {
      if (element.name.text !== name) continue;
      hit = {
        path: resolveModule(file.fileName, from.text),
        name: (element.propertyName ?? element.name).text,
      };
    }
  });
  return hit;
}

/** 相対指定を実ファイルへ。この器が読むのは repo 内の相対 import だけである。 */
function resolveModule(fromFile: string, specifier: string): string {
  if (!specifier.startsWith(".")) {
    throw new Error(`${fromFile} の ${specifier} は相対指定ではないので辿れません。`);
  }
  const base = join(dirname(fromFile), specifier);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`${fromFile} の ${specifier} に対応するファイルが見つかりません。`);
}

/**
 * 名前の**定義**まで辿って初期化子を返す。再エクスポートを 1 段ずつ追う。
 *
 * ## なぜ「そのファイルの const だけ」では駄目なのか
 *
 * この器は 2026-08-30 に 3 度目の同型事故を起こした。値の正本が
 * `sample-identity.ts` へ移り、`ranking-sample-repository.ts` は
 * `export { SAMPLE_WORKSPACE_ID } from "./sample-identity"` の
 * 素通しだけになった。**実行時の意味は 1 文字も変わっていない**——
 * import 側から見れば同じ値が同じ名前で取れる。壊れたのは
 * 「`const` の形でそこに書いてある」ことに寄りかかったこの器だけである。
 *
 * 落ち方が悪い。投げるのは spec ファイルのトップレベルなので、
 * **E2E は 1 件も走らないまま「サーバーが起動できない」だけを言う。**
 * 0 件実行を失敗と区別しない運用なら、これは緑に見える。
 *
 * だから移動に追随させる。**パスを新しい正本へ書き換えるだけにしない。**
 * それは 4 度目を待つのと同じである。
 */
function resolveInitializer(path: string, name: string): ts.Expression {
  const seen = new Set<string>();
  let current = { path, name };
  for (;;) {
    const key = `${current.path}#${current.name}`;
    if (seen.has(key)) throw new Error(`${name} の再エクスポートが輪になっています。`);
    seen.add(key);
    const file = sourceFile(current.path);
    const declared = declaredInitializer(file, current.name);
    if (declared !== undefined) return declared;
    const next = reexportSource(file, current.name);
    if (next === undefined) {
      throw new Error(`${current.path} に ${current.name} の定義がありません。`);
    }
    current = next;
  }
}

function propertyName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  throw new Error(`読み取れないプロパティ名です: ${name.getText()}`);
}

function readValue(
  expression: ts.Expression,
  bindings: Readonly<Record<string, SourceValue>>,
): SourceValue {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  /*
    型だけの覆いは実行時の値を変えないので剥がす
    (`x as T` / `x satisfies T` / `(x)`)。
    剥がさないと、`SAMPLE_WORKSPACE_ID` のように
    「値は文字列のまま、型だけ厳しくした」日にこの器が読めなくなる。
  */
  if (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression) ||
    ts.isTypeAssertionExpression(expression)
  ) {
    return readValue(expression.expression, bindings);
  }
  if (ts.isIdentifier(expression)) {
    const bound = bindings[expression.text];
    if (bound === undefined) throw new Error(`値 ${expression.text} の出どころが分かりません。`);
    return bound;
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.map((element) => {
      if (ts.isSpreadElement(element)) {
        const spread = readValue(element.expression, bindings);
        if (!Array.isArray(spread)) throw new Error(`${element.getText()} は配列ではありません。`);
        return spread;
      }
      return readValue(element, bindings);
    }).flat();
  }
  if (ts.isCallExpression(expression) && expression.arguments.length === 1) {
    return readValue(expression.arguments[0], bindings);
  }
  if (ts.isObjectLiteralExpression(expression)) {
    const value: Record<string, SourceValue> = {};
    for (const property of expression.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(`読み取れないオブジェクト要素です: ${property.getText()}`);
      }
      value[propertyName(property.name)] = readValue(property.initializer, bindings);
    }
    return value;
  }
  throw new Error(`読み取れない値です: ${expression.getText()}`);
}

function readExportedString(path: string, name: string): string {
  const value = readValue(resolveInitializer(path, name), {});
  if (typeof value !== "string") throw new Error(`${name} が文字列ではありません。`);
  return value;
}

export function readSampleWorkspaceId(): string {
  // previewが実際に入れるローカルseedと同じ正本を読む。
  return readExportedString(LOCAL_SEED_DATA, "SEED_WORKSPACE_ID");
}

/**
 * URL の正本は `tests/ui/route-cases.ts`。ここには経路を1本も書き写さない。
 *
 * **2026-08-26 まで、この関数は同じ表を TypeScript の構文木から手読みしていた。**
 * 読み手が解せるのはリテラルだけで、表の `ADMIN` が
 * `ADMIN_ROUTE_METADATA.map(...)` の射影になった日から、この関数は
 * 「読み取れない値です」で投げるようになっていた。呼ぶのは spec ファイルの
 * トップレベルなので、`app-routes.spec.ts` と `pending-hit-targets.spec.ts` は
 * **収集の時点で落ち、1 件も走らないまま**だった。
 *
 * 表を描く道具から割った（`route-cases.ts`）ので、普通に import できる。
 */
export function readBrowserRoutes(): readonly BrowserRoute[] {
  const routes: readonly BrowserRoute[] = ROUTE_CASES;
  const unique = new Set(routes.map((route) => route.file));
  if (unique.size !== routes.length) throw new Error("route table に同じ画面が重複しています。");
  return routes;
}

export function urlOf(route: BrowserRoute): string {
  let pathname = route.file === "page.tsx" ? "/" : `/${route.file.replace(/\/page\.tsx$/, "")}`;
  pathname = pathname.replace(/\[([^\]]+)\]/g, (_segment, key: string) => {
    const value = route.params?.[key];
    if (value === undefined) throw new Error(`${route.file} の [${key}] に入れる値がありません。`);
    return encodeURIComponent(value);
  });
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(route.searchParams ?? {})) {
    for (const value of Array.isArray(raw) ? raw : [raw]) query.append(key, value);
  }
  const suffix = query.toString();
  return suffix === "" ? pathname : `${pathname}?${suffix}`;
}

/** 名指し保留一覧も既存テストが正本。selector を二重管理しない。 */
export function readPendingTargetSelectors(): readonly string[] {
  const value = readValue(variableInitializer(sourceFile(HIT_TARGET_TEST), "PENDING"), {});
  if (typeof value === "string" || Array.isArray(value)) {
    throw new Error("PENDING がオブジェクトではありません。");
  }
  return Object.keys(value);
}
