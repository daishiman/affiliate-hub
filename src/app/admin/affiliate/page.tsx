import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  affiliatePeriods,
  affiliateStorageNotice,
  affiliateUseCases,
  currentActor,
} from "@/presentation/composition";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  FactList,
  ListView,
  Note,
  Prose,
  Section,
  StorageNotice,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 提携と成果。
 *
 * この画面に出る金額は、記事の順位づけには一切入らない。
 * 順位づけの計算は編集用の印が付いたつなぎ目しか受け取らないため、
 * ここの数字を渡そうとするとプログラムが組み上がらない。
 *
 * 接続情報（各 ASP のパスワードや鍵）はこの画面では扱わない。
 * 登録されているかどうかだけを出す。
 */
export default async function AffiliatePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly period?: string }>;
}) {
  const { period: requested } = await searchParams;
  const periods = affiliatePeriods();
  const period = requested && periods.includes(requested) ? requested : (periods[0] ?? "2026-08");

  const actor = await currentActor();
  const uc = await affiliateUseCases();

  const [accounts, programs, conversions] = await Promise.all([
    uc.listAccounts.execute(actor, {}),
    uc.listPrograms.execute(actor, {}),
    uc.listConversions.execute(actor, { period }),
  ]);

  return (
    <AdminShell
      routeId="affiliate"
      title="提携と成果"
      lead="提携先と成果額を見ます。順位には影響しません。"
      actions={
        <>
          <TextLink href="/admin/affiliate/links">登録したリンク</TextLink>
          <TextLink href="/admin/affiliate/accounts/new">提携先を登録する</TextLink>
          <TextLink href="/admin/affiliate/programs/new">提携条件を登録する</TextLink>
          <TextLink href="/admin">ホームへ戻る</TextLink>
        </>
      }
    >
      {!accounts.ok ? (
        <ErrorView
          title="提携先の一覧を出せませんでした"
          body={accounts.error.message}
          suggestedAction={accounts.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <>
          <StorageNotice status={await affiliateStorageNotice()} />

          <Callout
            tone="info"
            title="この金額は記事の順位に入りません"
            reason="報酬の額を順位づけの計算へ渡せないよう、プログラムの作りとして止めています。渡そうとすると組み上がりません。"
          />

          <Section title="提携先">
            {accounts.value.total === 0 ? (
              <EmptyView
                title="提携先がありません"
                body={accounts.value.emptyReason ?? "まだ提携先を登録していません。"}
                action={
                  <TextLink href="/admin/affiliate/accounts/new">提携先を登録する</TextLink>
                }
              />
            ) : (
              <>
                <Prose>
                  各サービスのパスワードや鍵はここに控えていません。
                  登録は、ご自身のブラウザで各サービスの画面から行ってください。
                </Prose>
                <DataTable
                  caption="登録してある提携先と、接続情報の有無"
                  columns={[
                    { key: "asp", label: "提携先" },
                    { key: "label", label: "名前" },
                    { key: "public", label: "公開されるID" },
                    { key: "cred", label: "接続情報" },
                  ]}
                  rows={accounts.value.items.map((a) => ({
                    key: a.accountId,
                    cells: [
                      a.aspLabel,
                      a.label,
                      a.publicTrackingId ?? "—",
                      a.credentialRegistered ? "登録済み" : "未登録",
                    ],
                  }))}
                />
                {accounts.value.items
                  .filter((a) => a.blockedReason !== null)
                  .map((a) => (
                    <Callout
                      key={a.accountId}
                      tone="warn"
                      title={`${a.aspLabel}：いまは使えません`}
                      reason={a.blockedReason ?? ""}
                    />
                  ))}
              </>
            )}
          </Section>

          <Section title="提携の条件">
            {!programs.ok ? (
              <ErrorView
                title="提携の条件を出せませんでした"
                body={programs.error.message}
                suggestedAction={programs.error.suggestedAction ?? null}
              />
            ) : programs.value.total === 0 ? (
              <EmptyView
                title="提携しているプログラムがありません"
                body={programs.value.emptyReason ?? "まだ提携していません。"}
                action={
                  <TextLink href="/admin/affiliate/programs/new">提携条件を登録する</TextLink>
                }
              />
            ) : (
              <>
                <Prose>
                  掲載してよい書き方の条件は、文章で書かれていて機械では判定できません。
                  {programs.value.restrictionCount}件の条件は、掲載前にご自身で確認してください。
                </Prose>
                {programs.value.items.map((p) => (
                  <SubSection key={p.programId} title={`${p.advertiserName}（${p.aspLabel}）`}>
                    <FactList
                      rows={[
                        { key: "reward", label: "報酬", value: p.rewardLabel },
                        { key: "approval", label: "承認率", value: p.approvalRateLabel },
                        { key: "days", label: "確定までの日数", value: p.confirmationDaysLabel },
                        { key: "cookie", label: "成果が残る期間", value: p.cookieDurationLabel },
                        {
                          key: "active",
                          label: "いまの状態",
                          value: p.active ? "提携中" : "終了しています",
                        },
                      ]}
                    />
                    {p.restrictions.length === 0 ? (
                      <Note>確認が要る条件は登録されていません。</Note>
                    ) : (
                      <ListView rows={p.restrictions.map((r) => ({ key: r, label: r }))} />
                    )}
                  </SubSection>
                ))}
              </>
            )}
          </Section>

          <Section title={`成果（${period}）`}>
            <ListView
              rows={periods.map((p) =>
                p === period
                  ? { key: p, label: `${p}（表示中）` }
                  : {
                      key: p,
                      label: `${p}を見る`,
                      href: `/admin/affiliate?period=${encodeURIComponent(p)}`,
                    },
              )}
            />
            {!conversions.ok ? (
              <ErrorView
                title="成果を出せませんでした"
                body={conversions.error.message}
                suggestedAction={conversions.error.suggestedAction ?? null}
              />
            ) : conversions.value.total === 0 ? (
              <EmptyView
                title="成果がありません"
                body={conversions.value.emptyReason ?? "この期間の成果はまだ取り込まれていません。"}
              />
            ) : (
              <>
                <FactList
                  rows={[
                    {
                      key: "approved",
                      label: "確定した合計",
                      value: conversions.value.approvedTotalLabel,
                    },
                    {
                      key: "pending",
                      label: "未確定の件数",
                      value: `${conversions.value.pendingCount}件`,
                    },
                    {
                      key: "closed",
                      label: "この期間",
                      value: conversions.value.closed ? "締め済み（直せません）" : "受付中",
                    },
                  ]}
                />
                <Prose>
                  合計には確定した成果だけを入れています。
                  未確定を足すと、入ってこない金額を見込みにしてしまうためです。
                </Prose>
                <DataTable
                  caption="この期間に発生した成果の 1 件ずつ"
                  columns={[
                    { key: "asp", label: "提携先" },
                    { key: "status", label: "状態" },
                    { key: "occurred", label: "発生日" },
                    { key: "ingested", label: "取り込んだ額", numeric: true },
                    { key: "adjusted", label: "直した額", numeric: true },
                    { key: "effective", label: "実際に使う額", numeric: true },
                  ]}
                  rows={conversions.value.items.map((c) => ({
                    key: c.conversionId,
                    cells: [
                      <TextLink
                        key="link"
                        href={`/admin/affiliate/${encodeURIComponent(c.conversionId)}`}
                      >
                        {c.aspLabel}
                      </TextLink>,
                      c.statusLabel,
                      c.occurredAt.toLocaleDateString("ja-JP"),
                      c.ingestedLabel,
                      c.adjustedLabel ?? "—",
                      c.effectiveLabel,
                    ],
                  }))}
                />
                <Note>
                  「未取得」は、まだ金額が取れていないという意味です。0円ではありません。
                </Note>
              </>
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
