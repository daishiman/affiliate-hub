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
import { domainError } from "@/domain/shared/errors";
import { err, ok } from "@/domain/shared";
import {
  projectPublicSiteComposition,
  readPublicSiteProjection,
  type PublicSiteProjection,
} from "@/presentation/site/public-site-projection";
import {
  aLayoutBand,
  aLayoutSlot,
  anArticleSummary,
  aPublicSiteProjection,
  aPublicSiteReader,
  aSiteNetworkNode,
} from "../support/factories";

/**
 * 設計図に固定ページが宣言されていても、実在する公開固定ページとは数えない
 * ——という約束を測るための投影。`aSiteBlueprint` の既定は信頼ページが
 * 揃っているので、`blueprint.pages` は空でない。**それでも
 * `counts.site_documents` は 0 になる**ことが、ここで見たい形である。
 *
 * 以前は各項目を `{} as never` で埋めていた。枠も帯も節点も
 * **項目を 1 つも持たない空オブジェクト**で、件数だけが合っていた。
 * その形だと、数え方が「行の有無」から「行の中身」へ変わった日に
 * この検査は黙って通り続ける。
 */
function projectionWith(
  over: Partial<PublicSiteProjection> = {},
): PublicSiteProjection {
  return aPublicSiteProjection({
    slots: [aLayoutSlot()],
    provisionedSlots: [aLayoutSlot()],
    bands: [aLayoutBand()],
    provisionedBands: [aLayoutBand()],
    network: [aSiteNetworkNode()],
    ...over,
  });
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
          () => aLayoutBand(),
        ),
        provisionedSlots: Array.from(
          { length: SITE_PROVISIONING_REQUIRED_COUNTS.layout_slots },
          () => aLayoutSlot(),
        ),
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
      projectionWith({ articles: [anArticleSummary(), anArticleSummary()] }),
    );

    expect(report.counts.articles).toBe(2);
    expect(report.gaps.map((gap) => gap.element)).not.toContain("articles");
  });

  it("公開サイトに必要な保存値を各 1 回だけ読む", async () => {
    /*
      **数えたい 10 口だけを `vi.fn` で名指しする。**残り 4 口は雛形が埋める。
      以前は 14 口を手で並べ `blueprint: {} as never` で締めていたが、
      その形だと口が 1 つ増えた日にこの検査は「増えた口を読んでいない」まま
      緑になる。雛形経由なら、増えた口は `factories.ts` 1 か所に現れる。
    */
    const reads = {
      listLayoutSlots: vi.fn(async () => ok([])),
      listProvisionedLayoutSlots: vi.fn(async () => ok([])),
      listLayoutBands: vi.fn(async () => ok([])),
      listProvisionedLayoutBands: vi.fn(async () => ok([])),
      listPublished: vi.fn(async () => ok([])),
      listFeaturedArticles: vi.fn(async () => ok({ selectedCount: 0, articles: [] })),
      listNetwork: vi.fn(async () => ok([])),
      listTags: vi.fn(async () => ok([])),
      listDocuments: vi.fn(async () => ok([])),
      listDeliveryParts: vi.fn(async () => ok([])),
    };
    const port = { openSite: vi.fn(async () => ok(aPublicSiteReader(reads))) };

    const result = await readPublicSiteProjection("hub", {
      source: "sample",
      port,
    });

    expect(result.ok).toBe(true);
    expect(port.openSite).toHaveBeenCalledTimes(1);
    expect(port.openSite).toHaveBeenCalledWith("hub");
    for (const read of Object.values(reads)) {
      expect(read).toHaveBeenCalledTimes(1);
    }
    if (result.ok) expect(result.value?.source).toBe("sample");
  });

  it("読み取りが 1 つ失敗したら、他が揃っていても投影を作らず閉じる", async () => {
    // 「一部だけ古い公開面を描かない」は本体のコメントが宣言している約束で、
    // ここで初めて機械が確かめる。番人を 1 つに束ねた後も約束が残ることを固定する。
    /*
      以前この失敗は `{ kind: "storage", message: ... }` だった。**`DomainError`
      ではない**——`code` も `retryable` も無い。読み口ごと `as never` で締めて
      いたので型検査に掛からず、呼び出し側にまで `as never` が伝染していた。
      正本の生成関数を通すと、その 2 つの偽装がどちらも要らなくなる。
    */
    const failure = domainError("UPSTREAM_UNAVAILABLE", "タグが読めません", {
      retryable: true,
    });
    const reader = aPublicSiteReader({ listTags: async () => err(failure) });
    const port = { openSite: vi.fn(async () => ok(reader)) };

    const result = await readPublicSiteProjection("hub", { source: "live", port });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toEqual(failure);
  });

  it("公開identityが無ければ空の投影を作らずnullで閉じる", async () => {
    const port = { openSite: vi.fn(async () => ok(null)) };
    const result = await readPublicSiteProjection("deleted", { source: "live", port });

    expect(result).toEqual({ ok: true, value: null });
    expect(port.openSite).toHaveBeenCalledTimes(1);
  });

  it("公開投影は旧固定ページ一覧へ依存せず、正本文書の可否を各canonical routeへ委ねる", async () => {
    /*
      **この検査は読み口の中身に関心が無い。**見たいのは投影に旧語彙が
      残っていないことだけなので、14 口を並べ直さず雛形を使う。
      「描画用（enabled のみ）とは別に作成完了が読む未削除の実体」も
      雛形が持っているので、ここで数え直さなくてよい。
    */
    const result = await readPublicSiteProjection("hub", {
      source: "sample",
      port: { openSite: async () => ok(aPublicSiteReader()) },
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
