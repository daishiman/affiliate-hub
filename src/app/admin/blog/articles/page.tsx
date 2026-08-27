import { AdminShell } from "@/presentation/admin/admin-shell";
import { blogSiteOptions, pickSiteSlug } from "@/presentation/admin/blog-site-options";
import { BlogSiteSwitch } from "@/presentation/admin/blog-site-switch";
import { blogOpsEntry, currentActor } from "@/presentation/composition";
import { selectOperationalRows } from "@/domain/blogops";
import {
  OperationalHealthControls,
  OperationalHealthView,
  parseOperationalHealthQuery,
} from "@/presentation/admin/operational-health-view";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  Section,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 記事の一覧。
 *
 * 並び順は更新日ではなく、**手を入れる必要がある順**にしない。
 * ここは「次に何を直すか」を決める画面ではなく（それは読者の評価の画面）、
 * 「どの記事があるか」を確かめる画面なので、鮮度は列として添えるだけにする。
 * 2 つの画面が同じ判断を別の根拠でさせると、運用者はどちらを信じるか迷う。
 */
export default async function BlogArticlesPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const entry = await blogOpsEntry();
  if (!entry.ready) {
    return (
      <AdminShell
        routeId="blog/articles"
        title="記事"
        lead="次に手を入れる記事を決めます。"
      >
        <ErrorView
          title="いまは記事を読めません"
          body={entry.reason}
          suggestedAction="保存先を用意した実行環境で開いてください。"
          action={<TextLink href="/admin/blog">ブログの版面へ戻る</TextLink>}
        />
      </AdminShell>
    );
  }

  const [params, sites] = await Promise.all([searchParams, blogSiteOptions()]);
  const siteSlug = pickSiteSlug(params, sites.options);
  const deletedRaw = params.deleted;
  const deletedTitle = typeof deletedRaw === "string" ? deletedRaw : "";
  const actor = await currentActor();
  const list = await entry.listArticles.execute(actor, { siteSlug });
  const healthQuery = parseOperationalHealthQuery(params);
  const shownRows = list.ok
    ? selectOperationalRows(list.value.rows, healthQuery, (row) => ({
        name: row.title,
        health: row.health,
      }))
    : [];

  return (
    <AdminShell
      routeId="blog/articles"
      title="記事"
      lead="次に手を入れる記事を決めます。"
      actions={
        <>
          <TextLink href="/admin/blog/articles/new">記事を 1 本作る</TextLink>
          <TextLink href="/admin/blog/articles/deleted">削除済みを見る</TextLink>
        </>
      }
    >
      <BlogSiteSwitch
        basePath="/admin/blog/articles"
        current={siteSlug ?? ""}
        options={sites.options}
      />

      {deletedTitle === "" ? null : (
        /*
         * 記事 1 本の画面で消すと、ここへ戻ってくる (`blog-article-action.ts`)。
         * 「消えた」ことはこの一覧を見れば分かるが、**何が消えたか**は分からない。
         * 題名をここで 1 度だけ出す。出さないと、押した直後の画面が
         * 「何も起きなかった一覧」と見分けが付かない。
         */
        <Callout tone="success" reason={`「${deletedTitle}」を消しました。`} />
      )}

      {!list.ok ? (
        <ErrorView
          title="記事の一覧を出せませんでした"
          body={list.error.message}
          suggestedAction={list.error.suggestedAction ?? null}
        />
      ) : list.value.total === 0 ? (
        <Section title="記事">
          <EmptyView
            title="記事がありません"
            body={list.value.emptyReason ?? "まだ 1 本もありません。"}
            action={<TextLink href="/admin/blog/articles/new">記事を 1 本作る</TextLink>}
          />
        </Section>
      ) : (
        <>
          {list.value.staleCount === 0 ? null : (
            <Callout
              tone="warn"
              title={`${list.value.staleCount} 本が 1 年以上更新されていません`}
              reason="価格や仕様の記述が古いまま読者に出ている可能性があります。"
              action={<TextLink href="/admin/blog/evaluate">読者の評価から選ぶ</TextLink>}
            />
          )}

          <Section title="記事の一覧">
            <OperationalHealthControls
              action="/admin/blog/articles"
              query={healthQuery}
              keep={siteSlug === null ? undefined : { site: siteSlug }}
            />
            <DataTable
              caption="ブログ記事"
              columns={[
                { key: "title", label: "見出し" },
                { key: "template", label: "版面" },
                { key: "status", label: "状態" },
                { key: "author", label: "書いた人" },
                { key: "updated", label: "最終更新" },
                { key: "health", label: "運用健全性" },
              ]}
              rows={shownRows.map((row) => ({
                key: row.articleId,
                cells: [
                  <TextLink
                    key="title"
                    href={`/admin/blog/articles/${encodeURIComponent(row.articleId)}`}
                  >
                    {row.title}
                  </TextLink>,
                  row.templateLabel,
                  row.statusLabel,
                  row.authorName === "" ? "（未記入）" : row.authorName,
                  row.updatedAt.slice(0, 10),
                  <OperationalHealthView key="health" health={row.health} />,
                ],
              }))}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
