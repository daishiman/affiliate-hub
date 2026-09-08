/** @tier 1 @req REQ-P01 */
import { describe, expect, it } from "vitest";
import {
  changeMembershipRoles,
  createMembership,
  isActiveMembership,
  normalizeInvitedEmail,
  revokeMembership,
} from "@/domain/identity";
import { type MembershipId, type WorkspaceId, taggedString } from "@/domain/shared";
import { NOW, daysFrom } from "../support/clock";
import { aMembership } from "../support/factories";

/**
 * 担当者の行を**作る・変える・外す**ときの決まりごと。
 *
 * --- ここで固定したいこと ---
 * 招待は「まだ一度も入っていない人」に出すので、`userId` が無いまま行が立つ。
 * その状態の行が、うっかり**権限を持つ担当者として数えられない**ことが要点である。
 * 数えられると、招待を出した瞬間に相手が動けることになる。
 *
 * もうひとつは、役割を変えても参加の事実（`acceptedAt`）が消えないこと。
 * 消えると、役割を変えられた人が次のログインまで入れなくなる。
 * 画面には何も出ないので、原因の分からない締め出しになる。
 */

const WS = taggedString<"WorkspaceId">("ws_test") as WorkspaceId;
const ID = taggedString<"MembershipId">("mb_test") as MembershipId;

function invite(over: Partial<Parameters<typeof createMembership>[0]> = {}) {
  return createMembership({
    id: ID,
    workspaceId: WS,
    invitedEmail: "hana@example.com",
    roles: ["writer"],
    displayName: "はな",
    invitedAt: NOW,
    ...over,
  });
}

describe("招待のアドレス", () => {
  it("大文字と前後の空白をそろえて持つ", () => {
    // Google が返すアドレスは小文字で来る。こちらだけ大文字のまま持つと、
    // 突き合わせが外れて「招待したのに入れない」になる。
    expect(normalizeInvitedEmail("  Hana@Example.COM ")).toBe("hana@example.com");

    const built = invite({ invitedEmail: " Hana@Example.COM " });
    expect(built.ok).toBe(true);
    if (built.ok) expect(built.value.invitedEmail).toBe("hana@example.com");
  });

  it("空のアドレスでは行を作れない", () => {
    const built = invite({ invitedEmail: "   " });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error.code).toBe("VALIDATION_FAILED");
      expect(built.error.field).toBe("invitedEmail");
    }
  });

  it("形になっていないアドレスでは行を作れない", () => {
    for (const bad of ["hana", "hana@example", "hana example@x.com", "@example.com"]) {
      const built = invite({ invitedEmail: bad });
      expect(built.ok, bad).toBe(false);
      if (!built.ok) expect(built.error.field).toBe("invitedEmail");
    }
  });
});

describe("招待を出した直後の行", () => {
  it("誰のものでもなく、参加もしていない", () => {
    const built = invite();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.userId).toBeNull();
    expect(built.value.acceptedAt).toBeNull();
    expect(built.value.revokedAt).toBeNull();
  });

  it("**担当者として数えられない**（招待しただけでは動けない）", () => {
    const built = invite();
    if (!built.ok) throw new Error("作れませんでした");
    expect(isActiveMembership(built.value, NOW)).toBe(false);
  });
});

describe("役割を変える", () => {
  it("参加の事実を消さない", () => {
    const joined = aMembership({ roles: ["writer"], acceptedAt: daysFrom(NOW, -10) });
    const changed = changeMembershipRoles(joined, ["reviewer", "publisher"]);
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.value.roles).toEqual(["reviewer", "publisher"]);
    // ここが `null` に戻ると、役割を変えた人が招待中へ巻き戻る。
    expect(changed.value.acceptedAt).toEqual(joined.acceptedAt);
    expect(changed.value.userId).toEqual(joined.userId);
  });

  it("作るときと同じ組み合わせの決まりが効く", () => {
    const joined = aMembership({ roles: ["writer"] });
    const both = changeMembershipRoles(joined, ["owner", "writer"]);
    expect(both.ok).toBe(false);

    const none = changeMembershipRoles(joined, []);
    expect(none.ok).toBe(false);
  });

  it("外した人の役割は変えられない", () => {
    const left = aMembership({ revokedAt: daysFrom(NOW, -1) });
    const changed = changeMembershipRoles(left, ["reviewer"]);
    expect(changed.ok).toBe(false);
    if (!changed.ok) expect(changed.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("担当から外す", () => {
  it("行は消えず、外した日が入る", () => {
    const joined = aMembership({ acceptedAt: daysFrom(NOW, -10) });
    const left = revokeMembership(joined, NOW);
    expect(left.revokedAt).toEqual(NOW);
    // 過去の記録を辿れる必要があるので、身元と参加の記録は残す。
    expect(left.userId).toEqual(joined.userId);
    expect(left.acceptedAt).toEqual(joined.acceptedAt);
    expect(isActiveMembership(left, NOW)).toBe(false);
  });

  it("二度外しても、最初に外した日のまま", () => {
    const first = daysFrom(NOW, -5);
    const left = aMembership({ revokedAt: first });
    expect(revokeMembership(left, NOW).revokedAt).toEqual(first);
  });
});
