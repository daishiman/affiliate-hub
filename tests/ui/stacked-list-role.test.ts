/** @tier 2 @req REQ-TS06, REQ-S09 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/*
  `StackedList` / `StackedRow`（縦に積む一覧）が、`.linkList` の役を正しく引き取り、
  かつ**引き取っていないものを飲み込んでいない**ことを見る。（2026-08-21、残課題 156）

  **`note-role.test.ts` から `walk` / `stripComments` / `ancestorsAt` を写した。共有では
  ない。**共通の道具へ出すと、片方の検査の都合で直したときにもう片方が黙って意味を
  変える——`.note` と `.seeAlso` を 1 つの規則にまとめないのと同じ理由である。
  **値（ここでは実装）が同じであることは、同じ役である証拠ではない。**
  ただし `ancestorsAt` だけは向こうの doc（残課題 147 ⑧「直前のタグ＝親で代用しない」）
  が付いた実測の産物なので、写すときに削らずそのまま持ってきている。

  **母集団の床は各 `it` の中に置く。**別の `it` に置いた床は、その `it` にとっては
  無いのと同じである（`tests/architecture/form2-population-floor.test.ts`）。
*/

const SRC = join(process.cwd(), "src");
const UI = join(SRC, "presentation", "ui");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** コメントを落とす。doc の中の `<StackedRow>` を使用箇所として数えないため。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const VOID_ELEMENTS = new Set(["br", "img", "input", "hr", "meta", "link"]);

/** 位置 index で開いている祖先タグの積み。「直前のタグ」で代用しないこと。 */
function ancestorsAt(source: string, index: number): string[] {
  const stack: string[] = [];
  const tag = /<(\/?)([A-Za-z][\w.]*)((?:[^<>'"]|'[^']*'|"[^"]*"|\{(?:[^{}]|\{[^{}]*\})*\})*)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(source)) !== null && m.index < index) {
    const [, close, name, , selfClose] = m;
    if (close === "/") {
      const at = stack.lastIndexOf(name);
      if (at >= 0) stack.length = at;
    } else if (selfClose !== "/" && !VOID_ELEMENTS.has(name)) {
      stack.push(name);
    }
  }
  return stack;
}

type Site = { readonly where: string; readonly ancestors: readonly string[] };

function sitesOf(pattern: RegExp): Site[] {
  const found: Site[] = [];
  for (const file of walk(SRC)) {
    const source = stripComments(readFileSync(file, "utf8"));
    for (const m of source.matchAll(pattern)) {
      const line = source.slice(0, m.index).split("\n").length;
      found.push({
        where: `${relative(SRC, file)}:${line}`,
        ancestors: ancestorsAt(source, m.index),
      });
    }
  }
  return found;
}

const rowSites = sitesOf(/<StackedRow[\s>]/g);
const listSites = sitesOf(/<StackedList[\s>]/g);
const linkListSites = sitesOf(/className=\{styles\.linkList\}/g);

describe("縦に積む一覧の部品が、役の違うものを飲み込んでいない", () => {
  /*
    **行は一覧の外に立てない。**`StackedRow` は `<li>` を出すので、`<ul>`/`<ol>` の
    外に置くと読み上げが「一覧の項目」と言いながら一覧が無い状態になる。
    型では止められない（`children` は `ReactNode` なので、どこにでも置ける）。
  */
  it("StackedRow が、必ず StackedList の中に在る", () => {
    expect(rowSites.length, "StackedRow の使用箇所を集められていません").toBeGreaterThanOrEqual(55);
    const orphans = rowSites
      .filter((s) => !s.ancestors.includes("StackedList"))
      .map((s) => s.where);
    expect(orphans).toEqual([]);
  });

  /*
    **一覧の中に、生の `<li>` を混ぜない。**混ざると片方だけ `.stackedRow` の
    2 段組みを持ち、もう片方が持たない行ができる。見た目は「その行だけ詰まる」
    という形で出るが、原因は CSS ではなく**器の中の書き方が揃っていないこと**である。
  */
  it("StackedList の中に、生の `<li>` が無い", () => {
    expect(listSites.length, "StackedList の使用箇所を集められていません").toBeGreaterThanOrEqual(45);
    const rawItems = sitesOf(/<li[\s>]/g)
      .filter((s) => s.ancestors.includes("StackedList"))
      .map((s) => s.where);
    expect(rawItems).toEqual([]);
  });

  /*
    役の違った2箇所は `InlineNav` へ移した。旧クラスが再び現れると、縦一覧と横ナビの
    所有境界がまた曖昧になるため、参照0を現在の契約として固定する。
  */
  it("旧 `.linkList` が再び使われていない", () => {
    expect(linkListSites).toEqual([]);
  });

  /*
    **`ordered` は実際に使われている。**使われていない口は、有るのか無いのかを
    誰も確かめないまま残る。`sites/new`（下書きの段階）と `writing`（段落の並び）の
    2 箇所が `<ol>` だった——**順序に意味がある行を `<ul>` へ均さなかった**ことを、
    ここで数として押さえておく。減った日は、役が消えたのか潰されたのかを確かめること。
  */
  it("順序のある一覧が、順序のあるまま残っている", () => {
    expect(listSites.length, "StackedList の使用箇所を集められていません").toBeGreaterThanOrEqual(45);
    const orderedUses = sitesOf(/<StackedList\s+ordered[\s>]/g);
    expect(orderedUses.length, "`ordered` の使用箇所がありません").toBeGreaterThanOrEqual(2);
  });
});

describe("縦に積む一覧の部品が、呼び出し側に見た目を渡していない", () => {
  const source = readFileSync(join(UI, "patterns", "stacked-list.tsx"), "utf8");
  const css = readFileSync(join(UI, "patterns", "patterns.module.css"), "utf8");

  /*
    `className` を受け取れる形にすると、呼び出し側が「この 1 箇所だけ少し空ける」を
    足し始める。**53 箇所に散った余白は、余白の揃っているいまの状態より悪い。**
    `Note` / `SeeAlso` / `SectionHeading` と同じ判断。
  */
  it("StackedList も StackedRow も className を受け取らない", () => {
    expect(source, "stacked-list.tsx を読めていません").toContain("export function StackedList");
    expect(source).toContain("export function StackedRow");
    expect(source).not.toMatch(/readonly\s+className\??\s*:/);
  });

  /*
    **`.stackedNote` と `.note` を 1 つにまとめない。**いま 2 宣言とも同じ値だが、
    `.note` は段落として単独で立ち、`.stackedNote` は行の 2 段目に居る。
    行の側の都合（上の `gap` との兼ね合い）で動かす日が必ず来るので、
    **写しであって共有ではない**という状態を保つ。`.note` / `.seeAlso` と同じ言い方。
  */
  it("`.stackedNote` が `.note` とは別の規則として在る", () => {
    expect(css.match(/(?:^|\n)\.note\s*\{/), "`.note` の規則がありません").not.toBeNull();
    expect(css.match(/(?:^|\n)\.stackedNote\s*\{/), "`.stackedNote` の規則がありません").not.toBeNull();
    expect(css).not.toMatch(/\.note\s*,\s*\.stackedNote|\.stackedNote\s*,\s*\.note/);
  });

  /*
    **押しどころの下限を落とさない。**`.stackedList a` の `min-height` は
    `.linkList a` から 1 つも変えずに写した値である。ここが消えると、
    一覧の中のリンク 23 本が指で押せない大きさに戻る。**見た目は変わらないので、
    消えたことに画面を見ても気づけない。**
  */
  it("一覧の中のリンクに、押しどころの下限が当たっている", () => {
    const rule = css.match(/(?:^|\n)\.stackedList a\s*\{([^}]*)\}/);
    expect(rule, "`.stackedList a` の規則がありません").not.toBeNull();
    expect(rule?.[1] ?? "").toMatch(/min-height:\s*var\(--tap-target-min\)/);
    expect(
      rule?.[1] ?? "",
      "column flex の stretch で透明な押しどころが行幅いっぱいへ広がっています",
    ).toMatch(/align-self:\s*flex-start/);
  });
});
