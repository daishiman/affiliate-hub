import { and, eq, isNull } from "drizzle-orm";
import { memberships, sessions } from "@/db/schema";
import { hashSessionToken } from "./session-repository";
import type { DrizzleD1 } from "../persistence/d1/link-inbox-repository";

/**
 * 通行証（`ah_session`）を発行する側。
 *
 * --- なぜ認証基盤のセッションをそのまま使わないか ---
 *
 * Better Auth も自前のセッションを持っている。それを通行証として使えば
 * 仕組みは 1 つで済む。それでも分けたのは、性質が 2 つ違うため。
 *
 *   1. Better Auth は合言葉を**平文で**保存する（`session.token` は unique 列）。
 *      こちらの `sessions` は潰した値しか持たない（[[session-repository]] の決めごと 1）。
 *      通行証をこちら側で出せば、**表を読めた人が他人になりすませない**性質を保てる。
 *   2. 通行証には**作業場所**（workspace）が要る。Better Auth が知っているのは
 *      「誰か」だけで、「どの作業場所の担当か」は業務側の知識である。
 *
 * つまり Better Auth が担うのは **Google との往復と本人確認まで**。
 * そこから先の「この人はどの作業場所を、いつまで触ってよいか」はここが決める。
 *
 * --- 担当者の登録が無い人には出さない ---
 *
 * 本人確認が通っても、担当者の登録が無ければ**通行証を作らない**。
 * 作ってから画面で断ると、「入れないはずの人が、入れた状態で立っている」ことになる。
 *
 * 招待はアドレスで書いてある（`memberships.invited_email`）。初めて入る人は
 * その行の `user_id` がまだ空なので、ここで埋める（招待を受け取る）。
 * **空の行が無ければ何も作らない。** 「最初に入った人を管理者にする」ような
 * 特例を置かないので、入ってよい人は必ず、入る前に行がある。
 */

/** 通行証の有効期間。長くしない。共有端末で開いたままの画面が通行証になる。 */
export const APP_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type IssuedSession = {
  readonly token: string;
  readonly expiresAt: Date;
};

export type SessionIssueOutcome =
  | { readonly kind: "issued"; readonly session: IssuedSession }
  /** 本人確認は通ったが、どの作業場所の担当でもない。 */
  | { readonly kind: "not_member" }
  /** 保存先の都合で出せなかった。**「担当ではない」と混ぜない。** */
  | { readonly kind: "failed"; readonly reason: string };

/**
 * 合言葉を作る。**推測できない値であることだけが安全性の根拠**なので、
 * 日時や利用者の識別子から組み立てない。
 */
export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type SessionIssuerPort = {
  /** 本人確認が済んだ人へ通行証を出す。担当の登録が無ければ出さない。 */
  issue(userId: string, email: string, now: Date): Promise<SessionIssueOutcome>;
  /** ログアウト。行は消さず、無効にした日を入れる（誰がいつ出たかが残る）。 */
  revoke(token: string, now: Date): Promise<void>;
};

export function createD1SessionIssuer(db: DrizzleD1): SessionIssuerPort {
  return {
    async issue(userId: string, email: string, now: Date): Promise<SessionIssueOutcome> {
      let workspaceId: string;
      try {
        // 2 回目以降。`user_id` が既に埋まっている行を探す。
        // 担当を外された行は数に入れない。外した人が入り直せてしまう。
        const claimed = await db
          .select({ workspaceId: memberships.workspaceId })
          .from(memberships)
          .where(and(eq(memberships.userId, userId), isNull(memberships.revokedAt)))
          .limit(1);

        const already = claimed[0];
        if (already !== undefined) {
          workspaceId = already.workspaceId;
        } else {
          // 初回。アドレス宛の招待が、まだ誰にも結び付いていない状態で残っているか。
          const normalized = email.trim().toLowerCase();
          const invited = await db
            .select({ id: memberships.id, workspaceId: memberships.workspaceId })
            .from(memberships)
            .where(
              and(
                eq(memberships.invitedEmail, normalized),
                isNull(memberships.userId),
                isNull(memberships.revokedAt),
              ),
            )
            .limit(1);
          const row = invited[0];
          if (row === undefined) return { kind: "not_member" };

          // 招待を受け取る。`user_id` が null のままの行だけを更新するので、
          // 同じ招待を 2 人が同時に受け取ることはない。
          await db
            .update(memberships)
            .set({ userId, acceptedAt: now })
            .where(and(eq(memberships.id, row.id), isNull(memberships.userId)));
          workspaceId = row.workspaceId;
        }
      } catch (cause) {
        return { kind: "failed", reason: cause instanceof Error ? cause.name : "unknown" };
      }

      const token = generateSessionToken();
      const expiresAt = new Date(now.getTime() + APP_SESSION_TTL_MS);
      try {
        await db.insert(sessions).values({
          tokenHash: await hashSessionToken(token),
          userId,
          workspaceId,
          createdAt: now,
          expiresAt,
          revokedAt: null,
        });
      } catch (cause) {
        return { kind: "failed", reason: cause instanceof Error ? cause.name : "unknown" };
      }
      return { kind: "issued", session: { token, expiresAt } };
    },

    async revoke(token: string, now: Date): Promise<void> {
      try {
        await db
          .update(sessions)
          .set({ revokedAt: now })
          .where(eq(sessions.tokenHash, await hashSessionToken(token)));
      } catch {
        // ログアウトの失敗は握りつぶさない方がよさそうに見えるが、
        // ここで例外を投げると**画面上はログアウトできない**状態になる。
        // 通行証の cookie は呼び出し側が必ず消すので、その端末からは出られる。
      }
    },
  };
}
