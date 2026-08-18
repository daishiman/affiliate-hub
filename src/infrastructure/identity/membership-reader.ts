import { and, eq } from "drizzle-orm";
import type { PortResult } from "@/application/ports/common";
import { memberships, type MembershipRow } from "@/db/schema";
import type { Membership } from "@/domain/identity";
import {
  type BrandId,
  type MembershipId,
  type Role,
  type UserId,
  type WorkspaceId,
  asBrandId,
  asUserId,
  asWorkspaceId,
  domainError,
  err,
  ok,
} from "@/domain/shared";
import type { MembershipReaderPort } from "./session-actor";
import type { DrizzleD1 } from "../persistence/d1/link-inbox-repository";

/**
 * 担当者の登録の**読み取りだけ**（D1）。
 *
 * ログインした人の権限を引くのはここ 1 か所である。書き込む口は持たない
 * （理由は [[session-actor]] の `MembershipReaderPort`）。
 *
 * 担当者の**管理画面**はまだ見本データで動いている。そちらを本物にするには
 * 招待のアドレスをドメインの型が持つ必要があり、変更の幅が別物になるので分けた。
 * 先に本物にしたのは、**権限の引き当て**のほうである。ここが見本のままだと、
 * ログインが成立しても全員が見本の役割で動くことになる。
 */
function toMembership(row: MembershipRow): Membership | null {
  // `user_id` が空の行は「招待したが、まだ一度も入っていない」。
  // 権限は無い。ここで空文字の利用者として通すと、招待しただけの人が動く。
  if (row.userId === null || row.userId === "") return null;
  return {
    id: row.id as MembershipId,
    workspaceId: asWorkspaceId(row.workspaceId) as WorkspaceId,
    userId: asUserId(row.userId) as UserId,
    roles: row.roles as readonly Role[],
    scopedBrandIds: row.scopedBrandIds.map((id) => asBrandId(id) as BrandId),
    displayName: row.displayName,
    invitedAt: row.invitedAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
  };
}

export function createD1MembershipReader(db: DrizzleD1): MembershipReaderPort {
  return {
    async findByUser(
      workspaceId: WorkspaceId,
      userId: UserId,
    ): PortResult<Membership | null> {
      try {
        const rows = await db
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.workspaceId, String(workspaceId)),
              eq(memberships.userId, String(userId)),
            ),
          )
          .limit(1);
        const row = rows[0];
        if (row === undefined) return ok(null);
        return ok(toMembership(row));
      } catch (cause) {
        // 落ちたことを null（＝担当ではない）にしない。
        // 混ぜると、保存先が落ちている間の操作が「権限が無い人の操作」として
        // 記録され、原因の切り分けができなくなる。
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "担当者の登録を確認できませんでした。", {
            retryable: true,
            suggestedAction: "少し待ってからもう一度開いてください。",
            details: { reason: cause instanceof Error ? cause.name : "unknown" },
          }),
        );
      }
    },
  };
}
