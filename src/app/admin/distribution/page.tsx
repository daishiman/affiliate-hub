import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import { currentActor, distributionNotice, distributionUseCases } from "@/presentation/composition";
import {
  Callout,
  Card,
  DataTable,
  DefinitionList,
  EmptyView,
  ErrorView,
  Page,
  SectionHeading,
  StackedList,
  StackedRow,
  StorageNotice,
} from "@/presentation/ui";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 配信。
 *
 * **出せない先を「出せそう」に見せない**ことがこの画面の役目。
 * note のように外部から投稿する公式の仕組みが無い先は、
 * 投稿の操作を置かず、書き出しの導線だけを出す。
 */
export default async function DistributionPage() {
  const actor = await currentActor();
  const uc = await distributionUseCases();

  const [channels, publications] = await Promise.all([
    uc.listChannels.execute(actor, {}),
    uc.listPublications.execute(actor, {}),
  ]);

  if (!channels.ok) {
    return (
      <Shell>
        <ErrorView
          title="出し先の一覧を出せませんでした"
          body={channels.error.message}
          suggestedAction={channels.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <StorageNotice status={await distributionNotice()} />

      <Callout
        tone="info"
        title="接続の登録はこの画面では行いません"
        reason="各サービスのパスワードや利用許可の情報は、ご自身のブラウザで登録していただきます。この画面には控えを持ちません。"
      />

      <Card>
        <SectionHeading level={2}>いつ出すかを見る</SectionHeading>
        <StackedList>
          <StackedRow note={<>日付ごとに並べ替えて、同じ日に同じ先へ寄っていないか、承認が済んでいるかを確かめられます。</>}>
            <Link href="/admin/distribution/calendar">投稿カレンダーを開く</Link>
            
          </StackedRow>
        </StackedList>
      </Card>

      <Card>
        <SectionHeading level={2}>手当てが要る配信</SectionHeading>
        {!publications.ok ? (
          <ErrorView
            title="配信の記録を出せませんでした"
            body={publications.error.message}
            suggestedAction={publications.error.suggestedAction ?? null}
          />
        ) : publications.value.total === 0 ? (
          <EmptyView
            title="配信の記録がありません"
            body={publications.value.emptyReason ?? "まだ配信していません。"}
            action={<Link href="/admin/content">記事の進行を見る</Link>}
          />
        ) : publications.value.needsAttention.length === 0 ? (
          <EmptyView
            title="止まっている配信はありません"
            body={`${publications.value.total}件の配信はすべて進んでいます。`}
          />
        ) : (
          <StackedList>
            {publications.value.needsAttention.map((p) => (
              <StackedRow key={p.publicationId} note={<>{p.lastError ?? "貼り付け待ちです。"}
                  {p.attempts > 0 ? `（送信を試した回数: ${p.attempts}回）` : ""}</>}>
                <Link href={`/admin/distribution/${encodeURIComponent(p.publicationId)}`}>
                  {p.channelLabel}：{p.stateLabel}
                </Link>
                
              </StackedRow>
            ))}
          </StackedList>
        )}
      </Card>

      {publications.ok && publications.value.total > 0 ? (
        <Card>
          <SectionHeading level={2}>直近の配信（{publications.value.total}件）</SectionHeading>
          <DataTable
            caption="出し先ごとの、いまの状態と公開の予定。"
            columns={[
              {
                key: "channel",
                header: "出し先",
                rowHeader: true,
                cell: (p) => (
                  <Link href={`/admin/distribution/${encodeURIComponent(p.publicationId)}`}>
                    {p.channelLabel}
                  </Link>
                ),
              },
              { key: "state", header: "状態", cell: (p) => p.stateLabel },
              {
                key: "scheduled",
                header: "予定",
                cell: (p) =>
                  p.scheduledAt === null ? "すぐに出す" : p.scheduledAt.toLocaleString("ja-JP"),
              },
              {
                key: "external",
                header: "公開先",
                cell: (p) =>
                  p.externalUrl === null ? (
                    "—"
                  ) : (
                    <a href={p.externalUrl} rel="noreferrer noopener" target="_blank">
                      開く
                    </a>
                  ),
              },
            ]}
            rows={publications.value.items}
            rowKey={(p) => p.publicationId}
          />
        </Card>
      ) : null}

      <Card>
        <SectionHeading level={2}>出し先ごとのきまり</SectionHeading>
        <p className={styles.sectionLead}>
          文字数の上限や広告表記の置き場所は、各サービスのきまりに合わせています。
          自動で投稿できない先は、その理由をそのまま出します。
        </p>
        {channels.value.channels.map((c) => (
          <div key={c.kind}>
            <SectionHeading level={3}>{c.label}</SectionHeading>
            <DefinitionList
              items={[
                { term: "出し方", description: c.publishModeLabel },
                {
                  term: "接続",
                  description:
                    c.connectedAccounts.length === 0 ? "未接続" : c.connectedAccounts.join(" / "),
                },
                {
                  term: "本文の上限",
                  description: c.maxBodyLength === null ? "上限なし" : `${c.maxBodyLength}文字`,
                },
                {
                  term: "本文中のリンク",
                  description: c.allowsBodyLinks ? "置ける" : "置けない（別の導線が要る）",
                },
                {
                  term: "提携リンク",
                  description: c.allowsAffiliateLinks ? "掲載できる" : "掲載できない",
                },
                { term: "広告表記の場所", description: c.disclosurePlacementLabel },
                { term: "きまりの出どころ", description: c.basisNote },
              ]}
            />
            {c.unusableReasons.map((reason) => (
              <Callout key={reason} tone="warn" title="接続を確認してください" reason={reason} />
            ))}
            {c.blockedReason === null ? null : (
              <Callout tone="info" title="いまは配信できません" reason={c.blockedReason} />
            )}
          </div>
        ))}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/distribution"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "配信" }]}
      actions={<Link href="/admin">ホームへ戻る</Link>}
    >
      <Page
        title="配信"
        lead="どこへ出したか、いま何が止まっているかを見る画面です。自動で投稿できない先は、その理由を出します。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
