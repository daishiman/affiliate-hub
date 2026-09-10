import type { ProseNode, ProseNodeKind } from "@/domain/blogops";

/**
 * 断片の種類ごとに 1 件ずつ持つ、consumer 検査用の最小 fixture。
 *
 * mapped type にしているので、種類を増やしたのに fixture を足し忘れると
 * UI テストを走らせる前に型検査で止まる。
 */
type ProseNodeFixtureByKind = {
  readonly [Kind in ProseNodeKind]: Extract<ProseNode, { readonly kind: Kind }>;
};

export const PROSE_NODE_FIXTURE_BY_KIND = {
  paragraph: { kind: "paragraph", text: "選び方をまとめます。" },
  heading: { kind: "heading", level: 3, text: "選ぶ基準" },
  "bullet-list": { kind: "bullet-list", items: ["軽さ", "静かさ"] },
  "ordered-list": { kind: "ordered-list", items: ["測る", "比べる"] },
  quote: { kind: "quote", text: "使った人の感想" },
  callout: { kind: "callout", tone: "tip", title: "こつ", text: "先に寸法を測ります。" },
  "product-card": { kind: "product-card", productId: "pc_fixture" },
  "comparison-table": {
    kind: "comparison-table",
    headers: ["名前", "重さ"],
    rows: [["見本 A", "1.2kg"]],
  },
  image: {
    kind: "image",
    src: "/api/article-images/image_fixture",
    alt: "机の全体",
    width: 1600,
    height: 900,
  },
  divider: { kind: "divider" },
  code: { kind: "code", language: "ts", text: "const answer = 42;" },
  table: {
    kind: "table",
    headers: ["項目", "内容"],
    rows: [["色", "白"]],
  },
  "image-row": {
    kind: "image-row",
    images: [
      /* 測れた絵と測れなかった絵を 1 本ずつ置く。**片方だけを揃えると、
         もう片方の道 (寸法なし) を誰も通らないまま緑になる。** */
      { src: "/api/article-images/image_left", alt: "左側", width: 800, height: 600 },
      { src: "/api/article-images/image_right", alt: "右側", width: null, height: null },
    ],
  },
  toggle: { kind: "toggle", title: "詳しい条件", text: "補足の本文" },
  checklist: { kind: "checklist", items: [{ text: "寸法を測る", checked: true }] },
  embed: {
    kind: "embed",
    url: "https://www.youtube.com/embed/video_fixture",
    title: "解説動画",
  },
  "cta-button": {
    kind: "cta-button",
    href: "/s/site_fixture/blog/article_fixture",
    label: "詳しく見る",
    tone: "action",
  },
  "link-card": {
    kind: "link-card",
    url: "https://example.com/guide",
    title: "参考ガイド",
    description: "選び方の補足",
  },
  columns: { kind: "columns", left: "左の説明", right: "右の説明" },
} satisfies ProseNodeFixtureByKind;
