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
 * 節の見出しは常に見出し 2、断片の見出しは 3 か 4。この対応は骨格の側から
 * 導かれるもので、編集操作では動かない (FRONT-REQ-008)。だから
 * `heading` の `level` は 3 か 4 しか型として取れない。
 *
 * ## なぜ保存は文字列のままなのか
 *
 * 節の `body` は今も、これからも **拡張 Markdown の文字列**である
 * (`decisions[].dec-article-body-storage-format` = `opt-extended-markdown-string`)。
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
 *
 * ## 装飾は断片ではない
 *
 * 太字・斜体・打ち消し・行内コード・リンク・文字色は、断片の種類ではなく
 * **文字を持つ断片の内側の装飾**である (FRONT-REQ-007・`prose-inline.ts`)。
 * ここを断片にすると 19 の枠を装飾が食い、かつ「太字の中の箇条書き」という
 * 入れ子が生まれる。装飾は行の中で閉じる。
 */

/**
 * `/` で挿せる断片の種類。**19 種で固定** (FRONT-REQ-005)。
 *
 * 増やすときは `PROSE_NODE_METADATA` / `PROSE_MENU_GROUPS` /
 * `emptyProseNode` / `isEmptyProseNode` / `serializeNode` / `parseProse` の
 * 各 consumer が同時に要る。型付き fixture と表駆動 consumer test が
 * `PROSE_NODE_KINDS` を総当たりして、抜けを落とす。
 */
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
  "code",
  "table",
  "image-row",
  "toggle",
  "checklist",
  "embed",
  "cta-button",
  "link-card",
  "columns",
] as const;
export type ProseNodeKind = (typeof PROSE_NODE_KINDS)[number];

/** 注意書きの調子。記事の中の意味であって、画面の警告ではない。 */
export const CALLOUT_TONES = ["info", "tip", "warn", "note"] as const;
export type ProseCalloutTone = (typeof CALLOUT_TONES)[number];

/**
 * 押しボタンの調子。**色そのものではなく役割の名前**を持つ。
 *
 * 記事の配色はサイトのテーマが決める。ここで色そのものの値を持つと、
 * テーマを変えた日に、記事の中のボタンだけが前のテーマの色で残る。
 */
export const CTA_TONES = ["action", "accent"] as const;
export type ProseCtaTone = (typeof CTA_TONES)[number];

/** 並列画像に並べられる枚数の上限・下限 (FRONT-REQ-005: 2〜4 枚)。 */
export const IMAGE_ROW_MIN = 2;
export const IMAGE_ROW_MAX = 4;

/**
 * 1 枚の画像。単体の `image` と `:::image-row` の両方がこの形を使う。
 *
 * `width`/`height` は**絵の実寸**であって、表示する大きさではない。
 *
 * **なぜ寸法を持つのか。** 属性が無いと、絵が届いた瞬間に高さが確定し、
 * 読者が読んでいた行が下へ飛ぶ。ブラウザは `width`/`height` の比だけを
 * 使って場所を先に空ける (表示幅は CSS が決める) ので、実寸を入れておけば
 * 読んでいる最中に文章が動かない。
 *
 * **`null` を許す。** 本文画像は運営者がその場で貼る URL で、workerd に
 * 画像デコーダは無い。測れるのはブラウザだけなので、測れなかった絵と
 * 既存の記事は `null` のまま残る。ここを必須にすると、測れない絵を
 * 貼った日に保存が落ちる。
 */
export type ProseImage = {
  readonly src: string;
  readonly alt: string;
  readonly width: number | null;
  readonly height: number | null;
};
export type ProseChecklistItem = { readonly text: string; readonly checked: boolean };

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
  | ({ readonly kind: "image" } & ProseImage)
  | { readonly kind: "divider" }
  /**
   * プログラムなどの引用。**言語の指定は見た目のためだけに持つ。**
   * 空文字は「言語を決めていない」であって「言語が無い」ではない。
   */
  | { readonly kind: "code"; readonly language: string; readonly text: string }
  /**
   * 自由な行列。比較表 (`comparison-table`) と別に持つのは、
   * 比較表が「商品を並べて選ばせる」意味を帯び、既存の保存記法を持つため。
   * 編集と公開の表枠は共用し、意味と保存記法だけを区別する。
   */
  | {
      readonly kind: "table";
      readonly headers: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  /** 2〜4 枚を横に並べる。1 枚なら `image` を使う。 */
  | { readonly kind: "image-row"; readonly images: readonly ProseImage[] }
  /** 畳んでおける補足。読み飛ばしてよいものを畳む。 */
  | { readonly kind: "toggle"; readonly title: string; readonly text: string }
  | { readonly kind: "checklist"; readonly items: readonly ProseChecklistItem[] }
  /**
   * 外部の埋め込み。**宛先は描画時に許可リストで絞る** (SEC-REQ-009)。
   * ここは URL を持つだけで、通してよいかを判断しない。
   */
  | { readonly kind: "embed"; readonly url: string; readonly title: string }
  | {
      readonly kind: "cta-button";
      readonly href: string;
      readonly label: string;
      readonly tone: ProseCtaTone;
    }
  | {
      readonly kind: "link-card";
      readonly url: string;
      readonly title: string;
      readonly description: string;
    }
  /**
   * 2 段組。左右それぞれは**行の中で閉じる文章**で、断片を入れ子にしない。
   * 入れ子にすると `:::` の閉じがどの囲みのものか、文字列からは決まらなくなる。
   */
  | { readonly kind: "columns"; readonly left: string; readonly right: string };

/** discriminated union の追加を、未処理のまま通さないための終端。 */
export function assertNever(value: never, context: string): never {
  throw new Error(`${context}: ${JSON.stringify(value)}`);
}

/**
 * `/` の一覧を分ける 5 群 (UIUX-REQ-007)。
 *
 * **メニュー対象の 19 個を 1 列に並べない。** 並べると、画面の下端で切れたものが
 * 「無い」ことになる。群の名前は運営者の言葉で、種類の名前ではない。
 */
export const PROSE_MENU_GROUPS: readonly {
  readonly id: string;
  readonly label: string;
  readonly kinds: readonly ProseNodeKind[];
}[] = [
  {
    id: "text",
    label: "文章",
    kinds: ["paragraph", "heading", "quote", "callout", "code"],
  },
  {
    id: "list",
    label: "一覧",
    kinds: ["bullet-list", "ordered-list", "checklist", "toggle"],
  },
  {
    id: "look",
    label: "見せ方",
    kinds: ["image", "image-row", "columns", "divider"],
  },
  {
    id: "data",
    label: "データ",
    kinds: ["comparison-table", "table"],
  },
  {
    id: "insert",
    label: "差し込み",
    kinds: ["product-card", "link-card", "cta-button", "embed"],
  },
];

/**
 * `/` メニューに出す並び。群の順にたどった平坦な並び。
 *
 * **よく使うものが上の群にある。** 五十音でも種類の定義順でもない。
 */
export const PROSE_MENU_ORDER: readonly ProseNodeKind[] = PROSE_MENU_GROUPS.flatMap(
  (group) => group.kinds,
);

/**
 * 種類の名前と、`/` の後ろに打った文字で絞るための読み。
 *
 * editor/viewer/codec の処理までここへ集めない。それぞれの責務と処理順が違い、
 * 1 つの巨大な registry にすると、どの consumer が未実装かが見えなくなる。
 * 共有するのは、どこで使っても意味が同じ名前と検索語だけである。
 *
 * **日本語の名前だけでは絞れない。** `/` を打った直後の手はローマ字入力の途中で、
 * 変換を確定してからでないと「注意書き」と打てない。`/cal` や `/ちゅう` の
 * どちらでも当たるようにしておく。
 */
export const PROSE_NODE_METADATA = {
  paragraph: { label: "段落", keywords: ["paragraph", "text", "だんらく"] },
  heading: { label: "小見出し", keywords: ["heading", "h3", "midashi", "みだし"] },
  "bullet-list": { label: "箇条書き", keywords: ["list", "bullet", "ul", "かじょう"] },
  "ordered-list": {
    label: "番号付きの箇条書き",
    keywords: ["ordered", "number", "ol", "ばんごう"],
  },
  quote: { label: "引用", keywords: ["quote", "blockquote", "いんよう"] },
  callout: { label: "注意書き", keywords: ["callout", "note", "tip", "ちゅうい"] },
  "product-card": {
    label: "商品カード",
    keywords: ["product", "card", "しょうひん", "かーど"],
  },
  "comparison-table": {
    label: "比較表",
    keywords: ["table", "compare", "ひかく", "ひょう"],
  },
  image: { label: "画像", keywords: ["image", "img", "photo", "がぞう"] },
  divider: { label: "区切り線", keywords: ["divider", "hr", "line", "くぎり"] },
  code: { label: "プログラム", keywords: ["code", "pre", "program", "こーど", "ぷろぐらむ"] },
  table: { label: "表", keywords: ["table", "grid", "ひょう", "ぐりっど"] },
  "image-row": {
    label: "画像の横並び",
    keywords: ["image", "row", "gallery", "よこならび", "ならべ"],
  },
  toggle: {
    label: "折りたたみ",
    keywords: ["toggle", "details", "accordion", "おりたたみ"],
  },
  checklist: { label: "チェックリスト", keywords: ["check", "todo", "task", "ちぇっく"] },
  embed: { label: "埋め込み", keywords: ["embed", "iframe", "video", "うめこみ"] },
  "cta-button": { label: "押しボタン", keywords: ["cta", "button", "link", "ぼたん"] },
  "link-card": {
    label: "リンクカード",
    keywords: ["link", "card", "bookmark", "りんく"],
  },
  columns: { label: "2 段組", keywords: ["column", "columns", "split", "だんぐみ", "にだん"] },
} as const satisfies Readonly<
  Record<ProseNodeKind, { readonly label: string; readonly keywords: readonly string[] }>
>;

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
      return { kind: "image", src: "", alt: "", width: null, height: null };
    case "divider":
      return { kind: "divider" };
    case "code":
      return { kind: "code", language: "", text: "" };
    case "table":
      return { kind: "table", headers: ["", ""], rows: [["", ""]] };
    case "image-row":
      /* 横並びは 2 枚から。1 枚の横並びは `image` と見分けが付かない。 */
      return {
        kind: "image-row",
        images: Array.from({ length: IMAGE_ROW_MIN }, () => ({
          src: "",
          alt: "",
          width: null,
          height: null,
        })),
      };
    case "toggle":
      return { kind: "toggle", title: "", text: "" };
    case "checklist":
      return { kind: "checklist", items: [{ text: "", checked: false }] };
    case "embed":
      return { kind: "embed", url: "", title: "" };
    case "cta-button":
      return { kind: "cta-button", href: "", label: "", tone: "action" };
    case "link-card":
      return { kind: "link-card", url: "", title: "", description: "" };
    case "columns":
      return { kind: "columns", left: "", right: "" };
  }
  return assertNever(kind, "空の本文断片を作れない種類です");
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
    case "table":
      return (
        node.headers.every((h) => h.trim() === "") &&
        node.rows.every((row) => row.every((cell) => cell.trim() === ""))
      );
    case "image":
      return node.src.trim() === "";
    case "code":
      /*
        **言語だけ選んで中身が空なら空。** 言語は見た目の指定であって、
        読者へ伝わる中身ではない。
      */
      return node.text.trim() === "";
    case "image-row":
      return node.images.every((image) => image.src.trim() === "");
    case "toggle":
      return node.title.trim() === "" && node.text.trim() === "";
    case "checklist":
      return node.items.every((item) => item.text.trim() === "");
    case "embed":
      return node.url.trim() === "";
    case "cta-button":
      /*
        **行き先が無いボタンは空。** 文言だけのボタンは押せてしまい、
        押した読者はどこへも行かない。
      */
      return node.href.trim() === "";
    case "link-card":
      return node.url.trim() === "";
    case "columns":
      return node.left.trim() === "" && node.right.trim() === "";
  }
  return assertNever(node, "空かどうかを判定できない本文断片です");
}
