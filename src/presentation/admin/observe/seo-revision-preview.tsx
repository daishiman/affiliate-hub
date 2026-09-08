import type { ReactNode } from "react";
import { SEARCH_QUERY_DISPLAY_LIMIT, type SeoDashboardOutput, type SeoRevisionPreviewOutput } from "@/application/usecases/seo/manage-seo-auto-apply";
import { Callout, DataTable, EmptyView, ExternalLink, FactList, Foldable, Note, Section, TextLink } from "@/presentation/ui";
import { SEO_OBSERVATIONS_ID, seoObservationHref, seoReviewHref } from "./seo-review-href";

type SearchQueries = SeoRevisionPreviewOutput["searchQueries"];

function JapaneseDateTime({ value }: { readonly value: string }) {
  return (
    <time dateTime={value}>
      {new Date(value).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" })}（日本時間）
    </time>
  );
}

function querySummary(queries: SearchQueries, hasPage: boolean): string {
  const label = "検索語の日別記録：";
  if (!hasPage) return `${label}${queries.configured ? "まだ記録なし" : "連携未設定"}`;
  if (queries.error !== null) return `${label}読み出せませんでした`;
  const parts = queries.availableDayCount === 0 && queries.rows.length === 0
    ? [queries.configured ? "未取得" : "連携未設定"]
    : [`${queries.rows.length}件`, `取得済み${queries.availableDayCount}/${queries.requestedDayCount}日`];
  if (queries.truncated) parts.push("続きあり");
  if (queries.unfinishedDayCount > 0) parts.push(`取得未完了${queries.unfinishedDayCount}日`);
  if (queries.limitedDates.length > 0) parts.push(`API上限${queries.limitedDates.length}日`);
  if (!queries.configured && queries.availableDayCount > 0) parts.push("連携未設定");
  return label + parts.join("・");
}

function SearchQueryRecords({ queries, article }: {
  readonly queries: SearchQueries;
  readonly article: SeoRevisionPreviewOutput["article"];
}) {
  const canRead = article.pageKey !== null && queries.error === null;
  return (
    <Foldable summary={querySummary(queries, article.pageKey !== null)}>
      <Note>{queries.from} 〜 {queries.to} に、このページがGoogle検索で表示された検索語です。</Note>
      <Note>匿名化された検索語などは含まれず、ページ実績の総計とは一致しません。最新の日付から最大{SEARCH_QUERY_DISPLAY_LIMIT}件を表示します。日別の記録を合算しません。</Note>
      {!queries.configured ? (
        <Callout tone="info" title="Search Consoleの連携が未設定です" reason="新しい記録を取得するには、収集元の設定を確認してください。保存済みの記録があれば表示します。"
          action={<TextLink href={seoReviewHref(article.siteSlug)}>収集元の状態を確認する</TextLink>} />
      ) : null}
      {article.pageKey === null ? !queries.configured ? null : (
        <EmptyView title="検索語の記録はまだありません" body="この記事の観測記録と結びつくまで待ってから、もう一度確認してください。" />
      ) : queries.error !== null ? (
        <Callout tone="warn" title="検索語の記録を読み出せませんでした" reason={queries.error}
          action={<TextLink href={seoObservationHref(article.siteSlug, article.articleSlug)}>保存済みの記録を読み直す</TextLink>} />
      ) : !queries.configured && queries.availableDayCount === 0 && queries.rows.length === 0 && queries.unfinishedDayCount === 0 ? null : (
        <>
          <FactList rows={[
            { key: "days", label: "日別の取得範囲", value: `${queries.requestedDayCount}日中${queries.availableDayCount}日分。未取得の日を0件とは扱いません。` },
            { key: "latest", label: "日別取得の最新完了", value: queries.latestCompletedAt === null ? "記録なし" : <JapaneseDateTime value={queries.latestCompletedAt} /> },
          ]} />
          {queries.unfinishedDayCount > 0 ? (
            <Note>
              {queries.unfinishedDayCount}日分の取得が未完了です。
              {queries.availableDayCount > 0 ? "更新が完了するまでは、前回完了した記録を表示します。" : "完了後に記録を表示します。"}
            </Note>
          ) : null}
          {queries.rows.length > 0 ? (
            <DataTable caption="検索語の日別記録" columns={[
              { key: "query", label: "検索語・対象日" },
              { key: "impressions", label: "表示回数", numeric: true },
              { key: "clicks", label: "クリック数", numeric: true },
              { key: "position", label: "平均掲載順位", numeric: true },
            ]} rows={queries.rows.map((metric) => ({
              key: JSON.stringify([metric.metricDate, metric.query]),
              cells: [<span key="query">{metric.query}<br /><time dateTime={metric.metricDate}>{metric.metricDate}</time></span>,
                metric.impressions.toLocaleString("ja-JP"), metric.clicks.toLocaleString("ja-JP"),
                metric.impressions === 0 ? "—（表示なし）" : metric.position.toLocaleString("ja-JP", { maximumFractionDigits: 1 })],
            }))} />
          ) : queries.availableDayCount > 0 ? (
            <EmptyView title="取得した範囲に、このページの検索語はありません" body="表示できる検索語が無い状態です。検索された回数が0という意味ではありません。" />
          ) : queries.unfinishedDayCount > 0 ? (
            <EmptyView title="検索語の取得はまだ完了していません" body="取得が完了した後に、保存済みの記録を確認してください。" />
          ) : queries.configured ? (
            <EmptyView title="この期間の検索語はまだ取得されていません" body="収集元の状態を確認し、取得後にもう一度開いてください。" />
          ) : null}
        </>
      )}
      {canRead && queries.truncated ? <Note>表示している{SEARCH_QUERY_DISPLAY_LIMIT}件より後にも記録があります。この表だけで期間全体を比較しないでください。</Note> : null}
      {canRead && queries.limitedDates.length > 0 ? (
        <Note>{queries.limitedDates.join("、")} はAPI公開範囲の上限に達した日の記録です。ブログを含むプロパティ・日・検索種別ごとの上限で、この記事の検索語をすべて取得できたことは示しません。</Note>
      ) : null}
      {canRead && queries.unknownLimitDayCount > 0 ? <Note>上限に達したか確認できない日が{queries.unknownLimitDayCount}日あります。過去の記録を完全な内訳とは扱いません。</Note> : null}
    </Foldable>
  );
}

/** 確認した記事・差分と、同じページの実測を一緒に読む。 */
export function SeoRevisionPreview({ view, applySlot, recentApplies, canManage, renderRevert }: {
  readonly view: SeoRevisionPreviewOutput;
  readonly applySlot: ReactNode;
  readonly recentApplies: SeoDashboardOutput["recentApplies"];
  readonly canManage: boolean;
  readonly renderRevert: (logId: string) => ReactNode;
}) {
  const title = view.article.title.trim() || view.article.articleSlug;
  const history = recentApplies.filter(({ entry }) =>
    entry.pageKey === view.article.pageKey
    && entry.siteSlug === view.article.siteSlug
    && entry.articleSlug === view.article.articleSlug);
  return (
    <>
      <Section title={`${title}の差分`} lead="変更前と変更後を確認してから、この差分だけを反映します。">
        <FactList rows={[
          { key: "article", label: "対象の記事", value: title },
          { key: "page", label: "公開ページ", value: <ExternalLink href={view.article.url}>{view.article.url}</ExternalLink> },
        ]} />
        <TextLink href={`#${SEO_OBSERVATIONS_ID}`}>この記事のページ実績・検索語を見る</TextLink>
        {view.changes.length === 0 ? (
          <Note>反映する変更はありません。</Note>
        ) : (
          <DataTable caption="反映する変更" columns={[
            { key: "field", label: "変更する欄" },
            { key: "before", label: "変更前" },
            { key: "after", label: "変更後" },
          ]} rows={view.changes.map((change) => ({
            key: change.field,
            cells: [change.label, change.before.trim() === "" ? "（未入力）" : change.before, change.after],
          }))} />
        )}
        {applySlot}
        <TextLink href={seoReviewHref(view.article.siteSlug)}>記事の候補へ戻る</TextLink>
      </Section>
      <Section id={SEO_OBSERVATIONS_ID} title="この記事の観測値" lead={`${view.metrics.from} 〜 ${view.metrics.to} の記録です。`}>
        {view.article.pageKey === null ? (
          <EmptyView title="この記事の観測記録はまだありません" body="観測値と結びつくまで待ってから、もう一度確認してください。" />
        ) : view.metrics.error !== null ? (
          <Callout tone="warn" title="この記事のページ実績を読み出せませんでした" reason={view.metrics.error} />
        ) : view.metrics.rows.length === 0 ? (
          <EmptyView title="この期間のページ実績はまだありません" body="記録がない期間を0件とは扱いません。収集元の状態を確認してください。" />
        ) : (
          <DataTable caption="日ごとのページ実績" columns={[
            { key: "date", label: "対象日" },
            { key: "impressions", label: "表示回数", numeric: true },
            { key: "clicks", label: "クリック数", numeric: true },
            { key: "position", label: "平均掲載順位", numeric: true },
            { key: "citations", label: "AI検索での引用" },
          ]} rows={view.metrics.rows.map((metric) => ({
            key: metric.metricDate,
            cells: [metric.metricDate, metric.impressions ?? "記録なし", metric.clicks ?? "記録なし",
              metric.impressions === null || metric.position === null ? "記録なし" : metric.impressions === 0 ? "—（表示なし）" : metric.position.toLocaleString("ja-JP", { maximumFractionDigits: 1 }),
              metric.aiCitations === null ? "記録なし" : metric.aiCitations === 0 ? "引用なし" : metric.aiCitations === 1 ? "引用あり" : metric.aiCitations],
          }))} />
        )}
        <Note>AI検索での引用は、記事の題名を使った、その日の最後の問い合わせ1回の確認結果です。</Note>
        <SearchQueryRecords queries={view.searchQueries} article={view.article} />
        {history.length === 0 ? null : (
          <DataTable caption="この記事への反映日時" columns={[
            { key: "at", label: "反映日時" }, { key: "diff", label: "変更内容" }, { key: "state", label: "状態" }, { key: "revert", label: "取り消し" },
          ]} rows={history.map(({ entry }) => ({
            key: entry.id,
            cells: [
              <JapaneseDateTime key="applied" value={entry.appliedAt} />,
              entry.diffSummary,
              entry.revertedAt === null
                ? "反映済み"
                : <span key="reverted"><JapaneseDateTime value={entry.revertedAt} />に取り消し済み</span>,
              entry.revertedAt !== null
                ? "—"
                : canManage
                  ? renderRevert(entry.id)
                  : "取り消せるのは、ブログの設定を変える権限を持つ人だけです。",
            ],
          }))} />
        )}
        <Note>記事への反映日時と観測値を照らして確認できます。数字の増減だけで、この変更の効果とは判断できません。</Note>
      </Section>
    </>
  );
}
