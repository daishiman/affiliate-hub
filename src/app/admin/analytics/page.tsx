import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import { FEEDBACK_TARGET_LABEL } from "@/application/usecases/analytics/read-metrics";
import { analyticsNotice, analyticsUseCases, currentActor } from "@/presentation/composition";
import { ANALYTICS_AXIS_KEYS, type AnalyticsAxisKey } from "@/domain/analytics";
import {
  Callout,
  Card,
  DataTable,
  EmptyView,
  ErrorView,
  FilterBar,
  Note,
  Page,
  SectionHeading,
  StackedList,
  StackedRow,
  StorageNotice,
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
      ) : (
        <Callout
          tone={coverage.value.untracked === 0 ? "info" : "warn"}
          title={coverage.value.headline}
          reason={coverage.value.detail}
        />
      )}

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
              <SectionHeading level={2}>{rows[0]?.categoryLabel ?? group}</SectionHeading>
              <DataTable
                caption={`${rows[0]?.categoryLabel ?? group}の数字。直近30日の値と、その母数・数え方・編集判断に使ってよいか。`}
                columns={[
                  { key: "label", header: "数字", rowHeader: true, cell: (r) => r.label },
                  {
                    key: "value",
                    header: "直近30日",
                    align: "numeric",
                    cell: (r) => r.valueLabel,
                  },
                  {
                    key: "denominator",
                    header: "母数",
                    align: "numeric",
                    cell: (r) =>
                      r.denominator === null ? "—" : r.denominator.toLocaleString("ja-JP"),
                  },
                  { key: "howCounted", header: "どう数えたか", cell: (r) => r.howCounted },
                  {
                    key: "usable",
                    header: "編集判断への利用",
                    cell: (r) => (r.usableForEditorialJudgement ? "使えます" : "使えません"),
                  },
                ]}
                rows={rows}
                rowKey={(r) => r.key}
              />
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
              <Note>
                「未計測」は、まだ数えられていないという意味です。0 ではありません。
              </Note>
            </Card>
          );
        })
      )}

      <Card>
        <SectionHeading level={2}>切り口で絞って見る</SectionHeading>
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
              <Callout
                tone="warn"
                title="この切り口の数字の使い道"
                reason={filtered.value.commercialWarning}
              />
            )}

            {filtered.value.emptyReason !== null ? (
              <EmptyView title="この条件では数字が出ませんでした" body={filtered.value.emptyReason} />
            ) : (
              <DataTable
                caption={filtered.value.filterSummary ?? "絞り込みなし（全体の数字）"}
                columns={[
                  { key: "label", header: "数字", rowHeader: true, cell: (r) => r.label },
                  { key: "value", header: "値", align: "numeric", cell: (r) => r.valueLabel },
                  {
                    key: "unavailable",
                    header: "出せない理由",
                    cell: (r) => r.unavailableReason ?? "—",
                  },
                  {
                    key: "usable",
                    header: "編集判断への利用",
                    cell: (r) => (r.usableForEditorialJudgement ? "使えます" : "使えません"),
                  },
                ]}
                rows={filtered.value.rows}
                rowKey={(r) => r.key}
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
      </Card>

      <Card>
        <SectionHeading level={2}>用途ごとに使ってよい数字</SectionHeading>
        <StackedList>
          {TARGETS.map((t) => (
            <StackedRow key={t}>
              {t === target ? (
                <span>{FEEDBACK_TARGET_LABEL[t]}（表示中）</span>
              ) : (
                <Link href={`/admin/analytics?target=${t}`}>{FEEDBACK_TARGET_LABEL[t]}を見る</Link>
              )}
            </StackedRow>
          ))}
        </StackedList>
        {!usable.ok ? (
          <ErrorView
            title="使ってよい数字を出せませんでした"
            body={usable.error.message}
            suggestedAction={usable.error.suggestedAction ?? null}
          />
        ) : (
          <>
            <SectionHeading level={3}>
              {usable.value.targetLabel}に使える数字（{usable.value.usable.length}件）
            </SectionHeading>
            {usable.value.usable.length === 0 ? (
              <EmptyView
                title="使える数字がありません"
                body="この用途に使える数字がまだ定義されていません。"
              />
            ) : (
              <StackedList>
                {usable.value.usable.map((m) => (
                  <StackedRow key={m.key} note={m.howCounted}>
                    {m.label}
                    
                  </StackedRow>
                ))}
              </StackedList>
            )}
            {usable.value.rejected.length === 0 ? (
              <Note>この用途で使えない数字はありません。</Note>
            ) : (
              <>
                <SectionHeading level={3}>
                  使えない数字（{usable.value.rejected.length}件）
                </SectionHeading>
                <StackedList>
                  {usable.value.rejected.map((r) => (
                    <StackedRow key={r.label} note={r.reason}>
                      {r.label}
                      
                    </StackedRow>
                  ))}
                </StackedList>
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
    <AdminShell
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
    </AdminShell>
  );
}
