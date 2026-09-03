import type { BlogLayoutBandRecord } from "@/application/ports/blog-ops";
import { articleHref } from "@/application/read-models/published-article";
import { brandTagCloud, TOP_BAND_LABEL } from "@/domain/blogops";
import { EmptyView, ListView, Section } from "@/presentation/ui";
import type { PublicSiteProjection } from "./public-site-projection";
import { siteHref } from "./view-model";

/**
 * トップの帯。
 *
 * **並び順と件数を画面に持たせない。** 帯の順番・見出し・出す件数は
 * 管理画面 (`/admin/blog/layout`) が保存した設定が正本で、ここは
 * 保存された通りに描くだけにしてある。画面側に既定値を書くと、
 * 管理画面で変えたのに変わらない帯が生まれる。
 *
 * 設定が 1 件も無いブログでは何も描かない（`null` を返す）。
 * 「まだ設定していない」は読者に見せる情報ではないので、
 * 空の見出しだけを並べることはしない。
 */

export type TopBandCategory = {
  readonly slug: string;
  readonly name: string;
  readonly oneLine: string;
};

function bandRows(
  band: BlogLayoutBandRecord,
  siteSlug: string,
  categories: readonly TopBandCategory[],
  projection: PublicSiteProjection,
): readonly { key: string; label: string; href: string; note: string }[] {

  if (band.band === "latest_posts") {
    return projection.articles.slice(0, band.itemLimit).map((a) => ({
      key: a.slug,
      label: a.title,
      href: siteHref(siteSlug, articleHref(a)),
      note: a.summary === "" ? a.updatedAt.slice(0, 10) : a.summary,
    }));
  }

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

  if (band.band === "category_hub") {
    return categories.slice(0, band.itemLimit).map((c) => ({
      key: c.slug,
      label: c.name,
      href: siteHref(siteSlug, `/categories/${c.slug}`),
      note: c.oneLine,
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
    href: siteHref(siteSlug, `/search?tag=${encodeURIComponent(t.slug)}`),
    note: t.description,
  }));
}

export function BlogTopBands({
  siteSlug,
  categories,
  projection,
}: {
  readonly siteSlug: string;
  readonly categories: readonly TopBandCategory[];
  readonly projection: PublicSiteProjection;
}) {
  if (projection.bands.length === 0) return null;

  const ordered = [...projection.bands].sort((a, b) => a.position - b.position);
  const sections = ordered.map((band) => ({
    band,
    rows: bandRows(band, siteSlug, categories, projection),
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
