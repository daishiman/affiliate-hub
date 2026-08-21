import Link from "next/link";
import { readerActor, siteSampleNotice, siteUseCases } from "@/presentation/composition";
import { siteBasePath } from "@/presentation/site/view-model";
import { Callout, EmptyView, ErrorView, PublicShell, SeeAlso, SitePage } from "@/presentation/ui";

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
            action={<Link href="/admin/sites">サイトを見る</Link>}
          />
        ) : (
          <ul>
            {result.value.map((site) => (
              <li key={site.slug}>
                <Link href={siteBasePath(site.slug)}>{site.blueprint.name}</Link>
                <p>{site.blueprint.purpose}</p>
              </li>
            ))}
          </ul>
        )}

        {/*
          **ここだけは見た目が変わった。**元は `className` の無い裸の `<p>` で、
          本文と同じ大きさ・同じ色で出ていた。`SeeAlso` にしたことで、
          管理画面側の 5 箇所と同じ「小さい灰色」になる。
          **他の 5 箇所は現状を写しただけだが、これは変更である。**
          読者向けの入口に運営者向けの行き先が本文と同じ強さで並んでいるほうが
          おかしい、という判断で揃えた（残課題 152）。
        */}
        <SeeAlso>
          <Link href="/admin">運営する人はこちら（管理画面）</Link>
        </SeeAlso>
      </SitePage>
    </PublicShell>
  );
}
