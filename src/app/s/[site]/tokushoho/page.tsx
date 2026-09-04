import { PolicyPage } from "@/presentation/site/policy-page";

export const dynamic = "force-dynamic";

/** 特定商取引法に基づく表記。本文は 1 箇所（固定文書の保存先）から読む。 */
export default async function TokushohoPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <PolicyPage siteSlug={site} documentKey="tokushoho" path="/tokushoho" />;
}
