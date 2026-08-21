import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  affiliatePeriods,
  affiliateStorageNotice,
  affiliateUseCases,
  currentActor,
} from "@/presentation/composition";
import {
  Callout,
  Card,
  EmptyView,
  ErrorView,
  Page,
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
        <h2 className={styles.sectionTitle}>提携先</h2>
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
            <table className={styles.rankTable}>
              <thead>
                <tr>
                  <th scope="col">提携先</th>
                  <th scope="col">名前</th>
                  <th scope="col">公開されるID</th>
                  <th scope="col">接続情報</th>
                </tr>
              </thead>
              <tbody>
                {accounts.value.items.map((a) => (
                  <tr key={a.accountId}>
                    <th scope="row">{a.aspLabel}</th>
                    <td>{a.label}</td>
                    <td>{a.publicTrackingId ?? "—"}</td>
                    <td>{a.credentialRegistered ? "登録済み" : "未登録"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        <h2 className={styles.sectionTitle}>提携の条件</h2>
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
                <h3 className={styles.sectionTitle}>
                  {p.advertiserName}（{p.aspLabel}）
                </h3>
                <dl className={styles.criteria}>
                  <div>
                    <dt>報酬</dt>
                    <dd>{p.rewardLabel}</dd>
                  </div>
                  <div>
                    <dt>承認率</dt>
                    <dd className={styles.numeric}>{p.approvalRateLabel}</dd>
                  </div>
                  <div>
                    <dt>確定までの日数</dt>
                    <dd className={styles.numeric}>{p.confirmationDaysLabel}</dd>
                  </div>
                  <div>
                    <dt>成果が残る期間</dt>
                    <dd className={styles.numeric}>{p.cookieDurationLabel}</dd>
                  </div>
                  <div>
                    <dt>いまの状態</dt>
                    <dd>{p.active ? "提携中" : "終了しています"}</dd>
                  </div>
                </dl>
                {p.restrictions.length === 0 ? (
                  <p className={styles.linkNote}>確認が要る条件は登録されていません。</p>
                ) : (
                  <ul className={styles.linkList}>
                    {p.restrictions.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>成果（{period}）</h2>
        <ul className={styles.linkList}>
          {periods.map((p) => (
            <li key={p}>
              {p === period ? (
                <span>{p}（表示中）</span>
              ) : (
                <Link href={`/admin/affiliate?period=${encodeURIComponent(p)}`}>{p}を見る</Link>
              )}
            </li>
          ))}
        </ul>
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
            <dl className={styles.criteria}>
              <div>
                <dt>確定した合計</dt>
                <dd className={styles.numeric}>{conversions.value.approvedTotalLabel}</dd>
              </div>
              <div>
                <dt>未確定の件数</dt>
                <dd className={styles.numeric}>{conversions.value.pendingCount}件</dd>
              </div>
              <div>
                <dt>この期間</dt>
                <dd>{conversions.value.closed ? "締め済み（直せません）" : "受付中"}</dd>
              </div>
            </dl>
            <p className={styles.sectionLead}>
              合計には確定した成果だけを入れています。
              未確定を足すと、入ってこない金額を見込みにしてしまうためです。
            </p>
            <table className={styles.rankTable}>
              <thead>
                <tr>
                  <th scope="col">提携先</th>
                  <th scope="col">状態</th>
                  <th scope="col">発生日</th>
                  <th scope="col">取り込んだ額</th>
                  <th scope="col">直した額</th>
                  <th scope="col">実際に使う額</th>
                </tr>
              </thead>
              <tbody>
                {conversions.value.items.map((c) => (
                  <tr key={c.conversionId}>
                    <th scope="row">
                      <Link href={`/admin/affiliate/${encodeURIComponent(c.conversionId)}`}>
                        {c.aspLabel}
                      </Link>
                    </th>
                    <td>{c.statusLabel}</td>
                    <td>{c.occurredAt.toLocaleDateString("ja-JP")}</td>
                    <td className={styles.numeric}>{c.ingestedLabel}</td>
                    <td className={styles.numeric}>{c.adjustedLabel ?? "—"}</td>
                    <td className={styles.numeric}>{c.effectiveLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.linkNote}>
              「未取得」は、まだ金額が取れていないという意味です。0円ではありません。
            </p>
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
