import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as ts from "typescript";

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
const ROUTE_TABLE = join(ROOT, "tests/ui/route-table.ts");
const SITE_REPOSITORY = join(
  ROOT,
  "src/infrastructure/persistence/sample/site-sample-repository.ts",
);
const RANKING_REPOSITORY = join(
  ROOT,
  "src/infrastructure/persistence/sample/ranking-sample-repository.ts",
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

function asRoute(value: SourceValue): BrowserRoute {
  if (typeof value === "string" || Array.isArray(value)) {
    throw new Error("route table の行がオブジェクトではありません。");
  }
  const object = value as SourceObject;
  const file = object.file;
  if (typeof file !== "string") throw new Error("route table の file が文字列ではありません。");
  return object as BrowserRoute;
}

function readExportedString(path: string, name: string): string {
  const value = readValue(variableInitializer(sourceFile(path), name), {});
  if (typeof value !== "string") throw new Error(`${name} が文字列ではありません。`);
  return value;
}

export function readSampleWorkspaceId(): string {
  return readExportedString(RANKING_REPOSITORY, "SAMPLE_WORKSPACE_ID");
}

/**
 * URL の正本は tests/ui/route-table.ts。ここには経路を1本も書き写さない。
 * 動的部分に入れる見本値も、同表と site sample repository から読む。
 */
export function readBrowserRoutes(): readonly BrowserRoute[] {
  const file = sourceFile(ROUTE_TABLE);
  const site = readExportedString(SITE_REPOSITORY, "SAMPLE_SITE_SLUG");
  const bindings = { SITE: site } as const;
  const groups = ["ENTRY", "ADMIN", "READER"].map((name) =>
    readValue(variableInitializer(file, name), bindings),
  );
  const routes = groups.flatMap((group) => {
    if (!Array.isArray(group)) throw new Error("route table のグループが配列ではありません。");
    return group.map(asRoute);
  });
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
