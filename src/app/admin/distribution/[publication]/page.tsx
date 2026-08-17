import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import { currentActor, distributionNotice, distributionUseCases } from "@/presentation/composition";
import {
  Callout,
  Card,
  ErrorView,
  Page,
  StubNotice,
} from "@/presentation/ui";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 配信 1 件。
 *
 * 自動で投稿できない先のときは、投稿の操作を出さずに
 * 貼り付け用の下書きをその場で出す。
 * 「押しても何も起きないボタン」を作らないため。
 */
export default async function PublicationPage({
  params,
}: {
  readonly params: Promise<{ readonly publication: string }>;
}) {
  const { publication: publicationId } = await params;
  const actor = await currentActor();
  const uc = distributionUseCases();
  const result = await uc.getPublication.execute(actor, { publicationId });

  if (!result.ok) {
    return (
      <Shell title="配信">
        <ErrorView
          title="この配信を表示できませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<Link href="/admin/distribution">配信の一覧へ戻る</Link>}
        />
      </Shell>
    );
  }

  const { card, canDirectPublish, publishModeLabel, nextStates, blockedReason } = result.value;
  // 自動で投稿できない先だけ、下書きを出す。
  const draft = canDirectPublish
    ? null
    : await uc.exportManualDraft.execute(actor, { publicationId });

  return (
    <Shell title={`${card.channelLabel}への配信`}>
      <StubNotice
        what="配信先の接続と配信の記録の保存先"
        blockedBy="channel_connections / publications テーブルの追加と、各サービスの接続設定"
        stubId="persistence:distribution-sample"
      >
        <span>{distributionNotice()}</span>
      </StubNotice>

      <Card>
        <h2 className={styles.sectionTitle}>いまの状態</h2>
        <dl className={styles.criteria}>
          <div>
            <dt>状態</dt>
            <dd>{card.stateLabel}</dd>
          </div>
          <div>
            <dt>出し方</dt>
            <dd>{publishModeLabel}</dd>
          </div>
          <div>
            <dt>予定</dt>
            <dd>{card.scheduledAt === null ? "すぐに出す" : card.scheduledAt.toLocaleString("ja-JP")}</dd>
          </div>
          <div>
            <dt>送信を試した回数</dt>
            <dd className={styles.numeric}>{card.attempts}回</dd>
          </div>
          <div>
            <dt>もとの記事</dt>
            <dd>
              <Link href={`/admin/content/${encodeURIComponent(card.variantId)}`}>
                記事を見る
              </Link>
            </dd>
          </div>
        </dl>

        {card.lastError === null ? null : (
          <Callout tone="danger" title="送信できませんでした" reason={card.lastError} />
        )}
        {blockedReason === null ? null : (
          <Callout tone="info" title="自動では投稿できません" reason={blockedReason} />
        )}
        {card.externalUrl === null ? null : (
          <p className={styles.linkNote}>
            公開先:{" "}
            <a href={card.externalUrl} rel="noreferrer noopener" target="_blank">
              {card.externalUrl}
            </a>
          </p>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>ここから進める先</h2>
        {nextStates.length === 0 ? (
          <p className={styles.sectionLead}>
            この配信はここで終わりです。進める先はありません。
          </p>
        ) : (
          <ul className={styles.linkList}>
            {nextStates.map((s) => (
              <li key={s.state}>{s.label}</li>
            ))}
          </ul>
        )}
        <p className={styles.sectionLead}>
          取りやめ・再送は担当者の操作で行います。AI からは実行できません。
        </p>
      </Card>

      {draft === null ? null : (
        <Card>
          <h2 className={styles.sectionTitle}>貼り付け用の下書き</h2>
          {!draft.ok ? (
            <ErrorView
              title="下書きを書き出せませんでした"
              body={draft.error.message}
              suggestedAction={draft.error.suggestedAction ?? null}
            />
          ) : (
            <>
              <p className={styles.sectionLead}>{draft.value.instructions}</p>
              <pre>{draft.value.markdown}</pre>
            </>
          )}
        </Card>
      )}
    </Shell>
  );
}

function Shell({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/distribution"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "配信", href: "/admin/distribution" },
        { label: title },
      ]}
      actions={<Link href="/admin/distribution">配信の一覧へ戻る</Link>}
    >
      <Page title={title} lead="この配信がいまどこまで進んでいるかと、次にできることを見ます。">
        {children}
      </Page>
    </AdminShell>
  );
}
