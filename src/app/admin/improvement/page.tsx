import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, improvementNotice, improvementUseCases } from "@/presentation/composition";
import { Callout, Card, EmptyView, ErrorView, Page, StubNotice } from "@/presentation/ui";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * いま何を試していて、何が言えるのか。
 *
 * この画面で一番大事なのは「良くなった」を見せることではなく、
 * **まだ何も言えないものを、言えないまま出すこと**。
 * 判定できていないものを隠すと、実施中のまま忘れられた比較が溜まり、
 * 半年後に同じことをもう一度試すことになる。
 *
 * だから並べ方は状態順（実施中 → 判定済み）で固定し、
 * 「判定保留」「効果不明」も同じ大きさで出す。
 */
export default async function ImprovementPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const siteSlug = params.site !== undefined && params.site !== "" ? params.site : undefined;

  const actor = await currentActor();
  const review = await improvementUseCases().review.execute(actor, { siteSlug });

  if (!review.ok) {
    return (
      <Shell>
        <ErrorView
          title="改善の状況を出せませんでした"
          body={review.error.message}
          suggestedAction={review.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  const v = review.value;

  return (
    <Shell>
      <StubNotice
        what="改善ループの記録先"
        blockedBy="variant_specs / loop_runs / loop_observations テーブルの追加"
        stubId="persistence:improvement-sample"
      >
        <span>{improvementNotice()}</span>
      </StubNotice>

      <Card>
        <h2 className={styles.sectionTitle}>いまの状況</h2>
        <ul className={styles.linkList}>
          <li>
            実施中 {v.runningCount} 件
            <span className={styles.linkNote}>結果が出るまで待ちます</span>
          </li>
          <li>
            まだ判定できないもの {v.pendingCount} 件
            <span className={styles.linkNote}>件数が足りていません</span>
          </li>
        </ul>
        {v.caveats.map((c) => (
          <Callout key={c} tone="info" title="この数字の読み方" reason={c} />
        ))}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>試している比較</h2>
        {v.rows.length === 0 ? (
          <EmptyView
            title="まだ試している比較がありません"
            body={v.emptyReason ?? "変えてみたい軸を選ぶと、ここに比較が並びます。"}
            action={<Link href="/admin/improvement/dimensions">変えられるものを見る</Link>}
          />
        ) : (
          <table className={styles.rankTable}>
            <caption>実施中のものを先に並べています。判定できないものも隠さず出します。</caption>
            <thead>
              <tr>
                <th scope="col">ブログ</th>
                <th scope="col">変えたところ</th>
                <th scope="col">見ている指標</th>
                <th scope="col">状態</th>
                <th scope="col">いまの判定</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.siteSlug}</th>
                  <td>{r.changedLabels.join("・")}</td>
                  <td>{r.primaryMetricLabel}</td>
                  <td>{r.statusLabel}</td>
                  <td>{r.verdictLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {v.rows.map((r) => (
        <Card key={`detail-${r.id}`}>
          <h2 className={styles.sectionTitle}>
            {r.siteSlug}／{r.changedLabels.join("・")}
          </h2>
          <p className={styles.sectionLead}>
            {r.loopKindLabel}・{r.statusLabel}
          </p>
          {r.blockedReason !== null ? (
            <Callout tone="info" title="まだ判定していません" reason={r.blockedReason} />
          ) : (
            <Callout
              tone="info"
              title={r.verdictLabel}
              reason={r.result?.reason ?? "判定の理由が記録されていません。"}
            />
          )}
          {r.suggestions.length === 0 ? (
            <p className={styles.linkNote}>
              判定が出ていないため、次の一手はまだ出せません。件数が足りるまで待ちます。
            </p>
          ) : (
            <ul className={styles.linkList}>
              {r.suggestions.map((s) => (
                <li key={`${r.id}-${s.dimensionKey}`}>
                  {s.dimensionLabel}: {s.from} → {s.to}
                  <span className={styles.linkNote}>{s.rationale}</span>
                  <span className={styles.linkNote}>
                    適用には承認が要ります（見た目だけの変更でも同じです）。
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/improvement"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "改善の状況" }]}
      actions={<Link href="/admin/improvement/dimensions">変えられるものを見る</Link>}
    >
      <Page
        title="改善の状況"
        lead="いま何を試していて、何が言えるのかを見る画面です。件数が足りないものは「まだ分からない」と出します。数字を良く見せるために判定を緩めません。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
