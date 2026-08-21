import {
  affiliatePeriods,
  affiliateStorageNotice,
  affiliateUseCases,
  currentActor,
} from "@/presentation/composition";
import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Callout,
  Card,
  DataTable,
  DefinitionList,
  EmptyView,
  ErrorView,
  Note,
  Page,
  SectionHeading,
  StackedList,
  StackedRow,
  StorageNotice,
} from "@/presentation/ui";
import styles from "../admin.module.css";

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

  if (!accounts.ok) {
    return (
      <Shell>
        <ErrorView
          title="提携先の一覧を出せませんでした"
          body={accounts.error.message}
          suggestedAction={accounts.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <StorageNotice status={await affiliateStorageNotice()} />

      <Callout
        tone="info"
        title="この金額は記事の順位に入りません"
        reason="報酬の額を順位づけの計算へ渡せないよう、プログラムの作りとして止めています。渡そうとすると組み上がりません。"
      />

      <Card>
        <SectionHeading level={2}>提携先</SectionHeading>
        {accounts.value.total === 0 ? (
          <EmptyView
            title="提携先がありません"
            body={accounts.value.emptyReason ?? "まだ提携先を登録していません。"}
          />
        ) : (
          <>
            <p className={styles.sectionLead}>
              各サービスのパスワードや鍵はここに控えていません。
              登録は、ご自身のブラウザで各サービスの画面から行ってください。
            </p>
            <DataTable
              caption="登録してある提携先の口座と、接続情報が入っているかどうか。"
              columns={[
                { key: "asp", header: "提携先", rowHeader: true, cell: (a) => a.aspLabel },
                { key: "label", header: "名前", cell: (a) => a.label },
                {
                  key: "trackingId",
                  header: "公開されるID",
                  cell: (a) => a.publicTrackingId ?? "—",
                },
                {
                  key: "credential",
                  header: "接続情報",
                  cell: (a) => (a.credentialRegistered ? "登録済み" : "未登録"),
                },
              ]}
              rows={accounts.value.items}
              rowKey={(a) => a.accountId}
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
      </Card>

      <Card>
        <SectionHeading level={2}>提携の条件</SectionHeading>
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
          />
        ) : (
          <>
            <p className={styles.sectionLead}>
              掲載してよい書き方の条件は、文章で書かれていて機械では判定できません。
              {programs.value.restrictionCount}件の条件は、掲載前にご自身で確認してください。
            </p>
            {programs.value.items.map((p) => (
              <div key={p.programId}>
                <SectionHeading level={3}>
                  {p.advertiserName}（{p.aspLabel}）
                </SectionHeading>
                <DefinitionList
                  items={[
                    { term: "報酬", description: p.rewardLabel },
                    { term: "承認率", description: p.approvalRateLabel, align: "numeric" },
                    {
                      term: "確定までの日数",
                      description: p.confirmationDaysLabel,
                      align: "numeric",
                    },
                    {
                      term: "成果が残る期間",
                      description: p.cookieDurationLabel,
                      align: "numeric",
                    },
                    { term: "いまの状態", description: p.active ? "提携中" : "終了しています" },
                  ]}
                />
                {p.restrictions.length === 0 ? (
                  <Note>確認が要る条件は登録されていません。</Note>
                ) : (
                  <StackedList>
                    {p.restrictions.map((r) => (
                      <StackedRow key={r}>{r}</StackedRow>
                    ))}
                  </StackedList>
                )}
              </div>
            ))}
          </>
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>成果（{period}）</SectionHeading>
        <StackedList>
          {periods.map((p) => (
            <StackedRow key={p}>
              {p === period ? (
                <span>{p}（表示中）</span>
              ) : (
                <Link href={`/admin/affiliate?period=${encodeURIComponent(p)}`}>{p}を見る</Link>
              )}
            </StackedRow>
          ))}
        </StackedList>
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
            <DefinitionList
              items={[
                {
                  term: "確定した合計",
                  description: conversions.value.approvedTotalLabel,
                  align: "numeric",
                },
                {
                  term: "未確定の件数",
                  description: `${conversions.value.pendingCount}件`,
                  align: "numeric",
                },
                {
                  term: "この期間",
                  description: conversions.value.closed ? "締め済み（直せません）" : "受付中",
                },
              ]}
            />
            <p className={styles.sectionLead}>
              合計には確定した成果だけを入れています。
              未確定を足すと、入ってこない金額を見込みにしてしまうためです。
            </p>
            <DataTable
              caption="成果の記録。取り込んだ額と、直したあとに実際に使う額を並べて出す。"
              columns={[
                {
                  key: "asp",
                  header: "提携先",
                  rowHeader: true,
                  cell: (c) => (
                    <Link href={`/admin/affiliate/${encodeURIComponent(c.conversionId)}`}>
                      {c.aspLabel}
                    </Link>
                  ),
                },
                { key: "status", header: "状態", cell: (c) => c.statusLabel },
                {
                  key: "occurredAt",
                  header: "発生日",
                  cell: (c) => c.occurredAt.toLocaleDateString("ja-JP"),
                },
                {
                  key: "ingested",
                  header: "取り込んだ額",
                  align: "numeric",
                  cell: (c) => c.ingestedLabel,
                },
                {
                  key: "adjusted",
                  header: "直した額",
                  align: "numeric",
                  cell: (c) => c.adjustedLabel ?? "—",
                },
                {
                  key: "effective",
                  header: "実際に使う額",
                  align: "numeric",
                  cell: (c) => c.effectiveLabel,
                },
              ]}
              rows={conversions.value.items}
              rowKey={(c) => c.conversionId}
            />
            <Note>
              「未取得」は、まだ金額が取れていないという意味です。0円ではありません。
            </Note>
          </>
        )}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/affiliate"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "提携と成果" }]}
      actions={<Link href="/admin">ホームへ戻る</Link>}
    >
      <Page
        title="提携と成果"
        lead="どこと提携していて、いくら成果が出たかを見る画面です。ここの金額は記事の順位には入りません。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
