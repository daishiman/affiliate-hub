/**
 * @tier 1
 * @req REQ-TS09
 * @types structural
 *
 * 読者向けの一覧は、保存済み・予約済み URL・非表示 URL・見本を
 * 同じ規則で重ねる。この規則が reader ごとに複製されると、たとえば
 * archive だけ見本へ戻る、という差が生まれる。
 *
 * SQL の絞り込みはカテゴリ・検索・書き手それぞれに残し、
 * 重ねる規則だけを DB に触れない 1 つの pure helper へ集める。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE_PATH = "src/infrastructure/persistence/d1/published-article-repository.ts";
const source = readFileSync(join(process.cwd(), SOURCE_PATH), "utf8");
const sourceFile = ts.createSourceFile(
  SOURCE_PATH,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

function callsOf(name: string): readonly ts.CallExpression[] {
  const found: ts.CallExpression[] = [];
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

describe("公開済み記事 reader の重ね方", () => {
  it("保存済み・見本・非表示の merge 規則を 1 つの pure helper からだけ呼ぶ", () => {
    const calls = callsOf("mergeBySlug");
    expect(
      calls,
      "mergeBySlug を reader ごとに呼ぶと、archive/tombstone の見本補完規則が分岐します。",
    ).toHaveLength(1);

    const owner = calls[0]?.parent;
    let enclosing: ts.Node | undefined = owner;
    while (enclosing !== undefined && !ts.isFunctionLike(enclosing)) enclosing = enclosing.parent;
    expect(
      ts.isFunctionDeclaration(enclosing) && enclosing.parent === sourceFile,
      "merge の統合点は repository factory の外に置いた pure helper にしてください。",
    ).toBe(true);

    const helperSource = enclosing?.getText(sourceFile) ?? "";
    expect(helperSource).not.toMatch(/\b(?:await|db)\b/);
  });

  it("カテゴリ・検索・書き手の SQL 条件はそれぞれの reader に残す", () => {
    expect(source).toContain("eq(publishedArticles.categorySlug, categorySlug)");
    expect(source).toContain("like(publishedArticles.title, `%${trimmed}%`)");
    expect(source).toContain("like(publishedArticles.summary, `%${trimmed}%`)");
    expect(source).toContain("eq(publishedArticles.authorSlug, personSlug)");
  });
});
