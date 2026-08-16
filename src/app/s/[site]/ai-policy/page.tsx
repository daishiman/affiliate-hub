import { PolicyPage } from "@/presentation/site/policy-page";

export const dynamic = "force-dynamic";

/** AI の使い方。本文は 1 箇所（方針の保存先）から読む。画面には書かない。 */
export default async function AiPolicyPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <PolicyPage siteSlug={site} documentKey="ai-policy" path="/ai-policy" />;
}
