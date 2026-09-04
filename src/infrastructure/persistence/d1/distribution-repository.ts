import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { PageRequest, Paged, PortResult } from "@/application/ports/common";
import type {
  ChannelConnectionRepositoryPort,
  PublicationRepositoryPort,
} from "@/application/ports/distribution";
import type { ChannelConnection, Publication } from "@/domain/distribution";
import { EXTERNAL_DIRECT_CHANNEL_KINDS, samePublicationVersion } from "@/domain/distribution";
import {
  type ChannelConnectionId,
  type BrandId,
  type ContentVariantId,
  type PublicationId,
  type WorkspaceId,
  ok,
  taggedString,
} from "@/domain/shared";
import {
  channelConnections,
  contentPackages,
  contentVariants,
  publications,
  type ChannelConnectionRow,
  type PublicationRow,
} from "@/db/schema";
import {
  sampleChannelConnections,
  samplePublicationScopeReferences,
  samplePublications,
  samplePublicationsForScope,
} from "../sample/distribution-sample-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure, mergeWithSamples } from "./storage-failure";

/**
 * 配信の保存先（D1）。
 *
 * **これはスタブではない。** 見本データ版と同じ契約を満たす、実際に保存する実装。
 *
 * 見本を消さずに合わせて返す。これは配信先を作る前でも操作経路を確認するための
 * 配信固有の方針で、公開解決と一致すべきブログ一覧の方針とは分けている。
 * 消すと、まだ 1 件も作っていない状態で配信の一覧もカレンダーも空になり、
 * 「まだ出していない」のか「壊れている」のかを見分けられなくなる。
 * **同じ ID なら保存されたほうが勝つ**（見本を消した・取りやめた結果が
 * 次の読み出しで元に戻る、という一番たちの悪い形を避けるため）。
 *
 * 見本の出し先の接続を残しているのは、**各サービスへの接続が
 * 利用者ご自身の認証を要する**ため。ここまで消すと、認証が入る日まで
 * 配信を 1 件も作れず、作った先の画面を誰も確かめられない。
 * 見本であることは画面に出している。実際の投稿は行わない。
 */

/** 行 → 業務の形。ID の作り方を知っているのはこの層だけ。 */
function toConnection(row: ChannelConnectionRow): ChannelConnection {
  return {
    id: taggedString<"ChannelConnectionId">(row.id) as ChannelConnectionId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    kind: row.kind,
    accountLabel: row.accountLabel,
    connectedAt: row.connectedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    providerIdentity: row.providerIdentity,
    credentialRef: row.credentialRef,
  };
}

/** 業務の形 → 行。 */
function toConnectionRow(item: ChannelConnection): ChannelConnectionRow {
  return {
    id: String(item.id),
    workspaceId: String(item.workspaceId),
    kind: item.kind,
    accountLabel: item.accountLabel,
    connectedAt: item.connectedAt,
    expiresAt: item.expiresAt,
    revokedAt: item.revokedAt,
    providerIdentity: item.providerIdentity,
    credentialRef: item.credentialRef,
  };
}

/** @internal transactional outbox と同じ行変換を共有する。 */
export function toPublication(row: PublicationRow): Publication {
  return {
    id: taggedString<"PublicationId">(row.id) as PublicationId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    variantId: taggedString<"ContentVariantId">(row.variantId) as ContentVariantId,
    variantRevision: row.variantRevision,
    channelKind: row.kind,
    connectionId:
      row.connectionId === null
        ? null
        : (taggedString<"ChannelConnectionId">(row.connectionId) as ChannelConnectionId),
    state: row.state,
    scheduledAt: row.scheduledAt,
    retryAt: row.retryAt,
    deliveryLeaseUntil: row.deliveryLeaseUntil,
    idempotencyKey: row.idempotencyKey,
    providerIdentity: row.providerIdentity,
    providerDeliveryKey: row.providerDeliveryKey,
    providerRecordCreatedAt: row.providerRecordCreatedAt,
    attempts: row.attempts,
    externalId: row.externalId,
    externalUrl: row.externalUrl,
    lastError: row.lastError,
    publishedAt: row.publishedAt,
  };
}

/** @internal transactional outbox と通常保存で列の写し漏れを作らない。 */
export function toPublicationRow(item: Publication): typeof publications.$inferInsert {
  return {
    id: String(item.id),
    workspaceId: String(item.workspaceId),
    variantId: String(item.variantId),
    variantRevision: item.variantRevision,
    kind: item.channelKind,
    connectionId: item.connectionId === null ? null : String(item.connectionId),
    state: item.state,
    scheduledAt: item.scheduledAt,
    retryAt: item.retryAt,
    deliveryLeaseUntil: item.deliveryLeaseUntil,
    idempotencyKey: item.idempotencyKey,
    providerIdentity: item.providerIdentity,
    providerDeliveryKey: item.providerDeliveryKey,
    providerRecordCreatedAt: item.providerRecordCreatedAt,
    attempts: item.attempts,
    externalId: item.externalId,
    externalUrl: item.externalUrl,
    lastError: item.lastError,
    publishedAt: item.publishedAt,
  };
}

function nullableTextMatches(column: Parameters<typeof isNull>[0], value: string | null) {
  return value === null ? isNull(column) : eq(column, value);
}

function nullableDateMatches(column: Parameters<typeof isNull>[0], value: Date | null) {
  return value === null ? isNull(column) : eq(column, value);
}

/** Publicationの全可変列CAS。通常更新と送信claimで同じ正本を使う。 */
export function publicationVersionConditions(before: Publication) {
  return [
    eq(publications.id, String(before.id)),
    eq(publications.workspaceId, String(before.workspaceId)),
    eq(publications.variantId, String(before.variantId)),
    before.variantRevision === null
      ? isNull(publications.variantRevision)
      : eq(publications.variantRevision, before.variantRevision),
    eq(publications.kind, before.channelKind),
    nullableTextMatches(
      publications.connectionId,
      before.connectionId === null ? null : String(before.connectionId),
    ),
    eq(publications.state, before.state),
    eq(publications.attempts, before.attempts),
    nullableDateMatches(publications.scheduledAt, before.scheduledAt),
    nullableDateMatches(publications.retryAt, before.retryAt),
    nullableDateMatches(publications.deliveryLeaseUntil, before.deliveryLeaseUntil),
    eq(publications.idempotencyKey, before.idempotencyKey),
    nullableTextMatches(publications.providerIdentity, before.providerIdentity),
    nullableTextMatches(publications.providerDeliveryKey, before.providerDeliveryKey),
    nullableDateMatches(
      publications.providerRecordCreatedAt,
      before.providerRecordCreatedAt,
    ),
    nullableTextMatches(publications.externalId, before.externalId),
    nullableTextMatches(publications.externalUrl, before.externalUrl),
    nullableTextMatches(publications.lastError, before.lastError),
    nullableDateMatches(publications.publishedAt, before.publishedAt),
  ] as const;
}

export function createD1ChannelConnectionRepository(db: DrizzleD1): ChannelConnectionRepositoryPort {
  async function all(workspaceId: WorkspaceId): Promise<readonly ChannelConnection[]> {
    const rows = await db
      .select()
      .from(channelConnections)
      .where(eq(channelConnections.workspaceId, String(workspaceId)));
    return [
      ...mergeWithSamples(
        rows.map(toConnection),
        sampleChannelConnections().filter((c) => c.workspaceId === workspaceId),
      ),
    ].sort((a, b) => {
      const left = String(a.id);
      const right = String(b.id);
      return left < right ? -1 : left > right ? 1 : 0;
    });
  }

  return {
    async findById(workspaceId, id): PortResult<ChannelConnection | null> {
      try {
        return ok((await all(workspaceId)).find((c) => c.id === id) ?? null);
      } catch (cause) {
        return storageFailure("出し先の読み出し", cause);
      }
    },

    async listByWorkspace(workspaceId, page: PageRequest): PortResult<Paged<ChannelConnection>> {
      try {
        // 1媒体へ複数アカウントを接続できるため、媒体種別数は件数上限にならない。
        // 見本と保存行を重ねた後のID順をcursorにして、ページをまたいでも
        // 同じ接続を二度返さず、100件より後も到達できるようにする。
        const afterCursor = (await all(workspaceId)).filter(
          (connection) => page.cursor === null || String(connection.id) > page.cursor,
        );
        const hasMore = afterCursor.length > page.limit;
        const items = afterCursor.slice(0, page.limit);
        return ok({
          items,
          nextCursor:
            hasMore && items.length > 0 ? String(items[items.length - 1]?.id) : null,
        });
      } catch (cause) {
        return storageFailure("出し先の一覧取得", cause);
      }
    },

    async createIfAbsent(connection) {
      try {
        if (connection.providerIdentity === null) {
          return storageFailure(
            "接続先の確定",
            new Error("provider identity is required before connection registration"),
          );
        }
        const row = toConnectionRow(connection);
        const inserted = await db
          .insert(channelConnections)
          .values(row)
          .onConflictDoNothing()
          .returning({ id: channelConnections.id });
        const canonicalRows = await db
          .select()
          .from(channelConnections)
          .where(
            and(
              eq(channelConnections.workspaceId, String(connection.workspaceId)),
              eq(channelConnections.kind, connection.kind),
              or(
                eq(channelConnections.providerIdentity, connection.providerIdentity),
                eq(channelConnections.credentialRef, connection.credentialRef),
              ),
            ),
          )
          .limit(2);
        if (canonicalRows.length !== 1) {
          return storageFailure(
            "接続先の確定",
            new Error("connection identity and credential reference do not resolve to one row"),
          );
        }
        return ok({
          connection: toConnection(canonicalRows[0]!),
          created: inserted.length > 0,
        });
      } catch (cause) {
        return storageFailure("接続先の登録", cause);
      }
    },

    async acquireProviderDeliveryLease(input) {
      try {
        const at = Math.floor(input.at.getTime() / 1_000);
        const expiresAt = Math.floor(input.expiresAt.getTime() / 1_000);
        const leaseToken = crypto.randomUUID();
        const rows = await db.all<{ lease_token: string }>(sql`
          INSERT INTO channel_provider_delivery_leases
            (kind, provider_identity, holder_publication_id, lease_token, acquired_at, expires_at)
          VALUES (
            ${input.kind},
            ${input.providerIdentity},
            ${String(input.holderPublicationId)},
            ${leaseToken},
            ${at},
            ${expiresAt}
          )
          ON CONFLICT(kind, provider_identity) DO UPDATE SET
            holder_publication_id = excluded.holder_publication_id,
            lease_token = excluded.lease_token,
            acquired_at = excluded.acquired_at,
            expires_at = excluded.expires_at
          WHERE channel_provider_delivery_leases.expires_at <= ${at}
          RETURNING lease_token
        `);
        return ok(rows[0]?.lease_token ?? null);
      } catch (cause) {
        return storageFailure("provider送信leaseの確保", cause);
      }
    },

    async releaseProviderDeliveryLease(input) {
      try {
        await db.run(sql`
          DELETE FROM channel_provider_delivery_leases
          WHERE kind = ${input.kind}
            AND provider_identity = ${input.providerIdentity}
            AND holder_publication_id = ${String(input.holderPublicationId)}
            AND lease_token = ${input.leaseToken}
        `);
        return ok(undefined);
      } catch (cause) {
        return storageFailure("provider送信leaseの解放", cause);
      }
    },

    async save(connection): PortResult<ChannelConnection> {
      try {
        const row = toConnectionRow(connection);
        await db.insert(channelConnections).values(row).onConflictDoUpdate({
          target: channelConnections.id,
          set: row,
        });
        return ok(connection);
      } catch (cause) {
        return storageFailure("出し先の保存", cause);
      }
    },
  };
}

export function createD1PublicationRepository(db: DrizzleD1): PublicationRepositoryPort {
  async function inWorkspace(workspaceId: WorkspaceId): Promise<readonly Publication[]> {
    const rows = await db
      .select()
      .from(publications)
      .where(eq(publications.workspaceId, String(workspaceId)))
      .orderBy(desc(publications.scheduledAt));
    return mergeWithSamples(
      rows.map(toPublication),
      samplePublications().filter((p) => p.workspaceId === workspaceId),
    );
  }

  function ownershipInBrandScope(workspaceId: WorkspaceId, brandIds: readonly BrandId[]) {
    const scope = { brandIds } as const;
    const sampleRefs = samplePublicationScopeReferences(workspaceId, scope);
    const storedBrandId = sql<string | null>`case
      when json_valid(${contentPackages.packageJson})
      then json_extract(${contentPackages.packageJson}, '$.brandId')
      else null
    end`;
    let ownership = inArray(storedBrandId, brandIds.map(String));
    if (sampleRefs.packageIds.length > 0) {
      ownership = or(
        ownership,
        inArray(contentVariants.contentPackageId, sampleRefs.packageIds),
      )!;
    }
    if (sampleRefs.variantIds.length > 0) {
      ownership = or(ownership, inArray(publications.variantId, sampleRefs.variantIds))!;
    }
    return { ownership, scope };
  }

  async function recentInBrandScope(
    workspaceId: WorkspaceId,
    brandIds: readonly BrandId[],
    limit: number,
  ): Promise<readonly Publication[]> {
    if (brandIds.length === 0) return [];

    const { ownership, scope } = ownershipInBrandScope(workspaceId, brandIds);

    const rows = await db
      .select({ publication: publications })
      .from(publications)
      .leftJoin(
        contentVariants,
        and(
          eq(contentVariants.workspaceId, publications.workspaceId),
          eq(contentVariants.id, publications.variantId),
        ),
      )
      .leftJoin(
        contentPackages,
        and(
          eq(contentPackages.workspaceId, publications.workspaceId),
          eq(contentPackages.id, contentVariants.contentPackageId),
        ),
      )
      .where(and(eq(publications.workspaceId, String(workspaceId)), ownership))
      .orderBy(desc(publications.scheduledAt))
      .limit(limit);

    return mergeWithSamples(
      rows.map((row) => toPublication(row.publication)),
      samplePublicationsForScope(workspaceId, scope),
    ).slice(0, limit);
  }

  async function calendarInBrandScope(
    workspaceId: WorkspaceId,
    brandIds: readonly BrandId[],
    fromInclusive: Date,
    toExclusive: Date,
  ): Promise<readonly Publication[]> {
    if (brandIds.length === 0) return [];
    const { ownership, scope } = ownershipInBrandScope(workspaceId, brandIds);
    const calendarWindow = or(
      isNull(publications.scheduledAt),
      and(
        gte(publications.scheduledAt, fromInclusive),
        lt(publications.scheduledAt, toExclusive),
      ),
    );
    const rows = await db
      .select({ publication: publications })
      .from(publications)
      .leftJoin(
        contentVariants,
        and(
          eq(contentVariants.workspaceId, publications.workspaceId),
          eq(contentVariants.id, publications.variantId),
        ),
      )
      .leftJoin(
        contentPackages,
        and(
          eq(contentPackages.workspaceId, publications.workspaceId),
          eq(contentPackages.id, contentVariants.contentPackageId),
        ),
      )
      .where(
        and(
          eq(publications.workspaceId, String(workspaceId)),
          ownership,
          calendarWindow,
        ),
      )
      .orderBy(desc(publications.scheduledAt));

    const samples = samplePublicationsForScope(workspaceId, scope).filter(
      (publication) =>
        publication.scheduledAt === null ||
        (publication.scheduledAt >= fromInclusive && publication.scheduledAt < toExclusive),
    );
    return mergeWithSamples(
      rows.map((row) => toPublication(row.publication)),
      samples,
    );
  }

  return {
    async findById(workspaceId, id): PortResult<Publication | null> {
      try {
        return ok((await inWorkspace(workspaceId)).find((p) => p.id === id) ?? null);
      } catch (cause) {
        return storageFailure("配信の読み出し", cause);
      }
    },

    /**
     * 同じ内容がすでにあるかを探す。
     *
     * **見本も含めて探す。** 保存先だけを見ると、見本と同じ内容を
     * 登録できてしまい、一覧に同じものが 2 件並ぶ。
     */
    async findByIdempotencyKey(workspaceId, key): PortResult<Publication | null> {
      try {
        return ok((await inWorkspace(workspaceId)).find((p) => p.idempotencyKey === key) ?? null);
      } catch (cause) {
        return storageFailure("同じ配信があるかの確認", cause);
      }
    },

    async createIfAbsent(publication) {
      try {
        // 見本と同じ要求も新しく保存しない。見本を正本として成功で返す。
        const sample = samplePublications().find(
          (candidate) =>
            candidate.workspaceId === publication.workspaceId &&
            candidate.idempotencyKey === publication.idempotencyKey,
        );
        if (sample !== undefined) return ok({ publication: sample, created: false });

        const row = toPublicationRow(publication);
        // workspace_id + idempotency_key の一意境界をmigrationが持つ。
        // 競合は例外にせず、直後に勝者を読み直して同じ成功へ収束させる。
        const inserted = await db
          .insert(publications)
          .values(row)
          .onConflictDoNothing()
          .returning({ id: publications.id });
        const canonicalRows = await db
          .select()
          .from(publications)
          .where(
            and(
              eq(publications.workspaceId, String(publication.workspaceId)),
              eq(publications.idempotencyKey, publication.idempotencyKey),
            ),
          )
          .limit(1);
        const canonical = canonicalRows[0];
        if (canonical === undefined) {
          return storageFailure(
            "同じ配信の確定",
            new Error("publication canonical row was not found after insert"),
          );
        }
        return ok({ publication: toPublication(canonical), created: inserted.length > 0 });
      } catch (cause) {
        return storageFailure("配信の登録", cause);
      }
    },

    async listByVariant(workspaceId, variantId): PortResult<readonly Publication[]> {
      try {
        return ok((await inWorkspace(workspaceId)).filter((p) => p.variantId === variantId));
      } catch (cause) {
        return storageFailure("記事ごとの配信の取得", cause);
      }
    },

    /**
     * 時間が来たもの。
     *
     * ここだけは作業場所をまたいで探す（送る処理には呼び出し元の身元が無い）。
     * **見本は混ぜない。** 混ぜると、送る処理が見本を本物として拾い、
     * 実在しない接続へ送ろうとして毎回失敗が積み上がる。
     */
    async listDue(at: Date, limit: number): PortResult<readonly Publication[]> {
      try {
        const rows = await db
          .select()
          .from(publications)
          .where(
            and(
              inArray(publications.kind, EXTERNAL_DIRECT_CHANNEL_KINDS),
              or(
                and(
                  eq(publications.state, "QUEUED"),
                  or(isNull(publications.scheduledAt), lte(publications.scheduledAt, at)),
                ),
                and(
                  eq(publications.state, "RETRY_SCHEDULED"),
                  isNotNull(publications.retryAt),
                  lte(publications.retryAt, at),
                ),
                and(
                  eq(publications.state, "SENDING"),
                  isNotNull(publications.deliveryLeaseUntil),
                  lte(publications.deliveryLeaseUntil, at),
                ),
              ),
            ),
          )
          .orderBy(
            asc(sql`coalesce(${publications.retryAt}, ${publications.deliveryLeaseUntil}, ${publications.scheduledAt})`),
          )
          .limit(limit);
        return ok(rows.map(toPublication));
      } catch (cause) {
        return storageFailure("送る予定の配信の取得", cause);
      }
    },

    async compareAndSwap(before, next): PortResult<Publication | null> {
      try {
        const updated = await db
          .update(publications)
          .set(toPublicationRow(next))
          .where(
            and(...publicationVersionConditions(before)),
          )
          .returning();
        if (updated[0] !== undefined) return ok(toPublication(updated[0]));

        // 見本行はDBにまだ無い。古い版が現在の見本そのものなら、insert-if-absentで
        // 実データへ原子的に昇格させる。並行更新の敗者はreturningが空になりnullへ収束する。
        const sample = samplePublications().find((candidate) =>
          samePublicationVersion(candidate, before),
        );
        if (sample === undefined) return ok(null);
        const inserted = await db
          .insert(publications)
          .values(toPublicationRow(next))
          .onConflictDoNothing()
          .returning();
        return ok(inserted[0] === undefined ? null : toPublication(inserted[0]));
      } catch (cause) {
        return storageFailure("配信の送信権の確保", cause);
      }
    },

    async claimForDelivery(before, next): PortResult<Publication | null> {
      try {
        // 版を持たない旧Publicationは推測で送らない。
        if (before.variantRevision === null) return ok(null);
        const updated = await db
          .update(publications)
          .set(toPublicationRow(next))
          .where(
            and(
              ...publicationVersionConditions(before),
              // gate評価後に本文が変わる競合窓を閉じる。Publication CASと別SELECTに
              // 分けず、同じUPDATE文のEXISTS条件として現在版を検証する。
              sql`exists (
                select 1 from ${contentVariants}
                where ${contentVariants.workspaceId} = ${publications.workspaceId}
                  and ${contentVariants.id} = ${publications.variantId}
                  and ${contentVariants.revision} = ${before.variantRevision}
              )`,
            ),
          )
          .returning();
        return ok(updated[0] === undefined ? null : toPublication(updated[0]));
      } catch (cause) {
        return storageFailure("承認済み本文の版を確かめた送信権の確保", cause);
      }
    },

    async listRecent(workspaceId, limit, scope): PortResult<readonly Publication[]> {
      try {
        return ok(
          scope === undefined
            ? (await inWorkspace(workspaceId)).slice(0, limit)
            : await recentInBrandScope(workspaceId, scope.brandIds, limit),
        );
      } catch (cause) {
        return storageFailure("配信の一覧取得", cause);
      }
    },

    async listForCalendar(
      workspaceId,
      fromInclusive,
      toExclusive,
      scope,
    ): PortResult<readonly Publication[]> {
      try {
        if (scope !== undefined) {
          return ok(
            await calendarInBrandScope(
              workspaceId,
              scope.brandIds,
              fromInclusive,
              toExclusive,
            ),
          );
        }
        const rows = await db
          .select()
          .from(publications)
          .where(
            and(
              eq(publications.workspaceId, String(workspaceId)),
              or(
                isNull(publications.scheduledAt),
                and(
                  gte(publications.scheduledAt, fromInclusive),
                  lt(publications.scheduledAt, toExclusive),
                ),
              ),
            ),
          )
          .orderBy(desc(publications.scheduledAt));
        const samples = samplePublicationsForScope(workspaceId, undefined).filter(
          (publication) =>
            publication.scheduledAt === null ||
            (publication.scheduledAt >= fromInclusive && publication.scheduledAt < toExclusive),
        );
        return ok(mergeWithSamples(rows.map(toPublication), samples));
      } catch (cause) {
        return storageFailure("投稿カレンダーの取得", cause);
      }
    },

    async save(publication): PortResult<Publication> {
      try {
        const row = toPublicationRow(publication);
        // 同じ id で入れ直したときは上書きする（状態が進むたびに呼ばれるため）。
        // 見本の id を上書き保存すると、以後は保存されたほうが返る（`mergeWithSamples`）。
        await db.insert(publications).values(row).onConflictDoUpdate({
          target: publications.id,
          set: row,
        });
        return ok(publication);
      } catch (cause) {
        return storageFailure("配信の保存", cause);
      }
    },
  };
}
