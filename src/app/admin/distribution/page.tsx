import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  adminOperation,
  adminOperationRouteId,
} from "@/presentation/admin/admin-operation-manifest";
import { currentActor, distributionNotice, distributionUseCases } from "@/presentation/composition";
import {
  ActionNote,
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  ExternalLink,
  FactList,
  ListView,
  Prose,
  Section,
  StorageNotice,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 配信。
 *
 * **出せない先を「出せそう」に見せない**ことがこの画面の役目。
 * note のように外部から投稿する公式の仕組みが無い先は、
 * 投稿の操作を置かず、書き出しの導線だけを出す。
 */
export default async function DistributionPage() {
  const operation = adminOperation("publication.list");
  const actor = await currentActor();
  const uc = await distributionUseCases();

  const [channels, publications] = await Promise.all([
    uc.listChannels.execute(actor, {}),
    uc.listPublications.execute(actor, {}),
  ]);

  return (
    <AdminShell
      routeId={adminOperationRouteId(operation)}
      title="配信"
      lead="どこへ出したか、いま何が止まっているかを見ます。"
      actions={
        <>
          <TextLink href="/admin/distribution/new">配信を作る</TextLink>
          <TextLink href="/admin">ホームへ戻る</TextLink>
        </>
      }
    >
      {!channels.ok ? (
        <ErrorView
          title="出し先の一覧を出せませんでした"
          body={channels.error.message}
          suggestedAction={channels.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <>
          <StorageNotice status={await distributionNotice()} />

          {/* いつ来ても同じ説明。枠から外し、代わりに配信先ごとの行にも同じことが分かる状態を保つ。 */}
          <Prose>
            接続の登録はこの画面では行いません。各サービスのパスワードや利用許可の情報は、ご自身のブラウザで登録していただきます。
            この画面には控えを持ちません。
          </Prose>

          <Section title="いつ出すかを見る">
            <ListView
              rows={[
                {
                  key: "calendar",
                  label: "投稿カレンダーを開く",
                  href: "/admin/distribution/calendar",
                  note: "日付ごとに並べ替えて、同じ日に同じ先へ寄っていないか、承認が済んでいるかを確かめられます。",
                },
              ]}
            />
          </Section>

          <Section title="手当てが要る配信">
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
                action={<TextLink href="/admin/content">記事の進行を見る</TextLink>}
              />
            ) : publications.value.needsAttention.length === 0 ? (
              <EmptyView
                title="止まっている配信はありません"
                body={`${publications.value.total}件の配信はすべて進んでいます。`}
              />
            ) : (
              <ListView
                rows={publications.value.needsAttention.map((p) => ({
                  key: p.publicationId,
                  label: `${p.channelLabel}：${p.stateLabel}`,
                  href: `/admin/distribution/${encodeURIComponent(p.publicationId)}`,
                  note: `${p.lastError ?? "貼り付け待ちです。"}${
                    p.attempts > 0 ? `（送信を試した回数: ${p.attempts}回）` : ""
                  }`,
                }))}
              />
            )}
          </Section>

          {publications.ok && publications.value.total > 0 ? (
            <Section title={`直近の配信（${publications.value.total}件）`}>
              <DataTable
                caption="配信ごとの、出し先と状態と予定"
                columns={[
                  { key: "channel", label: "出し先" },
                  { key: "state", label: "状態" },
                  { key: "scheduled", label: "予定" },
                  { key: "external", label: "公開先" },
                ]}
                rows={publications.value.items.map((p) => ({
                  key: p.publicationId,
                  cells: [
                    <TextLink
                      key="link"
                      href={`/admin/distribution/${encodeURIComponent(p.publicationId)}`}
                    >
                      {p.channelLabel}
                    </TextLink>,
                    p.stateLabel,
                    p.scheduledAt === null
                      ? "すぐに出す"
                      : p.scheduledAt.toLocaleString("ja-JP"),
                    p.externalUrl === null ? (
                      "—"
                    ) : (
                      <ExternalLink key="external" href={p.externalUrl}>
                        開く
                      </ExternalLink>
                    ),
                  ],
                }))}
              />
            </Section>
          ) : null}

          <Section
            title="出し先ごとのきまり"
            lead="文字数の上限や広告表記の置き場所は、各サービスのきまりに合わせています。自動で投稿できない先は、その理由をそのまま出します。"
          >
            {channels.value.channels.map((c) => (
              <SubSection key={c.kind} title={c.label}>
                <FactList
                  rows={[
                    { key: "mode", label: "出し方", value: c.publishModeLabel },
                    {
                      key: "accounts",
                      label: "接続",
                      value:
                        c.connectedAccounts.length === 0
                          ? "未接続"
                          : c.connectedAccounts.join(" / "),
                    },
                    {
                      key: "max",
                      label: "本文の上限",
                      value: c.maxBodyLength === null ? "上限なし" : `${c.maxBodyLength}文字`,
                    },
                    {
                      key: "bodyLinks",
                      label: "本文中のリンク",
                      value: c.allowsBodyLinks ? "置ける" : "置けない（別の導線が要る）",
                    },
                    {
                      key: "affiliate",
                      label: "提携リンク",
                      value: c.allowsAffiliateLinks ? "掲載できる" : "掲載できない",
                    },
                    {
                      key: "disclosure",
                      label: "広告表記の場所",
                      value: c.disclosurePlacementLabel,
                    },
                    { key: "basis", label: "きまりの出どころ", value: c.basisNote },
                  ]}
                />
                {c.unusableReasons.map((reason) => (
                  <ActionNote key={reason} tone="danger">
                    接続を確認してください: {reason}
                  </ActionNote>
                ))}
                {c.blockedReason === null ? null : (
                  <Callout tone="info" title="いまは配信できません" reason={c.blockedReason} />
                )}
              </SubSection>
            ))}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
