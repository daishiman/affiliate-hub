import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, telemetryNotice, telemetryUseCases } from "@/presentation/composition";
import { Callout, Card, EmptyView, ErrorView, Page, StubNotice } from "@/presentation/ui";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * どのブログで、どのモデルを、いくら使ったか。
 *
 * この画面の役目は「合計を見せること」ではなく、
 * **費用がどこに寄っているかを 1 画面で分かるようにすること**。
 * だからブログ × モデルで畳み、費用の多い順に固定して並べる。
 * 並べ替えを画面で選ばせない（見たいのは常に「どこにお金が出ているか」）。
 *
 * 数字と一緒に**その数字の限界**も出す。概算であること、
 * 価格未登録のモデルがあると少なく見えること。
 * 限界を書かない金額は、そのまま予算の根拠にされてしまう。
 */
export default async function AiUsagePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const days = Number(params.days) > 0 ? Number(params.days) : 30;
  const siteSlug = params.site !== undefined && params.site !== "" ? params.site : undefined;

  const actor = await currentActor();
  const report = await telemetryUseCases().aiUsage.execute(actor, { days, siteSlug });

  if (!report.ok) {
    return (
      <Shell>
        <ErrorView
          title="AI の利用状況を出せませんでした"
          body={report.error.message}
          suggestedAction={report.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  const v = report.value;

  return (
    <Shell>
      <StubNotice
        what="計測の記録先"
        blockedBy="telemetry_events / ai_model_usage テーブルの追加"
        stubId="persistence:telemetry-memory"
      >
        <span>{telemetryNotice()}</span>
      </StubNotice>

      <Card>
        <h2 className={styles.sectionTitle}>直近 {days} 日の合計</h2>
        <ul className={styles.linkList}>
          <li>
            呼び出し {v.totalCalls.toLocaleString("ja-JP")} 回
            <span className={styles.linkNote}>うち失敗 {v.totalFailures} 回</span>
          </li>
          <li>
            概算費用 {v.totalCostLabel}
            <span className={styles.linkNote}>請求額とは一致しません</span>
          </li>
        </ul>
        {v.caveats.map((c) => (
          <Callout key={c} tone="info" title="この数字の読み方" reason={c} />
        ))}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>ブログ × モデル</h2>
        {v.rows.length === 0 ? (
          <EmptyView
            title="この期間に AI の利用はありません"
            body={v.emptyReason ?? "記事を生成すると、ここに使ったモデルと費用が並びます。"}
            action={<Link href="/admin/generation">生成の仕組みを見る</Link>}
          />
        ) : (
          <table className={styles.rankTable}>
            <caption>費用の多い順。同額のときはブログ名の順。</caption>
            <thead>
              <tr>
                <th scope="col">ブログ</th>
                <th scope="col">モデル</th>
                <th scope="col">呼び出し</th>
                <th scope="col">失敗</th>
                <th scope="col">入力トークン</th>
                <th scope="col">出力トークン</th>
                <th scope="col">平均時間</th>
                <th scope="col">概算費用</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r) => (
                <tr key={`${r.siteSlug}-${r.modelId}`}>
                  <th scope="row">{r.siteSlug}</th>
                  <td>{r.modelLabel}</td>
                  <td className={styles.numeric}>{r.calls.toLocaleString("ja-JP")}</td>
                  <td className={styles.numeric}>{r.failures}</td>
                  <td className={styles.numeric}>{r.inputTokens.toLocaleString("ja-JP")}</td>
                  <td className={styles.numeric}>{r.outputTokens.toLocaleString("ja-JP")}</td>
                  <td className={styles.numeric}>{(r.avgDurationMs / 1000).toFixed(1)} 秒</td>
                  <td className={styles.numeric}>
                    {r.priced ? r.costLabel : "価格未登録"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={styles.linkNote}>
          プロンプトの本文と生成された文章は、この記録には含めていません。作られたものへの参照
          ID だけを持っています。
        </p>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>期間を変える</h2>
        <ul className={styles.linkList}>
          {[7, 30, 90].map((d) => (
            <li key={d}>
              {d === days ? (
                <span>直近 {d} 日（表示中）</span>
              ) : (
                <Link href={`/admin/ai-usage?days=${d}`}>直近 {d} 日を見る</Link>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/ai-usage"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "AI の利用と費用" }]}
      actions={<Link href="/admin/analytics">数字を見る</Link>}
    >
      <Page
        title="AI の利用と費用"
        lead="どのブログで、誰が、どのモデルをどれだけ使ったかを見る画面です。費用は概算で、請求額とは一致しません。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
