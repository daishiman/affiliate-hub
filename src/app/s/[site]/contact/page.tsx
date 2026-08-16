import { SiteFrame } from "@/presentation/site/page-frame";
import { ContactForm } from "@/presentation/site/contact-form";
import { siteHref } from "@/presentation/site/view-model";
import { SitePage, StubNotice, UI_COPY } from "@/presentation/ui";

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
    >
      {() => (
        <SitePage title="問い合わせ" lead={UI_COPY.reader.contactNote}>
          <StubNotice
            what="問い合わせの送信"
            blockedBy="自動送信よけ (Turnstile) の鍵と、送信元メールアドレスの登録"
            stubId="reader:contact-sink"
          />
          <ContactForm siteSlug={site} />
        </SitePage>
      )}
    </SiteFrame>
  );
}
