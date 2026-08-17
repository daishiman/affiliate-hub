import type { FeedbackCaptureStoragePort, FeedbackRepositoryPort } from "@/application/ports/feedback";
import type { IdGeneratorPort } from "@/application/ports/common";
import {
  type CaptureSubmission,
  type FeedbackKind,
  type FeedbackOrigin,
  type TechnicalContext,
  assertCaptureIsStorable,
  createFeedbackReport,
} from "@/domain/feedback";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  asBrandId,
  asFeedbackCaptureId,
  asFeedbackReportId,
  asSiteId,
  asUserId,
  ok,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 改善要望を受け取るユースケース。
 *
 * **画像が無くても要望は成立する。** 画像の保存に失敗したときに要望ごと落とすと、
 * 「送ったのに残っていない」が起きる。画像は付属物として扱い、
 * 失敗したら画像なしで残したうえで、その旨を返す。
 */
export type SubmitFeedbackDeps = {
  readonly repository: FeedbackRepositoryPort;
  readonly captures: FeedbackCaptureStoragePort;
  readonly ids: IdGeneratorPort;
  readonly now: () => Date;
};

export type SubmitFeedbackInput = {
  readonly kind: FeedbackKind;
  readonly body: string;
  readonly wish?: string | null;
  readonly origin: FeedbackOrigin;
  readonly technical: TechnicalContext;
  readonly brandId?: string | null;
  readonly siteId?: string | null;
  /** 画像。付けないことを常に選べる。 */
  readonly capture?: {
    readonly image: ArrayBuffer;
    readonly submission: CaptureSubmission;
  } | null;
};

export type SubmitFeedbackOutput = {
  readonly reportId: string;
  readonly captureStored: boolean;
  /** 画像を付けられなかったときの理由。付けなかった／成功したときは null。 */
  readonly captureIssue: string | null;
};

export function createSubmitFeedbackUseCase(
  deps: SubmitFeedbackDeps,
): UseCase<SubmitFeedbackInput, SubmitFeedbackOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: SubmitFeedbackInput,
    ): Promise<Result<SubmitFeedbackOutput, DomainError>> {
      const allowed = requireCapability(actor, "feedback.submit", "改善要望の送信");
      if (!allowed.ok) return allowed;

      const at = deps.now();
      const reportId = asFeedbackReportId(deps.ids.newId());

      // 画像を先に片付ける。要望を作ってから画像で失敗すると、
      // 「保存済みの要望に後から画像を足す」経路が要る。経路が増えるほど抜けができる。
      let captureId = null as ReturnType<typeof asFeedbackCaptureId> | null;
      let captureIssue: string | null = null;
      if (input.capture) {
        const storable = assertCaptureIsStorable(input.capture.submission);
        if (!storable.ok) {
          captureIssue = storable.error.message;
        } else {
          const id = asFeedbackCaptureId(deps.ids.newId());
          const put = await deps.captures.put(
            actor.workspaceId,
            id,
            input.capture.image,
            input.capture.submission,
          );
          if (put.ok) captureId = id;
          else captureIssue = put.error.message;
        }
      }

      const created = createFeedbackReport({
        id: reportId,
        workspaceId: actor.workspaceId,
        brandId: input.brandId ? asBrandId(input.brandId) : null,
        siteId: input.siteId ? asSiteId(input.siteId) : null,
        kind: input.kind,
        body: input.body,
        wish: input.wish,
        origin: input.origin,
        technical: input.technical,
        captureId,
        submittedBy: asUserId(actor.userId),
        at,
      });
      if (!created.ok) return created;

      const saved = await deps.repository.save(actor.workspaceId, created.value);
      if (!saved.ok) return saved;

      return ok({
        reportId: String(reportId),
        captureStored: captureId !== null,
        captureIssue,
      });
    },
  };
}
