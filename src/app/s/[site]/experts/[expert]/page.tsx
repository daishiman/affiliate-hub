import { PersonPage } from "@/presentation/site/person-page";

export const dynamic = "force-dynamic";

/** 監修者のページ。記事の監修者表示からここへ来る。 */
export default async function ExpertPage({
  params,
}: {
  params: Promise<{ site: string; expert: string }>;
}) {
  const { site, expert } = await params;
  return <PersonPage siteSlug={site} kind="expert" slug={expert} />;
}
