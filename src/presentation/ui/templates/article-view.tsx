import Link from "next/link";
import type { ReactNode } from "react";
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
  readonly name: string;
  readonly brand: string;
  readonly oneLine: string;
  readonly specs: readonly ProductCardSpec[];
  readonly priceNote?: string;
  readonly affiliateHref?: string;
  readonly blockedReason?: string;
  readonly detailHref?: string;
};

export type ArticleViewModel = {
  readonly title: string;
  readonly summary: string;
  readonly publishedAt: string;
  readonly updatedAt: string;
  readonly authorName: string;
  readonly authorHref: string;
  readonly expertName?: string;
  readonly expertHref?: string;
  readonly disclosureRequired: boolean;
  readonly methodologyHref: string;
  readonly policyHref: string;
  readonly sections: readonly SectionView[];
  readonly conversation?: readonly ConversationLineView[];
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
  /** 中身がまだ無い記事であることの明示。見本を本物に見せない。 */
  readonly stub?: { readonly label: string; readonly blockedBy: string; readonly stubId: string };
};

/**
 * 目次。節の見出しからその場で作る。
 *
 * 原稿に書かせない。手で書かせると、節を 1 つ足した日に目次だけ古くなり、
 * 読者は「無い項目」へ飛ばされる。節が 2 つ以下のときは出さない
 * （目次を読む手間のほうが大きい）。
 */
function TableOfContents({ sections }: { readonly sections: readonly SectionView[] }) {
  if (sections.length < 3) return null;
  return (
    <nav className={styles.section} aria-label={UI_COPY.article.tocTitle}>
      <h2 className={styles.sectionHeading}>{UI_COPY.article.tocTitle}</h2>
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
          {publishedAt} {UI_COPY.article.historyPublished}
        </li>
        {updatedAt === publishedAt ? (
          <li>{UI_COPY.article.historyNoUpdate}</li>
        ) : (
          <li>
            {updatedAt} {UI_COPY.article.historyUpdated}
          </li>
        )}
      </ul>
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

  return (
    <article className={[styles.article, wide ? styles.wide : null].filter(Boolean).join(" ")}>
      <h1 className={styles.articleTitle}>{article.title}</h1>
      <p className={styles.articleSummary}>{article.summary}</p>

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

      <TableOfContents sections={article.sections} />

      {article.sections.map((section) => (
        <Section key={section.id} section={section} />
      ))}

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

      {article.productCards !== undefined && article.productCards.length > 0 && (
        <section
          className={styles.section}
          aria-label="この記事で取り上げた商品"
          {...telemetrySectionAttrs({ kind: "cta", id: "product-cards" })}
        >
          <h2 className={styles.sectionHeading}>この記事で取り上げた商品</h2>
          <div className={styles.cardList}>
            {article.productCards.map((card) => (
              <ProductCard key={card.name} {...card} />
            ))}
          </div>
        </section>
      )}

      {article.conversation !== undefined && <Conversation lines={article.conversation} />}

      <UpdateHistory publishedAt={article.publishedAt} updatedAt={article.updatedAt} />
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
}: {
  readonly articles: readonly ArticleCardView[];
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly emptyAction?: ReactNode;
}) {
  if (articles.length === 0) {
    return <EmptyView title={emptyTitle} body={emptyBody} action={emptyAction} />;
  }

  return (
    <ul className={styles.cardList}>
      {articles.map((a) => (
        <li key={a.slug} className={styles.cardItem}>
          <h2 className={styles.cardTitle}>
            <Link href={a.href}>{a.title}</Link>
          </h2>
          <p>{a.summary}</p>
          <span className={styles.cardMeta}>
            {UI_COPY.article.updatedAt} {a.updatedAt} / {a.authorName}
          </span>
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
