import { AdminShell } from "@/presentation/admin/admin-shell";
import { PublishArticleForm } from "@/presentation/admin/publish-article-form";
import Link from "next/link";
import type { ReactNode } from "react";
import { currentActor, distributionNotice, distributionUseCases } from "@/presentation/composition";
import {
  Callout,
  Card,
  DefinitionList,
  ErrorView,
  Note,
  Page,
  SectionHeading,
  StackedList,
  StackedRow,
  StorageNotice,
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
  const uc = await distributionUseCases();
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

  // 自分のブログ宛てで、まだ出していないときだけ「いまサイトに出す」を用意する。
  // **出し終わった配信にも出すと、同じ記事が 2 度出る。**
  // 選択肢の中身（種類ごとの欄・出し先・広告表記の文）は画面では組み立てず、
  // ユースケースから受け取る。組み立てを画面へ写すと、AI 経路と食い違う。
  const publishOptions =
    card.channelKind === "own_site" && card.externalUrl === null
      ? await uc.preparePublishArticle.execute(actor, { publicationId })
      : null;

  return (
    <Shell title={`${card.channelLabel}への配信`}>
      <StorageNotice status={await distributionNotice()} />

      <Card>
        <SectionHeading level={2}>いまの状態</SectionHeading>
        <DefinitionList
          items={[
            { term: "状態", description: card.stateLabel },
            { term: "出し方", description: publishModeLabel },
            {
              term: "予定",
              description:
                card.scheduledAt === null
                  ? "すぐに出す"
                  : card.scheduledAt.toLocaleString("ja-JP"),
            },
            { term: "送信を試した回数", description: `${card.attempts}回`, align: "numeric" },
            {
              term: "もとの記事",
              description: (
                <Link href={`/admin/content/${encodeURIComponent(card.variantId)}`}>
                  記事を見る
                </Link>
              ),
            },
          ]}
        />

        {card.lastError === null ? null : (
          <Callout tone="danger" title="送信できませんでした" reason={card.lastError} />
        )}
        {blockedReason === null ? null : (
          <Callout tone="info" title="自動では投稿できません" reason={blockedReason} />
        )}
        {card.externalUrl === null ? null : (
          <Note>
            公開先:{" "}
            <a href={card.externalUrl} rel="noreferrer noopener" target="_blank">
              {card.externalUrl}
            </a>
          </Note>
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>ここから進める先</SectionHeading>
        {nextStates.length === 0 ? (
          <p className={styles.sectionLead}>
            この配信はここで終わりです。進める先はありません。
          </p>
        ) : (
          <StackedList>
            {nextStates.map((s) => (
              <StackedRow key={s.state}>{s.label}</StackedRow>
            ))}
          </StackedList>
        )}
        <p className={styles.sectionLead}>
          取りやめ・再送は担当者の操作で行います。AI からは実行できません。
        </p>
      </Card>

      {publishOptions === null ? null : (
        <Card>
          <SectionHeading level={2}>いまサイトに出す</SectionHeading>
          {!publishOptions.ok ? (
            <ErrorView
              title="出す画面を用意できませんでした"
              body={publishOptions.error.message}
              suggestedAction={publishOptions.error.suggestedAction ?? null}
            />
          ) : (
            <>
              <p className={styles.sectionLead}>
                読者に見える形に整えてから出します。書き手・広告表記・次に見直す日が
                そろっていないものは出せません。
              </p>
              <PublishArticleForm publicationId={publicationId} options={publishOptions.value} />
            </>
          )}
        </Card>
      )}

      {draft === null ? null : (
        <Card>
          <SectionHeading level={2}>貼り付け用の下書き</SectionHeading>
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
