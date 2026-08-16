import type { MembershipRepositoryPort } from "@/application/ports/identity";
import type { ActorContext, UserId } from "@/domain/shared";
import type { SessionReaderPort } from "./session-repository";

/**
 * 合言葉 →「いま操作している人」への変換。
 *
 * 変換は 2 段。**この 2 段を分けてあることが、認証を替えられる理由。**
 *
 *   1. 合言葉が有効か（[[session-repository]]）……ログインの仕組みが持つ知識
 *   2. その人が何をしてよいか（担当者の登録）……こちらの業務が持つ知識
 *
 * ログインを Google からメールリンクへ替えても、変わるのは 1 段目だけ。
 * 逆に、権限の付け方を変えても 1 段目は変わらない。
 * 両者を 1 つの関数に混ぜると、認証を替えるたびに権限の判定を書き直すことになる。
 *
 * 権限は**必ず担当者の登録から引く**。合言葉の中身に権限を書き込まない。
 * 合言葉に権限を埋めると、担当を外した人の権限が、その合言葉が切れるまで残る。
 */
export const SESSION_COOKIE_NAME = "ah_session";

export type ActorResolution =
  | { readonly kind: "actor"; readonly actor: ActorContext }
  /** ログインしていない、または合言葉が無効。 */
  | { readonly kind: "anonymous" }
  /** ログインはしているが、この作業場所の担当ではない。 */
  | { readonly kind: "not_member"; readonly userId: UserId }
  /** 確認そのものができなかった（保存先が落ちている等）。ログイン扱いにしない。 */
  | { readonly kind: "unavailable"; readonly reason: string };

export function createSessionActorResolver(deps: {
  readonly sessions: SessionReaderPort;
  readonly memberships: MembershipRepositoryPort;
  readonly now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());

  return async function resolveActor(token: string | null): Promise<ActorResolution> {
    if (token === null || token.length === 0) return { kind: "anonymous" };

    const found = await deps.sessions.findValid(token, now());
    if (!found.ok) return { kind: "unavailable", reason: found.error.message };
    if (found.value === null) return { kind: "anonymous" };

    const { userId, workspaceId } = found.value;
    const membership = await deps.memberships.findByUser(workspaceId, userId);
    if (!membership.ok) return { kind: "unavailable", reason: membership.error.message };
    if (membership.value === null) return { kind: "not_member", userId };

    // 取り消された担当者は、合言葉が生きていても操作できない。
    if (membership.value.revokedAt !== null) return { kind: "not_member", userId };

    return {
      kind: "actor",
      actor: {
        workspaceId,
        userId: String(userId),
        roles: membership.value.roles,
        // 人が使っている経路なので、AI サービスアカウントではない。
        // AI の入口は別に身元確認を持つ（`api-token`）。
        isAiServiceAccount: false,
      },
    };
  };
}
