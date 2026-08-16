import type { DomainEvent, EventPublisherPort, PortResult, TaskQueuePort } from "@/application/ports";
import { domainError, err, ok } from "@/domain/shared";
import { idGenerator } from "./id-generator";
import { logger } from "./logger";

/**
 * 後回しにできる仕事の受け渡し (Cloudflare Queues) と、ドメインイベントの発行。
 *
 * 初回リリースでは Queue を用意せず、同期で処理してよい (arch ADR)。
 * そのため「キューが無いときは同期で実行する」実装を用意し、
 * 呼び出し側のコードを後から書き換えずに済むようにしている。
 */
export type QueueLike<T> = {
  send(body: T, options?: { delaySeconds?: number }): Promise<void>;
};

export function createQueue<T>(queue: QueueLike<T>): TaskQueuePort<T> {
  return {
    async enqueue(task, options): PortResult<{ taskId: string }> {
      const taskId = idGenerator.newId();
      try {
        await queue.send(task, options?.delaySeconds ? { delaySeconds: options.delaySeconds } : undefined);
        return ok({ taskId });
      } catch {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "処理の受付に失敗しました。", { retryable: true }),
        );
      }
    },
  };
}

/**
 * キューを使わない構成。受け取った仕事をその場で実行する。
 *
 * 遅くはなるが、結果は同じになる。キューを足すときは組み立て部の 1 行を替えるだけ。
 */
export function createInlineQueue<T>(run: (task: T) => Promise<void>): TaskQueuePort<T> {
  return {
    async enqueue(task): PortResult<{ taskId: string }> {
      const taskId = idGenerator.newId();
      await run(task);
      return ok({ taskId });
    },
  };
}

/**
 * ドメインイベントの発行。
 *
 * 購読側 (通知・再生成・リンク切れ検出) がまだ無い間も、
 * イベントは記録だけしておく。あとから購読を足せる。
 */
export function createEventPublisher(
  sink: ((event: DomainEvent) => Promise<void>) | null,
): EventPublisherPort {
  return {
    async publish(event): PortResult<true> {
      logger.info("domain_event", {
        name: event.name,
        workspaceId: event.workspaceId,
        occurredAt: event.occurredAt.toISOString(),
      });
      if (sink !== null) await sink(event);
      return ok(true);
    },
  };
}
