"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  PROSE_COLOR_LABEL,
  PROSE_COLOR_TOKENS,
  type ProseColorToken,
  type ProseInline,
  type ProseMark,
  type ProseMarkKind,
  hasMark,
  isProseColorToken,
  parseInline,
  safeHref,
  serializeInline,
} from "@/domain/blogops";
import { Icon, type IconName } from "@/presentation/ui";
import { PickList } from "./pick-list";
import styles from "./prose.module.css";

/**
 * 装飾つきの文字を、出来上がりの形のまま書く欄 (FRONT-REQ-007・受け入れ A1)。
 *
 * ## なぜ `<textarea>` ではないのか
 *
 * 保存の形は拡張 Markdown の文字列なので、素の欄に出すと `**` や `~~` が
 * そのまま見える。**記法を知らない人はそれを本文だと思う。**実際、
 * 太字にしたつもりの行が読者の画面で `**大事**` と出る事故は、
 * 記法を出す欄では必ず起きる。だから欄には出来上がりを描き、
 * 記法は保存のときだけ組み立てる。
 *
 * ## 打っている間は React に触らせない
 *
 * `contenteditable` の中身を React の再描画で作り直すと、1 文字ごとに
 * DOM が入れ替わって**カーソルが先頭へ飛ぶ**。だからここは
 * 「自分が最後に出した値と外から来た値が同じなら、DOM を書き換えない」
 * という形にしてある。外から違う値が来たとき（他の操作で本文が入れ替わったとき）
 * だけ描き直す。
 *
 * ## 装飾の当て方
 *
 * `document.execCommand` は使わない。廃止予定であることに加え、
 * `<span data-token="accent">` のような**こちらで決めた印**を作れない。
 * 選択範囲を「本文の何文字目から何文字目か」へ直し、
 * `ProseInline[]` を組み直してから描き直す。
 */

/** 印を持つ要素の作り方。読み書きで同じ対応表を使う。 */
const COLOR_ATTR = "data-ink-color";
const BG_ATTR = "data-ink-bg";

const MARK_BUTTONS: readonly {
  readonly kind: Exclude<ProseMarkKind, "link" | "color" | "bg">;
  readonly icon: IconName;
  readonly label: string;
}[] = [
  { kind: "bold", icon: "inkBold", label: "太字" },
  { kind: "italic", icon: "inkItalic", label: "斜体" },
  { kind: "strike", icon: "inkStrike", label: "打ち消し" },
  { kind: "code", icon: "proseCode", label: "行内コード" },
];

export type RichTextProps = {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly ariaLabel: string;
  readonly placeholder: string;
  /** 改行を許すか。段落や見出しは 1 行、引用や注意書きは複数行。 */
  readonly multiline?: boolean;
  /** 欄そのものの見た目 (字の大きさなど)。 */
  readonly className?: string;
  /**
   * `/` を打ったときの知らせ。`/` の後ろの文字を渡す。
   * 渡さなければ `/` はただの文字として入る。
   */
  readonly onSlash?: (query: string) => void;
  readonly onSlashClosed?: () => void;
  readonly onSplit?: (before: string, after: string) => void;
};

export function RichText({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  multiline = false,
  className,
  onSlash,
  onSlashClosed,
  onSplit,
}: RichTextProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  /** 自分が最後に外へ出した値。外から来た値と同じなら DOM を触らない。 */
  const emitted = useRef(value);
  const [focused, setFocused] = useState(false);
  const barId = useId();
  const composing = useRef(false);
  const rememberedSelection = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (value === emitted.current && el.childNodes.length > 0) return;
    writeRuns(el, parseInline(value));
    emitted.current = value;
  }, [value]);

  function emit() {
    const el = ref.current;
    if (el === null || composing.current) return;
    const next = serializeInline(readRuns(el));
    emitted.current = next;
    onValueChange(next);
    if (onSlash !== undefined) {
      if (next.startsWith("/")) onSlash(next.slice(1));
      else onSlashClosed?.();
    }
  }

  /** 選んだ範囲へ印を当てる（すでに付いていれば外す）。 */
  function toggle(mark: ProseMark) {
    const el = ref.current;
    if (el === null) return;
    const span = selectionSpan(el) ?? rememberedSelection.current;
    if (span === null) return;
    const runs = readRuns(el);
    const next = applyMark(runs, span.start, span.end, mark);
    writeRuns(el, next);
    emitted.current = serializeInline(next);
    onValueChange(emitted.current);
    /* 当てたあとも選び直しが続けられるように、範囲を戻す。 */
    selectSpan(el, span.start, span.end);
    el.focus();
  }

  return (
    <div className={styles.richText}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}>
      {/*
        道具帯は欄に手が入っている間だけ出す。常に出しておくと、
        断片の数だけ帯が並んで本文が読めなくなる。
        `onMouseDown` で既定動作を止めるのは、押した瞬間に
        欄から手が外れて選択範囲が消えるのを防ぐため。
      */}
      {focused && (
        <div
          aria-label={`${ariaLabel}の飾り`}
          className={styles.richTextBar}
          id={barId}
          onMouseDown={(event) => {
            const el = ref.current;
            if (el) rememberedSelection.current = selectionSpan(el) ?? rememberedSelection.current;
            if ((event.target as HTMLElement).closest("button")) event.preventDefault();
          }}
          role="toolbar"
        >
          {MARK_BUTTONS.map((button) => (
            <button
              aria-label={button.label}
              className={styles.proseEditorIconButton}
              key={button.kind}
              onClick={() => toggle({ kind: button.kind })}
              title={button.label}
              type="button"
            >
              <Icon name={button.icon} size="sm" />
            </button>
          ))}
          <LinkButton onOpen={() => { if (ref.current) rememberedSelection.current = selectionSpan(ref.current); }} onApply={(href) => toggle({ kind: "link", href })} />
          <TokenPicker
            icon="inkColor"
            label="文字の色"
            onPick={(token) => toggle({ kind: "color", token })}
          />
          <TokenPicker
            icon="inkBg"
            label="地の色"
            onPick={(token) => toggle({ kind: "bg", token })}
          />
        </div>
      )}

      <div
        aria-label={ariaLabel}
        aria-multiline={multiline}
        className={[styles.richTextInput, className ?? ""].join(" ").trim()}
        contentEditable
        data-placeholder={placeholder}
        onInput={emit}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; emit(); }}
        onKeyDown={(e) => {
          /*
            1 行の欄では改行を作らせない。見出しの中で改行できると、
            保存のときに 2 つ目の行が黙って落ちる（記法に行の概念があるため）。
          */
          if (e.nativeEvent.isComposing || composing.current || e.keyCode === 229) return;
          if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "b" || e.key.toLowerCase() === "i")) {
            e.preventDefault(); toggle({ kind: e.key.toLowerCase() === "b" ? "bold" : "italic" });
          }
          if (e.key === "Enter" && !multiline) {
            e.preventDefault();
            if (onSplit && ref.current) {
              const el = ref.current;
              const selection = selectionSpan(el, true);
              const chars = toChars(readRuns(el));
              const start = selection?.start ?? chars.length;
              const end = selection?.end ?? start;
              onSplit(serializeInline(fromChars(chars.slice(0, start))), serializeInline(fromChars(chars.slice(end))));
            }
          }
        }}
        /*
          貼り付けは**素の文字だけ**受ける (受け入れ A2 / SEC-REQ-009)。
          よそから来た HTML をそのまま入れると、見出しや `style` が
          本文に紛れ込み、段の深さが編集操作で動くことになる。
        */
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          insertPlainText(text, multiline);
          emit();
        }}
        ref={ref}
        role="textbox"
        suppressContentEditableWarning
      />
    </div>
  );
}

function LinkButton({ onApply, onOpen }: { readonly onApply: (href: string) => void; readonly onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  if (!open) {
    return (
      <button
        aria-label="リンク"
        className={styles.proseEditorIconButton}
        onClick={() => { onOpen(); setOpen(true); }}
        title="リンク"
        type="button"
      >
        <Icon name="inkLink" size="sm" />
      </button>
    );
  }

  return (
    <span className={styles.richTextPopover}>
      {/*
        見える見出しを置く場所が無いので、名前は欄そのものが持つ。
        `<label>` を隠して置くと、押せる幅が 0 の見えない札が
        ボタンの間に挟まることになる。
      */}
      <input
        aria-label="リンクの行き先"
        className={styles.proseEditorSelect}
        id={inputId}
        ref={input}
        onChange={(e) => setHref(e.target.value)}
        placeholder="/s/... または https://..."
        type="text"
        value={href}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
          if (event.key === "Enter") { event.preventDefault(); if (safeHref(href) !== null) { onApply(href); setOpen(false); setHref(""); } }
        }}
      />
      <button
        className={styles.proseEditorMenuItem}
        /*
          通せない行き先はここで止める。あとで描画側も止めるが、
          **書いた直後に言われないと、運営者は何が悪いのか分からない。**
        */
        disabled={safeHref(href) === null}
        onClick={() => {
          onApply(href);
          setOpen(false);
          setHref("");
        }}
        type="button"
      >
        付ける
      </button>
      <button
        className={styles.proseEditorMenuItem}
        onClick={() => {
          setOpen(false);
          setHref("");
        }}
        type="button"
      >
        やめる
      </button>
    </span>
  );
}

function TokenPicker({
  icon,
  label,
  onPick,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly onPick: (token: ProseColorToken) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className={styles.richTextPopover}>
      <button
        aria-expanded={open}
        aria-label={label}
        className={styles.proseEditorIconButton}
        onClick={() => setOpen(!open)}
        title={label}
        type="button"
      >
        <Icon name={icon} size="sm" />
      </button>
      {open && (
        <PickList
          onPick={(token) => {
            onPick(token);
            setOpen(false);
          }}
          options={PROSE_COLOR_TOKENS.map((token) => ({
            key: token,
            label: PROSE_COLOR_LABEL[token],
            /* 色の名前だけだと、選ぶ前にどんな色か分からない。見本を添える。 */
            leading: <span className={styles.richTextSwatch} data-token={token} />,
          }))}
        />
      )}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   DOM と `ProseInline[]` の行き来
   --------------------------------------------------------------------------- */

/** 要素 1 つが表す印。印を持たない要素なら `null`。 */
function markOf(el: Element): ProseMark | null {
  const color = el.getAttribute(COLOR_ATTR);
  if (color !== null && isProseColorToken(color)) return { kind: "color", token: color };
  const bg = el.getAttribute(BG_ATTR);
  if (bg !== null && isProseColorToken(bg)) return { kind: "bg", token: bg };
  switch (el.tagName) {
    case "STRONG":
    case "B":
      return { kind: "bold" };
    case "EM":
    case "I":
      return { kind: "italic" };
    case "S":
    case "STRIKE":
    case "DEL":
      return { kind: "strike" };
    case "CODE":
      return { kind: "code" };
    case "A": {
      const href = el.getAttribute("href");
      return href === null ? null : { kind: "link", href };
    }
    default:
      return null;
  }
}

/** DOM を読んで走りの列に戻す。 */
function readRuns(root: HTMLElement): readonly ProseInline[] {
  const runs: ProseInline[] = [];

  function walk(node: Node, marks: readonly ProseMark[]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text !== "") runs.push({ text, marks });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (el.tagName === "BR") {
      runs.push({ text: "\n", marks: [] });
      return;
    }
    const mark = markOf(el);
    const next = mark === null ? marks : [...marks, mark];
    /*
      ブラウザは改行を `<div>` や `<p>` でも作る。ブロックの境目は
      改行 1 つとして数える（先頭のブロックだけは前に改行を置かない）。
    */
    if (BLOCKS.has(el.tagName) && runs.length > 0) {
      runs.push({ text: "\n", marks: [] });
    }
    for (const child of Array.from(el.childNodes)) walk(child, next);
  }

  for (const child of Array.from(root.childNodes)) walk(child, []);
  return runs;
}

const BLOCKS = new Set(["DIV", "P", "LI", "BLOCKQUOTE"]);

/** 走りの列から DOM を作る。`readRuns` の逆。 */
function writeRuns(root: HTMLElement, runs: readonly ProseInline[]): void {
  root.replaceChildren();
  for (const run of runs) {
    for (const [i, piece] of run.text.split("\n").entries()) {
      if (i > 0) root.appendChild(document.createElement("br"));
      if (piece === "") continue;
      root.appendChild(decorate(document.createTextNode(piece), run.marks));
    }
  }
}

function decorate(node: Node, marks: readonly ProseMark[]): Node {
  /* 印は外側から並んでいるので、内側から包む。 */
  let out = node;
  for (let i = marks.length - 1; i >= 0; i -= 1) {
    out = element(marks[i] as ProseMark, out);
  }
  return out;
}

function element(mark: ProseMark, child: Node): Node {
  switch (mark.kind) {
    case "bold":
      return wrapIn("strong", child);
    case "italic":
      return wrapIn("em", child);
    case "strike":
      return wrapIn("s", child);
    case "code":
      return wrapIn("code", child);
    case "link": {
      const safe = safeHref(mark.href);
      if (safe === null) return child;
      const a = document.createElement("a");
      a.setAttribute("href", safe);
      a.appendChild(child);
      return a;
    }
    case "color": {
      const span = document.createElement("span");
      span.setAttribute(COLOR_ATTR, mark.token);
      span.className = styles.proseInkColor ?? "";
      span.setAttribute("data-token", mark.token);
      span.appendChild(child);
      return span;
    }
    case "bg": {
      const span = document.createElement("span");
      span.setAttribute(BG_ATTR, mark.token);
      span.className = styles.proseInkBg ?? "";
      span.setAttribute("data-token", mark.token);
      span.appendChild(child);
      return span;
    }
  }
}

function wrapIn(tag: string, child: Node): Node {
  const el = document.createElement(tag);
  el.appendChild(child);
  return el;
}

/* ---------------------------------------------------------------------------
   選んだ範囲を文字の位置で扱う
   --------------------------------------------------------------------------- */

/** `root` の中の `(node, offset)` が、本文の何文字目かを返す。 */
function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  let count = 0;
  let found = -1;

  function walk(current: Node): boolean {
    if (current === node && current.nodeType === Node.TEXT_NODE) {
      found = count + offset;
      return true;
    }
    if (current.nodeType === Node.TEXT_NODE) {
      count += (current.textContent ?? "").length;
      return false;
    }
    if (current.nodeType !== Node.ELEMENT_NODE) return false;
    const el = current as Element;
    if (el.tagName === "BR") {
      count += 1;
      return false;
    }
    if (BLOCKS.has(el.tagName) && count > 0) count += 1;
    const children = Array.from(el.childNodes);
    for (const [i, child] of children.entries()) {
      if (current === node && i === offset) {
        found = count;
        return true;
      }
      if (walk(child)) return true;
    }
    if (current === node && offset >= children.length) {
      found = count;
      return true;
    }
    return false;
  }

  walk(root);
  return found === -1 ? count : found;
}

function selectionSpan(root: HTMLElement, allowCollapsed = false): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = offsetOf(root, range.startContainer, range.startOffset);
  const end = offsetOf(root, range.endContainer, range.endOffset);
  /*
    **範囲が無いときは当てない。**カーソルを置いただけで太字にすると、
    次に打つ文字が太字になる作りが要る。ここはそこまで持たない。
    範囲を選んでから押す、という 1 つの作法に揃える。
  */
  if (start === end && !allowCollapsed) return null;
  return start < end ? { start, end } : { start: end, end: start };
}

/** 文字の位置で範囲を選び直す。 */
function selectSpan(root: HTMLElement, start: number, end: number): void {
  const from = locate(root, start);
  const to = locate(root, end);
  if (from === null || to === null) return;
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function locate(root: HTMLElement, target: number): { node: Node; offset: number } | null {
  let count = 0;
  let last: { node: Node; offset: number } | null = null;

  function walk(current: Node): { node: Node; offset: number } | null {
    if (current.nodeType === Node.TEXT_NODE) {
      const length = (current.textContent ?? "").length;
      last = { node: current, offset: length };
      if (count + length >= target) return { node: current, offset: target - count };
      count += length;
      return null;
    }
    if (current.nodeType !== Node.ELEMENT_NODE) return null;
    const el = current as Element;
    if (el.tagName === "BR") {
      count += 1;
      return null;
    }
    if (BLOCKS.has(el.tagName) && count > 0) count += 1;
    for (const child of Array.from(el.childNodes)) {
      const hit = walk(child);
      if (hit !== null) return hit;
    }
    return null;
  }

  const hit = walk(root);
  return hit ?? last;
}

/* ---------------------------------------------------------------------------
   印の付け外し
   --------------------------------------------------------------------------- */

/** 走りの列を 1 文字ずつに開く。位置で切るにはこれがいちばん短い。 */
function toChars(runs: readonly ProseInline[]): { ch: string; marks: readonly ProseMark[] }[] {
  const out: { ch: string; marks: readonly ProseMark[] }[] = [];
  for (const run of runs) {
    // DOM Range offsets count UTF-16 units, including both halves of emoji.
    for (const ch of run.text.split("")) out.push({ ch, marks: run.marks });
  }
  return out;
}

function applyMark(
  runs: readonly ProseInline[],
  start: number,
  end: number,
  mark: ProseMark,
): readonly ProseInline[] {
  const chars = toChars(runs);
  const inRange = chars.slice(start, end);
  /*
    **範囲の全部に付いていたら外す。**一部にしか付いていないなら付ける。
    「押すたびに付いたり外れたり」ではなく「押せば揃う」ほうが、
    まだら模様の選択で迷わない。
  */
  const remove =
    inRange.length > 0 && inRange.every((c) => hasSame(c.marks, mark));

  for (let i = start; i < end && i < chars.length; i += 1) {
    const current = chars[i] as { ch: string; marks: readonly ProseMark[] };
    const without = current.marks.filter((m) => m.kind !== mark.kind);
    chars[i] = { ch: current.ch, marks: remove ? without : [...without, mark] };
  }
  return fromChars(chars);
}

function hasSame(marks: readonly ProseMark[], mark: ProseMark): boolean {
  if (!hasMark(marks, mark.kind)) return false;
  const found = marks.find((m) => m.kind === mark.kind);
  return JSON.stringify(found) === JSON.stringify(mark);
}

function fromChars(
  chars: readonly { ch: string; marks: readonly ProseMark[] }[],
): readonly ProseInline[] {
  const out: ProseInline[] = [];
  for (const char of chars) {
    const last = out[out.length - 1];
    if (last !== undefined && sameMarks(last.marks, char.marks)) {
      out[out.length - 1] = { text: last.text + char.ch, marks: last.marks };
    } else {
      out.push({ text: char.ch, marks: char.marks });
    }
  }
  return out;
}

function sameMarks(a: readonly ProseMark[], b: readonly ProseMark[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 素の文字を、いまのカーソル位置へ入れる。
 *
 * 貼り付けは必ずここを通る。**貼った側の HTML を持ち込まない**ので、
 * よその見出しや `style` が本文へ紛れることがない。
 */
function insertPlainText(text: string, multiline: boolean): void {
  const selection = window.getSelection();
  if (selection === null || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const clean = multiline ? text : text.replace(/\r?\n/g, " ");
  const fragment = document.createDocumentFragment();
  for (const [i, line] of clean.split("\n").entries()) {
    if (i > 0) fragment.appendChild(document.createElement("br"));
    if (line !== "") fragment.appendChild(document.createTextNode(line));
  }
  const tail = fragment.lastChild;
  range.insertNode(fragment);
  if (tail !== null) {
    range.setStartAfter(tail);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}
