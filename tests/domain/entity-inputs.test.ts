/**
 * @tier 1
 * @req REQ-E01, REQ-E03, REQ-E04, REQ-E06, REQ-E07, REQ-E08, REQ-E12, REQ-E14, REQ-E17, REQ-E18, REQ-E19, REQ-E20, REQ-E21, REQ-E25, REQ-E27, REQ-E28, REQ-E29
 * @types equivalence, boundary
 *
 * 印を 1 行に収めてあるのは、`scripts/required-test-types.mjs` の `@req` の
 * 読み取りが `*` で止まるためで、折り返すと 2 行目の要件が黙って落ちる。
 */
import { describe, expect, it } from "vitest";
import { validateSample } from "@/domain/analytics";
import {
  approveVariant,
  createAudiencePersona,
  createAuthorPersona,
  createContentVariant,
  createSiteBlueprint,
} from "@/domain/authoring";
import { advance, createPublication, MAX_SEND_ATTEMPTS } from "@/domain/distribution";
import { createClaim, createEvidence, createTestRun, MAX_EXCERPT_LENGTH } from "@/domain/evidence";
import { createBrand, createMembership, createWorkspace, checkCapacity } from "@/domain/identity";
import { createAffiliateLink, createConversion } from "@/domain/monetization";
import {
  createComparisonSet,
  createIdentityKey,
  createMerchantOffer,
  MAX_COMPARISON_CANDIDATES,
  scoreComparison,
} from "@/domain/product";
import { createProvenance } from "@/domain/shared";
import {
  asAffiliateLinkId,
  asAffiliateProgramId,
  asAudiencePersonaId,
  asAuthorPersonaId,
  asBrandId,
  asComparisonSetId,
  asContentPackageId,
  asContentVariantId,
  asEvidenceId,
  asMerchantId,
  asMerchantOfferId,
  asProductId,
  asPublicationId,
  asSiteBlueprintId,
  asTestRunId,
  asUserId,
  asWorkspaceId,
  asChannelConnectionId,
  asClaimId,
} from "@/domain/shared/ids";
import { taggedString } from "@/domain/shared/tagged";

/**
 * 17 のエンティティ（E01 / E03 / E04 / E06 / E07 / E08 / E12 / E14 / E17 / E18 /
 * E19 / E20 / E21 / E25 / E27 / E28 / E29）の**断る側と、その端**を見る。
 *
 * このファイルを書いた理由。2026-08-19 に、E 群 18 ファイルの断り 76 か所を
 * 1 か所ずつ `if (false)` に変えて全部走らせた。**11 か所は 3960 件すべてが
 * 緑のままだった**（成果リンクの URL 空、主張の文が空、確認者が空、
 * 本文が空、点数 3 つの範囲、プロンプト版が空、人の承認なしでの承認、
 * ルール名が空、検出表現が空、分野の語彙、出力先の語彙）。
 * つまりその 11 か所は、消しても誰も気づかない状態だった。
 *
 * 残り 65 か所は赤くなった。**ただし赤くなったものの多くは、断ることだけを
 * 見ていて端を見ていない。** 0.0〜1.0 の範囲は「2.0 で断る」だけを当てると、
 * 上限を 1 から 10 に書き換えても緑のままになる。だからこのファイルは
 * 「断るか」ではなく「**どこから断るか**」を当てる。
 *
 * 端の取り方は 3 通りある。数の端（0 / 1 / 上限 / 上限+1）、
 * 長さの端（400 / 401、0 件 / 1 件）、時刻の端（同時刻 / 1 ミリ秒前後）。
 * 空文字の検査には `trim()` の端がある（半角空白・全角空白・1 文字）。
 */

const WS = asWorkspaceId("ws-1");
const NOW = new Date("2026-08-19T00:00:00Z");
const MS = 1;

/** 空とみなされる側の 3 通り。`trim()` は全角空白 (U+3000) も落とす。 */
const BLANKS = ["", " ", "　"] as const;

describe("Workspace（E01）: プランの上限は、達した回で断る", () => {
  const ws = () => {
    const r = createWorkspace({
      id: WS,
      name: "動画編集の道具",
      plan: "solo",
      ownerUserId: asUserId("u-1"),
      createdAt: NOW,
    });
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  };

  it("名前が空なら作れない（半角空白・全角空白も空）", () => {
    for (const blank of BLANKS) {
      const r = createWorkspace({
        id: WS,
        name: blank,
        plan: "solo",
        ownerUserId: asUserId("u-1"),
        createdAt: NOW,
      });
      expect(r.ok).toBe(false);
    }
    const one = createWorkspace({
      id: WS,
      name: "あ",
      plan: "solo",
      ownerUserId: asUserId("u-1"),
      createdAt: NOW,
    });
    expect(one.ok).toBe(true);
  });

  /*
   * 上限の端。solo のブランドは 1 なので、いま 0 件なら作れて 1 件なら作れない。
   * 「2 件目で断る」だけを当てると、上限を 1 から 10 に変えても緑のままになる。
   */
  it("上限の 1 つ手前までは作れて、上限に達した回から断る", () => {
    const w = ws();
    expect(checkCapacity(w, "brand", 0).ok).toBe(true);
    expect(checkCapacity(w, "brand", 1).ok).toBe(false);
    expect(checkCapacity(w, "site", 2).ok).toBe(true);
    expect(checkCapacity(w, "site", 3).ok).toBe(false);
    expect(checkCapacity(w, "generation", 199).ok).toBe(true);
    expect(checkCapacity(w, "generation", 200).ok).toBe(false);
  });
});

describe("Membership（E03）: 役割の数の端", () => {
  const base = {
    id: taggedString<"MembershipId">("mb-1"),
    workspaceId: WS,
    userId: asUserId("u-1"),
    invitedEmail: "editor@example.com",
    displayName: "編集担当",
    invitedAt: NOW,
  };

  it("役割が 0 件なら作れず、1 件なら作れる", () => {
    expect(createMembership({ ...base, roles: [] }).ok).toBe(false);
    expect(createMembership({ ...base, roles: ["writer"] }).ok).toBe(true);
  });

  it("owner と AI アカウントだけは、1 件を超えた時点で断る", () => {
    expect(createMembership({ ...base, roles: ["owner"] }).ok).toBe(true);
    expect(createMembership({ ...base, roles: ["owner", "writer"] }).ok).toBe(false);
    expect(createMembership({ ...base, roles: ["ai_service_account"] }).ok).toBe(true);
    expect(createMembership({ ...base, roles: ["ai_service_account", "writer"] }).ok).toBe(false);
    // 人の役割どうしは何件並べてもよい。ここを一緒に断ると担当が分けられない。
    expect(createMembership({ ...base, roles: ["writer", "reviewer", "analyst"] }).ok).toBe(true);
  });

  it("表示名が空なら作れない", () => {
    for (const blank of BLANKS) {
      expect(createMembership({ ...base, roles: ["writer"], displayName: blank }).ok).toBe(false);
    }
  });
});

describe("Brand（E04）: 表示名と立場の空判定", () => {
  const base = {
    id: asBrandId("br-1"),
    workspaceId: WS,
    displayName: "動画編集の道具",
    positioning: "作業時間を削ることだけを基準に選ぶ",
    createdAt: NOW,
  };

  it("表示名が空なら作れない（半角空白・全角空白も空）", () => {
    for (const blank of BLANKS) {
      expect(createBrand({ ...base, displayName: blank }).ok).toBe(false);
    }
    expect(createBrand({ ...base, displayName: "あ" }).ok).toBe(true);
  });

  it("立場が空なら作れない", () => {
    for (const blank of BLANKS) {
      expect(createBrand({ ...base, positioning: blank }).ok).toBe(false);
    }
  });
});

const AXES = {
  targetReader: "動画編集を仕事にしている人",
  searchIntent: "買い替えの比較",
  articlePurpose: "1 台に絞る",
  evaluationAxis: "書き出し時間",
  usageScene: "納品前の深夜",
  uniqueExperience: "同じ素材で計測した",
  comparisonScope: "国内で買えるもの",
  conclusionStance: "1 台を名指しする",
  internalLinkStrategy: "用途別から入る",
  ctaStrategy: "価格の確認へ送る",
};

describe("SiteBlueprint（E06）: カテゴリーの件数と URL 名の端", () => {
  const category = {
    slug: "laptops",
    name: "ノートパソコン",
    oneLine: "持ち運びながら書き出す人向け",
    initialArticleTypes: ["comparison"] as const,
  };
  const base = {
    id: asSiteBlueprintId("sb-1"),
    workspaceId: WS,
    name: "動画編集の道具",
    pattern: "specialist_review" as const,
    purpose: "道具選びで時間を失わないようにする",
    genre: "動画編集向け機材",
    revenueModel: "affiliate" as const,
    differentiation: AXES,
  };

  it("カテゴリーが 0 件なら作れず、1 件なら作れる", () => {
    expect(createSiteBlueprint({ ...base, categories: [] }).ok).toBe(false);
    expect(createSiteBlueprint({ ...base, categories: [category] }).ok).toBe(true);
  });

  /*
   * URL 用の名前は「半角英小文字・数字・ハイフン」だけ。
   * 通る側と落ちる側を隣り合わせで当てる。片側だけだと、
   * 正規表現を緩めた日にも厳しくした日にも気づけない。
   */
  it("URL 用の名前は、半角英小文字・数字・ハイフンの外に出た時点で断る", () => {
    for (const slug of ["laptops", "laptops-2026", "a", "0"]) {
      expect(createSiteBlueprint({ ...base, categories: [{ ...category, slug }] }).ok).toBe(true);
    }
    for (const slug of ["Laptops", "laptops_2026", "ノートパソコン", "laptops 2026", ""]) {
      expect(createSiteBlueprint({ ...base, categories: [{ ...category, slug }] }).ok).toBe(false);
    }
  });

  it("同じ URL 用の名前が 2 件並んだら断る", () => {
    const two = createSiteBlueprint({
      ...base,
      categories: [category, { ...category, name: "別のカテゴリー" }],
    });
    expect(two.ok).toBe(false);
  });

  it("差別化の軸が 1 つでも空なら断る", () => {
    for (const blank of BLANKS) {
      const r = createSiteBlueprint({
        ...base,
        categories: [category],
        differentiation: { ...AXES, evaluationAxis: blank },
      });
      expect(r.ok).toBe(false);
    }
  });

  it("カテゴリーの 1 文説明が空なら断る", () => {
    const r = createSiteBlueprint({ ...base, categories: [{ ...category, oneLine: " " }] });
    expect(r.ok).toBe(false);
  });
});

describe("AuthorPersona（E07）: 文体の 0.0〜1.0 の端", () => {
  const tone = {
    formality: 0.5,
    analytical: 0.5,
    emotional: 0.3,
    assertiveness: 0.6,
    humor: 0.1,
    emojiUsage: 0,
  };
  const base = {
    id: asAuthorPersonaId("ap-1"),
    workspaceId: WS,
    displayName: "編集部",
    personaType: "editorial_team" as const,
    role: "編集",
    knowledgeLevel: "expert" as const,
    firstPersonPronoun: "私たち",
    readerAddress: "あなた",
    tone,
    disclosureStyle: "冒頭に出す",
    ctaStyle: "価格の確認へ送る",
  };

  it("文体の値は 0.0 と 1.0 まで通り、その外へ出た時点で断る", () => {
    expect(createAuthorPersona({ ...base, tone: { ...tone, humor: 0 } }).ok).toBe(true);
    expect(createAuthorPersona({ ...base, tone: { ...tone, humor: 1 } }).ok).toBe(true);
    expect(createAuthorPersona({ ...base, tone: { ...tone, humor: -0.01 } }).ok).toBe(false);
    expect(createAuthorPersona({ ...base, tone: { ...tone, humor: 1.01 } }).ok).toBe(false);
  });

  it("架空の人格には、資格も経験年数も持たせられない", () => {
    const character = { ...base, personaType: "brand_character" as const };
    expect(createAuthorPersona(character).ok).toBe(true);
    expect(createAuthorPersona({ ...character, verifiedCredentials: ["一級建築士"] }).ok).toBe(false);
    expect(createAuthorPersona({ ...character, experienceYears: 10 }).ok).toBe(false);
    // 実在の書き手なら、同じ値を持ってよい。禁じているのは架空の側だけ。
    expect(
      createAuthorPersona({
        ...base,
        personaType: "real_person",
        verifiedCredentials: ["一級建築士"],
        experienceYears: 10,
      }).ok,
    ).toBe(true);
  });

  it("表示名が空なら作れない", () => {
    for (const blank of BLANKS) {
      expect(createAuthorPersona({ ...base, displayName: blank }).ok).toBe(false);
    }
  });
});

describe("AudiencePersona（E08）: 判断条件の件数の端", () => {
  const base = {
    id: asAudiencePersonaId("ad-1"),
    workspaceId: WS,
    name: "納品前の編集者",
    primaryJob: "書き出し時間を縮めたい",
    desiredOutcome: "納品に間に合う",
    knowledgeLevel: "intermediate" as const,
    awarenessStage: "solution_aware" as const,
    desiredEmotionalState: "迷いが消える",
    nextAction: "価格を確認する",
  };

  it("判断条件が 0 件なら作れず、1 件なら作れる", () => {
    expect(createAudiencePersona({ ...base, decisionCriteria: [] }).ok).toBe(false);
    expect(createAudiencePersona({ ...base, decisionCriteria: ["書き出し時間"] }).ok).toBe(true);
  });

  it("名前・用事・読後の行動のどれかが空なら断る", () => {
    const criteria = ["書き出し時間"];
    for (const blank of BLANKS) {
      expect(createAudiencePersona({ ...base, decisionCriteria: criteria, name: blank }).ok).toBe(false);
      expect(
        createAudiencePersona({ ...base, decisionCriteria: criteria, primaryJob: blank }).ok,
      ).toBe(false);
      expect(
        createAudiencePersona({ ...base, decisionCriteria: criteria, nextAction: blank }).ok,
      ).toBe(false);
    }
  });
});

describe("AffiliateLink（E12）: URL の形", () => {
  const base = {
    id: asAffiliateLinkId("al-1"),
    workspaceId: WS,
    programId: asAffiliateProgramId("pg-1"),
    originalUrl: "https://example.com/item/1",
    trackingRef: "tr-1",
    createdAt: NOW,
  };

  /*
   * この 1 件は、消しても誰も気づかなかった側である（2026-08-19 の実測）。
   * 空の URL は `startsWith("https://")` でも落ちるので、上の 1 行を消しても
   * 断り自体は残る。**残るのは断りであって、理由ではない。**
   * 空欄のまま出したのか、http で書いたのかで、次にすることが違う。
   */
  it("URL が空なら、URL が要る旨で断る（scheme 違いとは別の理由）", () => {
    for (const blank of BLANKS) {
      const r = createAffiliateLink({ ...base, originalUrl: blank });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.message).toContain("URL が必要");
    }
    const http = createAffiliateLink({ ...base, originalUrl: "http://example.com/item/1" });
    expect(http.ok).toBe(false);
    if (http.ok) return;
    expect(http.error.message).toContain("https");
  });

  it("https で始まるものだけ通る", () => {
    expect(createAffiliateLink(base).ok).toBe(true);
    for (const url of ["ftp://example.com", "//example.com", "https:/example.com"]) {
      expect(createAffiliateLink({ ...base, originalUrl: url }).ok).toBe(false);
    }
  });

  it("計測用の識別子が空なら断る", () => {
    for (const blank of BLANKS) {
      expect(createAffiliateLink({ ...base, trackingRef: blank }).ok).toBe(false);
    }
  });
});

describe("SourceArtifact（E14）: 信頼度と有効期限の端", () => {
  const base = {
    sourceType: "manufacturer" as const,
    sourceName: "メーカー公式",
    retrievedAt: NOW,
    confidence: 0.8,
    permittedUsage: "出典を併記すれば引用可",
  };

  it("信頼度は 0.0 と 1.0 まで通り、その外へ出た時点で断る", () => {
    expect(createProvenance({ ...base, confidence: 0 }).ok).toBe(true);
    expect(createProvenance({ ...base, confidence: 1 }).ok).toBe(true);
    expect(createProvenance({ ...base, confidence: -0.01 }).ok).toBe(false);
    expect(createProvenance({ ...base, confidence: 1.01 }).ok).toBe(false);
  });

  /*
   * 「同時刻」は落ちる側である。`<=` を `<` に書き換えても、
   * 1 ミリ秒前だけを当てていると緑のままになる。同時刻を必ず含める。
   */
  it("有効期限は取得時刻と同時刻なら断り、1 ミリ秒後なら通る", () => {
    expect(createProvenance({ ...base, validUntil: NOW }).ok).toBe(false);
    expect(createProvenance({ ...base, validUntil: new Date(NOW.getTime() - MS) }).ok).toBe(false);
    expect(createProvenance({ ...base, validUntil: new Date(NOW.getTime() + MS) }).ok).toBe(true);
    expect(createProvenance({ ...base, validUntil: null }).ok).toBe(true);
  });

  it("情報源の名前が空なら断る", () => {
    for (const blank of BLANKS) {
      expect(createProvenance({ ...base, sourceName: blank }).ok).toBe(false);
    }
  });
});

const PROVENANCE = (() => {
  const r = createProvenance({
    sourceType: "merchant",
    sourceName: "販売店",
    retrievedAt: NOW,
    confidence: 0.7,
    permittedUsage: "価格のみ",
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
})();

describe("MerchantOffer（E17）: 有効期限の端", () => {
  const base = {
    id: asMerchantOfferId("mo-1"),
    workspaceId: WS,
    productId: asProductId("pd-1"),
    merchantId: asMerchantId("mc-1"),
    merchantName: "販売店A",
    checkedAt: NOW,
    provenance: PROVENANCE,
  };

  it("有効期限は確認時刻と同時刻なら断り、1 ミリ秒後なら通る", () => {
    expect(createMerchantOffer({ ...base, expiresAt: NOW }).ok).toBe(false);
    expect(createMerchantOffer({ ...base, expiresAt: new Date(NOW.getTime() - MS) }).ok).toBe(false);
    expect(createMerchantOffer({ ...base, expiresAt: new Date(NOW.getTime() + MS) }).ok).toBe(true);
  });

  it("販売店名が空なら断る", () => {
    for (const blank of BLANKS) {
      expect(createMerchantOffer({ ...base, merchantName: blank }).ok).toBe(false);
    }
  });
});

describe("ComparisonSet（E18）: 比較候補の件数の端", () => {
  const signals = {
    identity: 0.2,
    category: 0.9,
    useCase: 0.8,
    priceBand: 0.5,
    keySpecs: 0.6,
    audience: 0.7,
    recency: 0.5,
  };
  const candidate = (n: number) => ({
    productId: asProductId(`pd-${n}`),
    relation: "direct_competitor" as const,
    score: 0.5,
    signals,
    reason: "同じ用途で価格帯が近い",
    commonPoints: ["書き出しに使える"],
    decisiveDifferences: ["書き出し時間"],
    informationConfidence: 0.8,
    missingInformation: [],
    lastVerifiedBy: null,
  });
  const base = {
    id: asComparisonSetId("cs-1"),
    workspaceId: WS,
    primaryProductId: asProductId("pd-0"),
    createdAt: NOW,
    scopeDescription: "国内で買えるノートパソコン",
  };

  it("上限ちょうどまで通り、1 件超えた時点で断る", () => {
    const eight = Array.from({ length: MAX_COMPARISON_CANDIDATES }, (_, i) => candidate(i + 1));
    expect(createComparisonSet({ ...base, candidates: eight }).ok).toBe(true);
    const nine = [...eight, candidate(MAX_COMPARISON_CANDIDATES + 1)];
    expect(createComparisonSet({ ...base, candidates: nine }).ok).toBe(false);
  });

  it("比較候補に主商品そのものが混ざっていたら断る", () => {
    const r = createComparisonSet({
      ...base,
      candidates: [{ ...candidate(1), productId: asProductId("pd-0") }],
    });
    expect(r.ok).toBe(false);
  });

  it("比較の要素は 0.0 と 1.0 まで通り、その外へ出た時点で断る", () => {
    expect(scoreComparison({ ...signals, identity: 0 }).ok).toBe(true);
    expect(scoreComparison({ ...signals, identity: 1 }).ok).toBe(true);
    expect(scoreComparison({ ...signals, identity: -0.01 }).ok).toBe(false);
    expect(scoreComparison({ ...signals, identity: 1.01 }).ok).toBe(false);
  });

  it("比較対象の範囲説明が空なら断る", () => {
    for (const blank of BLANKS) {
      expect(createComparisonSet({ ...base, candidates: [], scopeDescription: blank }).ok).toBe(false);
    }
  });
});

describe("Claim（E19）: 確信度と有効期間の端、根拠の要否", () => {
  const base = {
    id: asClaimId("cl-1"),
    workspaceId: WS,
    statement: "書き出しが 3 割速い",
    type: "inference" as const,
    evidenceIds: [],
    confidence: 0.8,
    validFrom: NOW,
  };

  /* この 1 件は、消しても誰も気づかなかった側である（2026-08-19 の実測）。 */
  it("主張の文が空なら作れない", () => {
    for (const blank of BLANKS) {
      expect(createClaim({ ...base, statement: blank }).ok).toBe(false);
    }
    expect(createClaim({ ...base, statement: "あ" }).ok).toBe(true);
  });

  it("確信度は 0.0 と 1.0 まで通り、その外へ出た時点で断る", () => {
    expect(createClaim({ ...base, confidence: 0 }).ok).toBe(true);
    expect(createClaim({ ...base, confidence: 1 }).ok).toBe(true);
    expect(createClaim({ ...base, confidence: -0.01 }).ok).toBe(false);
    expect(createClaim({ ...base, confidence: 1.01 }).ok).toBe(false);
  });

  /*
   * 根拠を要求する種別は 4 つ（公式・測定・体験・外部）。要求しない側
   * （推論）も一緒に当てる。片側だけだと、一覧を増やしても減らしても緑になる。
   */
  it("根拠が要る種別は 0 件で断り、要らない種別は 0 件でも通る", () => {
    for (const type of ["official", "measured", "experience", "external"] as const) {
      expect(createClaim({ ...base, type, evidenceIds: [] }).ok).toBe(false);
      expect(createClaim({ ...base, type, evidenceIds: [asEvidenceId("ev-1")] }).ok).toBe(true);
    }
    for (const type of ["inference", "commercial"] as const) {
      expect(createClaim({ ...base, type, evidenceIds: [] }).ok).toBe(true);
    }
  });

  it("有効期限は開始と同時刻なら断り、1 ミリ秒後なら通る", () => {
    expect(createClaim({ ...base, validUntil: NOW }).ok).toBe(false);
    expect(createClaim({ ...base, validUntil: new Date(NOW.getTime() + MS) }).ok).toBe(true);
  });
});

describe("Evidence（E20）: 抜粋の長さの端", () => {
  const base = {
    id: asEvidenceId("ev-1"),
    workspaceId: WS,
    type: "official_source" as const,
    title: "メーカー公表値",
    sourceOwner: "メーカー",
    capturedAt: NOW,
    urlOrAssetId: "https://example.com/spec",
    excerptOrSummary: "書き出し時間 12 分",
    licenseOrPermission: "出典併記で引用可",
    integrityHash: "sha256:0",
  };

  /*
   * 400 文字は通り、401 文字で断る。上限ちょうどを外すと、
   * `>` を `>=` に書き換えた日に気づけない。
   */
  it("抜粋は上限ちょうどまで通り、1 文字超えた時点で断る", () => {
    const at = "あ".repeat(MAX_EXCERPT_LENGTH);
    const over = "あ".repeat(MAX_EXCERPT_LENGTH + 1);
    expect(createEvidence({ ...base, excerptOrSummary: at }).ok).toBe(true);
    expect(createEvidence({ ...base, excerptOrSummary: over }).ok).toBe(false);
  });

  it("題名・出所・利用条件のどれかが空なら断る", () => {
    for (const blank of BLANKS) {
      expect(createEvidence({ ...base, title: blank }).ok).toBe(false);
      expect(createEvidence({ ...base, sourceOwner: blank }).ok).toBe(false);
      expect(createEvidence({ ...base, licenseOrPermission: blank }).ok).toBe(false);
    }
  });
});

describe("TestRun（E21）: 検証者の件数・点数・時刻の端", () => {
  const base = {
    id: asTestRunId("tr-1"),
    workspaceId: WS,
    productId: asProductId("pd-1"),
    methodVersion: "v1",
    environment: { os: "macOS" },
    equipment: ["同一素材"],
    testerIds: ["u-1"],
    startedAt: NOW,
    rawResults: { seconds: 720 },
    normalizedScores: { speed: 0.8 },
    evidenceIds: [],
  };

  it("検証者が 0 人なら作れず、1 人なら作れる", () => {
    expect(createTestRun({ ...base, testerIds: [] }).ok).toBe(false);
    expect(createTestRun({ ...base, testerIds: ["u-1"] }).ok).toBe(true);
  });

  it("正規化点数は 0.0 と 1.0 まで通り、その外へ出た時点で断る", () => {
    expect(createTestRun({ ...base, normalizedScores: { speed: 0 } }).ok).toBe(true);
    expect(createTestRun({ ...base, normalizedScores: { speed: 1 } }).ok).toBe(true);
    expect(createTestRun({ ...base, normalizedScores: { speed: -0.01 } }).ok).toBe(false);
    expect(createTestRun({ ...base, normalizedScores: { speed: 1.01 } }).ok).toBe(false);
  });

  /* 完了は開始と同時刻でも通る（`<` であって `<=` ではない）。 */
  it("完了時刻は開始と同時刻なら通り、1 ミリ秒前で断る", () => {
    expect(createTestRun({ ...base, completedAt: NOW }).ok).toBe(true);
    expect(createTestRun({ ...base, completedAt: new Date(NOW.getTime() - MS) }).ok).toBe(false);
    expect(createTestRun({ ...base, completedAt: new Date(NOW.getTime() + MS) }).ok).toBe(true);
  });

  it("測定方法のバージョンが空なら断る", () => {
    for (const blank of BLANKS) {
      expect(createTestRun({ ...base, methodVersion: blank }).ok).toBe(false);
    }
  });
});

const VARIANT_BASE = {
  id: asContentVariantId("cv-1"),
  workspaceId: WS,
  contentPackageId: asContentPackageId("cp-1"),
  channel: "own_site",
  format: "article",
  authorPersonaId: asAuthorPersonaId("ap-1"),
  audiencePersonaId: asAudiencePersonaId("ad-1"),
  angle: "data_first" as const,
  body: "本文",
  summary: "要約",
  cta: "read_detail" as const,
  disclosure: "広告を含みます",
  factualityScore: 0.9,
  personaFitScore: 0.8,
  channelFitScore: 0.8,
  complianceStatus: "pass" as const,
  generationPromptVersion: "v1",
  modelId: "m-1",
};

describe("ContentVariant（E25）: 3 つの点数の端と、空の欄", () => {
  /* 以下 3 件は、いずれも消しても誰も気づかなかった側である（2026-08-19 の実測）。 */
  it("本文が空なら作れない", () => {
    for (const blank of BLANKS) {
      expect(createContentVariant({ ...VARIANT_BASE, body: blank }).ok).toBe(false);
    }
    expect(createContentVariant({ ...VARIANT_BASE, body: "あ" }).ok).toBe(true);
  });

  /*
   * 点数は 3 つある。1 つだけ当てると、残り 2 つを消しても緑になる。
   * 3 つ × 端 4 通り（0 / 1 / -0.01 / 1.01）を全部当てる。
   */
  it("3 つの点数はそれぞれ 0.0 と 1.0 まで通り、その外へ出た時点で断る", () => {
    for (const key of ["factualityScore", "personaFitScore", "channelFitScore"] as const) {
      expect(createContentVariant({ ...VARIANT_BASE, [key]: 0 }).ok).toBe(true);
      expect(createContentVariant({ ...VARIANT_BASE, [key]: 1 }).ok).toBe(true);
      const low = createContentVariant({ ...VARIANT_BASE, [key]: -0.01 });
      expect(low.ok).toBe(false);
      if (!low.ok) expect(low.error.message).toContain(key);
      const high = createContentVariant({ ...VARIANT_BASE, [key]: 1.01 });
      expect(high.ok).toBe(false);
      if (!high.ok) expect(high.error.message).toContain(key);
    }
  });

  it("プロンプトのバージョンが空なら作れない", () => {
    for (const blank of BLANKS) {
      expect(createContentVariant({ ...VARIANT_BASE, generationPromptVersion: blank }).ok).toBe(false);
    }
  });
});

describe("Publication（E27）: 再送回数の端", () => {
  const gate = { ok: true, failures: [], skipped: [] };
  const base = {
    id: asPublicationId("pb-1"),
    workspaceId: WS,
    variantId: asContentVariantId("cv-1"),
    variantRevision: 1,
    channelKind: "x" as const,
    connectionId: asChannelConnectionId("ch-1"),
    idempotencyKey: "pb-1:key",
  };
  const queued = () => {
    const r = createPublication(base);
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  };
  const step = (
    p: ReturnType<typeof queued>,
    to: Parameters<typeof advance>[1],
    withGate = false,
  ) => {
    const r = advance(p, to, withGate ? { gate, at: NOW } : { at: NOW });
    if (!r.ok) throw new Error(`${to}: ${r.error.message}`);
    return r.value;
  };

  it("冪等キーが空なら作れない", () => {
    for (const blank of BLANKS) {
      expect(createPublication({ ...base, idempotencyKey: blank }).ok).toBe(false);
    }
  });

  it("自動投稿できる媒体は、接続の設定が無いと作れない", () => {
    expect(createPublication({ ...base, connectionId: null }).ok).toBe(false);
    // 自動投稿の仕組みが無い媒体は、接続なしでよい。
    expect(createPublication({ ...base, channelKind: "note", connectionId: null }).ok).toBe(true);
  });

  /*
   * 上限ちょうどの回まで送れて、その次から断る。
   * 「6 回目で断る」だけを当てると、上限を 5 から 50 に変えても緑になる。
   */
  it("送信は上限ちょうどの回まで通り、次の回から断る", () => {
    let p = step(step(queued(), "RENDERING"), "VALIDATING");
    for (let i = 1; i <= MAX_SEND_ATTEMPTS; i += 1) {
      p = step(p, "SENDING", true);
      expect(p.attempts).toBe(i);
      if (i < MAX_SEND_ATTEMPTS) p = step(step(p, "FAILED_SEND"), "RETRY_SCHEDULED");
    }
    p = step(step(p, "FAILED_SEND"), "RETRY_SCHEDULED");
    const over = advance(p, "SENDING", { gate, at: NOW });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.message).toContain(String(MAX_SEND_ATTEMPTS));
  });
});

describe("Metric（E28）: 割合の端と、集計期間の端", () => {
  const from = NOW;
  const to = new Date(NOW.getTime() + 86400000);

  it("集計期間の終わりは始まりと同時刻なら断り、1 ミリ秒後なら通る", () => {
    expect(validateSample({ key: "correction_count", value: 3, from, to: from, denominator: null }).ok).toBe(false);
    expect(
      validateSample({
        key: "correction_count",
        value: 3,
        from,
        to: new Date(from.getTime() + MS),
        denominator: null,
      }).ok,
    ).toBe(true);
  });

  it("割合の指標は 0 と 1 まで通り、その外へ出た時点で断る", () => {
    const s = (value: number) =>
      validateSample({ key: "stale_price_ratio", value, from, to, denominator: 100 });
    expect(s(0).ok).toBe(true);
    expect(s(1).ok).toBe(true);
    expect(s(-0.01).ok).toBe(false);
    expect(s(1.01).ok).toBe(false);
  });

  it("割合の指標は母数が 0 件でも未記入でも断り、1 件なら通る", () => {
    const s = (denominator: number | null) =>
      validateSample({ key: "stale_price_ratio", value: 0.5, from, to, denominator });
    expect(s(null).ok).toBe(false);
    expect(s(0).ok).toBe(false);
    expect(s(1).ok).toBe(true);
  });

  it("割合でない指標は、1 を超えても通る（件数だから）", () => {
    expect(
      validateSample({ key: "correction_count", value: 42, from, to, denominator: null }).ok,
    ).toBe(true);
  });
});

describe("Conversion（E29）: 会計期間の形の端", () => {
  const base = {
    id: taggedString<"ConversionId">("cv-1"),
    workspaceId: WS,
    programId: asAffiliateProgramId("pg-1"),
    asp: "a8net" as const,
    externalConversionId: "ext-1",
    status: "pending" as const,
    occurredAt: NOW,
    period: "2026-08",
  };

  /*
   * 月の端（01 と 12）は通り、その外（00 と 13）で断る。
   * 「形が違えば断る」だけを当てると、`\d{2}` に緩めても緑のままになる。
   */
  it("月は 01 から 12 まで通り、00 と 13 で断る", () => {
    for (const period of ["2026-01", "2026-09", "2026-10", "2026-12"]) {
      expect(createConversion({ ...base, period }).ok).toBe(true);
    }
    for (const period of ["2026-00", "2026-13", "2026-1", "26-01", "2026/01", "2026-08-01", ""]) {
      expect(createConversion({ ...base, period }).ok).toBe(false);
    }
  });

  it("ASP 側の成果 ID が空なら断る", () => {
    for (const blank of BLANKS) {
      expect(createConversion({ ...base, externalConversionId: blank }).ok).toBe(false);
    }
  });
});

/*
 * 商品の識別子（E15）は `entity-guards.test.ts` にある。ここでは
 * 比較・根拠の側から同じ関数を通す道が無いことだけ確かめておく
 * （入口が 1 つしかない状態を、また作らないため）。
 */
describe("入口が 1 つしかない状態を作らない", () => {
  it("識別子は作る関数を通してしか組み立てない", () => {
    const ok = createIdentityKey("gtin", "4901234567894");
    expect(ok.ok).toBe(true);
    // 8 桁か 12〜14 桁だけ通る。11 桁は端の外。
    expect(createIdentityKey("gtin", "49012345678").ok).toBe(false);
  });

  it("承認は人の操作としてしか通らない", () => {
    const built = createContentVariant(VARIANT_BASE);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(approveVariant(built.value, false).ok).toBe(false);
    expect(approveVariant(built.value, true).ok).toBe(true);
  });
});
