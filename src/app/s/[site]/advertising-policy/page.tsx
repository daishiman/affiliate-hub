import { PolicyPage } from "@/presentation/site/policy-page";

export const dynamic = "force-dynamic";

/** 広告に関する方針。本文は 1 箇所（方針の保存先）から読む。画面には書かない。 */
export default async function AdvertisingPolicyPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <PolicyPage siteSlug={site} documentKey="advertising-policy" path="/advertising-policy" />;
}
