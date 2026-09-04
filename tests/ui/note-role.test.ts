/** @tier 2 @req REQ-TS06, REQ-S09 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/*
  `Note`（注記の段落）が、見た目の同じ別の役を飲み込んでいないことを見る。

  **なぜ「`.linkNote` が増えていない」を見張らないか。**同じ日に `.sectionTitle` が
  176 → 180 に増えており、その 4 件は正当な追加だった。増えないことを見張ると
  正当な追加でも赤くなり、そのうち**上限を上げて緑にする運用**になる。だから
  ここが見るのは件数の増減ではなく、**Note がどこに現れるか**という形である。

  **母集団の床は各 `it` の中に置く。**別の `it` に置いた床は、その `it` にとっては
  無いのと同じである（`tests/architecture/form2-population-floor.test.ts` の
  「名前が言っていないこと」節）。「床が在るか」ではなく
  「その `it` が自分の母集団に床を張っているか」を満たす形にしてある。
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

/** コメントを落とす。doc の中の `<Note>` を使用箇所として数えないため。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const VOID_ELEMENTS = new Set(["br", "img", "input", "hr", "meta", "link"]);

/** 位置 index で開いている祖先タグの積み。「直前のタグ」で代用しないこと（下記）。 */
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

const noteSites = sitesOf(/<Note>/g);
const linkNoteParagraphs = sitesOf(/<p[^>]*className=\{styles\.linkNote\}/g);

type Body = { readonly where: string; readonly inner: string };

/** `<Tag>…</Tag>` の中身を取る。入れ子の同名タグは無いので単純な非貪欲でよい。 */
function bodiesOf(tag: string): Body[] {
  const found: Body[] = [];
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
  for (const file of walk(SRC)) {
    const source = stripComments(readFileSync(file, "utf8"));
    for (const m of source.matchAll(pattern)) {
      const line = source.slice(0, m.index).split("\n").length;
      found.push({ where: `${relative(SRC, file)}:${line}`, inner: m[1] });
    }
  }
  return found;
}

/** `{ … }` を入れ子込みで落とす。JSX 式の中身は「画面に出る文」ではないため。 */
function dropExpressions(source: string): string {
  let out = "";
  let depth = 0;
  for (const ch of source) {
    if (ch === "{") depth += 1;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

/**
 * 中身がリンク 1 本だけか。**「リンクを含むか」ではない。**
 * リンクの外に画面へ出る文字が 1 つでも残れば、それは行き先ではなく文である。
 */
function isLinkOnly(inner: string): boolean {
  if (!/<(?:TextLink|Link|a)\b/.test(inner)) return false;
  const withoutLinks = inner.replace(/<(TextLink|Link|a)\b[\s\S]*?<\/\1>/g, "");
  const text = dropExpressions(withoutLinks).replace(/<[^>]*>/g, "").trim();
  return text === "";
}

describe("注記の部品が、役の違うものを飲み込んでいない", () => {
  /*
    **一覧の行（`<li>` の中）へ広げないこと。**そこは `.linkList` と対で使われていて、
    片割れだけ部品にすると一覧の 1 行が部品と生クラスの継ぎ目で割れる。

    **`.linkList` ごと上げる回は済んだ**（残課題 156）。`StackedList` / `StackedRow` を
    作り、行の注記は `StackedRow` の `note` が受け持っている。だからここの床は
    「`<li>` の中に Note が無い」のまま据え置きで、**むしろ今は満たしやすくなった**。

    数の記録を 1 つ直す。当時「36 箇所」と書いたが、実測は **35** だった
    （`note.tsx` の doc がまだ 36 と書いている）。**1 件の差でも、次に数える人が
    「1 件どこかへ消えた」と探し始める。**
  */
  it("`<li>` の中に Note が無い", () => {
    expect(noteSites.length, "Note の使用箇所を集められていません").toBeGreaterThanOrEqual(35);
    const inList = noteSites.filter((s) => s.ancestors.includes("li")).map((s) => s.where);
    expect(inList).toEqual([]);
  });

  /*
    **`<label>` の中へ広げないこと。**`admin/feedback/page.tsx` の 1 件は
    チェックボックスのラベル文そのもので、注記ではない。ここへ通すと
    表示は合ったまま意味が嘘になる（残課題 148）。見た目の整理とは別の問題。
  */
  it("`<label>` の中に Note が無い", () => {
    expect(noteSites.length, "Note の使用箇所を集められていません").toBeGreaterThanOrEqual(35);
    const inLabel = noteSites.filter((s) => s.ancestors.includes("label")).map((s) => s.where);
    expect(inLabel).toEqual([]);
  });

  /*
    残っている `<p className={styles.linkNote}>` は `/signin` のぶんだけである。
    そこは別の担当（UX-03）が持っているファイルなので、この回では触っていない。
    **入れ忘れではない。**0 件になっても緑のままにしてあるのは、`/signin` を
    通した日にこの検査を直させないため——ここが言いたいのは
    「まだ在る」ではなく「**在るとすればそこだけ**」である。
  */
  it("残った `<p>` の linkNote は signin だけにある", () => {
    const paragraphs = sitesOf(/<p[^>]*>/g);
    expect(paragraphs.length, "`<p>` を 1 つも集められていません").toBeGreaterThanOrEqual(70);
    const elsewhere = linkNoteParagraphs
      .map((s) => s.where)
      .filter((where) => !where.startsWith("app/signin/"));
    expect(elsewhere).toEqual([]);
  });

  /*
    **行き先を注記に入れない。**`Note` の 42 箇所のうち 6 箇所が
    `<Note><Link>…を見る</Link></Note>` の形で、これは注記ではなく行き先だった
    （残課題 152）。`SeeAlso` へ移してある。

    **この誤りを、上の 3 つは 1 つも止められなかった。**`<li>` にも `<label>` にも
    入っていない、`<p>` の中の正しい位置に在る誤りだったからである——
    見張っていたのは**外への流用**で、**役B の内側の誤り**は見ていなかった。

    そして件数の見張り（「`.linkNote` が増えていない」）だったら、43 件が `Note` に
    なった時点で緑になり、**この 6 件は永久に見つからなかった。**
  */
  it("Note の中が行き先だけになっていない", () => {
    const bodies = bodiesOf("Note");
    expect(bodies.length, "Note の中身を集められていません").toBeGreaterThanOrEqual(35);
    const linkOnly = bodies.filter((b) => isLinkOnly(b.inner)).map((b) => b.where);
    expect(linkOnly).toEqual([]);
  });

  /*
    **逆側も見る。**`SeeAlso` に文が入っていたら、それは行き先ではなく注記である。
    片側だけ見張ると、寄せる向きが反対になっただけの同じ誤りが通る。
  */
  it("SeeAlso の中が行き先 1 本だけになっている", () => {
    const bodies = bodiesOf("SeeAlso");
    expect(bodies.length, "SeeAlso の中身を集められていません").toBeGreaterThanOrEqual(6);
    const notLinkOnly = bodies.filter((b) => !isLinkOnly(b.inner)).map((b) => b.where);
    expect(notLinkOnly).toEqual([]);
  });
});

describe("注記の部品が、呼び出し側に見た目を渡していない", () => {
  const note = readFileSync(join(UI, "patterns", "note.tsx"), "utf8");

  /*
    `className` を受け取れる形にすると、呼び出し側が「この 1 箇所だけ少し空ける」を
    足し始める。**43 箇所に散った余白は、余白ゼロで揃っているいまの状態より悪い。**
  */
  it("className を受け取らない", () => {
    expect(note, "note.tsx を読めていません").toContain("export function Note");
    expect(note).not.toMatch(/readonly\s+className\??\s*:/);
  });

  /*
    **余白ゼロは、いまの 43 箇所の見え方をそのまま写した結果である。**実物を描いて
    確かめる手立てが無い以上、現状を写すのが唯一の実測に基づく選択で、足すのは推測になる。
    足す日が来たら、この検査ごと書き直すこと——**赤を消すために消すのではなく、
    43 箇所すべての見え方が変わることを引き受けたうえで**。
  */
  it("`.note` が余白を宣言していない", () => {
    const css = readFileSync(join(UI, "patterns", "patterns.module.css"), "utf8");
    const rule = css.match(/(?:^|\n)\.note\s*\{([^}]*)\}/);
    expect(rule, "patterns.module.css に `.note` の規則がありません").not.toBeNull();
    const declarations = (rule?.[1] ?? "")
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean);
    expect(declarations.length, "`.note` の宣言を読めていません").toBeGreaterThanOrEqual(2);
    expect(declarations.filter((d) => /^margin/.test(d))).toEqual([]);
  });

  /*
    `SeeAlso` も同じ理由で `className` を受け取らない。**片方だけ閉じても、
    開いているほうから同じものが流れ込む。**
  */
  it("SeeAlso も className を受け取らない", () => {
    const seeAlso = readFileSync(join(UI, "patterns", "see-also.tsx"), "utf8");
    expect(seeAlso, "see-also.tsx を読めていません").toContain("export function SeeAlso");
    expect(seeAlso).not.toMatch(/readonly\s+className\??\s*:/);
  });

  /*
    **`.seeAlso` と `.note` を 1 つにまとめない。**いま値は同じだが、
    別々に動かせることが要件である——押しどころの下限は `.seeAlso` には当てられ、
    `.note` には当てられない（文の中のリンク 2 本で行の高さが崩れる）。
    まとめると、その「巻き込まれない」が失われる。
    **値が同じであることは、同じ役である証拠ではない。**
  */
  it("`.seeAlso` が `.note` とは別の規則として在る", () => {
    const css = readFileSync(join(UI, "patterns", "patterns.module.css"), "utf8");
    expect(css.match(/(?:^|\n)\.note\s*\{/), "`.note` の規則がありません").not.toBeNull();
    expect(css.match(/(?:^|\n)\.seeAlso\s*\{/), "`.seeAlso` の規則がありません").not.toBeNull();
    // まとめた形（`.note, .seeAlso { … }`）になっていないこと。
    expect(css).not.toMatch(/\.note\s*,\s*\.seeAlso|\.seeAlso\s*,\s*\.note/);
  });
});

describe("この検査自身が、当たっていることを示している", () => {
  /*
    **「直前に現れたタグ＝親」で代用しない。**最初にそれで測ったとき、`</Link>` を
    閉じとして数えないため**兄の `<Link>` を親と読み**、「リンクの中に 13 箇所」という
    実在しない役を 1 つ作った（残課題 147 ⑧）。取りこぼしは数が足りないので気づけるが、
    **創作は数が増えるので「よく調べた」ように見える。**だから代理指標が嘘を返すことを、
    数として置いておく。
  */
  it("祖先の積みでしか分けられない箇所が、現に在る", () => {
    const nested = noteSites.filter((s) => s.ancestors.length >= 3);
    expect(nested.length, "入れ子の中の Note が 1 件も無く、祖先を見る意味が測れていません")
      .toBeGreaterThan(0);
  });
});
