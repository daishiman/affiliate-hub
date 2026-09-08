import { revenuePerView } from "@/domain/analytics/reader-interaction";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { chooseMetricsRange } from "@/presentation/admin/metrics-range";
import { blogRevenueEntry, currentActor } from "@/presentation/composition";
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
 * 記事ごとの成果（売上・PV・クリック率）を見る画面。
 *
 * --- 並べ替えの主軸を「1 表示あたりの売上」にした理由 ---
 * 売上の総額で並べると、単に読まれている記事が上に来る。伸ばす記事を
 * 選ぶときに知りたいのは「読まれた 1 回がいくらになっているか」で、
 * これが高い記事に読者を送るほうが、総額の大きい記事を触るより効く。
 */
const yen = (minor: number) => `${minor.toLocaleString("ja-JP")} 円`;

export default async function SiteRevenuePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly site: string }>;
  readonly searchParams: Promise<{ readonly from?: string; readonly to?: string }>;
}) {
  const { site: siteSlug } = await params;
  const range = chooseMetricsRange(await searchParams);
  const sitePath = `/admin/sites/${encodeURIComponent(siteSlug)}`;

  const entry = await blogRevenueEntry();
  if (!entry.ready) {
    return (
      <AdminShell
        routeId="sites/[site]/revenue"
        routeParams={{ site: siteSlug }}
        breadcrumbLabels={{ "sites/[site]": "ブログ" }}
        title="記事ごとの成果"
        lead="どの記事がどれだけ稼いでいるかを見ます。"
      >
        <ErrorView
          title="記事ごとの成果を開けませんでした"
          body={entry.reason}
          suggestedAction={null}
          action={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
        />
      </AdminShell>
    );
  }

  const result = await entry.read.execute(await currentActor(), {
    siteSlug,
    from: range.from,
    to: range.to,
  });

  return (
    <AdminShell
      routeId="sites/[site]/revenue"
      routeParams={{ site: siteSlug }}
      breadcrumbLabels={{ "sites/[site]": "ブログ" }}
      title="記事ごとの成果"
      lead={`${range.from} 〜 ${range.to} の売上と PV を、記事ごとに並べます。伸ばす記事と畳む記事を決めるための画面です。`}
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
          title="記事ごとの成果を開けませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
        />
      ) : result.value.daily.length === 0 ? (
        <EmptyView
          title="この期間の記録がありません"
          body="成果は、読者が記事を開いた時点から集計されます。公開直後や、まだ誰も開いていない期間は空になります。"
          action={<TextLink href={sitePath}>このブログへ戻る</TextLink>}
        />
      ) : (
        <>
          <Section title="この期間の合計">
            <SummaryStrip
              label="この期間の成果の要約"
              metrics={[
                {
                  key: "revenue",
                  label: "売上",
                  value: yen(result.value.totals.revenueMinor),
                  meaning: "この期間にこのブログ経由で確定した報酬です。取消は差し引き済みです。",
                },
                {
                  key: "ctr",
                  label: "クリック率",
                  value: `${(result.value.totals.clickThroughRate * 100).toFixed(1)}%`,
                  meaning:
                    "低いなら、直すのは商品ではなく置き場所です。読者の行動から、どこが押されているかを確かめてください。",
                },
                {
                  key: "conversions",
                  label: "成約",
                  value: result.value.totals.conversions.toLocaleString("ja-JP"),
                  meaning:
                    "クリックは多いのにここが少ないなら、記事と商品の中身がずれています。",
                },
              ]}
            />
            {/*
              数字の脇に置く注記は `Prose` に出す。この画面は上に期間の
              断りが出ることがあり、常時見える `Callout` は 2 つまで。
            */}
            <Prose>
              クリックしてから成約になるまでの間があるため、直近の数日は
              あとから増えることがあります。締めの判断は数日おいてからにしてください。
            </Prose>
          </Section>

          <Section title="日ごとの売上">
            <BarChart
              title="日ごとの売上"
              unit="円"
              period={`${range.from} 〜 ${range.to}`}
              textSummary={`${result.value.daily.length} 日ぶんの売上です。合計 ${yen(result.value.totals.revenueMinor)}。`}
              pointValues={result.value.daily.map((day) => ({
                key: day.day,
                label: day.day,
                value: day.revenueMinor,
                valueLabel: yen(day.revenueMinor),
              }))}
            />
          </Section>

          <Section title="記事ごとの成果">
            {result.value.articleRanking.length === 0 ? (
              <Prose>
                この期間に成果の付いた記事がありません。まずは読者の行動から、
                読まれている記事を確かめてください。
              </Prose>
            ) : (
              <DataTable
                caption="1 表示あたりの売上が高い順に並べた記事"
                columns={[
                  { key: "article", label: "記事" },
                  { key: "views", label: "PV", numeric: true },
                  { key: "clicks", label: "クリック", numeric: true },
                  { key: "ctr", label: "クリック率", numeric: true },
                  { key: "conversions", label: "成約", numeric: true },
                  { key: "revenue", label: "売上", numeric: true },
                  { key: "rpv", label: "1 表示あたり", numeric: true },
                ]}
                rows={result.value.articleRanking.map((article) => ({
                  key: article.articleSlug,
                  cells: [
                    article.articleSlug,
                    article.views.toLocaleString("ja-JP"),
                    article.clicks.toLocaleString("ja-JP"),
                    `${(article.views === 0 ? 0 : (article.clicks / article.views) * 100).toFixed(1)}%`,
                    article.conversions.toLocaleString("ja-JP"),
                    yen(article.revenueMinor),
                    `${revenuePerView(article).toFixed(1)} 円`,
                  ],
                }))}
              />
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
