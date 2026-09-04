/**
 * @tier 2
 * @req REQ-FB02
 * @types code-boundary
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cssFilesUnder, declarationOf, rulesOf } from "./css-rules";

/**
 * 本文の上に浮く要素は、自分で名乗る。
 *
 * --- なぜ検査で拾うのか ---
 *
 * `data-floating-overlay` は 2 つの用途を同じ 1 つの手掛かりで支えている。
 *
 *   1. 写しからの退避（`capture-exclusion.ts` / 撮影中だけ隠す）
 *   2. 重なり監査からの除外（`tests/e2e/app-routes.spec.ts`）
 *
 * **付け忘れは、どちらの側からも静かである。**写しには「なぜか写り込む要素」が
 * 増えるだけで、監査には「重なっている」と報告されるだけで、どちらも
 * *その要素が名乗っていない*とは言わない。だから名乗りの側を機械で数える。
 *
 * --- 何を数えているのか ---
 *
 * CSS で `position: fixed` を持つ class を浮遊要素の定義とみなし、その class を
 * 使っている JSX の開始タグに名乗りがあるかを見る。**除外は理由付きでのみ許す。**
 * 既定が「落ちる」側なので、新しく浮かせた要素は必ずここに現れる。
 */

const UI_ROOT = join(process.cwd(), "src/presentation/ui");

/**
 * 名乗らなくてよい浮遊要素と、その理由。
 *
 * **理由を書かせるのは、増えたときに気づくためである。**空の配列に足すのは
 * ただの作業だが、理由を 1 行書くのは判断になる。
 */
const EXEMPT: Readonly<Record<string, string>> = {
  // 画面の外へ送ってあり、キーボードで触れた瞬間だけ現れる。写しに入らず、
  // 重なり監査でも位置を持たない。名乗らせると「常に浮いているもの」と混ざる。
  skipLink: "焦点が当たるまで画面外にあり、写しにも重なり判定にも現れないため",
};

/** CSS module から `position: fixed` を持つ class 名を集める。 */
function fixedClasses(): Set<string> {
  const found = new Set<string>();
  for (const path of cssFilesUnder(UI_ROOT)) {
    for (const rule of rulesOf(path)) {
      const className = rule.selector.match(/^\.([A-Za-z0-9_-]+)$/)?.[1];
      if (className !== undefined && declarationOf(rule.body, "position") === "fixed") {
        found.add(className);
      }
    }
  }
  return found;
}

/**
 * `styles.<class>` を含む JSX 開始タグの本文を取り出す。
 *
 * 波括弧の深さを数えているのは、属性値の中の `>`（`() => x` の矢印など）で
 * タグが終わったと誤解しないため。
 */
function openingTags(source: string, className: string): string[] {
  const tags: string[] = [];
  const needle = new RegExp(`styles\\.${className}\\b`, "g");
  for (const hit of source.matchAll(needle)) {
    const at = hit.index ?? 0;
    const start = source.lastIndexOf("<", at);
    if (start < 0) continue;
    let depth = 0;
    let end = start;
    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) {
        end = index;
        break;
      }
    }
    tags.push(source.slice(start, end + 1));
  }
  return tags;
}

describe("本文の上に浮く要素は、自分で名乗る", () => {
  const classes = fixedClasses();

  /*
    **床を同じ `it` の中に置いている。**「空振りしていないこと」を別の `it` へ
    切り出すと読みやすくなるが、そのとき *0 件を主張する側* と *母集団が空でないと
    言う側* が別々に緑になれる。走査が壊れて 0 件になった日、前者は緑のまま黙る。
    `tests/architecture/form2-population-floor.test.ts` が塞いでいるのはこの形で、
    分けたい気持ちのほうが違反である。
  */
  it("名乗っていない浮遊要素は、理由付きの除外に限る", () => {
    const sourceRoot = join(process.cwd(), "src");
    const sources = readdirSync(sourceRoot, { encoding: "utf8", recursive: true })
      .filter((relativePath) => relativePath.endsWith(".tsx"))
      .map((relativePath) => {
        const path = join(sourceRoot, relativePath);
        return { path, text: readFileSync(path, "utf8") };
      });

    // --- 母集団の床（この 0 が「悪さが無い」ことを意味すると言えるための前提）---
    expect(classes.size, "position: fixed の class が 1 つも見つかりません").toBeGreaterThan(0);
    expect([...classes.keys()], "既知の浮遊要素すら見つかっていません").toContain(
      "feedbackLauncher",
    );
    expect(sources.length, "走査対象の .tsx が 1 つも見つかりません").toBeGreaterThan(0);

    const unnamed: string[] = [];
    let inspected = 0;
    for (const className of classes) {
      if (className in EXEMPT) continue;
      for (const { path, text } of sources) {
        for (const tag of openingTags(text, className)) {
          inspected += 1;
          if (!tag.includes("data-floating-overlay")) {
            unnamed.push(`${path}: .${className}`);
          }
        }
      }
    }

    // class は在るのに、それを使う JSX を 1 つも掴めていない状態でも 0 件は出る。
    expect(inspected, "浮遊 class を使っている JSX を 1 つも掴めていません").toBeGreaterThan(0);

    expect(
      unnamed,
      "本文の上に浮いているのに data-floating-overlay を名乗っていない要素があります。" +
        "名乗らせるか、理由を添えて EXEMPT へ入れてください",
    ).toEqual([]);
  });

  it("除外には必ず理由が要る", () => {
    for (const [name, reason] of Object.entries(EXEMPT)) {
      expect(reason.trim(), `${name} の除外理由が空です`).not.toBe("");
      expect(classes.has(name), `${name} はもう浮いていません（除外を消してください）`).toBe(true);
    }
  });
});
