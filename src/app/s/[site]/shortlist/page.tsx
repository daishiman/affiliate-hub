import Link from "next/link";
import { readerActor, readerUseCases } from "@/presentation/composition";
import { SiteFrame } from "@/presentation/site/page-frame";
import { siteHref } from "@/presentation/site/view-model";
import { EmptyView, ErrorView, SitePage, StubNotice, UI_COPY } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 気になる商品。
 *
 * 保存先がまだ無いので、必ず見本の表示を出す。
 * 「保存できたのに翌日消えている」を、黙って起こさないため。
 */
export default async function ShortlistPage({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  const result = await readerUseCases().listShortlist.execute(readerActor(), { siteSlug: site });

  return (
    <SiteFrame
      siteSlug={site}
      currentPath={siteHref(site, "/shortlist")}
      trail={[{ label: UI_COPY.reader.shortlistTitle }]}
    >
      {() => (
        <SitePage
          title={UI_COPY.reader.shortlistTitle}
          lead="記事を読みながら「気になる」を押した商品がここに並びます。"
        >
          <StubNotice
            what="保存した商品を残しておく場所"
            blockedBy="読者ごとの保存先 (KV 名前空間) の作成"
            stubId="reader:shortlist-memory"
          />

          {result.ok ? (
            result.value.length === 0 ? (
              <EmptyView
                title={UI_COPY.reader.shortlistTitle}
                body={UI_COPY.reader.shortlistEmpty}
              />
            ) : (
              <ul>
                {result.value.map((item) => (
                  <li key={item.productId}>
                    {item.fromArticleHref === undefined ? (
                      item.productName
                    ) : (
                      <Link href={item.fromArticleHref}>{item.productName}</Link>
                    )}
                    {item.oneLine === undefined ? null : ` — ${item.oneLine}`}
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ErrorView
              title="保存した商品を読み込めませんでした"
              body={result.error.suggestedAction ?? result.error.message}
            />
          )}
        </SitePage>
      )}
    </SiteFrame>
  );
}
