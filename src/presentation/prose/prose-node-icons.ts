import type { ProseNodeKind } from "@/domain/blogops";
import type { IconName } from "@/presentation/ui";

/** 断片の種類に対応するアイコン。絵文字は使わない。 */
export const PROSE_NODE_ICON: Readonly<Record<ProseNodeKind, IconName>> = {
  paragraph: "proseParagraph",
  heading: "proseHeading",
  "bullet-list": "proseBulletList",
  "ordered-list": "proseOrderedList",
  quote: "proseQuote",
  callout: "proseCallout",
  "product-card": "proseProductCard",
  "comparison-table": "proseTable",
  image: "proseImage",
  divider: "proseDivider",
  code: "proseCode",
  table: "proseGrid",
  "image-row": "proseImageRow",
  toggle: "proseToggle",
  checklist: "proseChecklist",
  embed: "proseEmbed",
  "cta-button": "proseCtaButton",
  "link-card": "proseLinkCard",
  columns: "proseColumns",
};

export const PROSE_NODE_DESCRIPTION: Readonly<Record<ProseNodeKind, string>> = {
  paragraph: "本文の文章を書く", heading: "節の中に見出しを置く",
  "bullet-list": "特徴や要点を並べる", "ordered-list": "順番のある手順を書く",
  quote: "引用した文章を区別する", callout: "補足・注意を目立たせる",
  "product-card": "登録した商品を検索して挿す", "comparison-table": "選択肢の違いを比較する",
  image: "写真や図をアップロード", divider: "話題の切り替わりを示す",
  code: "コードを記号のまま掲載", table: "項目と値を表で整理する",
  "image-row": "2〜4枚の写真を並べる", toggle: "詳しい説明を折りたたむ",
  checklist: "確認項目とチェックを並べる", embed: "動画や地図を埋め込む",
  "cta-button": "読者の次の行動を案内する", "link-card": "関連記事や参考ページを案内",
  columns: "2つの文章を左右に並べる",
};
