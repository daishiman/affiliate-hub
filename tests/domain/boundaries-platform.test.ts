/** @tier 1 @req REQ-P08, REQ-P04, REQ-SEC03 @types boundary, state-transition, equivalence */
import { describe, expect, it } from "vitest";
import { checkPolicies } from "@/domain/compliance";
import type { GateResult } from "@/domain/compliance/publish-gate";
import {
  MAX_SEND_ATTEMPTS,
  advance,
  buildIdempotencyKey,
  canRetry,
  createPublication,
} from "@/domain/distribution";
import {
  PLAN_LIMITS,
  type WorkspacePlan,
  checkCapacity,
  coversBrand,
  createMembership,
  createWorkspace,
  isActiveMembership,
  limitsOf,
} from "@/domain/identity";
import {
  MAX_COMPARISON_CANDIDATES,
  PRICE_FRESHNESS_HOURS,
  classifyRelation,
  createComparisonSet,
  createMerchantOffer,
  resolvePriceDisplay,
  scoreComparison,
} from "@/domain/product";
import {
  type MembershipId,
  type Role,
  asBrandId,
  asChannelConnectionId,
  asComparisonSetId,
  asContentVariantId,
  asMerchantId,
  asMerchantOfferId,
  asProductId,
  asPublicationId,
  asUserId,
  asWorkspaceId,
  compareMoney,
  createProvenance,
  fixedClock,
  formatMoney,
  isExpired,
  jpy,
  money,
} from "@/domain/shared";

/**
 * 上限・期限・状態遷移の境目。
 *
 * `boundaries.test.ts` が「判断の境目」（差があると言ってよいか、期限が切れたか）
 * を見るのに対し、こちらは**数の上限と、進んでよい順序**を見る。
 * どちらも「ちょうど」と「1 つ超えた側」でしか壊れない。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-6
 */

const WS = asWorkspaceId("ws_boundary");
const NOW = new Date("2026-08-17T09:00:00.000Z");

// ---------------------------------------------------------------------------
// 契約プランの上限
// ---------------------------------------------------------------------------

describe("プランごとの上限", () => {
  function workspace(plan: WorkspacePlan) {
    const r = createWorkspace({
      id: WS,
      name: "たたき台の会社",
      plan,
      ownerUserId: asUserId("u_owner"),
      createdAt: NOW,
    });
    if (!r.ok) throw new Error("前提のワークスペースが作れませんでした");
    return r.value;
  }

  it("上限の 1 つ手前までは作れる", () => {
    const ws = workspace("solo");
    expect(checkCapacity(ws, "site", PLAN_LIMITS.solo.maxSites - 1).ok).toBe(true);
  });

  it("上限ちょうどに達したら、そこで止める", () => {
    // 「上限 3」は 3 件目を作れるという意味ではなく、3 件持てるという意味。
    // すでに 3 件あるなら 4 件目は作れない。
    const ws = workspace("solo");
    const r = checkCapacity(ws, "site", PLAN_LIMITS.solo.maxSites);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // 断るだけでなく、いくつまでかを本人に伝える。
      expect(r.error.message).toContain(String(PLAN_LIMITS.solo.maxSites));
    }
  });

  it("上限を超えている状態でも、止めるだけで例外にしない", () => {
    const ws = workspace("solo");
    expect(checkCapacity(ws, "site", PLAN_LIMITS.solo.maxSites + 1).ok).toBe(false);
  });

  it("0 件からでも正しく数えられる", () => {
    const ws = workspace("solo");
    expect(checkCapacity(ws, "brand", 0).ok).toBe(true);
    // solo のブランド上限は 1。1 件持っていれば次は作れない。
    expect(checkCapacity(ws, "brand", 1).ok).toBe(false);
  });

  it("4 種類すべての数え物に上限がある", () => {
    const ws = workspace("team");
    for (const kind of ["brand", "site", "member", "generation"] as const) {
      expect(checkCapacity(ws, kind, 0).ok, kind).toBe(true);
      expect(checkCapacity(ws, kind, 1_000_000).ok, kind).toBe(false);
    }
  });

  it("プランを上げれば上限も上がる（下がる項目が無い）", () => {
    const solo = limitsOf(workspace("solo"));
    const team = limitsOf(workspace("team"));
    const business = limitsOf(workspace("business"));
    for (const key of ["maxBrands", "maxSites", "maxMembers", "monthlyGenerations"] as const) {
      expect(team[key], key).toBeGreaterThan(solo[key]);
      expect(business[key], key).toBeGreaterThan(team[key]);
    }
  });

  it("名前が空白だけのワークスペースは作れない", () => {
    const r = createWorkspace({
      id: WS,
      name: "  ",
      plan: "solo",
      ownerUserId: asUserId("u_owner"),
      createdAt: NOW,
    });
    expect(r.ok).toBe(false);
  });

  it("時間帯と通貨は、指定が無ければ日本の既定になる", () => {
    const ws = workspace("solo");
    expect(ws.timezone).toBe("Asia/Tokyo");
    expect(ws.currency).toBe("JPY");
  });
});

// ---------------------------------------------------------------------------
// メンバーの権限
// ---------------------------------------------------------------------------

describe("メンバーの役割と担当範囲", () => {
  const id = "mb_1" as MembershipId;
  const base = {
    id,
    workspaceId: WS,
    userId: asUserId("u_1"),
    displayName: "三輪",
    invitedAt: NOW,
  };

  const make = (roles: readonly Role[], scopedBrandIds?: readonly ReturnType<typeof asBrandId>[]) =>
    createMembership({ ...base, roles, scopedBrandIds });

  it("役割 0 個では招待できない", () => {
    expect(make([]).ok).toBe(false);
  });

  it("役割 1 個なら招待できる", () => {
    expect(make(["writer"]).ok).toBe(true);
  });

  it("代表者は他の役割と兼ねられない", () => {
    // 兼ねられると「代表者だから何でもできる」が他の役割の検査を素通りさせる。
    expect(make(["owner"]).ok).toBe(true);
    expect(make(["owner", "writer"]).ok).toBe(false);
  });

  it("AI の実行アカウントに人の役割を足せない", () => {
    expect(make(["ai_service_account"]).ok).toBe(true);
    expect(make(["ai_service_account", "publisher"]).ok).toBe(false);
  });

  it("名前が空白だけでは招待できない（承認履歴に誰か残らない）", () => {
    expect(createMembership({ ...base, roles: ["writer"], displayName: " 　" }).ok).toBe(false);
  });

  it("担当ブランドが空なら、全ブランドを扱える", () => {
    const m = make(["writer"]);
    expect(m.ok && coversBrand(m.value, asBrandId("br_any"))).toBe(true);
  });

  it("担当ブランドを指定したら、その 1 つだけになる", () => {
    const m = make(["writer"], [asBrandId("br_a")]);
    expect(m.ok && coversBrand(m.value, asBrandId("br_a"))).toBe(true);
    expect(m.ok && coversBrand(m.value, asBrandId("br_b"))).toBe(false);
  });

  it("招待しただけでは、まだ動けない", () => {
    const m = make(["writer"]);
    expect(m.ok && isActiveMembership(m.value, NOW)).toBe(false);
  });

  it("取り消しは、その瞬間から効く", () => {
    const m = make(["writer"]);
    if (!m.ok) throw new Error("前提のメンバーが作れませんでした");
    const accepted = { ...m.value, acceptedAt: NOW };
    const revoked = { ...accepted, revokedAt: NOW };
    expect(isActiveMembership(accepted, NOW)).toBe(true);
    // 取り消した時刻ちょうどで、もう動けない。1 ミリ秒前はまだ動ける。
    expect(isActiveMembership(revoked, NOW)).toBe(false);
    expect(isActiveMembership(revoked, new Date(NOW.getTime() - 1))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 金額
// ---------------------------------------------------------------------------

describe("金額の境目", () => {
  it("0 円は有効な金額（不明とは違う）", () => {
    expect(jpy(0).ok).toBe(true);
  });

  it("マイナスは受け付けない", () => {
    expect(jpy(-1).ok).toBe(false);
  });

  it("小数は受け付けない（丸め誤差が積み上がる）", () => {
    expect(jpy(100.5).ok).toBe(false);
    expect(money(1050, "USD").ok).toBe(true);
  });

  it("通貨が違う金額は比べない", () => {
    const a = money(1000, "JPY");
    const b = money(1000, "USD");
    if (!a.ok || !b.ok) throw new Error("前提の金額が作れませんでした");
    expect(compareMoney(a.value, b.value).ok).toBe(false);
    expect(compareMoney(a.value, a.value).ok).toBe(true);
  });

  it("円は小数を出さず、ドルは 2 桁で出す", () => {
    const yen = jpy(1234);
    const usd = money(1234, "USD");
    if (!yen.ok || !usd.ok) throw new Error("前提の金額が作れませんでした");
    expect(formatMoney(yen.value)).toContain("1,234");
    expect(formatMoney(yen.value)).not.toContain(".");
    expect(formatMoney(usd.value)).toContain("12.34");
  });
});

// ---------------------------------------------------------------------------
// 情報の由来と価格の鮮度
// ---------------------------------------------------------------------------

describe("情報の由来", () => {
  const base = {
    sourceType: "merchant" as const,
    sourceName: "販売店A",
    retrievedAt: NOW,
    confidence: 0.8,
    permittedUsage: "価格の引用のみ",
  };

  it("信頼度は 0.0 と 1.0 を含み、その外は受け付けない", () => {
    expect(createProvenance({ ...base, confidence: 0 }).ok).toBe(true);
    expect(createProvenance({ ...base, confidence: 1 }).ok).toBe(true);
    expect(createProvenance({ ...base, confidence: -0.0001 }).ok).toBe(false);
    expect(createProvenance({ ...base, confidence: 1.0001 }).ok).toBe(false);
  });

  it("情報源の名前が空白だけでは登録できない", () => {
    expect(createProvenance({ ...base, sourceName: "  " }).ok).toBe(false);
  });

  it("有効期限が取得時刻と同時、または前のものは登録できない", () => {
    expect(createProvenance({ ...base, validUntil: NOW }).ok).toBe(false);
    expect(createProvenance({ ...base, validUntil: new Date(NOW.getTime() - 1) }).ok).toBe(false);
    expect(createProvenance({ ...base, validUntil: new Date(NOW.getTime() + 1) }).ok).toBe(true);
  });

  it("期限のその瞬間から期限切れになる", () => {
    const until = new Date(NOW.getTime() + 3_600_000);
    const p = createProvenance({ ...base, validUntil: until });
    if (!p.ok) throw new Error("前提の由来が作れませんでした");
    expect(isExpired(p.value, new Date(until.getTime() - 1))).toBe(false);
    expect(isExpired(p.value, until)).toBe(true);
  });

  it("期限の無い情報は、切れない", () => {
    const p = createProvenance(base);
    expect(p.ok && isExpired(p.value, new Date("2099-01-01"))).toBe(false);
  });
});

describe("価格をどう見せるか", () => {
  function provenance() {
    const r = createProvenance({
      sourceType: "merchant",
      sourceName: "販売店A",
      retrievedAt: NOW,
      confidence: 0.9,
      permittedUsage: "価格の引用のみ",
    });
    if (!r.ok) throw new Error("前提の由来が作れませんでした");
    return r.value;
  }

  function offer(over: { displayPrice?: ReturnType<typeof jpy>; expiresAt?: Date | null } = {}) {
    const price = over.displayPrice ?? jpy(19800);
    const r = createMerchantOffer({
      id: asMerchantOfferId("mo_1"),
      workspaceId: WS,
      productId: asProductId("pr_1"),
      merchantId: asMerchantId("me_1"),
      merchantName: "販売店A",
      displayPrice: price.ok ? price.value : null,
      checkedAt: NOW,
      expiresAt: over.expiresAt,
      provenance: provenance(),
    });
    if (!r.ok) throw new Error("前提の取扱情報が作れませんでした");
    return r.value;
  }

  const hoursAfter = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

  it("確認からちょうど 24 時間までは、そのままの価格として出す", () => {
    expect(resolvePriceDisplay(offer(), hoursAfter(PRICE_FRESHNESS_HOURS)).kind).toBe("fresh");
  });

  it("24 時間を 1 ミリ秒でも超えたら、確認日つきの参考値にする", () => {
    const at = new Date(NOW.getTime() + PRICE_FRESHNESS_HOURS * 3_600_000 + 1);
    const d = resolvePriceDisplay(offer(), at);
    expect(d.kind).toBe("stale");
    // 「少し前」ではなく具体的な日付を出す。
    if (d.kind === "stale") expect(d.note).toContain("2026年8月17日");
  });

  it("有効期限のその瞬間から、期限切れとして扱う", () => {
    const expiresAt = hoursAfter(1);
    expect(resolvePriceDisplay(offer({ expiresAt }), new Date(expiresAt.getTime() - 1)).kind).toBe(
      "fresh",
    );
    const d = resolvePriceDisplay(offer({ expiresAt }), expiresAt);
    expect(d.kind).toBe("stale");
    if (d.kind === "stale") expect(d.note).toContain("有効期限");
  });

  it("価格が取れていないときは、0 円ではなく「確認してください」を出す", () => {
    const d = resolvePriceDisplay(offer({ displayPrice: jpy(-1) }), NOW);
    expect(d.kind).toBe("unknown");
    if (d.kind === "unknown") expect(d.note).toContain("確認");
  });

  it("有効期限が確認時刻と同時、または前の取扱情報は登録できない", () => {
    const bad = createMerchantOffer({
      id: asMerchantOfferId("mo_2"),
      workspaceId: WS,
      productId: asProductId("pr_1"),
      merchantId: asMerchantId("me_1"),
      merchantName: "販売店A",
      checkedAt: NOW,
      expiresAt: NOW,
      provenance: provenance(),
    });
    expect(bad.ok).toBe(false);
  });

  it("販売店名が空白だけの取扱情報は登録できない", () => {
    const bad = createMerchantOffer({
      id: asMerchantOfferId("mo_3"),
      workspaceId: WS,
      productId: asProductId("pr_1"),
      merchantId: asMerchantId("me_1"),
      merchantName: " ",
      checkedAt: NOW,
      provenance: provenance(),
    });
    expect(bad.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 比較表
// ---------------------------------------------------------------------------

describe("比較の候補", () => {
  const signals = {
    identity: 0.2,
    category: 0.8,
    useCase: 0.6,
    priceBand: 0.5,
    keySpecs: 0.5,
    audience: 0.5,
    recency: 0.5,
  };

  const candidate = (n: number, score: number) => ({
    productId: asProductId(`pr_${n}`),
    relation: "direct_competitor" as const,
    score,
    signals,
    reason: "同じ用途で価格帯が近いため",
    commonPoints: [],
    decisiveDifferences: [],
    informationConfidence: 0.8,
    missingInformation: [],
    lastVerifiedBy: null,
  });

  const set = (count: number) =>
    createComparisonSet({
      id: asComparisonSetId("cs_1"),
      workspaceId: WS,
      primaryProductId: asProductId("pr_main"),
      candidates: Array.from({ length: count }, (_, i) => candidate(i, i / 100)),
      createdAt: NOW,
      scopeDescription: "10万円以下の動画編集向けノートPC",
    });

  it("上限ちょうどまでは並べられる", () => {
    expect(set(MAX_COMPARISON_CANDIDATES).ok).toBe(true);
  });

  it("上限を 1 つ超えたら断る（読者が判断できなくなる）", () => {
    const r = set(MAX_COMPARISON_CANDIDATES + 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain(String(MAX_COMPARISON_CANDIDATES));
  });

  it("候補 0 件でも作れる（比べる相手が無いことも結果）", () => {
    expect(set(0).ok).toBe(true);
  });

  it("比べた範囲の説明が無い比較表は作れない", () => {
    const r = createComparisonSet({
      id: asComparisonSetId("cs_2"),
      workspaceId: WS,
      primaryProductId: asProductId("pr_main"),
      candidates: [],
      createdAt: NOW,
      scopeDescription: "  ",
    });
    expect(r.ok).toBe(false);
  });

  it("主商品そのものを候補に混ぜられない", () => {
    const r = createComparisonSet({
      id: asComparisonSetId("cs_3"),
      workspaceId: WS,
      primaryProductId: asProductId("pr_main"),
      candidates: [{ ...candidate(0, 0.5), productId: asProductId("pr_main") }],
      createdAt: NOW,
      scopeDescription: "同上",
    });
    expect(r.ok).toBe(false);
  });

  it("候補は点数の高い順に並べ直す", () => {
    const r = createComparisonSet({
      id: asComparisonSetId("cs_4"),
      workspaceId: WS,
      primaryProductId: asProductId("pr_main"),
      candidates: [candidate(1, 0.1), candidate(2, 0.9), candidate(3, 0.5)],
      createdAt: NOW,
      scopeDescription: "同上",
    });
    expect(r.ok && r.value.candidates.map((c) => c.score)).toEqual([0.9, 0.5, 0.1]);
  });

  it("点数の要素は 0.0 と 1.0 を含み、その外は受け付けない", () => {
    const all = (v: number) => ({
      identity: v,
      category: v,
      useCase: v,
      priceBand: v,
      keySpecs: v,
      audience: v,
      recency: v,
    });
    expect(scoreComparison(all(0)).ok).toBe(true);
    expect(scoreComparison(all(1)).ok).toBe(true);
    expect(scoreComparison(all(-0.0001)).ok).toBe(false);
    expect(scoreComparison(all(1.0001)).ok).toBe(false);
    // 重みの合計が 1.0 なので、全部 1.0 なら点数も 1.0 になる。
    const full = scoreComparison(all(1));
    expect(full.ok && full.value).toBeCloseTo(1, 10);
  });

  it("同一性が高いものは、他の要素に関係なく同じ商品側へ分類する", () => {
    expect(classifyRelation({ ...signals, identity: 0.95 })).toBe("exact_offer");
    expect(classifyRelation({ ...signals, identity: 0.9499 })).toBe("variant");
    expect(classifyRelation({ ...signals, identity: 0.6 })).toBe("variant");
    expect(classifyRelation({ ...signals, identity: 0.5999 })).toBe("direct_competitor");
  });

  it("分野も用途も離れていれば、代替手段として分類する", () => {
    expect(
      classifyRelation({ ...signals, identity: 0.1, category: 0.79, useCase: 0.6 }),
    ).toBe("alternative_solution");
  });
});

// ---------------------------------------------------------------------------
// 配信の状態遷移
// ---------------------------------------------------------------------------

describe("配信を進めてよい順序", () => {
  const passed: GateResult = { ok: true, failures: [], skipped: [] };
  const failed: GateResult = {
    ok: false,
    failures: [{ ruleId: "disclosure", message: "広告表記がありません。" } as never],
    skipped: [],
  };

  function queued(channelKind: "own_site" | "note" = "own_site") {
    const r = createPublication({
      id: asPublicationId("pb_1"),
      workspaceId: WS,
      variantId: asContentVariantId("cv_1"),
      channelKind,
      connectionId: channelKind === "note" ? null : asChannelConnectionId("cc_1"),
      idempotencyKey: "k_1",
    });
    if (!r.ok) throw new Error("前提の配信が作れませんでした");
    return r.value;
  }

  const at = (p: ReturnType<typeof queued>, to: Parameters<typeof advance>[1], gate?: GateResult) =>
    advance(p, to, { gate, at: NOW });

  it("順番を飛ばして送信へ進めない", () => {
    const r = at(queued(), "SENDING", passed);
    expect(r.ok).toBe(false);
    // 進める先を示さないと、利用者は次に何をすればよいか分からない。
    // かつ、示すのは表示名。`RENDERING` のような内部の符号を見せられても、
    // 受け取った人は次に何をすればよいか分からない。
    if (!r.ok) {
      expect(r.error.suggestedAction).toContain("本文を組み立て中");
      expect(r.error.suggestedAction).not.toContain("RENDERING");
      expect(r.error.message).not.toContain("QUEUED");
      expect(r.error.message).not.toContain("SENDING");
    }
  });

  it("行き止まりでも、次にできることを示す", () => {
    // 「進める先: なし」とだけ返すと、受け取った人はそこで手が止まる。
    // 進める先が無いなら、別の道（作り直し）を示すのがここの仕事。
    const published = { ...queued(), state: "PUBLISHED" as const };
    const r = at(published, "SENDING", passed);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.suggestedAction).toContain("新しい配信");
      expect(r.error.suggestedAction).not.toContain("なし");
    }
  });

  it("確認の結果を渡さずに送信へ進めない", () => {
    const validating = { ...queued(), state: "VALIDATING" as const };
    const r = at(validating, "SENDING");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("PUBLISH_GATE_FAILED");
  });

  it("確認に落ちていたら送信へ進めない（理由をそのまま出す）", () => {
    const validating = { ...queued(), state: "VALIDATING" as const };
    const r = at(validating, "SENDING", failed);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("広告表記がありません。");
  });

  it("確認を通っていれば送信へ進める", () => {
    const validating = { ...queued(), state: "VALIDATING" as const };
    const r = at(validating, "SENDING", passed);
    expect(r.ok && r.value.state).toBe("SENDING");
    // 送信を試みた回数はここで 1 つ増える。
    expect(r.ok && r.value.attempts).toBe(1);
  });

  it("自動投稿の仕組みが無い配信先へは、確認を通っていても送信できない", () => {
    const validating = { ...queued("note"), state: "VALIDATING" as const };
    const r = at(validating, "SENDING", passed);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("FORBIDDEN");
      expect(r.error.suggestedAction).toContain("書き出して");
    }
    // 代わりに「書き出し済み」へは進める。
    expect(at(validating, "MANUAL_EXPORT_READY", passed).ok).toBe(true);
  });

  it("送信の試行は上限ちょうどで打ち止めになる", () => {
    const ready = {
      ...queued(),
      state: "RETRY_SCHEDULED" as const,
      attempts: MAX_SEND_ATTEMPTS - 1,
    };
    expect(at(ready, "SENDING").ok).toBe(true);
    const spent = { ...ready, attempts: MAX_SEND_ATTEMPTS };
    const r = at(spent, "SENDING");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain(String(MAX_SEND_ATTEMPTS));
  });

  it("公開済みからはどこへも進めない", () => {
    const published = { ...queued(), state: "PUBLISHED" as const };
    for (const to of ["SENDING", "CANCELLED", "QUEUED"] as const) {
      expect(at(published, to, passed).ok, to).toBe(false);
    }
  });

  it("公開した時刻を記録する", () => {
    const sending = { ...queued(), state: "SENDING" as const, attempts: 1 };
    const r = at(sending, "PUBLISHED");
    expect(r.ok && r.value.publishedAt).toEqual(NOW);
  });

  it("再試行してよいのは、相手先の一時的な失敗のときだけ", () => {
    const failedSend = { ...queued(), state: "FAILED_SEND" as const, attempts: 1 };
    expect(canRetry(failedSend, true)).toBe(true);
    // 内容が悪い失敗は、何回送っても同じ結果になる。
    expect(canRetry(failedSend, false)).toBe(false);
    expect(canRetry({ ...failedSend, attempts: MAX_SEND_ATTEMPTS }, true)).toBe(false);
    expect(canRetry({ ...failedSend, state: "QUEUED" }, true)).toBe(false);
  });

  it("接続の設定が無いまま、自動投稿できる配信先へは登録できない", () => {
    const r = createPublication({
      id: asPublicationId("pb_2"),
      workspaceId: WS,
      variantId: asContentVariantId("cv_1"),
      channelKind: "x",
      connectionId: null,
      idempotencyKey: "k_2",
    });
    expect(r.ok).toBe(false);
  });

  it("二重送信を防ぐ鍵が空では登録できない", () => {
    const r = createPublication({
      id: asPublicationId("pb_3"),
      workspaceId: WS,
      variantId: asContentVariantId("cv_1"),
      channelKind: "own_site",
      connectionId: asChannelConnectionId("cc_1"),
      idempotencyKey: "   ",
    });
    expect(r.ok).toBe(false);
  });

  it("同じ原稿・同じ配信先・同じ予定時刻なら、鍵も同じになる", () => {
    const input = {
      variantId: asContentVariantId("cv_1"),
      channelKind: "own_site" as const,
      scheduledAt: NOW,
    };
    expect(buildIdempotencyKey(input)).toBe(buildIdempotencyKey({ ...input }));
    // 予定時刻が違えば別の投稿。定期投稿で同じ原稿を出し直せる。
    expect(buildIdempotencyKey(input)).not.toBe(
      buildIdempotencyKey({ ...input, scheduledAt: new Date(NOW.getTime() + 1) }),
    );
    expect(buildIdempotencyKey({ ...input, scheduledAt: null })).toContain("immediate");
  });
});

// ---------------------------------------------------------------------------
// 時刻の取得口
// ---------------------------------------------------------------------------

describe("時刻を外から渡す仕組み", () => {
  it("固定した時計は、何度呼んでも同じ時刻を返す", () => {
    const clock = fixedClock(NOW);
    expect(clock.now()).toEqual(NOW);
    expect(clock.now()).toEqual(clock.now());
  });

  it("固定した時計が返す時刻を書き換えても、元は変わらない", () => {
    // 同じ Date を使い回すと、呼び出し側の setHours 等で全体が狂う。
    const clock = fixedClock(NOW);
    const first = clock.now();
    first.setFullYear(1999);
    expect(clock.now()).toEqual(NOW);
  });
});

// ---------------------------------------------------------------------------
// ルール 0 件のとき
// ---------------------------------------------------------------------------

describe("検査する対象が 0 件のとき", () => {
  it("ポリシーが 1 件も登録されていなければ、指摘なしで公開できる", () => {
    // 空の入力で落ちると、登録前の会社が最初の 1 本を出せなくなる。
    const r = checkPolicies([], {
      text: "",
      domainScope: "general",
      channelScope: "own_site",
    });
    expect(r.violations).toHaveLength(0);
    expect(r.unevaluatedRuleIds).toHaveLength(0);
    expect(r.publishable).toBe(true);
  });
});
