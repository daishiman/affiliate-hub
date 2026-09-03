/** @tier 1 @req REQ-B18 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TURNSTILE_CONTACT_ACTION } from "@/application/ports/reader-interaction";
import { ContactForm } from "@/presentation/site/contact-form";

describe("問い合わせフォームのTurnstile契約", () => {
  it("spin-v2 actionとCloudflare標準response fieldをwidgetへ固定する", () => {
    const html = renderToStaticMarkup(
      <ContactForm siteSlug="owned-site" turnstileSiteKey="1x00000000000000000000AA" />,
    );

    expect(html).toContain(`data-action="${TURNSTILE_CONTACT_ACTION}"`);
    expect(html).toContain('data-response-field-name="cf-turnstile-response"');
    expect(html).not.toContain('data-response-field-name="humanCheckToken"');
  });
});
