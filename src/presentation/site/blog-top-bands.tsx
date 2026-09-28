import type { BlogLayoutBandRecord } from "@/application/ports/blog-ops";
import { brandTagCloud, isSupplementalTopBand, TOP_BAND_LABEL, type SupplementalTopBand } from "@/domain/blogops";
import { EmptyView, ListView, Section } from "@/presentation/ui";
import { articlePageHref } from "./article-pagination";
import type { PublicSiteProjection } from "./public-site-projection";
import { siteHref } from "./view-model";

/**
 * トップの補助帯。
 *
 * canonical な記事一覧とカテゴリー索引は `SiteHomeContent` が描く。
 * ここはそれらと重複しない姉妹サイトと作り手ナビゲータだけを、
 * 旧設定の後方互換として描く。
 *
 * 補助帯が 1 件も無ければ何も描かない（`null` を返す）。
 */

type SupplementalBand = BlogLayoutBandRecord & {
  readonly band: SupplementalTopBand;
};

function isSupplementalBand(band: BlogLayoutBandRecord): band is SupplementalBand {
  return isSupplementalTopBand(band.band);
}

function bandRows(
  band: SupplementalBand,
  siteSlug: string,
  projection: PublicSiteProjection,
): readonly { key: string; label: string; href: string; note: string }[] {
  if (band.band === "sister_sites") {
    /*
      自分自身は姉妹サイトではない。網の読み取りは「自分と自分の子」を返すので、
      ここで自分を落とす。落とさないと、自分のトップに自分へのリンクが並ぶ。
    */
    return projection.network
      .filter((n) => n.siteSlug !== siteSlug)
      .slice(0, band.itemLimit)
      .map((n) => ({
        key: n.id,
        label: n.name,
        href: siteHref(n.siteSlug, "/"),
        note: n.oneLine,
      }));
  }

  // navigator: 記事の入口になる目印（タグ）。
  //
  // **ここは `brandTagCloud()` を通す。**この帯は読者に「これは商品の作り手だ」と
  // 言っている枠なので、話題のタグが混じると枠そのものが嘘になる。
  // 絞る条件をこの場で `filter` として書かないのは、枠が増えた日に
  // 書き忘れても画面は正しく見え、**気づく機会が無い**ため（`domain/blogops/blog-tag.ts`）。
  return brandTagCloud(projection.tags, band.itemLimit).map((t) => ({
    key: t.id,
    label: t.name,
    href: articlePageHref(siteHref(siteSlug, "/search"), 1, { tag: t.slug }),
    note: t.description,
  }));
}

export function BlogTopBands({
  siteSlug,
  projection,
}: {
  readonly siteSlug: string;
  readonly projection: PublicSiteProjection;
}) {
  const ordered = projection.bands
    .filter(isSupplementalBand)
    .sort((a, b) => a.position - b.position);
  if (ordered.length === 0) return null;

  const sections = ordered.map((band) => ({
    band,
    rows: bandRows(band, siteSlug, projection),
  }));

  return (
    <>
      {sections.map(({ band, rows }) => (
        <Section
          key={band.id}
          title={band.title.trim() === "" ? TOP_BAND_LABEL[band.band] : band.title}
        >
          {rows.length === 0 ? (
            <EmptyView
              title="まだ出せるものがありません"
              body="ここに並ぶものが用意されると、自動で表示されます。"
            />
          ) : (
            <ListView rows={rows} />
          )}
        </Section>
      ))}
    </>
  );
}
