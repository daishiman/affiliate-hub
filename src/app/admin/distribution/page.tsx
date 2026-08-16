import Link from "next/link";
import type { ReactNode } from "react";
import { currentActor, distributionNotice, distributionUseCases } from "@/presentation/composition";
import {
  AppShell,
  Callout,
  Card,
  EmptyView,
  ErrorView,
  Page,
  StubNotice,
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
  const uc = distributionUseCases();

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
      <StubNotice
        what="配信先の接続と配信の記録の保存先"
        blockedBy="channel_connections / publications テーブルの追加と、各サービスの接続設定"
        stubId="persistence:distribution-sample"
      >
        <span>{distributionNotice()}</span>
      </StubNotice>

      <Callout
        tone="info"
        title="接続の登録はこの画面では行いません"
        reason="各サービスのパスワードや利用許可の情報は、ご自身のブラウザで登録していただきます。この画面には控えを持ちません。"
      />

      <Card>
        <h2 className={styles.sectionTitle}>いつ出すかを見る</h2>
        <ul className={styles.linkList}>
          <li>
            <Link href="/admin/distribution/calendar">投稿カレンダーを開く</Link>
            <span className={styles.linkNote}>
              日付ごとに並べ替えて、同じ日に同じ先へ寄っていないか、承認が済んでいるかを確かめられます。
            </span>
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>手当てが要る配信</h2>
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
          <ul className={styles.linkList}>
            {publications.value.needsAttention.map((p) => (
              <li key={p.publicationId}>
                <Link href={`/admin/distribution/${encodeURIComponent(p.publicationId)}`}>
                  {p.channelLabel}：{p.stateLabel}
                </Link>
                <span className={styles.linkNote}>
                  {p.lastError ?? "貼り付け待ちです。"}
                  {p.attempts > 0 ? `（送信を試した回数: ${p.attempts}回）` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {publications.ok && publications.value.total > 0 ? (
        <Card>
          <h2 className={styles.sectionTitle}>直近の配信（{publications.value.total}件）</h2>
          <table className={styles.rankTable}>
            <thead>
              <tr>
                <th scope="col">出し先</th>
                <th scope="col">状態</th>
                <th scope="col">予定</th>
                <th scope="col">公開先</th>
              </tr>
            </thead>
            <tbody>
              {publications.value.items.map((p) => (
                <tr key={p.publicationId}>
                  <th scope="row">
                    <Link href={`/admin/distribution/${encodeURIComponent(p.publicationId)}`}>
                      {p.channelLabel}
                    </Link>
                  </th>
                  <td>{p.stateLabel}</td>
                  <td>{p.scheduledAt === null ? "すぐに出す" : p.scheduledAt.toLocaleString("ja-JP")}</td>
                  <td>
                    {p.externalUrl === null ? (
                      "—"
                    ) : (
                      <a href={p.externalUrl} rel="noreferrer noopener" target="_blank">
                        開く
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <Card>
        <h2 className={styles.sectionTitle}>出し先ごとのきまり</h2>
        <p className={styles.sectionLead}>
          文字数の上限や広告表記の置き場所は、各サービスのきまりに合わせています。
          自動で投稿できない先は、その理由をそのまま出します。
        </p>
        {channels.value.channels.map((c) => (
          <div key={c.kind}>
            <h3 className={styles.sectionTitle}>{c.label}</h3>
            <dl className={styles.criteria}>
              <div>
                <dt>出し方</dt>
                <dd>{c.publishModeLabel}</dd>
              </div>
              <div>
                <dt>接続</dt>
                <dd>
                  {c.connectedAccounts.length === 0
                    ? "未接続"
                    : c.connectedAccounts.join(" / ")}
                </dd>
              </div>
              <div>
                <dt>本文の上限</dt>
                <dd>{c.maxBodyLength === null ? "上限なし" : `${c.maxBodyLength}文字`}</dd>
              </div>
              <div>
                <dt>本文中のリンク</dt>
                <dd>{c.allowsBodyLinks ? "置ける" : "置けない（別の導線が要る）"}</dd>
              </div>
              <div>
                <dt>提携リンク</dt>
                <dd>{c.allowsAffiliateLinks ? "掲載できる" : "掲載できない"}</dd>
              </div>
              <div>
                <dt>広告表記の場所</dt>
                <dd>{c.disclosurePlacementLabel}</dd>
              </div>
              <div>
                <dt>きまりの出どころ</dt>
                <dd>{c.basisNote}</dd>
              </div>
            </dl>
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
    <AppShell
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
    </AppShell>
  );
}
