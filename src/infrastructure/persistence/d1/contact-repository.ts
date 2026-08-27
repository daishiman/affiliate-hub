import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  ContactMessage,
  ContactRecord,
  EditorialContactPort,
} from "@/application/ports/reader-interaction";
import { domainError, err, markEditorial, ok } from "@/domain/shared";
import type { WorkspaceId } from "@/domain/shared";
import { contactMessages, type ContactMessageRow } from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 読者から届いた問い合わせの保存先（D1）。
 *
 * **これはスタブではない。** 見本版と違い、実際に残って、運営者が読める。
 *
 * --- なぜメールを待たなかったか ---
 * 見本版は「送信先が未設定です」と断っていた。断るのは正直だが、
 * 読者から見れば**書いた文章がどこにも行かずに消える**ことに変わりはない。
 * メールを出すには Turnstile の鍵と送信元アドレスの登録（利用者本人の作業）が要るが、
 * 「受け取って運営者が読む」だけなら保存先だけで足りる。
 * 先に消えないようにするほうが、待つより早い。
 *
 * --- 見本を混ぜない ---
 * ほかの保存先と違い、ここは見本を重ねない。届いていない問い合わせが
 * 一覧に並んでいたら、それは問い合わせの一覧ではない。
 * **1 件も無いときは、空のまま返すのが正しい。**
 *
 * --- 記録（監査ログ）へ写さない ---
 * 本文と返信先には、書いた人の事情が入る。ここは運営者が読むためだけの場所で、
 * 例外の中身にも本文を載せない（`storageFailure` は原因の型しか見ない）。
 */

function toRecord(row: ContactMessageRow): ContactRecord {
  return {
    id: row.id,
    siteSlug: row.siteSlug,
    body: row.body,
    replyTo: row.replyTo,
    receivedAt: row.receivedAt,
    handledAt: row.handledAt,
  };
}

export function createD1ContactRepository(
  db: DrizzleD1,
  now: () => Date = () => new Date(),
): EditorialContactPort {
  return markEditorial({
    async submit(workspaceId: WorkspaceId, message: ContactMessage, rateLimitKey: string) {
      // 受付番号は保存先で決める。送る側に決めさせると、
      // 既にある番号を指定して他人の問い合わせを上書きできてしまう。
      const receiptId = crypto.randomUUID();
      try {
        const received = now();
        const receivedAt = received.toISOString();
        const since = new Date(received.getTime() - 60_000).toISOString();
        /*
         * 回数確認と保存を同じINSERT文にする。先にCOUNTしてからINSERTすると、
         * 同時に来た6件が全て「まだ4件」と読み、6件とも入ってしまう。
         * D1は単一statementを直列化するので、このWHEREが判定と確定の境界になる。
         */
        const inserted = await db
          .insert(contactMessages)
          .select(sql`
            SELECT
              ${receiptId}, ${String(workspaceId)}, ${message.siteSlug}, ${message.body},
              ${message.replyTo ?? null}, ${rateLimitKey}, ${receivedAt}, NULL
            WHERE (
              SELECT count(*) FROM ${contactMessages}
              WHERE ${contactMessages.workspaceId} = ${String(workspaceId)}
                AND ${contactMessages.siteSlug} = ${message.siteSlug}
                AND ${contactMessages.rateLimitKey} = ${rateLimitKey}
                AND ${contactMessages.receivedAt} >= ${since}
            ) < ${CONTACT_RATE_LIMIT_PER_MINUTE}
          `)
          .returning({ id: contactMessages.id });
        if (inserted.length === 0) {
          return err(
            domainError("RATE_LIMITED", "短時間に送れる回数を超えました。", {
              retryable: true,
              suggestedAction: "1分ほど待ってから、もう一度送ってください。",
            }),
          );
        }
        return ok({ receiptId });
      } catch (cause) {
        // ここで握り潰すと「送信しました」と出したのに何も残らない。
        // 失敗は必ず読者へ返し、控えの連絡手段を案内させる。
        return storageFailure("問い合わせの受け取り", cause);
      }
    },

    async list(workspaceId: WorkspaceId, ownedSiteSlugs: readonly string[], siteSlug?: string) {
      try {
        if (ownedSiteSlugs.length === 0) return ok([]);
        if (siteSlug !== undefined && !ownedSiteSlugs.includes(siteSlug)) return ok([]);
        const visibleSiteSlugs = siteSlug === undefined ? ownedSiteSlugs : [siteSlug];
        const rows = (await db
          .select()
          .from(contactMessages)
          .where(
            and(
              eq(contactMessages.workspaceId, String(workspaceId)),
              inArray(contactMessages.siteSlug, visibleSiteSlugs),
            ),
          )
          .orderBy(desc(contactMessages.receivedAt))) as ContactMessageRow[];
        return ok(rows.map(toRecord));
      } catch (cause) {
        return storageFailure("問い合わせの読み出し", cause);
      }
    },

    async markHandled(
      workspaceId: WorkspaceId,
      ownedSiteSlugs: readonly string[],
      id: string,
      handled: boolean,
      at: string,
    ) {
      try {
        if (ownedSiteSlugs.length === 0) {
          return err(
            domainError("NOT_FOUND", "その問い合わせは見つかりません。", {
              suggestedAction: "一覧を開き直してください。",
              retryable: false,
            }),
          );
        }
        const updated = (await db
          .update(contactMessages)
          .set({ handledAt: handled ? at : null })
          .where(
            and(
              eq(contactMessages.id, id),
              eq(contactMessages.workspaceId, String(workspaceId)),
              inArray(contactMessages.siteSlug, ownedSiteSlugs),
            ),
          )
          .returning({ id: contactMessages.id })) as { id: string }[];
        if (updated.length === 0) {
          // 0 件でも成功にすると、消えた問い合わせに印を付け続けられる。
          return err(
            domainError("NOT_FOUND", "その問い合わせは見つかりません。", {
              suggestedAction: "一覧を開き直してください。",
              retryable: false,
            }),
          );
        }
        return ok(true as const);
      } catch (cause) {
        return storageFailure("問い合わせの対応状況の更新", cause);
      }
    },
  });
}

export const CONTACT_RATE_LIMIT_PER_MINUTE = 5;
