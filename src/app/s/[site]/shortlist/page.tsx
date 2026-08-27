import { readerActor, readerUseCases } from "@/presentation/composition";
import { SiteFrame } from "@/presentation/site/page-frame";
import { readerIdentityOrNull } from "@/presentation/site/reader-identity";
import { ShortlistRemoveButton } from "@/presentation/site/shortlist-buttons";
import { siteHref } from "@/presentation/site/view-model";
import { EmptyView, ErrorView, ListView, Note, SitePage, UI_COPY } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 気になる商品。
 *
 * **保存先は本物になった**（`d1/reader-shortlist-repository.ts`）。
 * 以前は処理中のメモリだったので、押した本人から見ると翌日には消えていた。
 *
 * --- 合言葉が無いときは「まだ 1 件も無い」 ---
 * 読者を分ける合言葉は、初めて「気になる」を押したときに配る。
 * この画面を開いただけでは配らないので、一度も押していない人は合言葉を持たない。
 * それは失敗ではないので、読み出しに行かずに空の表示を出す。
 */
export default async function ShortlistPage({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  const readerKey = await readerIdentityOrNull();
  const result =
    readerKey === null
      ? null
      : await (await readerUseCases()).listShortlist.execute(readerActor(), {
          siteSlug: site,
          readerKey,
        });

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
          {result === null || (result.ok && result.value.length === 0) ? (
            <EmptyView
              title={UI_COPY.reader.shortlistTitle}
              body={UI_COPY.reader.shortlistEmpty}
            />
          ) : result.ok ? (
            <>
              <ListView
                rows={result.value.map((item) => ({
                  key: item.productId,
                  label: item.productName,
                  href: item.fromArticleHref,
                  // 外す押しどころは、行の中に置く。別画面へ送らない。
                  // 一覧を見ながら外せないと、どれを外したのか分からなくなる。
                  note: (
                    <>
                      {item.oneLine}
                      <ShortlistRemoveButton
                        siteSlug={site}
                        productId={item.productId}
                        productName={item.productName}
                      />
                    </>
                  ),
                }))}
              />
              <Note>
                この一覧は、このブラウザにだけ残ります。別の端末や、履歴を消したあとには
                出てきません。並び順は保存した新しい順で、こちらの都合では並べ替えません。
              </Note>
            </>
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
