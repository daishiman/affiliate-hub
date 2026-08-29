import { readerActor, siteUseCases } from "@/presentation/composition";
import { SiteHomeContent, toSiteHomeView } from "@/presentation/site/home-content";
import { SiteFrame } from "@/presentation/site/page-frame";
import { siteHref } from "@/presentation/site/view-model";

export const dynamic = "force-dynamic";

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
    <SiteFrame siteSlug={site} currentPath={siteHref(site, "/")} pageKind="site_home">
      {({ blueprint }) => (
        <SiteHomeContent
          view={toSiteHomeView(site, blueprint, recent.ok ? recent.value : [])}
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
