/**
 * 本文の断片 (prose node)。
 *
 * **記事は 2 層でできている。**
 *
 * - **外側 = 節 (`ArticleBlockKind` 15 種)** — 記事の骨格。並びは記事型が決め、
 *   目次 (`ARTICLE_BLOCK_TOC_LEVEL`) と必須検証 (`REQUIRED_BLOCKS`) が
 *   ぶら下がっている。運営者が自由に足すものではない。
 * - **内側 = 本文の断片 (このファイル)** — 節の中身。運営者が `/` で好きに挿す。
 *
 * **この 2 つを混ぜない。** 混ぜると、注意書きを 1 つ足しただけで
 * 「記事型の必須部品が欠けた」と言われる。骨格と中身は別の速さで変わる。
 *
 * ## なぜ保存は文字列のままなのか
 *
 * 節の `body` は今も、これからも **拡張 Markdown の文字列**である。
 * JSON のツリーに変えていない。理由は 3 つある。
 *
 * 1. **既存のデータが 1 件も壊れない。** 素の文章は「段落だけの文書」として
 *    そのまま読める。移行が要らない。
 * 2. **人が読める。** git の差分でも、DB を覗いたときでも、書いた内容が見える。
 * 3. **AI が書ける。** ローカルの CLI が記事を書くとき、埋めるのは文字列である。
 *    ツリーを組ませると、書き手ごとに違う形の JSON が届く。
 *
 * つまり `ProseNode[]` は**保存の形ではなく、扱うときの形**である。
 * 読むときに `parseProse` で組み立て、書くときに `serializeProse` で戻す。
 */

/** `/` で挿せる断片の種類。 */
export const PROSE_NODE_KINDS = [
  "paragraph",
  "heading",
  "bullet-list",
  "ordered-list",
  "quote",
  "callout",
  "product-card",
  "comparison-table",
  "image",
  "divider",
] as const;
export type ProseNodeKind = (typeof PROSE_NODE_KINDS)[number];

/** 注意書きの調子。記事の中の意味であって、画面の警告ではない。 */
export const CALLOUT_TONES = ["info", "tip", "warn", "note"] as const;
export type ProseCalloutTone = (typeof CALLOUT_TONES)[number];

export type ProseNode =
  | { readonly kind: "paragraph"; readonly text: string }
  /** 節の見出しが h2 なので、本文の中の見出しは 3 か 4 しか取らない。 */
  | { readonly kind: "heading"; readonly level: 3 | 4; readonly text: string }
  | { readonly kind: "bullet-list"; readonly items: readonly string[] }
  | { readonly kind: "ordered-list"; readonly items: readonly string[] }
  | { readonly kind: "quote"; readonly text: string }
  | {
      readonly kind: "callout";
      readonly tone: ProseCalloutTone;
      readonly title: string;
      readonly text: string;
    }
  /** 商品は id で指す。名前や価格を本文へ焼き付けると、商品を直した日に本文が嘘になる。 */
  | { readonly kind: "product-card"; readonly productId: string }
  | {
      readonly kind: "comparison-table";
      readonly headers: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  | { readonly kind: "image"; readonly src: string; readonly alt: string }
  | { readonly kind: "divider" };

/**
 * `/` メニューに出す並び。
 *
 * **よく使うものが上。** 五十音でも種類の定義順でもない。
 * メニューは「探す場所」ではなく「押す場所」で、
 * 3 番目までに欲しいものが無いと、人は使うのをやめる。
 *
 * `paragraph` はここに無い。改行すれば出るものを、選ばせる必要がない。
 */
export const PROSE_MENU_ORDER: readonly Exclude<ProseNodeKind, "paragraph">[] = [
  "heading",
  "bullet-list",
  "callout",
  "product-card",
  "comparison-table",
  "image",
  "ordered-list",
  "quote",
  "divider",
];

/** メニューに出す名前。運営者の言葉で書く。 */
export const PROSE_NODE_LABEL: Readonly<Record<ProseNodeKind, string>> = {
  paragraph: "段落",
  heading: "小見出し",
  "bullet-list": "箇条書き",
  "ordered-list": "番号付きの箇条書き",
  quote: "引用",
  callout: "注意書き",
  "product-card": "商品カード",
  "comparison-table": "比較表",
  image: "画像",
  divider: "区切り線",
};

/**
 * `/` の後ろに打った文字で絞るための読み。
 *
 * **日本語の名前だけでは絞れない。**`/` を打った直後の手はローマ字入力の途中で、
 * 変換を確定してからでないと「注意書き」と打てない。`/cal` や `/ちゅう` の
 * どちらでも当たるようにしておく。
 */
export const PROSE_NODE_KEYWORDS: Readonly<Record<ProseNodeKind, readonly string[]>> = {
  paragraph: ["paragraph", "text", "だんらく"],
  heading: ["heading", "h3", "midashi", "みだし"],
  "bullet-list": ["list", "bullet", "ul", "かじょう"],
  "ordered-list": ["ordered", "number", "ol", "ばんごう"],
  quote: ["quote", "blockquote", "いんよう"],
  callout: ["callout", "note", "tip", "ちゅうい"],
  "product-card": ["product", "card", "しょうひん", "かーど"],
  "comparison-table": ["table", "compare", "ひかく", "ひょう"],
  image: ["image", "img", "photo", "がぞう"],
  divider: ["divider", "hr", "line", "くぎり"],
};

/** 空の断片を作る。`/` で選んだ直後の状態。 */
export function emptyProseNode(kind: ProseNodeKind): ProseNode {
  switch (kind) {
    case "paragraph":
      return { kind: "paragraph", text: "" };
    case "heading":
      return { kind: "heading", level: 3, text: "" };
    case "bullet-list":
      return { kind: "bullet-list", items: [""] };
    case "ordered-list":
      return { kind: "ordered-list", items: [""] };
    case "quote":
      return { kind: "quote", text: "" };
    case "callout":
      return { kind: "callout", tone: "info", title: "", text: "" };
    case "product-card":
      return { kind: "product-card", productId: "" };
    case "comparison-table":
      /*
        **2 列 2 行で出す。**1 列 1 行だと表に見えず、
        運営者は「表を挿したのに表が出ない」と受け取る。
        列や行はあとから足せるが、最初の見た目が用途を伝える。
      */
      return { kind: "comparison-table", headers: ["", ""], rows: [["", ""]] };
    case "image":
      return { kind: "image", src: "", alt: "" };
    case "divider":
      return { kind: "divider" };
  }
}

/**
 * 中身が空の断片か。
 *
 * **空の断片は保存しない。**`/` を開いて選んで、やめた跡が本文へ残ると、
 * 公開面に空の箱が並ぶ。ただし `divider` は中身を持たないので常に「空でない」。
 */
export function isEmptyProseNode(node: ProseNode): boolean {
  switch (node.kind) {
    case "divider":
      return false;
    case "paragraph":
    case "quote":
      return node.text.trim() === "";
    case "heading":
      return node.text.trim() === "";
    case "bullet-list":
    case "ordered-list":
      return node.items.every((item) => item.trim() === "");
    case "callout":
      return node.title.trim() === "" && node.text.trim() === "";
    case "product-card":
      return node.productId.trim() === "";
    case "comparison-table":
      return (
        node.headers.every((h) => h.trim() === "") &&
        node.rows.every((row) => row.every((cell) => cell.trim() === ""))
      );
    case "image":
      return node.src.trim() === "";
  }
}
