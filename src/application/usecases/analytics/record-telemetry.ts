import type { TelemetrySinkPort } from "@/application/ports/telemetry";
import { DEFAULT_CONSENT_SIGNALS, decideConsent, mayRecord, type ConsentDecision, type ConsentSignals } from "@/domain/analytics/consent";
import { buildTelemetryEvent, type TelemetryEvent, type TelemetryEventKey } from "@/domain/analytics/telemetry-events";
import { type ActorContext, type DomainError, type Result, ok } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 計測を受け取って記録するユースケース。
 *
 * **入口をここ 1 つにする。** 画面から保存先へ直接書く道を作ると、
 * その道だけ同意の判定を通らない、という状態が必ず生まれる。
 * 同意の判定は domain (`decideConsent` / `mayRecord`) が持ち、
 * ここはそれに従って捨てるか通すかを決めるだけにする。
 *
 * 落としたものは黙って消さず、`droppedByConsent` として件数を返す。
 * 「送ったのに数字に出ない」の原因が同意なのか不具合なのかを、
 * 開発中に切り分けられるようにするため。
 */
export type RecordTelemetryDeps = {
  readonly sink: TelemetrySinkPort;
};

export type IncomingEvent = {
  readonly key: string;
  readonly occurredAt?: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type RecordTelemetryInput = {
  readonly events: readonly IncomingEvent[];
  readonly signals?: Partial<ConsentSignals>;
  /** ブラウザ側で作った使い捨ての目印。同意が無ければ使わない。 */
  readonly readerKey?: string | null;
};

export type RecordTelemetryOutput = {
  readonly accepted: number;
  readonly droppedByConsent: number;
  readonly rejectedAsInvalid: readonly string[];
  readonly decision: ConsentDecision;
};

export function createRecordTelemetryUseCase(
  deps: RecordTelemetryDeps,
): UseCase<RecordTelemetryInput, RecordTelemetryOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: RecordTelemetryInput,
    ): Promise<Result<RecordTelemetryOutput, DomainError>> {
      // 権限を要求しない。読者は誰でもなく、ログインもしていない。
      // ここで権限を求めると、読者の計測が一切通らなくなる。
      const signals: ConsentSignals = { ...DEFAULT_CONSENT_SIGNALS, ...input.signals };
      const decision = decideConsent(signals);

      const accepted: TelemetryEvent[] = [];
      const rejected: string[] = [];
      let dropped = 0;

      for (const raw of input.events) {
        const key = raw.key as TelemetryEventKey;
        const built = buildTelemetryEvent({
          key,
          occurredAt: raw.occurredAt ? new Date(raw.occurredAt) : new Date(),
          readerKey: decision.allowReaderKey ? (input.readerKey ?? null) : null,
          payload: raw.payload,
        });
        if (!built.ok) {
          // 1 件おかしくても、残りは記録する。
          // まとめて送る作りなので、1 件で全部を捨てると計測が丸ごと消える。
          rejected.push(built.error.message);
          continue;
        }
        if (!mayRecord(key, decision)) {
          dropped += 1;
          continue;
        }
        accepted.push(built.value);
      }

      if (accepted.length > 0) {
        const written = await deps.sink.recordBatch(actor.workspaceId, accepted);
        if (!written.ok) {
          // **記録の失敗を呼び出し側の失敗にしない。**
          // 読者の画面はここの成否と無関係に動く必要がある。
          return ok({
            accepted: 0,
            droppedByConsent: dropped,
            rejectedAsInvalid: [...rejected, written.error.message],
            decision,
          });
        }
      }

      return ok({
        accepted: accepted.length,
        droppedByConsent: dropped,
        rejectedAsInvalid: rejected,
        decision,
      });
    },
  };
}
