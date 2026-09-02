/**
 * @tier 2
 * @req REQ-BLOG02, REQ-BOPS02, REQ-BOPS03, REQ-BOPS06, REQ-BOPS11
 * @types contract
 */
import { describe, expect, it, vi } from "vitest";
import {
  SITE_DOCUMENT_KEYS,
  SITE_PROVISIONING_REQUIRED_COUNTS,
} from "@/domain/authoring";
import { err, ok } from "@/domain/shared";
import {
  projectPublicSiteComposition,
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
    documents: [],
    deliveryParts: [],
    chrome: { headerSlots: [], footerSlots: [] },
    ...over,
  };
}

describe("PublicSiteProjection", () => {
  it("設計図に文書宣言があっても実サイト文書 0 件なら公開準備完了にしない", () => {
    const report = projectPublicSiteComposition(projectionWith());

    expect(report.counts.site_documents).toBe(0);
    expect(report.reachable).toBe(true);
    expect(report.provisioningComplete).toBe(false);
    expect(report.contentReady).toBe(false);
    expect(report.gaps.map((gap) => gap.element)).toContain("site_documents");
  });

  it("実サイト文書が一部だけなら、実件数を保ったまま未完了にする", () => {
    const report = projectPublicSiteComposition(
      projectionWith({
        documents: [
          {
            key: "operator",
            title: "運営者",
            body: ["本文"],
            updatedAt: new Date("2026-08-27T00:00:00.000Z"),
          },
        ],
      }),
    );

    expect(report.counts.site_documents).toBe(1);
    expect(report.missingDocuments.length).toBeGreaterThan(0);
    expect(report.provisioningComplete).toBe(false);
    expect(report.contentReady).toBe(false);
    expect(report.gaps.map((gap) => gap.element)).toContain("site_documents");
  });

  /*
    以前ここは「8 種の下書き固定ページは作成完了に数える」を固定していた。
    空の枠を 8 行先に作る作りをやめた（`SITE_PROVISIONING_REQUIRED_COUNTS`
    の `site_documents: 0`）ので、確かめる中身も裏返す。

    **「0 件でも作成完了」は緩めたのではない。**まだ 1 文字も書かれていない
    運営者情報を「整備済み」と数える形をやめた結果で、不足は
    `missingDocuments` と `degrading` な gap として画面に残り続ける。
  */
  it("サイト文書が 1 件も無くても作成完了と数え、公開準備完了にはしない", () => {
    const report = projectPublicSiteComposition(
      projectionWith({
        documents: [],
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

    expect(report.counts.site_documents).toBe(0);
    expect(report.provisioningComplete).toBe(true);
    expect(report.contentReady).toBe(false);
    expect(report.missingDocuments).toEqual(SITE_DOCUMENT_KEYS);
    expect(
      report.gaps.find((gap) => gap.element === "site_documents")?.severity,
    ).toBe("degrading");
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
      listDocuments: vi.fn(async () => ok([])),
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
      reader.listDocuments,
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
      listDocuments: vi.fn(async () => ok([])),
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

  it("公開投影は旧固定ページ一覧へ依存せず、正本文書の可否を各canonical routeへ委ねる", async () => {
    const reader = {
      blueprint: {} as never,
      listLayoutSlots: async () => ok([]),
      listLayoutBands: async () => ok([]),
      // 描画用（enabled のみ）とは別に、作成完了の判定が読む「未削除の実体」。
      // ここを省くと、版面が 0 枚のまま provisioningComplete を語れなくなる。
      listProvisionedLayoutSlots: async () => ok([]),
      listProvisionedLayoutBands: async () => ok([]),
      listPublished: async () => ok([]),
      findSourceArticleId: async () => ok(null),
      listNetwork: async () => ok([]),
      listTags: async () => ok([]),
      listDocuments: async () => ok([]),
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
      // 正本は `documents` 1 本。旧語彙が消えたことと、新語彙が生えたことを
      // 同じ箇所で見る。片方だけ確かめると、両方無い状態が緑になる。
      expect(result.value.documents).toEqual([]);
    }
  });
});
