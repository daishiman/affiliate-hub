/**
 * ログインの要らない「静止した写し」を 1 枚の HTML に組み立てる。
 *
 * ここに置いてあるのは**組み立てだけ**で、描画も書き出しもしない。
 * 分けてあるのは、次の 1 点を検査で固定するためである。
 *
 *   **本物の CSS を読まずに書き出せてしまう経路が無いこと。**
 *
 * ここを固定しないと、次に焼いたときに中身が実物から離れても誰も気づかない。
 * 写しが実物とずれると、見てもらった詰まり具合が実物のものではなくなり、
 * 「見て決めた」という判断の土台そのものが崩れる。
 * だから空を受け取ったら**黙って空のまま焼かず、止まる**。
 *
 * 入口の門（middleware）はここでは何もしていない。これは動いているアプリを
 * 認証なしで見せる仕掛けではなく、**別に作った静止画**である。
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const ENTRY_CSS = "src/app/globals.css";

/** 押しても動かないことを、開いた人が最初に読む場所に置く。 */
export const STATIC_NOTE =
  "これは静止した写しです。押しても動きません。見た目（間隔・行の長さ・詰まり具合）を確かめるためだけの 1 枚で、アプリそのものではありません。";

/** 実物と違うと分かっているところ。隠すと「実物はこうだ」と読まれる。 */
export const KNOWN_DIFFERENCES = [
  "書体だけは端末の既定に落ちます（本物は配布している書体を読み込みます）。字の形は違いますが、行の高さと間隔はトークンの値どおりです。",
  "動きのあるもの（開閉・送信・切り替え）は止まっています。押しても何も起きません。",
];

/**
 * 中身を丸ごと包む札。押しても本当に何も起きない状態にする。
 *
 * 断り書きに「押しても動きません」と書くだけだと、案内の行き先が `/admin/...` の
 * ままなので、押した人には**ブラウザの「ファイルがありません」**が出る。
 * それは「動かない」ではなく「壊れている」と読まれる。`inert` を掛けておくと
 * 押す動作そのものが起きなくなり、断り書きの文が実際のふるまいと一致する。
 *
 * 古いブラウザは `inert` を無視するので、そのときだけ上の断りが効く。
 */
const INERT_ATTRIBUTE = "inert";

/**
 * `src` 以下の `*.module.css` を全部さがす。
 *
 * **一覧を手で書かない。** 手で書くと、新しく足した `.module.css` は
 * 書き足すまで写しに入らず、しかも入っていないことが見た目から分からない
 * （その部品だけ素の見た目で焼かれる）。さがして拾えば、足した時点で入る。
 *
 * @param {string} root リポジトリの根
 * @returns {string[]} 根からの相対パス（昇順）
 */
export function findModuleCss(root) {
  /** @type {string[]} */
  const found = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".module.css")) found.push(relative(root, full).split("\\").join("/"));
    }
  };
  walk(join(root, "src"));
  return found.sort();
}

/**
 * 本物の CSS と描画済みの中身を 1 枚に焼き、アプリが配らない `docs/` へ書き出す。
 * CSS の取得・安全判定・書き出し先の境界を全 writer で共有する。
 *
 * @param {object} input
 * @param {string} input.out
 * @param {string} input.bodyHtml
 * @param {Record<string, string>} input.htmlAttributes
 * @param {string} input.generatedAt
 * @param {string} [input.title]
 * @param {string} [input.source]
 * @param {string} [input.navHtml]
 * @param {string} [input.writtenLabel]
 * @returns {Promise<string>}
 */
export async function writeStaticPreview({
  out,
  bodyHtml,
  htmlAttributes,
  generatedAt,
  title,
  source,
  navHtml,
  writtenLabel,
}) {
  if (!out.startsWith("docs/")) {
    throw new Error(`静止した写しは docs/ 配下にだけ書き出せます: ${out}`);
  }

  const root = process.cwd();
  const docsRoot = resolve(root, "docs");
  const outputPath = resolve(root, out);
  const pathFromDocs = relative(docsRoot, outputPath);
  if (pathFromDocs === "" || pathFromDocs.startsWith(`..${sep}`) || isAbsolute(pathFromDocs)) {
    throw new Error(`静止した写しの出力先が docs/ の外を指しています: ${out}`);
  }

  const from = join(root, ENTRY_CSS);
  const result = await postcss([tailwind()]).process(readFileSync(from, "utf8"), { from });
  const html = buildDocument({
    tailwindCss: result.css,
    moduleCss: findModuleCss(root).map((path) => ({
      path,
      text: readFileSync(join(root, path), "utf8"),
    })),
    bodyHtml,
    htmlAttributes,
    generatedAt,
    title,
    source,
    navHtml,
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html);
  const suffix = writtenLabel === undefined ? "" : `（${writtenLabel}）`;
  console.log(`書き出しました: ${out}${suffix}`);
  return html;
}

/**
 * 1 枚の HTML を組み立てる。
 *
 * `tailwindCss` は本物の入口（`src/app/globals.css`）を本物の道具に通した結果、
 * `moduleCss` は `.module.css` の**本文そのまま**を渡すこと。
 * どちらかが空なら投げる。空のまま焼くと、見た目の無い写しが
 * 「これが実物です」という顔で残る。
 *
 * `title` と `navHtml` は写しが 1 枚から**冊子**になったときだけ要る。
 * `navHtml` は `inert` の**外**に置く。中に入れると、写しを渡した相手は
 * 隣のページへ移れず、冊子であることに気づかないまま 1 枚だけ見て帰る。
 *
 * @param {object} input
 * @param {string} input.tailwindCss
 * @param {readonly { readonly path: string, readonly text: string }[]} input.moduleCss
 * @param {string} input.bodyHtml
 * @param {Record<string, string>} input.htmlAttributes
 * @param {string} input.generatedAt
 * @param {string} [input.title] ページの題。省かれたら 1 枚ものの既定。
 * @param {string} [input.source] 書き出した writer のパス。
 * @param {string} [input.navHtml] 冊子の中を移る案内。`inert` の外に出す。
 * @returns {string}
 */
export function buildDocument({
  tailwindCss,
  moduleCss,
  bodyHtml,
  htmlAttributes,
  generatedAt,
  title,
  source = "scripts/write-static-preview.tsx",
  navHtml,
}) {
  if (tailwindCss.trim() === "") {
    throw new Error("トークンの CSS が空です。本物の CSS を読めていないまま焼こうとしています。");
  }
  if (moduleCss.length === 0) {
    throw new Error("部品の CSS が 1 つもありません。さがす先が違っている可能性があります。");
  }
  for (const sheet of moduleCss) {
    if (sheet.text.trim() === "") {
      throw new Error(`部品の CSS が空です: ${sheet.path}`);
    }
  }
  if (bodyHtml.trim() === "") {
    throw new Error("中身が空です。描けていないまま焼こうとしています。");
  }

  const attrs = Object.entries(htmlAttributes)
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join("");

  return [
    "<!doctype html>",
    `<html${attrs}>`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeText(title ?? DEFAULT_TITLE)}</title>`,
    `<!-- 生成物。${generatedAt} に ${source} が書き出した。手で直さない（次の書き出しで消える）。 -->`,
    "<style>",
    "/* ここから下は src/app/globals.css を本物の道具に通した結果。写しではない。 */",
    tailwindCss,
    "</style>",
    ...moduleCss.flatMap((sheet) => [
      "<style>",
      `/* ${sheet.path} の本文そのまま。名前を隠さないので選択子はファイルのまま当たる。 */`,
      sheet.text,
      "</style>",
    ]),
    "<style>",
    STATIC_NOTE_STYLE,
    "</style>",
    "</head>",
    "<body>",
    '<div class="static-note" role="note">',
    `<strong>${escapeText(STATIC_NOTE)}</strong>`,
    "<ul>",
    ...KNOWN_DIFFERENCES.map((line) => `<li>${escapeText(line)}</li>`),
    "</ul>",
    "</div>",
    // 冊子の案内だけは `inert` の外。中身は押せないが、隣のページへは移れる。
    ...(navHtml === undefined ? [] : ['<nav class="static-nav">', navHtml, "</nav>"]),
    `<div ${INERT_ATTRIBUTE}>`,
    bodyHtml,
    "</div>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/** 1 枚ものだったころの題。冊子の各ページは自分の題を渡す。 */
const DEFAULT_TITLE = "静止した写し — 案内の分類と、詰まり具合の見比べ";

/**
 * 断り書きと冊子案内の見た目。
 *
 * ここだけはトークンを使わず素の値で書いている。**断り書きは、
 * 見た目の仕組みが壊れていても読めなければならない**ためで、
 * トークンが読めていないときに一緒に消えると、
 * 「押しても動かない」という肝心の断りが見えないまま残る。
 * 冊子案内も同じ理由でここに置く。トークンごと消えると隣へ移れなくなる。
 */
const STATIC_NOTE_STYLE = `
.static-note {
  margin: 0;
  padding: 12px 16px;
  background: #fff4d6;
  color: #3a2c00;
  border-bottom: 1px solid #d8b23c;
  font-family: system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.7;
}
.static-note ul { margin: 6px 0 0; padding-left: 1.2em; }
.static-nav {
  margin: 0;
  padding: 10px 16px;
  background: #eef2f7;
  color: #1f2937;
  border-bottom: 1px solid #c7d2de;
  font-family: system-ui, sans-serif;
  font-size: 13px;
  line-height: 2;
}
.static-nav a { color: #1d4ed8; margin-right: 14px; }
.static-nav strong { margin-right: 10px; }
`;

/**
 * @param {string} value
 * @returns {string}
 */
function escapeAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
