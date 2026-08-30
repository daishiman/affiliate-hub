import { asc, eq, gt, and } from "drizzle-orm";
import type { PageRequest, Paged, PortResult } from "@/application/ports/common";
import type { DisclosureRepositoryPort } from "@/application/ports/compliance";
import type { Disclosure } from "@/domain/compliance";
import {
  type DisclosureId,
  type WorkspaceId,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";
import { type DisclosureRow, disclosures } from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 広告表記の保存先（D1）。
 *
 * **これはスタブではない。** 見本版（`settings-sample-repository.ts` の
 * `createSampleDisclosureRepository`）と同じ契約を満たし、変更が実際に残る。
 *
 * --- 見本と重ねない ---
 * ほかの保存先は見本を重ねているが、ここは重ねない。表記は**読者へ実際に出る文**で、
 * 見本の「見本メーカー株式会社」が本物の一覧に並ぶと、
 * 存在しない提供元の断りを記事に出せてしまう。まだ 1 件も無い状態は
 * 空のまま返し、画面はその理由を書く（`ListDisclosuresOutput.emptyReason`）。
 *
 * --- 表示文をここで組み立てない ---
 * `visible_message` は行から読むだけにする。読むときに組み立て直すと、
 * **保存した文と、いま画面に出る文が違う**状態が起こりうる。
 * 文の正本は domain の `buildVisibleMessage()` で、保存の時点で確定させる。
 */

function toDomain(row: DisclosureRow): Disclosure {
  return {
    id: taggedString<"DisclosureId">(row.id) as DisclosureId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    relationshipType: row.relationshipType,
    advertiserOrSupplier: row.advertiserOrSupplier,
    editorialInfluence: row.editorialInfluence,
    aiAssisted: row.aiAssisted,
    visibleMessage: row.visibleMessage,
  };
}

/** 1 度に読む上限。読み口が指定した件数より多く返さない。 */
const MAX_LIST = 200;

export function createD1DisclosureRepository(db: DrizzleD1): DisclosureRepositoryPort {
  return {
    async findById(workspaceId: WorkspaceId, id: DisclosureId): PortResult<Disclosure | null> {
      try {
        const rows = await db
          .select()
          .from(disclosures)
          .where(
            and(
              eq(disclosures.workspaceId, String(workspaceId)),
              eq(disclosures.id, String(id)),
            ),
          )
          .limit(1);
        const row = rows[0];
        return ok(row === undefined ? null : toDomain(row));
      } catch (cause) {
        return storageFailure("広告表記の読み出し", cause);
      }
    },

    /**
     * 一覧。**ID の昇順**で返す。
     *
     * 新しい順にしない。ここは並べ替えて眺める一覧ではなく、
     * 「この作業場所ではどの関係を表記できるか」の定義の一覧で、
     * 開くたびに順番が変わると、どれを直したのかが分からなくなる。
     * 続きの読み出しも ID を目印にする（時刻だと同秒の行を飛ばす）。
     */
    async list(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<Disclosure>> {
      const limit = Math.min(Math.max(page.limit, 1), MAX_LIST);
      try {
        const rows = await db
          .select()
          .from(disclosures)
          .where(
            page.cursor === null
              ? eq(disclosures.workspaceId, String(workspaceId))
              : and(
                  eq(disclosures.workspaceId, String(workspaceId)),
                  gt(disclosures.id, page.cursor),
                ),
          )
          .orderBy(asc(disclosures.id))
          .limit(limit + 1);
        const items = rows.slice(0, limit).map(toDomain);
        return ok({
          items,
          nextCursor: rows.length > limit ? String(items[items.length - 1]?.id ?? "") : null,
        });
      } catch (cause) {
        return storageFailure("広告表記の読み出し", cause);
      }
    },

    async save(disclosure: Disclosure): PortResult<Disclosure> {
      try {
        // 持ち主の確認は表現ポリシーと同じ理由（黙って何も起きない保存を作らない）。
        const existing = await db
          .select({ workspaceId: disclosures.workspaceId })
          .from(disclosures)
          .where(eq(disclosures.id, String(disclosure.id)))
          .limit(1);
        const owner = existing[0]?.workspaceId;
        if (owner !== undefined && owner !== String(disclosure.workspaceId)) {
          return err(
            domainError("CONFLICT", "この ID の広告表記は、別の作業場所のものです。", {
              field: "id",
              suggestedAction: "新しい広告表記として登録し直してください。",
            }),
          );
        }

        const values = {
          relationshipType: disclosure.relationshipType,
          advertiserOrSupplier: disclosure.advertiserOrSupplier,
          editorialInfluence: disclosure.editorialInfluence,
          aiAssisted: disclosure.aiAssisted,
          visibleMessage: disclosure.visibleMessage,
          updatedAt: new Date(),
        };
        await db
          .insert(disclosures)
          .values({
            id: String(disclosure.id),
            workspaceId: String(disclosure.workspaceId),
            ...values,
          })
          .onConflictDoUpdate({ target: disclosures.id, set: values });
      } catch (cause) {
        return storageFailure("広告表記の保存", cause);
      }
      return ok(disclosure);
    },
  };
}
