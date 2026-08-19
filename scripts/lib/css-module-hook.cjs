/**
 * `.css` の取り込みを、Node の上で**書き出しのためだけに**通す仕掛け。
 *
 * 画面の部品は `import styles from "./x.module.css"` の形で見た目を持ってくる。
 * これは束ね役（Next.js / Vite）が読み替える書き方なので、Node で直に動かすと落ちる。
 * ここでは `styles.navLink` を **`"navLink"` という名前そのもの**に読み替える。
 *
 * 名前を**変えない**のが要点である。読み替えた名前と、`.module.css` に書いてある
 * 選択子の名前が一致するので、**CSS の本文をそのまま貼れば当たる**。
 * 名前を作り変えると、貼る側でも作り変えることになり、そこが写し間違いの置き場になる。
 *
 * 本番の束ね役はこの仕掛けを通らない（そちらは名前を隠して衝突を防ぐ）。
 * ここが効くのは `scripts/write-static-preview.tsx` を走らせるときだけである。
 *
 * ```
 * node --require ./scripts/lib/css-module-hook.cjs …
 * ```
 *
 * CJS で書いてあるのは、`tsx` が `.tsx` を CommonJS に落として動かすためである
 * （ESM 側の読み替えの口は通らない）。
 */

/**
 * 読み込みの口を持っている `Module` そのもの。
 *
 * `require("node:module")` と書かないのは、書き方の検査が `require()` を
 * 止めているためである。**検査を外して通すより、外さずに済む書き方を採る。**
 * ここは CJS として読まれるので、いま読まれている `module` の生みの親が
 * その `Module` にあたる。
 */
const Module = module.constructor;

/**
 * 名前をそのまま返す身代わり。
 *
 * `__esModule` にだけ `undefined` を返すのは、取り込み側の橋渡しが
 * これを見て「ESM だ」と判断し、`.default` を取りに行ってしまうためである。
 * 文字列の `"__esModule"` を返すと真になるので、そこだけ穴を開けておく。
 */
const identity = new Proxy(
  {},
  {
    get(_target, key) {
      if (key === "__esModule") return undefined;
      if (key === "default") return identity;
      return typeof key === "string" ? key : undefined;
    },
  },
);

Module._extensions[".css"] = function loadCssAsIdentity(module) {
  module.exports = identity;
};
