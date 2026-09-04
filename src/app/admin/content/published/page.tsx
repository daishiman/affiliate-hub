import Form from "next/form";
import Link from "next/link";
import type { AiSearchReauditRun } from "@/application/ports/seo";
import { articleHref } from "@/application/read-models/published-article";
import { siteBasePathBySlug } from "@/domain/authoring";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, publishedArticleAdminUseCases } from "@/presentation/composition";
import { DataTable, DescriptionTime, EmptyView, ErrorView, Section } from "@/presentation/ui";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 絞り込みで選べる公開状態。**読み取りと表示を同じ 1 つの並びから作る。**
 *
 * 選択肢を `<option>` として直に 3 つ並べていたときは、住所から来た値を
 * 別の場所（`rawVisibility === "public" || ...`）で判定していた。**片方だけ
 * 増やせる形**で、増やしたほうが黙って無視される。ここを正本にすると、
 * 足した選択肢は必ず判定の側にも現れる。
 */
const VISIBILITY_FILTERS = [
  { value: "all", label: "すべて" },
  { value: "public", label: "公開中" },
  { value: "archived", label: "非表示" },
] as const;

type VisibilityFilter = (typeof VISIBILITY_FILTERS)[number]["value"];

function toVisibility(raw: string | undefined): VisibilityFilter {
  const found = VISIBILITY_FILTERS.find((option) => option.value === raw);
  return found?.value ?? "all";
}

function formatReauditTime(value: Date): string {
  return value.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

/** 定期再点検だけの状態表示。記事単位の点検状態とは混ぜない。 */
function ReauditRunStatus({ run }: { readonly run: AiSearchReauditRun | null }) {
  if (run === null) {
    return (
      <Section title="定期再点検: 未実行">
        <EmptyView
          title="定期再点検はまだ実行されていません"
          body="最初の定期再点検が完了すると、対象件数と完了時刻をここで確認できます。"
        />
      </Section>
    );
  }

  const statusLabel =
    run.status === "succeeded" ? "成功" : run.status === "partial" ? "一部失敗" : "失敗";
  const summary =
    run.status === "succeeded" && run.scanned === 0
      ? "対象 0 件（この回で再点検した記事はありませんでした）"
      : run.failureCode === "target_list_unavailable"
        ? "再点検の対象を取得できませんでした。"
        : `対象 ${run.scanned} 件／記録 ${run.recorded} 件／失敗 ${run.failed} 件`;

  return (
    <Section title={`定期再点検: ${statusLabel}`} lead={summary}>
      <dl>
        <DescriptionTime label="開始時刻" dateTime={run.startedAt.toISOString()}>
          {formatReauditTime(run.startedAt)}
        </DescriptionTime>
        <DescriptionTime label="最終完了時刻" dateTime={run.completedAt.toISOString()}>
          {formatReauditTime(run.completedAt)}
        </DescriptionTime>
      </dl>
    </Section>
  );
}

export default async function PublishedArticlesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string | string[]; readonly visibility?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";
  const visibility = toVisibility(Array.isArray(params.visibility) ? params.visibility[0] : params.visibility);
  const useCases = await publishedArticleAdminUseCases();
  const actor = await currentActor();
  /*
    AI 検索の点検で落ちている記事（受入 A5）。
    絞り込み（`query` / `visibility`）は渡さない。この一覧は「探しているもの」ではなく
    「気づいていないもの」なので、絞り込んだ結果として消えてよいものではない。
  */
  const [result, failing, latestReauditRun] = await Promise.all([
    useCases.list.execute(actor, { query, visibility }),
    useCases.listFailingAudits.execute(actor, {}),
    useCases.getLatestReauditRun.execute(actor, {}),
  ]);

  return (
    <AdminShell
      routeId="content/published"
      title="公開済み記事"
      lead="読者に出ている記事を探し、訂正または非表示にします。"
      actions={<Link href="/admin/content/new">新しい記事を作る</Link>}
    >
        {/*
          **画面まるごとを `Card` で包まない。**`Card` は「1 つの主張と、その根拠」を
          1 枚に閉じるための器で、画面そのものの見出しではない。器として使うと、
          画面に主張が 1 つしか無いように見え、`Card` が「枠線の付いた div」に退化する
          （台帳の `cardRepresentationBinding.routeWrapper: false`）。
          画面の区切りは `Section` が持つ。
        */}
        {/*
          **0 件でも記事単位の節は出す。** 履歴の有無と点検範囲を使い、
          「未点検」と「全合格」を分ける。定期処理そのものが動いた証拠は、
          この後の「定期再点検」節で実行結果として別に示す。
          ただし**表の骨組みだけを出すことはしない**（列名だけの空表は、
          読む人に「読み込み中かもしれない」と思わせる）。
          取得そのものに失敗した場合も節を消さず、成功と誤読されない状態を出す。
        */}
        {!failing.ok && (
          <Section title="AI 検索の点検: 取得不能">
            <ErrorView
              title="点検結果を取得できませんでした"
              body={failing.error.message}
              suggestedAction={failing.error.suggestedAction ?? null}
            />
          </Section>
        )}

        {failing.ok &&
          (failing.value.coverage.publishedCount === 0 ||
            failing.value.coverage.uncheckedCount > 0) && (
          <Section title="AI 検索の点検: 未点検">
            <EmptyView
              title={
                failing.value.coverage.publishedCount === 0
                  ? "点検対象の公開中の記事はまだありません"
                  : `未点検の記事が ${failing.value.coverage.uncheckedCount} 件あります`
              }
              body={
                failing.value.coverage.publishedCount === 0
                  ? "記事を公開すると公開時に点検し、その後は 7 日ごとに再点検します。"
                  : "まだ履歴の無い記事は、次回の定期点検で順に確認します。点検済みになるまでは合格とは扱いません。"
              }
            />
          </Section>
        )}

        {failing.ok &&
          failing.value.coverage.publishedCount > 0 &&
          failing.value.coverage.uncheckedCount === 0 &&
          failing.value.rows.length === 0 && (
          <Section title="AI 検索の点検: 全合格">
            <EmptyView
              title="点検済みの公開中の記事は、すべて通っています"
              body="公開時と 7 日ごとの再点検のうち、各記事で最も新しい結果を確認しています。"
            />
          </Section>
        )}

        {failing.ok && failing.value.rows.length > 0 && (
          <Section
            title="AI 検索の点検: 要修正"
            lead={
              failing.value.truncated
                ? "直近の点検で落ちた記事です（上限まで表示しています）。編集した内容は、次回の定期点検後に判定へ反映されます。"
                : "直近の点検で落ちた記事です。編集した内容は、次回の定期点検後に判定へ反映されます。"
            }
          >
            <DataTable
              caption="AI 検索の点検で落ちている記事の一覧"
              columns={[
                { key: "article", label: "記事" },
                { key: "failed", label: "直すところ" },
                { key: "checkedAt", label: "点検日" },
                { key: "actions", label: "操作" },
              ]}
              rows={failing.value.rows.map((row) => ({
                key: `audit-${row.siteSlug}/${row.slug}`,
                cells: [
                  <>
                    <strong>{row.title}</strong>
                    <span>{row.siteSlug}</span>
                  </>,
                  <ul key="failed">
                    {row.failed.map((item) => (
                      <li key={item.check}>{item.hint}</li>
                    ))}
                  </ul>,
                  <>
                    {row.checkedAt.slice(0, 10)}
                    <span>
                      {row.trigger === "publish" ? "公開時" : "定期点検"}／{row.passedCount}/
                      {row.totalCount} 通過
                    </span>
                  </>,
                  <Link
                    key="edit"
                    href={`/admin/content/published/${encodeURIComponent(row.siteSlug)}/${encodeURIComponent(row.slug)}/edit`}
                  >
                    直す
                  </Link>,
                ],
              }))}
            />
          </Section>
        )}

        {!latestReauditRun.ok ? (
          <Section title="定期再点検: 取得不能">
            <ErrorView
              title="定期再点検の実行結果を取得できませんでした"
              body={latestReauditRun.error.message}
              suggestedAction={latestReauditRun.error.suggestedAction ?? null}
            />
          </Section>
        ) : (
          <ReauditRunStatus run={latestReauditRun.value} />
        )}

        <Section title="読者に出ている記事を絞り込む">
          <Form action="/admin/content/published" className={styles.publishedFilter}>
            <label htmlFor="published-query"><span>記事を検索</span><input id="published-query" type="search" name="q" defaultValue={query} placeholder="タイトル・結論・サイト名" /></label>
            <label htmlFor="published-visibility"><span>公開状態</span><select id="published-visibility" name="visibility" defaultValue={visibility}>
                {VISIBILITY_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select></label>
            <button type="submit">絞り込む</button>
          </Form>
        </Section>

        {!result.ok ? (
          <ErrorView title="公開済み記事を出せませんでした" body={result.error.message} suggestedAction={result.error.suggestedAction ?? null} />
        ) : result.value.length === 0 ? (
          <Section title="条件に合う公開済み記事がありません">
            <EmptyView title="条件に合う公開済み記事がありません" body="検索条件を変えるか、承認済み原稿から新しい記事を公開してください。" action={<Link href="/admin/content/new">記事の作り方を見る</Link>} />
          </Section>
        ) : (
          <Section title="読者に出ている記事の一覧">
            {/*
              **生の `<table>` を書かない。**表の作法（見出しが列か行かを名乗る・
              横スクロールを表の器へ閉じ込める・読み上げが最初に読む説明を持つ）は
              `DataTable` が 1 か所で持っている。ここで書き直すと、
              作法の直しが片方にだけ入る日が来る（`tests/ui/table-through-component.test.ts`）。
            */}
            <DataTable
              caption="読者に出ている記事の一覧"
              columns={[
                { key: "article", label: "記事" },
                { key: "site", label: "サイト" },
                { key: "status", label: "状態" },
                { key: "updatedAt", label: "更新日" },
                { key: "actions", label: "操作" },
              ]}
              rows={result.value.map(({ article, archivedAt }) => ({
                key: `${article.siteSlug}/${article.slug}`,
                cells: [
                  <>
                    <strong>{article.title}</strong>
                    <span>{article.summary}</span>
                  </>,
                  article.siteSlug,
                  <span key="visibility" className={styles.publishedStatus}>
                    {archivedAt === null ? "公開中" : "非表示"}
                  </span>,
                  article.updatedAt,
                  <>
                    <Link
                      href={`/admin/content/published/${encodeURIComponent(article.siteSlug)}/${encodeURIComponent(article.slug)}/edit`}
                    >
                      編集
                    </Link>
                    {archivedAt === null && (
                      <Link
                        href={`${siteBasePathBySlug(article.siteSlug)}${articleHref(article)}`}
                        target="_blank"
                      >
                        公開画面
                      </Link>
                    )}
                  </>,
                ],
              }))}
            />
          </Section>
        )}
    </AdminShell>
  );
}
