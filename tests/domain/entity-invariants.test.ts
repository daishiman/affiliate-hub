/**
 * @tier 1
 * @req REQ-E02, REQ-E05, REQ-E22, REQ-E24, REQ-E26, REQ-E30
 * @types equivalence, boundary, state-transition, secrets
 */
import { describe, expect, it } from "vitest";
import { createUser, canActAsHuman, isActiveUser } from "@/domain/identity";
import {
  createSite,
  publishSite,
  isSiteVisible,
  siteBasePath,
  createMasterBrief,
  claimsWithinBrief,
  createAsset,
  isAssetUsable,
} from "@/domain/authoring";
import { createCampaign, isCampaignActive, acceptsPublicationAt } from "@/domain/distribution";
import { createExperiment, startExperiment, concludeExperiment } from "@/domain/analytics";
import { createTrackingLink, resolveDestination, trackingPath } from "@/domain/monetization";
import { createAffiliateLink } from "@/domain/monetization";
import { createProvenance } from "@/domain/shared";
import {
  asAffiliateLinkId,
  asAffiliateProgramId,
  asAssetId,
  asAudiencePersonaId,
  asBrandId,
  asCampaignId,
  asClaimId,
  asContentPackageId,
  asExperimentId,
  asMasterBriefId,
  asSiteBlueprintId,
  asSiteId,
  asTrackingLinkId,
  asUserId,
  asWorkspaceId,
} from "@/domain/shared/ids";

/**
 * §21 のエンティティのうち、後から足した 7 つの決めごと。
 *
 * どれも「値の形」ではなく「これを許すと業務が壊れる」ものだけを見ている。
 * 形の検査は型が済ませているので、ここに書いても二重になるだけ。
 */

const WS = asWorkspaceId("ws-1");
const NOW = new Date("2026-08-17T00:00:00Z");

describe("User（E02）: 認証情報をドメインに置かない", () => {
  const base = { id: asUserId("u-1"), displayName: "山田 太郎", email: "Yamada@Example.JP", createdAt: NOW };

  it("作れる。メールは小文字に揃う（宛先の重複を防ぐため）", () => {
    const r = createUser(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.email).toBe("yamada@example.jp");
    expect(r.value.isServiceAccount).toBe(false);
    expect(isActiveUser(r.value, NOW)).toBe(true);
  });

  it("表示名に秘密の値らしき語を入れられない", () => {
    for (const bad of ["api_key: abc", "my password", "SECRET"]) {
      const r = createUser({ ...base, displayName: bad });
      expect(r.ok, bad).toBe(false);
    }
  });

  it("型に認証情報を持つ場所が無い", () => {
    const r = createUser(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const keys = Object.keys(r.value);
    expect(keys.filter((k) => /password|secret|token|credential/i.test(k))).toEqual([]);
  });

  it("AI のアカウントは人として扱わない", () => {
    const r = createUser({ ...base, isServiceAccount: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(canActAsHuman(r.value)).toBe(false);
  });
});

describe("Site（E05）: 広告表記が無いブログは公開できない", () => {
  const base = {
    id: asSiteId("site-1"),
    workspaceId: WS,
    brandId: asBrandId("brand-1"),
    blueprintId: asSiteBlueprintId("bp-1"),
    name: "動画編集ノート",
    slug: "video-edit",
    disclosureText: "本ページには広告が含まれます。",
    createdAt: NOW,
  };

  it("作った直後は読者から見えない", () => {
    const r = createSite(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("draft");
    expect(isSiteVisible(r.value)).toBe(false);
    expect(siteBasePath(r.value)).toBe("/s/video-edit");
  });

  it("広告表記が空だと公開が止まる", () => {
    const site = createSite({ ...base, disclosureText: "   " });
    expect(site.ok).toBe(true);
    if (!site.ok) return;
    const published = publishSite(site.value, NOW);
    expect(published.ok).toBe(false);
    if (published.ok) return;
    expect(published.error.message).toContain("広告表記");
  });

  it("広告表記があれば公開でき、読者から見えるようになる", () => {
    const site = createSite(base);
    expect(site.ok).toBe(true);
    if (!site.ok) return;
    const published = publishSite(site.value, NOW);
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    expect(isSiteVisible(published.value)).toBe(true);
    expect(published.value.publishedAt).toEqual(NOW);
  });

  it("住所に使えない文字は弾く", () => {
    for (const bad of ["Video Edit", "動画", "a--", "-a"]) {
      expect(createSite({ ...base, slug: bad }).ok, bad).toBe(false);
    }
  });

  it("独自ドメインがあればそちらを住所にする", () => {
    const r = createSite({ ...base, customDomain: "video.example.jp" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(siteBasePath(r.value)).toBe("https://video.example.jp");
  });

  /*
   * 状態は 4 つ（準備中・公開中・一時停止・終了）ある。
   * 「準備中 → 公開中」だけを試すと、終了したブログを公開し直せても緑になる。
   * 状態の一覧を実装から取らず手で書き、**公開できる／できない**を全通り並べる。
   */
  describe("公開できる状態・できない状態", () => {
    const site = () => {
      const r = createSite(base);
      if (!r.ok) throw new Error(r.error.message);
      return r.value;
    };

    it.each([
      ["draft", true, "準備中から公開する（通常の順路）"],
      ["live", true, "公開中のまま公開し直す（設定を直したとき）"],
      ["paused", true, "一時停止から再開する"],
      ["archived", false, "終了したブログは公開し直せない"],
    ] as const)("%s → 公開は %s（%s）", (status, allowed, _why) => {
      const r = publishSite({ ...site(), status }, NOW);
      expect(r.ok).toBe(allowed);
    });

    it("終了したブログを断る理由には、次の一手が書いてある", () => {
      const r = publishSite({ ...site(), status: "archived" }, NOW);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.message).toContain("作り直して");
    });

    it("一度公開した日時は、公開し直しても書き換わらない", () => {
      // 「いつから公開しているか」は読者と検索側の両方が見る。
      // 設定を直すたびに新しくなると、古い記事が新着として扱われる。
      const first = new Date("2026-08-01T00:00:00Z");
      const r = publishSite({ ...site(), status: "live", publishedAt: first }, NOW);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.publishedAt).toEqual(first);
    });

    it("読者から見えるのは公開中だけ（残り 3 つは見えない）", () => {
      for (const status of ["draft", "paused", "archived"] as const) {
        expect(isSiteVisible({ ...site(), status }), status).toBe(false);
      }
      expect(isSiteVisible({ ...site(), status: "live" })).toBe(true);
    });
  });
});

describe("TrackingLink（E13）: ASP 発行 URL を書き換えない", () => {
  const affiliateUrl = "https://ac.example.com/click?a=1&b=2";
  const affiliate = createAffiliateLink({
    id: asAffiliateLinkId("al-1"),
    workspaceId: WS,
    programId: asAffiliateProgramId("prog-1"),
    originalUrl: affiliateUrl,
    trackingRef: "ref-1",
    createdAt: NOW,
  });

  const link = createTrackingLink({
    id: asTrackingLinkId("tl-1"),
    workspaceId: WS,
    affiliateLinkId: asAffiliateLinkId("al-1"),
    code: "abc123",
    placement: "記事本文の比較表",
    createdAt: NOW,
  });

  it("転送先は元の URL と 1 文字も違わない", () => {
    expect(affiliate.ok && link.ok).toBe(true);
    if (!affiliate.ok || !link.ok) return;
    const dest = resolveDestination(link.value, affiliate.value, NOW);
    expect(dest.ok).toBe(true);
    if (!dest.ok) return;
    expect(dest.value).toBe(affiliateUrl);
  });

  it("型に URL を保存する場所が無い（加工した URL を持てない）", () => {
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    const keys = Object.keys(link.value);
    expect(keys.filter((k) => /url/i.test(k))).toEqual([]);
    expect(trackingPath(link.value)).toBe("/go/abc123");
  });

  it("提携が切れた先へは転送しない", () => {
    expect(affiliate.ok && link.ok).toBe(true);
    if (!affiliate.ok || !link.ok) return;
    const expired = { ...affiliate.value, expiresAt: new Date("2026-08-01T00:00:00Z") };
    const dest = resolveDestination(link.value, expired, NOW);
    expect(dest.ok).toBe(false);
    if (dest.ok) return;
    expect(dest.error.message).toContain("有効期限");
  });

  it("対応していない組み合わせは断る", () => {
    expect(affiliate.ok && link.ok).toBe(true);
    if (!affiliate.ok || !link.ok) return;
    const other = { ...affiliate.value, id: asAffiliateLinkId("al-999") };
    expect(resolveDestination(link.value, other, NOW).ok).toBe(false);
  });
});

describe("Campaign（E22）: 期間の外に予定を入れない", () => {
  const campaign = createCampaign({
    id: asCampaignId("camp-1"),
    workspaceId: WS,
    brandId: asBrandId("brand-1"),
    name: "秋の買い替え",
    goal: "買い替え検討層の比較記事の到達を確かめる",
    startsAt: new Date("2026-09-01T00:00:00Z"),
    endsAt: new Date("2026-10-01T00:00:00Z"),
    createdAt: NOW,
  });

  it("目的が空だと作れない", () => {
    const r = createCampaign({
      id: asCampaignId("camp-2"),
      workspaceId: WS,
      brandId: asBrandId("brand-1"),
      name: "無題",
      goal: "  ",
      startsAt: new Date("2026-09-01T00:00:00Z"),
      endsAt: new Date("2026-10-01T00:00:00Z"),
      createdAt: NOW,
    });
    expect(r.ok).toBe(false);
  });

  it("期間内の予定は受け入れ、外は理由つきで断る", () => {
    expect(campaign.ok).toBe(true);
    if (!campaign.ok) return;
    expect(acceptsPublicationAt(campaign.value, new Date("2026-09-15T00:00:00Z")).ok).toBe(true);
    const out = acceptsPublicationAt(campaign.value, new Date("2026-10-02T00:00:00Z"));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.message).toContain("期間外");
  });

  it("実施中の判定は期間で決まる", () => {
    expect(campaign.ok).toBe(true);
    if (!campaign.ok) return;
    expect(isCampaignActive(campaign.value, NOW)).toBe(false);
    expect(isCampaignActive(campaign.value, new Date("2026-09-10T00:00:00Z"))).toBe(true);
  });

  /*
   * 期間の端。9/1 00:00 ちょうどから、10/1 00:00 の 1 ミリ秒前まで。
   * 内側だけ（9/15）を試すと、`<=` を `<` に変えても緑のままになる。
   * 日付は実数で書く。キャンペーンの値から作ると、値が動いても同じ側に居続ける。
   */
  it.each([
    ["2026-08-31T23:59:59.999Z", false, "始まる 1 ミリ秒前"],
    ["2026-09-01T00:00:00.000Z", true, "始まる時刻ちょうど"],
    ["2026-09-30T23:59:59.999Z", true, "終わる 1 ミリ秒前"],
    ["2026-10-01T00:00:00.000Z", false, "終わる時刻ちょうど（ここからは外）"],
  ])("%s の予定は受け入れ %s（%s）", (iso, accepted) => {
    expect(campaign.ok).toBe(true);
    if (!campaign.ok) return;
    expect(acceptsPublicationAt(campaign.value, new Date(iso)).ok).toBe(accepted);
    expect(isCampaignActive(campaign.value, new Date(iso))).toBe(accepted);
  });

  it("取りやめたキャンペーンは、期間の内側でも受け付けない", () => {
    expect(campaign.ok).toBe(true);
    if (!campaign.ok) return;
    const cancelled = { ...campaign.value, status: "cancelled" as const };
    const inside = new Date("2026-09-15T00:00:00Z");
    expect(acceptsPublicationAt(cancelled, inside).ok).toBe(false);
    expect(isCampaignActive(cancelled, inside)).toBe(false);
  });

  it("報酬額を書ける場所が無い（順位へ流れる経路を作らない）", () => {
    expect(campaign.ok).toBe(true);
    if (!campaign.ok) return;
    const keys = Object.keys(campaign.value);
    expect(keys.filter((k) => /reward|commission|payout|rate/i.test(k))).toEqual([]);
  });
});

describe("MasterBrief（E24）: 原本に無い主張を原稿に足させない", () => {
  const brief = createMasterBrief({
    id: asMasterBriefId("mb-1"),
    workspaceId: WS,
    packageId: asContentPackageId("pkg-1"),
    audienceId: asAudiencePersonaId("aud-1"),
    promise: "予算 15 万円で動画編集に足りる機種を選べるようになる",
    claimIds: [asClaimId("c-1"), asClaimId("c-2")],
    keyPoints: ["書き出し時間", "画面の色域"],
    createdAt: NOW,
  });

  it("主張がゼロの原本は作れない", () => {
    const r = createMasterBrief({
      id: asMasterBriefId("mb-2"),
      workspaceId: WS,
      packageId: asContentPackageId("pkg-1"),
      audienceId: asAudiencePersonaId("aud-1"),
      promise: "何かが分かる",
      claimIds: [],
      keyPoints: ["論点"],
      createdAt: NOW,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("根拠の確認");
  });

  it("件数の端: 主張 0 件は断り、1 件から通る", () => {
    const make = (n: number) =>
      createMasterBrief({
        id: asMasterBriefId("mb-3"),
        workspaceId: WS,
        packageId: asContentPackageId("pkg-1"),
        audienceId: asAudiencePersonaId("aud-1"),
        promise: "選べるようになる",
        claimIds: Array.from({ length: n }, (_, i) => asClaimId(`c-${i}`)),
        keyPoints: ["論点"],
        createdAt: NOW,
      });
    expect(make(0).ok).toBe(false);
    expect(make(1).ok).toBe(true);
  });

  it("原本の中の主張だけなら通る", () => {
    expect(brief.ok).toBe(true);
    if (!brief.ok) return;
    expect(claimsWithinBrief(brief.value, [asClaimId("c-1")]).ok).toBe(true);
  });

  it("原稿に足された主張は止まる", () => {
    expect(brief.ok).toBe(true);
    if (!brief.ok) return;
    const r = claimsWithinBrief(brief.value, [asClaimId("c-1"), asClaimId("c-9")]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("原本に無い主張");
  });
});

describe("Asset（E26）: 由来と利用条件の無い素材を持たない", () => {
  const provenance = createProvenance({
    sourceType: "manufacturer",
    sourceName: "メーカー公式",
    sourceUrl: "https://example.com/press",
    retrievedAt: NOW,
    confidence: 0.9,
    permittedUsage: "販売店リンク併記時のみ",
  });

  const base = {
    id: asAssetId("as-1"),
    workspaceId: WS,
    kind: "image" as const,
    storageKey: "assets/2026/08/laptop.png",
    altText: "机の上に置かれた 14 インチのノートパソコン",
    createdAt: NOW,
  };

  it("由来つきなら作れる", () => {
    expect(provenance.ok).toBe(true);
    if (!provenance.ok) return;
    const r = createAsset({ ...base, provenance: provenance.value });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isAssetUsable(r.value, NOW)).toBe(true);
  });

  it("代替テキストが空だと作れない", () => {
    expect(provenance.ok).toBe(true);
    if (!provenance.ok) return;
    const r = createAsset({ ...base, altText: "  ", provenance: provenance.value });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("代替テキスト");
  });

  it("利用条件が空だと作れない", () => {
    expect(provenance.ok).toBe(true);
    if (!provenance.ok) return;
    const r = createAsset({
      ...base,
      provenance: { ...provenance.value, permittedUsage: "  " },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("利用条件");
  });

  /*
   * 許諾の期限の端。期限「ちょうど」は切れている側に倒す。
   * 使ってよいか迷う 1 ミリ秒を残すより、使えない側へ寄せるほうが安い。
   */
  it.each([
    [-1, false, "期限が 1 ミリ秒前なら、もう使えない"],
    [0, false, "期限がいまちょうどなら、もう使えない"],
    [1, true, "期限が 1 ミリ秒先なら、まだ使える"],
  ])("期限 = いま %s ミリ秒: 使える = %s（%s）", (deltaMs, usable) => {
    expect(provenance.ok).toBe(true);
    if (!provenance.ok) return;
    const r = createAsset({
      ...base,
      provenance: { ...provenance.value, validUntil: new Date(NOW.getTime() + deltaMs) },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isAssetUsable(r.value, NOW)).toBe(usable);
  });

  it("許諾の期限が切れた素材は使えないと分かる", () => {
    expect(provenance.ok).toBe(true);
    if (!provenance.ok) return;
    const r = createAsset({
      ...base,
      provenance: { ...provenance.value, validUntil: new Date("2026-08-01T00:00:00Z") },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isAssetUsable(r.value, NOW)).toBe(false);
  });
});

describe("Experiment（E30）: 件数が足りないうちは判定させない", () => {
  const made = createExperiment({
    id: asExperimentId("ex-1"),
    workspaceId: WS,
    name: "比較表の位置",
    hypothesis: "比較表を上に置くと、読了率が上がるはず",
    arms: [
      { name: "現行", change: "比較表は本文の中ほど" },
      { name: "上に移動", change: "比較表を導入の直後に置く" },
    ],
    primaryMetric: "read_completion_rate",
    minimumSamples: 500,
  });

  it("案が 1 つだけの実験は作れない", () => {
    const r = createExperiment({
      id: asExperimentId("ex-2"),
      workspaceId: WS,
      name: "片方だけ",
      hypothesis: "たぶん良くなる",
      arms: [{ name: "現行", change: "変えない" }],
      primaryMetric: "page_views",
      minimumSamples: 100,
    });
    expect(r.ok).toBe(false);
  });

  it("数え方の決まっていない指標は主指標にできない", () => {
    const r = createExperiment({
      id: asExperimentId("ex-3"),
      workspaceId: WS,
      name: "謎の指標",
      hypothesis: "上がるはず",
      arms: [
        { name: "A", change: "現行" },
        { name: "B", change: "変更" },
      ],
      primaryMetric: "nonexistent_metric" as never,
      minimumSamples: 100,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("定義されていません");
  });

  it("件数が足りないと判定できない", () => {
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const started = startExperiment(made.value, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const early = concludeExperiment(started.value, {
      samples: 120,
      winningArm: "上に移動",
      at: NOW,
    });
    expect(early.ok).toBe(false);
    if (early.ok) return;
    expect(early.error.message).toContain("120 件 / 必要 500 件");
  });

  it("件数がそろえば判定でき、「差が出なかった」も結果として残せる", () => {
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const started = startExperiment(made.value, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const done = concludeExperiment(started.value, { samples: 700, winningArm: null, at: NOW });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.status).toBe("concluded");
    expect(done.value.winningArm).toBeNull();
  });

  it("実験に無い案を勝ちにできない", () => {
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const started = startExperiment(made.value, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const r = concludeExperiment(started.value, { samples: 700, winningArm: "C", at: NOW });
    expect(r.ok).toBe(false);
  });

  it("開始していない実験は判定できない", () => {
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(concludeExperiment(made.value, { samples: 700, winningArm: null, at: NOW }).ok).toBe(
      false,
    );
  });

  /*
   * 件数の端。必要 500 に対して 499 / 500 / 501。
   * 120 と 700 のように離れた 2 点だけを試すと、`>=` を `>` に変えても
   * 気づけない。必要件数（500）は実数で書く。実験の値から作ると、
   * 500 が 5 に変わっても同じ側に居続ける。
   */
  it.each([
    [499, false, "1 件足りない"],
    [500, true, "ちょうど足りた"],
    [501, true, "足りている"],
  ])("件数 %s: 判定できる = %s（%s）", (samples, canConclude) => {
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const started = startExperiment(made.value, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(concludeExperiment(started.value, { samples, winningArm: null, at: NOW }).ok).toBe(
      canConclude,
    );
  });

  it("必要件数の端: 0 件は作れず、1 件から作れる。整数でないものも断る", () => {
    const make = (minimumSamples: number) =>
      createExperiment({
        id: asExperimentId("ex-4"),
        workspaceId: WS,
        name: "端の確認",
        hypothesis: "端で落ちるはず",
        arms: [
          { name: "A", change: "現行" },
          { name: "B", change: "変更" },
        ],
        primaryMetric: "page_views",
        minimumSamples,
      });
    expect(make(0).ok).toBe(false);
    expect(make(1).ok).toBe(true);
    expect(make(1.5).ok).toBe(false);
    expect(make(-1).ok).toBe(false);
  });

  it("案の数の端: 1 つでは作れず、2 つから作れる", () => {
    const make = (n: number) =>
      createExperiment({
        id: asExperimentId("ex-5"),
        workspaceId: WS,
        name: "案の数",
        hypothesis: "比べるには 2 つ要る",
        arms: Array.from({ length: n }, (_, i) => ({ name: `案${i}`, change: `変更${i}` })),
        primaryMetric: "page_views",
        minimumSamples: 100,
      });
    expect(make(1).ok).toBe(false);
    expect(make(2).ok).toBe(true);
  });

  /*
   * 状態は 準備中 → 実施中 → 判定済 の 3 つ。
   * 正しい順路だけを通すと、判定済からもう一度開始できても緑になる。
   * 2 つの操作 × 3 つの状態を全通り並べる。
   */
  describe("できる操作・できない操作", () => {
    const at = (status: "draft" | "running" | "concluded") => {
      if (!made.ok) throw new Error(made.error.message);
      return { ...made.value, status };
    };

    it.each([
      ["draft", true, "準備中からは開始できる"],
      ["running", false, "実施中の実験をもう一度開始できない"],
      ["concluded", false, "判定済の実験を開始し直せない"],
    ] as const)("開始: %s → %s（%s）", (status, allowed, _why) => {
      expect(startExperiment(at(status), NOW).ok).toBe(allowed);
    });

    it.each([
      ["draft", false, "始めていない実験は判定できない"],
      ["running", true, "実施中なら判定できる"],
      ["concluded", false, "判定済をもう一度判定し直せない"],
    ] as const)("判定: %s → %s（%s）", (status, allowed, _why) => {
      expect(
        concludeExperiment(at(status), { samples: 700, winningArm: null, at: NOW }).ok,
      ).toBe(allowed);
    });
  });
});
