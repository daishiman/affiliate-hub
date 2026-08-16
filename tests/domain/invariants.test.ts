import { describe, expect, it } from "vitest";
import { requiredSectionsFor } from "@/domain/authoring/article-structure";
import { createAuthorPersona, checkFactBoundary } from "@/domain/authoring/author-persona";
import { createContentVariant } from "@/domain/authoring/content-variant";
import { runQualityChecks, type ChannelConstraints } from "@/domain/authoring/quality-check";
import {
  DISCLOSURE_SURFACES,
  buildVisibleMessage,
  evaluatePublishGate,
  relAttributeFor,
  requiresDisclosure,
  type PublishCandidate,
} from "@/domain/compliance";
import { assertNotAltered, createAffiliateLink } from "@/domain/monetization";
import {
  ALLOWED_RANKING_CRITERIA,
  PROHIBITED_RANKING_CRITERIA,
  createRankingModel,
  rankProducts,
  type EditorialScoreCard,
} from "@/domain/ranking";
import { taggedString } from "@/domain/shared";

/**
 * 守られていないと困る決まりを、機械で確かめる。
 *
 * ここに書いたものは「レビューで気をつける」ではなく、
 * 壊れたらテストが落ちる形にしてある。
 * 人の目視に頼る決まりは、急いでいるときに必ず抜けるため。
 */

const WS = taggedString<"WorkspaceId">("ws_test");

function model(criteria: readonly { key: string; weight: number }[]) {
  return createRankingModel({
    id: taggedString<"RankingModelId">("rm_test"),
    workspaceId: WS,
    categoryId: taggedString<"CategoryId">("cat_test"),
    version: "v1",
    audience: "動画編集をする人",
    criteria: criteria.map((c) => ({
      key: c.key,
      weight: c.weight,
      measurement: "同一条件での実測",
      passThreshold: 0.3,
    })),
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  });
}

function card(productId: string, scores: Record<string, number>): EditorialScoreCard {
  return {
    productId: taggedString<"ProductId">(productId),
    scores,
    evidenceRefs: ["ev_1"],
    testedAt: new Date("2026-08-01T00:00:00Z"),
  };
}

// ---------------------------------------------------------------------------
// 順位づけ
// ---------------------------------------------------------------------------

describe("順位づけ", () => {
  it("報酬に関わる項目は、評価基準として登録できない", () => {
    // 「気をつける」ではなく、作れないようにしてある。
    for (const key of PROHIBITED_RANKING_CRITERIA) {
      const result = model([{ key, weight: 1 }]);
      expect(result.ok, `${key} が評価基準として通ってしまいました`).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("COMMERCIAL_INPUT_REJECTED");
      }
    }
  });

  it("使ってよい評価基準に、報酬に関わるものが混ざっていない", () => {
    const commercialWords = /commission|reward|revenue|epc|payout|報酬|収益/i;
    for (const key of ALLOWED_RANKING_CRITERIA) {
      expect(commercialWords.test(key), `${key} は報酬に関わる語を含みます`).toBe(false);
    }
  });

  it("評価方法には「報酬は入力ではない」印が必ず付く", () => {
    const m = model([{ key: ALLOWED_RANKING_CRITERIA[0], weight: 1 }]);
    expect(m.ok).toBe(true);
    if (m.ok) expect(m.value.affiliateCompensationIsInput).toBe(false);
  });

  it("同じ入力なら、何度計算しても同じ順位になる", () => {
    const m = model([
      { key: "measured_performance", weight: 0.5 },
      { key: "price_value", weight: 0.5 },
    ]);
    expect(m.ok).toBe(true);
    if (!m.ok) return;

    const cards = [
      card("p_c", { measured_performance: 0.8, price_value: 0.6 }),
      card("p_a", { measured_performance: 0.7, price_value: 0.7 }),
      card("p_b", { measured_performance: 0.9, price_value: 0.5 }),
    ];

    const first = rankProducts(m.value, cards);
    // 並び順を変えても結果は同じでなければならない。
    const second = rankProducts(m.value, [...cards].reverse());
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.value.ranked.map((r) => r.productId)).toEqual(
      second.value.ranked.map((r) => r.productId),
    );
  });

  it("同点は商品の識別子順で決まる（実行のたびに入れ替わらない）", () => {
    const m = model([{ key: "measured_performance", weight: 1 }]);
    expect(m.ok).toBe(true);
    if (!m.ok) return;

    const result = rankProducts(m.value, [
      card("p_z", { measured_performance: 0.6 }),
      card("p_a", { measured_performance: 0.6 }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ranked.map((r) => String(r.productId))).toEqual(["p_a", "p_z"]);
  });

  it("根拠の付いていない点数は順位に使えない", () => {
    const m = model([{ key: "measured_performance", weight: 1 }]);
    expect(m.ok).toBe(true);
    if (!m.ok) return;

    const result = rankProducts(m.value, [
      { ...card("p_a", { measured_performance: 0.9 }), evidenceRefs: [] },
    ]);
    expect(result.ok).toBe(false);
  });

  it("選外の商品には、読者へそのまま出せる理由が付く", () => {
    const m = model([{ key: "measured_performance", weight: 1 }]);
    expect(m.ok).toBe(true);
    if (!m.ok) return;

    const result = rankProducts(m.value, [card("p_a", { measured_performance: 0.1 })]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.excluded).toHaveLength(1);
    expect(result.value.excluded[0]?.reason.length).toBeGreaterThan(10);
  });

  it("順位の結果には、評価基準の内訳が必ず付いてくる", () => {
    // 「なぜこの順位か」を出せない結果を作れないようにしてある。
    const m = model([{ key: "measured_performance", weight: 1 }]);
    expect(m.ok).toBe(true);
    if (!m.ok) return;

    const result = rankProducts(m.value, [card("p_a", { measured_performance: 0.9 })]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.criteriaDisclosure.length).toBe(1);
    expect(result.value.ranked[0]?.breakdown.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 公開ゲート
// ---------------------------------------------------------------------------

function readyCandidate(): PublishCandidate {
  return {
    articleType: "ranking",
    presentSections: requiredSectionsFor("ranking"),
    authorIds: ["au_1"],
    updateOwnerId: "u_1",
    relationshipType: "affiliate",
    disclosureVisibleMessage: "アフィリエイト広告を利用しています。",
    claimCount: 3,
    evidenceCount: 2,
    hasAffiliateCta: true,
    merchantOptionCount: 2,
    imageRightsConfirmed: true,
    structuredDataValid: true,
    mobileChecked: true,
    linksChecked: true,
    aiAnswerEvalPassed: true,
    webmcpSchemaEval: true,
    nextReviewAt: new Date("2026-12-01T00:00:00Z"),
    now: new Date("2026-08-17T00:00:00Z"),
  };
}

describe("公開ゲート", () => {
  it("すべて揃っていれば公開できる（そもそも通らないゲートにしない）", () => {
    const result = evaluatePublishGate(readyCandidate());
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it.each([
    ["著者がいない", { authorIds: [] }, "author"],
    ["更新責任者がいない", { updateOwnerId: null }, "update_owner"],
    ["広告との関係が未設定", { relationshipType: null }, "disclosure"],
    ["表示文が空", { disclosureVisibleMessage: "" }, "disclosure"],
    ["根拠が無い", { evidenceCount: 0 }, "evidence"],
    ["主張が無い", { claimCount: 0 }, "evidence"],
    ["販売店の選択肢が無い", { merchantOptionCount: 0 }, "cta_merchant_info"],
    ["必須の項目が欠けている", { presentSections: [] }, "required_sections"],
    ["次回確認日が無い", { nextReviewAt: null }, "next_review_date"],
  ] as const)("%s と公開できない", (_name, patch, requirement) => {
    const result = evaluatePublishGate({ ...readyCandidate(), ...patch });
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.requirement)).toContain(requirement);
  });

  it("止めた理由は、そのまま読んで直せる文になっている", () => {
    const result = evaluatePublishGate({ ...readyCandidate(), authorIds: [] });
    for (const f of result.failures) {
      expect(f.message.length, `${f.requirement} の説明が短すぎます`).toBeGreaterThan(10);
      expect(f.message).toMatch(/[。]$/);
    }
  });

  it("確かめられなかった検査は、合格ではなく「検査していない」として残る", () => {
    // 空の合格を返すと、通っていない検査が通ったことになる。
    const result = evaluatePublishGate({
      ...readyCandidate(),
      imageRightsConfirmed: null,
      structuredDataValid: null,
      mobileChecked: null,
      linksChecked: null,
      aiAnswerEvalPassed: null,
      webmcpSchemaEval: null,
    });
    expect(result.ok).toBe(true);
    expect(result.skipped.map((s) => s.requirement).sort()).toEqual(
      [
        "ai_answer_eval",
        "image_rights",
        "link_check",
        "mobile_check",
        "structured_data",
        "webmcp_schema_eval",
      ].sort(),
    );
    for (const s of result.skipped) {
      expect(s.reason.length).toBeGreaterThan(5);
    }
  });
});

// ---------------------------------------------------------------------------
// 広告であることの表示
// ---------------------------------------------------------------------------

describe("広告であることの表示", () => {
  it("自費購入以外は、すべて表示が必要", () => {
    for (const t of [
      "affiliate",
      "sponsored",
      "supplied",
      "loaned",
      "paid_partnership",
    ] as const) {
      expect(requiresDisclosure(t), `${t} の表示が不要になっています`).toBe(true);
      expect(relAttributeFor(t)).toContain("sponsored");
    }
    expect(requiresDisclosure("purchased")).toBe(false);
    expect(relAttributeFor("purchased")).not.toContain("sponsored");
  });

  it("表示文には、関係と編集への関与の両方が必ず入る", () => {
    const message = buildVisibleMessage({
      relationshipType: "sponsored",
      advertiserOrSupplier: "見本社",
      editorialInfluence: "declared",
      aiAssisted: true,
    });
    expect(message).toContain("スポンサー");
    expect(message).toContain("見本社");
    expect(message).toContain("内容確認");
    expect(message).toContain("AI");
    // 「PR」だけの分かりにくい表示にならないこと。
    expect(message.length).toBeGreaterThan(20);
  });

  it("表示が必要な場所は 8 箇所すべて数え上げられている", () => {
    expect(DISCLOSURE_SURFACES).toHaveLength(8);
    expect(new Set(DISCLOSURE_SURFACES).size).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// 提携リンクを改変しない
// ---------------------------------------------------------------------------

describe("提携リンク", () => {
  const link = createAffiliateLink({
    id: taggedString<"AffiliateLinkId">("al_1"),
    workspaceId: WS,
    programId: taggedString<"AffiliateProgramId">("ap_1"),
    originalUrl: "https://example.com/item?aff=abc123",
    trackingRef: "trk_1",
    createdAt: new Date("2026-08-01T00:00:00Z"),
  });

  it("ASP が発行した URL は、そのままなら通る", () => {
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect(assertNotAltered(link.value, link.value.originalUrl).ok).toBe(true);
  });

  it("計測用のパラメータを足すと止まる", () => {
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    const altered = assertNotAltered(
      link.value,
      "https://example.com/item?aff=abc123&utm_source=blog",
    );
    expect(altered.ok).toBe(false);
    if (!altered.ok) expect(altered.error.message).toContain("utm_source");
  });

  it("http のリンクは登録できない", () => {
    const insecure = createAffiliateLink({
      id: taggedString<"AffiliateLinkId">("al_2"),
      workspaceId: WS,
      programId: taggedString<"AffiliateProgramId">("ap_1"),
      originalUrl: "http://example.com/item",
      trackingRef: "trk_2",
      createdAt: new Date("2026-08-01T00:00:00Z"),
    });
    expect(insecure.ok).toBe(false);
  });

  it("計測の識別子が無いと登録できない（URL へ足して測る作りにさせない）", () => {
    const noRef = createAffiliateLink({
      id: taggedString<"AffiliateLinkId">("al_3"),
      workspaceId: WS,
      programId: taggedString<"AffiliateProgramId">("ap_1"),
      originalUrl: "https://example.com/item",
      trackingRef: "",
      createdAt: new Date("2026-08-01T00:00:00Z"),
    });
    expect(noRef.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 事実の境界と品質確認
// ---------------------------------------------------------------------------

function persona(overrides: { prohibitedPhrases?: readonly string[] } = {}) {
  const created = createAuthorPersona({
    id: taggedString<"AuthorPersonaId">("ap_1"),
    workspaceId: WS,
    displayName: "見本の書き手",
    personaType: "editorial_team",
    role: "編集部",
    knowledgeLevel: "intermediate",
    firstPersonPronoun: "編集部",
    readerAddress: "みなさん",
    tone: { formality: 0.6, analytical: 0.7, emotional: 0.3, assertiveness: 0.4, humor: 0.2, emojiUsage: 0 },
    prohibitedPhrases: overrides.prohibitedPhrases ?? [],
    disclosureStyle: "冒頭に明記する",
    ctaStyle: "押しつけない",
  });
  if (!created.ok) throw new Error("見本の書き手を作れませんでした");
  return created.value;
}

describe("事実の境界", () => {
  it("検証記録が無いのに一人称の体験を書くと止まる", () => {
    const violations = checkFactBoundary(persona(), "実際に使ってみました。とても軽いです。", {
      hasVerifiedTestRun: false,
    });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.message).toContain("検証記録");
  });

  it("検証記録があれば、同じ文章が通る", () => {
    const violations = checkFactBoundary(persona(), "実際に使ってみました。とても軽いです。", {
      hasVerifiedTestRun: true,
    });
    expect(violations).toEqual([]);
  });

  it("ブランドキャラクターに資格を持たせられない", () => {
    const created = createAuthorPersona({
      id: taggedString<"AuthorPersonaId">("ap_2"),
      workspaceId: WS,
      displayName: "見本のキャラクター",
      personaType: "brand_character",
      role: "案内役",
      verifiedCredentials: ["国家資格"],
      knowledgeLevel: "beginner",
      firstPersonPronoun: "ぼく",
      readerAddress: "きみ",
      tone: { formality: 0.2, analytical: 0.2, emotional: 0.9, assertiveness: 0.3, humor: 0.7, emojiUsage: 0.5 },
      disclosureStyle: "冒頭に明記する",
      ctaStyle: "押しつけない",
    });
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.error.code).toBe("FACT_BOUNDARY_VIOLATED");
  });
});

const CONSTRAINTS: ChannelConstraints = {
  channel: "ブログ",
  maxBodyLength: null,
  maxHashtags: null,
  allowsAffiliateLink: true,
  requiresInlineDisclosure: false,
};

function variantWith(body: string, patch: Record<string, unknown> = {}) {
  const created = createContentVariant({
    id: taggedString<"ContentVariantId">("cv_1"),
    workspaceId: WS,
    contentPackageId: taggedString<"ContentPackageId">("cp_1"),
    channel: "blog",
    format: "article",
    authorPersonaId: taggedString<"AuthorPersonaId">("ap_1"),
    audiencePersonaId: taggedString<"AudiencePersonaId">("aud_1"),
    angle: "beginner",
    body,
    summary: "要約",
    cta: "view_comparison",
    disclosure: "アフィリエイト広告を利用しています。",
    factualityScore: 0.9,
    personaFitScore: 0.9,
    channelFitScore: 0.9,
    complianceStatus: "pass",
    generationPromptVersion: "p1",
    modelId: "見本モデル",
    ...patch,
  });
  if (!created.ok) throw new Error(`見本の本文を作れませんでした: ${created.error.message}`);
  return created.value;
}

describe("自動の品質確認", () => {
  function check(body: string, patch: Record<string, unknown> = {}, ctxPatch = {}) {
    return runQualityChecks({
      variant: variantWith(body, patch),
      persona: persona(),
      constraints: CONSTRAINTS,
      hasVerifiedTestRun: true,
      knownFeatureNames: [],
      existingBodies: [],
      priceCheckedAt: null,
      now: new Date("2026-08-17T00:00:00Z"),
      ...ctxPatch,
    });
  }

  it("根拠のない数値を書くと止まる", () => {
    const report = check("バッテリーは12時間持ちます。デメリットは重さです。");
    expect(report.issues.map((i) => i.check)).toContain("unsourced_number");
    expect(report.status).toBe("fail");
  });

  it("確認日の分からない価格を書くと止まる", () => {
    const report = check("価格は128000円です。デメリットは重さです。", {
      claimIds: [taggedString<"ClaimId">("cl_1")],
      evidenceIds: [taggedString<"EvidenceId">("ev_1")],
    });
    expect(report.issues.map((i) => i.check)).toContain("stale_price");
  });

  it("誇大表現を書くと止まる", () => {
    const report = check("この製品は最強です。デメリットは重さです。");
    expect(report.issues.map((i) => i.check)).toContain("exaggeration");
  });

  it("良いところしか書いていないと止まる", () => {
    const report = check("軽くて静かで、とても使いやすい製品です。");
    expect(report.issues.map((i) => i.check)).toContain("missing_drawback");
  });

  it("主張だけあって根拠が無いと止まる", () => {
    const report = check("静かに動きます。デメリットは重さです。", {
      claimIds: [taggedString<"ClaimId">("cl_1")],
      evidenceIds: [],
    });
    expect(report.issues.map((i) => i.check)).toContain("missing_citation");
  });

  it("提携リンクがあるのに広告表記が無いと止まる", () => {
    const report = check("静かに動きます。デメリットは重さです。", {
      disclosure: "",
      affiliateLinkIds: [taggedString<"AffiliateLinkId">("al_1")],
      claimIds: [taggedString<"ClaimId">("cl_1")],
      evidenceIds: [taggedString<"EvidenceId">("ev_1")],
    });
    expect(report.issues.map((i) => i.check)).toContain("disclosure_present");
  });

  it("行えなかった検査は「検査していない」として残る", () => {
    const report = check("静かに動きます。デメリットは重さです。");
    // 価格の記載が無い・機能一覧が無い・比較対象が無い・提携リンクが無い
    expect(report.skipped.map((s) => s.check).sort()).toEqual(
      ["disclosure_present", "duplicate_text", "nonexistent_feature", "stale_price"].sort(),
    );
  });

  it("止めた理由は、そのまま読んで直せる文になっている", () => {
    const report = check("この製品は最強です。バッテリーは12時間持ちます。");
    for (const issue of report.issues) {
      expect(issue.message.length, `${issue.check} の説明が短すぎます`).toBeGreaterThan(10);
    }
  });
});
