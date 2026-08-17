import { PolicyPage } from "@/presentation/site/policy-page";

export const dynamic = "force-dynamic";

/** 評価方法。本文は 1 箇所（方針の保存先）から読む。画面には書かない。 */
export default async function MethodologyPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <PolicyPage siteSlug={site} documentKey="methodology" path="/methodology" />;
}
