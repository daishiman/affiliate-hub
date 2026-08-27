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

/**
 * ここが要るのは `findByUser` だけ。
 *
 * 担当者の登録の**全体**を受け取らないのは、書き込みの口（`save`）まで
 * 渡すと、ログインの判定から担当者の登録を書き換えられる状態になるため。
 * 受け取る口を狭くしておくと、何ができないかが型で分かる。
 */
export type MembershipReaderPort = Pick<MembershipRepositoryPort, "findByUser">;

/**
 * 管理画面の読み取りに渡せる身元を選ぶ。
 *
 * cookie が無い開発・検査環境だけは従来どおり見本を使う。一方、有効な
 * session を持つ人が担当から外れた場合と、保存先を確認できない場合は
 * 見本へ権限降格して読み続けず、呼び出し側が入口へ戻せるよう null にする。
 */
export function selectAdminReadActor(
  resolution: ActorResolution,
  anonymousFallback: ActorContext,
): ActorContext | null {
  if (resolution.kind === "actor") return resolution.actor;
  if (resolution.kind === "anonymous") return anonymousFallback;
  return null;
}

export function createSessionActorResolver(deps: {
  readonly sessions: SessionReaderPort;
  readonly memberships: MembershipReaderPort;
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

    // Port が誤った行を返しても、別 workspace / 別 user の役割を借りない。
    // DB の WHERE だけに依存せず、権限を ActorContext へ移す直前でも照合する。
    if (
      String(membership.value.workspaceId) !== String(workspaceId) ||
      String(membership.value.userId) !== String(userId)
    ) {
      return { kind: "not_member", userId };
    }

    // 取り消された担当者は、合言葉が生きていても操作できない。
    if (membership.value.revokedAt !== null) return { kind: "not_member", userId };

    return {
      kind: "actor",
      actor: {
        workspaceId,
        userId: String(userId),
        roles: membership.value.roles,
        scopedBrandIds: membership.value.scopedBrandIds,
        // 人が使っている経路なので、AI サービスアカウントではない。
        // AI の入口は別に身元確認を持つ（`api-token`）。
        isAiServiceAccount: false,
        // ここへ来るのは、合言葉を保存先で照合し、担当者の登録も引けた場合だけ。
        // 上の分岐がすべて `anonymous` / `not_member` / `unavailable` を返し切っている。
        identified: true,
      },
    };
  };
}
