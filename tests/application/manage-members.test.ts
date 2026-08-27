/** @tier 1 @req REQ-P01 */
import { describe, expect, it } from "vitest";
import type { MembershipRepositoryPort } from "@/application/ports/identity";
import {
  type ManageMembersDeps,
  createManageMembersUseCase,
} from "@/application/usecases/identity/manage-workspace";
import type { Membership } from "@/domain/identity";
import { normalizeInvitedEmail } from "@/domain/identity";
import { type WorkspaceId, ok } from "@/domain/shared";
import { WORKSPACE, aNobody, anAnalyst, anOwner } from "../support/actors";
import { NOW } from "../support/clock";
import { failing, recordingAuditLog, testDeps } from "../support/doubles";
import { aMembership } from "../support/factories";

/**
 * 担当者を**書く**側（招待・役割の変更・取り消し）。
 *
 * --- ここで固定したいこと ---
 * この口は「入ってよい人の一覧」を変える。緩むところが 1 つでもあると、
 * 権限の話が全部そこから崩れるので、断りの側を厚く見る:
 *
 *   1. `member.manage` の無い人は 3 つとも通らない（AI からも通らない）
 *   2. 同じアドレスへ二重に招待できない
 *   3. 運営者は 1 人だけで、最後の 1 人を外させない
 *   4. 自分で自分を外せない（外した瞬間、戻す権限も無くなる）
 *
 * もうひとつ、**招待では `user_id` を決めない**こと。決められると、
 * 招待を出す人が「誰がその招待を受け取るか」を指定できることになる。
 */

/** その場限りの保存先。`save` は上書き、それ以外は素直に引く。 */
function memoryMemberships(seed: readonly Membership[] = []): {
  readonly port: MembershipRepositoryPort;
  readonly rows: () => readonly Membership[];
} {
  const rows: Membership[] = [...seed];
  const inWs = (ws: WorkspaceId) => rows.filter((m) => String(m.workspaceId) === String(ws));
  return {
    port: {
      findById: async (ws, id) =>
        ok(inWs(ws).find((m) => String(m.id) === String(id)) ?? null),
      findByUser: async (ws, userId) =>
        ok(inWs(ws).find((m) => m.userId !== null && String(m.userId) === String(userId)) ?? null),
      findByInvitedEmail: async (ws, email) =>
        ok(inWs(ws).find((m) => m.invitedEmail === normalizeInvitedEmail(email)) ?? null),
      list: async (ws, page) => ok({ items: inWs(ws).slice(0, page.limit), nextCursor: null }),
      countCurrent: async (ws) => ok(inWs(ws).filter((membership) => membership.revokedAt === null).length),
      save: async (m) => {
        const at = rows.findIndex((r) => String(r.id) === String(m.id));
        if (at === -1) rows.push(m);
        else rows[at] = m;
        return ok(m);
      },
      findOwner: async (ws) =>
        ok(inWs(ws).find((m) => m.revokedAt === null && m.roles.includes("owner")) ?? null),
    },
    rows: () => rows,
  };
}

function build(seed: readonly Membership[] = []) {
  const base = testDeps();
  const memberships = memoryMemberships(seed);
  const audit = recordingAuditLog();
  const deps: ManageMembersDeps = {
    workspaces: base.workspaces,
    memberships: memberships.port,
    brands: base.brands,
    disclosures: base.disclosures,
    auditLog: audit.port,
    ids: { newId: () => "id1" },
    now: () => NOW,
    capacity: { withLease: async (_workspaceId, _kind, mutation) => mutation() },
  };
  return { uc: createManageMembersUseCase(deps), memberships, audit };
}

const owner = anOwner();

describe("担当者を招く", () => {
  it("上限なら保存前に止める", async () => {
    const memberships = memoryMemberships();
    const audit = recordingAuditLog();
    const deps = testDeps();
    const result = await createManageMembersUseCase({
      workspaces: deps.workspaces,
      memberships: memberships.port,
      brands: deps.brands,
      disclosures: deps.disclosures,
      auditLog: audit.port,
      ids: { newId: () => "id-limit" },
      now: () => NOW,
      capacity: { withLease: async () => failing("担当者の上限です。") },
    }).execute(owner, {
      action: "invite",
      invitedEmail: "limit@example.com",
      displayName: "上限",
      roles: ["writer"],
    });

    expect(result.ok).toBe(false);
    expect(memberships.rows()).toHaveLength(0);
    expect(audit.entries()).toHaveLength(0);
  });

  it("行が残り、まだ誰のものでもない", async () => {
    const { uc, memberships } = build();
    const result = await uc.execute(owner, {
      action: "invite",
      invitedEmail: "Miwa@Example.com",
      displayName: "みわ",
      roles: ["writer"],
    });

    expect(result.ok).toBe(true);
    const rows = memberships.rows();
    expect(rows).toHaveLength(1);
    // 小文字でそろえて残す。初回ログインはこの形で突き合わせる。
    expect(rows[0].invitedEmail).toBe("miwa@example.com");
    // **招待した側は受け取る人を指定できない。**
    expect(rows[0].userId).toBeNull();
    expect(rows[0].acceptedAt).toBeNull();
  });

  it("記録が残る", async () => {
    const { uc, audit } = build();
    await uc.execute(owner, {
      action: "invite",
      invitedEmail: "miwa@example.com",
      displayName: "みわ",
      roles: ["writer"],
    });
    expect(audit.actions()).toContain("member.role_changed");
    // 理由が空だと記録そのものが断られる。既定の理由で埋まっていること。
    expect(audit.entries()[0].reason).not.toBe("");
  });

  it("同じアドレスへ二度は招待できない", async () => {
    const { uc } = build([
      aMembership({ workspaceId: WORKSPACE, invitedEmail: "miwa@example.com" }),
    ]);
    const result = await uc.execute(owner, {
      action: "invite",
      // 大文字で送っても同じ行として見つかる。
      invitedEmail: "MIWA@example.com",
      displayName: "みわ",
      roles: ["writer"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.field).toBe("invitedEmail");
    }
  });

  it("運営者が既にいるなら、2 人目の運営者は招けない", async () => {
    const { uc } = build([aMembership({ workspaceId: WORKSPACE, roles: ["owner"] })]);
    const result = await uc.execute(owner, {
      action: "invite",
      invitedEmail: "new-owner@example.com",
      displayName: "新しい人",
      roles: ["owner"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CONFLICT");
  });

  it("アドレスの形が違えば保存しない", async () => {
    const { uc, memberships } = build();
    const result = await uc.execute(owner, {
      action: "invite",
      invitedEmail: "miwa",
      displayName: "みわ",
      roles: ["writer"],
    });
    expect(result.ok).toBe(false);
    expect(memberships.rows()).toHaveLength(0);
  });
});

describe("誰が触れるか", () => {
  it("権限の無い人は招待できない", async () => {
    const { uc, memberships } = build();
    const result = await uc.execute(aNobody(), {
      action: "invite",
      invitedEmail: "miwa@example.com",
      displayName: "みわ",
      roles: ["writer"],
    });
    expect(result.ok).toBe(false);
    expect(memberships.rows()).toHaveLength(0);
  });

  it("数字を見るだけの人も、役割を変えられない", async () => {
    const target = aMembership({ workspaceId: WORKSPACE, roles: ["writer"] });
    const { uc } = build([target]);
    const result = await uc.execute(anAnalyst(), {
      action: "change_roles",
      membershipId: String(target.id),
      roles: ["publisher"],
    });
    expect(result.ok).toBe(false);
  });

  it("AI（機械）からは通らない", async () => {
    const { uc } = build();
    const machine = anOwner({ isAiServiceAccount: true });
    const result = await uc.execute(machine, {
      action: "invite",
      invitedEmail: "miwa@example.com",
      displayName: "みわ",
      roles: ["writer"],
    });
    expect(result.ok).toBe(false);
  });

  it("他の作業場所の行には届かない", async () => {
    const other = aMembership({
      workspaceId: "ws-test-other" as WorkspaceId,
      roles: ["writer"],
    });
    const { uc } = build([other]);
    const result = await uc.execute(owner, {
      action: "revoke",
      membershipId: String(other.id),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });
});

describe("役割を変える", () => {
  it("変わった役割が保存される", async () => {
    const target = aMembership({ workspaceId: WORKSPACE, roles: ["writer"] });
    const { uc, memberships } = build([target]);
    const result = await uc.execute(owner, {
      action: "change_roles",
      membershipId: String(target.id),
      roles: ["reviewer", "publisher"],
      reason: "確認と公開を任せるため",
    });
    expect(result.ok).toBe(true);
    expect(memberships.rows()[0].roles).toEqual(["reviewer", "publisher"]);
    // 参加の事実は残る。消えると、次のログインまで入れなくなる。
    expect(memberships.rows()[0].acceptedAt).toEqual(target.acceptedAt);
  });

  it("最後の運営者から運営者を外せない", async () => {
    const theOwner = aMembership({ workspaceId: WORKSPACE, roles: ["owner"] });
    const { uc } = build([theOwner]);
    const result = await uc.execute(owner, {
      action: "change_roles",
      membershipId: String(theOwner.id),
      roles: ["workspace_admin"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVARIANT_VIOLATED");
  });

  it("理由が空でも、記録は理由付きで残る", async () => {
    const target = aMembership({ workspaceId: WORKSPACE, roles: ["writer"] });
    const { uc, audit } = build([target]);
    const result = await uc.execute(owner, {
      action: "change_roles",
      membershipId: String(target.id),
      roles: ["reviewer"],
      reason: "   ",
    });
    expect(result.ok).toBe(true);
    expect(audit.entries()[0].reason).not.toBe("");
  });
});

describe("担当から外す", () => {
  it("行は消えず、外した日が入る", async () => {
    const target = aMembership({ workspaceId: WORKSPACE, roles: ["writer"] });
    const { uc, memberships } = build([target]);
    const result = await uc.execute(owner, {
      action: "revoke",
      membershipId: String(target.id),
      reason: "契約が終わったため",
    });
    expect(result.ok).toBe(true);
    expect(memberships.rows()).toHaveLength(1);
    expect(memberships.rows()[0].revokedAt).toEqual(NOW);
  });

  it("運営者は外せない", async () => {
    const theOwner = aMembership({ workspaceId: WORKSPACE, roles: ["owner"] });
    const { uc } = build([theOwner]);
    const result = await uc.execute(owner, {
      action: "revoke",
      membershipId: String(theOwner.id),
    });
    expect(result.ok).toBe(false);
  });

  it("自分で自分を外せない", async () => {
    const me = aMembership({
      workspaceId: WORKSPACE,
      roles: ["workspace_admin"],
      userId: owner.userId as Membership["userId"],
    });
    const { uc } = build([me]);
    const result = await uc.execute(owner, {
      action: "revoke",
      membershipId: String(me.id),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVARIANT_VIOLATED");
  });

  it("既に外れている人を外しても、何も壊さない", async () => {
    const left = aMembership({ workspaceId: WORKSPACE, roles: ["writer"], revokedAt: NOW });
    const { uc, audit } = build([left]);
    const result = await uc.execute(owner, {
      action: "revoke",
      membershipId: String(left.id),
    });
    expect(result.ok).toBe(true);
    // 同じ操作が記録にだけ増えない。
    expect(audit.entries()).toHaveLength(0);
  });

  it("見つからない行は「見つからない」と答える", async () => {
    const { uc } = build();
    const result = await uc.execute(owner, {
      action: "revoke",
      membershipId: "mb_missing",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });
});
