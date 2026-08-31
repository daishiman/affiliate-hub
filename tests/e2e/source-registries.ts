import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  if (found === undefined) throw new Error(`${file.fileName} に ${name} の定義がありません。`);
  return found;
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
  const value = readValue(variableInitializer(sourceFile(path), name), {});
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
