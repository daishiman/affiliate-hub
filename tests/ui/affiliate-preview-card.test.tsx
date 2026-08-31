/** @tier 2 @req REQ-P02, REQ-A07 @types a11y, equivalence */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AffiliatePreview } from "@/domain/monetization";
import { AffiliatePreviewCard } from "@/presentation/admin/earn/affiliate-preview-card";
import { asPartOfPage, findA11yViolations } from "../support/a11y";

const PREVIEW: AffiliatePreview = {
  rawUrl: "https://shop.provider.test/item",
  canonicalUrl: "https://shop.provider.test/item",
  productName: "図解キット",
  merchantName: "Example Works",
  oneLine: "複雑な手順をひと目で確認できる道具。",
  imageUrl: null,
  price: "4980",
  currency: "JPY",
  retrievedAt: "2026-08-29T12:00:00.000Z",
  sourceHost: "shop.provider.test",
  method: "json-ld",
  status: "ready",
  reason: null,
  duplicateCandidates: [],
  providerId: "fixture",
  providerLabel: "Fixture",
};

describe("AffiliatePreviewCard", () => {
  it("権利許可済みURLが無いときは独自図解にする", () => {
    const html = renderToStaticMarkup(<AffiliatePreviewCard preview={PREVIEW} />);
    expect(html).toContain("写真の代わりに");
    expect(html).not.toContain("<img");
    expect(html).toContain("まだ保存していません");
  });

  it("A8の9項目と保存後の次操作をDOM上で確認できる", () => {
    const html = renderToStaticMarkup(
      <AffiliatePreviewCard
        preview={{ ...PREVIEW, duplicateCandidates: ["inbox:li_existing", "link:al_existing"] }}
      />,
    );
    for (const expected of [
      PREVIEW.rawUrl,
      PREVIEW.canonicalUrl ?? "",
      PREVIEW.productName ?? "",
      PREVIEW.merchantName ?? "",
      PREVIEW.price ?? "",
      PREVIEW.currency ?? "",
      PREVIEW.retrievedAt,
      PREVIEW.sourceHost,
      PREVIEW.method,
      "inbox:li_existing",
      "link:al_existing",
      "保存後はサイト・記事・ブロックを指定",
      "差し替え",
    ]) {
      expect(html, expected).toContain(expected);
    }
  });

  it("権利ゲートを通ったimage URLだけ表示できる", () => {
    const html = renderToStaticMarkup(
      <AffiliatePreviewCard preview={{ ...PREVIEW, imageUrl: "https://images.provider.test/item.png" }} />,
    );
    expect(html).toContain("<img");
    expect(html).toContain('referrerPolicy="no-referrer"');
  });

  it("重大な読み上げ違反が無い", async () => {
    const html = renderToStaticMarkup(<AffiliatePreviewCard preview={PREVIEW} />);
    const violations = await findA11yViolations(asPartOfPage(html));
    expect(violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
  });
});
