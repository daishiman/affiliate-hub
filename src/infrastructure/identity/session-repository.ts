import { eq } from "drizzle-orm";
import type { PortResult } from "@/application/ports/common";
import {
  type UserId,
  type WorkspaceId,
  asUserId,
  asWorkspaceId,
  domainError,
  err,
  ok,
} from "@/domain/shared";
import { sessions, type SessionRow } from "@/db/schema";
import type { DrizzleD1 } from "../persistence/d1/link-inbox-repository";

/**
 * ログイン状態の読み取り（D1）。
 *
 * **これはスタブではない。** 合言葉を受け取って、それが今も有効かを実際に判定する。
 *
 * まだ無いのは**入口の側**（誰がこの行を作るか）で、それは Better Auth + Google の担当。
 * つまり「確かめる側」と「発行する側」を分けてあり、
 * 発行の仕組みを Google からメールリンクへ替えても、ここは 1 行も変わらない。
 * これが変更容易性シナリオ ⑦ の要点。
 *
 * 決めごとが 3 つ。
 *
 *   1. **合言葉は保存しない。** 保存してあるのは潰した値だけなので、
 *      照合も潰してから行う。表を読めた人が他人になりすませない。
 *   2. **期限切れは行を消さずに無効と判定する。** 掃除の仕組みが止まっても、
 *      古い合言葉が復活しない。
 *   3. **無効なときは理由を返さない。** 「期限切れ」「そんな合言葉は無い」を
 *      区別して返すと、合言葉の総当たりに手がかりを与える。
 */

export type SessionFact = {
  readonly userId: UserId;
  readonly workspaceId: WorkspaceId;
  readonly expiresAt: Date;
};

export type SessionReaderPort = {
  /** 合言葉が今も有効なら、それが誰のものかを返す。無効なら null。 */
  findValid(token: string, now: Date): PortResult<SessionFact | null>;
};

/**
 * 合言葉を潰す。SHA-256。
 *
 * Workers にも Node にも標準で入っている Web Crypto を使う。
 * ここで独自の潰し方を作らない（自作の暗号は必ず弱い）。
 */
export async function hashSessionToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isUsable(row: SessionRow, now: Date): boolean {
  if (row.revokedAt !== null) return false;
  return row.expiresAt.getTime() > now.getTime();
}

export function createD1SessionReader(db: DrizzleD1): SessionReaderPort {
  return {
    async findValid(token: string, now: Date): PortResult<SessionFact | null> {
      try {
        const tokenHash = await hashSessionToken(token);
        const rows = await db
          .select()
          .from(sessions)
          .where(eq(sessions.tokenHash, tokenHash))
          .limit(1);
        const row = rows[0];
        // 見つからない場合と期限切れの場合を、返り値の上で区別しない。
        if (row === undefined || !isUsable(row, now)) return ok(null);
        return ok({
          userId: asUserId(row.userId) as UserId,
          workspaceId: asWorkspaceId(row.workspaceId) as WorkspaceId,
          expiresAt: row.expiresAt,
        });
      } catch (cause) {
        // ここで ok(null) を返すと、保存先が落ちているだけの状態が
        // 「ログインしていない」に化ける。落ちたことは落ちたこととして返す。
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "ログイン状態の確認に失敗しました。", {
            retryable: true,
            suggestedAction: "少し待ってからもう一度開いてください。",
            details: { reason: cause instanceof Error ? cause.name : "unknown" },
          }),
        );
      }
    },
  };
}
