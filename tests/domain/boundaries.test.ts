/** @tier 1 @req REQ-P10 @types boundary */
import { describe, expect, it } from "vitest";
import {
  MINIMUM_DETECTABLE_EFFECT,
  concludeExperiment,
  createExperiment,
  judgeComparison,
  startExperiment,
} from "@/domain/analytics";
import { checkPolicies, createPolicyRule } from "@/domain/compliance";
import { createClaim, expireIfDue, isClaimUsable, verifyClaim } from "@/domain/evidence";
import {
  adjustReward,
  applyIngestedUpdate,
  createConversion,
  effectiveReward,
  normalizeExternalId,
} from "@/domain/monetization";
import {
  NAME_SIMILARITY_THRESHOLD,
  createIdentityKey,
  matchIdentity,
} from "@/domain/product";
import {
  type ConversionId,
  type EvidenceId,
  type PolicyRuleId,
  asAffiliateProgramId,
  asClaimId,
  asEvidenceId,
  asExperimentId,
  asWorkspaceId,
} from "@/domain/shared";

/**
 * 境界の値だけを集めて確かめる。
 *
 * 不具合は「ちょうど」と「1 つ超えた側」に出る。0 件・1 件・上限ちょうど・
 * 上限+1、期限のその瞬間、しきい値ちょうど。**普通の値でだけ試すと、
 * どれも通ってしまう。**
 *
 * とくに厳しく見るのは統計の判定。件数が足りないのに「差がある」と言うと、
 * その判断が記事の作り方の決まりとして残り、後から覆せなくなる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-6
 */

const WS = asWorkspaceId("ws_boundary");

// ---------------------------------------------------------------------------
// 統計の判定
// ---------------------------------------------------------------------------

describe("差があると言ってよい件数の境目", () => {
  const base = {
    metric: "page_views" as const,
    baselineValue: 100,
    candidateValue: 130, // +30%。差の大きさでは十分に届いている
    minimumSamples: 200,
    comparisonCount: 1,
  };

  const judge = (samples: number) =>
    judgeComparison({ ...base, baselineSamples: samples, candidateSamples: samples });

  it("必要件数の 1 つ手前では、差が大きくても判定保留にする", () => {
    // ここが最も危ない境目。あと 1 件で言えるなら言ってしまえ、が入り込む。
    const r = judge(199);
    expect(r.ok && r.value.verdict).toBe("pending");
    expect(r.ok && r.value.relativeChange).toBeNull();
  });

  it("必要件数ちょうどで、はじめて判定できる", () => {
    const r = judge(200);
    expect(r.ok && r.value.verdict).toBe("improved");
  });

  it("必要件数を超えていれば当然判定できる", () => {
    const r = judge(201);
    expect(r.ok && r.value.verdict).toBe("improved");
  });

  it("件数は少ない方で見る（多い方に引きずられない）", () => {
    // 片方だけ大量に集まった状態で判定できてしまうと、
    // 実際にはほとんど見られていない案が「勝った」ことになる。
    const r = judgeComparison({ ...base, baselineSamples: 10000, candidateSamples: 199 });
    expect(r.ok && r.value.verdict).toBe("pending");
  });

  it("0 件のときも、例外ではなく判定保留として返る", () => {
    const r = judge(0);
    expect(r.ok && r.value.verdict).toBe("pending");
  });
});

describe("差の大きさの境目", () => {
  const base = {
    metric: "page_views" as const,
    baselineValue: 100,
    baselineSamples: 500,
    candidateSamples: 500,
    minimumSamples: 200,
    comparisonCount: 1,
  };

  it("必要な差にちょうど届いたときは、動いたと言う", () => {
    // 5% ちょうど。ここを「未満」で切るか「以下」で切るかで結論が変わる。
    const r = judgeComparison({ ...base, candidateValue: 100 * (1 + MINIMUM_DETECTABLE_EFFECT) });
    expect(r.ok && r.value.verdict).toBe("improved");
  });

  it("必要な差にわずかに届かないときは、効果不明と言う", () => {
    const r = judgeComparison({ ...base, candidateValue: 104.9 });
    expect(r.ok && r.value.verdict).toBe("unclear");
    // 「良くなったとは言えない」であって「変わらなかった」ではない。
    expect(r.ok && r.value.reason).toContain("差があるとは言えません");
  });

  it("下がった側も同じ幅で見る（悪化だけ甘くしない）", () => {
    const r = judgeComparison({ ...base, candidateValue: 100 * (1 - MINIMUM_DETECTABLE_EFFECT) });
    expect(r.ok && r.value.verdict).toBe("worsened");
  });

  it("まったく動かなかったときは効果不明", () => {
    const r = judgeComparison({ ...base, candidateValue: 100 });
    expect(r.ok && r.value.verdict).toBe("unclear");
    expect(r.ok && r.value.relativeChange).toBe(0);
  });

  it("もとが 0 のときは、増えた割合を出さずに効果不明と言う", () => {
    // 0 で割ると Infinity になり、どんな小さな変化も「無限に良くなった」になる。
    const r = judgeComparison({ ...base, baselineValue: 0, candidateValue: 5 });
    expect(r.ok && r.value.verdict).toBe("unclear");
    expect(r.ok && r.value.relativeChange).toBeNull();
  });
});

describe("同時に見ている比較の数", () => {
  const base = {
    metric: "page_views" as const,
    baselineValue: 100,
    candidateValue: 106, // +6%。1 個だけ見ているなら足りる
    baselineSamples: 400,
    candidateSamples: 400,
    minimumSamples: 200,
  };

  it("1 個だけ見ているときは、そのまま判定できる", () => {
    const r = judgeComparison({ ...base, comparisonCount: 1 });
    expect(r.ok && r.value.verdict).toBe("improved");
    expect(r.ok && r.value.requiredSamples).toBe(200);
  });

  it("2 個同時に見ると、必要件数も必要な差も上がる", () => {
    // 20 個も比べれば、何も無くても 1 つくらいは差が出て見える。
    const r = judgeComparison({ ...base, comparisonCount: 2 });
    expect(r.ok && r.value.requiredSamples).toBe(400);
    expect(r.ok && r.value.requiredEffect).toBeCloseTo(MINIMUM_DETECTABLE_EFFECT * Math.SQRT2, 10);
    // +6% は 2 個同時のときの必要な差（約 7.07%）に届かない。
    expect(r.ok && r.value.verdict).toBe("unclear");
  });

  it("0 個や小数は受け付けない", () => {
    for (const comparisonCount of [0, -1, 1.5]) {
      const r = judgeComparison({ ...base, comparisonCount });
      expect(r.ok, `${comparisonCount} が通ってしまいます`).toBe(false);
    }
  });

  it("必要件数は 1 以上の整数でなければならない", () => {
    for (const minimumSamples of [0, -1, 2.5]) {
      const r = judgeComparison({ ...base, comparisonCount: 1, minimumSamples });
      expect(r.ok, `${minimumSamples} が通ってしまいます`).toBe(false);
    }
    expect(judgeComparison({ ...base, comparisonCount: 1, minimumSamples: 1 }).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 実験
// ---------------------------------------------------------------------------

describe("実験を始めるときの境目", () => {
  const valid = {
    id: asExperimentId("ex_1"),
    workspaceId: WS,
    name: "比較表の位置",
    hypothesis: "比較表を上に出すと、最後まで読む人が増えるはず",
    arms: [
      { name: "現行", change: "そのまま" },
      { name: "上に出す", change: "比較表を導入文の直後へ移す" },
    ],
    primaryMetric: "page_views" as const,
    minimumSamples: 200,
  };

  it("比べる案が 1 つでは始められない", () => {
    const r = createExperiment({ ...valid, arms: [valid.arms[0]] });
    expect(r.ok).toBe(false);
  });

  it("2 つあれば始められる", () => {
    expect(createExperiment(valid).ok).toBe(true);
  });

  it("案の名前が同じものは受け付けない（どちらが勝ったか書けなくなる）", () => {
    const r = createExperiment({
      ...valid,
      arms: [
        { name: "現行", change: "そのまま" },
        { name: "現行", change: "実は違う" },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("必要件数は 1 以上の整数だけ", () => {
    for (const minimumSamples of [0, -5, 1.5]) {
      expect(createExperiment({ ...valid, minimumSamples }).ok).toBe(false);
    }
    expect(createExperiment({ ...valid, minimumSamples: 1 }).ok).toBe(true);
  });

  it("定義表に無い指標は選べない", () => {
    // 型が合っていても、画面や外部から来た値は表に無いことがある。
    const r = createExperiment({
      ...valid,
      primaryMetric: "適当な指標" as (typeof valid)["primaryMetric"],
    });
    expect(r.ok).toBe(false);
  });

  it("名前も確かめたいことも、空白だけでは通らない", () => {
    expect(createExperiment({ ...valid, name: "  " }).ok).toBe(false);
    expect(createExperiment({ ...valid, hypothesis: " 　" }).ok).toBe(false);
  });
});

describe("実験を終わらせるときの境目", () => {
  const at = new Date("2026-08-17T00:00:00.000Z");
  function running() {
    const created = createExperiment({
      id: asExperimentId("ex_2"),
      workspaceId: WS,
      name: "見出しの長さ",
      hypothesis: "短くすると読み進めてもらえるはず",
      arms: [
        { name: "現行", change: "そのまま" },
        { name: "短く", change: "見出しを 20 文字以内にする" },
      ],
      primaryMetric: "page_views",
      minimumSamples: 200,
    });
    if (!created.ok) throw new Error("前提の実験が作れませんでした");
    const started = startExperiment(created.value, at);
    if (!started.ok) throw new Error("前提の実験が始められませんでした");
    return { draft: created.value, run: started.value };
  }

  it("準備中でないものは始められない", () => {
    const { run } = running();
    expect(startExperiment(run, at).ok).toBe(false);
  });

  it("実施中でないものは判定できない", () => {
    const { draft } = running();
    expect(concludeExperiment(draft, { samples: 999, winningArm: null, at }).ok).toBe(false);
  });

  it("必要件数の 1 つ手前では終わらせられない", () => {
    const { run } = running();
    const r = concludeExperiment(run, { samples: 199, winningArm: "短く", at });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("199");
  });

  it("必要件数ちょうどなら終わらせられる", () => {
    const { run } = running();
    expect(concludeExperiment(run, { samples: 200, winningArm: "短く", at }).ok).toBe(true);
  });

  it("差が出なかったことも結果として残せる", () => {
    // 勝ちを必ず選ばせると、差が無かった実験にも勝者が付く。
    const { run } = running();
    const r = concludeExperiment(run, { samples: 200, winningArm: null, at });
    expect(r.ok && r.value.winningArm).toBeNull();
  });

  it("実験に無い案を勝ちにはできない", () => {
    const { run } = running();
    expect(concludeExperiment(run, { samples: 200, winningArm: "存在しない案", at }).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 主張の有効期間
// ---------------------------------------------------------------------------

describe("主張が使える期間の境目", () => {
  const from = new Date("2026-08-01T00:00:00.000Z");
  const until = new Date("2026-09-01T00:00:00.000Z");
  const evidence: readonly EvidenceId[] = [asEvidenceId("ev_1")];

  function claim(over: { validUntil?: Date | null } = {}) {
    const r = createClaim({
      id: asClaimId("cl_1"),
      workspaceId: WS,
      statement: "同じ素材の書き出しに 4 分 12 秒かかりました。",
      type: "measured",
      evidenceIds: evidence,
      confidence: 0.9,
      validFrom: from,
      validUntil: over.validUntil === undefined ? until : over.validUntil,
    });
    if (!r.ok) throw new Error("前提の主張が作れませんでした");
    const verified = verifyClaim(r.value, "三輪");
    if (!verified.ok) throw new Error("前提の確認ができませんでした");
    return verified.value;
  }

  it("開始のその瞬間から使える", () => {
    expect(isClaimUsable(claim(), from)).toBe(true);
  });

  it("開始の 1 ミリ秒前は使えない", () => {
    expect(isClaimUsable(claim(), new Date(from.getTime() - 1))).toBe(false);
  });

  it("期限の 1 ミリ秒前までは使える", () => {
    expect(isClaimUsable(claim(), new Date(until.getTime() - 1))).toBe(true);
  });

  it("期限のその瞬間は、もう使えない", () => {
    // ここを「以下」で切るか「未満」で切るかで、期限切れの数字が 1 日出続ける。
    expect(isClaimUsable(claim(), until)).toBe(false);
  });

  it("期限が無い主張は、いつまでも使える", () => {
    expect(isClaimUsable(claim({ validUntil: null }), new Date("2099-01-01"))).toBe(true);
  });

  it("確認していない主張は、期間内でも使えない", () => {
    const r = createClaim({
      id: asClaimId("cl_2"),
      workspaceId: WS,
      statement: "軽いです。",
      type: "measured",
      evidenceIds: evidence,
      confidence: 0.5,
      validFrom: from,
    });
    expect(r.ok && isClaimUsable(r.value, from)).toBe(false);
  });

  it("期限が来た主張は、期限切れの印に移る", () => {
    expect(expireIfDue(claim(), until).verificationStatus).toBe("expired");
    expect(expireIfDue(claim(), new Date(until.getTime() - 1)).verificationStatus).toBe("verified");
  });

  it("期限が開始と同時、または前になっている主張は作れない", () => {
    for (const validUntil of [from, new Date(from.getTime() - 1)]) {
      const r = createClaim({
        id: asClaimId("cl_3"),
        workspaceId: WS,
        statement: "同じ瞬間に切れる主張",
        type: "measured",
        evidenceIds: evidence,
        confidence: 1,
        validFrom: from,
        validUntil,
      });
      expect(r.ok).toBe(false);
    }
  });

  it("確信度は 0.0 と 1.0 を含み、その外側は受け付けない", () => {
    const make = (confidence: number) =>
      createClaim({
        id: asClaimId("cl_4"),
        workspaceId: WS,
        statement: "確信度の境目",
        type: "measured",
        evidenceIds: evidence,
        confidence,
        validFrom: from,
      });
    expect(make(0).ok).toBe(true);
    expect(make(1).ok).toBe(true);
    expect(make(-0.0001).ok).toBe(false);
    expect(make(1.0001).ok).toBe(false);
  });

  it("事実を名乗る主張は、根拠 0 件では作れない", () => {
    for (const type of ["official", "measured", "experience", "external"] as const) {
      const r = createClaim({
        id: asClaimId("cl_5"),
        workspaceId: WS,
        statement: "根拠の無い事実",
        type,
        evidenceIds: [],
        confidence: 1,
        validFrom: from,
      });
      expect(r.ok, `${type} が根拠なしで通ります`).toBe(false);
      if (!r.ok) expect(r.error.code).toBe("EVIDENCE_REQUIRED");
    }
  });

  it("却下済みの主張は確認済みに戻せない", () => {
    const rejected = { ...claim(), verificationStatus: "rejected" as const };
    const r = verifyClaim(rejected, "三輪");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONFLICT");
  });
});

// ---------------------------------------------------------------------------
// 商品の同一性
// ---------------------------------------------------------------------------

describe("同じ商品かどうかの境目", () => {
  it("名前の類似度は、しきい値ちょうどなら同一とみなす", () => {
    const m = matchIdentity([], [], NAME_SIMILARITY_THRESHOLD);
    expect(m.matched).toBe(true);
    expect(m.by).toBe("name_similarity");
  });

  it("しきい値をわずかに下回れば別商品とする", () => {
    // ここを緩めると、読者に別の商品を買わせることになる。
    expect(matchIdentity([], [], NAME_SIMILARITY_THRESHOLD - 0.0001).matched).toBe(false);
  });

  it("強い識別子が食い違うときは、名前がどれだけ似ていても別商品とする", () => {
    const a = [{ kind: "model_number" as const, value: "ALP-15A" }];
    const b = [{ kind: "model_number" as const, value: "ALP-15B" }];
    const m = matchIdentity(a, b, 0.99);
    expect(m.matched).toBe(false);
    expect(m.by).toBe("model_number");
  });

  it("表記のゆれだけの違いは、同じ商品として扱う", () => {
    // 全角・空白・ダッシュの種類が違うだけで別商品にすると、
    // 同じ商品が一覧に 2 回出る。
    const a = [{ kind: "model_number" as const, value: "ＡＬＰ－１５Ａ" }];
    const b = [{ kind: "model_number" as const, value: "alp - 15a" }];
    expect(matchIdentity(a, b).matched).toBe(true);
  });

  it("比べる手がかりが何も無いときは、同一と言わずに理由を返す", () => {
    const m = matchIdentity([], []);
    expect(m.matched).toBe(false);
    expect(m.by).toBeNull();
    expect(m.reason).toContain("JANコード");
  });

  it("JAN コードの桁数は 8 桁と 12〜14 桁だけ", () => {
    const cases: readonly [string, boolean][] = [
      ["1".repeat(7), false],
      ["1".repeat(8), true],
      ["1".repeat(9), false],
      ["1".repeat(11), false],
      ["1".repeat(12), true],
      ["1".repeat(14), true],
      ["1".repeat(15), false],
    ];
    for (const [value, expected] of cases) {
      expect(createIdentityKey("gtin", value).ok, `${value.length} 桁`).toBe(expected);
    }
  });

  it("ASIN は英数字ちょうど 10 桁だけ", () => {
    expect(createIdentityKey("asin", "B01ABCDEF9").ok).toBe(true);
    expect(createIdentityKey("asin", "B01ABCDEF").ok).toBe(false);
    expect(createIdentityKey("asin", "B01ABCDEF90").ok).toBe(false);
  });

  it("空白だけの識別子は登録できない", () => {
    expect(createIdentityKey("model_number", "  　").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 成果と締め処理
// ---------------------------------------------------------------------------

describe("会計期間の境目", () => {
  const base = {
    id: "cv_1" as ConversionId,
    workspaceId: WS,
    programId: asAffiliateProgramId("prg_1"),
    asp: "a8net" as const,
    externalConversionId: "A-001",
    status: "pending" as const,
    occurredAt: new Date("2026-08-10T00:00:00.000Z"),
  };

  it("月は 01〜12 だけを受け付ける", () => {
    const cases: readonly [string, boolean][] = [
      ["2026-00", false],
      ["2026-01", true],
      ["2026-12", true],
      ["2026-13", false],
      ["2026-1", false],
      ["26-01", false],
      ["", false],
    ];
    for (const [period, expected] of cases) {
      expect(createConversion({ ...base, period }).ok, period || "（空）").toBe(expected);
    }
  });

  it("ASP 側の成果 ID が無いものは受け付けない", () => {
    // 無いと、同じ成果を毎回新しい成果として取り込み、報酬が二重に見える。
    const r = createConversion({ ...base, externalConversionId: "  ", period: "2026-08" });
    expect(r.ok).toBe(false);
  });

  it("突合の鍵は、大文字小文字・空白・全角を吸収してから比べる", () => {
    expect(normalizeExternalId(" Ａ-００１ ")).toBe(normalizeExternalId("a-001"));
  });
});

describe("締めた月の取込", () => {
  function conversion(periodClosed: boolean) {
    const r = createConversion({
      id: "cv_2" as ConversionId,
      workspaceId: WS,
      programId: asAffiliateProgramId("prg_1"),
      asp: "a8net",
      externalConversionId: "A-002",
      status: "pending",
      occurredAt: new Date("2026-07-10T00:00:00.000Z"),
      ingestedReward: { amountMinor: 1000, currency: "JPY" },
      period: "2026-07",
    });
    if (!r.ok) throw new Error("前提の成果が作れませんでした");
    return { ...r.value, periodClosed };
  }

  it("締めていない月は、取込値の変更をそのまま反映する", () => {
    const { conversion: next, diffs } = applyIngestedUpdate(conversion(false), {
      status: "approved",
      reward: { amountMinor: 1200, currency: "JPY" },
    });
    expect(next.status).toBe("approved");
    expect(next.ingestedReward?.amountMinor).toBe(1200);
    expect(diffs).toHaveLength(2);
    expect(diffs.every((d) => !d.heldBecauseClosed)).toBe(true);
  });

  it("締めた月は、値を据え置いたうえで差分だけ知らせる", () => {
    // 黙って過去の数字を書き換えると、締めた報告と食い違う。
    const { conversion: next, diffs } = applyIngestedUpdate(conversion(true), {
      status: "approved",
      reward: { amountMinor: 1200, currency: "JPY" },
    });
    expect(next.status).toBe("pending");
    expect(next.ingestedReward?.amountMinor).toBe(1000);
    expect(diffs).toHaveLength(2);
    expect(diffs.every((d) => d.heldBecauseClosed)).toBe(true);
  });

  it("値が変わっていなければ、差分は出ない", () => {
    const { diffs } = applyIngestedUpdate(conversion(false), {
      status: "pending",
      reward: { amountMinor: 1000, currency: "JPY" },
    });
    expect(diffs).toHaveLength(0);
  });

  it("手で直した金額が、取込値より優先される", () => {
    const adjusted = adjustReward(
      conversion(false),
      { amountMinor: 800, currency: "JPY" },
      "広告主からの確定連絡にあわせて修正",
    );
    expect(adjusted.ok).toBe(true);
    if (adjusted.ok) {
      expect(effectiveReward(adjusted.value)?.amountMinor).toBe(800);
      // 取込値は残す。消すと次の取込との差分が出せなくなる。
      expect(adjusted.value.ingestedReward?.amountMinor).toBe(1000);
    }
  });

  it("理由の無い金額修正はできない", () => {
    expect(adjustReward(conversion(false), { amountMinor: 800, currency: "JPY" }, " ").ok).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// 表現ポリシー
// ---------------------------------------------------------------------------

describe("使えない言い方の検出", () => {
  const rule = (over: Partial<Parameters<typeof createPolicyRule>[0]> = {}) => {
    const r = createPolicyRule({
      id: "pr_1" as PolicyRuleId,
      workspaceId: WS,
      name: "薬機法: 治る・効くの断定",
      domainScope: "health_food",
      channelScope: "any",
      severity: "block",
      pattern: "治ります",
      basis: "医薬品医療機器等法 第 66 条",
      suggestion: "「〜と言われています」など、断定を避けた書き方にしてください。",
      ...over,
    });
    if (!r.ok) throw new Error("前提のルールが作れませんでした");
    return r.value;
  };

  it("根拠と代わりの書き方が無いルールは登録できない", () => {
    // 禁止だけ示すと執筆が止まり、理由が書けないルールは運用されなくなる。
    expect(createPolicyRule({ ...rule(), basis: " " }).ok).toBe(false);
    expect(createPolicyRule({ ...rule(), suggestion: " " }).ok).toBe(false);
  });

  it("正規表現として壊れているルールは、登録の時点で止まる", () => {
    expect(createPolicyRule({ ...rule(), pattern: "([" }).ok).toBe(false);
  });

  it("それでも壊れたルールが保存されていたら、黙って飛ばさず名前を返す", () => {
    // 登録より前に保存されたものや、直接書き換えられたものがあり得る。
    // 「検査した」と言いながら実際には見ていない状態が最も危ない。
    const broken = { ...rule(), pattern: "([" };
    const result = checkPolicies([broken], {
      text: "これで治りますよ",
      domainScope: "health_food",
      channelScope: "own_site",
    });
    expect(result.unevaluatedRuleIds).toEqual([broken.id]);
    expect(result.violations).toHaveLength(0);
  });

  it("止める指摘が 1 件でもあれば公開できない", () => {
    const result = checkPolicies([rule()], {
      text: "毎日飲めば治りますので安心です",
      domainScope: "health_food",
      channelScope: "own_site",
    });
    expect(result.violations).toHaveLength(1);
    expect(result.publishable).toBe(false);
    // 前後を含めて示さないと、執筆者が本文のどこか分からない。
    expect(result.violations[0].excerpt).toContain("治ります");
    expect(result.violations[0].excerpt.length).toBeGreaterThan("治ります".length);
  });

  it("注意どまりの指摘だけなら、人が確認したうえで公開できる", () => {
    const result = checkPolicies([rule({ severity: "warn" })], {
      text: "治りますとまでは言えません",
      domainScope: "health_food",
      channelScope: "own_site",
    });
    expect(result.violations).toHaveLength(1);
    expect(result.publishable).toBe(true);
  });

  it("分野の違うルールは当てない", () => {
    // 化粧品のルールが家電記事を止めると、ルール自体が無効化される。
    const result = checkPolicies([rule()], {
      text: "これで治りますよ",
      domainScope: "general",
      channelScope: "own_site",
    });
    expect(result.violations).toHaveLength(0);
    expect(result.publishable).toBe(true);
  });

  it("出力先の違うルールも当てない", () => {
    const result = checkPolicies([rule({ channelScope: "x" })], {
      text: "これで治りますよ",
      domainScope: "health_food",
      channelScope: "own_site",
    });
    expect(result.violations).toHaveLength(0);
  });

  it("止めてあるルールは当てない", () => {
    const result = checkPolicies([{ ...rule(), enabled: false }], {
      text: "これで治りますよ",
      domainScope: "health_food",
      channelScope: "own_site",
    });
    expect(result.violations).toHaveLength(0);
  });

  it("同じ言い方が 2 か所にあれば 2 件として出す", () => {
    // 1 件にまとめると、直したつもりで片方が残る。
    const result = checkPolicies([rule()], {
      text: "治りますし、やはり治りますね",
      domainScope: "health_food",
      channelScope: "own_site",
    });
    expect(result.violations).toHaveLength(2);
  });

  it("本文の先頭で見つかっても、前後の切り出しで落ちない", () => {
    const result = checkPolicies([rule()], {
      text: "治ります",
      domainScope: "health_food",
      channelScope: "own_site",
    });
    expect(result.violations[0].excerpt).toBe("治ります");
  });

  it("指摘が 0 件のときは公開できる", () => {
    const result = checkPolicies([rule()], {
      text: "実測した書き出し時間を載せています。",
      domainScope: "health_food",
      channelScope: "own_site",
    });
    expect(result.violations).toHaveLength(0);
    expect(result.publishable).toBe(true);
  });
});
