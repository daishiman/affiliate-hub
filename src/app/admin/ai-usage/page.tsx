import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, telemetryNotice, telemetryUseCases } from "@/presentation/composition";
import {
  Callout,
  Card,
  DataTable,
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
  const uc = await telemetryUseCases();
  const report = await uc.aiUsage.execute(actor, { days, siteSlug });

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
      <StorageNotice status={await telemetryNotice()} />

      <Card>
        <SectionHeading level={2}>直近 {days} 日の合計</SectionHeading>
        <StackedList>
          <StackedRow note={<>うち失敗 {v.totalFailures} 回</>}>
            呼び出し {v.totalCalls.toLocaleString("ja-JP")} 回
            
          </StackedRow>
          <StackedRow note={<>請求額とは一致しません</>}>
            概算費用 {v.totalCostLabel}
            
          </StackedRow>
        </StackedList>
        {v.caveats.map((c) => (
          <Callout key={c} tone="info" title="この数字の読み方" reason={c} />
        ))}
      </Card>

      <Card>
        <SectionHeading level={2}>ブログ × モデル</SectionHeading>
        {v.rows.length === 0 ? (
          <EmptyView
            title="この期間に AI の利用はありません"
            body={v.emptyReason ?? "記事を生成すると、ここに使ったモデルと費用が並びます。"}
            action={<Link href="/admin/generation">生成の仕組みを見る</Link>}
          />
        ) : (
          <DataTable
            caption="費用の多い順。同額のときはブログ名の順。"
            columns={[
              { key: "site", header: "ブログ", rowHeader: true, cell: (r) => r.siteSlug },
              { key: "model", header: "モデル", cell: (r) => r.modelLabel },
              {
                key: "calls",
                header: "呼び出し",
                align: "numeric",
                cell: (r) => r.calls.toLocaleString("ja-JP"),
              },
              { key: "failures", header: "失敗", align: "numeric", cell: (r) => r.failures },
              {
                key: "inputTokens",
                header: "入力トークン",
                align: "numeric",
                cell: (r) => r.inputTokens.toLocaleString("ja-JP"),
              },
              {
                key: "outputTokens",
                header: "出力トークン",
                align: "numeric",
                cell: (r) => r.outputTokens.toLocaleString("ja-JP"),
              },
              {
                key: "duration",
                header: "平均時間",
                align: "numeric",
                cell: (r) => `${(r.avgDurationMs / 1000).toFixed(1)} 秒`,
              },
              {
                key: "cost",
                header: "概算費用",
                align: "numeric",
                cell: (r) => (r.priced ? r.costLabel : "価格未登録"),
              },
            ]}
            rows={v.rows}
            rowKey={(r) => `${r.siteSlug}-${r.modelId}`}
          />
        )}
        <Note>
          プロンプトの本文と生成された文章は、この記録には含めていません。作られたものへの参照
          ID だけを持っています。
        </Note>
      </Card>

      <Card>
        <SectionHeading level={2}>期間を変える</SectionHeading>
        <StackedList>
          {[7, 30, 90].map((d) => (
            <StackedRow key={d}>
              {d === days ? (
                <span>直近 {d} 日（表示中）</span>
              ) : (
                <Link href={`/admin/ai-usage?days=${d}`}>直近 {d} 日を見る</Link>
              )}
            </StackedRow>
          ))}
        </StackedList>
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
