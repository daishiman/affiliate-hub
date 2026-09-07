import { proseCodeFence } from "./prose-code-fence";

/**
 * 行の中の装飾 (inline mark)。
 *
 * ## なぜ断片ではないのか
 *
 * 太字・斜体・打ち消し・行内コード・リンク・文字色は、断片 (`ProseNode`) の
 * 種類ではなく**文字を持つ断片の内側**にある (FRONT-REQ-007)。
 *
 * 断片にすると 2 つ壊れる。19 種の枠を装飾が食うこと、そして
 * 「太字の中の箇条書き」という入れ子が生まれること。装飾は行の中で閉じる。
 *
 * ## 記法
 *
 * ```
 * 太字      **text**
 * 斜体      *text*
 * 打ち消し  ~~text~~
 * 行内コード `text`
 * リンク    [text](href)
 * 文字色    [text]{color=accent}
 * 背景色    [text]{bg=warn}
 * ```
 *
 * **色は名前でしか指定できない** (FRONT-REQ-007 / SEC-REQ-009)。
 * 色そのものの値 (`#` から始まる 6 桁の記法など) を受け取らないのは、2 つの理由による。
 *
 * 1. サイトのテーマを変えた日に、記事の中の文字だけが前のテーマの色で残る。
 * 2. 任意の値を通すと、そこが `style` 属性への注入口になる。
 *
 * ## 読めないものを捨てない
 *
 * 閉じていない `**` や、知らない属性は**そのままの文字**として通す。
 * 捨てると、運営者から見て「保存したら記号が消えた」ことになる。
 * `parseInline` は入力の文字を 1 つも落とさない (`prose-inline.test.ts`)。
 */

/**
 * 使える色の名前。**役割の名前であって色そのものではない。**
 *
 * `red` ではなく `danger` にしてあるのは、テーマによって危険の色が
 * 赤とは限らないためである。名前が役割なら、テーマを変えても意味は残る。
 */
export const PROSE_COLOR_TOKENS = [
  "accent",
  "action",
  "success",
  "warn",
  "danger",
  "muted",
] as const;
export type ProseColorToken = (typeof PROSE_COLOR_TOKENS)[number];

export function isProseColorToken(value: string): value is ProseColorToken {
  return (PROSE_COLOR_TOKENS as readonly string[]).includes(value);
}

/** 運営者へ見せる色の名前。 */
export const PROSE_COLOR_LABEL: Readonly<Record<ProseColorToken, string>> = {
  accent: "強調",
  action: "誘導",
  success: "良い知らせ",
  warn: "注意",
  danger: "警告",
  muted: "控えめ",
};

export type ProseMark =
  | { readonly kind: "bold" }
  | { readonly kind: "italic" }
  | { readonly kind: "strike" }
  | { readonly kind: "code" }
  | { readonly kind: "link"; readonly href: string }
  | { readonly kind: "color"; readonly token: ProseColorToken }
  | { readonly kind: "bg"; readonly token: ProseColorToken };

/** 装飾が同じ、ひと続きの文字。 */
export type ProseInline = {
  readonly text: string;
  readonly marks: readonly ProseMark[];
};

export type ProseMarkKind = ProseMark["kind"];

export function hasMark(marks: readonly ProseMark[], kind: ProseMarkKind): boolean {
  return marks.some((mark) => mark.kind === kind);
}

/**
 * 包む順。外側から内側へ。
 *
 * **順を固定しないと、同じ見た目から別の文字列が出る。** `**[a](x)**` と
 * `[**a**](x)` は読者には同じもので、順が入力ごとに違うと、
 * 保存を押すたびに差分が生まれる。読み込んだ時点でこの順へ揃える。
 */
const MARK_ORDER: readonly ProseMarkKind[] = [
  "link",
  "bg",
  "color",
  "bold",
  "italic",
  "strike",
  "code",
];

function sortMarks(marks: readonly ProseMark[]): readonly ProseMark[] {
  return [...marks].sort(
    (a, b) => MARK_ORDER.indexOf(a.kind) - MARK_ORDER.indexOf(b.kind),
  );
}

/*
  書き出すときに逃がす文字。
  **`(` `)` `{` `}` を入れない。**丸括弧は日本語の本文に普通に出てくるうえ、
  逃がす必要があるのは `[...]` の直後に来たときだけで、そこは `[` を
  逃がした時点でもう記法として読まれない。
*/
const INLINE_ESCAPE = /[\\*~`[\]]/g;

function escapeInline(text: string): string {
  return text.replace(INLINE_ESCAPE, (hit) => `\\${hit}`);
}

/** リンク先の構造記号は逃がし、手書きの入れ子括弧も読める形にする。 */
function escapeLinkHref(href: string): string {
  return href.replace(/[\\()]/g, (hit) => `\\${hit}`);
}

function unescapeLinkHref(href: string): string {
  return href.replace(/\\([\\()])/g, "$1");
}

/** 断片の並びを、保存される 1 行の文字列に戻す。 */
export function serializeInline(runs: readonly ProseInline[]): string {
  return mergeRuns(runs.map((run) => ({ ...run, marks: sortMarks(run.marks) })))
    .map(serializeRun)
    .join("");
}

const FENCE_KINDS: readonly ProseMarkKind[] = ["bold", "italic", "strike"];

function serializeRun(run: ProseInline): string {
  /*
    **囲みの内側の端に空白を残さない。**`** 大事 **` は読み込む側が
    装飾として読まない (空白に挟まれた記号は合図にしない)。
    書く側で空白を囲みの外へ出しておけば、選んだ範囲に空白が
    紛れていても記号が文字として表に出ない。
  */
  const fenced = run.marks.some((mark) => FENCE_KINDS.includes(mark.kind));
  const lead = fenced ? (/^\s*/.exec(run.text)?.[0] ?? "") : "";
  const trail =
    fenced && run.text.trim() !== "" ? (/\s*$/.exec(run.text)?.[0] ?? "") : "";
  const core = run.text.slice(lead.length, run.text.length - trail.length);
  if (core === "") return escapeInline(run.text);

  /*
    **行内コードの中身は逃がさない。**逃がすと、コードとして見せたい
    `**` が `\*\*` になって読者へ出る。囲みが位置で守っている。
  */
  let out = hasMark(run.marks, "code") ? core : escapeInline(core);

  /*
    包む順を固定する。並びが入力ごとに変わると、同じ見た目から
    別の文字列が出て、保存のたびに差分が生まれる。
    内側から: code → strike → italic → bold → color/bg → link。
  */
  for (const mark of run.marks) {
    if (mark.kind === "code") {
      const fence = proseCodeFence(out, 1);
      const padding = fence.length > 1 && (out.startsWith("`") || out.endsWith("`") ||
        (out.startsWith(" ") && out.endsWith(" ") && out.trim() !== ""));
      out = `${fence}${padding ? " " : ""}${out}${padding ? " " : ""}${fence}`;
    }
  }
  for (const mark of run.marks) {
    if (mark.kind === "strike") out = `~~${out}~~`;
  }
  for (const mark of run.marks) {
    if (mark.kind === "italic") out = `*${out}*`;
  }
  for (const mark of run.marks) {
    if (mark.kind === "bold") out = `**${out}**`;
  }

  const color = run.marks.find((mark) => mark.kind === "color");
  const bg = run.marks.find((mark) => mark.kind === "bg");
  if (color !== undefined || bg !== undefined) {
    const attrs = [
      color === undefined ? null : `color=${(color as { token: string }).token}`,
      bg === undefined ? null : `bg=${(bg as { token: string }).token}`,
    ].filter((attr): attr is string => attr !== null);
    out = `[${out}]{${attrs.join(" ")}}`;
  }

  const link = run.marks.find((mark) => mark.kind === "link");
  if (link !== undefined) out = `[${out}](${escapeLinkHref((link as { href: string }).href)})`;

  return `${escapeInline(lead)}${out}${escapeInline(trail)}`;
}

/** 保存されている 1 行の文字列を、装飾つきの並びにする。 */
export function parseInline(source: string): readonly ProseInline[] {
  const runs = parseRuns(source, []).map((run) => ({
    text: run.text,
    marks: sortMarks(run.marks),
  }));
  return mergeRuns(runs);
}

/**
 * 装飾を落として素の文字だけにする。
 *
 * 目次・要約・検索の見出しなど、**記法が見えてはいけない場所**で使う。
 */
export function plainInline(source: string): string {
  return parseInline(source)
    .map((run) => run.text)
    .join("");
}

function mergeRuns(runs: readonly ProseInline[]): readonly ProseInline[] {
  const out: ProseInline[] = [];
  for (const run of runs) {
    if (run.text === "") continue;
    const last = out[out.length - 1];
    if (last !== undefined && sameMarks(last.marks, run.marks)) {
      out[out.length - 1] = { text: last.text + run.text, marks: last.marks };
      continue;
    }
    out.push(run);
  }
  return out;
}

function sameMarks(a: readonly ProseMark[], b: readonly ProseMark[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((mark, i) => JSON.stringify(mark) === JSON.stringify(b[i]));
}

function parseRuns(source: string, marks: readonly ProseMark[]): readonly ProseInline[] {
  const out: ProseInline[] = [];
  let buffer = "";
  let at = 0;

  function flush() {
    if (buffer !== "") {
      out.push({ text: buffer, marks });
      buffer = "";
    }
  }

  while (at < source.length) {
    const ch = source[at] as string;

    if (ch === "\\" && /[\\*~`[\]]/.test(source[at + 1] ?? "")) {
      buffer += source[at + 1] as string;
      at += 2;
      continue;
    }

    /*
      行内コードだけは中身を読み直さない。**コードの中の `**` は太字ではない。**
      読み直すと、書いた人が見せたい記号が装飾として消える。
    */
    const code = ch === "`" ? takeCode(source, at) : null;
    if (code !== null && !hasMark(marks, "code")) {
      flush();
      out.push({ text: code.text, marks: [...marks, { kind: "code" }] });
      at = code.next;
      continue;
    }

    const combined = takeFence(source, at, "***", marks, ["bold", "italic"]);
    if (combined !== null) {
      flush();
      out.push(...combined.runs);
      at = combined.next;
      continue;
    }

    const fence = takeFence(source, at, "**", marks, ["bold"]);
    if (fence !== null) {
      flush();
      out.push(...fence.runs);
      at = fence.next;
      continue;
    }

    const strike = takeFence(source, at, "~~", marks, ["strike"]);
    if (strike !== null) {
      flush();
      out.push(...strike.runs);
      at = strike.next;
      continue;
    }

    const italic = takeFence(source, at, "*", marks, ["italic"]);
    if (italic !== null) {
      flush();
      out.push(...italic.runs);
      at = italic.next;
      continue;
    }

    if (ch === "[") {
      const bracket = takeBracket(source, at, marks);
      if (bracket !== null) {
        flush();
        out.push(...bracket.runs);
        at = bracket.next;
        continue;
      }
    }

    buffer += ch;
    at += 1;
  }

  flush();
  return out;
}

/** 行内コードの囲みは同じ長さの連続記号で閉じる。中身は再解析しない。 */
function takeCode(source: string, at: number): { text: string; next: number } | null {
  const fence = /^`+/.exec(source.slice(at))?.[0];
  if (fence === undefined) return null;
  const pattern = /`+/g;
  pattern.lastIndex = at + fence.length;
  let match = pattern.exec(source);
  while (match !== null) {
    if (match[0].length === fence.length) {
      const text = source.slice(at + fence.length, match.index);
      const padded = fence.length > 1 && text.startsWith(" ") && text.endsWith(" ") && text.trim() !== "";
      return { text: padded ? text.slice(1, -1) : text, next: match.index + fence.length };
    }
    match = pattern.exec(source);
  }
  return null;
}

function takeFence(
  source: string,
  at: number,
  fence: string,
  marks: readonly ProseMark[],
  kinds: readonly ("bold" | "strike" | "italic")[],
): { readonly runs: readonly ProseInline[]; readonly next: number } | null {
  if (!source.startsWith(fence, at)) return null;
  if (kinds.some((kind) => hasMark(marks, kind))) return null;
  /* `**` を `*` として読み始めない。長い囲みが先に当たる順で呼んでいる。 */
  if (fence === "*" && source.startsWith("**", at)) return null;

  /*
    **空白に挟まれた記号は装飾の合図にしない。**「2 * 3 * 4」は掛け算であって
    斜体ではない。開きの直後と閉じの直前が空白でないことを要求する
    (Markdown の left/right-flanking と同じ考え方)。これが無いと、
    数式や記号の混じった本文が、保存した瞬間に記号ごと消える。
  */
  const after = source[at + fence.length];
  if (after === undefined || /\s/.test(after)) return null;

  const nestedMarks = [...marks, ...kinds.map((kind) => ({ kind }))];
  const close = findFence(source, at + fence.length, fence, nestedMarks);
  if (close === null) return null;
  /* 中身が空の囲みは記法として読まない。`****` は文字として残す。 */
  if (close === at + fence.length) return null;

  return {
    runs: parseRuns(source.slice(at + fence.length, close), nestedMarks),
    next: close + fence.length,
  };
}

function findFence(
  source: string,
  from: number,
  fence: string,
  marks: readonly ProseMark[],
): number | null {
  for (let at = from; at < source.length; at += 1) {
    if (source[at] === "\\") {
      at += 1;
      continue;
    }
    if (source[at] === "`") {
      const code = takeCode(source, at);
      if (code !== null) {
        at = code.next - 1;
        continue;
      }
    }
    // 部分的な入れ子では、内側の閉じ記号を外側の閉じとして数えない。
    const nested = fence === "**" && source[at] === "*" && !source.startsWith("**", at)
      ? takeFence(source, at, "*", marks, ["italic"])
      : fence === "*" && source.startsWith("**", at) && !source.startsWith("***", at)
        ? takeFence(source, at, "**", marks, ["bold"])
        : null;
    if (nested !== null) {
      at = nested.next - 1;
      continue;
    }
    /* 閉じの直前が空白なら、それは閉じではない (開きと同じ理由)。 */
    if (source.startsWith(fence, at) && !/\s/.test(source[at - 1] ?? "")) return at;
  }
  return null;
}

function takeBracket(
  source: string,
  at: number,
  marks: readonly ProseMark[],
): { readonly runs: readonly ProseInline[]; readonly next: number } | null {
  const close = findClosingBracket(source, at + 1);
  if (close === null) return null;
  const inner = source.slice(at + 1, close);

  if (source[close + 1] === "(") {
    const end = findClosingParenthesis(source, close + 2);
    if (end === null) return null;
    const href = unescapeLinkHref(source.slice(close + 2, end));
    if (hasMark(marks, "link")) return null;
    return {
      runs: parseRuns(inner, [...marks, { kind: "link", href }]),
      next: end + 1,
    };
  }

  if (source[close + 1] === "{") {
    const end = source.indexOf("}", close + 2);
    if (end < 0) return null;
    const added = readColorAttrs(source.slice(close + 2, end), marks);
    /*
      **知らない属性は記法として読まない。**`{id=x}` を色として通すと、
      属性の綴りを間違えた本文が黙って色付きになる。読めないものは文字に戻す。
    */
    if (added === null) return null;
    return { runs: parseRuns(inner, [...marks, ...added]), next: end + 1 };
  }

  return null;
}

/**
 * リンク先を閉じる丸括弧。入れ子の深さを数え、逃がした括弧は構造にしない。
 */
function findClosingParenthesis(source: string, from: number): number | null {
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

function findClosingBracket(source: string, from: number): number | null {
  let depth = 0;
  for (let at = from; at < source.length; at += 1) {
    const ch = source[at];
    if (ch === "\\") {
      at += 1;
      continue;
    }
    if (ch === "`") {
      const code = takeCode(source, at);
      if (code !== null) {
        at = code.next - 1;
        continue;
      }
    }
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      if (depth === 0) return at;
      depth -= 1;
    }
  }
  return null;
}

function readColorAttrs(
  source: string,
  marks: readonly ProseMark[],
): readonly ProseMark[] | null {
  const added: ProseMark[] = [];
  const parts = source.trim().split(/\s+/).filter((part) => part !== "");
  if (parts.length === 0) return null;

  for (const part of parts) {
    const hit = /^(color|bg)=([\w-]+)$/.exec(part);
    if (hit === null) return null;
    const token = hit[2] as string;
    if (!isProseColorToken(token)) return null;
    const kind = hit[1] === "color" ? "color" : "bg";
    if (hasMark(marks, kind) || added.some((mark) => mark.kind === kind)) return null;
    added.push({ kind, token });
  }
  return added;
}
