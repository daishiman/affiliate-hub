import { PolicyPage } from "@/presentation/site/policy-page";

export const dynamic = "force-dynamic";

/** 運営者情報。本文は 1 箇所（固定文書の保存先）から読む。画面には書かない。 */
export default async function OperatorPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return <PolicyPage siteSlug={site} documentKey="operator" path="/operator" />;
}
