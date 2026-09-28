import type { Metadata } from "next";
import { ArticleIndexPage, articleIndexMetadata } from "@/presentation/site/article-index-page";
import { articlePageNumber } from "@/presentation/site/article-pagination";

export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ site: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ site }, query] = await Promise.all([params, searchParams]);
  return articleIndexMetadata(site, "review", articlePageNumber(query?.page));
}

export default async function Page({ params, searchParams }: Props) {
  const [{ site }, query] = await Promise.all([params, searchParams]);
  return <ArticleIndexPage siteSlug={site} type="review" page={articlePageNumber(query?.page)} />;
}
