import type { Metadata } from "next";
import { SiteFrame } from "@/presentation/site/page-frame";
import { siteHref } from "@/presentation/site/view-model";
import { siteHomeMetadata } from "@/presentation/site/site-metadata";
import { EmptyView, ListView, Section, SeeAlso, SitePage, TextLink } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/** 一度に出す本数。全部出すと、記事が増えたときに 1 画面が際限なく伸びる。 */
const PAGE_SIZE = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ site: string }>;
}): Promise<Metadata> {
  const { site } = await params;
  return siteHomeMetadata(site);
}

/**
 * 公開している記事の一覧。
 *
 * **下書きを混ぜない口だけを使う。** `publicBlogEntry` が返す
 * `listPublished` は公開済みしか返さないので、この画面で状態を絞り直さない。
 * 絞り直す形にすると、絞り忘れ 1 か所で下書きが読者に出る。
 */
export default async function BlogIndex({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return (
    <SiteFrame
      siteSlug={site}
      currentPath={siteHref(site, "/blog")}
      trail={[{ label: "記事一覧" }]}
      pageKind="article"
      sidebar
    >
      {({ blueprint, projection }) => {
        const articles = projection.articles.slice(0, PAGE_SIZE);
        return (
          <SitePage title="記事一覧" lead={blueprint.purpose} wide>
            <Section title="公開中の記事">
              {articles.length === 0 ? (
                <EmptyView
                  title="まだ公開した記事がありません"
                  body="記事が公開されると、新しい順にここへ並びます。"
                />
              ) : (
                <ListView
                  rows={articles.map((a) => ({
                    key: a.id,
                    label: a.title,
                    href: siteHref(site, `/blog/${a.slug}`),
                    note:
                      a.lead === ""
                        ? `最終更新 ${a.updatedAt.toISOString().slice(0, 10)}`
                        : a.lead,
                  }))}
                />
              )}
            </Section>
            {/* 単独のリンクは `SeeAlso` に包む。裸の `<p><a>` は押しどころの下限を持たない。 */}
            <SeeAlso>
              <TextLink href={siteHref(site, "/")}>トップへ戻る</TextLink>
            </SeeAlso>
          </SitePage>
        );
      }}
    </SiteFrame>
  );
}
