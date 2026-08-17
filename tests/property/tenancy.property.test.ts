/** @tier 1 @req REQ-P01, REQ-E05, REQ-E06 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { HUMAN_ONLY_CAPABILITIES, can, capabilitiesOf, requireCapability } from "@/domain/identity";
import type { Capability } from "@/domain/identity/permissions";
import {
  type ActorContext,
  type Role,
  assertSameTenant,
  requireRole,
  taggedString,
} from "@/domain/shared";

/**
 * 「できてはいけないこと」を、例ではなく性質で確かめる。
 *
 * 権限まわりを例で書くと、書いた人が思いついた組み合わせしか試されない。
 * ロールは 11 種類あり、組み合わせは 2^11 通りある。
 * ここでは組み合わせ側を機械に作らせ、
 * **どう組み合わせても超えられない線**があることを確かめる。
 *
 * 対応する要件: REQ-P01（テナント分離）、REQ-E05（権限表）、REQ-E06（AI の権限上限）
 */

const ROLES: readonly Role[] = [
  "owner",
  "workspace_admin",
  "brand_manager",
  "researcher",
  "writer",
  "reviewer",
  "publisher",
  "analyst",
  "contributor",
  "feedback_admin",
  "ai_service_account",
];

const ALL_CAPABILITIES: readonly Capability[] = [
  ...new Set(ROLES.flatMap((r) => [...capabilitiesOf([r])])),
];

const rolesArb = fc.uniqueArray(fc.constantFrom(...ROLES), { minLength: 0, maxLength: ROLES.length });

const actorArb = (workspaceId: string) =>
  rolesArb.chain((roles) =>
    fc.boolean().map(
      (isAi): ActorContext => ({
        workspaceId: taggedString<"WorkspaceId">(workspaceId),
        userId: "u_prop",
        roles,
        isAiServiceAccount: isAi,
      }),
    ),
  );

describe("テナントの境界", () => {
  it("ワークスペースが違えば、何を渡しても必ず断られる", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (actorWs, entityWs, what) => {
          fc.pre(actorWs !== entityWs);
          const actor: ActorContext = {
            workspaceId: taggedString<"WorkspaceId">(actorWs),
            userId: "u_prop",
            roles: ["owner"],
            isAiServiceAccount: false,
          };
          const result = assertSameTenant(
            actor,
            { workspaceId: taggedString<"WorkspaceId">(entityWs) },
            what,
          );
          expect(result.ok).toBe(false);
          if (!result.ok) expect(result.error.code).toBe("TENANT_MISMATCH");
        },
      ),
    );
  });

  it("断り文に、相手のワークスペースIDを載せない（存在を推測させない）", () => {
    // 「他のテナントには在ります」と読み取れる情報を返さないこと自体が要件。
    fc.assert(
      fc.property(
        fc.string({ minLength: 6, maxLength: 12 }),
        fc.string({ minLength: 6, maxLength: 12 }),
        (actorWs, entityWs) => {
          fc.pre(actorWs !== entityWs);
          const actor: ActorContext = {
            workspaceId: taggedString<"WorkspaceId">(actorWs),
            userId: "u_prop",
            roles: ["owner"],
            isAiServiceAccount: false,
          };
          const result = assertSameTenant(
            actor,
            { workspaceId: taggedString<"WorkspaceId">(entityWs) },
            "記事",
          );
          if (result.ok) return;
          const text = JSON.stringify(result.error);
          expect(text).not.toContain(entityWs);
        },
      ),
    );
  });

  it("ワークスペースが同じなら、渡したものがそのまま返る", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 12 }), (ws) => {
        const id = taggedString<"WorkspaceId">(ws);
        const entity = { workspaceId: id, payload: "x" };
        const result = assertSameTenant(
          { workspaceId: id, userId: "u", roles: [], isAiServiceAccount: false },
          entity,
          "記事",
        );
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toBe(entity);
      }),
    );
  });
});

describe("権限の性質", () => {
  it("役割を足すと、できることは増えるだけで減らない", () => {
    fc.assert(
      fc.property(rolesArb, rolesArb, (a, b) => {
        const union = capabilitiesOf([...a, ...b]);
        for (const cap of capabilitiesOf(a)) expect(union.has(cap)).toBe(true);
      }),
    );
  });

  it("AI サービスアカウントは、どの役割を積んでも人限定の操作に到達できない", () => {
    fc.assert(
      fc.property(rolesArb, fc.constantFrom(...HUMAN_ONLY_CAPABILITIES), (roles, cap) => {
        const actor: ActorContext = {
          workspaceId: taggedString<"WorkspaceId">("ws"),
          userId: "u_ai",
          roles,
          isAiServiceAccount: true,
        };
        expect(can(actor, cap)).toBe(false);
        const required = requireCapability(actor, cap, "この操作");
        expect(required.ok).toBe(false);
        if (!required.ok) expect(required.error.code).toBe("FORBIDDEN");
      }),
    );
  });

  it("requireCapability が通るのは can が真のときだけ（2 つの判定がずれない）", () => {
    fc.assert(
      fc.property(actorArb("ws"), fc.constantFrom(...ALL_CAPABILITIES), (actor, cap) => {
        expect(requireCapability(actor, cap, "この操作").ok).toBe(can(actor, cap));
      }),
    );
  });

  it("役割を 1 つも持たない人は、何もできない", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_CAPABILITIES), fc.boolean(), (cap, isAi) => {
        expect(
          can(
            {
              workspaceId: taggedString<"WorkspaceId">("ws"),
              userId: "u",
              roles: [],
              isAiServiceAccount: isAi,
            },
            cap,
          ),
        ).toBe(false);
      }),
    );
  });

  it("改善要望の担当は、記事に関する権限を 1 つも持たない", () => {
    // 「要望を読ませたいだけの相手に公開の権限まで渡る」を防ぐ線。
    // 権限表へ 1 行足したときに、この線を越えていないかを機械が見る。
    const caps = capabilitiesOf(["feedback_admin"]);
    for (const cap of caps) {
      expect(cap.startsWith("content.")).toBe(false);
      expect(cap.startsWith("site.")).toBe(false);
      expect(cap.startsWith("product.")).toBe(false);
    }
  });

  it("owner はどの役割を要求されても通り、owner でなければ持っている役割でしか通らない", () => {
    fc.assert(
      fc.property(rolesArb, fc.uniqueArray(fc.constantFrom(...ROLES), { minLength: 1 }), (have, want) => {
        const actor: ActorContext = {
          workspaceId: taggedString<"WorkspaceId">("ws"),
          userId: "u",
          roles: have,
          isAiServiceAccount: false,
        };
        const expected = have.includes("owner") || want.some((w) => have.includes(w));
        expect(requireRole(actor, "この操作", ...want).ok).toBe(expected);
      }),
    );
  });
});
