import { notFound } from "next/navigation";
import {
  buildBlogOpsFaqPage,
  buildBlogOpsPosting,
  buildBreadcrumbList,
} from "@/application/seo/structured-data";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import { isOk } from "@/domain/shared";
import { publicBlogEntry } from "@/presentation/composition";
import { requestOriginFromNextHeaders } from "@/presentation/http/request-origin";
import { BlogArticleView } from "@/presentation/site/blog-article-view";
import { JsonLdScript } from "@/presentation/site/json-ld-script";
import { ReadFailureBody, SiteFrame } from "@/presentation/site/page-frame";
import { ReaderRatingForm } from "@/presentation/site/reader-rating-form";
import { blogArticleMetadata } from "@/presentation/site/site-metadata";
import { siteHref } from "@/presentation/site/view-model";
import { Section, SitePage } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/** 検索結果・SNS・AI 検索へ渡す題名と要約（受入 A10）。画面と同じ記事から作る。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ site: string; article: string }>;
}) {
  const { site, article } = await params;
  return blogArticleMetadata(site, article);
}

/**
 * ブログ運用で作った記事 1 本の、読者側の画面。
 *
 * 記事型 (T1〜T4) はここで分岐しない。`BlogArticleView` にも `if (template === "T1")`
 * は無く、型の違いは**表を引いた結果**として出る (目次の段・商品カードを再掲する場所)。
 * 表は `domain/blogops/article-outline.ts` にある。分岐として書くと、
 * 型が 1 つ増えた日に画面側の 4 本の枝を全部読み直すことになる。
 */
export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ site: string; article: string }>;
}) {
  const { site, article } = await params;
  const entry = await publicBlogEntry();
  const now = new Date();

  /*
    JSON-LD に入れる絶対 URL の origin。届いたリクエストの Host から作る。
    環境変数に固定すると、開発と本番で構造化データの URL がずれたまま配られる。
    信頼できる origin が読めない事故のときは JSON-LD 自体を出さない。
  */
  const origin = await requestOriginFromNextHeaders();
  const basePath = siteBasePathBySlug(site);

  return (
    <SiteFrame
      siteSlug={site}
      currentPath={siteHref(site, `/blog/${article}`)}
      trail={[
        { label: "記事一覧", path: siteHref(site, "/blog") },
        { label: "記事" },
      ]}
      pageKind="article"
      sidebar
    >
      {async ({ blueprint, projection }) => {
        const found = await projection.reader.findArticleBySlug(article);
        if (isOk(found) && found.value === null) notFound();
        if (!found.ok) return <ReadFailureBody what="記事" siteSlug={site} />;
        const detail = found.value;
        if (detail === null) notFound();
        const summary = await entry.summarizeRating(detail.article.id);
        const faqPage = buildBlogOpsFaqPage(detail.blocks);
        return (
          <SitePage title={detail.article.title}>
            {/*
              構造化データ（受入 A10・A12）。本文と**同じ記事集約**から純関数で作る。
              画面用と別に読み直すと、読者に見えている更新日と
              検索エンジンへ渡す dateModified が別々にずれる。
              値は serializeJsonLd が `<` を逃がしてから埋める。
            */}
            {origin === null ? null : (
              <>
                <JsonLdScript
                  value={buildBlogOpsPosting({
                    article: detail.article,
                    blocks: detail.blocks,
                    site: { siteName: blueprint.name, origin, basePath },
                  })}
                />
                <JsonLdScript
                  value={buildBreadcrumbList([
                    { name: blueprint.name, url: `${origin}${basePath}` },
                    { name: "記事一覧", url: `${origin}${basePath}/blog` },
                    {
                      name: detail.article.title,
                      url: `${origin}${basePath}/blog/${detail.article.slug}`,
                    },
                  ])}
                />
                {faqPage === null ? null : <JsonLdScript value={faqPage} />}
              </>
            )}
            <BlogArticleView
              template={detail.article.template}
              lead={detail.article.lead}
              authorName={detail.article.authorName}
              updatedAt={detail.article.updatedAt}
              now={now}
              blocks={detail.blocks}
            >
              <Section
                title="この記事の評価"
                lead="点は誰でも付けられます。名前や連絡先は要りません。"
              >
                <ReaderRatingForm
                  siteSlug={site}
                  articleSlug={detail.article.slug}
                  initialCount={summary !== null && isOk(summary) ? summary.value.count : 0}
                  initialAverage={
                    summary !== null && isOk(summary) ? summary.value.average : null
                  }
                />
              </Section>
            </BlogArticleView>
          </SitePage>
        );
      }}
    </SiteFrame>
  );
}
