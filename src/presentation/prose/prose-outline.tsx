/**
 * 記事の目次と、節に打つ錨（アンカー）。
 *
 * **飛び先の名前を 2 か所で作らない。** 目次のリンクと、飛ばされる節の `id` は
 * 同じ文字列でなければならない。片方だけ書き方を変えた日、リンクは
 * 「無い場所」を指し、読者はページの先頭に取り残される。押しても何も
 * 起きないので、壊れていることに気づくのは読者だけになる。
 * だから名前を作るのは `blockAnchor` 1 か所にしてある。
 *
 * **押しどころの下限もここで当てる。** 目次は指で押される場所である。
 * 素の `<a>` のままだと行の高さぶんしか無く、指の腹より小さい
 * （`tests/ui/screen-hit-and-current.test.tsx`）。
 */

import type { BlogArticleBlock, OutlineNode } from "@/domain/blogops";
import styles from "./prose.module.css";

/** 節へ飛ぶための名前。目次のリンク先と節の `id` の**唯一の出どころ**。 */
export function blockAnchor(block: BlogArticleBlock): string {
  return `block-${block.id}`;
}

/**
 * 目次の 1 段ぶん。**2 階層より深くしない。**
 *
 * 深くできるようにすると、運営者は深くする。深い目次は、
 * 読者が「どこを読めばよいか」を決めるための道具ではなくなり、
 * 記事をもう 1 本読むのと同じ量の文字になる。
 * 段の数を決めているのは `ARTICLE_BLOCK_TOC_LEVEL` (`domain/blogops`) 1 か所。
 */
export function ProseOutline({
  nodes,
}: {
  readonly nodes: readonly OutlineNode<BlogArticleBlock>[];
}) {
  return (
    <ol className={styles.proseOutline}>
      {nodes.map((node) => (
        <li key={node.block.id}>
          <a href={`#${blockAnchor(node.block)}`}>
            {node.label}. {node.block.heading}
          </a>
          {node.children.length > 0 && <ProseOutline nodes={node.children} />}
        </li>
      ))}
    </ol>
  );
}
