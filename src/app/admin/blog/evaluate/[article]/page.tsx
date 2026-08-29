import { AdminShell } from "@/presentation/admin/admin-shell";
import { BlogRatingHideForm } from "@/presentation/admin/blog-rating-form";
import { blogOpsEntry, currentActor } from "@/presentation/composition";
import {
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  Prose,
  Section,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 記事 1 本に付いた票を、1 件ずつ見る画面。
 *
 * 一覧側（`/admin/blog/evaluate`）は「読者に見える数」を出す画面なので、
 * 伏せた票はそこから消えている。**こちらは伏せたものも出す。**
 * 消えてしまうと、運営者が「何を伏せたか」を確かめられなくなり、
 * 伏せた判断そのものを後から見直せない。
 *
 * 平均をこの画面に出していない。1 件ずつ見ている最中に平均が横にあると、
 * 「平均を上げるために伏せる」判断を誘う。伏せる理由は中身についてであって、
 * 数字についてではない。
 */
export default async function BlogRatingsPage({
  params,
}: {
  readonly params: Promise<{ readonly article: string }>;
}) {
  const { article: articleId } = await params;
  const entry = await blogOpsEntry();
  const lead = "読者が付けた評価を 1 件ずつ確かめ、必要なものだけを伏せます。";

  if (!entry.ready) {
    return (
      <AdminShell routeId="blog/evaluate" title="この記事への評価" lead={lead}>
        <ErrorView
          title="いまは評価を読めません"
          body={entry.reason}
          suggestedAction="保存先を用意した実行環境で開いてください。"
          action={<TextLink href="/admin/blog/evaluate">評価の一覧へ戻る</TextLink>}
        />
      </AdminShell>
    );
  }

  const actor = await currentActor();
  const [found, listed] = await Promise.all([
    entry.getArticle.execute(actor, { articleId }),
    entry.listRatings.execute(actor, { articleId }),
  ]);

  const title = found.ok ? found.value.title : "この記事";

  return (
    <AdminShell
      routeId="blog/evaluate"
      title={`「${title}」への評価`}
      lead={lead}
      actions={<TextLink href="/admin/blog/evaluate">評価の一覧へ戻る</TextLink>}
    >
      {!listed.ok ? (
        <ErrorView
          title="評価を読めませんでした"
          body={listed.error.message}
          suggestedAction={listed.error.suggestedAction ?? null}
        />
      ) : listed.value.rows.length === 0 ? (
        <Section title="評価">
          <EmptyView
            title="まだ評価がありません"
            body={listed.value.emptyReason ?? "この記事にはまだ評価が付いていません。"}
            action={
              <TextLink href={`/admin/blog/articles/${encodeURIComponent(articleId)}`}>
                記事の編集へ
              </TextLink>
            }
          />
        </Section>
      ) : (
        <>
          <Callout
            tone="info"
            title={`見えている評価 ${listed.value.shownCount} 件／伏せてある評価 ${listed.value.hiddenCount} 件`}
            reason="伏せた評価も行として残っています。平均と件数から外れているだけで、いつでも戻せます。"
          />

          <Section title="評価の一覧" lead="新しいものから並んでいます。">
            <Prose>
              伏せるのは、記事の内容と関係のない書き込み（宣伝・個人を指した中傷など）に
              限ります。評価が低いことは伏せる理由になりません。低い評価を伏せると、
              残った平均が読者にとって当てにならない数字になります。
            </Prose>
            <DataTable
              caption="この記事に付いた評価"
              columns={[
                { key: "score", label: "点", numeric: true },
                { key: "comment", label: "書かれたこと" },
                { key: "state", label: "いまの状態" },
                { key: "action", label: "伏せる／戻す" },
              ]}
              rows={listed.value.rows.map((row) => ({
                key: row.id,
                cells: [
                  String(row.score),
                  row.comment ?? "（点だけで、文は書かれていません）",
                  row.hidden ? "伏せてある" : "読者に見えている",
                  <BlogRatingHideForm
                    key="action"
                    articleId={articleId}
                    ratingId={row.id}
                    hidden={row.hidden}
                  />,
                ],
              }))}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
