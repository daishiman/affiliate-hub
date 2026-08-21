import type { FeedbackCaptureStoragePort, FeedbackRepositoryPort } from "@/application/ports/feedback";
import {
  type FeedbackHistoryEntry,
  type FeedbackReport,
  FEEDBACK_DISPOSITION_LABELS,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_STATUS_LABELS,
  HANDOFF_HISTORY_EMPTY_TEXT,
  HANDOFF_IDEMPOTENCY_TEXT,
  HANDOFF_ROUTE_LABELS,
  WISH_ABSENT_TEXT,
} from "@/domain/feedback";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  asFeedbackCaptureId,
  notFound,
  ok,
  err,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 改善要望を 1 件読む。
 *
 * **無いものは「無い」と書いて返す。** 空欄のまま画面へ渡すと、
 * 読む側は「まだ読み込み中か」「そもそも項目が無いのか」を区別できない。
 * 技術情報は件数を先に返し、中身は折りたたんで出せる形にする。
 */
export type ReadFeedbackDeps = {
  readonly repository: FeedbackRepositoryPort;
  readonly captures: FeedbackCaptureStoragePort;
};

export type ReadFeedbackInput = {
  readonly id: string;
};

export type HandoffHistoryRow = {
  readonly at: Date;
  readonly routeLabel: string;
  readonly actor: string;
  /** どの鍵で。人がコピーしたときは null。**鍵の値そのものは出さない。** */
  readonly keyId: string | null;
};

export type ReadFeedbackOutput = {
  readonly id: string;
  readonly kindLabel: string;
  readonly body: string;
  /** 記入が無ければ、無いと書いた文が入る。空文字にしない。 */
  readonly wishText: string;
  readonly wishProvided: boolean;
  readonly screenName: string;
  readonly url: string;
  readonly route: string;
  readonly workspaceId: string;
  readonly brandId: string | null;
  readonly siteId: string | null;
  readonly statusLabel: string;
  readonly dispositionLabel: string | null;
  readonly dispositionReason: string | null;
  readonly submittedAt: Date;
  /** 画像を見るための一時的な URL。無い・期限切れなら null。 */
  readonly captureUrl: string | null;
  readonly captureAbsentReason: string | null;
  readonly jsErrorCount: number;
  readonly failedRequestCount: number;
  readonly redactedCount: number;
  readonly technical: FeedbackReport["technical"];
  readonly handoffCount: number;
  readonly handoffHistory: readonly HandoffHistoryRow[];
  readonly handoffHistoryEmptyText: string;
  readonly handoffIdempotencyText: string;
  readonly beadsIssueId: string | null;
  readonly history: readonly FeedbackHistoryEntry[];
};

const CAPTURE_VIEW_SECONDS = 300;

export function createReadFeedbackUseCase(
  deps: ReadFeedbackDeps,
): UseCase<ReadFeedbackInput, ReadFeedbackOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ReadFeedbackInput,
    ): Promise<Result<ReadFeedbackOutput, DomainError>> {
      const allowed = requireCapability(actor, "feedback.read", "改善要望の参照");
      if (!allowed.ok) return allowed;

      const found = await deps.repository.findById(actor.workspaceId, input.id);
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("改善要望", input.id));
      const report = found.value;

      let captureUrl: string | null = null;
      let captureAbsentReason: string | null = null;
      if (report.captureId === null) {
        captureAbsentReason = "画像は付いていません（文章だけで送られました）。";
      } else {
        const url = await deps.captures.signedUrl(
          actor.workspaceId,
          asFeedbackCaptureId(String(report.captureId)),
          CAPTURE_VIEW_SECONDS,
        );
        if (url.ok) captureUrl = url.value;
        // 取り出せない理由を黙らない。保存期間を過ぎている場合が一番多い。
        else captureAbsentReason = url.error.message;
      }

      return ok({
        id: String(report.id),
        kindLabel: FEEDBACK_KIND_LABELS[report.kind],
        body: report.body,
        wishText: report.wish ?? WISH_ABSENT_TEXT,
        wishProvided: report.wish !== null,
        screenName: report.origin.screenName,
        url: report.origin.url,
        route: report.origin.route,
        workspaceId: String(report.workspaceId),
        brandId: report.brandId === null ? null : String(report.brandId),
        siteId: report.siteId === null ? null : String(report.siteId),
        statusLabel: FEEDBACK_STATUS_LABELS[report.status],
        dispositionLabel:
          report.disposition === null
            ? null
            : FEEDBACK_DISPOSITION_LABELS[report.disposition.kind],
        dispositionReason: report.disposition?.reason ?? null,
        submittedAt: report.submittedAt,
        captureUrl,
        captureAbsentReason,
        jsErrorCount: report.technical.jsErrors.length,
        failedRequestCount: report.technical.failedRequests.length,
        redactedCount: report.technical.redactedCount,
        technical: report.technical,
        handoffCount: report.handoff.count,
        handoffHistory: report.handoff.entries.map((e) => ({
          at: e.at,
          routeLabel: HANDOFF_ROUTE_LABELS[e.route],
          actor: e.actor,
          keyId: e.keyId,
        })),
        handoffHistoryEmptyText: HANDOFF_HISTORY_EMPTY_TEXT,
        handoffIdempotencyText: HANDOFF_IDEMPOTENCY_TEXT,
        beadsIssueId: report.beadsIssueId,
        history: report.history,
      });
    },
  };
}
