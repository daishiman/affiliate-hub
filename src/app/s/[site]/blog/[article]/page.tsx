import { notFound } from "next/navigation";
import { isOk } from "@/domain/shared";
import { publicBlogEntry } from "@/presentation/composition";
import { BlogArticleView } from "@/presentation/site/blog-article-view";
import { ReadFailureBody, SiteFrame } from "@/presentation/site/page-frame";
import { ReaderRatingForm } from "@/presentation/site/reader-rating-form";
import { siteHref } from "@/presentation/site/view-model";
import { Section, SitePage } from "@/presentation/ui";

export const dynamic = "force-dynamic";

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

  return (
    <SiteFrame
      siteSlug={site}
      currentPath={siteHref(site, `/blog/${article}`)}
      trail={[
        // SiteFrame が site の接頭辞を1度だけ付ける。完成URLを渡すと
        // `/s/<site>/s/<site>/blog` と二重になる。
        { label: "記事一覧", path: "/blog" },
        { label: "記事" },
      ]}
      pageKind="article"
      sidebar
    >
      {async ({ projection }) => {
        const found = await projection.reader.findArticleBySlug(article);
        if (isOk(found) && found.value === null) notFound();
        if (!found.ok) return <ReadFailureBody what="記事" siteSlug={site} />;
        const detail = found.value;
        if (detail === null) notFound();
        const summary = await entry.summarizeRating(detail.article.id);
        return (
          <SitePage title={detail.article.title}>
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
