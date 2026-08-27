import { AdminShell } from "@/presentation/admin/admin-shell";
import { blogSiteOptions, pickSiteSlug } from "@/presentation/admin/blog-site-options";
import { BlogSiteSwitch } from "@/presentation/admin/blog-site-switch";
import { blogOpsEntry, currentActor } from "@/presentation/composition";
import {
  ActionNote,
  Callout,
  DataTable,
  EmptyView,
  ErrorView,
  Prose,
  Section,
  Stack,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 読者の評価。
 *
 * 平均だけを並べない。票が 2 つしか無い記事の平均は次の 1 票で大きく動くので、
 * **票が少ないうちは鮮度だけを見る**という判断がユースケース側に入っている。
 * この画面はその判断結果（手を入れる目安）をそのまま出し、
 * 画面側で平均を並べ替えたり色を付けたりしない。数字を動かす手直しを誘わないため。
 */
export default async function BlogEvaluatePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const entry = await blogOpsEntry();
  if (!entry.ready) {
    return (
      <AdminShell
        routeId="blog/evaluate"
        title="読者の評価"
        lead="評価と鮮度から、次に手を入れる記事を選びます。"
      >
        <ErrorView
          title="いまは評価を読めません"
          body={entry.reason}
          suggestedAction="保存先を用意した実行環境で開いてください。"
          action={<TextLink href="/admin/blog">ブログの版面へ戻る</TextLink>}
        />
      </AdminShell>
    );
  }

  const [params, sites] = await Promise.all([searchParams, blogSiteOptions()]);
  const siteSlug = pickSiteSlug(params, sites.options);
  const actor = await currentActor();
  const result = await entry.evaluate.execute(actor, { siteSlug });

  return (
    <AdminShell
      routeId="blog/evaluate"
      title="読者の評価"
      lead="評価と鮮度から、次に手を入れる記事を選びます。"
      actions={<TextLink href="/admin/blog/articles">記事の一覧へ</TextLink>}
    >
      <BlogSiteSwitch
        basePath="/admin/blog/evaluate"
        current={siteSlug ?? ""}
        options={sites.options}
      />

      {!result.ok ? (
        <ErrorView
          title="評価を出せませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
        />
      ) : result.value.total === 0 ? (
        <Section title="評価">
          <EmptyView
            title="評価する記事がありません"
            body={result.value.emptyReason ?? "まだ記事が 1 本もありません。"}
            action={<TextLink href="/admin/blog/articles/new">記事を 1 本作る</TextLink>}
          />
        </Section>
      ) : (
        <>
          <Callout
            tone={result.value.attentionCount === 0 ? "info" : "warn"}
            title={
              result.value.attentionCount === 0
                ? "いま手を入れるべき記事はありません"
                : `${result.value.attentionCount} 本に手を入れる目安が立っています`
            }
            reason={
              result.value.attentionCount === 0
                ? "評価も鮮度も、読者に出したままで問題ない範囲にあります。"
                : "評価が低いか、長く更新されていない記事です。理由は各行に書いてあります。"
            }
          />

          <Section title="手を入れる目安" lead="理由が立っている記事だけを並べています。">
            <Prose>
              評価が 5 件に満たない記事は、平均では判断しません。少ない票で順位を付けると、
              内容と関係のない手直しを誘います。
            </Prose>
            <Stack>
              {result.value.rows
                .filter((row) => row.attentionReason !== null)
                .map((row) => (
                  <ActionNote key={row.articleId} tone="danger">
                    {row.title}：{row.attentionReason}
                  </ActionNote>
                ))}
            </Stack>
          </Section>

          <Section title="すべての記事">
            <DataTable
              caption="記事ごとの評価と鮮度"
              columns={[
                { key: "title", label: "見出し" },
                { key: "template", label: "版面" },
                { key: "count", label: "評価の数", numeric: true },
                { key: "average", label: "平均", numeric: true },
                { key: "freshness", label: "鮮度" },
              ]}
              rows={result.value.rows.map((row) => ({
                key: row.articleId,
                cells: [
                  <TextLink
                    key="title"
                    href={`/admin/blog/articles/${encodeURIComponent(row.articleId)}`}
                  >
                    {row.title}
                  </TextLink>,
                  row.templateLabel,
                  // 数を飛び先にしている。1 件ずつ確かめたくなるのは
                  // 「この数字は何でできているのか」を疑ったときなので、
                  // 疑った先にそのまま置く。
                  <TextLink
                    key="count"
                    href={`/admin/blog/evaluate/${encodeURIComponent(row.articleId)}`}
                  >
                    {String(row.ratingCount)}
                  </TextLink>,
                  // 1 票も無いときに 0 を出さない。0 は「最低評価が付いた」の意味になる。
                  row.ratingAverage === null ? "—" : row.ratingAverage.toFixed(1),
                  row.freshnessLabel,
                ],
              }))}
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
