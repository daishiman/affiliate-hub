/**
 * 成果リンクを保存する前の確認カード。**管理面限定。読者面へ出さない。**
 *
 * ここに `src/presentation/ui/patterns/` ではなく管理面の側に置いている理由は
 * `src/presentation/ui/patterns/product-card.tsx` の `priceNote` の説明と同じで、
 * このカードが**金額そのもの**（`price` / `currency`）を出すからである。
 * 書き写した価格は必ず古くなり、古い価格の掲載を禁じる ASP が多い。
 *
 * それでもここで金額を出すのは、読者に見せるためではなく、
 * 貼り付けた本人が保存前に「意図した商品か」を確かめる材料だからである。
 * 読者面の部品と同じ棚（`ui/patterns`）に置いて公開 export すると、
 * 読者面のページから import するのを妨げるものが無くなる。棚を分けることで
 * 「読者に出せる部品」と「本人確認のための部品」の境界を機械的に保つ。
 */

import { DescriptionTime, DiagramFallback, Foldable, SectionHeading } from "@/presentation/ui";
import styles from "./affiliate-preview-card.module.css";

export type AffiliatePreviewView = {
  readonly status: "ready" | "partial" | "duplicate" | "failed" | "rejected";
  readonly rawUrl: string;
  readonly canonicalUrl: string | null;
  readonly productName: string | null;
  readonly merchantName: string | null;
  readonly providerLabel: string;
  readonly imageUrl: string | null;
  readonly price: string | null;
  readonly currency: string | null;
  readonly retrievedAt: string;
  readonly method: string;
  readonly sourceHost: string;
  readonly duplicateCandidates: readonly string[];
  readonly reason: string | null;
  readonly oneLine: string | null;
};

const STATUS_LABEL: Readonly<Record<AffiliatePreviewView["status"], string>> = {
  ready: "確認できました",
  partial: "手入力で補ってください",
  duplicate: "同じ候補があります",
  failed: "自動確認できませんでした",
  rejected: "自動取得の対象外です",
};

function show(value: string | null): string {
  return value ?? "未取得";
}

export function AffiliatePreviewCard({ preview }: { readonly preview: AffiliatePreviewView }) {
  const label = preview.productName ?? preview.sourceHost;
  return (
    <section className={styles.card} aria-labelledby="affiliate-preview-title">
      <div className={styles.topRow}>
        <div>
          <p className={styles.eyebrow}>保存前の確認</p>
          <SectionHeading level={3} id="affiliate-preview-title">{label}</SectionHeading>
        </div>
        <strong className={styles.status} data-status={preview.status}>
          {STATUS_LABEL[preview.status]}
        </strong>
      </div>

      {preview.imageUrl === null ? (
        <DiagramFallback label={label} />
      ) : (
        // provider policy で表示権利と固定 image host の両方を満たした URL だけが届く。
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.remoteImage}
          src={preview.imageUrl}
          alt={`${label}の提携先プレビュー`}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}

      {preview.reason === null ? null : <p className={styles.reason}>{preview.reason}</p>}

      <dl className={styles.facts}>
        <div className={styles.fact}><dt>提携先</dt><dd>{preview.providerLabel}</dd></div>
        <div className={styles.fact}><dt>販売元</dt><dd>{show(preview.merchantName)}</dd></div>
        <div className={styles.fact}><dt>価格</dt><dd>{preview.price === null ? "未取得" : `${preview.price} ${preview.currency ?? ""}`.trim()}</dd></div>
        <div className={styles.fact}><dt>取得方法</dt><dd>{preview.method}</dd></div>
        <div className={styles.fact}><dt>接続先</dt><dd>{preview.sourceHost}</dd></div>
        <div className={styles.fact}><dt>重複候補</dt><dd>{preview.duplicateCandidates.length}件</dd></div>
      </dl>
      {preview.oneLine === null ? null : <p>{preview.oneLine}</p>}
      <Foldable summary="取得の詳しい情報">
        <dl className={styles.detailFacts}>
          {/*
            成果リンクの全体を出せるのは**ここだけ**である。
            この URL には成果の割り当て先が入っているので、
            保存後の一覧では出さない（`src/app/admin/affiliate/links/page.tsx` の
            「リンクの全体（ASP が発行した URL）は出しません」の注記）。

            ここで出す限定条件: 貼り付けた直後に、貼り付けた本人へ。
            本人が「今そこに貼った文字列」を照合するための表示で、
            本人がまだ画面に持っている情報より増えない。
            保存後は貼った人以外も見る画面になるため、同じ条件が成り立たない。
          */}
          <div className={styles.detailFact}><dt>貼り付けたURL</dt><dd><code>{preview.rawUrl}</code></dd></div>
          <div className={styles.detailFact}><dt>正規URL</dt><dd><code>{show(preview.canonicalUrl)}</code></dd></div>
          <DescriptionTime
            className={styles.detailFact}
            label="取得時刻"
            dateTime={preview.retrievedAt}
          >
            {preview.retrievedAt}
          </DescriptionTime>
          <div className={styles.detailFact}><dt>ステータス</dt><dd>{STATUS_LABEL[preview.status]}</dd></div>
        </dl>
        <SectionHeading level={4}>重複候補の詳細</SectionHeading>
        {preview.duplicateCandidates.length === 0 ? (
          <p>重複候補はありません。</p>
        ) : (
          <ul>
            {preview.duplicateCandidates.map((candidate) => <li key={candidate}><code>{candidate}</code></li>)}
          </ul>
        )}
      </Foldable>
      <p className={styles.caption}>
        これは確認表示で、まだ保存していません。価格は現在価格を保証しません。
      </p>
      <p className={styles.nextStep}>
        保存後はサイト・記事・ブロックを指定して掲載先を管理できます。
        表記やリンクを差し替えるときは、旧リンクを止めて新しく登録します。
      </p>
    </section>
  );
}
