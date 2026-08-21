import { and, asc, count, eq, isNull } from "drizzle-orm";
import type { PageRequest, Paged, PortResult } from "@/application/ports/common";
import type { MembershipRepositoryPort } from "@/application/ports/identity";
import { type MembershipRow, memberships } from "@/db/schema";
import type { Membership } from "@/domain/identity";
import { normalizeInvitedEmail } from "@/domain/identity";
import {
  type MembershipId,
  type Role,
  type UserId,
  type WorkspaceId,
  asBrandId,
  asUserId,
  asWorkspaceId,
  ok,
} from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 担当者の登録の**書く側**（D1）。招待の追加・役割の変更・担当の取り消し。
 *
 * **これはスタブではない。** 見本データ版と同じ契約（`MembershipRepositoryPort`）を
 * 満たす、実際に保存する実装である。
 *
 * --- 読む側とここを分けてある ---
 * ログインした人の権限を引くのは `src/infrastructure/identity/membership-reader.ts`
 * ただ 1 か所で、あちらは書く口を持たない。権限の引き当てに書き込みの道が
 * 付いていると、読み取りの経路を辿るだけでは「権限が変わり得るか」を確かめられない。
 * ここは逆に、**引き当てには使わない**。招待しただけの行（`user_id` が空）も
 * そのまま返すので、これを権限の判定に使うと招待した瞬間に相手が動けてしまう。
 *
 * --- 決めごと ---
 *   1. **行は消さない。** 取り消しは `revoked_at` を入れるだけ。消すと、
 *      その人が過去に承認した記録が誰のものか分からなくなる。
 *   2. **`user_id` はここから書かない。** 招待を受け取る（`user_id` を埋める）のは
 *      初回ログインの側（`session-issuer`）である。両方から書けるようにすると、
 *      「招待を出す人が、受け取る相手を指定できる」口ができる。
 *      `save` は `user_id` を更新の対象から外してあるので、そう書けない。
 *   3. **絞り込みは必ず `workspaceId` から始める。** 担当者は権限そのものなので、
 *      絞り忘れた 1 か所が、他社の作業場所へ役を配ることになる。
 */

/** 行 → ドメイン。`user_id` が空なら「まだ受け取られていない招待」。 */
function toDomain(row: MembershipRow): Membership {
  return {
    id: row.id as MembershipId,
    workspaceId: asWorkspaceId(row.workspaceId) as WorkspaceId,
    // 空文字も `null` にそろえる。ここで空文字の利用者を作ると、
    // 「誰でもない人」が担当者として画面と記録に並ぶ。
    userId:
      row.userId === null || row.userId === "" ? null : (asUserId(row.userId) as UserId),
    invitedEmail: row.invitedEmail,
    roles: row.roles as readonly Role[],
    scopedBrandIds: row.scopedBrandIds.map((id) => asBrandId(id)),
    displayName: row.displayName,
    invitedAt: row.invitedAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
  };
}

export function createD1MembershipRepository(db: DrizzleD1): MembershipRepositoryPort {
  return {
    async findById(
      workspaceId: WorkspaceId,
      id: MembershipId,
    ): PortResult<Membership | null> {
      try {
        const rows = await db
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.workspaceId, String(workspaceId)),
              eq(memberships.id, String(id)),
            ),
          )
          .limit(1);
        // 別の作業場所のものは「無い」と答える。存在の有無も漏らさない。
        return ok(rows.length === 0 ? null : toDomain(rows[0]));
      } catch (cause) {
        return storageFailure("担当者の読み出し", cause);
      }
    },

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
        return ok(rows.length === 0 ? null : toDomain(rows[0]));
      } catch (cause) {
        return storageFailure("担当者の読み出し", cause);
      }
    },

    async findByInvitedEmail(
      workspaceId: WorkspaceId,
      invitedEmail: string,
    ): PortResult<Membership | null> {
      try {
        const rows = await db
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.workspaceId, String(workspaceId)),
              // 保存する側が小文字にそろえているので、引く側も同じ形にする。
              eq(memberships.invitedEmail, normalizeInvitedEmail(invitedEmail)),
            ),
          )
          .limit(1);
        return ok(rows.length === 0 ? null : toDomain(rows[0]));
      } catch (cause) {
        return storageFailure("招待の確認", cause);
      }
    },

    async list(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<Membership>> {
      try {
        const rows = await db
          .select()
          .from(memberships)
          .where(eq(memberships.workspaceId, String(workspaceId)))
          // 招待した順。**新しい順にしない。** 誰を先に招いたかが分かるほうが、
          // 「この人はいつからいるのか」を画面で追える。
          .orderBy(asc(memberships.invitedAt))
          .limit(page.limit);
        return ok({ items: rows.map(toDomain), nextCursor: null });
      } catch (cause) {
        return storageFailure("担当者の一覧取得", cause);
      }
    },

    async countCurrent(workspaceId: WorkspaceId): PortResult<number> {
      try {
        const rows = await db
          .select({ value: count() })
          .from(memberships)
          .where(
            and(
              eq(memberships.workspaceId, String(workspaceId)),
              isNull(memberships.revokedAt),
            ),
          );
        return ok(rows[0]?.value ?? 0);
      } catch (cause) {
        return storageFailure("現在の担当者数の取得", cause);
      }
    },

    async save(membership: Membership): PortResult<Membership> {
      try {
        const values = {
          id: String(membership.id),
          workspaceId: String(membership.workspaceId),
          userId: membership.userId === null ? null : String(membership.userId),
          invitedEmail: normalizeInvitedEmail(membership.invitedEmail),
          roles: [...membership.roles] as string[],
          scopedBrandIds: membership.scopedBrandIds.map(String),
          displayName: membership.displayName,
          invitedAt: membership.invitedAt,
          acceptedAt: membership.acceptedAt,
          revokedAt: membership.revokedAt,
        };
        await db
          .insert(memberships)
          .values(values)
          .onConflictDoUpdate({
            target: memberships.id,
            set: {
              // **`user_id` と `accepted_at` は上書きしない。** どちらも
              // 「入ってきた人が受け取った」という事実で、招待を出す側の知識ではない。
              // ここで上書きできると、役割を変えるたびに参加済みの人が
              // 招待中へ戻り、次のログインまで入れなくなる。
              roles: values.roles,
              scopedBrandIds: values.scopedBrandIds,
              displayName: values.displayName,
              revokedAt: values.revokedAt,
            },
          });
        return ok(membership);
      } catch (cause) {
        return storageFailure("担当者の保存", cause);
      }
    },

    async findOwner(workspaceId: WorkspaceId): PortResult<Membership | null> {
      try {
        const rows = await db
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.workspaceId, String(workspaceId)),
              // 外した人は運営者として数えない。数えると、
              // 運営者が居ないのに「居る」と出て、誰も引き継ぎに気づかない。
              isNull(memberships.revokedAt),
            ),
          );
        // 役割は JSON の 1 列なので、SQL では絞れない。読み出してから選ぶ。
        // 一覧の件数は上限（プランごとの担当者数）で押さえられている。
        const owner = rows.find((row) => (row.roles as string[]).includes("owner"));
        return ok(owner === undefined ? null : toDomain(owner));
      } catch (cause) {
        return storageFailure("運営者の確認", cause);
      }
    },
  };
}
