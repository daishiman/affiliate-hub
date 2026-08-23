/** @tier 1 @req REQ-E12, REQ-E13 */
import { describe, expect, it } from "vitest";
import { createD1ArticleOfferReader } from "@/infrastructure/persistence/d1/affiliate-link-repository";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import { createSampleArticleOfferReader } from "@/infrastructure/persistence/sample/affiliate-sample-repository";
import { createDeps } from "@/infrastructure/composition";
import type { AffiliateLinkRow } from "@/db/schema";
import { asWorkspaceId, readDataClass } from "@/domain/shared";
import type { WorkspaceId } from "@/domain/shared";

/**
 * 成果リンクの保存先から、記事に載せる写しを引くところ。
 *
 * ここで見るのは 4 つ。
 *   1. ASP が発行した URL を、保存先から読むときに書き換えていないこと
 *   2. 使えないリンク（停止・期限切れ・https でない）の URL を出さないこと
 *   3. 版が並べた順のまま返すこと
 *   4. 報酬の印が付いていないこと（記事の組み立てへ渡せる形であること）
 *
 * 本物の D1 は動かせないので、問い合わせの組み立てだけを受け取る偽の接続を使う。
 * SQL が正しいかはここでは分からない。**分からないことを分かった形にしない**ため、
 * 実際の疎通は `pnpm run preview` での確認に回している。
 */

const WS = asWorkspaceId("ws_sample") as WorkspaceId;
const AT = new Date("2026-08-20T00:00:00.000Z");

function row(over: Partial<AffiliateLinkRow> = {}): AffiliateLinkRow {
  return {
    id: "lnk_1",
    workspaceId: "ws_sample",
    programId: "prg_amazon_pc",
    productId: "p_alpha_15",
    productName: "Alpha Studio 15",
    brand: "Alpha",
    oneLine: "書き出しが速い。",
    originalUrl: "https://af.example.com/click?a=1&b=2",
    alterationProhibited: true,
    trackingRef: "ref_lnk_1",
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    expiresAt: null,
    disabledAt: null,
    ...over,
  };
}

/** 問い合わせの形だけ受け取って、決めた行を返す偽の接続。 */
function fakeDb(rows: readonly AffiliateLinkRow[]) {
  const chain = {
    from: () => chain,
    where: () => Promise.resolve(rows),
  };
  return { select: () => chain } as unknown as DrizzleD1;
}

describe("成果リンクを記事に載せる写しへ変える（D1）", () => {
  it("ASP が発行した URL を 1 文字も変えずに返す", async () => {
    const original = "https://af.example.com/click?a=1&b=2&utm=x";
    const reader = createD1ArticleOfferReader(fakeDb([row({ originalUrl: original })]));

    const found = await reader.listByIds(WS, ["lnk_1"], AT);
    if (!found.ok) throw new Error("読み出せていません");
    expect(found.value[0].destinationUrl).toBe(original);
    expect(found.value[0].productName).toBe("Alpha Studio 15");
  });

  it("期限切れのリンクは URL を返さず、理由を返す", async () => {
    const expired = row({ expiresAt: new Date("2026-05-31T00:00:00.000Z") });
    const reader = createD1ArticleOfferReader(fakeDb([expired]));

    const found = await reader.listByIds(WS, ["lnk_1"], AT);
    if (!found.ok) throw new Error("読み出せていません");
    expect(found.value[0].destinationUrl).toBeUndefined();
    expect(found.value[0].blockedReason ?? "").not.toBe("");
  });

  it("停止したリンクも URL を返さない", async () => {
    const disabled = row({ disabledAt: new Date("2026-08-01T00:00:00.000Z") });
    const reader = createD1ArticleOfferReader(fakeDb([disabled]));

    const found = await reader.listByIds(WS, ["lnk_1"], AT);
    if (!found.ok) throw new Error("読み出せていません");
    expect(found.value[0].destinationUrl).toBeUndefined();
  });

  it("https でない転送先は、直さずに出さない", async () => {
    // 付け替えて通すと、保存側の不備が読者側で隠れる。
    const insecure = row({ originalUrl: "http://af.example.com/click" });
    const reader = createD1ArticleOfferReader(fakeDb([insecure]));

    const found = await reader.listByIds(WS, ["lnk_1"], AT);
    if (!found.ok) throw new Error("読み出せていません");
    expect(found.value[0].destinationUrl).toBeUndefined();
    expect(found.value[0].blockedReason ?? "").not.toBe("");
  });

  it("版が並べた順のまま返す（保存先の返す順に任せない）", async () => {
    const rows = [row({ id: "lnk_1" }), row({ id: "lnk_2", productId: "p_delta_13" })];
    const reader = createD1ArticleOfferReader(fakeDb(rows));

    const found = await reader.listByIds(WS, ["lnk_2", "lnk_1"], AT);
    if (!found.ok) throw new Error("読み出せていません");
    expect(found.value.map((o) => o.affiliateLinkId)).toEqual(["lnk_2", "lnk_1"]);
  });

  it("知らない ID は返さない（名前の無いカードを読者に出さない）", async () => {
    const reader = createD1ArticleOfferReader(fakeDb([row()]));

    const found = await reader.listByIds(WS, ["lnk_1", "lnk_missing"], AT);
    if (!found.ok) throw new Error("読み出せていません");
    expect(found.value.map((o) => o.affiliateLinkId)).toEqual(["lnk_1"]);
  });

  it("1 件も指定されなければ、保存先を引かない", async () => {
    const exploding = {
      select: () => {
        throw new Error("引いてはいけません");
      },
    } as unknown as DrizzleD1;
    const found = await createD1ArticleOfferReader(exploding).listByIds(WS, [], AT);
    expect(found.ok).toBe(true);
  });
});

describe("記事に載せる写しには報酬が付かない", () => {
  it("引く口には Editorial の印が付いている", () => {
    // 商業の印が付いていると、記事の組み立て（Editorial）へ渡せない。
    expect(readDataClass(createSampleArticleOfferReader())).toBe("editorial");
    expect(readDataClass(createDeps().articleOffers)).toBe("editorial");
  });

  it("返る写しに報酬らしき欄が 1 つも無い", async () => {
    const reader = createD1ArticleOfferReader(fakeDb([row()]));
    const found = await reader.listByIds(WS, ["lnk_1"], AT);
    if (!found.ok) throw new Error("読み出せていません");
    const keys = Object.keys(found.value[0]).join(",");
    expect(keys).not.toMatch(/reward|price|commission|amount/i);
  });
});

describe("見本の成果リンク", () => {
  it("見本からでも、記事に載せられる写しが出る", async () => {
    const deps = createDeps();
    const found = await deps.articleOffers.listByIds(
      asWorkspaceId("ws_sample") as WorkspaceId,
      ["lnk_amazon_pc"],
      AT,
    );
    if (!found.ok) throw new Error("読み出せていません");
    expect(found.value).toHaveLength(1);
    expect(found.value[0].productName).not.toBe("");
    expect(found.value[0].destinationUrl).toMatch(/^https:\/\//);
  });

  it("見本にも期限切れが混ざっている（理由が出ることを見本のまま確かめられる）", async () => {
    const found = await createSampleArticleOfferReader().listByIds(
      asWorkspaceId("ws_sample") as WorkspaceId,
      ["lnk_direct_soft"],
      AT,
    );
    if (!found.ok) throw new Error("読み出せていません");
    expect(found.value[0].destinationUrl).toBeUndefined();
    expect(found.value[0].blockedReason ?? "").not.toBe("");
  });
});
