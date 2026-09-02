/**
 * `custom-html-slot` に貼られた HTML を、描いてよい形だけに削る。
 *
 * ==========================================================================
 * なぜ「読む側」ではなく「入口」で削るのか
 * ==========================================================================
 *
 * サイドバーの 2 つの枠 (`custom-html-slot-upper` / `-lower`) は、運営者が
 * 自分で HTML を貼れる場所である。**貼れる場所は、貼った人の意図と関係なく
 * 危ない。** 運営者の端末が乗っ取られた日、あるいは権限を持つ人が 1 人増えた日、
 * ここは読者全員のブラウザで走るコードの入口になる。
 *
 * 削る場所は 2 つ考えられる:
 *
 * - **読むとき (描画の直前)** — 描く場所が増えるたびに、削り忘れが 1 か所ずつ増える。
 *   忘れても画面は正しく見えるので、**忘れたことに気づく機会が無い。**
 * - **書くとき (保存の直前)** — 保存されている値が常に安全なので、**あとから
 *   描く場所が何か所増えても穴が開かない。**
 *
 * 後者を採る。代償は、**削った結果しか残らない**こと (元の入力は復元できない)。
 * これは許容する: 復元できるということは、危ない文字列を保管し続けるということで、
 * それは「入口で落とす」を選んだ意味を消す。
 *
 * ==========================================================================
 * この実装が守っていること
 * ==========================================================================
 *
 * 1. **知らないタグは、タグとしては消し、中の文字は残す。** 消すと運営者は
 *    「なぜ文が消えたのか」が分からない。文字が残れば気づける。
 * 2. **`<script>` と `<style>` だけは中身ごと消す。** ここの中身は文ではなく命令で、
 *    残すと画面に命令がそのまま出る。
 * 3. **`on...` で始まる属性は、全部落とす。** 一覧で挙げて漏らすより、
 *    接頭辞で落とす方が安全側に倒れる (新しい `on...` が増えても自動で塞がる)。
 * 4. **行き先 (`href` / `src`) は `http` `https` `mailto` だけ。** `javascript:` と
 *    `data:` は落とす。**大文字小文字と空白・制御文字を潰してから判定する**
 *    (`java\tscript:` のような書き方で抜けられないように)。
 *
 * ==========================================================================
 * これが守っていないこと (書いておく)
 * ==========================================================================
 *
 * **これは完全な HTML パーサではない。** 壊れた入れ子や、仕様の隅にある書き方は
 * 正しく解けない。許可した一覧が小さく、属性の値を必ず引用符で囲み直すことで
 * 安全側に倒しているが、**許可一覧を広げるほどこの前提は弱くなる。**
 * 一覧を増やすときは、増やす人がこの段落を読んでから増やすこと。
 */

/** 中身ごと消すタグ。ここに並ぶものだけは、開始から終了までを丸ごと落とす。 */
const DROP_WITH_CONTENT = ["script", "style", "iframe", "object", "embed", "template"] as const;

/** 行き先として通してよい scheme。 */
const SAFE_SCHEMES = ["http:", "https:", "mailto:"] as const;

/**
 * 描いてよいタグと、そのタグで残してよい属性。
 *
 * **狭い側に倒してある。**増やすのは 1 行だが、減らすのは既に貼られたものを
 * 壊すので難しい。だから「無いと困る」と言われてから増やす。
 *
 * 選んだ理由:
 *
 * - **文の飾り** (`strong` `em` `b` `i` `u` `s` `br` `p` `span` `small`) は属性 0 個。
 *   飾りに属性は要らない。`class` を許すと画面側の見た目の決まりを
 *   運営者が上書きでき、**色や余白の直書き禁止 (REQ-TS09) が枠の中だけ効かなくなる。**
 * - **段落と一覧** (`ul` `ol` `li` `hr` `h3` `h4`) は属性 0 個。
 *   見出しは `h3` から。枠はページの中の部品なので、`h1` `h2` を許すと
 *   ページ全体の見出しの段が壊れて読み上げが狂う。
 * - **リンク** (`a`) は `href` `title` `rel` `target`。**`target` と `rel` は一組で残す。**
 *   `target="_blank"` だけを残すと、開いた先から元のページを触られる
 *   (`window.opener`)。片方だけ残すのが一番危ない。
 * - **画像** (`img`) は `src` `alt` `width` `height` `loading`。`src` を残すなら
 *   `alt` も残す (無いと読み上げで無音になる)。`width`/`height` は
 *   読み込み中に紙面が飛び跳ねるのを止めるため。
 *
 * 入れていないもの:
 *
 * - **`table` 系** — 枠は幅が狭い。表は横にはみ出して、狭い画面で必ず崩れる。
 *   表が要るなら記事の本文側の部品として作る (枠に貼らせない)。
 * - **`form` `input` `button`** — 枠から情報を集める道を作らない。
 *   集めるなら、集めた先が明示された仕組みとして作る。
 * - **`style` 属性** — 上の `class` と同じ理由。見た目の正本は 1 か所に置く。
 */
export const ALLOWED_HTML: Readonly<Record<string, readonly string[]>> = {
  // 文の飾り
  strong: [],
  em: [],
  b: [],
  i: [],
  u: [],
  s: [],
  br: [],
  p: [],
  span: [],
  small: [],
  // 段落・一覧・見出し
  ul: [],
  ol: [],
  li: [],
  hr: [],
  h3: [],
  h4: [],
  blockquote: [],
  // 行き先を持つもの
  a: ["href", "title", "rel", "target"],
  img: ["src", "alt", "width", "height", "loading"],
};

/** 属性値・本文に出てよい形へ逃がす。 */
function escapeText(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 空白・制御文字を潰してから scheme を見る。`java\tscript:` で抜けられないように。 */
function hasSafeScheme(value: string): boolean {
  const squeezed = value.replace(/[\u0000-\u0020\u007f-\u00a0]/g, "").toLowerCase();
  if (!squeezed.includes(":")) return true; // 相対の道。行き先は同じサイトの中。
  return SAFE_SCHEMES.some((scheme) => squeezed.startsWith(scheme));
}

/** 1 つのタグの属性列を、残してよいものだけに削る。 */
function keepAttributes(tagName: string, rawAttributes: string): string {
  /*
    **`?? []` を足さない。**この関数は、呼ぶ側が `ALLOWED_HTML[tagName] !== undefined`
    を確かめたあとにしか呼ばれない（`sanitizeSlotHtml` の 3.）。ここでもう一度
    確かめる形は、丁寧に見えて**どんな入力でも右辺へ到達しない枝**を作る。

    到達しない枝は分岐の分母だけを増やし、「テストが薄い」という顔をして
    層のカバレッジを押し下げる。守りを足したつもりで、測り方を壊している。
    呼ぶ側で確かめる、という置き場所のほうを正本にする。
  */
  const allowed = ALLOWED_HTML[tagName] as readonly string[];
  if (allowed.length === 0) return "";

  const kept: string[] = [];
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  for (const match of rawAttributes.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    // 3 つは二重引用符・一重引用符・引用符なしで、式が **どれか 1 つを必ず** 埋める。
    // だから末尾に `?? ""` を置かない（置くと到達しない枝が 1 本増える）。
    const value = (match[3] ?? match[4] ?? match[5]) as string;
    // `on...` は一覧に入っていても落とす (二重の留め。一覧の書き間違いを事故にしない)。
    if (name.startsWith("on")) continue;
    if (!allowed.includes(name)) continue;
    if ((name === "href" || name === "src") && !hasSafeScheme(value)) continue;
    kept.push(`${name}="${escapeText(value)}"`);
  }
  return kept.length === 0 ? "" : ` ${kept.join(" ")}`;
}

/**
 * 貼られた HTML を、描いてよい形だけに削る。
 *
 * **保存の直前に呼ぶ。**描画の直前ではない (上の説明のとおり)。
 */
export function sanitizeSlotHtml(raw: string): string {
  let work = raw;

  // 1. 中身ごと消すもの。終了タグが無い場合は、そこから末尾まで落とす。
  for (const tag of DROP_WITH_CONTENT) {
    work = work.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}\\s*>`, "gi"), "");
    work = work.replace(new RegExp(`<${tag}\\b[\\s\\S]*$`, "i"), "");
  }

  // 2. コメントは落とす (条件付きコメントで分岐を書ける処理系がある)。
  work = work.replace(/<!--[\s\S]*?-->/g, "");

  // 3. 残ったタグを 1 つずつ見る。
  return work.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>?/g,
    (whole: string, name: string, attributes: string) => {
      const tagName = name.toLowerCase();
      if (ALLOWED_HTML[tagName] === undefined) {
        // 知らないタグ。**タグとしては消し、書かれていた文字は残す。**
        return escapeText(whole);
      }
      return whole.startsWith("</")
        ? `</${tagName}>`
        : `<${tagName}${keepAttributes(tagName, attributes)}>`;
    },
  );
}
