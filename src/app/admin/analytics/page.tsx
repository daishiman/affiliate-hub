import { FEEDBACK_TARGET_LABEL } from "@/application/usecases/analytics/read-metrics";
import { ANALYTICS_AXIS_KEYS, type AnalyticsAxisKey } from "@/domain/analytics";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { analyticsNotice, analyticsUseCases, currentActor } from "@/presentation/composition";
import {
  ActionNote,
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  FilterBar,
  ListView,
  Note,
  Section,
  StorageNotice,
  SubSection,
  TextLink,
} from "@/presentation/ui";

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
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const requested = params.target;
  const target = TARGETS.includes(requested as (typeof TARGETS)[number])
    ? (requested as (typeof TARGETS)[number])
    : "article_revision";

  // 11 軸の指定は URL から拾う。軸の一覧は domain の定義に従う。
  const selectedAxes: Partial<Record<AnalyticsAxisKey, string>> = {};
  for (const key of ANALYTICS_AXIS_KEYS) {
    const value = params[key];
    if (value !== undefined && value.trim() !== "") selectedAxes[key] = value;
  }

  const actor = await currentActor();
  const uc = await analyticsUseCases();

  const [metrics, usable, filtered, coverage] = await Promise.all([
    uc.listMetrics.execute(actor, {}),
    uc.listUsableMetrics.execute(actor, { target }),
    uc.filterMetrics.execute(actor, { axes: selectedAxes }),
    uc.trackingCoverage.execute(actor, {}),
  ]);

  const groups = ["reader", "ai", "quality", "commercial"] as const;

  return (
    <AdminShell
      routeId="analytics"
      title="数字"
      lead="読まれ方と、次に手を入れる場所を見ます。"
      actions={<TextLink href="/admin">ホームへ戻る</TextLink>}
    >
      {!metrics.ok ? (
        <ErrorView
          title="数字を出せませんでした"
          body={metrics.error.message}
          suggestedAction={metrics.error.suggestedAction ?? null}
          action={<TextLink href="/admin">ホームへ戻る</TextLink>}
        />
      ) : (
        <>
          <StorageNotice status={await analyticsNotice()} />

          {/*
            クリック数を並べる前に、その数字がどこまでを含んでいるかを出す。
            合言葉が発行されていないリンクは ASP の URL が黙って出るだけで、
            押されたことは 1 件も記録されない。0 件のときも書く（何も出さないと、
            数え上げが動いていないのか本当に 0 なのかを画面から見分けられない）。
          */}
          {!coverage.ok ? (
            <Callout
              tone="warn"
              title="突合できるリンクの件数を数えられませんでした"
              reason={coverage.error.message}
            />
          ) : coverage.value.untracked === 0 ? null : (
            <Callout tone="warn" title={coverage.value.headline} reason={coverage.value.detail} />
          )}

          {/* 順位を触る操作の手前に置く。上に離して置くと、並べ替える瞬間には視界の外にある。 */}
          <ActionNote tone="danger">
            収益の数字は順位に戻せません。よく売れた商品を上に出すことは、最も自然に起きる形の評価の汚れです。
            用途ごとに使える数字を分けており、順位とおすすめの決定では収益の数字を選べません。
          </ActionNote>

          {metrics.value.measuredCount === 0 ? (
            <Section title="計測の状況">
              <EmptyView
                title="まだ計測されていません"
                body={metrics.value.emptyReason ?? "公開して読まれ始めると数字が入ります。"}
                action={<TextLink href="/admin/content">記事の進行を見る</TextLink>}
              />
            </Section>
          ) : (
            groups.map((group) => {
              const rows = metrics.value.rows.filter((r) => r.category === group);
              if (rows.length === 0) return null;
              return (
                <Section key={group} title={rows[0]?.categoryLabel ?? group}>
                  <DataTable
                    caption={`${rows[0]?.categoryLabel ?? group}の数字と、その数え方と使い道`}
                    columns={[
                      { key: "metric", label: "数字" },
                      { key: "value", label: "直近30日", numeric: true },
                      { key: "denominator", label: "母数", numeric: true },
                      { key: "how", label: "どう数えたか" },
                      { key: "usable", label: "編集判断への利用" },
                    ]}
                    rows={rows.map((r) => ({
                      key: r.key,
                      cells: [
                        r.label,
                        r.valueLabel,
                        r.denominator === null ? "—" : r.denominator.toLocaleString("ja-JP"),
                        r.howCounted,
                        r.usableForEditorialJudgement ? "使えます" : "使えません",
                      ],
                    }))}
                  />
                  {rows
                    .filter((r) => r.notUsableReason !== null)
                    .slice(0, 1)
                    .map((r) => (
                      <ActionNote key={r.key} tone="danger">
                        この区分の数字の使い道: {r.notUsableReason ?? ""}
                      </ActionNote>
                    ))}
                  <Note>「未計測」は、まだ数えられていないという意味です。0 ではありません。</Note>
                </Section>
              );
            })
          )}

          <Section title="切り口で絞って見る">
            {!filtered.ok ? (
              <ErrorView
                title="絞り込みができませんでした"
                body={filtered.error.message}
                suggestedAction={filtered.error.suggestedAction ?? null}
              />
            ) : (
              <>
                <FilterBar
                  legend="どの切り口で数字を見ますか"
                  action="/admin/analytics"
                  keep={{ target }}
                  clearHref={`/admin/analytics?target=${target}`}
                  summary={filtered.value.filterSummary}
                  axes={filtered.value.axes.map((a) => ({
                    key: a.key,
                    label: a.label,
                    whatItTells: a.whatItTells,
                    options: a.options,
                    selected: a.selected,
                    unavailableReason: a.unavailableReason,
                    commercial: a.commercial,
                  }))}
                />

                {filtered.value.commercialWarning === null ? null : (
                  <ActionNote tone="danger">
                    この切り口の数字の使い道: {filtered.value.commercialWarning}
                  </ActionNote>
                )}

                {filtered.value.emptyReason !== null ? (
                  <EmptyView
                    title="この条件では数字が出ませんでした"
                    body={filtered.value.emptyReason}
                  />
                ) : (
                  <DataTable
                    caption={filtered.value.filterSummary ?? "絞り込みなし（全体の数字）"}
                    columns={[
                      { key: "metric", label: "数字" },
                      { key: "value", label: "値", numeric: true },
                      { key: "unavailable", label: "出せない理由" },
                      { key: "usable", label: "編集判断への利用" },
                    ]}
                    rows={filtered.value.rows.map((r) => ({
                      key: r.key,
                      cells: [
                        r.label,
                        r.valueLabel,
                        r.unavailableReason ?? "—",
                        r.usableForEditorialJudgement ? "使えます" : "使えません",
                      ],
                    }))}
                  />
                )}

                {filtered.value.unsplittableCount === 0 ? null : (
                  <Note>
                    {filtered.value.unsplittableCount}
                    件の数字は、この切り口では分けて数えていません。0 件という意味ではありません。
                  </Note>
                )}
              </>
            )}
          </Section>

          <Section title="用途ごとに使ってよい数字">
            <ListView
              rows={TARGETS.map((t) =>
                t === target
                  ? { key: t, label: `${FEEDBACK_TARGET_LABEL[t]}（表示中）` }
                  : {
                      key: t,
                      label: `${FEEDBACK_TARGET_LABEL[t]}を見る`,
                      href: `/admin/analytics?target=${t}`,
                    },
              )}
            />
            {!usable.ok ? (
              <ErrorView
                title="使ってよい数字を出せませんでした"
                body={usable.error.message}
                suggestedAction={usable.error.suggestedAction ?? null}
              />
            ) : (
              <>
                <SubSection
                  title={`${usable.value.targetLabel}に使える数字（${usable.value.usable.length}件）`}
                >
                  {usable.value.usable.length === 0 ? (
                    <EmptyView
                      title="使える数字がありません"
                      body="この用途に使える数字がまだ定義されていません。"
                    />
                  ) : (
                    <ListView
                      rows={usable.value.usable.map((m) => ({
                        key: m.key,
                        label: m.label,
                        note: m.howCounted,
                      }))}
                    />
                  )}
                </SubSection>
                {usable.value.rejected.length === 0 ? (
                  <Note>この用途で使えない数字はありません。</Note>
                ) : (
                  <SubSection title={`使えない数字（${usable.value.rejected.length}件）`}>
                    <ListView
                      rows={usable.value.rejected.map((r) => ({
                        key: r.label,
                        label: r.label,
                        note: r.reason,
                      }))}
                    />
                  </SubSection>
                )}
              </>
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
