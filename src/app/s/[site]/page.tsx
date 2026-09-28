import type { Metadata } from "next";
import { buildArticleItemList, buildWebSite } from "@/application/seo/structured-data";
import { parseHomeSort } from "@/domain/blogops";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import { requestOriginFromNextHeaders } from "@/presentation/http/request-origin";
import { siteHomeMetadata } from "@/presentation/site/site-metadata";
import { SiteHomeContent, toSiteHomeView } from "@/presentation/site/home-content";
import { JsonLdScript } from "@/presentation/site/json-ld-script";
import { SiteFrame } from "@/presentation/site/page-frame";
import { BlogTopBands } from "@/presentation/site/blog-top-bands";
import { siteHref } from "@/presentation/site/view-model";

export const dynamic = "force-dynamic";

/** ブログ名と目的を検索結果・SNS・AI 検索へ渡す。設計図が正本。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ site: string }>;
}): Promise<Metadata> {
  const { site } = await params;
  return siteHomeMetadata(site);
}

/**
 * ブログのトップ。
 *
 * ブログ 1 本ごとにこのファイルを作らない。`[site]` で受けて、
 * 設計図の設定値だけで見た目と中身が変わる（要求 C の複数ブログ対応）。
 */
export default async function SiteHome({
  params,
  searchParams,
}: {
  params: Promise<{ site: string }>;
  /**
   * `?sort=latest|popular`。
   *
   * **住所で受ける。**押しボタンにして画面の中で並べ替えると、
   * JavaScript が動かない読者に「人気順」が一生届かず、
   * その並びをそのまま人へ送ることもできなくなる。
   */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ site }, query] = await Promise.all([params, searchParams]);
  const raw = query.sort;
  const sort = parseHomeSort(Array.isArray(raw) ? raw[0] : raw);
  /*
    構造化データに入れる絶対 URL の origin。届いたリクエストの Host から作る。
    読めない事故のときは JSON-LD 自体を出さない（記事画面と同じ判断）。
  */
  const origin = await requestOriginFromNextHeaders();
  const basePath = siteBasePathBySlug(site);

  return (
    <SiteFrame siteSlug={site} currentPath={siteHref(site, "/")} pageKind="site_home" sidebar>
      {async ({ blueprint, projection }) => {
        /*
          読者評価は「人気順」のときだけ引く。最新順で毎回引くと、
          結果を使わない読み取りが全アクセスに乗る。
          まとめて 1 回で引くのは、記事ごとに辿ると一覧 1 画面で
          読み取りが記事数だけ増えるため（`summarizeReaderRatings`）。
        */
        const articles = projection.articles;
        const featuredSlugs = new Set(
          projection.featuredArticles.articles.map((article) => article.slug),
        );
        const sortableArticles = articles.filter((article) => !featuredSlugs.has(article.slug));
        const ratings =
          sort === "popular" && sortableArticles.length > 0
            ? await projection.reader.summarizeReaderRatings(
                sortableArticles.map((article) => article.slug),
              )
            : null;
        const ratingsFailed = ratings?.ok === false;

        const view = toSiteHomeView(site, blueprint, articles, {
          sort,
          ratings: ratings?.ok === true ? ratings.value : undefined,
          featuredArticles: projection.featuredArticles.articles,
          featuredSelectedCount: projection.featuredArticles.selectedCount,
        });
        /*
          機械へ渡す一覧は、**画面に出ている順そのまま**を写す。
          並べ替えた結果を見せるのが目的なので、ここで組み直したら
          読者の見ている一覧と機械の読む一覧が食い違う。
        */
        const itemList =
          origin === null
            ? null
            : buildArticleItemList(
                [
                  ...view.featuredArticles,
                  ...(ratingsFailed ? [] : view.recentArticles),
                ].map((card) => ({
                  title: card.title,
                  url: `${origin}${card.href}`,
                })),
              );

        return (
          <>
            {origin === null ? null : (
              <>
                <JsonLdScript value={buildWebSite({ siteName: blueprint.name, origin, basePath })} />
                {itemList === null ? null : <JsonLdScript value={itemList} />}
              </>
            )}
          <SiteHomeContent
            view={view}
            bandsSlot={
              <BlogTopBands
                siteSlug={site}
                projection={projection}
              />
            }
            recentError={
              ratingsFailed
                ? {
                    title: "人気順を読み込めませんでした",
                    body: ratings.error.suggestedAction ?? ratings.error.message,
                  }
                : undefined
            }
            />
          </>
        );
      }}
    </SiteFrame>
  );
}
