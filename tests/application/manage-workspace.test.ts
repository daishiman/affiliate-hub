/** @tier 1 */
import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_LABEL,
  CAPABILITY_LABEL,
  RELATIONSHIP_SHORT_LABEL,
  ROLE_LABEL,
  type ManageWorkspaceDeps,
  createGetSettingsOverviewUseCase,
  createListAuditLogUseCase,
  createListBrandsUseCase,
  createListDisclosuresUseCase,
  createListMembersUseCase,
  createListRolesUseCase,
} from "@/application/usecases/identity/manage-workspace";
import {
  DEFAULT_CTA,
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  HUMAN_ONLY_CAPABILITIES,
} from "@/domain/identity";
import { ok } from "@/domain/shared";
import { aNobody, anAnalyst, anOwner, aWriter } from "../support/actors";
import { aBrand, aDisclosure, aMembership, aWorkspace } from "../support/factories";
import { NOW, daysFrom } from "../support/clock";
import { failing, testDeps } from "../support/doubles";

/**
 * 設定（作業場所・担当者・ブランド・広告表記・操作の記録）。
 *
 * --- ここで固定したいこと ---
 * この画面の役目は「**誰が何をできるか**を、実際の判定と同じ内容で見せる」こと。
 * 画面に並べ直した一覧は必ず古くなり、
 * 「できると書いてあるのにできない」という最も問い合わせの多い壊れ方になる。
 * だから、出てくる一覧が domain の権限表から作られていることを確かめる。
 *
 * もうひとつは **機械には渡さない操作**が、機械の欄に出ないこと。
 * ここが緩むと、承認を AI に通させる設定が画面から作れてしまう。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2 / 仕様書 §5・§20
 */

const owner = anOwner();

function deps(over: Partial<ManageWorkspaceDeps> = {}): ManageWorkspaceDeps {
  const base = testDeps();
  return {
    workspaces: base.workspaces,
    memberships: base.memberships,
    brands: base.brands,
    disclosures: base.disclosures,
    auditLog: base.auditLog,
    ...over,
  };
}

function portOf<K extends keyof ManageWorkspaceDeps>(
  key: K,
  over: Record<string, unknown>,
): ManageWorkspaceDeps[K] {
  const base = testDeps() as unknown as Record<string, object>;
  return { ...base[key], ...over } as ManageWorkspaceDeps[K];
}

describe("設定の概要", () => {
  function withWorkspace(
    workspace: unknown,
    counts: { brands?: number; sites?: number; members?: number } = {},
  ): Partial<ManageWorkspaceDeps> {
    return {
      workspaces: portOf("workspaces", {
        findById: async () => ok(workspace),
        countBrands: async () => ok(counts.brands ?? 1),
        countSites: async () => ok(counts.sites ?? 1),
        countMembers: async () => ok(counts.members ?? 1),
      }),
    };
  }

  async function overview(over: Partial<ManageWorkspaceDeps>, actor = owner) {
    return createGetSettingsOverviewUseCase(deps(over)).execute(actor, {});
  }

  it("契約の種類を、識別子ではなく日本語で出す", async () => {
    const got = await overview(withWorkspace(aWorkspace({ plan: "solo" })));
    if (!got.ok) throw got.error;

    expect(got.value.planLabel).toBe("ひとり用");
    expect(got.value.workspaceName).toBe("テスト編集部");
    expect(got.value.timezone).toBe("Asia/Tokyo");
    expect(got.value.currency).toBe("JPY");
  });

  it("使っている数と上限を、3 つとも出す", async () => {
    const got = await overview(
      withWorkspace(aWorkspace({ plan: "team" }), { brands: 2, sites: 4, members: 3 }),
    );
    if (!got.ok) throw got.error;

    expect(got.value.capacities.map((c) => c.label)).toEqual(["ブランド", "ブログ", "担当者"]);
    expect(got.value.capacities.map((c) => c.used)).toEqual([2, 4, 3]);
    expect(got.value.capacities.every((c) => !c.full)).toBe(true);
    expect(got.value.blockedReason).toBeNull();
  });

  it("上限ちょうどで「いっぱい」と判定する（1 つ超えてから気づかせない）", async () => {
    // ひとり用はブランド 1・ブログ 3・担当者 1。
    const got = await overview(
      withWorkspace(aWorkspace({ plan: "solo" }), { brands: 1, sites: 2, members: 1 }),
    );
    if (!got.ok) throw got.error;

    const full = got.value.capacities.filter((c) => c.full).map((c) => c.label);
    expect(full).toEqual(["ブランド", "担当者"]);
    expect(got.value.blockedReason).toContain("ブランド・担当者");
    // 増やす手立てまで書く。ここで止まると利用者は何もできない。
    expect(got.value.blockedReason).toContain("契約の変更");
  });

  it("上限の 1 つ手前では、まだ止めない", async () => {
    const got = await overview(
      withWorkspace(aWorkspace({ plan: "team" }), { brands: 4, sites: 19, members: 9 }),
    );
    if (!got.ok) throw got.error;
    expect(got.value.blockedReason).toBeNull();
  });

  it("止まっている作業場所では、上限より先にその理由を出す", async () => {
    const got = await overview(
      withWorkspace(aWorkspace({ plan: "solo", suspendedAt: daysFrom(NOW, -1) }), {
        brands: 99,
        sites: 99,
        members: 99,
      }),
    );
    if (!got.ok) throw got.error;

    expect(got.value.suspended).toBe(true);
    expect(got.value.blockedReason).toContain("いま止まっています");
    // 止まっているときに上限の話をしても、利用者は何も直せない。
    expect(got.value.blockedReason).not.toContain("上限");
  });

  it("設定が見つからないときは、相談先を書く", async () => {
    const got = await overview(withWorkspace(null));
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
    expect(got.error.suggestedAction).toContain("管理担当");
  });

  it("数え上げが 1 つでも読めないときは、途中までの数字を出さない", async () => {
    const got = await overview({
      workspaces: portOf("workspaces", {
        findById: async () => ok(aWorkspace()),
        countBrands: async () => ok(1),
        countSites: async () => failing("ブログの数が読めません。"),
        countMembers: async () => ok(1),
      }),
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.message).toContain("ブログの数");
  });

  it("見るだけなら、管理の権限までは要らない", async () => {
    const got = await overview(withWorkspace(aWorkspace()), aWriter());
    expect(got.ok).toBe(true);
  });

  it("記事を見る権限も無い人には出さない", async () => {
    const got = await overview(withWorkspace(aWorkspace()), aNobody());
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });
});

describe("役割とできること", () => {
  async function roles(actor = owner) {
    const got = await createListRolesUseCase(deps()).execute(actor, {});
    if (!got.ok) throw got.error;
    return got.value;
  }

  it("役割を 1 つも落とさずに出し、識別子のままにしない", async () => {
    const view = await roles();
    expect(view.rows.map((r) => r.role)).toEqual(Object.keys(ROLE_LABEL));
    for (const row of view.rows) {
      expect(row.label).toBe(ROLE_LABEL[row.role]);
      expect(row.label).not.toBe(row.role);
    }
  });

  it("できることも、識別子ではなく日本語で出す", async () => {
    const view = await roles();
    const ownerRow = view.rows.find((r) => r.role === "owner");
    expect(ownerRow?.capabilities.length).toBeGreaterThan(0);
    for (const c of ownerRow?.capabilities ?? []) {
      expect(c.label).toBe(CAPABILITY_LABEL[c.key]);
    }
  });

  it("機械の欄に、人が行うと決めた操作を出さない", async () => {
    const view = await roles();
    const machine = view.rows.find((r) => r.role === "ai_service_account");

    expect(machine?.isMachine).toBe(true);
    for (const c of machine?.capabilities ?? []) {
      expect(HUMAN_ONLY_CAPABILITIES.has(c.key), `${c.key} が機械の欄に出ています`).toBe(false);
    }
  });

  it("機械に渡さない操作を、伏せずに「渡さないもの」として見せる", async () => {
    const view = await roles();
    const machine = view.rows.find((r) => r.role === "ai_service_account");
    // 黙って消すと、設定を見た人は「AI にもできる」と思ったままになる。
    expect(machine?.humanOnlyBlocked.length ?? 0).toBeGreaterThan(0);
    expect(machine?.humanOnlyBlocked).toContain(CAPABILITY_LABEL["content.approve"]);
  });

  it("人の役割には、渡さない操作の欄を作らない", async () => {
    const view = await roles();
    for (const row of view.rows.filter((r) => !r.isMachine)) {
      expect(row.humanOnlyBlocked, `${row.role} に機械向けの注記が出ています`).toEqual([]);
    }
  });

  it("人が行う操作の一覧を、画面の説明として持つ", async () => {
    const view = await roles();
    for (const c of HUMAN_ONLY_CAPABILITIES) {
      expect(view.humanOnlyNote).toContain(CAPABILITY_LABEL[c]);
    }
  });

  it("権限が無い人には出さない", async () => {
    const got = await createListRolesUseCase(deps()).execute(aNobody(), {});
    expect(got.ok).toBe(false);
  });
});

describe("担当者の一覧", () => {
  function withMembers(items: readonly unknown[], ownerFound: unknown = aMembership()) {
    return {
      memberships: portOf("memberships", {
        list: async () => ok({ items, nextCursor: null }),
        findOwner: async () => ok(ownerFound),
      }),
    };
  }

  async function members(over: Partial<ManageWorkspaceDeps>) {
    const got = await createListMembersUseCase(deps(over)).execute(owner, {});
    if (!got.ok) throw got.error;
    return got.value;
  }

  it("参加中・招待中・解除済みを、別の言葉で見分けられる", async () => {
    const view = await members(
      withMembers([
        aMembership({ displayName: "参加した人" }),
        aMembership({ displayName: "まだの人", acceptedAt: null }),
        aMembership({ displayName: "やめた人", revokedAt: daysFrom(NOW, -1) }),
      ]),
    );

    expect(view.rows.map((r) => r.stateLabel)).toEqual([
      "参加中",
      "招待中（まだ参加していません）",
      "解除済み",
    ]);
    expect(view.rows.map((r) => r.active)).toEqual([true, false, false]);
    expect(view.total).toBe(3);
  });

  it("解除済みは、招待中と混ぜない（解除を「まだ来ていない」と読ませない）", async () => {
    const view = await members(
      withMembers([aMembership({ acceptedAt: null, revokedAt: daysFrom(NOW, -1) })]),
    );
    expect(view.rows[0].stateLabel).toBe("解除済み");
  });

  it("役割は日本語で、複数あればすべて出す", async () => {
    const view = await members(withMembers([aMembership({ roles: ["writer", "publisher"] })]));
    expect(view.rows[0].roleLabels).toEqual([ROLE_LABEL.writer, ROLE_LABEL.publisher]);
  });

  it("担当の範囲を、件数まで含めて出す", async () => {
    const view = await members(
      withMembers([
        aMembership({ scopedBrandIds: [] }),
        aMembership({ scopedBrandIds: ["brand-1", "brand-2"] as never }),
      ]),
    );
    expect(view.rows[0].scopeLabel).toBe("すべてのブランド");
    expect(view.rows[1].scopeLabel).toBe("2件のブランドのみ");
  });

  it("責任者が居ないことを、静かに見過ごさない", async () => {
    const view = await members(withMembers([aMembership()], null));
    expect(view.ownerMissing).toBe(true);
  });

  it("1 人も居ないときは、その意味を書く", async () => {
    const view = await members(withMembers([]));
    expect(view.total).toBe(0);
    expect(view.emptyReason).toContain("担当者がまだ登録されていません");
  });

  it("責任者の確認が読めないときは、居ないと言い切らない", async () => {
    const got = await createListMembersUseCase(
      deps({
        memberships: portOf("memberships", {
          list: async () => ok({ items: [], nextCursor: null }),
          findOwner: async () => failing("責任者を確認できません。"),
        }),
      }),
    ).execute(owner, {});

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.message).toContain("責任者");
  });

  it("一覧が読めないときは、0 人として出さない", async () => {
    const got = await createListMembersUseCase(
      deps({
        memberships: portOf("memberships", { list: async () => failing("担当者が読めません。") }),
      }),
    ).execute(owner, {});
    expect(got.ok).toBe(false);
  });
});

describe("ブランドの公開準備", () => {
  function withBrands(items: readonly unknown[]) {
    return { brands: portOf("brands", { list: async () => ok({ items, nextCursor: null }) }) };
  }

  async function brands(over: Partial<ManageWorkspaceDeps>) {
    const got = await createListBrandsUseCase(deps(over)).execute(owner, {});
    if (!got.ok) throw got.error;
    return got.value;
  }

  it("公開の前に埋めるものが無ければ、準備できていないと数えない", async () => {
    const view = await brands(withBrands([aBrand()]));
    expect(view.rows[0].missing).toEqual([]);
    expect(view.notReadyCount).toBe(0);
    expect(view.emptyReason).toBeNull();
  });

  it("運営者名と問い合わせ先が欠けていることを、名指しで出す", async () => {
    const view = await brands(
      withBrands([aBrand({ legalName: null, contactEmail: null })]),
    );
    expect(view.rows[0].missing).toEqual(["運営者の表示名", "問い合わせ先メールアドレス"]);
    expect(view.notReadyCount).toBe(1);
  });

  it("文体を、設定値ではなく読める形で出す", async () => {
    const view = await brands(
      withBrands([
        aBrand({
          voice: {
            politeness: "plain",
            firstPerson: "私",
            vocabulary: "technical",
            avoidPhrases: ["絶対に"],
          },
        }),
      ]),
    );

    expect(view.rows[0].voiceLabel).toContain("だ・である");
    expect(view.rows[0].voiceLabel).toContain("私");
    expect(view.rows[0].avoidPhrases).toEqual(["絶対に"]);
  });

  it("記事の既定値（言語・時間帯・行動文言）を持ち出す", async () => {
    const view = await brands(withBrands([aBrand()]));
    expect(view.rows[0].locale).toBe(DEFAULT_LOCALE);
    expect(view.rows[0].timeZone).toBe(DEFAULT_TIME_ZONE);
    expect(view.rows[0].defaultCta).toBe(DEFAULT_CTA);
  });

  it("1 件も無いときは、その意味を書く", async () => {
    const view = await brands(withBrands([]));
    expect(view.emptyReason).toContain("ブランドがまだ登録されていません");
  });

  it("読めないときは、0 件として出さない", async () => {
    const got = await createListBrandsUseCase(
      deps({ brands: portOf("brands", { list: async () => failing("ブランドが読めません。") }) }),
    ).execute(owner, {});
    expect(got.ok).toBe(false);
  });
});

describe("広告表記", () => {
  function withDisclosures(items: readonly unknown[]) {
    return {
      disclosures: portOf("disclosures", { list: async () => ok({ items, nextCursor: null }) }),
    };
  }

  async function disclosures(over: Partial<ManageWorkspaceDeps>) {
    const got = await createListDisclosuresUseCase(deps(over)).execute(owner, {});
    if (!got.ok) throw got.error;
    return got.value;
  }

  it("表示が要る関係と、要らない関係を分けて出す", async () => {
    const view = await disclosures(
      withDisclosures([
        aDisclosure({ relationshipType: "affiliate" }),
        aDisclosure({ relationshipType: "purchased" }),
      ]),
    );

    expect(view.rows[0].required).toBe(true);
    expect(view.rows[1].required).toBe(false);
    expect(view.rows[0].relationshipLabel).toBe(RELATIONSHIP_SHORT_LABEL.affiliate);
  });

  it("読者に見せる文言は、ここで短くしない", async () => {
    const message = "この記事にはアフィリエイト広告が含まれます。購入すると報酬を受け取ります。";
    const view = await disclosures(withDisclosures([aDisclosure({ visibleMessage: message })]));
    // 「PR」だけに縮めると、読者には何の関係か伝わらない。
    expect(view.rows[0].visibleMessage).toBe(message);
  });

  it("リンクに付ける印を、関係の種類から決める", async () => {
    const view = await disclosures(
      withDisclosures([
        aDisclosure({ relationshipType: "affiliate" }),
        aDisclosure({ relationshipType: "sponsored" }),
      ]),
    );
    for (const row of view.rows) {
      expect(row.relAttribute.length).toBeGreaterThan(0);
    }
    expect(view.rows[0].relAttribute).toContain("sponsored");
  });

  it("AI を使ったかどうかを、そのまま持ち出す", async () => {
    const view = await disclosures(withDisclosures([aDisclosure({ aiAssisted: true })]));
    expect(view.rows[0].aiAssisted).toBe(true);
  });

  it("表示が必要な場所を、1 つ残らず日本語で出す", async () => {
    const view = await disclosures(withDisclosures([aDisclosure()]));
    expect(view.surfaces.length).toBeGreaterThan(0);
    for (const s of view.surfaces) {
      expect(s.label, `${s.key} の場所の名前が識別子のままです`).not.toBe(s.key);
      expect(s.label).not.toMatch(/^[a-z_]+$/);
    }
  });

  it("1 件も無いときは、その意味を書く", async () => {
    const view = await disclosures(withDisclosures([]));
    expect(view.emptyReason).toContain("広告表記がまだ登録されていません");
  });

  it("読めないときは、0 件として出さない", async () => {
    const got = await createListDisclosuresUseCase(
      deps({
        disclosures: portOf("disclosures", { list: async () => failing("広告表記が読めません。") }),
      }),
    ).execute(owner, {});
    expect(got.ok).toBe(false);
  });
});

describe("操作の記録", () => {
  function entry(over: Record<string, unknown> = {}) {
    return {
      action: "content.approved",
      actor: { userId: "user-owner", isAiServiceAccount: false, modelId: null },
      occurredAt: NOW,
      targetType: "content_variant",
      targetId: "cv_alpha_review",
      reason: null,
      ...over,
    };
  }

  function withEntries(items: readonly unknown[], capture?: (limit: number) => void) {
    return {
      auditLog: portOf("auditLog", {
        search: async (_ws: unknown, _filter: unknown, page: { limit: number }) => {
          capture?.(page.limit);
          return ok({ items, nextCursor: null });
        },
      }),
    };
  }

  async function log(over: Partial<ManageWorkspaceDeps>, input = {}, actor = owner) {
    return createListAuditLogUseCase(deps(over)).execute(actor, input);
  }

  it("人の操作と機械の操作を、見分けられる形で出す", async () => {
    const got = await log(
      withEntries([
        entry(),
        entry({ actor: { userId: null, isAiServiceAccount: true, modelId: "test-model" } }),
      ]),
    );
    if (!got.ok) throw got.error;

    expect(got.value.rows[0].byHuman).toBe(true);
    expect(got.value.rows[0].actorLabel).toBe("user-owner");
    // 承認が機械で済まされていないことを、ここで確かめられるようにする。
    expect(got.value.rows[1].byHuman).toBe(false);
    expect(got.value.rows[1].actorLabel).toContain("test-model");
  });

  it("誰か分からない記録も、人の操作として数えない", async () => {
    const got = await log(
      withEntries([entry({ actor: { userId: null, isAiServiceAccount: false, modelId: null } })]),
    );
    if (!got.ok) throw got.error;

    expect(got.value.rows[0].byHuman).toBe(false);
    expect(got.value.rows[0].actorLabel).toBe("不明");
  });

  it("機械の名前が分からないときも、機械であることは隠さない", async () => {
    const got = await log(
      withEntries([entry({ actor: { userId: null, isAiServiceAccount: true, modelId: null } })]),
    );
    if (!got.ok) throw got.error;
    expect(got.value.rows[0].actorLabel).toContain("機械");
  });

  it("操作の名前を日本語にし、対象と理由を添える", async () => {
    const got = await log(withEntries([entry({ reason: "表記の誤りを直したため" })]));
    if (!got.ok) throw got.error;

    expect(got.value.rows[0].action).toBe(AUDIT_ACTION_LABEL["content.approved"]);
    expect(got.value.rows[0].targetLabel).toContain("cv_alpha_review");
    expect(got.value.rows[0].reason).toBe("表記の誤りを直したため");
  });

  it("知らない操作でも、記録を落とさずそのまま出す", async () => {
    const got = await log(withEntries([entry({ action: "something.unknown" })]));
    if (!got.ok) throw got.error;
    // 表に無いからと消すと、後から追えなくなる。記録は残す方を選ぶ。
    expect(got.value.rows[0].action).toBe("something.unknown");
  });

  it("件数の上限を渡せる（渡さないときの既定がある）", async () => {
    const seen: number[] = [];
    await log(withEntries([], (l) => seen.push(l)));
    await log(withEntries([], (l) => seen.push(l)), { limit: 5 });
    expect(seen).toEqual([50, 5]);
  });

  it("1 件も無いときは、その意味を書く", async () => {
    const got = await log(withEntries([]));
    if (!got.ok) throw got.error;
    expect(got.value.emptyReason).toContain("まだ記録がありません");
  });

  it("読めないときは、0 件として出さない", async () => {
    const got = await log({
      auditLog: portOf("auditLog", { search: async () => failing("記録が読めません。") }),
    });
    expect(got.ok).toBe(false);
  });

  it("記録を見る権限が無い人には出さない（設定が見えることと別）", async () => {
    const got = await log(withEntries([entry()]), {}, aWriter());
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });

  it("数字を見る担当でも、操作の記録までは見られない", async () => {
    // 記録には誰が何をしたかが残る。数字を見る仕事に、そこまでは要らない。
    const got = await log(withEntries([entry()]), {}, anAnalyst());
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });
});
