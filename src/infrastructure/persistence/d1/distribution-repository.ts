import { and, asc, desc, eq, isNotNull, lte } from "drizzle-orm";
import type { PageRequest, Paged, PortResult } from "@/application/ports/common";
import type {
  ChannelConnectionRepositoryPort,
  PublicationRepositoryPort,
} from "@/application/ports/distribution";
import type { ChannelConnection, Publication } from "@/domain/distribution";
import {
  type ChannelConnectionId,
  type ContentVariantId,
  type PublicationId,
  type WorkspaceId,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";
import {
  channelConnections,
  publications,
  type ChannelConnectionRow,
  type PublicationRow,
} from "@/db/schema";
import {
  sampleChannelConnections,
  samplePublications,
} from "../sample/distribution-sample-repository";
import type { DrizzleD1 } from "./link-inbox-repository";

/**
 * 配信の保存先（D1）。
 *
 * **これはスタブではない。** 見本データ版と同じ契約を満たす、実際に保存する実装。
 *
 * 見本を消さずに合わせて返す。`site-repository.ts` と同じ扱いにしてある。
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

/** 保存先が落ちたときの返し方。**握りつぶさない。** */
function storageFailure(what: string, cause: unknown) {
  return err(
    domainError("UPSTREAM_UNAVAILABLE", `${what}に失敗しました。時間をおいてもう一度お試しください。`, {
      retryable: true,
      suggestedAction: "何度も続く場合は、保存先の状態を確認してください。",
      // 例外の中身はそのまま出さない。接続文字列が混じることがある。
      details: { reason: cause instanceof Error ? cause.name : "unknown" },
    }),
  );
}

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
    credentialRef: item.credentialRef,
  };
}

function toPublication(row: PublicationRow): Publication {
  return {
    id: taggedString<"PublicationId">(row.id) as PublicationId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    variantId: taggedString<"ContentVariantId">(row.variantId) as ContentVariantId,
    channelKind: row.kind,
    connectionId:
      row.connectionId === null
        ? null
        : (taggedString<"ChannelConnectionId">(row.connectionId) as ChannelConnectionId),
    state: row.state,
    scheduledAt: row.scheduledAt,
    idempotencyKey: row.idempotencyKey,
    attempts: row.attempts,
    externalId: row.externalId,
    externalUrl: row.externalUrl,
    lastError: row.lastError,
    publishedAt: row.publishedAt,
  };
}

function toPublicationRow(item: Publication): PublicationRow {
  return {
    id: String(item.id),
    workspaceId: String(item.workspaceId),
    variantId: String(item.variantId),
    kind: item.channelKind,
    connectionId: item.connectionId === null ? null : String(item.connectionId),
    state: item.state,
    scheduledAt: item.scheduledAt,
    idempotencyKey: item.idempotencyKey,
    attempts: item.attempts,
    externalId: item.externalId,
    externalUrl: item.externalUrl,
    lastError: item.lastError,
    publishedAt: item.publishedAt,
  };
}

/**
 * 保存された分と見本を重ねる。
 *
 * **保存されたほうを先に置いてから見本で埋める。** 逆にすると、
 * 見本と同じ ID を保存し直しても古い見本が返り、取りやめが効かなくなる。
 */
function mergeWithSamples<T extends { readonly id: unknown }>(
  stored: readonly T[],
  samples: readonly T[],
): readonly T[] {
  const taken = new Set(stored.map((item) => String(item.id)));
  return [...stored, ...samples.filter((item) => !taken.has(String(item.id)))];
}

export function createD1ChannelConnectionRepository(db: DrizzleD1): ChannelConnectionRepositoryPort {
  async function all(workspaceId: WorkspaceId): Promise<readonly ChannelConnection[]> {
    const rows = await db
      .select()
      .from(channelConnections)
      .where(eq(channelConnections.workspaceId, String(workspaceId)));
    return mergeWithSamples(
      rows.map(toConnection),
      sampleChannelConnections().filter((c) => c.workspaceId === workspaceId),
    );
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
        // 出し先はチャネルの数（10 種）が上限なので、その場で切る。
        // 保存先で切ると、見本と重ねたあとの件数と合わなくなる。
        const items = (await all(workspaceId)).slice(0, page.limit);
        return ok({ items, nextCursor: null });
      } catch (cause) {
        return storageFailure("出し先の一覧取得", cause);
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
              eq(publications.state, "QUEUED"),
              isNotNull(publications.scheduledAt),
              lte(publications.scheduledAt, at),
            ),
          )
          .orderBy(asc(publications.scheduledAt))
          .limit(limit);
        return ok(rows.map(toPublication));
      } catch (cause) {
        return storageFailure("送る予定の配信の取得", cause);
      }
    },

    async listRecent(workspaceId, limit): PortResult<readonly Publication[]> {
      try {
        return ok((await inWorkspace(workspaceId)).slice(0, limit));
      } catch (cause) {
        return storageFailure("配信の一覧取得", cause);
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
