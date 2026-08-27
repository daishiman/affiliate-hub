/**
 * @tier 2
 * @req REQ-BLOG02, REQ-BOPS02, REQ-BOPS03, REQ-BOPS06, REQ-BOPS11
 * @types contract
 */
import { describe, expect, it, vi } from "vitest";
import { ok } from "@/domain/shared";
import {
  projectPublicSiteChrome,
  readPublicSiteProjection,
} from "@/presentation/site/public-site-projection";

describe("PublicSiteProjection", () => {
  it("公開サイトに必要な保存値を各 1 回だけ読む", async () => {
    const reader = {
      blueprint: {} as never,
      listLayoutSlots: vi.fn(async () => ok([])),
      listLayoutBands: vi.fn(async () => ok([])),
      listPublished: vi.fn(async () => ok([])),
      listNetwork: vi.fn(async () => ok([])),
      listTags: vi.fn(async () => ok([])),
      listFixedPages: vi.fn(async () => ok([])),
      listDeliveryParts: vi.fn(async () => ok([])),
      findArticleBySlug: vi.fn(async () => ok(null)),
    };
    const port = { openSite: vi.fn(async () => ok(reader)) };

    const result = await readPublicSiteProjection("hub", {
      source: "sample",
      port,
    });

    expect(result.ok).toBe(true);
    expect(port.openSite).toHaveBeenCalledTimes(1);
    expect(port.openSite).toHaveBeenCalledWith("hub");
    for (const read of [
      reader.listLayoutSlots,
      reader.listLayoutBands,
      reader.listPublished,
      reader.listNetwork,
      reader.listTags,
      reader.listFixedPages,
      reader.listDeliveryParts,
    ]) {
      expect(read).toHaveBeenCalledTimes(1);
    }
    if (result.ok) expect(result.value?.source).toBe("sample");
  });

  it("公開identityが無ければ空の投影を作らずnullで閉じる", async () => {
    const port = { openSite: vi.fn(async () => ok(null)) };
    const result = await readPublicSiteProjection("deleted", { source: "live", port });

    expect(result).toEqual({ ok: true, value: null });
    expect(port.openSite).toHaveBeenCalledTimes(1);
  });

  it("公開中の固定ページを正本 URL で footer へ投影する", () => {
    const chrome = projectPublicSiteChrome("hub", {
      fixedPages: [
        {
          id: "page-profile",
          siteSlug: "hub",
          kind: "profile",
          title: "運営者",
          body: "本文",
          status: "published",
          deletedAt: null,
          updatedAt: new Date("2026-08-27T00:00:00.000Z"),
        },
      ],
      slots: [],
    });

    expect(chrome.fixedPageLinks).toEqual([
      { href: "/s/hub/profile", label: "運営者" },
    ]);
  });
});
