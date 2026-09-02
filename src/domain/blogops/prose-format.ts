/**
 * 本文の断片と、保存される文字列の相互変換。
 *
 * ## 不変条件
 *
 * **`parseProse(serializeProse(nodes))` は `nodes` と一致する。**
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
 * 段落      そのまま (空行で区切る)
 * 小見出し  ### text  /  #### text
 * 箇条書き  - item
 * 番号付き  1. item
 * 引用      > text
 * 区切り線  ---
 * 画像      ![alt](src)
 * 比較表    | 見出し | 見出し |     ← Markdown の表そのもの
 *           | --- | --- |
 *           | 値 | 値 |
 * 注意書き  :::callout tone=info title="題"
 *           本文
 *           :::
 * 商品カード :::product-card id="pc_xxx"
 *           :::
 * ```
 *
 * ## 素の文章はそのまま読める
 *
 * 記法を 1 つも使っていない文字列は、段落だけの本文として読める。
 * **既存の記事を移行しなくてよい**のはこのためである。
 */

import { CALLOUT_TONES, type ProseCalloutTone, type ProseNode } from "./prose-node";

/*
  行頭がこれらで始まる段落は、そのまま書くと別の断片として読み直される。
  書き出すときに `\` を前へ足し、読み込むときに外す。

  **エスケープを段落だけに効かせる。**注意書きの中身にも同じ危険はあるが、
  そちらは `:::` の内側という位置で守られている。位置で守れるものへ
  記号の逃がし方を二重に入れると、どちらが効いているか分からなくなる。
*/
const PARAGRAPH_ESCAPE = /^(\\|#{1,6} |[-*] |\d+\. |> |:::|\||---$)/;

function escapeParagraph(text: string): string {
  return text
    .split("\n")
    .map((line) => (PARAGRAPH_ESCAPE.test(line) ? `\\${line}` : line))
    .join("\n");
}

function unescapeParagraph(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.startsWith("\\") ? line.slice(1) : line))
    .join("\n");
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

/** 断片の配列を、保存する 1 本の文字列にする。 */
export function serializeProse(nodes: readonly ProseNode[]): string {
  return nodes.map(serializeNode).join("\n\n");
}

function serializeNode(node: ProseNode): string {
  switch (node.kind) {
    case "paragraph":
      return escapeParagraph(node.text);
    case "heading":
      return `${"#".repeat(node.level)} ${node.text}`;
    case "bullet-list":
      return node.items.map((item) => `- ${item}`).join("\n");
    case "ordered-list":
      return node.items.map((item, i) => `${i + 1}. ${item}`).join("\n");
    case "quote":
      return node.text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "divider":
      return "---";
    case "image":
      return `![${node.alt}](${node.src})`;
    case "comparison-table": {
      const head = `| ${node.headers.join(" | ")} |`;
      const rule = `| ${node.headers.map(() => "---").join(" | ")} |`;
      const body = node.rows.map((row) => `| ${row.join(" | ")} |`);
      return [head, rule, ...body].join("\n");
    }
    case "callout":
      return [
        `:::callout tone=${node.tone} title=${quoteAttr(node.title)}`,
        node.text,
        ":::",
      ].join("\n");
    case "product-card":
      return [`:::product-card id=${quoteAttr(node.productId)}`, ":::"].join("\n");
  }
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

    const image = /^!\[([^\]]*)\]\(([^)]*)\)$/.exec(line);
    if (image !== null) {
      nodes.push({ kind: "image", alt: image[1] as string, src: image[2] as string });
      at += 1;
      continue;
    }

    if (line.startsWith("| ")) {
      const table = takeTable(lines, at);
      if (table !== null) {
        nodes.push(table.node);
        at = table.next;
        continue;
      }
    }

    if (/^[-*] /.test(line)) {
      const taken = takeWhile(lines, at, (l) => /^[-*] /.test(l));
      nodes.push({
        kind: "bullet-list",
        items: taken.taken.map((l) => l.slice(2)),
      });
      at = taken.next;
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const taken = takeWhile(lines, at, (l) => /^\d+\. /.test(l));
      nodes.push({
        kind: "ordered-list",
        items: taken.taken.map((l) => l.replace(/^\d+\. /, "")),
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

function parseDirective(header: string, body: readonly string[]): ProseNode | null {
  const named = /^:::([\w-]+)\s*(.*)$/.exec(header);
  if (named === null) return null;
  const attrs = parseAttrs(named[2] as string);

  if (named[1] === "callout") {
    const tone = attrs.tone;
    return {
      kind: "callout",
      tone: isTone(tone) ? tone : "info",
      title: attrs.title ?? "",
      text: body.join("\n"),
    };
  }

  if (named[1] === "product-card") {
    return { kind: "product-card", productId: attrs.id ?? "" };
  }

  /*
    知らない名前の囲みは `null` を返し、呼び出し側が段落として読み直す。
    **捨てない。**種類を増やしたあとで古い版のコードが読んだとき、
    黙って消えるより、記法が見えたまま残るほうが直せる。
  */
  return null;
}

function isTone(value: string | undefined): value is ProseCalloutTone {
  return value !== undefined && (CALLOUT_TONES as readonly string[]).includes(value);
}

function splitRow(line: string): readonly string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function takeTable(
  lines: readonly string[],
  from: number,
): { readonly node: ProseNode; readonly next: number } | null {
  const rule = lines[from + 1];
  if (rule === undefined || !/^\|(\s*-{3,}\s*\|)+$/.test(rule.trim())) return null;

  const headers = splitRow(lines[from] as string);
  const rows: string[][] = [];
  let at = from + 2;
  while (at < lines.length && (lines[at] as string).startsWith("| ")) {
    rows.push([...splitRow(lines[at] as string)]);
    at += 1;
  }
  return { node: { kind: "comparison-table", headers, rows }, next: at };
}
