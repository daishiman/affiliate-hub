import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { UI_COPY } from "../copy";
import { ComparisonTable, type ComparisonColumn, type ComparisonRow } from "../patterns/comparison-table";
import { DisclosureNotice } from "../patterns/disclosure";
import { EvidenceList, type EvidenceView } from "../patterns/evidence";
import { Conversation } from "../patterns/conversation";
import { ProductCard, type ProductCardSpec } from "../patterns/product-card";
import { ClaimStatement, type Factuality } from "../patterns/factuality";
import {
  RankingTable,
  type CriterionView,
  type ExcludedProduct,
  type RankingRow,
} from "../patterns/ranking-table";
import { StubNotice } from "../patterns/stub-notice";
import { EmptyView } from "../primitives/state-view";
import { type TelemetrySectionKind, telemetrySectionAttrs } from "../telemetry-attrs";
import { FactList } from "./screen-parts";
import styles from "./site.module.css";

/**
 * 記事 1 本の表示。
 *
 * **記事タイプごとに画面を分けない。** 順位・レビュー・比較・選び方は
 * 同じ器で表示し、「順位の表があるか」「比較の表があるか」だけで出し分ける。
 * タイプごとに画面を作ると、広告表示や出典の出し方が画面ごとにずれる。
 *
 * 広告表示を出すかどうかは受け取った値 (`disclosureRequired`) に従うだけで、
 * ここで条件を組み立てない。画面ごとに条件式を書くと、どこかで必ず抜ける。
 *
 * ここに出てくる型は**表示のための形**であり、保存されている形とは別。
 * 保存側の型をそのまま画面へ渡すと、編集中の状態が読者に漏れる経路ができる。
 * 変換は `src/presentation/site/view-model.ts` が 1 箇所で行う。
 */

export type ClaimView = {
  readonly id: string;
  readonly statement: string;
  readonly kind: Factuality;
  readonly evidence: readonly EvidenceView[];
};

export type SectionView = {
  readonly id: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly claims?: readonly ClaimView[];
  /**
   * 節の種類。滞在時間をこの単位で数える。
   * 省略すると「本文」として数える。段落ごとには測らない
   * （細かく測っても読み方は分からず、記録だけが増える）。
   */
  readonly kind?: TelemetrySectionKind;
};

export type ConversationLineView = {
  readonly speaker: "reader" | "writer" | "expert" | "assistant";
  readonly text: string;
};

export type ProductCardView = {
  /** どの商品か。「気になる」の保存先を決めるのに要る。 */
  readonly productId?: string;
  readonly name: string;
  readonly brand: string;
  readonly oneLine: string;
  readonly specs: readonly ProductCardSpec[];
  readonly priceNote?: string;
  readonly affiliateHref?: string;
  readonly blockedReason?: string;
  readonly detailHref?: string;
  /**
   * 「気になる」の押しどころ。**部品側では作らない。**
   * 保存はサーバ動作なので、作れるのは画面の側だけ。ここで作れる形にすると、
   * 見た目の部品が保存先を知ることになり、読者の一覧に商業の都合を
   * 混ぜる実装がこの部品から書けてしまう。
   */
  readonly saveSlot?: ReactNode;
};

export type FaqItemView = {
  readonly question: string;
  readonly answer: string;
};

export type ArticleViewModel = {
  readonly title: string;
  readonly summary: string;
  readonly publishedAt: string;
  readonly updatedAt: string;
  readonly authorName: string;
  readonly authorHref: string;
  readonly authorBio?: string;
  readonly authorCredentials?: readonly string[];
  readonly expertName?: string;
  readonly expertHref?: string;
  readonly disclosureRequired: boolean;
  readonly methodologyHref: string;
  readonly policyHref: string;
  readonly sections: readonly SectionView[];
  readonly conversation?: readonly ConversationLineView[];
  /** 記事の要点。1 件も無い記事では欄ごと出さない。 */
  readonly keyPoints?: readonly string[];
  /** よくある質問。1 件も無い記事では欄ごと出さない。 */
  readonly faq?: readonly FaqItemView[];
  readonly productCards?: readonly ProductCardView[];
  readonly ranking?: {
    readonly caption: string;
    readonly updatedAt: string;
    readonly criteria: readonly CriterionView[];
    readonly rows: readonly RankingRow[];
    readonly excluded: readonly ExcludedProduct[];
  };
  readonly comparison?: {
    readonly caption: string;
    readonly columns: readonly ComparisonColumn[];
    readonly rows: readonly ComparisonRow[];
  };
  /** 同じブログで次に読める公開記事。取得に失敗したときは欄ごと出さない。 */
  readonly relatedArticles?: readonly ArticleCardView[];
  /** 中身がまだ無い記事であることの明示。見本を本物に見せない。 */
  readonly stub?: { readonly label: string; readonly blockedBy: string; readonly stubId: string };
  /**
   * ブログが選んだ見せ方の、記事の中の並び（受入 A1・A5）。
   *
   * **文字列の配列で受け取る。** テンプレートの定義は業務のきまり
   * （`@/domain/authoring`）にあり、共通UIはそれを読まない。読んだ時点で
   * 部品が業務を抱え、別の用途で使い回せなくなる（`tests/ui/ui-layers.test.ts`）。
   *
   * 渡さなければ既定の並び（`DEFAULT_BLOCK_ORDER`）で描く。
   * 見せ方を選んでいないブログと、保存先が無い実行がそれに当たる。
   */
  readonly blockOrder?: readonly string[];
};

/**
 * 並べ替えの効く塊。
 *
 * **記事の中身の全部ではない。** 題・書き手・開示・著者紹介・次に読む記事は
 * 位置が意味を持つ（開示は本文より前でなければ意味が無い）ので動かさない。
 * 動かすのは「読む順を変えても筋が通る」塊だけにする。
 *
 * `answer`（結論）はここに無い。題のすぐ下の要約として既に描かれており、
 * 動かす場所が無いからである。`sources` も同じく根拠の中に埋まっている。
 * **並べ替えの対象に無い種類は、テンプレートの並びから静かに落ちる**のではなく、
 * そもそも動かせる形をしていない。
 */
const MOVABLE_BLOCKS = ["key_points", "summary", "comparison", "cta", "faq", "freshness"] as const;
type MovableBlock = (typeof MOVABLE_BLOCKS)[number];

/** 見せ方を選んでいないブログの並び。いまの記事画面の並びをそのまま写す。 */
const DEFAULT_BLOCK_ORDER: readonly MovableBlock[] = MOVABLE_BLOCKS;

/**
 * 並べ替える。**塊は 1 つも落とさない。**
 *
 * テンプレートの並びに無い種類は末尾へ元の順のまま付ける。
 * これが「見せ方を差し替えても既存記事が壊れない」の中身で、
 * ドメイン側の `orderBlocksForTemplate` と同じ約束をここでも守る
 * （あちらはブロックの列、こちらは描き出す塊）。
 */
function orderMovableBlocks(order: readonly string[]): readonly MovableBlock[] {
  const rank = new Map(order.map((kind, index) => [kind, index]));
  return [...MOVABLE_BLOCKS].sort((a, b) => {
    const ra = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
    return ra === rb ? MOVABLE_BLOCKS.indexOf(a) - MOVABLE_BLOCKS.indexOf(b) : ra - rb;
  });
}

/**
 * 目次。節の見出しからその場で作る。
 *
 * 原稿に書かせない。手で書かせると、節を 1 つ足した日に目次だけ古くなり、
 * 読者は「無い項目」へ飛ばされる。節が 2 つ以下のときは出さない
 * （目次を読む手間のほうが大きい）。
 */
export function ArticleTableOfContents({
  sections,
  placement = "inline",
}: {
  readonly sections: readonly SectionView[];
  readonly placement?: "inline" | "sidebar";
}) {
  if (sections.length < 3) return null;
  return (
    <nav
      className={[
        styles.tableOfContents,
        placement === "sidebar" ? styles.tocSidebar : styles.tocInline,
      ].join(" ")}
      aria-label={`${UI_COPY.article.tocTitle}（${
        placement === "sidebar" ? "サイドバー" : "本文"
      }）`}
    >
      <p className={styles.tocLabel}>{UI_COPY.article.tocTitle}</p>
      <ul>
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`}>{s.heading}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * 更新履歴。公開日と更新日から作る。
 *
 * 直していないときに何も出さないと、「履歴が無い」のか
 * 「まだ直していない」のかが読者に区別できない。文字で言う。
 */
function UpdateHistory({
  publishedAt,
  updatedAt,
}: {
  readonly publishedAt: string;
  readonly updatedAt: string;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHeading}>{UI_COPY.article.historyTitle}</h2>
      <ul>
        <li>
          <time dateTime={publishedAt}>{publishedAt}</time> {UI_COPY.article.historyPublished}
        </li>
        {updatedAt === publishedAt ? (
          <li>{UI_COPY.article.historyNoUpdate}</li>
        ) : (
          <li>
            {/* dateModified の機械可読化。JSON-LD と同じ値を <time> でも示す。 */}
            <time dateTime={updatedAt}>{updatedAt}</time> {UI_COPY.article.historyUpdated}
          </li>
        )}
      </ul>
    </section>
  );
}

/**
 * よくある質問。
 *
 * `<dl>` で組む。問いと答えの対であることが、見た目を切っても機械に伝わる形。
 * `<h2>` と `<p>` を並べると、読み上げでも AI でも「見出しと本文」にしか見えず、
 * どこまでが 1 つの問いへの答えかが分からなくなる。
 *
 * 折りたたまない。畳むと、開いていない答えは検索にも AI にも読まれにくく、
 * ここへ書く理由（先に答えておく）がそのまま消える。
 */
/**
 * 記事の要点。
 *
 * **結論の直後、目次より前に出す。** テンプレートの並び
 * （`orderBlocksForTemplate` の `AI_FIRST`）が answer → key_points と
 * 決めており、AI 検索も読者も先頭から読む。目次の後ろへ回すと、
 * 記事を開いた人が最初に見るのが「見出しの一覧」になる。
 */
function KeyPointsSection({ items }: { readonly items: readonly string[] }) {
  return (
    <section
      id="key-points"
      className={styles.section}
      {...telemetrySectionAttrs({ kind: "conclusion", id: "key-points" })}
    >
      <h2 className={styles.sectionHeading}>{UI_COPY.article.keyPointsTitle}</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function FaqSection({ items }: { readonly items: readonly FaqItemView[] }) {
  return (
    <section
      id="faq"
      className={styles.section}
      {...telemetrySectionAttrs({ kind: "faq", id: "faq" })}
    >
      <h2 className={styles.sectionHeading}>{UI_COPY.article.faqTitle}</h2>
      <FactList
        rows={items.map((item) => ({
          key: item.question,
          label: item.question,
          value: item.answer,
        }))}
      />
    </section>
  );
}

function Section({ section }: { readonly section: SectionView }) {
  return (
    <section
      id={section.id}
      className={styles.section}
      // 節ごとの滞在時間を測る単位。拾う側が画面全体で 1 回だけ見る。
      {...telemetrySectionAttrs({ kind: section.kind ?? "lead", id: section.id })}
    >
      <h2 className={styles.sectionHeading}>{section.heading}</h2>
      {section.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {section.claims?.map((claim) => (
        <ClaimStatement key={claim.id} kind={claim.kind} statement={claim.statement}>
          {/* 事実として書いたものにだけ出典を並べる。推測と意見に出典は付かない。 */}
          {claim.kind === "fact" && <EvidenceList items={claim.evidence} />}
        </ClaimStatement>
      ))}
    </section>
  );
}

export function ArticleView({ article }: { readonly article: ArticleViewModel }) {
  const wide = article.ranking !== undefined || article.comparison !== undefined;
  const blocks = orderMovableBlocks(article.blockOrder ?? DEFAULT_BLOCK_ORDER);

  /*
    塊ごとの描き出し。**中身が無い塊は `null` にする**（欄だけ出さない）。

    目次を `summary` の中に入れてあるのは、目次が指す先が節そのものだからである。
    別の塊にすると、見せ方によっては節より後ろに目次が回り、
    「これから読むものの一覧」が読み終えた人の前に出る。

    順位表を `comparison` に同梱するのも同じ理由で、
    どちらも「並べて比べる表」で、間に別の話を挟むと読者が比較を中断する。
  */
  const movable: Readonly<Record<MovableBlock, ReactNode>> = {
    key_points:
      article.keyPoints !== undefined && article.keyPoints.length > 0 ? (
        <KeyPointsSection items={article.keyPoints} />
      ) : null,
    summary: (
      <>
        <ArticleTableOfContents sections={article.sections} />
        {article.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}
      </>
    ),
    comparison: (
      <>
        {article.ranking !== undefined && (
          <RankingTable
            caption={article.ranking.caption}
            criteria={article.ranking.criteria}
            rows={article.ranking.rows}
            excluded={article.ranking.excluded}
            updatedAt={article.ranking.updatedAt}
          />
        )}
        {article.comparison !== undefined && (
          <ComparisonTable
            caption={article.comparison.caption}
            columns={article.comparison.columns}
            rows={article.comparison.rows}
          />
        )}
      </>
    ),
    cta:
      article.productCards !== undefined && article.productCards.length > 0 ? (
        <section
          className={styles.section}
          aria-label="この記事で取り上げた商品"
          {...telemetrySectionAttrs({ kind: "cta", id: "product-cards" })}
        >
          <h2 className={styles.sectionHeading}>この記事で取り上げた商品</h2>
          <div className={styles.cardList}>
            {article.productCards.map((card) => (
              <ProductCard key={card.productId ?? card.name} {...card} />
            ))}
          </div>
        </section>
      ) : null,
    // 本文を読み終えた読者に残る問いへ、ここで先に答える。
    faq:
      article.faq !== undefined && article.faq.length > 0 ? (
        <FaqSection items={article.faq} />
      ) : null,
    freshness: <UpdateHistory publishedAt={article.publishedAt} updatedAt={article.updatedAt} />,
  };

  return (
    <article className={[styles.article, wide ? styles.wide : null].filter(Boolean).join(" ")}>
      <h1 className={styles.articleTitle}>{article.title}</h1>
      <p className={styles.articleSummary}>{article.summary}</p>

      <div className={styles.byline}>
        <span>
          書き手: <Link href={article.authorHref}>{article.authorName}</Link>
        </span>
        {article.expertName !== undefined && article.expertHref !== undefined && (
          <span>
            監修: <Link href={article.expertHref}>{article.expertName}</Link>
          </span>
        )}
        <span>公開 {article.publishedAt}</span>
        <span>
          {UI_COPY.article.updatedAt} {article.updatedAt}
        </span>
      </div>

      {article.stub !== undefined && (
        <StubNotice
          what={article.stub.label}
          blockedBy={article.stub.blockedBy}
          stubId={article.stub.stubId}
        />
      )}

      {article.disclosureRequired && (
        <DisclosureNotice
          showRankingNote={article.ranking !== undefined}
          methodologyHref={article.methodologyHref}
          policyHref={article.policyHref}
        />
      )}

      <section className={styles.articleIntroAuthor} aria-label="冒頭の書き手紹介">
        <p className={styles.authorCardLabel}>この記事の書き手</p>
        <h2 className={styles.articleIntroAuthorName}>
          <Link href={article.authorHref}>{article.authorName}</Link>
        </h2>
        {article.authorBio !== undefined && <p>{article.authorBio}</p>}
      </section>

      {article.conversation !== undefined && <Conversation lines={article.conversation} />}

      {blocks.map((kind) => (
        <Fragment key={kind}>{movable[kind]}</Fragment>
      ))}

      <section className={styles.articleAuthorProfile} aria-label="詳細な著者プロフィール">
        <p className={styles.authorCardLabel}>この記事を書いた人</p>
        <h2 className={styles.articleAuthorProfileName}>
          <Link href={article.authorHref}>{article.authorName}</Link>
        </h2>
        {article.authorBio !== undefined && <p>{article.authorBio}</p>}
        {article.authorCredentials !== undefined && article.authorCredentials.length > 0 && (
          <ul>
            {article.authorCredentials.map((credential) => (
              <li key={credential}>{credential}</li>
            ))}
          </ul>
        )}
      </section>

      {article.relatedArticles !== undefined && article.relatedArticles.length > 0 && (
        <section className={styles.relatedArticles} aria-labelledby="related-articles-heading">
          <p className={styles.authorCardLabel}>次に読む</p>
          <h2 id="related-articles-heading" className={styles.sectionHeading}>
            あわせて読みたい
          </h2>
          <ArticleList
            articles={article.relatedArticles}
            emptyTitle=""
            emptyBody=""
            headingLevel="h3"
          />
        </section>
      )}
    </article>
  );
}

export type ArticleCardView = {
  readonly slug: string;
  readonly href: string;
  readonly title: string;
  readonly summary: string;
  readonly updatedAt: string;
  readonly authorName: string;
};

/**
 * 記事の一覧。
 *
 * 0 件のときに黙らない。理由と次の一手を必ず出す。
 * 一覧が空のまま何も出ないのは、読者からは故障と区別がつかない。
 */
export function ArticleList({
  articles,
  emptyTitle,
  emptyBody,
  emptyAction,
  headingLevel = "h2",
}: {
  readonly articles: readonly ArticleCardView[];
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly emptyAction?: ReactNode;
  readonly headingLevel?: "h2" | "h3" | "h4";
}) {
  if (articles.length === 0) {
    return <EmptyView title={emptyTitle} body={emptyBody} action={emptyAction} />;
  }

  const Heading = headingLevel;

  return (
    <ul className={styles.articleList}>
      {articles.map((a) => (
        <li key={a.slug} className={styles.articleListItem}>
          <time className={styles.articleListDate} dateTime={a.updatedAt}>
            {a.updatedAt}
          </time>
          <div className={styles.articleListBody}>
            <Heading className={styles.cardTitle}>
              <Link href={a.href}>{a.title}</Link>
            </Heading>
            <p>{a.summary}</p>
            <span className={styles.cardMeta}>書き手: {a.authorName}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 人物の紹介。資格が無いことを隠さない（無いなら「登録されていません」と書く）。 */
export function PersonView({
  name,
  bio,
  credentials,
}: {
  readonly name: string;
  readonly bio: string;
  readonly credentials: readonly string[];
}) {
  return (
    <div className={styles.person}>
      <h2 className={styles.sectionHeading}>{name}</h2>
      <p>{bio}</p>
      {credentials.length > 0 ? (
        <ul className={styles.credentials}>
          {credentials.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.cardMeta}>資格・経歴は登録されていません。</p>
      )}
    </div>
  );
}

/** 方針などの固定文書。段落の配列を受け取るだけ。文言は画面に書かない。 */
export function PolicyView({ paragraphs }: { readonly paragraphs: readonly string[] }) {
  return (
    <div className={styles.policy}>
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export type CorrectionView = {
  readonly id: string;
  readonly correctedAt: string;
  readonly articleTitle: string;
  readonly articleHref: string;
  readonly what: string;
  readonly why: string;
};

/**
 * 訂正の履歴。
 *
 * 「何を直したか」と「なぜ間違えたか」を必ず並べる。
 * 直した結果だけを出すと、読者は同じ誤りを繰り返さない保証を得られない。
 */
export function CorrectionList({
  corrections,
  emptyBody,
}: {
  readonly corrections: readonly CorrectionView[];
  readonly emptyBody: string;
}) {
  if (corrections.length === 0) {
    return <EmptyView title="訂正はまだありません" body={emptyBody} />;
  }

  return (
    <ul className={styles.corrections}>
      {corrections.map((c) => (
        <li key={c.id} className={styles.correctionItem}>
          <span className={styles.correctionDate}>{c.correctedAt}</span>
          <Link href={c.articleHref}>{c.articleTitle}</Link>
          <p>直した内容: {c.what}</p>
          <p>理由: {c.why}</p>
        </li>
      ))}
    </ul>
  );
}
