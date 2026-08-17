import { and, desc, eq, lt } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import type { LinkIngestionRepositoryPort } from "@/application/ports/monetization";
import type { Page, Paged, PortResult } from "@/application/ports/common";
import type { LinkIngestion, LinkIngestionState } from "@/domain/monetization";
import {
  type AffiliateProgramId,
  type LinkIngestionId,
  type ProductId,
  type WorkspaceId,
  asAffiliateProgramId,
  asLinkIngestionId,
  asProductId,
  asWorkspaceId,
  err,
  markCommercial,
  ok,
  domainError,
} from "@/domain/shared";
import { linkIngestions, type LinkIngestionRow } from "@/db/schema";

/**
 * 成果リンク受信箱の保存先（D1）。
 *
 * **これはスタブではない。** 見本データ版と同じ契約
 * （`LinkIngestionRepositoryPort`）を満たす、実際に保存する実装。
 *
 * 変更容易性シナリオ ⑥「保存先を替える」の実測対象。
 * 差し替えで触るのはこのフォルダと合成ルート 1 箇所だけで、
 * ドメインもユースケースも画面も変わらないことを、この実装で確かめている。
 *
 * 書き方の決めごとが 3 つ。
 *
 *   1. **ドメインの型をそのまま保存しない。** 行の形（`LinkIngestionRow`）と
 *      ドメインの形（`LinkIngestion`）は別物として、下の 2 つの関数で往復する。
 *      同じ型を使い回すと、列を 1 つ足すたびにドメインが動く。
 *   2. **`submittedUrl` は触らない。** 正規化した形は別列に持つ。
 *      保存の都合で URL を書き換えると、ASP の規約違反になりうる。
 *   3. **重複は保存先の一意制約でも止める。** アプリ側の確認だけだと、
 *      2 人が同時に入れたときにすり抜ける。
 */

/**
 * 接続。`src/db/index.ts` の `getDb()` が返すもの。
 *
 * ここで受け取る形にしてあるのは、リクエストごとに供給される接続を
 * 使い回さないため（Workers ではモジュール先頭で作ると別リクエストへ漏れる）。
 */
export type DrizzleD1 = ReturnType<typeof drizzle>;

/** 行 → ドメイン。ID の作り方を知っているのはこの層だけ。 */
function toDomain(row: LinkIngestionRow): LinkIngestion {
  return {
    id: asLinkIngestionId(row.id) as LinkIngestionId,
    workspaceId: asWorkspaceId(row.workspaceId) as WorkspaceId,
    submittedUrl: row.submittedUrl,
    normalizedUrl: row.normalizedUrl,
    source: row.source,
    submittedAt: row.submittedAt,
    state: row.state,
    programId: row.programId === null ? null : (asAffiliateProgramId(row.programId) as AffiliateProgramId),
    productId: row.productId === null ? null : (asProductId(row.productId) as ProductId),
    duplicateOf: row.duplicateOf === null ? null : (asLinkIngestionId(row.duplicateOf) as LinkIngestionId),
    note: row.note,
    rejectedReason: row.rejectedReason,
  };
}

/** ドメイン → 行。 */
function toRow(item: LinkIngestion): LinkIngestionRow {
  return {
    id: String(item.id),
    workspaceId: String(item.workspaceId),
    submittedUrl: item.submittedUrl,
    normalizedUrl: item.normalizedUrl,
    source: item.source,
    submittedAt: item.submittedAt,
    state: item.state,
    programId: item.programId === null ? null : String(item.programId),
    productId: item.productId === null ? null : String(item.productId),
    duplicateOf: item.duplicateOf === null ? null : String(item.duplicateOf),
    note: item.note,
    rejectedReason: item.rejectedReason,
  };
}

/** 保存先が落ちたときの返し方。**握りつぶさない。** */
function storageFailure(what: string, cause: unknown) {
  return err(
    domainError("UPSTREAM_UNAVAILABLE", `${what}に失敗しました。時間をおいてもう一度お試しください。`, {
      retryable: true,
      suggestedAction: "何度も続く場合は、保存先の状態を確認してください。",
      // 例外の中身はそのまま出さない。接続文字列が混じることがある（§26.3）。
      details: { reason: cause instanceof Error ? cause.name : "unknown" },
    }),
  );
}

export function createD1LinkInboxRepository(db: DrizzleD1): LinkIngestionRepositoryPort {
  return {
    async findById(workspaceId: WorkspaceId, id: LinkIngestionId): PortResult<LinkIngestion | null> {
      try {
        const rows = await db
          .select()
          .from(linkIngestions)
          .where(
            and(eq(linkIngestions.workspaceId, String(workspaceId)), eq(linkIngestions.id, String(id))),
          )
          .limit(1);
        return ok(rows.length === 0 ? null : toDomain(rows[0]));
      } catch (cause) {
        return storageFailure("受信箱の読み出し", cause);
      }
    },

    async list(
      workspaceId: WorkspaceId,
      filter: { state: LinkIngestionState | null },
      page: Page,
    ): PortResult<Paged<LinkIngestion>> {
      try {
        // カーソルは「その時刻より前」。件数ではなく時刻で切るので、
        // 途中で 1 件増えても同じ行を 2 回返さない。
        const cursorAt = page.cursor === null ? null : new Date(Number(page.cursor));
        const conditions = [eq(linkIngestions.workspaceId, String(workspaceId))];
        if (filter.state !== null) conditions.push(eq(linkIngestions.state, filter.state));
        if (cursorAt !== null) conditions.push(lt(linkIngestions.submittedAt, cursorAt));

        const rows = await db
          .select()
          .from(linkIngestions)
          .where(and(...conditions))
          .orderBy(desc(linkIngestions.submittedAt))
          .limit(page.limit + 1);

        // 1 件多く取って「次があるか」を判定する。件数を数える問い合わせを足さない。
        const hasMore = rows.length > page.limit;
        const items = (hasMore ? rows.slice(0, page.limit) : rows).map(toDomain);
        const last = items.at(-1);
        return ok({
          items,
          nextCursor: hasMore && last !== undefined ? String(last.submittedAt.getTime()) : null,
        });
      } catch (cause) {
        return storageFailure("受信箱の一覧取得", cause);
      }
    },

    async findByNormalizedUrl(
      workspaceId: WorkspaceId,
      normalizedUrl: string,
    ): PortResult<LinkIngestion | null> {
      try {
        const rows = await db
          .select()
          .from(linkIngestions)
          .where(
            and(
              eq(linkIngestions.workspaceId, String(workspaceId)),
              eq(linkIngestions.normalizedUrl, normalizedUrl),
            ),
          )
          .limit(1);
        return ok(rows.length === 0 ? null : toDomain(rows[0]));
      } catch (cause) {
        return storageFailure("重複の確認", cause);
      }
    },

    async save(item: LinkIngestion): PortResult<LinkIngestion> {
      try {
        const row = toRow(item);
        // 同じ id で入れ直したときは上書きする（状態が進むたびに呼ばれるため）。
        await db.insert(linkIngestions).values(row).onConflictDoUpdate({
          target: linkIngestions.id,
          set: row,
        });
        return ok(item);
      } catch (cause) {
        return storageFailure("受信箱への保存", cause);
      }
    },
  };
}

/** 報酬に関わる保存先であることを型で表明する（順位づけへ渡せない）。 */
export function createCommercialD1LinkInboxRepository(db: DrizzleD1) {
  return markCommercial(createD1LinkInboxRepository(db));
}
