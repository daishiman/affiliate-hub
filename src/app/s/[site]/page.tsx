import type { Metadata } from "next";
import { readerActor, siteUseCases } from "@/presentation/composition";
import { siteHomeMetadata } from "@/presentation/site/site-metadata";
import { SiteHomeContent, toSiteHomeView } from "@/presentation/site/home-content";
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
export default async function SiteHome({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const recent = await (await siteUseCases()).listRecent.execute(readerActor(), { siteSlug: site });

  return (
    <SiteFrame siteSlug={site} currentPath={siteHref(site, "/")} pageKind="site_home" sidebar>
      {({ blueprint, projection }) => (
        <SiteHomeContent
          view={toSiteHomeView(site, blueprint, recent.ok ? recent.value : [])}
          bandsSlot={
            <BlogTopBands
              siteSlug={site}
              projection={projection}
              categories={blueprint.categories.map((c) => ({
                slug: c.slug,
                name: c.name,
                oneLine: c.oneLine,
              }))}
            />
          }
          recentError={
            recent.ok
              ? undefined
              : {
                  title: "記事を読み込めませんでした",
                  body: recent.error.suggestedAction ?? recent.error.message,
                }
          }
        />
      )}
    </SiteFrame>
  );
}
