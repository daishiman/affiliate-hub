import type { ReactElement } from "react";
import { renderToReadableStream } from "react-dom/server.browser";
import { JSDOM } from "jsdom";

/**
 * 画面と部品を実際に描いて、出てきたものを見る。
 *
 * 型が通ることと、必要なものが出ることは別である。
 * `rel="sponsored"` が消えても、見出しが `<div>` になっても、型は通る。
 * **だから出力そのものを見る。**
 *
 * ここで環境を jsdom に切り替えないのは、テストファイルごとに
 * 実行環境が分かれると「このファイルはどっちで動くのか」を毎回考えることになるため。
 * Node のまま描いて、必要なときだけこの関数の中で DOM を作る。
 *
 * 規範: docs/architecture/testing-architecture.md §8
 */

/**
 * サーバーコンポーネント（`async function`）も描ける描画。
 *
 * Next.js の画面は `async` なことが多く、`renderToStaticMarkup` にそのまま渡すと
 * Promise が描かれて中身が空になる。**空でも例外にならない**ので、
 * 気づかないまま「テストは通っているのに何も確かめていない」状態になりやすい。
 */
export async function renderMarkup(node: ReactElement | Promise<ReactElement>): Promise<string> {
  const resolved = await node;
  // `renderToStaticMarkup` は同期のため、中に `async` の部品が 1 つでもあると
  // 「A component suspended while responding to synchronous input」で落ちる。
  // 画面はほぼすべて中で await するので、流し込み方式でないと 1 枚も描けない。
  const stream = await renderToReadableStream(resolved);
  const html = await new Response(stream).text();
  if (html.trim() === "") {
    throw new Error(
      "描画結果が空です。サーバーコンポーネントを await せずに渡していないか確認してください。",
    );
  }
  return html;
}

/**
 * 画面（`page.tsx`）を経路から読み込んで描く。
 *
 * 1 枚ずつ手で import しない。書くと、画面を足すたびにテストを足す作業が発生し、
 * **足し忘れた画面だけが確認されないまま残る**（抜けるのはいつも新しい画面である）。
 * 経路の一覧から回すことで、画面を足した時点で自動的に検査対象に入る。
 */
export async function renderRoute(
  importPath: string,
  props: Record<string, unknown> = {},
): Promise<string> {
  const mod = (await import(/* @vite-ignore */ importPath)) as {
    default?: (p: unknown) => ReactElement | Promise<ReactElement>;
  };
  if (typeof mod.default !== "function") {
    throw new Error(`${importPath} が画面を既定の書き出しとして持っていません。`);
  }
  return renderMarkup(mod.default(props));
}

/** 描いた結果を DOM にする。要素を役割（role）や見出しで探すときに使う。 */
export async function renderDom(
  node: ReactElement | Promise<ReactElement>,
): Promise<{ document: Document; html: string; cleanup: () => void }> {
  const html = await renderMarkup(node);
  return { ...intoDom(html), html };
}

/** すでに文字列になっている HTML を DOM にする。 */
export function intoDom(html: string): { document: Document; cleanup: () => void } {
  const dom = new JSDOM(`<!doctype html><html lang="ja"><body>${html}</body></html>`);
  return {
    document: dom.window.document as unknown as Document,
    cleanup: () => dom.window.close(),
  };
}

/**
 * 文字だけを取り出す。
 *
 * 「この文言が出ているか」を HTML 文字列に対する `toContain` で見ると、
 * 属性値や class 名にたまたま同じ文字列があるだけで通ってしまう。
 */
export function textOf(html: string): string {
  const { document, cleanup } = intoDom(html);
  const text = document.body.textContent ?? "";
  cleanup();
  return text.replace(/\s+/g, " ").trim();
}

/**
 * キーボードだけで辿れる要素を、出てくる順に返す。
 *
 * マウスで押せることは確かめやすく、キーボードで辿れることは確かめにくい。
 * **確かめにくいほうが壊れる**ので、こちらを機械で見る。
 */
export function focusableOrder(document: Document): readonly string[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type=hidden])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  // `<label for="…">` は入力欄の**正式な名前**であり、読み上げもこれを読む。
  // ここで拾わないと、正しく名前の付いた欄まで「名前が無い」と見えてしまう。
  // id は React の `useId()` が作るため記号を含む。属性セレクタで引くと
  // 書き方によっては壊れるので、先に一覧を作って引き当てる。
  const byFor = new Map<string, string>();
  for (const label of document.querySelectorAll("label[for]")) {
    const target = label.getAttribute("for");
    if (target !== null) byFor.set(target, label.textContent?.trim() ?? "");
  }

  return [...document.querySelectorAll(selector)].map((el) => {
    // 空文字を「名前がある」と見なさない。`??` だけだと入力欄が必ず無名になる。
    const label =
      [
        el.getAttribute("aria-label"),
        byFor.get(el.getAttribute("id") ?? ""),
        el.closest("label")?.textContent?.trim(),
        el.textContent?.trim(),
        el.getAttribute("name"),
      ].find((candidate) => candidate !== null && candidate !== undefined && candidate !== "") ??
      el.tagName.toLowerCase();
    return `${el.tagName.toLowerCase()}:${label.slice(0, 40)}`;
  });
}

/** 見出しの階層を上から順に返す。飛び級（h2 の次が h4）を見つけるのに使う。 */
export function headingLevels(document: Document): readonly number[] {
  return [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((el) =>
    Number(el.tagName.slice(1)),
  );
}
