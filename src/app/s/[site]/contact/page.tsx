import { SiteFrame } from "@/presentation/site/page-frame";
import { ContactForm } from "@/presentation/site/contact-form";
import { PublicFixedPageContent } from "@/presentation/site/public-fixed-page";
import { siteHref } from "@/presentation/site/view-model";
import { StubNotice } from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 問い合わせ。
 *
 * 送信先の設定が済んでいないので、必ず見本の表示を出す。
 * フォームは本物と同じ作法で置いてある（設定が入れば、そのまま送れる）。
 */
export default async function ContactPage({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;

  return (
    <SiteFrame
      siteSlug={site}
      currentPath={siteHref(site, "/contact")}
      trail={[{ label: "問い合わせ" }]}
      requiredFixedPageKind="contact"
    >
      {({ projection }) => {
        const page = projection.fixedPages.find((candidate) => candidate.kind === "contact");
        if (page === undefined) return null;
        return (
        <PublicFixedPageContent page={page}>
          <StubNotice
            what="問い合わせの送信"
            blockedBy="自動送信よけ (Turnstile) の鍵と、送信元メールアドレスの登録"
            stubId="reader:contact-sink"
          />
          <ContactForm siteSlug={site} />
        </PublicFixedPageContent>
        );
      }}
    </SiteFrame>
  );
}
