import {
  READER_SEGMENTS,
  READER_SEGMENT_LABEL,
  VIEWPORT_BANDS,
  VIEWPORT_BAND_LABEL,
  type ViewportBand,
  evidenceVerdict,
} from "@/domain/analytics/reader-interaction";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { chooseMetricsRange } from "@/presentation/admin/metrics-range";
import { RebuildDailyMetricsForm } from "@/presentation/admin/observe/metrics-rebuild-form";
import { blogAudienceEntry, currentActor } from "@/presentation/composition";
import {
  BarChart,
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  Prose,
  Section,
  SummaryStrip,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 読者の行動を見る画面。**売上は出さない。**
 *
 * 入口が売上と分かれているのは、必要な権限が違うからで、見た目の
 * 都合ではない (`blogAudienceEntry` / `blogRevenueEntry` の doc)。
 * ここに報酬の列を足すと、読者の見え方だけを見せたい役割に
 * 報酬まで渡ることになる。
 */
export default async function SiteAudiencePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly site: string }>;
  readonly searchParams: Promise<{
    readonly from?: string;
    readonly to?: string;
    readonly article?: string;
    readonly viewport?: string;
  }>;
}) {
  const { site: siteSlug } = await params;
  const query = await searchParams;
  const range = chooseMetricsRange(query);
  const articleSlug = query.article ?? "";
  /*
    画面幅の絞り込み。**知らない値は「絞らない」に倒す。**
    URL を手で書き換えられても空の表を出さないため、そして
    区分名を増やした日に古いリンクが壊れないためである。
  */
  const viewportBand = VIEWPORT_BANDS.find((band) => band === query.viewport);
  const sitePath = `/admin/sites/${encodeURIComponent(siteSlug)}`;
  /** 幅の選択だけを差し替えたこの画面への行き先。他の条件は保つ。 */
  const audienceHref = (band: ViewportBand | null): string => {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (articleSlug !== "") params.set("article", articleSlug);
    if (band !== null) params.set("viewport", band);
    return `${sitePath}/audience?${params.toString()}`;
  };

  const entry = await blogAudienceEntry();
  if (!entry.ready) {
    return (
      <AdminShell
        routeId="sites/[site]/audience"
        routeParams={{ site: siteSlug }}
        breadcrumbLabels={{ "sites/[site]": "ブログ" }}
        title="読者の行動"
        lead="どんな読者がどこを読んでいるかを見ます。"
      >
        <ErrorView
          title="読者の行動を開けませんでした"
          body={entry.reason}
          suggestedAction={null}
          action={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
        />
      </AdminShell>
    );
  }

  const result = await entry.read.execute(await currentActor(), {
    siteSlug,
    ...(articleSlug === "" ? {} : { articleSlug }),
    ...(viewportBand === undefined ? {} : { viewportBand }),
    from: range.from,
    to: range.to,
  });

  const totalViews = result.ok ? result.value.daily.reduce((sum, day) => sum + day.views, 0) : 0;

  /*
   * 数字は出すが、**読み方は出さない**。伏せるのは解釈の側だけで、
   * 数字ごと隠すと「計測が壊れている」のか「まだ少ない」のかを
   * 運営者が区別できなくなる。理由は必ず画面に書く。
   */
  const evidence = evidenceVerdict(result.ok ? result.value.daily : []);
  const meaning = (whenSufficient: string) =>
    evidence.sufficient ? whenSufficient : "まだ読み方は出しません（根拠が足りません）。";

  return (
    <AdminShell
      routeId="sites/[site]/audience"
      routeParams={{ site: siteSlug }}
      breadcrumbLabels={{ "sites/[site]": "ブログ" }}
      title="読者の行動"
      lead={`${range.from} 〜 ${range.to} の読み方を見ます。次に直す記事を決めるための画面です。`}
      actions={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
    >
      {range.fallbackReason === null ? null : (
        <Callout
          tone="warn"
          title="指定された期間を使いませんでした"
          reason={`${range.fallbackReason} 代わりに ${range.from} 〜 ${range.to} を出しています。`}
        />
      )}

      {!result.ok ? (
        <ErrorView
          title="読者の行動を開けませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
        />
      ) : result.value.daily.length === 0 ? (
        <EmptyView
          title="この期間の記録がありません"
          body={
            "読者の行動は、読まれた時点から集計されます。公開した直後や、まだ誰も開いていない期間は空になります。"
          }
          action={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
        />
      ) : (
        <>
          {evidence.sufficient ? null : (
            <Callout
              tone="warn"
              title="数字は出しますが、読み方はまだ出しません"
              reason={`${evidence.reason} 少ない観測から読み取ると、1 人の偶然を全体の傾向だと思い込むことになります。`}
            />
          )}
          <Section title="この期間の読まれ方">
            <SummaryStrip
              label="この期間の読まれ方の要約"
              metrics={[
                {
                  key: "views",
                  label: "読まれた回数",
                  value: totalViews.toLocaleString("ja-JP"),
                  meaning: meaning(
                    "少ないなら、直すべきは記事の中身より、届き方（検索・導線）です。",
                  ),
                },
                {
                  key: "sessions",
                  label: "訪れた人（延べ）",
                  value: result.value.daily
                    .reduce((sum, day) => sum + day.uniqueSessions, 0)
                    .toLocaleString("ja-JP"),
                  meaning: meaning(
                    "読まれた回数との差が大きいなら、1 人が複数の記事を読んでいます。回遊は効いています。",
                  ),
                },
                {
                  key: "dwell",
                  label: "平均の滞在（秒）",
                  value: Math.round(
                    result.value.daily.reduce((sum, day) => sum + day.averageDwellSeconds, 0) /
                      result.value.daily.length,
                  ).toLocaleString("ja-JP"),
                  meaning: meaning(
                    "短いなら、冒頭で「探していたものと違う」と判断されています。",
                  ),
                },
              ]}
            />
          </Section>

          <Section title="日ごとの推移">
            <BarChart
              title="日ごとに読まれた回数"
              unit="回"
              period={`${range.from} 〜 ${range.to}`}
              textSummary={`${result.value.daily.length} 日ぶんの読まれた回数です。合計 ${totalViews.toLocaleString("ja-JP")} 回。`}
              pointValues={result.value.daily.map((day) => ({
                key: day.day,
                label: day.day,
                value: day.views,
                valueLabel: `${day.views.toLocaleString("ja-JP")} 回`,
              }))}
            />
          </Section>

          <Section title="どこから来ているか">
            <DataTable
              caption="流入の内訳と画面幅の内訳"
              columns={[
                { key: "label", label: "区分" },
                { key: "count", label: "回数", numeric: true },
              ]}
              rows={[
                ...READER_SEGMENTS.map((segment) => ({
                  key: `segment-${segment}`,
                  cells: [
                    READER_SEGMENT_LABEL[segment],
                    result.value.breakdown.bySegment[segment].toLocaleString("ja-JP"),
                  ],
                })),
                ...VIEWPORT_BANDS.map((band) => ({
                  key: `viewport-${band}`,
                  cells: [
                    VIEWPORT_BAND_LABEL[band],
                    result.value.breakdown.byViewport[band].toLocaleString("ja-JP"),
                  ],
                })),
              ]}
            />
          </Section>

          <Section title="記事の中のどこを読んでいるか">
            {/*
              幅ごとの切替。**同じ記事でも、狭い画面と広い画面では
              読まれ方が別物になる。**まとめた分布だけを見ていると、
              片方でだけ起きている離脱が平均に埋もれて見えなくなる。
            */}
            {result.value.engagement === null ? null : (
              <Prose>
                画面幅で絞る：
                {[null, ...VIEWPORT_BANDS].map((band) => (
                  <span key={band ?? "all"}>
                    {" "}
                    {band === result.value.viewportBand ? (
                      <strong>{band === null ? "全部" : VIEWPORT_BAND_LABEL[band]}</strong>
                    ) : (
                      <TextLink href={audienceHref(band)}>
                        {band === null ? "全部" : VIEWPORT_BAND_LABEL[band]}
                      </TextLink>
                    )}
                  </span>
                ))}
              </Prose>
            )}
            {result.value.engagement === null ? (
              <Prose>
                この内訳は、記事を 1 本に絞ったときだけ出ます。記事の一覧から 1 本選ぶと、
                どこまで読まれ、どこが押されているかが見えます。
              </Prose>
            ) : (
              <>
                <BarChart
                  title="記事のどこまで届いているか"
                  unit="%"
                  period={`${range.from} 〜 ${range.to}`}
                  textSummary={meaning(
                    result.value.viewportBand === null
                      ? "記事を上から下まで等分し、各区間まで読み進んだ人の割合です。急に落ちる区間が、離脱している場所です。"
                      : `${VIEWPORT_BAND_LABEL[result.value.viewportBand]}で読んだ人だけの到達率です。他の幅と形が違うなら、その幅での見え方に原因があります。`,
                  )}
                  pointValues={result.value.engagement.buckets.map((bucket) => ({
                    key: `${bucket.from}`,
                    label: `${Math.round(bucket.from * 100)}〜${Math.round(bucket.to * 100)}%`,
                    value: Math.round(bucket.reachRatio * 100),
                    valueLabel: `${Math.round(bucket.reachRatio * 100)}% が到達・平均 ${Math.round(bucket.averageDwellSeconds)} 秒`,
                  }))}
                />
                <DataTable
                  caption="押された場所ごとのクリック率"
                  columns={[
                    { key: "element", label: "場所" },
                    { key: "rate", label: "クリック率", numeric: true },
                  ]}
                  rows={Object.entries(result.value.engagement.clickThroughByElement)
                    .sort(([, a], [, b]) => b - a)
                    .map(([element, rate]) => ({
                      key: element,
                      cells: [element, `${(rate * 100).toFixed(1)}%`],
                    }))}
                />
              </>
            )}
          </Section>
        </>
      )}

      {/*
        数字が空・欠けている日を直すための欄。**結果の成否によらず出す。**
        直したい場面は「この期間の記録がありません」と出ているときそのものなので、
        空表示の枝の中へ入れると、いちばん要る場面で消える。
      */}
      <Section title="数字が欠けているとき">
        <Prose>
          日ごとの集計は毎日自動で作り直されますが、見ているのは当日と前日だけです。
          それより前の日で作成に失敗していると、その日は空のまま残ります。日付を指定して、
          その 1 日だけを作り直せます。作り直しは何度行っても同じ結果になります。
        </Prose>
        <RebuildDailyMetricsForm siteSlug={siteSlug} />
      </Section>
    </AdminShell>
  );
}
