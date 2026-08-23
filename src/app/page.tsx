import { readerActor, siteSampleNotice, siteUseCases } from "@/presentation/composition";
import { siteBasePath } from "@/presentation/site/view-model";
import {
  Callout,
  EmptyView,
  ErrorView,
  ListView,
  Note,
  PublicShell,
  SitePage,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 入口。
 *
 * ここでデータの取り出し方を書かない。運用中のブログ一覧は
 * 読者向け画面・管理画面・REST・AI がすべて同じユースケースから取る。
 * 保存先が見本から D1 に変わっても、このファイルは 1 行も変わらない。
 */
export default async function Home() {
  const result = await (await siteUseCases()).listSites.execute(readerActor(), {});

  return (
    <PublicShell title="affiliate-hub">
      <SitePage
        title="運営中のブログ"
        lead="1 つの仕組みで複数のブログを動かしています。ブログを 1 本増やすときに書き足すコードはありません。"
      >
        <Callout tone="warn" title="たたき台です" reason={siteSampleNotice()} />

        {!result.ok ? (
          <ErrorView
            title="ブログの一覧を取れませんでした"
            body={result.error.suggestedAction ?? result.error.message}
          />
        ) : result.value.length === 0 ? (
          <EmptyView
            title="まだブログがありません"
            body="管理画面のサイトから設計図を登録すると、ここに並びます。"
            action={<TextLink href="/admin/sites">サイトを見る</TextLink>}
          />
        ) : (
          <ListView
            rows={result.value.map((site) => ({
              key: site.slug,
              label: site.blueprint.name,
              href: siteBasePath(site.slug),
              note: site.blueprint.purpose,
            }))}
          />
        )}

        <Note>
          <TextLink href="/admin">運営する人はこちら（管理画面）</TextLink>
        </Note>
      </SitePage>
    </PublicShell>
  );
}
