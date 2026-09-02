import { notFound, permanentRedirect } from "next/navigation";
import { articleHref } from "@/application/read-models/published-article";
import { publicBlogEntry } from "@/presentation/composition";
import { siteHref } from "@/presentation/site/view-model";

export const dynamic = "force-dynamic";

/**
 * 過去の `/blog/:slug` 入口。
 *
 * 本文はここで二重に描かない。canonical public projection から
 * 記事種別を読み、`articleHref` が決める唯一の URL へ 308 で寄せる。
 */
export default async function LegacyBlogArticlePage({
  params,
}: {
  params: Promise<{ site: string; article: string }>;
}) {
  const { site, article: slug } = await params;
  const entry = await publicBlogEntry();
  const opened = await entry.port.openSite(site);
  if (!opened.ok) throw new Error("公開サイトの保存値を読み込めませんでした。");
  if (opened.value === null) notFound();
  const found = await opened.value.findArticleBySlug(slug);
  if (!found.ok) throw new Error("公開記事を読み込めませんでした。");
  if (found.value === null) notFound();

  permanentRedirect(siteHref(site, articleHref(found.value)));
}
