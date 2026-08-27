import { headers } from "next/headers";
import type { ReactNode } from "react";
import { articleHref } from "@/application/read-models/published-article";
import {
  buildBlogPosting,
  buildBreadcrumbList,
  buildFaqPage,
  buildItemList,
  serializeJsonLd,
} from "@/application/seo/structured-data";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import { readerActor, siteUseCases } from "@/presentation/composition";
import type { PageKind } from "@/presentation/tools/webmcp-policy";
import { ArticleView } from "@/presentation/ui";
import { ShortlistSaveButton } from "./shortlist-buttons";
import { ReadFailureBody, SiteFrame, stopIfMissing } from "./page-frame";
import { siteHref, toArticleView } from "./view-model";

/**
 * 記事 1 本の画面。
 *
 * 順位 (`/best`)・レビュー (`/reviews`)・比較 (`/compare`)・選び方 (`/guides`) の
 * 4 ルートはすべてこれを呼ぶ。**記事タイプごとに画面を作らない。**
 *
 * 作ると、広告表示の出し方・出典の出し方・パンくずの作り方が
 * 4 通りに分かれ、法令に関わる表示の直し漏れがそこから生まれる。
 * ルートごとの違いは URL の前半だけで、画面の中身は 1 つ。
 */
/**
 * URL の前半から、ページの種類を決める。
 *
 * 画面は 1 つでも、読者がそこでやりたいことはルートごとに違う。
 * 比較のページに順位の説明の道具を渡しても、説明する順位がそこに無い。
 */
const PAGE_KIND_BY_PREFIX: Readonly<Record<string, PageKind>> = {
  "/best": "ranking",
  "/compare": "comparison",
  "/reviews": "product",
  "/guides": "article",
};

export async function ArticlePage({
  siteSlug,
  slug,
  pathPrefix,
  routeLabel,
  interactiveSlot,
  whenArticleMissing,
  fallbackTitle,
}: {
  readonly siteSlug: string;
  readonly slug: string;
  /** `/best` など。パンくずと現在地の表示に使う。 */
  readonly pathPrefix: string;
  readonly routeLabel: string;
  /**
   * 本文の前に差し込む、読者が操作できる部分（`/tools` の入力欄と結果）。
   *
   * 道具のページは「記事 1 本」と「操作できる道具」が同じ住所に同居する。
   * 別々の画面にすると、道具の計算の根拠・出典・書いた人が道具の側から消え、
   * 読者は数字だけを見て物を買うことになる。
   */
  readonly interactiveSlot?: ReactNode;
  /**
   * 記事がまだ書かれていないときに、404 の代わりに出すもの。
   *
   * 渡すのは道具のページだけ。道具の定義があれば、記事がまだでも
   * 読者は計算を使える（今まで通り）。渡さないルートは今まで通り 404。
   */
  readonly whenArticleMissing?: ReactNode;
  /**
   * 記事がまだ無いときのパンくずの最後の一語。
   *
   * 既定は「記事」。道具のページでは記事が無くても中身はあるので、
   * そのまま「記事」と出すと、読者は在るはずの記事を探して戻ってしまう。
   */
  readonly fallbackTitle?: string;
}) {
  const result = await (await siteUseCases()).getArticle.execute(readerActor(), { siteSlug, slug });

  /*
    無い記事なら、ここで 404 として打ち切る。**JSX を組み立てる前に呼ぶ。**
    以前はこの下の `ReadFailureBody` が「記事が見つかりませんでした」と描いていたが、
    通信の答えは 200 のままだった。読者の目には同じでも、空の記事が検索結果に載り、
    公開後の見張りからも壊れと区別が付かない（残課題リスト 項目 36）。

    ただし代わりに出すものを渡されているとき（道具のページ）は打ち切らない。
    そちらは記事の不在が壊れではなく、「まだ書いていない」という正しい状態である。
  */
  if (!result.ok && whenArticleMissing === undefined) stopIfMissing(result.error);

  const path = `${pathPrefix}/${slug}`;

  /*
    JSON-LD に入れる絶対 URL の origin。届いたリクエストの Host から作る。
    環境変数に固定すると、開発と本番で構造化データの URL がずれたまま配られる。
    Host が読めない事故のときは origin 無しの相対 URL で出す（嘘の絶対 URL を出さない）。
  */
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host === null ? "" : `${proto}://${host}`;
  const basePath = siteBasePathBySlug(siteSlug);

  return (
    <SiteFrame
      siteSlug={siteSlug}
      currentPath={siteHref(siteSlug, path)}
      trail={[
        { label: routeLabel },
        { label: result.ok ? result.value.title : (fallbackTitle ?? "記事") },
      ]}
      pageKind={PAGE_KIND_BY_PREFIX[pathPrefix] ?? "article"}
    >
      {({ blueprint }) =>
        result.ok ? (
          <>
            {/*
              構造化データ。本文と同じ読み取りモデル（result.value）から
              純関数で作る。値は serializeJsonLd が < を逃がしてから埋める。
            */}
            <script
              type="application/ld+json"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: serializeJsonLd が < を \u003c に逃がした JSON のみを埋める
              dangerouslySetInnerHTML={{
                __html: serializeJsonLd(
                  buildBlogPosting(result.value, {
                    siteName: blueprint.name,
                    origin,
                    basePath,
                  }),
                ),
              }}
            />
            <script
              type="application/ld+json"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: serializeJsonLd が < を \u003c に逃がした JSON のみを埋める
              dangerouslySetInnerHTML={{
                __html: serializeJsonLd(
                  buildBreadcrumbList([
                    { name: blueprint.name, url: `${origin}${basePath}` },
                    {
                      name: result.value.title,
                      url: `${origin}${basePath}${articleHref(result.value)}`,
                    },
                  ]),
                ),
              }}
            />
            {/*
              順位記事だけ ItemList を追加で出す。buildItemList は順位が無い記事で
              null を返し、null は「出さない」に写す（嘘の順位表を出さない）。
            */}
            {(() => {
              const itemList = buildItemList(result.value, {
                siteName: blueprint.name,
                origin,
                basePath,
              });
              return itemList === null ? null : (
                <script
                  type="application/ld+json"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: serializeJsonLd が < を \u003c に逃がした JSON のみを埋める
                  dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemList) }}
                />
              );
            })()}
            {/*
              よくある質問がある記事だけ FAQPage を出す。読者に見えている
              問いと答えを**そのまま**渡す。ここで文言を整えると、画面に無い
              答えが検索結果に出る（構造化データの誤用そのもの）。
            */}
            {(() => {
              const faq = buildFaqPage(result.value.faq ?? []);
              return faq === null ? null : (
                <script
                  type="application/ld+json"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: serializeJsonLd が < を \u003c に逃がした JSON のみを埋める
                  dangerouslySetInnerHTML={{ __html: serializeJsonLd(faq) }}
                />
              );
            })()}
            {/*
              操作できる部分（道具の入力欄と結果）。**本文より先に出す。**
              道具を使いに来た読者に、先に説明を読ませない。
            */}
            {interactiveSlot}
            {/*
              商品カードに「気になる」を足す。**部品の中では作れない。**
              保存はサーバ動作なので、作れるのはこの層だけ。
              どの記事から保存したかも一緒に渡す。読者があとで一覧を開いたとき、
              「なぜ保存したか」を思い出す手がかりがそれしか無い。
            */}
            {(() => {
              const view = toArticleView(siteSlug, result.value);
              return (
                <ArticleView
                  article={{
                    ...view,
                    productCards: view.productCards?.map((card) =>
                      card.productId === undefined
                        ? card
                        : {
                            ...card,
                            saveSlot: (
                              <ShortlistSaveButton
                                siteSlug={siteSlug}
                                productId={card.productId}
                                productName={card.name}
                                fromArticleHref={siteHref(siteSlug, path)}
                                oneLine={card.oneLine}
                              />
                            ),
                          },
                    ),
                  }}
                />
              );
            })()}
          </>
        ) : (
          (whenArticleMissing ?? <ReadFailureBody what="記事" siteSlug={siteSlug} />)
        )
      }
    </SiteFrame>
  );
}
