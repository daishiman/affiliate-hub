/**
 * @tier 2
 * @req REQ-BLOG02, REQ-BOPS02, REQ-BOPS03, REQ-BOPS06, REQ-BOPS11
 * @types contract
 */
import { describe, expect, it, vi } from "vitest";
import { SITE_PROVISIONING_REQUIRED_COUNTS } from "@/domain/authoring";
import { FIXED_PAGE_KINDS } from "@/domain/blogops";
import { err, ok } from "@/domain/shared";
import {
  projectPublicSiteComposition,
  projectPublicSiteChrome,
  readPublicSiteProjection,
  type PublicSiteProjection,
} from "@/presentation/site/public-site-projection";

function projectionWith(
  over: Partial<PublicSiteProjection> = {},
): PublicSiteProjection {
  return {
    source: "live",
    reader: {
      // 設計図に固定ページが宣言されていても、実在する公開固定ページとは数えない。
      blueprint: {
        pages: ["profile", "contact"],
        categories: [{ slug: "guide" }],
      } as never,
    } as never,
    slots: [{}] as never,
    provisionedSlots: [{}] as never,
    bands: [{}] as never,
    provisionedBands: [{}] as never,
    articles: [],
    network: [{}] as never,
    tags: [],
    provisionedFixedPages: [],
    fixedPages: [],
    deliveryParts: [],
    chrome: { headerSlots: [], footerSlots: [], fixedPageLinks: [] },
    ...over,
  };
}

describe("PublicSiteProjection", () => {
  it("設計図に固定ページ宣言があっても実固定ページ0件なら公開準備完了にしない", () => {
    const report = projectPublicSiteComposition(projectionWith());

    expect(report.counts.fixed_pages).toBe(0);
    expect(report.reachable).toBe(true);
    expect(report.provisioningComplete).toBe(false);
    expect(report.contentReady).toBe(false);
    expect(report.gaps.map((gap) => gap.element)).toContain("fixed_pages");
  });

  it("実固定ページが一部だけなら、実件数を保ったまま未完了にする", () => {
    const report = projectPublicSiteComposition(
      projectionWith({
        provisionedFixedPages: [
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
      }),
    );

    expect(report.counts.fixed_pages).toBe(1);
    expect(report.missingFixedPages.length).toBeGreaterThan(0);
    expect(report.provisioningComplete).toBe(false);
    expect(report.contentReady).toBe(false);
    expect(report.gaps.map((gap) => gap.element)).toContain("fixed_pages");
  });

  it("8 種の下書き固定ページは作成完了に数えるが、公開準備完了にはしない", () => {
    const provisionedFixedPages = FIXED_PAGE_KINDS.map((kind) => ({
      id: `page-${kind}`,
      siteSlug: "hub",
      kind,
      title: kind,
      body: "",
      status: "draft" as const,
      deletedAt: null,
      updatedAt: new Date("2026-08-27T00:00:00.000Z"),
    }));
    const report = projectPublicSiteComposition(
      projectionWith({
        provisionedFixedPages,
        fixedPages: [],
        provisionedBands: Array.from(
          { length: SITE_PROVISIONING_REQUIRED_COUNTS.layout_bands },
          () => ({}),
        ) as never,
        provisionedSlots: Array.from(
          { length: SITE_PROVISIONING_REQUIRED_COUNTS.layout_slots },
          () => ({}),
        ) as never,
      }),
    );

    expect(report.counts.fixed_pages).toBe(FIXED_PAGE_KINDS.length);
    expect(report.provisioningComplete).toBe(true);
    expect(report.contentReady).toBe(false);
    expect(report.missingFixedPages).toEqual(FIXED_PAGE_KINDS);
  });

  it("公開投影の記事を構成要素から漏らさない", () => {
    const report = projectPublicSiteComposition(
      projectionWith({ articles: [{ id: "article-1" }, { id: "article-2" }] as never }),
    );

    expect(report.counts.articles).toBe(2);
    expect(report.gaps.map((gap) => gap.element)).not.toContain("articles");
  });

  it("公開サイトに必要な保存値を各 1 回だけ読む", async () => {
    const reader = {
      blueprint: {} as never,
      listLayoutSlots: vi.fn(async () => ok([])),
      listProvisionedLayoutSlots: vi.fn(async () => ok([])),
      listLayoutBands: vi.fn(async () => ok([])),
      listProvisionedLayoutBands: vi.fn(async () => ok([])),
      listPublished: vi.fn(async () => ok([])),
      listNetwork: vi.fn(async () => ok([])),
      listTags: vi.fn(async () => ok([])),
      listProvisionedFixedPages: vi.fn(async () => ok([])),
      listFixedPages: vi.fn(async () => ok([])),
      listDeliveryParts: vi.fn(async () => ok([])),
      findArticleBySlug: vi.fn(async () => ok(null)),
      findSourceArticleId: vi.fn(async () => ok(null)),
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
      reader.listProvisionedLayoutSlots,
      reader.listLayoutBands,
      reader.listProvisionedLayoutBands,
      reader.listPublished,
      reader.listNetwork,
      reader.listTags,
      reader.listProvisionedFixedPages,
      reader.listFixedPages,
      reader.listDeliveryParts,
    ]) {
      expect(read).toHaveBeenCalledTimes(1);
    }
    if (result.ok) expect(result.value?.source).toBe("sample");
  });

  it("読み取りが 1 つ失敗したら、他が揃っていても投影を作らず閉じる", async () => {
    // 「一部だけ古い公開面を描かない」は本体のコメントが宣言している約束で、
    // ここで初めて機械が確かめる。番人を 1 つに束ねた後も約束が残ることを固定する。
    const reader = {
      blueprint: {} as never,
      listLayoutSlots: vi.fn(async () => ok([])),
      listProvisionedLayoutSlots: vi.fn(async () => ok([])),
      listLayoutBands: vi.fn(async () => ok([])),
      listProvisionedLayoutBands: vi.fn(async () => ok([])),
      listPublished: vi.fn(async () => ok([])),
      listNetwork: vi.fn(async () => ok([])),
      listTags: vi.fn(async () => err({ kind: "storage", message: "タグが読めません" })),
      listProvisionedFixedPages: vi.fn(async () => ok([])),
      listFixedPages: vi.fn(async () => ok([])),
      listDeliveryParts: vi.fn(async () => ok([])),
      findArticleBySlug: vi.fn(async () => ok(null)),
      findSourceArticleId: vi.fn(async () => ok(null)),
    };
    const port = { openSite: vi.fn(async () => ok(reader)) };

    const result = await readPublicSiteProjection("hub", { source: "live", port } as never);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toEqual({ kind: "storage", message: "タグが読めません" });
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
