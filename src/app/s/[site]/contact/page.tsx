import { SiteFrame } from "@/presentation/site/page-frame";
import { ContactForm } from "@/presentation/site/contact-form";
import { siteHref } from "@/presentation/site/view-model";
import { Note, SitePage, UI_COPY } from "@/presentation/ui";
import { tryGetWorkerEnv } from "@/infrastructure/platform/worker-env";

export const dynamic = "force-dynamic";

/**
 * 問い合わせ。
 *
 * **もう見本ではない。** 送った内容は保存され、運営者が `/admin/contact` で読む。
 *
 * ただしメールの通知はまだ無い（送信元アドレスと自動送信よけの登録が済んでいない）。
 * そこは伏せない。**「すぐに気づいてもらえる」と読める書き方をしない**ため、
 * 返事までに時間がかかりうることを本文の下に書いておく。
 * 保存先につながっていない環境では、送信そのものが断られる（受け取ったふりをしない）。
 */
export default async function ContactPage({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  const env = await tryGetWorkerEnv();
  const turnstileSiteKey =
    typeof env.TURNSTILE_SITE_KEY === "string" ? env.TURNSTILE_SITE_KEY : null;

  return (
    <SiteFrame
      siteSlug={site}
      currentPath={siteHref(site, "/contact")}
      trail={[{ label: "問い合わせ" }]}
    >
      {() => (
        <SitePage title="問い合わせ" lead={UI_COPY.reader.contactNote}>
          <ContactForm siteSlug={site} turnstileSiteKey={turnstileSiteKey} />
          <Note>
            いただいた内容は運営者へ届きますが、メールでの自動通知はまだ設定していません。
            お返事までにお時間をいただくことがあります。お急ぎの場合は、
            記事の中に案内している連絡先をご利用ください。
          </Note>
        </SitePage>
      )}
    </SiteFrame>
  );
}
