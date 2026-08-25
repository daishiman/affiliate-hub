import { headers } from "next/headers";
import { articleHref } from "@/application/read-models/published-article";
import {
  buildBlogPosting,
  buildBreadcrumbList,
  buildItemList,
  serializeJsonLd,
} from "@/application/seo/structured-data";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import { readerActor, siteUseCases } from "@/presentation/composition";
import type { PageKind } from "@/presentation/tools/webmcp-policy";
import { ArticleView } from "@/presentation/ui";
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
}: {
  readonly siteSlug: string;
  readonly slug: string;
  /** `/best` など。パンくずと現在地の表示に使う。 */
  readonly pathPrefix: string;
  readonly routeLabel: string;
}) {
  const result = await (await siteUseCases()).getArticle.execute(readerActor(), { siteSlug, slug });

  /*
    無い記事なら、ここで 404 として打ち切る。**JSX を組み立てる前に呼ぶ。**
    以前はこの下の `ReadFailureBody` が「記事が見つかりませんでした」と描いていたが、
    通信の答えは 200 のままだった。読者の目には同じでも、空の記事が検索結果に載り、
    公開後の見張りからも壊れと区別が付かない（残課題リスト 項目 36）。
  */
  if (!result.ok) stopIfMissing(result.error);

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
      trail={[{ label: routeLabel }, { label: result.ok ? result.value.title : "記事" }]}
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
            <ArticleView article={toArticleView(siteSlug, result.value)} />
          </>
        ) : (
          <ReadFailureBody what="記事" siteSlug={siteSlug} />
        )
      }
    </SiteFrame>
  );
}
