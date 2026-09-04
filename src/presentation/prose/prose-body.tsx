import type { ReactNode } from "react";
import {
  type ProseCalloutTone,
  type ProseNode,
  parseProse,
} from "@/domain/blogops";
import { Icon, type IconName, SectionHeading } from "@/presentation/ui";
import { ProseTableFrame } from "./prose-table-frame";
import styles from "./prose.module.css";

/**
 * 本文を、書かれたとおりの形で描く。
 *
 * **管理画面のエディタと公開面は、同じ断片を同じ規則で描く。**
 * 描き方が 2 か所にあると、編集中に見えていたものと読者が見るものがずれる。
 * ずれた側は誰も気づかない — 運営者は自分の画面しか見ないからである。
 * だから割り方 (`parseProse`) も描き方 (このファイル) も 1 つにしてある。
 *
 * **商品カードだけは自分で描かない。** 商品の名前・価格・リンクは
 * 本文ではなく商品の側が持つ。ここで描こうとすると、商品を直した日に
 * 記事が古い名前を出し続ける。描き方は呼ぶ側から渡してもらう。
 */

const TONE_ICON: Readonly<Record<ProseCalloutTone, IconName>> = {
  info: "calloutInfo",
  tip: "calloutTip",
  warn: "calloutWarn",
  note: "calloutNote",
};

const TONE_CLASS: Readonly<Record<ProseCalloutTone, string>> = {
  info: styles.proseCalloutInfo,
  tip: styles.proseCalloutTip,
  warn: styles.proseCalloutWarn,
  note: styles.proseCalloutNote,
};

export type ProductCardRenderer = (productId: string) => ReactNode;

export function ProseBody({
  body,
  keyPrefix,
  renderProductCard,
}: {
  /** 保存されている本文の文字列。素の文章なら段落だけとして描かれる。 */
  readonly body: string;
  /** 兄弟の間で鍵が衝突しないための前置き。節の id を渡す。 */
  readonly keyPrefix: string;
  /**
   * 商品カードの描き方。
   *
   * 渡さないと商品カードは**描かれない**。空の枠や「読み込み中」を出さないのは、
   * それが読者にとって記事の一部に見えるためである。出せないものは出さない。
   */
  readonly renderProductCard?: ProductCardRenderer;
}) {
  const nodes = parseProse(body);
  return (
    <>
      {nodes.map((node, index) => (
        <ProseNodeView
          // biome-ignore lint/suspicious/noArrayIndexKey: 断片は本文の順序そのものが同一性で、他に安定した鍵が無い
          key={`${keyPrefix}-${index}`}
          node={node}
          renderProductCard={renderProductCard}
        />
      ))}
    </>
  );
}

function ProseNodeView({
  node,
  renderProductCard,
}: {
  readonly node: ProseNode;
  readonly renderProductCard?: ProductCardRenderer;
}) {
  switch (node.kind) {
    case "paragraph":
      return <p>{node.text}</p>;

    case "heading":
      /*
        節の見出しが h2 なので、本文の中は h3 と h4 しか取らない。
        飛び級を作らないのは、読み上げが段の深さで位置を伝えるためである。

        **裸の `<h3>` を書かない。**見出しの見た目は `SectionHeading` が
        1 か所で決めている。ここで直に書くと、強制配色で `color` が均された
        ときに段の手掛かりが消える——`heading.tsx` が `font-weight` と
        `font-size` の両方を必ず当てているのは、その 1 件のためである。
      */
      return <SectionHeading level={node.level}>{node.text}</SectionHeading>;

    case "bullet-list":
      return (
        <ul>
          {node.items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 項目は順序が同一性
            <li key={i}>{item}</li>
          ))}
        </ul>
      );

    case "ordered-list":
      return (
        <ol>
          {node.items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 項目は順序が同一性
            <li key={i}>{item}</li>
          ))}
        </ol>
      );

    case "quote":
      return (
        <blockquote className={styles.proseQuote}>
          {node.text.split("\n").map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 行は順序が同一性
            <p key={i}>{line}</p>
          ))}
        </blockquote>
      );

    case "callout":
      /*
        `role` を付けない。これは**記事の中の注意書き**であって、
        画面が操作を止めた理由 (`Callout`) ではない。読み上げに割り込ませると、
        記事を読み進めている人の順序を壊す。
      */
      return (
        <aside className={[styles.proseCallout, TONE_CLASS[node.tone]].join(" ")}>
          <Icon name={TONE_ICON[node.tone]} size="md" />
          <div>
            {node.title.trim() !== "" && (
              <strong className={styles.proseCalloutTitle}>{node.title}</strong>
            )}
            {node.text.split("\n").map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 行は順序が同一性
              <p key={i}>{line}</p>
            ))}
          </div>
        </aside>
      );

    case "product-card":
      return <>{renderProductCard?.(node.productId) ?? null}</>;

    case "comparison-table":
      /*
        枠 (`div > table > thead …`) は `ProseTableFrame` が 1 か所で持っている。
        ここが決めるのは**中身が文字であること**だけ。書く側は同じ枠に入力欄を入れる。

        行の長さが揃っていない本文もありうる（`| a | b |` の次が `| c |` など）。
        列数は見出しの数に揃え、足りない桁は空にする。**行を落とさない。**
        落とすと、運営者から見て「保存したら表の行が消えた」ことになる。
      */
      return (
        <ProseTableFrame
          columnCount={node.headers.length}
          renderCell={(row, col) => node.rows[row]?.[col] ?? ""}
          renderHeaderCell={(col) => node.headers[col] ?? ""}
          rowCount={node.rows.length}
        />
      );

    case "image":
      /*
        `alt` が空でも `alt=""` を必ず出す。属性ごと落とすと、読み上げは
        ファイル名を読み始める。空の `alt` は「読み飛ばしてよい絵」の意味で、
        属性が無いのとは違う。
      */
      // 運営者入力の URL は寸法も許可ホストも事前確定できないため、最適化 API を経由しない。
      // eslint-disable-next-line @next/next/no-img-element
      return <img alt={node.alt} className={styles.proseImage} src={node.src} />;

    case "divider":
      return <hr className={styles.proseDivider} />;
  }
}
