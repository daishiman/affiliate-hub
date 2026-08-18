/**
 * @tier 1
 * @req REQ-QC02, REQ-QC05, REQ-QC06, REQ-QC08, REQ-QC09, REQ-FD03
 * @types equivalence, boundary
 */
import { describe, expect, it } from "vitest";
import { requiredSectionsFor } from "@/domain/authoring/article-structure";
import { createAuthorPersona, checkFactBoundary } from "@/domain/authoring/author-persona";
import { createConversationBlock } from "@/domain/authoring/conversation-block";
import { createContentVariant } from "@/domain/authoring/content-variant";
import {
  PRICE_STALE_HOURS,
  runQualityChecks,
  similarity,
  type ChannelConstraints,
} from "@/domain/authoring/quality-check";
import {
  DISCLOSURE_SURFACES,
  buildVisibleMessage,
  evaluatePublishGate,
  relAttributeFor,
  requiresDisclosure,
  type PublishCandidate,
} from "@/domain/compliance";
import {
  assertNotAltered,
  createAffiliateLink,
  isLinkUsable,
  resolveOutboundUrl,
} from "@/domain/monetization";
import {
  ALLOWED_RANKING_CRITERIA,
  PROHIBITED_RANKING_CRITERIA,
  createRankingModel,
  explainRank,
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

  it("評価基準が 1 つも無い評価方法は作れない", () => {
    expect(model([]).ok).toBe(false);
  });

  it("知らない評価基準は、使える一覧を添えて断る", () => {
    const r = model([{ key: "見た目の好み", weight: 1 }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain(ALLOWED_RANKING_CRITERIA[0]);
  });

  it("同じ評価基準を 2 回書けない（重みが二重に効いてしまう）", () => {
    const key = ALLOWED_RANKING_CRITERIA[0];
    const r = model([
      { key, weight: 0.5 },
      { key, weight: 0.5 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("重複");
  });

  it("重みと合格ラインは 0.0〜1.0 の外を受け付けない", () => {
    const [a, b] = ALLOWED_RANKING_CRITERIA;
    expect(model([{ key: a, weight: 1.5 }]).ok).toBe(false);
    expect(model([{ key: a, weight: -0.1 }]).ok).toBe(false);

    const overThreshold = createRankingModel({
      id: taggedString<"RankingModelId">("rm_t"),
      workspaceId: WS,
      categoryId: taggedString<"CategoryId">("cat_test"),
      version: "v1",
      audience: "動画編集をする人",
      criteria: [{ key: b, weight: 1, measurement: "同一条件での実測", passThreshold: 1.1 }],
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    });
    expect(overThreshold.ok).toBe(false);
  });

  it("測定方法が空だと、読者へ評価基準を出せないので断る", () => {
    const r = createRankingModel({
      id: taggedString<"RankingModelId">("rm_m"),
      workspaceId: WS,
      categoryId: taggedString<"CategoryId">("cat_test"),
      version: "v1",
      audience: "動画編集をする人",
      criteria: [{ key: ALLOWED_RANKING_CRITERIA[0], weight: 1, measurement: "  ", passThreshold: 0.3 }],
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("criteria");
  });

  it("重みの合計が 1.0 でないと断る", () => {
    const [a, b] = ALLOWED_RANKING_CRITERIA;
    const r = model([
      { key: a, weight: 0.5 },
      { key: b, weight: 0.2 },
    ]);
    expect(r.ok).toBe(false);
    // いくつになっているかを出す。出さないとどこを直すか分からない。
    if (!r.ok) expect(r.error.message).toContain("0.700");
  });

  it("評価方法のバージョンが空だと断る（過去の順位と混ざる）", () => {
    const r = createRankingModel({
      id: taggedString<"RankingModelId">("rm_v"),
      workspaceId: WS,
      categoryId: taggedString<"CategoryId">("cat_test"),
      version: " ",
      audience: "動画編集をする人",
      criteria: [{ key: ALLOWED_RANKING_CRITERIA[0], weight: 1, measurement: "実測", passThreshold: 0.3 }],
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("version");
  });

  it("点数が 0.0〜1.0 の外、または使わない項目だと順位に使えない", () => {
    const m = model([{ key: "measured_performance", weight: 1 }]);
    if (!m.ok) throw new Error(m.error.message);

    expect(rankProducts(m.value, [card("p_a", { measured_performance: 1.2 })]).ok).toBe(false);
    expect(rankProducts(m.value, [card("p_a", { measured_performance: Number.NaN })]).ok).toBe(false);
    expect(
      rankProducts(m.value, [card("p_a", { measured_performance: 0.8, price_value: 0.5 })]).ok,
    ).toBe(false);
  });

  it("順位の理由は、上位・下位の項目つきで取り出せる", () => {
    const m = model([
      { key: "measured_performance", weight: 0.5 },
      { key: "price_value", weight: 0.5 },
    ]);
    if (!m.ok) throw new Error(m.error.message);
    const result = rankProducts(m.value, [
      card("p_a", { measured_performance: 0.9, price_value: 0.4 }),
      card("p_b", { measured_performance: 0.5, price_value: 0.5 }),
    ]);
    if (!result.ok) throw new Error(result.error.message);

    const explained = explainRank(result.value, taggedString<"ProductId">("p_a"));
    expect(explained.ok).toBe(true);
    if (!explained.ok) return;
    expect(explained.value.rank).toBe(1);
    expect(explained.value.strongest?.key).toBe("measured_performance");
    expect(explained.value.weakest?.key).toBe("price_value");
    expect(explained.value.modelVersion).toBe("v1");
  });

  it("選外の商品の理由を聞くと、選外である理由がそのまま返る", () => {
    const m = model([{ key: "measured_performance", weight: 1 }]);
    if (!m.ok) throw new Error(m.error.message);
    const result = rankProducts(m.value, [card("p_a", { measured_performance: 0.1 })]);
    if (!result.ok) throw new Error(result.error.message);

    const explained = explainRank(result.value, taggedString<"ProductId">("p_a"));
    expect(explained.ok).toBe(false);
    if (!explained.ok) expect(explained.error.message).toContain("選外");

    // そもそも対象にすら入っていない商品は、別の言い方で断る。
    const unknown = explainRank(result.value, taggedString<"ProductId">("p_zzz"));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.message).toContain("対象に含まれていません");
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

  /**
   * 根拠の要否の**端**を当てる（要件表 `REQ-FD03`「根拠のない主張を公開しない」）。
   *
   * 上の一覧には「根拠が無い」（主張 3 件・根拠 0 件）があるが、これは端から遠い。
   * 2026-08-19 に測ったところ、判定を `claimCount > 0` から `claimCount > 1` へ
   * 緩めても **96 件すべて緑**だった。つまり「**主張がちょうど 1 件で根拠が 0 件**」を
   * 誰も通していない。主張 1 件は、記事を書き始めた直後のいちばん普通の状態である。
   */
  it.each([
    ["主張がちょうど 1 件で、根拠が 0 件なら公開できない", 1, 0, false],
    ["主張がちょうど 1 件で、根拠が 1 件なら公開できる", 1, 1, true],
  ] as const)("%s", (_name, claimCount, evidenceCount, allowed) => {
    const result = evaluatePublishGate({ ...readyCandidate(), claimCount, evidenceCount });
    expect(result.ok).toBe(allowed);
    if (!allowed) expect(result.failures.map((f) => f.requirement)).toContain("evidence");
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

  it("URL が空でも登録できない", () => {
    const empty = createAffiliateLink({
      id: taggedString<"AffiliateLinkId">("al_4"),
      workspaceId: WS,
      programId: taggedString<"AffiliateProgramId">("ap_1"),
      originalUrl: "   ",
      trackingRef: "trk_4",
      createdAt: new Date("2026-08-01T00:00:00Z"),
    });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error.field).toBe("originalUrl");
  });

  it("読者へ出す URL は、ASP が発行したものと 1 文字も変わらない", () => {
    if (!link.ok) throw new Error("見本のリンクを作れませんでした");
    const out = resolveOutboundUrl(link.value);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value).toBe(link.value.originalUrl);
  });

  it("改変禁止でないリンクは、変わっていても止めない", () => {
    // 改変を許す ASP もある。禁止の印が付いているものだけを止める。
    const free = createAffiliateLink({
      id: taggedString<"AffiliateLinkId">("al_5"),
      workspaceId: WS,
      programId: taggedString<"AffiliateProgramId">("ap_1"),
      originalUrl: "https://example.com/item",
      alterationProhibited: false,
      trackingRef: "trk_5",
      createdAt: new Date("2026-08-01T00:00:00Z"),
    });
    if (!free.ok) throw new Error(free.error.message);
    expect(assertNotAltered(free.value, "https://example.com/item?utm_source=blog").ok).toBe(true);
  });

  it("URL として読めない文字列でも、足された印があれば見つける", () => {
    // URL 解析が失敗したときに黙って通すと、そこが抜け道になる。
    if (!link.ok) throw new Error("見本のリンクを作れませんでした");
    const broken = assertNotAltered(link.value, "not a url at all utm_source=blog");
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.error.message).toContain("utm_source");
  });

  it("期限切れ・停止済みのリンクは使えない", () => {
    if (!link.ok) throw new Error("見本のリンクを作れませんでした");
    const now = new Date("2026-08-17T00:00:00Z");
    expect(isLinkUsable(link.value, now)).toBe(true);

    // 期限ちょうどは「使えない」側に倒す。切れた瞬間を跨がせない。
    expect(isLinkUsable({ ...link.value, expiresAt: now }, now)).toBe(false);
    expect(isLinkUsable({ ...link.value, disabledAt: now }, now)).toBe(false);
    expect(
      isLinkUsable({ ...link.value, expiresAt: new Date("2026-08-18T00:00:00Z") }, now),
    ).toBe(true);
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
    // ・吹き出しの並びが未指定・見出しが無い・結論の照合材料が無い
    // ・ハッシュタグの上限を知らない
    expect(report.skipped.map((s) => s.check).sort()).toEqual(
      [
        "conclusion_mismatch",
        "conversation_flow",
        "disclosure_present",
        "duplicate_text",
        "hashtag_fit",
        "nonexistent_feature",
        "stale_price",
        "vague_heading",
      ].sort(),
    );
  });

  it("吹き出しの並びを渡すと、続けすぎを止める", () => {
    const say = (role: "reader_question" | "guide_answer") => {
      const created = createConversationBlock({
        id: taggedString<"ConversationBlockId">(`cb_${role}`),
        workspaceId: WS,
        role,
        speakerName: "山田",
        text: "実際に 2 週間使ってみたところ、書き出しは公表値より少し遅く、9 分ほどでした。",
        factAlsoInBody: true,
      });
      if (!created.ok) throw new Error(created.error.message);
      return created.value;
    };
    const report = check(
      "静かに動きます。デメリットは重さです。",
      {},
      { conversationSequence: [say("reader_question"), say("guide_answer"), say("reader_question")] },
    );
    expect(report.issues.map((i) => i.check)).toContain("conversation_flow");
    expect(report.status).toBe("fail");
  });

  it("段落が長すぎると知らせる", () => {
    const report = check(
      "軽いです。静かです。速いです。持ち運べます。デメリットは重さです。",
    );
    expect(report.issues.map((i) => i.check)).toContain("paragraph_shape");
  });

  it("1 文が長すぎると知らせる", () => {
    const report = check(`${"とても軽く持ち運びやすい製品で".repeat(8)}す。デメリットは重さです。`);
    expect(report.issues.map((i) => i.check)).toContain("sentence_length");
  });

  it("見出しだけで結論が分からないと知らせる", () => {
    const report = check("## まとめ\n静かに動きます。\nデメリットは重さです。");
    expect(report.issues.map((i) => i.check)).toContain("vague_heading");
  });

  it("結論を入れた見出しなら通す", () => {
    const report = check(
      "## 動画編集用途なら A が最短で書き出せます\n静かに動きます。\nデメリットは重さです。",
    );
    expect(report.issues.map((i) => i.check)).not.toContain("vague_heading");
  });

  it("単位のない数字を止める", () => {
    const report = check("重さは1.2です。デメリットは価格です。");
    expect(report.issues.map((i) => i.check)).toContain("unit_missing");
    expect(report.status).toBe("fail");
  });

  it("単位が付いていれば通す", () => {
    const report = check("重さは1.2kgです。デメリットは価格です。", {
      claimIds: [taggedString<"ClaimId">("cl_1")],
      evidenceIds: [taggedString<"EvidenceId">("ev_1")],
    });
    expect(report.issues.map((i) => i.check)).not.toContain("unit_missing");
  });

  it("冒頭の結論と最終結論が食い違うと止める", () => {
    const report = check(
      "静かに動きます。デメリットは重さです。",
      {},
      {
        openingConclusion: "動画編集をこれから始める人には A を薦めます。",
        finalConclusion: "結論として、予算を抑えたい人には Z が唯一の選択肢です。",
      },
    );
    expect(report.issues.map((i) => i.check)).toContain("conclusion_mismatch");
  });

  it("冒頭と最終の結論がそろっていれば通す", () => {
    const report = check(
      "静かに動きます。デメリットは重さです。",
      {},
      {
        openingConclusion: "動画編集をこれから始める人には A を薦めます。",
        finalConclusion: "動画編集をこれから始める人には、やはり A を薦めます。",
      },
    );
    expect(report.issues.map((i) => i.check)).not.toContain("conclusion_mismatch");
  });

  it("「先日」のような日付は、具体的な日付に直すよう知らせる", () => {
    const report = check("先日試したところ静かでした。デメリットは重さです。");
    expect(report.issues.map((i) => i.check)).toContain("relative_date");
  });

  it("止めた理由は、そのまま読んで直せる文になっている", () => {
    const report = check("この製品は最強です。バッテリーは12時間持ちます。");
    for (const issue of report.issues) {
      expect(issue.message.length, `${issue.check} の説明が短すぎます`).toBeGreaterThan(10);
    }
  });

  const SOURCED = {
    claimIds: [taggedString<"ClaimId">("cl_1")],
    evidenceIds: [taggedString<"EvidenceId">("ev_1")],
  };

  it("価格の確認から 72 時間ちょうどまでは通し、超えると知らせる", () => {
    const now = new Date("2026-08-17T00:00:00Z");
    const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000);
    const body = "価格は128000円です。デメリットは重さです。";

    const fresh = check(body, SOURCED, { now, priceCheckedAt: at(PRICE_STALE_HOURS) });
    expect(fresh.issues.map((i) => i.check)).not.toContain("stale_price");

    const stale = check(body, SOURCED, { now, priceCheckedAt: at(PRICE_STALE_HOURS + 1) });
    const issue = stale.issues.find((i) => i.check === "stale_price");
    expect(issue).toBeDefined();
    // 古い価格は「間違い」ではなく「確かめ直し」なので、止めずに知らせる。
    expect(issue?.severity).toBe("warning");
    expect(issue?.message).toContain("日経っています");
  });

  it("検証記録が無いのに使った体験を書くと止まる", () => {
    const report = check("実際に 2 週間使ってみたところ静かでした。デメリットは重さです。", SOURCED, {
      hasVerifiedTestRun: false,
    });
    const issue = report.issues.find((i) => i.check === "fabricated_experience");
    expect(issue).toBeDefined();
    // どこが問題の箇所かを引用する。本文が長いほどここが効く。
    expect(issue?.excerpt).toBeTruthy();
  });

  it("機能一覧にない機能名を名乗ると知らせ、ある名前なら通す", () => {
    const body = "「静音モード」に対応しています。デメリットは重さです。";
    const unknown = check(body, SOURCED, { knownFeatureNames: ["エコモード"] });
    expect(unknown.issues.map((i) => i.check)).toContain("nonexistent_feature");

    const known = check(body, SOURCED, { knownFeatureNames: ["静音モード"] });
    expect(known.issues.map((i) => i.check)).not.toContain("nonexistent_feature");
    // 照合できたので「検査していない」にも入らない。
    expect(known.skipped.map((s) => s.check)).not.toContain("nonexistent_feature");
  });

  it("その書き手で使わないと決めた言葉を止める", () => {
    // 禁止語は書き手ごとに違う。全体の禁止語と混ぜない。
    const p = persona({ prohibitedPhrases: ["激安"] });
    const report = runQualityChecks({
      variant: variantWith("激安で買えます。デメリットは重さです。"),
      persona: p,
      constraints: CONSTRAINTS,
      hasVerifiedTestRun: true,
      knownFeatureNames: [],
      existingBodies: [],
      priceCheckedAt: null,
      now: new Date("2026-08-17T00:00:00Z"),
    });
    expect(report.issues.map((i) => i.check)).toContain("prohibited_phrase");
  });

  it("本文に広告表記が要る媒体で、本文に入っていないと止まる", () => {
    const inline: ChannelConstraints = { ...CONSTRAINTS, requiresInlineDisclosure: true };
    const withLink = {
      ...SOURCED,
      affiliateLinkIds: [taggedString<"AffiliateLinkId">("al_1")],
      disclosure: "アフィリエイト広告を利用しています。",
    };
    const missing = check("静かに動きます。デメリットは重さです。", withLink, {
      constraints: inline,
    });
    expect(missing.issues.map((i) => i.check)).toContain("disclosure_present");

    const included = check(
      "アフィリエイト広告を利用しています。静かに動きます。デメリットは重さです。",
      withLink,
      { constraints: inline },
    );
    expect(included.issues.map((i) => i.check)).not.toContain("disclosure_present");
  });

  it("媒体の文字数上限を超えると止まる", () => {
    const short: ChannelConstraints = { ...CONSTRAINTS, maxBodyLength: 20 };
    const report = check("静かに動きます。デメリットは重さで、そこだけは覚悟が要ります。", SOURCED, {
      constraints: short,
    });
    const issue = report.issues.find((i) => i.check === "length_fit");
    expect(issue).toBeDefined();
    // 上限と現在の文字数の両方を出す。片方だけでは何文字削るか分からない。
    expect(issue?.message).toContain("20");
  });

  it("ハッシュタグが推奨数を超えると知らせる", () => {
    const tagged: ChannelConstraints = { ...CONSTRAINTS, maxHashtags: 2 };
    const report = check("静かです。デメリットは重さです。\n#静音 #軽量 #動画編集", SOURCED, {
      constraints: tagged,
    });
    expect(report.issues.map((i) => i.check)).toContain("hashtag_fit");
  });

  it("リンクを貼れない媒体に提携リンクを置くと止まる", () => {
    const noLink: ChannelConstraints = { ...CONSTRAINTS, allowsAffiliateLink: false };
    const report = check("静かに動きます。デメリットは重さです。", {
      ...SOURCED,
      affiliateLinkIds: [taggedString<"AffiliateLinkId">("al_1")],
    }, { constraints: noLink });
    expect(report.issues.map((i) => i.check)).toContain("channel_fit");
  });

  it("既存の記事とほぼ同じ本文を止める", () => {
    const body = "静かに動きます。持ち運びやすい大きさです。デメリットは重さです。";
    const same = check(body, SOURCED, { existingBodies: [body] });
    expect(same.issues.map((i) => i.check)).toContain("duplicate_text");

    const different = check(body, SOURCED, {
      existingBodies: ["価格の見方を先に整理します。目的から選ぶと迷いません。"],
    });
    expect(different.issues.map((i) => i.check)).not.toContain("duplicate_text");
  });

  it("書き手らしさ・媒体との一致度が低いと知らせる", () => {
    const report = check("静かに動きます。デメリットは重さです。", {
      ...SOURCED,
      personaFitScore: 0.59,
      channelFitScore: 0.59,
    });
    const kinds = report.issues.map((i) => i.check);
    expect(kinds).toContain("brand_fit");
    expect(kinds).toContain("audience_fit");

    // 0.6 ちょうどは低いとみなさない。境界をどちら側に倒すかを固定する。
    const ok = check("静かに動きます。デメリットは重さです。", {
      ...SOURCED,
      personaFitScore: 0.6,
      channelFitScore: 0.6,
    });
    expect(ok.issues.map((i) => i.check)).not.toContain("brand_fit");
    expect(ok.issues.map((i) => i.check)).not.toContain("audience_fit");
  });

  it("行動を促す文が多すぎると知らせる", () => {
    const report = check(
      "静かです。デメリットは重さです。\n詳しくはこちら\n詳しくはこちら\n詳しくはこちら\n詳しくはこちら",
      SOURCED,
    );
    expect(report.issues.map((i) => i.check)).toContain("cta_overuse");
  });

  it("吹き出しが 1 つも無い並びを渡したら、検査していないと残す", () => {
    // 「並びを渡したのに何も言われない」を「合格」と読み違えさせない。
    const report = check("静かに動きます。デメリットは重さです。", SOURCED, {
      conversationSequence: ["body", "body"],
    });
    const skipped = report.skipped.find((s) => s.check === "conversation_flow");
    expect(skipped).toBeDefined();
    expect(skipped?.reason).toContain("吹き出し");
  });

  /**
   * 止める数字の端を、実数で固定する。
   *
   * 上の検査は「止まること」を見ているが、**どこから止まるか**を見ていない。
   * 5 文の段落で `paragraph_shape` が出ることは、上限が 3 でも 4 でも同じである。
   *
   * さらに悪い形が 1 つある。**上限を定数から組み立てた入力**である。
   *
   *     text: "あ".repeat(CONVERSATION_MAX_LENGTH + 1)   // 必ず 1 文字超える
   *     priceCheckedAt: at(PRICE_STALE_HOURS + 1)        // 必ず 1 時間超える
   *
   * この書き方は、定数をいくつに変えても**同じ側に居続ける**。
   * 定数が 120 から 1200 になっても緑のままで、
   * 赤くならないのに**テストの名前だけが「120 文字」と主張し続ける**。
   * 「72 時間ちょうどまでは通し」という上の検査名も、同じ形をしている。
   *
   * だからここでは**定数を輸入しない**。数字は手で書く。
   * 実装の数字が動いた日に、ここが赤くなって「決めた値が変わった」と知らせる。
   * 値を変えてよいときは、この行も一緒に直す——**2 か所直させることが目的**である。
   */
  describe("止める数字の端", () => {
    it("1 段落は 3 文まで通し、4 文で知らせる", () => {
      const ok = check("軽いです。静かです。デメリットは重さです。", SOURCED);
      expect(ok.issues.map((i) => i.check)).not.toContain("paragraph_shape");

      const ng = check("軽いです。静かです。速いです。デメリットは重さです。", SOURCED);
      expect(ng.issues.map((i) => i.check)).toContain("paragraph_shape");
    });

    it("1 文は 80 文字まで通し、81 文字で知らせる", () => {
      // 句点も 1 文字として数える（実装は末尾の句点を残したまま長さを測る）。
      const tail = "\nデメリットは重さです。";
      const ok = check(`${"あ".repeat(79)}。${tail}`, SOURCED);
      expect(ok.issues.map((i) => i.check)).not.toContain("sentence_length");

      const ng = check(`${"あ".repeat(80)}。${tail}`, SOURCED);
      expect(ng.issues.map((i) => i.check)).toContain("sentence_length");
    });

    it("行動を促す文は 3 箇所まで通し、4 箇所で知らせる", () => {
      const body = (n: number) =>
        `静かです。デメリットは重さです。${"\n詳しくはこちら".repeat(n)}`;
      expect(check(body(3), SOURCED).issues.map((i) => i.check)).not.toContain("cta_overuse");
      expect(check(body(4), SOURCED).issues.map((i) => i.check)).toContain("cta_overuse");
    });

    /*
     * 近さの端（重複 0.85 / 結論の食い違い 0.3）は、実装のどこにも定数として
     * 出ていない。`similarity(...) >= 0.85` と直に書いてある。
     * 名前が無いものは輸入しようがないので、狙った比率の文章をこちらで作る。
     *
     * `similarity` は 3-gram の重なり率で、**文字がすべて別のもの**なら
     * 長さ L の文字列は L-2 個の相異なる 3-gram を持つ。
     * 42 文字なら 40 個。先頭 k+2 文字だけを共有させると、
     * 重なりはちょうど k 個（またぐ 3-gram は相手側の文字を含むので当たらない）。
     * つまり比率は k/40 で、0.025 刻みで狙える。
     */
    const HIRA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろ";
    const KATA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロ";
    /** 40 個の 3-gram を持つ文章。 */
    const base40 = HIRA.slice(0, 42);
    /** `base40` と 3-gram を k 個だけ共有する、同じ長さの文章。 */
    const shares = (k: number) => HIRA.slice(0, k + 2) + KATA.slice(0, 42 - k);

    it("作った文章の重なり率が、狙った値になっている", () => {
      // 下の 2 件は、この比率が合っていることに乗っている。
      // ここが崩れると、端を測ったつもりで別の値を測る。
      expect(similarity(base40, shares(34))).toBeCloseTo(0.85, 10);
      expect(similarity(base40, shares(33))).toBeCloseTo(0.825, 10);
      expect(similarity(base40, shares(12))).toBeCloseTo(0.3, 10);
      expect(similarity(base40, shares(11))).toBeCloseTo(0.275, 10);
    });

    it("既存の記事との近さは 0.85 ちょうどで止め、その手前は通す", () => {
      const stop = check(base40, SOURCED, { existingBodies: [shares(34)] });
      expect(stop.issues.map((i) => i.check)).toContain("duplicate_text");

      const pass = check(base40, SOURCED, { existingBodies: [shares(33)] });
      expect(pass.issues.map((i) => i.check)).not.toContain("duplicate_text");
    });

    it("冒頭と最終の結論は、近さ 0.3 ちょうどなら通し、その手前で止める", () => {
      const pass = check("静かに動きます。デメリットは重さです。", SOURCED, {
        openingConclusion: base40,
        finalConclusion: shares(12),
      });
      expect(pass.issues.map((i) => i.check)).not.toContain("conclusion_mismatch");

      const stop = check("静かに動きます。デメリットは重さです。", SOURCED, {
        openingConclusion: base40,
        finalConclusion: shares(11),
      });
      expect(stop.issues.map((i) => i.check)).toContain("conclusion_mismatch");
    });
  });
});
