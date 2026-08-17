import { PersonPage } from "@/presentation/site/person-page";

export const dynamic = "force-dynamic";

/** 書き手のページ。記事の書き手名からここへ来る（孤立ページを作らない）。 */
export default async function AuthorPage({
  params,
}: {
  params: Promise<{ site: string; author: string }>;
}) {
  const { site, author } = await params;
  return <PersonPage siteSlug={site} kind="author" slug={author} />;
}
