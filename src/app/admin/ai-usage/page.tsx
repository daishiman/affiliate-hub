import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, telemetryNotice, telemetryUseCases } from "@/presentation/composition";
import {
  ActionNote,
  BarChart,
  DataTable,
  DecisionStatus,
  EmptyView,
  ErrorView,
  ListView,
  Note,
  Section,
  StorageNotice,
  SummaryStrip,
  TextLink,
} from "@/presentation/ui";

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
 *
 * 読み方の但し書きは `ActionNote` で出す。`Callout` にしないのは、
 * 但し書きの件数が増えた日に、画面が注意書きだらけになるため。
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

  /*
   * 棒にするのは費用だけ。呼び出し回数やトークン数を同じ棒へ混ぜない。
   * 単位が違うものを並べると、棒の長さだけが比べられそうに見えてしまう。
   *
   * 上位 8 件で切る。全件を棒にすると「どこに寄っているか」が
   * 棒の本数に埋もれ、表と同じ読み方に戻ってしまう。
   * 価格未登録の行は費用 0 として扱われるため、棒からは外す
   * （0 の棒は「使っていない」に見えるが、実際は「値段が分からない」）。
   */
  const rows = report.ok ? report.value.rows : [];
  const costPoints = rows
    .filter((r) => r.priced && r.costJpy > 0)
    .slice(0, 8)
    .map((r) => ({
      key: `${r.siteSlug}-${r.modelId}`,
      label: `${r.siteSlug} / ${r.modelLabel}`,
      value: r.costJpy,
      valueLabel: r.costLabel,
    }));
  const unpricedCalls = rows.reduce((sum, r) => sum + r.unpricedCalls, 0);

  return (
    <AdminShell
      routeId="ai-usage"
      title="AI の利用と費用"
      lead="どのモデルをどれだけ使ったかを見ます。"
      actions={<TextLink href="/admin/analytics">数字を見る</TextLink>}
    >
      {!report.ok ? (
        <ErrorView
          title="AI の利用状況を出せませんでした"
          body={report.error.message}
          suggestedAction={report.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <>
          <StorageNotice status={await telemetryNotice()} />

          <Section title={`直近 ${days} 日の合計`}>
            <SummaryStrip
              label={`直近 ${days} 日の合計`}
              metrics={[
                {
                  key: "calls",
                  label: "呼び出し",
                  value: `${report.value.totalCalls.toLocaleString("ja-JP")}回`,
                  meaning: `うち失敗 ${report.value.totalFailures}回。失敗が増えていれば、生成の設定かモデルの選び方を見直します。`,
                },
                {
                  key: "cost",
                  label: "概算費用",
                  value: report.value.totalCostLabel,
                  meaning: "請求額とは一致しません。予算の目安としてだけ使います。",
                  action: (
                    <DecisionStatus
                      status={unpricedCalls > 0 ? "insufficient-n" : "provisional"}
                      detail={
                        unpricedCalls > 0
                          ? `価格未登録のモデルが ${unpricedCalls.toLocaleString("ja-JP")} 回ぶんあり、実際より少なく見えています。`
                          : "概算のため、請求が確定するまで値は変わります。"
                      }
                    />
                  ),
                },
              ]}
            />
            {report.value.caveats.map((c) => (
              <ActionNote key={c}>この数字の読み方: {c}</ActionNote>
            ))}
          </Section>

          <Section title="ブログ × モデル">
            {costPoints.length === 0 ? null : (
              <BarChart
                title="費用がどこに寄っているか"
                unit="円（概算）"
                period={`直近 ${days} 日`}
                textSummary={`費用の多い順に上位 ${costPoints.length} 件。棒の長さは、いちばん高い組み合わせを 1 とした割合です。`}
                pointValues={costPoints}
              />
            )}
            {report.value.rows.length === 0 ? (
              <EmptyView
                title="この期間に AI の利用はありません"
                body={
                  report.value.emptyReason ??
                  "記事を生成すると、ここに使ったモデルと費用が並びます。"
                }
                action={<TextLink href="/admin/generation">生成の仕組みを見る</TextLink>}
              />
            ) : (
              <DataTable
                caption="費用の多い順。同額のときはブログ名の順。"
                columns={[
                  { key: "site", label: "ブログ" },
                  { key: "model", label: "モデル" },
                  { key: "calls", label: "呼び出し", numeric: true },
                  { key: "failures", label: "失敗", numeric: true },
                  { key: "input", label: "入力トークン", numeric: true },
                  { key: "output", label: "出力トークン", numeric: true },
                  { key: "duration", label: "平均時間", numeric: true },
                  { key: "cost", label: "概算費用", numeric: true },
                ]}
                rows={report.value.rows.map((r) => ({
                  key: `${r.siteSlug}-${r.modelId}`,
                  cells: [
                    r.siteSlug,
                    r.modelLabel,
                    r.calls.toLocaleString("ja-JP"),
                    String(r.failures),
                    r.inputTokens.toLocaleString("ja-JP"),
                    r.outputTokens.toLocaleString("ja-JP"),
                    `${(r.avgDurationMs / 1000).toFixed(1)} 秒`,
                    r.priced ? r.costLabel : "価格未登録",
                  ],
                }))}
              />
            )}
            <Note>
              プロンプトの本文と生成された文章は、この記録には含めていません。作られたものへの参照
              ID だけを持っています。
            </Note>
          </Section>

          <Section title="期間を変える">
            <ListView
              rows={[7, 30, 90].map((d) =>
                d === days
                  ? { key: String(d), label: `直近 ${d} 日（表示中）` }
                  : {
                      key: String(d),
                      label: `直近 ${d} 日を見る`,
                      href: `/admin/ai-usage?days=${d}`,
                    },
              )}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
