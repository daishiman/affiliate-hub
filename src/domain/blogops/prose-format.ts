/**
 * 本文の断片と、保存される文字列の相互変換。
 *
 * ## 不変条件
 *
 * **`parseProse(serializeProse(nodes))` は `nodes` と一致する。** 19 種すべてで
 * 成り立つ (BE-PROSE-02)。
 *
 * これが崩れると、運営者が保存を押すたびに本文が少しずつ変わる。
 * 1 回では気づかない。10 回目に「書いた覚えのない形」になっている。
 * `tests/domain/blogops/prose-format.test.ts` がこの往復を固定している。
 *
 * ## 記法
 *
 * 素の Markdown で書けるものは Markdown で書く。書けないものだけ
 * `:::` の囲みを使う。**独自記法を最小にするのは、AI に書かせるため**である。
 * 覚えることが増えるほど、ローカルの CLI が書いた本文は崩れる。
 *
 * ```
 * 段落        そのまま (空行で区切る)
 * 小見出し    ### text  /  #### text
 * 箇条書き    - item
 * 番号付き    1. item
 * チェック    - [ ] item  /  - [x] item
 * 引用        > text
 * 区切り線    ---
 * 画像        ![alt](src)
 * プログラム  ```lang … ```
 * 比較表      | 見出し | 見出し |     ← Markdown の表そのもの
 *             | --- | --- |
 *             | 値 | 値 |
 * 表          :::table … Markdown の表 … :::
 * 注意書き    :::callout tone=info title="題"
 *             本文
 *             :::
 * 折りたたみ  :::toggle title="題" … :::
 * 商品カード  :::product-card id="pc_xxx" :::
 * 横並び画像  :::image-row … ![alt](src) を並べる … :::
 * 埋め込み    :::embed url="…" title="…" :::
 * 押しボタン  :::cta-button href="…" label="…" tone=action :::
 * リンクカード :::link-card url="…" title="…" description="…" :::
 * 2 段組      :::columns … 左 … :::split … 右 … :::
 * ```
 *
 * 行の中の装飾 (太字・色など) は `prose-inline.ts` が持つ。ここは行より上だけを見る。
 *
 * ## 素の文章はそのまま読める
 *
 * 記法を 1 つも使っていない文字列は、段落だけの本文として読める。
 * **既存の記事を移行しなくてよい**のはこのためである。
 *
 * ## 読めない記法を捨てない (BE-PROSE-03)
 *
 * 知らない `:::` の名前は、段落として**文字のまま**通る。読み直したときに
 * 元の文字が 1 つも欠けないことを `prose-format.test.ts` が固定している。
 * 読めないことと、失ってよいことは違う。
 */

import { CALLOUT_TONES, CTA_TONES, assertNever } from "./prose-node";
import { proseCodeFence } from "./prose-code-fence";
import type {
  ProseCalloutTone,
  ProseChecklistItem,
  ProseCtaTone,
  ProseImage,
  ProseNode,
} from "./prose-node";

/*
  行頭がこれらで始まる段落は、そのまま書くと別の断片として読み直される。
  書き出すときに `\` を前へ足し、読み込むときに外す。

  段落ではブロック開始記号を逃がす。囲みの本文は別の境界を持つので、
  そちらでは閉じ行・段組の区切り行だけを逃がす。
*/
const PARAGRAPH_ESCAPE = /^(\\|#{1,6} |[-*] |\d+\. |> |:::|```|\||!\[|---$)/;

function escapeParagraph(text: string): string {
  return text
    .split("\n")
    .map((line) => (PARAGRAPH_ESCAPE.test(line) ? `\\${line}` : line))
    .join("\n");
}

function unescapeParagraph(text: string): string {
  return text
    .split("\n")
    .map((line) => (
      line.startsWith("\\") && PARAGRAPH_ESCAPE.test(line.slice(1)) ? line.slice(1) : line
    ))
    .join("\n");
}

/*
  箇条書きの項目が `[ ] ` で始まると、書き出した行が
  チェックリストとして読み直される。項目の先頭だけを逃がす。
*/
function escapeItem(text: string): string {
  return /^(\\|\[)/.test(text) ? `\\${text}` : text;
}

function unescapeItem(text: string): string {
  return text.startsWith("\\") ? text.slice(1) : text;
}

/** `:::` の属性に入れる値。`"` と `\` だけを逃がす。 */
function quoteAttr(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function parseAttrs(source: string): Readonly<Record<string, string>> {
  const found: Record<string, string> = {};
  const pattern = /(\w+)=(?:"((?:[^"\\]|\\.)*)"|(\S+))/g;
  let hit = pattern.exec(source);
  while (hit !== null) {
    /*
      **`hit[3]` に `?? ""` を足さない。**式の 2 つの選択肢は `"..."` と `\S+` で、
      片方が必ず当たる。だから `hit[2]` が空なら `hit[3]` は必ず埋まっている。

      以前ここに `?? ""` があった。読むと丁寧に見えるが、**その右辺へは
      どんな入力でも到達しない**。到達しない枝は分岐の分母だけを増やし、
      「テストが薄い」という顔をして下限を押し下げる。式が保証している
      ことをもう一度確かめる形は、安全側に見えて測り方を壊す。
    */
    const raw =
      hit[2] !== undefined ? hit[2].replace(/\\(.)/g, "$1") : (hit[3] as string);
    found[hit[1] as string] = raw;
    hit = pattern.exec(source);
  }
  return found;
}

/** 2 段組の左右を分ける行。`:::` そのものではないので閉じと間違えない。 */
const COLUMNS_SPLIT = ":::split";

const DIRECTIVE_BOUNDARY = /^\\*(?:\s*:::\s*|:::split)$/;

function escapeDirectiveBody(text: string): string {
  return text.split("\n")
    .map((line) => DIRECTIVE_BOUNDARY.test(line) ? `\\${line}` : line)
    .join("\n");
}

function unescapeDirectiveBody(lines: readonly string[]): string {
  return lines.map((line) => (
    line.startsWith("\\") && DIRECTIVE_BOUNDARY.test(line.slice(1)) ? line.slice(1) : line
  )).join("\n");
}

/** 旧本文のバックスラッシュと区別できるよう、衝突を逃がした囲みだけに印を付ける。 */
function serializeTextDirective(header: string, texts: readonly string[]): string {
  const escaped = texts.some((text) => text.split("\n").some(
    (line) => line.trim() === ":::" || line === COLUMNS_SPLIT,
  ));
  const body = (escaped ? texts.map(escapeDirectiveBody) : texts).join(`\n${COLUMNS_SPLIT}\n`);
  return [header + (escaped ? " body_escape=1" : ""), body, ":::"].join("\n");
}

/** 断片の配列を、保存する 1 本の文字列にする。 */
export function serializeProse(nodes: readonly ProseNode[]): string {
  return nodes.map(serializeNode).join("\n\n");
}

function escapeImageAlt(alt: string): string {
  return alt.replace(/[\\\]]/g, (hit) => `\\${hit}`);
}

function escapeImageSrc(src: string): string {
  return src.replace(/[\\()]/g, (hit) => `\\${hit}`);
}

function unescapeImageAlt(alt: string): string {
  return alt.replace(/\\([\\\]])/g, "$1");
}

function unescapeImageSrc(src: string): string {
  return src.replace(/\\([\\()])/g, "$1");
}

function serializeImage(image: ProseImage): string {
  return `![${escapeImageAlt(image.alt)}](${escapeImageSrc(image.src)})`;
}

/** alt を閉じる、逃がされていない `]`。 */
function findImageAltClose(source: string, from: number): number | null {
  for (let at = from; at < source.length; at += 1) {
    if (source[at] === "\\") {
      at += 1;
      continue;
    }
    if (source[at] === "]") return at;
  }
  return null;
}

/** src を閉じる丸括弧。逃がした括弧は構造に数えない。 */
function findImageSrcClose(source: string, from: number): number | null {
  let depth = 0;
  for (let at = from; at < source.length; at += 1) {
    const char = source[at];
    if (char === "\\") {
      at += 1;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      if (depth === 0) return at;
      depth -= 1;
    }
  }
  return null;
}

/** 1 行全体が読み切れたときだけ、画像として受け取る。 */
function parseImage(source: string): ProseImage | null {
  if (!source.startsWith("![")) return null;
  const altClose = findImageAltClose(source, 2);
  if (altClose === null || source[altClose + 1] !== "(") return null;
  const srcClose = findImageSrcClose(source, altClose + 2);
  if (srcClose === null || srcClose !== source.length - 1) return null;
  return {
    alt: unescapeImageAlt(source.slice(2, altClose)),
    src: unescapeImageSrc(source.slice(altClose + 2, srcClose)),
  };
}

function serializeNode(node: ProseNode): string {
  switch (node.kind) {
    case "paragraph":
      return escapeParagraph(node.text);
    case "heading":
      return `${"#".repeat(node.level)} ${node.text}`;
    case "bullet-list":
      return node.items.map((item) => `- ${escapeItem(item)}`).join("\n");
    case "ordered-list":
      return node.items.map((item, i) => `${i + 1}. ${escapeItem(item)}`).join("\n");
    case "checklist":
      return node.items
        .map((item) => `- [${item.checked ? "x" : " "}] ${item.text}`)
        .join("\n");
    case "quote":
      return node.text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "divider":
      return "---";
    case "image":
      return serializeImage(node);
    case "code": {
      /*
        言語は囲みの後ろへ書く。**中身は 1 文字も変えない。**
        逃がすと、プログラムとして見せたい記号が読者へ違う形で出る。
      */
      const fence = proseCodeFence(node.text, 3);
      return [fence + node.language, node.text, fence].join("\n");
    }
    case "comparison-table":
      return serializeTable(node.headers, node.rows);
    case "table":
      return [":::table", serializeTable(node.headers, node.rows), ":::"].join("\n");
    case "callout":
      return serializeTextDirective(
        `:::callout tone=${node.tone} title=${quoteAttr(node.title)}`,
        [node.text],
      );
    case "toggle":
      return serializeTextDirective(`:::toggle title=${quoteAttr(node.title)}`, [node.text]);
    case "product-card":
      return [`:::product-card id=${quoteAttr(node.productId)}`, ":::"].join("\n");
    case "image-row":
      return [":::image-row", ...node.images.map(serializeImage), ":::"].join("\n");
    case "embed":
      return [
        `:::embed url=${quoteAttr(node.url)} title=${quoteAttr(node.title)}`,
        ":::",
      ].join("\n");
    case "cta-button":
      return [
        `:::cta-button href=${quoteAttr(node.href)} label=${quoteAttr(node.label)} tone=${node.tone}`,
        ":::",
      ].join("\n");
    case "link-card":
      return [
        `:::link-card url=${quoteAttr(node.url)} title=${quoteAttr(node.title)} description=${quoteAttr(node.description)}`,
        ":::",
      ].join("\n");
    case "columns":
      return serializeTextDirective(":::columns", [node.left, node.right]);
  }
  return assertNever(node, "保存できない本文断片です");
}

function serializeTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const head = `| ${headers.map(escapeTableCell).join(" | ")} |`;
  const rule = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(escapeTableCell).join(" | ")} |`);
  return [head, rule, ...body].join("\n");
}

/** 表の構造記号だけを逃がす。`バックスラッシュ→縦線` の順は固定。 */
function escapeTableCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

/** 保存された文字列を、扱える断片の配列にする。 */
export function parseProse(source: string): readonly ProseNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const nodes: ProseNode[] = [];
  let at = 0;

  while (at < lines.length) {
    const line = lines[at] as string;

    if (line.trim() === "") {
      at += 1;
      continue;
    }

    /*
      **囲みを先に見る。**`:::` で始まる行は、閉じが見つからなければ
      段落として読み直す。閉じ忘れた本文を丸ごと飲み込むと、
      運営者から見れば「保存したら文章が消えた」ことになる。
    */
    if (line.startsWith(":::")) {
      const closed = findClose(lines, at + 1);
      if (closed !== null) {
        const parsed = parseDirective(line, lines.slice(at + 1, closed));
        if (parsed !== null) {
          nodes.push(parsed);
          at = closed + 1;
          continue;
        }
      }
    }

    /*
      プログラムの囲みも閉じが要る。閉じていない ``` は段落として読む。
      中身は 1 行も加工しない。
    */
    const code = /^(`{3,})(.*)$/.exec(line);
    if (code !== null) {
      const closed = findCodeClose(lines, at + 1, (code[1] as string).length);
      if (closed !== null) {
        nodes.push({
          kind: "code",
          language: (code[2] as string).trim(),
          text: lines.slice(at + 1, closed).join("\n"),
        });
        at = closed + 1;
        continue;
      }
    }

    const heading = /^(#{3,4}) (.*)$/.exec(line);
    if (heading !== null) {
      nodes.push({
        kind: "heading",
        level: (heading[1] as string).length === 3 ? 3 : 4,
        text: heading[2] as string,
      });
      at += 1;
      continue;
    }

    if (line.trim() === "---") {
      nodes.push({ kind: "divider" });
      at += 1;
      continue;
    }

    const image = parseImage(line);
    if (image !== null) {
      nodes.push({ kind: "image", ...image });
      at += 1;
      continue;
    }

    if (line.startsWith("| ")) {
      const table = takeTable(lines, at);
      if (table !== null) {
        nodes.push({ kind: "comparison-table", headers: table.headers, rows: table.rows });
        at = table.next;
        continue;
      }
    }

    /*
      **チェックリストを箇条書きより先に見る。** `- [ ] ` は `- ` でも当たるので、
      順番を逆にするとチェックリストが箇条書きとして読まれ、印が消える。
    */
    if (CHECK_ITEM.test(line)) {
      const taken = takeWhile(lines, at, (l) => CHECK_ITEM.test(l));
      nodes.push({
        kind: "checklist",
        items: taken.taken.map(readCheckItem),
      });
      at = taken.next;
      continue;
    }

    if (/^[-*] /.test(line)) {
      const taken = takeWhile(lines, at, (l) => /^[-*] /.test(l) && !CHECK_ITEM.test(l));
      nodes.push({
        kind: "bullet-list",
        items: taken.taken.map((l) => unescapeItem(l.slice(2))),
      });
      at = taken.next;
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const taken = takeWhile(lines, at, (l) => /^\d+\. /.test(l));
      nodes.push({
        kind: "ordered-list",
        items: taken.taken.map((l) => unescapeItem(l.replace(/^\d+\. /, ""))),
      });
      at = taken.next;
      continue;
    }

    if (line.startsWith("> ")) {
      const taken = takeWhile(lines, at, (l) => l.startsWith("> "));
      nodes.push({ kind: "quote", text: taken.taken.map((l) => l.slice(2)).join("\n") });
      at = taken.next;
      continue;
    }

    const taken = takeWhile(lines, at, (l) => l.trim() !== "");
    nodes.push({ kind: "paragraph", text: unescapeParagraph(taken.taken.join("\n")) });
    at = taken.next;
  }

  return nodes;
}

const CHECK_ITEM = /^- \[[ xX]\] /;

function readCheckItem(line: string): ProseChecklistItem {
  return { text: line.slice(6), checked: line[3] !== " " };
}

function takeWhile(
  lines: readonly string[],
  from: number,
  keep: (line: string) => boolean,
): { readonly taken: readonly string[]; readonly next: number } {
  const taken: string[] = [];
  let at = from;
  while (at < lines.length && keep(lines[at] as string)) {
    taken.push(lines[at] as string);
    at += 1;
  }
  return { taken, next: at };
}

function findClose(lines: readonly string[], from: number): number | null {
  for (let at = from; at < lines.length; at += 1) {
    if ((lines[at] as string).trim() === ":::") return at;
  }
  return null;
}

function findCodeClose(lines: readonly string[], from: number, minimum: number): number | null {
  for (let at = from; at < lines.length; at += 1) {
    const line = (lines[at] as string).trim();
    if (/^`+$/.test(line) && line.length >= minimum) return at;
  }
  return null;
}

function parseDirective(header: string, body: readonly string[]): ProseNode | null {
  const named = /^:::([\w-]+)\s*(.*)$/.exec(header);
  if (named === null) return null;
  const attrs = parseAttrs(named[2] as string);
  const text = (lines: readonly string[]) => (
    attrs.body_escape === "1" ? unescapeDirectiveBody(lines) : lines.join("\n")
  );

  switch (named[1]) {
    case "callout":
      return {
        kind: "callout",
        tone: isTone(attrs.tone) ? attrs.tone : "info",
        title: attrs.title ?? "",
        text: text(body),
      };

    case "toggle":
      return { kind: "toggle", title: attrs.title ?? "", text: text(body) };

    case "product-card":
      if (body.some((line) => line.trim() !== "")) return null;
      return { kind: "product-card", productId: attrs.id ?? "" };

    case "table": {
      const table = takeTable(body, 0);
      /* 表の形をしていない `:::table` は読めない。段落として文字のまま残す。 */
      if (table === null || body.slice(table.next).some((line) => line.trim() !== "")) return null;
      return { kind: "table", headers: table.headers, rows: table.rows };
    }

    case "image-row": {
      const images: ProseImage[] = [];
      for (const line of body) {
        const image = parseImage(line);
        if (image === null) return null;
        images.push(image);
      }
      if (images.length === 0) return null;
      return { kind: "image-row", images };
    }

    case "embed":
      if (attrs.url === undefined || body.some((line) => line.trim() !== "")) return null;
      return { kind: "embed", url: attrs.url, title: attrs.title ?? "" };

    case "cta-button":
      if (attrs.href === undefined || body.some((line) => line.trim() !== "")) return null;
      return {
        kind: "cta-button",
        href: attrs.href,
        label: attrs.label ?? "",
        tone: isCtaTone(attrs.tone) ? attrs.tone : "action",
      };

    case "link-card":
      if (attrs.url === undefined || body.some((line) => line.trim() !== "")) return null;
      return {
        kind: "link-card",
        url: attrs.url,
        title: attrs.title ?? "",
        description: attrs.description ?? "",
      };

    case "columns": {
      const split = body.indexOf(COLUMNS_SPLIT);
      /* 区切りが無い 2 段組は、どこまでが左か決まらない。読めないものは通さない。 */
      if (split < 0) return null;
      return {
        kind: "columns",
        left: text(body.slice(0, split)),
        right: text(body.slice(split + 1)),
      };
    }

    default:
      /*
        知らない名前の囲みは `null` を返し、呼び出し側が段落として読み直す。
        **捨てない。**種類を増やしたあとで古い版のコードが読んだとき、
        黙って消えるより、記法が見えたまま残るほうが直せる (BE-PROSE-03)。
      */
      return null;
  }
}

function isTone(value: string | undefined): value is ProseCalloutTone {
  return value !== undefined && (CALLOUT_TONES as readonly string[]).includes(value);
}

function isCtaTone(value: string | undefined): value is ProseCtaTone {
  return value !== undefined && (CTA_TONES as readonly string[]).includes(value);
}

function splitRow(line: string): readonly string[] {
  const source = line.replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cell = "";

  for (let at = 0; at < source.length; at += 1) {
    const char = source[at] as string;
    if (char === "\\") {
      const next = source[at + 1];
      /* ここで定義した 2 種以外の `\x` は、手書きの文字として残す。 */
      if (next === "\\" || next === "|") {
        cell += next;
        at += 1;
        continue;
      }
      cell += char;
      continue;
    }
    if (char === "|") {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += char;
  }

  cells.push(cell.trim());
  return cells;
}

function takeTable(
  lines: readonly string[],
  from: number,
): {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly next: number;
} | null {
  const head = lines[from];
  if (head === undefined || !head.startsWith("| ")) return null;
  const rule = lines[from + 1];
  if (rule === undefined || !/^\|(\s*-{3,}\s*\|)+$/.test(rule.trim())) return null;

  const headers = splitRow(head);
  const rows: string[][] = [];
  let at = from + 2;
  while (at < lines.length && (lines[at] as string).startsWith("| ")) {
    rows.push([...splitRow(lines[at] as string)]);
    at += 1;
  }
  return { headers, rows, next: at };
}
