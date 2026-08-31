/**
 * @tier 2
 * @req REQ-BLOG02, REQ-BOPS02, REQ-BOPS03, REQ-BOPS06, REQ-BOPS11
 * @types contract
 */
import { describe, expect, it, vi } from "vitest";
import { ok } from "@/domain/shared";
import {
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

  it("公開投影は旧固定ページ一覧へ依存せず、正本文書の可否を各canonical routeへ委ねる", async () => {
    const reader = {
      blueprint: {} as never,
      listLayoutSlots: async () => ok([]),
      listLayoutBands: async () => ok([]),
      listPublished: async () => ok([]),
      listNetwork: async () => ok([]),
      listTags: async () => ok([]),
      listDeliveryParts: async () => ok([]),
      findArticleBySlug: async () => ok(null),
    };

    const result = await readPublicSiteProjection("hub", {
      source: "sample",
      port: { openSite: async () => ok(reader) },
    });

    expect(result.ok && result.value).not.toBeNull();
    if (result.ok && result.value !== null) {
      expect(result.value).not.toHaveProperty("fixedPages");
      expect(result.value.chrome).not.toHaveProperty("fixedPageLinks");
    }
  });
});
