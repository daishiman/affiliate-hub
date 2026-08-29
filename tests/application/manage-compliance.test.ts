/** @tier 1 @req REQ-SEC06, REQ-SEC07, REQ-SEC09, REQ-QC09, REQ-QC11 @types decision-table, audit-log, permission-matrix */
import { describe, expect, it } from "vitest";
import {
  type ManageComplianceDeps,
  createEditDisclosureUseCase,
  createEditPolicyRuleUseCase,
  createListPolicyRulesUseCase,
} from "@/application/usecases/compliance/manage-compliance";
import type { DisclosureRepositoryPort, PolicyRuleRepositoryPort } from "@/application/ports/compliance";
import type { Disclosure, PolicyRule } from "@/domain/compliance";
import { buildSeedPolicyRules } from "@/domain/compliance";
import type { WorkspaceId } from "@/domain/shared";
import { ok } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { anAiAccount, anAnalyst, anOwner } from "../support/actors";
import { failing, recordingAuditLog } from "../support/doubles";

/**
 * 広告表記と表記のきまりを**変える**口。
 *
 * --- ここで固定したいこと ---
 * 仕様 §26 は「広告表記・ランキング基準の変更」を必ず記録すると定めている。
 * この口ができるまで、その記録は**語だけがあって出す場所が無かった**。
 * だから見るのは「変えられること」よりも、**変えたことが必ず残ること**である。
 *
 * 1. 記録が書けなければ、操作を成功として返さない（fail-closed）
 * 2. 変更前が記録に残る（前が無い記録は「いつからその表記だったか」に答えられない）
 * 3. AI は変えられない（検出される側が検出の条件を変えられる形にしない）
 * 4. 語彙にない分野・出力先・強さは断る（どの記事にも当たらないきまりを作らせない）
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2 / docs/product/traceability.md REQ-SEC07 / REQ-SEC09
 */

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const owner = anOwner({ workspaceId: WS });
const analyst = anAnalyst({ workspaceId: WS });
const aiAccount = anAiAccount({ workspaceId: WS });

/** 覚えていられる広告表記の置き場。見本は保存を断るので、変更そのものを見られない。 */
function memoryDisclosures(seed: readonly Disclosure[] = []): DisclosureRepositoryPort & {
  readonly all: () => readonly Disclosure[];
} {
  const rows = new Map<string, Disclosure>(seed.map((d) => [String(d.id), d]));
  return {
    all: () => [...rows.values()],
    findById: async (_ws, id) => ok(rows.get(String(id)) ?? null),
    list: async (_ws, page) => ok({ items: [...rows.values()].slice(0, page.limit), nextCursor: null }),
    save: async (d) => {
      rows.set(String(d.id), d);
      return ok(d);
    },
  };
}

/** 覚えていられるきまりの置き場。初期ルールに、保存した分を重ねる（D1 版と同じ形）。 */
function memoryPolicyRules(): PolicyRuleRepositoryPort & { readonly saved: () => readonly PolicyRule[] } {
  const seeded = buildSeedPolicyRules(WS);
  if (!seeded.ok) throw new Error("初期ルールを組み立てられませんでした");
  const stored = new Map<string, PolicyRule>();
  const effective = (): readonly PolicyRule[] => [
    ...stored.values(),
    ...seeded.value.filter((r) => !stored.has(String(r.id))),
  ];
  return {
    saved: () => [...stored.values()],
    findById: async (_ws, id) => ok(effective().find((r) => String(r.id) === String(id)) ?? null),
    listEnabled: async () => ok(effective().filter((r) => r.enabled)),
    save: async (r) => {
      stored.set(String(r.id), r);
      return ok(r);
    },
  };
}

function deps(over: Partial<ManageComplianceDeps> = {}): ManageComplianceDeps {
  let n = 0;
  return {
    disclosures: memoryDisclosures(),
    policyRules: memoryPolicyRules(),
    auditLog: recordingAuditLog().port,
    ids: { newId: () => `test${++n}` },
    now: () => new Date("2026-08-24T00:00:00Z"),
    ...over,
  };
}

describe("広告表記を変える", () => {
  it("変えたことが操作の記録に残る（disclosure.changed）", async () => {
    const audit = recordingAuditLog();
    const uc = createEditDisclosureUseCase(deps({ auditLog: audit.port }));

    const result = await uc.execute(owner, {
      relationshipType: "sponsored",
      advertiserOrSupplier: "見本商事",
      editorialInfluence: "limited",
      aiAssisted: true,
      reason: "スポンサー記事の掲載を始めたため。",
    });

    expect(result.ok).toBe(true);
    expect(audit.actions()).toEqual(["disclosure.changed"]);
    const entry = audit.entries()[0];
    expect(entry?.targetType).toBe("disclosure");
    expect(entry?.reason).toBe("スポンサー記事の掲載を始めたため。");
    // **読者に出る文が記録に入る。** 何が読者へ出ることになったかが記録の要点。
    expect(String(entry?.after?.visibleMessage)).toContain("スポンサー");
  });

  it("読者に出る文は画面から受け取らず、domain が組み立てたものを返す", async () => {
    const uc = createEditDisclosureUseCase(deps());
    const result = await uc.execute(owner, {
      relationshipType: "affiliate",
      editorialInfluence: "none",
      aiAssisted: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.visibleMessage).toBe(
      "アフィリエイト広告を利用しています。評価内容に広告主は関与していません。",
    );
  });

  it("直したときは、変更前も記録に残る", async () => {
    const audit = recordingAuditLog();
    const store = memoryDisclosures();
    const uc = createEditDisclosureUseCase(deps({ auditLog: audit.port, disclosures: store }));

    const first = await uc.execute(owner, {
      relationshipType: "affiliate",
      editorialInfluence: "none",
      aiAssisted: false,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await uc.execute(owner, {
      disclosureId: first.value.disclosureId,
      relationshipType: "affiliate",
      editorialInfluence: "none",
      aiAssisted: true,
      reason: "本文の作成に AI を使い始めたため。",
    });
    expect(second.ok).toBe(true);

    const last = audit.entries()[1];
    expect(last?.before).not.toBeNull();
    expect(last?.before?.aiAssisted).toBe(false);
    expect(last?.after?.aiAssisted).toBe(true);
  });

  it("理由を書かなくても記録は残る（既定の理由で埋める）", async () => {
    // `disclosure.changed` は理由が必須の操作。空のまま渡すと
    // **保存は済んでいるのに操作全体が失敗**する。そこを塞いであること。
    const audit = recordingAuditLog();
    const uc = createEditDisclosureUseCase(deps({ auditLog: audit.port }));
    const result = await uc.execute(owner, {
      relationshipType: "affiliate",
      editorialInfluence: "none",
      aiAssisted: false,
      reason: "   ",
    });
    expect(result.ok).toBe(true);
    expect(audit.entries()[0]?.reason).toBe("広告表記を登録した");
  });

  it("記録が書けなければ、操作を成功として返さない", async () => {
    const store = memoryDisclosures();
    const uc = createEditDisclosureUseCase(
      deps({
        disclosures: store,
        auditLog: { ...recordingAuditLog().port, append: async () => failing() },
      }),
    );
    const result = await uc.execute(owner, {
      relationshipType: "affiliate",
      editorialInfluence: "none",
      aiAssisted: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 保存そのものは済んでいる。**済んだことと残っていることを両方書く。**
    expect(result.error.message).toContain("保存されています");
    expect(result.error.message).toContain("記録");
    expect(store.all()).toHaveLength(1);
  });

  it("AI は広告表記を変えられない", async () => {
    const uc = createEditDisclosureUseCase(deps());
    const result = await uc.execute(aiAccount, {
      relationshipType: "affiliate",
      editorialInfluence: "none",
      aiAssisted: false,
    });
    expect(result.ok).toBe(false);
  });

  it("見つからない ID を直そうとしたら断る（黙って新しく作らない）", async () => {
    const uc = createEditDisclosureUseCase(deps());
    const result = await uc.execute(owner, {
      disclosureId: "dc_nothing",
      relationshipType: "affiliate",
      editorialInfluence: "none",
      aiAssisted: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });
});

describe("表記のきまりを変える", () => {
  it("足したことが操作の記録に残る（policy_rule.changed）", async () => {
    const audit = recordingAuditLog();
    const rules = memoryPolicyRules();
    const uc = createEditPolicyRuleUseCase(deps({ auditLog: audit.port, policyRules: rules }));

    const result = await uc.execute(owner, {
      action: "save",
      name: "自社: 最上級の言い切り",
      domainScope: "general",
      channelScope: "any",
      severity: "warn",
      pattern: "日本一|世界一",
      basis: "景品表示法 第5条（優良誤認）",
      suggestion: "根拠のある比較の範囲を書く（例: 当社調べ・2026 年 8 月時点）",
      reason: "社内の指摘が続いたため。",
    });

    expect(result.ok).toBe(true);
    expect(audit.actions()).toEqual(["policy_rule.changed"]);
    expect(audit.entries()[0]?.before).toBeNull();
    expect(audit.entries()[0]?.after?.name).toBe("自社: 最上級の言い切り");
    expect(rules.saved()).toHaveLength(1);
  });

  it("初期ルールを止められる。止めたことは前後つきで記録に残る", async () => {
    const audit = recordingAuditLog();
    const rules = memoryPolicyRules();
    const list = createListPolicyRulesUseCase({ policyRules: rules });
    const uc = createEditPolicyRuleUseCase(deps({ auditLog: audit.port, policyRules: rules }));

    const before = await list.execute(analyst, {});
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const target = before.value.rows[0];
    expect(target).toBeDefined();
    if (target === undefined) return;

    const stopped = await uc.execute(owner, {
      action: "set_enabled",
      ruleId: target.ruleId,
      enabled: false,
      reason: "この表現は自社の分野では当たらないため。",
    });
    expect(stopped.ok).toBe(true);
    expect(audit.entries()[0]?.before?.enabled).toBe(true);
    expect(audit.entries()[0]?.after?.enabled).toBe(false);

    const after = await list.execute(analyst, {});
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    // 止めたきまりは一覧から消える（＝もう記事に当たらない）。
    expect(after.value.rows.map((r) => r.ruleId)).not.toContain(target.ruleId);
    expect(after.value.rows).toHaveLength(before.value.rows.length - 1);
  });

  it("止めたときに「すでに承認された記事は確認し直されない」ことを画面へ伝える", async () => {
    const rules = memoryPolicyRules();
    const list = createListPolicyRulesUseCase({ policyRules: rules });
    const uc = createEditPolicyRuleUseCase(deps({ policyRules: rules }));
    const listed = await list.execute(analyst, {});
    if (!listed.ok) return;
    const target = listed.value.rows[0];
    if (target === undefined) return;

    const result = await uc.execute(owner, {
      action: "set_enabled",
      ruleId: target.ruleId,
      enabled: false,
      reason: "分野外のため。",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.message).toContain("すでに承認された記事は確認し直されません");
  });

  it("変わらない保存は、記録を増やさない", async () => {
    const audit = recordingAuditLog();
    const rules = memoryPolicyRules();
    const list = createListPolicyRulesUseCase({ policyRules: rules });
    const uc = createEditPolicyRuleUseCase(deps({ auditLog: audit.port, policyRules: rules }));
    const listed = await list.execute(analyst, {});
    if (!listed.ok) return;
    const target = listed.value.rows[0];
    if (target === undefined) return;

    // 既に効いているものを「効かせる」。押した回数だけ行が積み上がると、
    // 一覧から「実際に何が変わった日か」を読めなくなる。
    const result = await uc.execute(owner, {
      action: "set_enabled",
      ruleId: target.ruleId,
      enabled: true,
    });
    expect(result.ok).toBe(true);
    expect(audit.entries()).toHaveLength(0);
  });

  it("語彙にない分野・出力先・強さは断る", async () => {
    const uc = createEditPolicyRuleUseCase(deps());
    const base = {
      action: "save" as const,
      name: "試し",
      domainScope: "general",
      channelScope: "any",
      severity: "warn",
      pattern: "だめ",
      basis: "社内規程",
      suggestion: "別の言い方にする",
    };
    for (const [field, patch] of [
      ["domainScope", { domainScope: "健康食品" }],
      ["channelScope", { channelScope: "mixi" }],
      ["severity", { severity: "danger" }],
    ] as const) {
      const result = await uc.execute(owner, { ...base, ...patch });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.field).toBe(field);
    }
  });

  it("根拠も代わりの書き方も無いきまりは登録できない", async () => {
    const uc = createEditPolicyRuleUseCase(deps());
    const result = await uc.execute(owner, {
      action: "save",
      name: "根拠なし",
      domainScope: "general",
      channelScope: "any",
      severity: "block",
      pattern: "だめ",
      basis: "  ",
      suggestion: "別の言い方にする",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("basis");
  });

  it("記録が書けなければ、操作を成功として返さない", async () => {
    const rules = memoryPolicyRules();
    const uc = createEditPolicyRuleUseCase(
      deps({
        policyRules: rules,
        auditLog: { ...recordingAuditLog().port, append: async () => failing() },
      }),
    );
    const result = await uc.execute(owner, {
      action: "save",
      name: "自社: 最上級の言い切り",
      domainScope: "general",
      channelScope: "any",
      severity: "warn",
      pattern: "日本一",
      basis: "景品表示法 第5条",
      suggestion: "比較の範囲を書く",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("記録");
    expect(rules.saved()).toHaveLength(1);
  });

  it("AI は表記のきまりを変えられない（検出される側が条件を変えられない）", async () => {
    const uc = createEditPolicyRuleUseCase(deps());
    const result = await uc.execute(aiAccount, {
      action: "save",
      name: "AI が足そうとするきまり",
      domainScope: "general",
      channelScope: "any",
      severity: "info",
      pattern: "なんでも",
      basis: "なし",
      suggestion: "なし",
    });
    expect(result.ok).toBe(false);
  });

  it("読み取りだけの役割は一覧を読めるが、変えられない", async () => {
    const rules = memoryPolicyRules();
    const list = await createListPolicyRulesUseCase({ policyRules: rules }).execute(analyst, {});
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value.rows.length).toBeGreaterThan(0);

    const uc = createEditPolicyRuleUseCase(deps({ policyRules: rules }));
    const result = await uc.execute(analyst, {
      action: "set_enabled",
      ruleId: list.value.rows[0]?.ruleId ?? "",
      enabled: false,
      reason: "分野外のため。",
    });
    expect(result.ok).toBe(false);
  });

  it("効いているきまりが 0 件のときは「これから」ではなく「確認されていない」と伝える", async () => {
    const empty: PolicyRuleRepositoryPort = {
      findById: async () => ok(null),
      listEnabled: async () => ok([]),
      save: async (r) => ok(r),
    };
    const result = await createListPolicyRulesUseCase({ policyRules: empty }).execute(analyst, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.emptyReason).toContain("何も確認されません");
  });
});
