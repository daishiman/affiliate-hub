import type { ArticleTemplate, BlogArticleBlock } from "@/domain/blogops";
import {
  ARTICLE_BLOCK_LABEL,
  buildOutline,
  freshnessOf,
  PRODUCT_CARD_PLACEMENTS,
} from "@/domain/blogops";
import { blockAnchor, ProseOutline, ProseSection } from "@/presentation/prose";
import { DisclosureNotice, SectionHeading } from "@/presentation/ui";
import {
  composeExpressionArticleBlocks,
  expressionBlockOfArticleBlock,
  isExpressionArticleBlock,
} from "@/application/adapters/expression-article-block";
import { ExpressionArticleSection } from "./expression-block-view";

/**
 * ブログ運用で作った記事の、読者側の描き方。
 *
 * **記事型 (T1〜T4) ごとに描き方を分けない。** 型の違いは
 * 「どの部品が要るか」だけで、部品そのものの描き方は 1 つに保つ。
 * 分けると、広告表記の出し方が型ごとに 4 通りに分かれ、
 * 法令に関わる表示の直し漏れがそこから生まれる（`article-page.tsx` と同じ理由）。
 */

/**
 * 商品カードの再掲。**運営者が入れたカードは 1 枚ずつ、出る場所は記事型が決める。**
 *
 * 3 回入れさせない理由は `PRODUCT_CARD_PLACEMENTS` (`domain/blogops`) にある。
 * 要点だけ書くと、価格を直した日に 1 枚だけ古い値が残り、
 * **同じ記事の中で違う数字が読者に見える**からである。
 */
function ProductCardRerun({
  cards,
  heading,
}: {
  readonly cards: readonly BlogArticleBlock[];
  readonly heading: string;
}) {
  if (cards.length === 0) return null;
  return (
    <section aria-label={heading}>
      <SectionHeading level={3}>{heading}</SectionHeading>
      <ul>
        {cards.map((card) => (
          <li key={card.id}>
            <strong>{card.heading}</strong>
            {card.body.trim() !== "" && <span> — {card.body}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 本文の改行を段落に写す。生の HTML は読者側で解釈しない。 */
/**
 * 鮮度の一言。**「古い」と黙るのではなく、いつの記事かを必ず言う。**
 * 読者が自分で判断できる材料を出すのが目的で、隠すのが目的ではない。
 */
function freshnessNote(updatedAt: Date, now: Date): string {
  const freshness = freshnessOf(updatedAt, now);
  if (freshness === "stale") return "この記事は 1 年以上更新されていません。";
  if (freshness === "aging") return "この記事は半年以上更新されていません。";
  return "";
}

export function BlogArticleView({
  template,
  lead,
  authorName,
  updatedAt,
  now,
  blocks,
  children,
}: {
  /** 記事型。目次の階層と、商品カードを再掲する場所がこれで決まる。 */
  readonly template: ArticleTemplate;
  readonly lead: string;
  readonly authorName: string;
  readonly updatedAt: Date;
  /** いまの時刻。画面の中で `new Date()` を呼ばない（検査で時刻を固定できなくなる）。 */
  readonly now: Date;
  readonly blocks: readonly BlogArticleBlock[];
  /** 本文のあとに続けるもの（評価フォームなど）。 */
  readonly children?: React.ReactNode;
}) {
  const ordered = [...composeExpressionArticleBlocks(blocks, {})].sort(
    (a, b) => a.position - b.position,
  );
  const outline = buildOutline(ordered);
  const note = freshnessNote(updatedAt, now);

  /*
    商品カードは**この場では描かない。**運営者が入れた順に集めておき、
    記事型が決めた場所 (紹介・比較・まとめ) で同じ並びを出す。
    その場で描くと、再掲と合わせて 4 回出ることになる。
  */
  const cards = ordered.filter(
    (block) => block.kind === "product-card" && !isExpressionArticleBlock(block),
  );
  const placements = PRODUCT_CARD_PLACEMENTS[template];
  /** その節の直後にカードを再掲するか。既に出した場所は二度出さない。 */
  const shown = new Set<string>();

  return (
    <article>
      {lead !== "" && <p>{lead}</p>}
      <p>
        <span>執筆: {authorName}</span>
        <span> / 最終更新: {updatedAt.toISOString().slice(0, 10)}</span>
      </p>
      {note !== "" && <p>{note}</p>}

      {ordered.map((block) => {
        const expression = expressionBlockOfArticleBlock(block);
        if (expression !== null) {
          return (
            <ExpressionArticleSection
              key={block.id}
              heading={block.heading}
              block={expression}
            />
          );
        }

        // prefix が在るのに解釈できない carrier は、内部表現を本文へ漏らさない。
        if (isExpressionArticleBlock(block)) return null;

        if (block.kind === "disclosure-notice") {
          // 広告表記は共通部品が正本。記事ごとの本文で書き換えさせない。
          return <DisclosureNotice key={block.id} />;
        }

        if (block.kind === "hierarchical-toc") {
          return (
            <nav key={block.id} aria-label="目次">
              <SectionHeading level={2}>
                {block.heading.trim() === ""
                  ? ARTICLE_BLOCK_LABEL[block.kind]
                  : block.heading}
              </SectionHeading>
              {outline.length === 0 ? (
                <p>この記事にはまだ見出しがありません。</p>
              ) : (
                <ProseOutline nodes={outline} />
              )}
            </nav>
          );
        }

        // カードそのものは、集める側で扱う（ここでは描かない）。
        if (block.kind === "product-card") return null;

        const rerun = placements.includes(block.kind) && !shown.has(block.kind);
        if (rerun) shown.add(block.kind);

        return (
          <ProseSection
            key={block.id}
            title={block.heading}
            id={blockAnchor(block)}
            body={block.body}
          >
            {rerun && <ProductCardRerun cards={cards} heading={`${ARTICLE_BLOCK_LABEL[block.kind]}で挙げたもの`} />}
          </ProseSection>
        );
      })}

      {children}
    </article>
  );
}
