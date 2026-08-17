/**
 * @tier 1
 * @req REQ-SEC09
 * @types equivalence, audit-log
 */
import { describe, expect, it } from "vitest";
import {
  REDACTED_PLACEHOLDER,
  createAuditLogEntry,
  redactSensitive,
  wasApprovedByHuman,
  type AuditActor,
  type AuditLogEntry,
} from "@/domain/compliance/audit-log";
import {
  METRIC_DEFINITIONS,
  metricDefinition,
  validateSample,
  type MetricSample,
} from "@/domain/analytics/metrics";
import { MAX_EXCERPT_LENGTH, createEvidence, createTestRun } from "@/domain/evidence/evidence";
import {
  asEvidenceId,
  asProductId,
  asTestRunId,
  asUserId,
  asWorkspaceId,
  taggedString,
} from "@/domain/shared";

/**
 * 記録（根拠・検証・監査）と指標の境界値。
 *
 * ここは「後から説明できるか」を決める層である。
 * 抜粋の長さ、承認の理由、割合の母数——どれも
 * **1 文字・1 件ずれたところで断るかどうか**が実際の争点になる。
 */

const WS = asWorkspaceId("ws_test");

describe("根拠 (Evidence)", () => {
  function evidence(over: Partial<Parameters<typeof createEvidence>[0]> = {}) {
    return createEvidence({
      id: asEvidenceId("ev_1"),
      workspaceId: WS,
      type: "official_source",
      title: "メーカー公式の仕様表",
      sourceOwner: "メーカーA",
      capturedAt: new Date("2026-01-10T00:00:00Z"),
      urlOrAssetId: "https://example.com/spec",
      excerptOrSummary: "重量は 1.2kg と記載",
      licenseOrPermission: "引用の範囲で利用",
      integrityHash: "sha256:dummy",
      ...over,
    });
  }

  it("題名・出所・利用条件がそろっていれば作れる", () => {
    const r = evidence();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.type).toBe("official_source");
  });

  it("題名が空白だけなら断る", () => {
    const r = evidence({ title: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("title");
  });

  it("出所が空なら断る", () => {
    const r = evidence({ sourceOwner: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("sourceOwner");
  });

  it("利用条件が空なら断る（転載可否の分からない素材を登録させない）", () => {
    const r = evidence({ licenseOrPermission: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("licenseOrPermission");
  });

  it("抜粋はちょうど上限までは通り、1 文字超えると断る", () => {
    // 上限そのものを通すかどうかは、実装を読まないと分からない。ここで固定する。
    expect(evidence({ excerptOrSummary: "あ".repeat(MAX_EXCERPT_LENGTH) }).ok).toBe(true);

    const over = evidence({ excerptOrSummary: "あ".repeat(MAX_EXCERPT_LENGTH + 1) });
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.error.field).toBe("excerptOrSummary");
      // 何文字だったかを言う。言わないと直しようがない。
      expect(over.error.message).toContain(String(MAX_EXCERPT_LENGTH + 1));
    }
  });
});

describe("検証記録 (TestRun)", () => {
  function run(over: Partial<Parameters<typeof createTestRun>[0]> = {}) {
    return createTestRun({
      id: asTestRunId("tr_1"),
      workspaceId: WS,
      productId: asProductId("pr_1"),
      methodVersion: "v1.2",
      environment: { 室温: "23度" },
      equipment: ["騒音計"],
      testerIds: ["tester_1"],
      startedAt: new Date("2026-01-10T00:00:00Z"),
      rawResults: { 騒音: 42 },
      normalizedScores: { 静音性: 0.8 },
      evidenceIds: [asEvidenceId("ev_1")],
      ...over,
    });
  }

  it("完了日時を渡さないと null になる（実施中を表せる）", () => {
    const r = run();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.completedAt).toBeNull();
  });

  it("検証者が 0 人なら断る", () => {
    const r = run({ testerIds: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("testerIds");
  });

  it("測定方法のバージョンが空なら断る", () => {
    const r = run({ methodVersion: " " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("methodVersion");
  });

  it("正規化点数は 0.0 と 1.0 を含み、その外は断る", () => {
    expect(run({ normalizedScores: { a: 0, b: 1 } }).ok).toBe(true);
    expect(run({ normalizedScores: { a: -0.01 } }).ok).toBe(false);
    const over = run({ normalizedScores: { 静音性: 1.01 } });
    expect(over.ok).toBe(false);
    // どの項目が外れたかを名指しする。項目が多いほどここが効く。
    if (!over.ok) expect(over.error.message).toContain("静音性");
  });

  it("完了日時が開始と同じなら通り、前なら断る", () => {
    const at = new Date("2026-01-10T00:00:00Z");
    expect(run({ completedAt: at }).ok).toBe(true);
    expect(run({ completedAt: new Date("2026-01-09T23:59:59Z") }).ok).toBe(false);
  });
});

describe("監査ログ", () => {
  const human: AuditActor = { userId: asUserId("u_1"), isAiServiceAccount: false, modelId: null };
  const ai: AuditActor = { userId: null, isAiServiceAccount: true, modelId: "model-x" };

  function entry(over: Partial<Parameters<typeof createAuditLogEntry>[0]> = {}) {
    return createAuditLogEntry({
      id: taggedString<"AuditLogId">("al_1"),
      workspaceId: WS,
      action: "content.published",
      actor: human,
      targetType: "content_package",
      targetId: "cp_1",
      occurredAt: new Date("2026-01-10T00:00:00Z"),
      ...over,
    });
  }

  it("対象の種類か ID が空なら断る", () => {
    expect(entry({ targetType: " " }).ok).toBe(false);
    expect(entry({ targetId: "" }).ok).toBe(false);
  });

  it("人でも AI でもない匿名の操作は記録できない", () => {
    const r = entry({ actor: { userId: null, isAiServiceAccount: false, modelId: null } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("actor");
  });

  it("AI の操作は主体が特定できるので記録できる", () => {
    const r = entry({ actor: ai, action: "content.created" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.actor.modelId).toBe("model-x");
  });

  it("承認・取り下げ・訂正は理由がないと記録できない", () => {
    for (const action of ["content.approved", "content.unpublished", "content.corrected"] as const) {
      expect(entry({ action, reason: "  " }).ok, action).toBe(false);
      expect(entry({ action, reason: "確認済み" }).ok, action).toBe(true);
    }
  });

  it("理由が不要な操作では、空の理由が null として残る", () => {
    const r = entry({ action: "content.published" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.reason).toBeNull();
  });

  it("差分に紛れた秘密情報は、記録される前に落ちる", () => {
    const r = entry({
      action: "connector.connected",
      before: null,
      after: {
        apiKey: "本物らしい値",
        access_token: "本物らしい値",
        Cookie: "本物らしい値",
        merchantName: "店A",
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.after?.apiKey).toBe(REDACTED_PLACEHOLDER);
    expect(r.value.after?.access_token).toBe(REDACTED_PLACEHOLDER);
    expect(r.value.after?.Cookie).toBe(REDACTED_PLACEHOLDER);
    // 秘密でないものまで消さない。消しすぎると監査ログの用が足りない。
    expect(r.value.after?.merchantName).toBe("店A");
    expect(r.value.before).toBeNull();
  });

  it("差分そのものが無いときは null のまま扱える", () => {
    expect(redactSensitive(null)).toBeNull();
  });

  it("人の承認だけを「承認済み」と数える", () => {
    const make = (over: Parameters<typeof createAuditLogEntry>[0]) => {
      const r = createAuditLogEntry(over);
      if (!r.ok) throw new Error(r.error.message);
      return r.value;
    };
    const base = {
      workspaceId: WS,
      targetType: "content_package",
      occurredAt: new Date("2026-01-10T00:00:00Z"),
    };
    const entries: readonly AuditLogEntry[] = [
      make({ ...base, id: taggedString<"AuditLogId">("a"), action: "content.approved", actor: ai, targetId: "cp_ai", reason: "自動" }),
      make({ ...base, id: taggedString<"AuditLogId">("b"), action: "content.published", actor: human, targetId: "cp_human" }),
      make({ ...base, id: taggedString<"AuditLogId">("c"), action: "content.approved", actor: human, targetId: "cp_human", reason: "内容を確認した" }),
    ];

    expect(wasApprovedByHuman(entries, "cp_human")).toBe(true);
    // AI が承認しても「人が承認した」にはならない。ここが緩むと §26 の意味が消える。
    expect(wasApprovedByHuman(entries, "cp_ai")).toBe(false);
    expect(wasApprovedByHuman(entries, "cp_unknown")).toBe(false);
  });
});

describe("指標の定義と集計値", () => {
  it("収益系の指標は編集判断に使えない", () => {
    const commercial = METRIC_DEFINITIONS.filter((d) => d.category === "commercial");
    expect(commercial.length).toBeGreaterThan(0);
    for (const d of commercial) {
      expect(d.usableForEditorialJudgement, d.key).toBe(false);
    }
    // 逆に、収益以外は使える。両方を固定しないと片側だけ壊れても気づけない。
    for (const d of METRIC_DEFINITIONS.filter((d) => d.category !== "commercial")) {
      expect(d.usableForEditorialJudgement, d.key).toBe(true);
    }
  });

  it("すべての指標に、どう数えるかが書いてある", () => {
    for (const d of METRIC_DEFINITIONS) {
      expect(d.howCounted.length, d.key).toBeGreaterThan(0);
      expect(metricDefinition(d.key)).toEqual(d);
    }
  });

  it("定義表にない指標を引くと落ちる（黙って undefined を返さない）", () => {
    // 型では防げても、外から来た文字列は防げない。
    expect(() => metricDefinition("no_such_metric" as never)).toThrow(/指標の定義がありません/);
  });

  function sample(over: Partial<MetricSample> = {}): MetricSample {
    return {
      key: "read_completion_rate",
      value: 0.5,
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-01-08T00:00:00Z"),
      denominator: 1000,
      ...over,
    };
  }

  it("集計期間の終わりが始まりと同じ、または前なら断る", () => {
    const same = new Date("2026-01-01T00:00:00Z");
    expect(validateSample(sample({ from: same, to: same })).ok).toBe(false);
    expect(validateSample(sample({ to: new Date("2025-12-31T00:00:00Z") })).ok).toBe(false);
    expect(validateSample(sample()).ok).toBe(true);
  });

  it("割合の指標は 0 と 1 を含み、その外は断る", () => {
    expect(validateSample(sample({ value: 0 })).ok).toBe(true);
    expect(validateSample(sample({ value: 1 })).ok).toBe(true);
    expect(validateSample(sample({ value: -0.001 })).ok).toBe(false);
    const over = validateSample(sample({ value: 1.001 }));
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.field).toBe("value");
  });

  it("割合の指標は母数が無い、または 0 なら断る", () => {
    // 「10 件中 6 件」と「1000 件中 600 件」は同じ 0.6 でも判断が変わる。
    expect(validateSample(sample({ denominator: null })).ok).toBe(false);
    expect(validateSample(sample({ denominator: 0 })).ok).toBe(false);
    expect(validateSample(sample({ denominator: 1 })).ok).toBe(true);
  });

  it("割合でない指標には母数を求めない", () => {
    const r = validateSample(sample({ key: "page_views", value: 12345, denominator: null }));
    expect(r.ok).toBe(true);
  });

  it("_ratio で終わる指標も割合として扱う", () => {
    // `_rate` だけを見ていると、`stale_price_ratio` がすり抜ける。
    expect(validateSample(sample({ key: "stale_price_ratio", value: 1.5 })).ok).toBe(false);
    expect(validateSample(sample({ key: "stale_price_ratio", value: 0.2 })).ok).toBe(true);
  });
});
