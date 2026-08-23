/**
 * @tier 1
 * @req REQ-E01, REQ-E31, REQ-E32
 * @types equivalence, decision-table
 */
import { describe, expect, it } from "vitest";
import {
  type AuditAction,
  checkPolicies,
  createAuditLogEntry,
  createPolicyRule,
  type PolicyChannelScope,
  type PolicyDomainScope,
  type PolicySeverity,
} from "@/domain/compliance";
import { checkCapacity, createWorkspace, type WorkspacePlan } from "@/domain/identity";
import { asPolicyRuleId, asUserId, asWorkspaceId } from "@/domain/shared/ids";
import { taggedString } from "@/domain/shared/tagged";

/**
 * 決まった語彙から選ぶ 3 つ（E01 プランの上限 / E31 ポリシーの当たる範囲 /
 * E32 監査ログで理由が要る操作）を、**語彙の全件 × 条件**で当てる。
 *
 * 期待する一覧は、いずれもこのファイル側に書き写してある。
 * 実装の `PLAN_LIMITS` / `POLICY_DOMAIN_SCOPES` / `REASON_REQUIRED` を
 * 読み込んで回すと、一覧から 1 件消えたときに短くなった一覧を回して
 * 緑を返す（`docs/product/backlog.md` 項目 78 の 5 つ目）。
 */

const WS = asWorkspaceId("ws-1");
const NOW = new Date("2026-08-19T00:00:00Z");

// ── E01: プラン × 数える対象 ───────────────────────────
/** プランごとの上限。**実装から読まず、ここに書き写して固定する。** */
const EXPECTED_LIMITS: Readonly<
  Record<WorkspacePlan, Readonly<Record<"brand" | "site" | "member" | "generation", number>>>
> = {
  solo: { brand: 1, site: 3, member: 1, generation: 200 },
  team: { brand: 5, site: 20, member: 10, generation: 2000 },
  business: { brand: 50, site: 200, member: 100, generation: 20000 },
};

describe("Workspace（E01）: プラン 3 種 × 数える対象 4 種の 12 通り", () => {
  const ws = (plan: WorkspacePlan) => {
    const r = createWorkspace({
      id: WS,
      name: "動画編集の道具",
      plan,
      ownerUserId: asUserId("u-1"),
      createdAt: NOW,
    });
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  };

  it("12 通りすべてで、上限の 1 つ手前まで通り、上限で断る", () => {
    let cells = 0;
    for (const plan of ["solo", "team", "business"] as const) {
      for (const kind of ["brand", "site", "member", "generation"] as const) {
        const max = EXPECTED_LIMITS[plan][kind];
        expect(checkCapacity(ws(plan), kind, max - 1).ok, `${plan}/${kind} 手前`).toBe(true);
        expect(checkCapacity(ws(plan), kind, max).ok, `${plan}/${kind} 上限`).toBe(false);
        cells += 1;
      }
    }
    expect(cells).toBe(12);
  });

  it("断り文には、超えた対象の名前と上限の数が入る", () => {
    const r = checkCapacity(ws("solo"), "brand", 1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("ブランド");
    expect(r.error.message).toContain("1");
  });
});

// ── E31: 分野 × 出力先 ─────────────────────────────────
/** 分野の語彙。**実装から読まず、ここに書き写して固定する。** */
const EXPECTED_DOMAIN_SCOPES: readonly PolicyDomainScope[] = [
  "general",
  "health_food",
  "cosmetics",
  "medical",
  "finance",
  "gambling",
  "alcohol",
  "children",
];

/** 出力先の語彙。同上。 */
const EXPECTED_CHANNEL_SCOPES: readonly PolicyChannelScope[] = [
  "any",
  "own_site",
  "x",
  "instagram",
  "youtube",
  "tiktok",
  "threads",
  "facebook",
  "note",
  "newsletter",
  "wordpress",
  "bluesky",
];

describe("PolicyRule（E31）: 語彙にある値だけを受け取る", () => {
  const base = {
    id: asPolicyRuleId("pr-1"),
    workspaceId: WS,
    name: "最上級の表現",
    domainScope: "general" as PolicyDomainScope,
    channelScope: "any" as PolicyChannelScope,
    severity: "block" as PolicySeverity,
    pattern: "日本一",
    basis: "景品表示法 第5条",
    suggestion: "根拠のある範囲で書く",
  };

  /* 以下 4 件は、いずれも消しても誰も気づかなかった側である（2026-08-19 の実測）。 */
  it("分野の語彙 8 件はすべて通り、語彙の外は断る", () => {
    for (const domainScope of EXPECTED_DOMAIN_SCOPES) {
      expect(createPolicyRule({ ...base, domainScope }).ok, domainScope).toBe(true);
    }
    expect(EXPECTED_DOMAIN_SCOPES).toHaveLength(8);
    for (const bad of ["Health_Food", "健康食品", "supplement", ""]) {
      const r = createPolicyRule({ ...base, domainScope: bad as PolicyDomainScope });
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.error.field).toBe("domainScope");
    }
  });

  it("出力先の語彙 12 件はすべて通り、語彙の外は断る", () => {
    for (const channelScope of EXPECTED_CHANNEL_SCOPES) {
      expect(createPolicyRule({ ...base, channelScope }).ok, channelScope).toBe(true);
    }
    expect(EXPECTED_CHANNEL_SCOPES).toHaveLength(12);
    for (const bad of ["twitter", "X", "Facebook", ""]) {
      const r = createPolicyRule({ ...base, channelScope: bad as PolicyChannelScope });
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.error.field).toBe("channelScope");
    }
  });

  it("ルール名と検出する表現は、空なら断る", () => {
    for (const blank of ["", " ", "　"]) {
      const noName = createPolicyRule({ ...base, name: blank });
      expect(noName.ok).toBe(false);
      if (!noName.ok) expect(noName.error.field).toBe("name");
      const noPattern = createPolicyRule({ ...base, pattern: blank });
      expect(noPattern.ok).toBe(false);
      if (!noPattern.ok) expect(noPattern.error.field).toBe("pattern");
    }
  });

  it("根拠と代わりの書き方も、空なら断る", () => {
    for (const blank of ["", " ", "　"]) {
      expect(createPolicyRule({ ...base, basis: blank }).ok).toBe(false);
      expect(createPolicyRule({ ...base, suggestion: blank }).ok).toBe(false);
    }
  });

  it("正規表現として壊れているものは、登録の時点で断る", () => {
    expect(createPolicyRule({ ...base, pattern: "([" }).ok).toBe(false);
  });

  /*
   * 当たる／当たらないの表。分野が一致するか general、かつ
   * 出力先が一致するか any のときだけ当たる。4 通りを全部通す。
   */
  it("分野と出力先の 4 通りの組み合わせで、当たる 1 通りだけが違反になる", () => {
    const rule = (domainScope: PolicyDomainScope, channelScope: PolicyChannelScope) => {
      const r = createPolicyRule({ ...base, domainScope, channelScope });
      if (!r.ok) throw new Error(r.error.message);
      return r.value;
    };
    const target = { text: "日本一の性能", domainScope: "cosmetics" as const, channelScope: "x" as const };

    expect(checkPolicies([rule("cosmetics", "x")], target).violations).toHaveLength(1);
    expect(checkPolicies([rule("general", "any")], target).violations).toHaveLength(1);
    expect(checkPolicies([rule("medical", "x")], target).violations).toHaveLength(0);
    expect(checkPolicies([rule("cosmetics", "note")], target).violations).toHaveLength(0);
  });

  it("重さ 3 種のうち、公開を止めるのは block だけ", () => {
    const withSeverity = (severity: PolicySeverity) => {
      const r = createPolicyRule({ ...base, severity });
      if (!r.ok) throw new Error(r.error.message);
      return r.value;
    };
    const target = { text: "日本一の性能", domainScope: "general" as const, channelScope: "any" as const };
    expect(checkPolicies([withSeverity("block")], target).publishable).toBe(false);
    expect(checkPolicies([withSeverity("warn")], target).publishable).toBe(true);
    expect(checkPolicies([withSeverity("info")], target).publishable).toBe(true);
  });
});

// ── E32: 操作 × 理由の要否 ─────────────────────────────
/** 監査ログに残す操作の全一覧。**実装から読まず、ここに書き写して固定する。** */
const EXPECTED_ACTIONS: readonly AuditAction[] = [
  "content.created",
  "content.state_changed",
  "content.approved",
  "content.published",
  "content.unpublished",
  "content.corrected",
  "ranking_model.changed",
  "disclosure.changed",
  "policy_rule.changed",
  "affiliate_link.created",
  "affiliate_link.changed",
  "affiliate_link.rejected",
  "connector.connected",
  "connector.disconnected",
  "member.role_changed",
  "export.performed",
  "publication.schedule_changed",
  "integration_key.issued",
  "integration_key.revoked",
  "site.created",
  "site_draft.started",
  "site_draft.step_saved",
  "conversion.adjusted",
  "llm_credential.registered",
  "llm_credential.revoked",
  "feedback.submitted",
  "feedback.status_changed",
  "feedback.handed_off",
  "variant_spec.drafted",
  "variant_spec.approved",
  "loop_run.started",
  "loop_run.observed",
  "loop_run.concluded",
  "loop_run.stopped",
];

/** そのうち、理由が無いと記録できないもの。同上。 */
const EXPECTED_REASON_REQUIRED: readonly AuditAction[] = [
  "content.approved",
  "content.unpublished",
  "content.corrected",
  "ranking_model.changed",
  "disclosure.changed",
  "member.role_changed",
  "conversion.adjusted",
  "affiliate_link.rejected",
  "loop_run.stopped",
];

describe("AuditLog（E32）: 操作 34 種 × 理由の要否", () => {
  const human = {
    userId: asUserId("u-1"),
    isAiServiceAccount: false,
    modelId: null,
    identified: true,
  };
  const entry = (action: AuditAction, reason?: string | null) =>
    createAuditLogEntry({
      id: taggedString<"AuditLogId">("al-1"),
      workspaceId: WS,
      action,
      actor: human,
      targetType: "content_package",
      targetId: "cp-1",
      reason,
      occurredAt: NOW,
    });

  it("34 種すべてについて、理由が要る 9 種だけが理由なしで断られる", () => {
    for (const action of EXPECTED_ACTIONS) {
      const required = EXPECTED_REASON_REQUIRED.includes(action);
      expect(entry(action).ok, `${action} 理由なし`).toBe(!required);
      expect(entry(action, "編集長の判断").ok, `${action} 理由あり`).toBe(true);
    }
    expect(EXPECTED_ACTIONS).toHaveLength(34);
    expect(EXPECTED_REASON_REQUIRED).toHaveLength(9);
  });

  it("空白だけの理由は、書いていないものとして扱う", () => {
    for (const blank of ["", " ", "　"]) {
      expect(entry("content.approved", blank).ok).toBe(false);
      // 理由の要らない操作では、空白でも通る（欄が空のまま残る）。
      expect(entry("content.created", blank).ok).toBe(true);
    }
  });
});
