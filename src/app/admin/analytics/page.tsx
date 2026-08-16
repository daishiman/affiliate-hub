import Link from "next/link";
import type { ReactNode } from "react";
import { FEEDBACK_TARGET_LABEL } from "@/application/usecases/analytics/read-metrics";
import { analyticsNotice, analyticsUseCases, currentActor } from "@/presentation/composition";
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

/** 画面で選べる用途。順位とおすすめは、収益の数字を受け付けない側。 */
const TARGETS = [
  "article_revision",
  "topic_selection",
  "ranking_score",
  "product_recommendation",
  "quality_threshold",
] as const;

/**
 * 数字。
 *
 * この画面の役目は数字を並べることではなく、
 * **その数字を何に使ってよいかを一緒に出す**こと。
 * 「売れた商品を上に出す」は誰も悪意なくやってしまうので、
 * 用途ごとに使える数字を画面で分けている。
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly target?: string }>;
}) {
  const { target: requested } = await searchParams;
  const target = TARGETS.includes(requested as (typeof TARGETS)[number])
    ? (requested as (typeof TARGETS)[number])
    : "article_revision";

  const actor = await currentActor();
  const uc = analyticsUseCases();

  const [metrics, usable] = await Promise.all([
    uc.listMetrics.execute(actor, {}),
    uc.listUsableMetrics.execute(actor, { target }),
  ]);

  if (!metrics.ok) {
    return (
      <Shell>
        <ErrorView
          title="数字を出せませんでした"
          body={metrics.error.message}
          suggestedAction={metrics.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  const groups = ["reader", "ai", "quality", "commercial"] as const;

  return (
    <Shell>
      <StubNotice
        what="数字の保存先と計測"
        blockedBy="公開後の実際の計測（Cloudflare Analytics の接続）"
        stubId="persistence:analytics-sample"
      >
        <span>{analyticsNotice()}</span>
      </StubNotice>

      <Callout
        tone="info"
        title="収益の数字は順位に戻せません"
        reason="よく売れた商品を上に出すことは、最も自然に起きる形の評価の汚れです。用途ごとに使える数字を分けており、順位とおすすめの決定では収益の数字を選べません。"
      />

      {metrics.value.measuredCount === 0 ? (
        <Card>
          <EmptyView
            title="まだ計測されていません"
            body={metrics.value.emptyReason ?? "公開して読まれ始めると数字が入ります。"}
            action={<Link href="/admin/content">記事の進行を見る</Link>}
          />
        </Card>
      ) : (
        groups.map((group) => {
          const rows = metrics.value.rows.filter((r) => r.category === group);
          if (rows.length === 0) return null;
          return (
            <Card key={group}>
              <h2 className={styles.sectionTitle}>{rows[0]?.categoryLabel ?? group}</h2>
              <table className={styles.rankTable}>
                <thead>
                  <tr>
                    <th scope="col">数字</th>
                    <th scope="col">直近30日</th>
                    <th scope="col">母数</th>
                    <th scope="col">どう数えたか</th>
                    <th scope="col">編集判断への利用</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <th scope="row">{r.label}</th>
                      <td className={styles.numeric}>{r.valueLabel}</td>
                      <td className={styles.numeric}>
                        {r.denominator === null ? "—" : r.denominator.toLocaleString("ja-JP")}
                      </td>
                      <td>{r.howCounted}</td>
                      <td>{r.usableForEditorialJudgement ? "使えます" : "使えません"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows
                .filter((r) => r.notUsableReason !== null)
                .slice(0, 1)
                .map((r) => (
                  <Callout
                    key={r.key}
                    tone="warn"
                    title="この区分の数字の使い道"
                    reason={r.notUsableReason ?? ""}
                  />
                ))}
              <p className={styles.linkNote}>
                「未計測」は、まだ数えられていないという意味です。0 ではありません。
              </p>
            </Card>
          );
        })
      )}

      <Card>
        <h2 className={styles.sectionTitle}>用途ごとに使ってよい数字</h2>
        <ul className={styles.linkList}>
          {TARGETS.map((t) => (
            <li key={t}>
              {t === target ? (
                <span>{FEEDBACK_TARGET_LABEL[t]}（表示中）</span>
              ) : (
                <Link href={`/admin/analytics?target=${t}`}>{FEEDBACK_TARGET_LABEL[t]}を見る</Link>
              )}
            </li>
          ))}
        </ul>
        {!usable.ok ? (
          <ErrorView
            title="使ってよい数字を出せませんでした"
            body={usable.error.message}
            suggestedAction={usable.error.suggestedAction ?? null}
          />
        ) : (
          <>
            <h3 className={styles.sectionTitle}>
              {usable.value.targetLabel}に使える数字（{usable.value.usable.length}件）
            </h3>
            {usable.value.usable.length === 0 ? (
              <EmptyView
                title="使える数字がありません"
                body="この用途に使える数字がまだ定義されていません。"
              />
            ) : (
              <ul className={styles.linkList}>
                {usable.value.usable.map((m) => (
                  <li key={m.key}>
                    {m.label}
                    <span className={styles.linkNote}>{m.howCounted}</span>
                  </li>
                ))}
              </ul>
            )}
            {usable.value.rejected.length === 0 ? (
              <p className={styles.linkNote}>この用途で使えない数字はありません。</p>
            ) : (
              <>
                <h3 className={styles.sectionTitle}>
                  使えない数字（{usable.value.rejected.length}件）
                </h3>
                <ul className={styles.linkList}>
                  {usable.value.rejected.map((r) => (
                    <li key={r.label}>
                      {r.label}
                      <span className={styles.linkNote}>{r.reason}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AppShell
      currentPath="/admin/analytics"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "数字" }]}
      actions={<Link href="/admin">ホームへ戻る</Link>}
    >
      <Page
        title="数字"
        lead="どれだけ読まれたか、どこに手を入れるべきかを見る画面です。数字ごとに「何に使ってよいか」も一緒に出します。"
      >
        {children}
      </Page>
    </AppShell>
  );
}
