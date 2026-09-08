import type {
  ChannelConnectionRepositoryPort,
  ChannelConnectorPort,
  ChannelConnectorProviderPort,
  EditorialContentVariantRepositoryPort,
  IdGeneratorPort,
  PublicationDeliveryAuditFlushResult,
  PublicationDeliveryAuditOutboxPort,
  PublicationRepositoryPort,
} from "@/application/ports";
import { evaluateExternalPublicationGate } from "@/domain/compliance/external-publication-gate";
import { MAX_SEND_ATTEMPTS, advance, canRetry, claimPublicationForDelivery, recordSendFailure, recordSendSuccess, scheduleSendRetry, type Publication } from "@/domain/distribution/publication";
import { createPublicationDeliveryAudit } from "@/domain/distribution/delivery-audit";
import { isConnectionUsable } from "@/domain/distribution/channel";
import {
  type AuditLogId,
  type ChannelConnectionId,
  type DomainError,
  type Result,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";

const DEFAULT_LEASE_MS = 5 * 60_000;

export type ExecuteDuePublicationsDeps = {
  readonly publications: PublicationRepositoryPort;
  readonly connections: ChannelConnectionRepositoryPort;
  readonly variants: EditorialContentVariantRepositoryPort;
  readonly connectors: ChannelConnectorProviderPort;
  readonly deliveryAudits: PublicationDeliveryAuditOutboxPort;
  readonly ids: IdGeneratorPort;
};

export type ExecuteDuePublicationsResult = {
  readonly scanned: number;
  readonly claimed: number;
  readonly published: number;
  readonly retryScheduled: number;
  readonly failed: number;
  readonly skipped: number;
};

function publishInput(
  publication: Publication,
  connectionId: ChannelConnectionId,
  variant: {
    readonly title: string | null;
    readonly body: string;
    readonly disclosure: string;
  },
) {
  return {
    connectionId,
    idempotencyKey: publication.idempotencyKey,
    providerDeliveryKey: publication.providerDeliveryKey,
    title: variant.title,
    body: variant.body,
    imageKeys: [],
    scheduledAt: publication.scheduledAt,
    providerRecordCreatedAt: publication.providerRecordCreatedAt,
    disclosureText: variant.disclosure,
  } as const;
}

async function settleDeliveryState(
  deps: ExecuteDuePublicationsDeps,
  before: Publication,
  after: Publication,
  at: Date,
): Promise<Result<Publication | null, DomainError>> {
  const built = createPublicationDeliveryAudit({
    id: taggedString<"AuditLogId">(`al_${deps.ids.newId()}`) as AuditLogId,
    before,
    after,
    occurredAt: at,
  });
  if (!built.ok) return built;
  return deps.deliveryAudits.settle(before, after, built.value);
}

async function persistFailure(
  deps: ExecuteDuePublicationsDeps,
  before: Publication,
  message: string,
  at: Date,
): Promise<Result<boolean, DomainError>> {
  let failed: Publication;
  if (before.state === "QUEUED") {
    const rendering = advance(before, "RENDERING", { at });
    const validating = rendering.ok ? advance(rendering.value, "VALIDATING", { at }) : rendering;
    const validationFailed = validating.ok
      ? advance(validating.value, "FAILED_VALIDATION", { at })
      : validating;
    if (!validationFailed.ok) return validationFailed;
    failed = { ...validationFailed.value, lastError: message, deliveryLeaseUntil: null };
  } else {
    failed = recordSendFailure(before, message);
  }
  const settled = await settleDeliveryState(deps, before, failed, at);
  if (!settled.ok) return settled;
  return ok(settled.value !== null);
}

function unavailable(message: string): DomainError {
  return domainError("UPSTREAM_UNAVAILABLE", message, { retryable: true });
}

/**
 * actorを受け取らないcron専用入口。
 * workspaceはdue Publicationからだけ取り、接続・版の各repositoryへ同じ値を渡す。
 */
export async function executeDuePublications(
  deps: ExecuteDuePublicationsDeps,
  input: { readonly at: Date; readonly limit: number; readonly leaseMs?: number },
): Promise<Result<ExecuteDuePublicationsResult, DomainError>> {
  const due = await deps.publications.listDue(input.at, Math.max(1, Math.min(100, input.limit)));
  if (!due.ok) return due;

  const counts = { scanned: due.value.length, claimed: 0, published: 0, retryScheduled: 0, failed: 0, skipped: 0 };
  for (const candidate of due.value) {
    async function stop(message: string): Promise<Result<true, DomainError>> {
      const persisted = await persistFailure(deps, candidate, message, input.at);
      if (!persisted.ok) return persisted;
      if (persisted.value) counts.failed += 1;
      else counts.skipped += 1;
      return ok(true);
    }
    if (candidate.connectionId === null) {
      const stopped = await stop("送信先の接続がありません。");
      if (!stopped.ok) return stopped;
      continue;
    }
    const connectionId = candidate.connectionId;
    const connection = await deps.connections.findById(candidate.workspaceId, connectionId);
    if (!connection.ok || connection.value === null) {
      const stopped = await stop(connection.ok ? "送信先の接続が見つかりません。" : connection.error.message);
      if (!stopped.ok) return stopped;
      continue;
    }
    if (
      connection.value.workspaceId !== candidate.workspaceId ||
      connection.value.kind !== candidate.channelKind ||
      !isConnectionUsable(connection.value, input.at)
    ) {
      const stopped = await stop("送信先の接続は現在利用できません。");
      if (!stopped.ok) return stopped;
      continue;
    }
    const content = await deps.variants.findVersionedById(
      candidate.workspaceId,
      candidate.variantId,
    );
    if (!content.ok || content.value === null) {
      const stopped = await stop(content.ok ? "送信する記事が見つかりません。" : content.error.message);
      if (!stopped.ok) return stopped;
      continue;
    }
    if (
      candidate.variantRevision === null ||
      candidate.variantRevision !== content.value.revision
    ) {
      const stopped = await stop(
        "予約後に記事が変更されました。変更後の内容を人が承認し、配信を予約し直してください。",
      );
      if (!stopped.ok) return stopped;
      continue;
    }
    const gate = evaluateExternalPublicationGate(content.value.variant);
    if (!gate.ok) {
      const stopped = await stop(gate.failures.map((failure) => failure.message).join(" / "));
      if (!stopped.ok) return stopped;
      continue;
    }
    const providerIdentity = connection.value.providerIdentity;
    if (
      providerIdentity === null ||
      (candidate.providerIdentity !== null && candidate.providerIdentity !== providerIdentity)
    ) {
      const stopped = await stop(
        "送信先の本人確認情報が固定されていません。接続を登録し直してください。",
      );
      if (!stopped.ok) return stopped;
      continue;
    }
    const leaseUntil = new Date(input.at.getTime() + (input.leaseMs ?? DEFAULT_LEASE_MS));
    const providerLease = await deps.connections.acquireProviderDeliveryLease({
      kind: candidate.channelKind,
      providerIdentity,
      holderPublicationId: candidate.id,
      at: input.at,
      expiresAt: leaseUntil,
    });
    if (!providerLease.ok) return err(unavailable("送信先の利用順を確保できませんでした。"));
    if (providerLease.value === null) {
      counts.skipped += 1;
      continue;
    }

    try {
      // providerへ到達し得る処理はglobal DID leaseの勝者だけが実行する。
      const connectorResult = deps.connectors.forConnection(connection.value);
      if (!connectorResult.ok) {
        const stopped = await stop(connectorResult.error.message);
        if (!stopped.ok) return stopped;
        continue;
      }
      const connector: ChannelConnectorPort = connectorResult.value;
      if (connector.kind !== candidate.channelKind) {
        const stopped = await stop("送信先とコネクタの種類が一致しません。");
        if (!stopped.ok) return stopped;
        continue;
      }
      const ready = await connector.checkReadiness();
      if (!ready.ok) {
        const stopped = await stop(ready.error.message);
        if (!stopped.ok) return stopped;
        continue;
      }
      const draftInput = publishInput(candidate, connectionId, content.value.variant);
      const validation = await connector.validate(draftInput);
      if (!validation.ok || validation.value.length > 0) {
        const stopped = await stop(
          validation.ok ? validation.value.join(" / ") : validation.error.message,
        );
        if (!stopped.ok) return stopped;
        continue;
      }
      const deliveryKey =
        candidate.providerDeliveryKey === null
          ? await connector.prepareDeliveryKey(draftInput, input.at)
          : ok(candidate.providerDeliveryKey);
      if (!deliveryKey.ok) {
        const stopped = await stop(deliveryKey.error.message);
        if (!stopped.ok) return stopped;
        continue;
      }
      const providerRecordCreatedAt =
        candidate.providerRecordCreatedAt ?? candidate.scheduledAt ?? input.at;
      const claimedDomain = claimPublicationForDelivery(candidate, {
        at: input.at,
        leaseUntil,
        providerIdentity,
        providerDeliveryKey: deliveryKey.value,
        providerRecordCreatedAt,
        gate,
      });
      if (!claimedDomain.ok) {
        // MAXのFAILED_SENDなど、再送対象ではない行を外部へ送らない。
        counts.skipped += 1;
        continue;
      }
      const claimed = await deps.publications.claimForDelivery(candidate, claimedDomain.value);
      if (!claimed.ok) return err(unavailable("配信の送信権を確保できませんでした。"));
      if (claimed.value === null) {
        // gate評価後〜claimの間に本文が変わった場合も、外部へ送らず明示的に止める。
        // Publication側の別更新（取消など）が競合しただけなら、その更新を尊重してskipする。
        const latest = await deps.variants.findVersionedById(
          candidate.workspaceId,
          candidate.variantId,
        );
        if (
          latest.ok &&
          latest.value !== null &&
          (candidate.variantRevision === null ||
            latest.value.revision !== candidate.variantRevision)
        ) {
          const stopped = await stop(
            "送信直前に記事が変更されました。変更後の内容を人が承認し、配信を予約し直してください。",
          );
          if (!stopped.ok) return stopped;
        } else {
          counts.skipped += 1;
        }
        continue;
      }
      counts.claimed += 1;
      const sent = await connector.publish(
        publishInput(claimed.value, connectionId, content.value.variant),
      );
      if (sent.ok) {
        const published = recordSendSuccess(
          claimed.value,
          { id: sent.value.externalId, url: sent.value.externalUrl },
          sent.value.publishedAt,
        );
        const settled = await settleDeliveryState(deps, claimed.value, published, input.at);
        if (!settled.ok) return err(unavailable("投稿済み状態を保存できませんでした。"));
        if (settled.value === null) {
          counts.skipped += 1;
          continue;
        }
        counts.published += 1;
        continue;
      }

      const failed = recordSendFailure(claimed.value, sent.error.message);
      const finalState = canRetry(failed, sent.error.retryable)
        ? scheduleSendRetry(failed, input.at)
        : failed;
      const settled = await settleDeliveryState(deps, claimed.value, finalState, input.at);
      if (!settled.ok) return err(unavailable("投稿の失敗状態を保存できませんでした。"));
      if (settled.value === null) {
        counts.skipped += 1;
        continue;
      }
      if (finalState.state === "RETRY_SCHEDULED") counts.retryScheduled += 1;
      else counts.failed += 1;
    } finally {
      // Worker停止時はfinally自体が走らないことがあるため、leaseは期限でも必ず失効する。
      await deps.connections.releaseProviderDeliveryLease({
        kind: candidate.channelKind,
        providerIdentity,
        holderPublicationId: candidate.id,
        leaseToken: providerLease.value,
      });
    }
  }
  return ok(counts);
}

export const DISTRIBUTION_MAX_SEND_ATTEMPTS = MAX_SEND_ATTEMPTS;

/** 外部投稿とは独立に、outboxの監査だけを再試行するcron入口。 */
export function flushPublicationDeliveryAudits(
  deps: Pick<ExecuteDuePublicationsDeps, "deliveryAudits">,
  input: { readonly limit: number },
): Promise<Result<PublicationDeliveryAuditFlushResult, DomainError>> {
  return deps.deliveryAudits.flush(Math.max(1, Math.min(200, input.limit)));
}
