import { PolicyPage } from "@/presentation/site/policy-page";

export const dynamic = "force-dynamic";

/** 利用規約。本文は 1 箇所（方針の保存先）から読む。画面には書かない。 */
export default async function TermsPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <PolicyPage siteSlug={site} documentKey="terms" path="/terms" />;
}
