import type {
  FeedbackRepositoryPort,
  HandoffTemplatePort,
} from "@/application/ports/feedback";
import {
  type FeedbackReport,
  type HandoffRoute,
  HANDOFF_IDEMPOTENCY_TEXT,
  WISH_ABSENT_TEXT,
  appendHistory,
  assertEnvelopeIsClean,
  composeHandoffPrompt,
  recordHandoff,
} from "@/domain/feedback";
import { requireCapability } from "@/domain/identity";
import { type ActorContext, type DomainError, type Result, err, notFound, ok } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 指示文を作って払い出す。
 *
 * 1 件でも複数件でも**同じ道**を通る。まとめて渡す機能を別に書くと、
 * 片方だけに歯止め（封筒の検査）が入っていない状態がいつか生まれる。
 *
 * 払い出しは「渡した記録を残すこと」であって、要望の中身を変えない。
 * 同じ要望からは何度でも同じ指示文が出る（`HANDOFF_IDEMPOTENCY_TEXT`）。
 */
export type HandOffFeedbackDeps = {
  readonly repository: FeedbackRepositoryPort;
  readonly templates: HandoffTemplatePort;
  readonly now: () => Date;
};

export type HandOffFeedbackInput = {
  readonly ids: readonly string[];
  readonly route: HandoffRoute;
  /** 取りに来た経路のときだけ。人がコピーしたときは null。 */
  readonly keyId?: string | null;
  readonly keyLabel?: string | null;
  /**
   * 記録を残さずに文面だけ見る（画面の下読み用）。
   * 既定は false。**見ただけで「渡した」ことにしない。**
   */
  readonly previewOnly?: boolean;
};

export type HandoffPromptRow = {
  readonly reportId: string;
  readonly text: string;
  readonly userBlock: string;
  readonly fingerprint: string;
  readonly templateVersion: string;
};

export type HandOffFeedbackOutput = {
  readonly prompts: readonly HandoffPromptRow[];
  /** 渡せなかったものと理由。黙って落とさない。 */
  readonly skipped: readonly { readonly reportId: string; readonly reason: string }[];
  readonly idempotencyText: string;
};

function envelopeOf(report: FeedbackReport) {
  return {
    kind: report.kind,
    screenName: report.origin.screenName,
    url: report.origin.url,
    route: report.origin.route,
    workspaceId: String(report.workspaceId),
    brandId: report.brandId === null ? null : String(report.brandId),
    siteId: report.siteId === null ? null : String(report.siteId),
    jsErrorCount: report.technical.jsErrors.length,
    failedRequestCount: report.technical.failedRequests.length,
    redactedCount: report.technical.redactedCount,
  };
}

export function createHandOffFeedbackUseCase(
  deps: HandOffFeedbackDeps,
): UseCase<HandOffFeedbackInput, HandOffFeedbackOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: HandOffFeedbackInput,
    ): Promise<Result<HandOffFeedbackOutput, DomainError>> {
      const allowed = requireCapability(actor, "feedback.read", "改善要望の払い出し");
      if (!allowed.ok) return allowed;
      if (input.ids.length === 0) {
        return err(notFound("払い出す改善要望", "（1 件も選ばれていません）"));
      }

      const template = await deps.templates.current();
      if (!template.ok) return template;

      const at = deps.now();
      const prompts: HandoffPromptRow[] = [];
      const skipped: { reportId: string; reason: string }[] = [];

      for (const id of input.ids) {
        const found = await deps.repository.findById(actor.workspaceId, id);
        if (!found.ok) {
          skipped.push({ reportId: id, reason: found.error.message });
          continue;
        }
        if (found.value === null) {
          skipped.push({ reportId: id, reason: "見つかりませんでした。" });
          continue;
        }
        const report = found.value;

        const composed = composeHandoffPrompt({
          envelopeTemplate: template.value.template,
          envelope: envelopeOf(report),
          body: report.body,
          wish: report.wish,
          wishAbsentText: WISH_ABSENT_TEXT,
        });
        if (!composed.ok) {
          skipped.push({ reportId: id, reason: composed.error.message });
          continue;
        }
        // 封筒の検査は 1 件ずつ通す。まとめて 1 回にすると、
        // 1 件でも汚れていたときに全部止めるか全部通すかの二択になる。
        const clean = assertEnvelopeIsClean(composed.value);
        if (!clean.ok) {
          skipped.push({ reportId: id, reason: clean.error.message });
          continue;
        }

        if (input.previewOnly !== true) {
          const recorded = recordHandoff(report.handoff, {
            at,
            route: input.route,
            actor: input.keyLabel ?? actor.userId,
            keyId: input.route === "pulled_by_agent" ? (input.keyId ?? null) : null,
            promptFingerprint: clean.value.fingerprint,
          });
          if (!recorded.ok) {
            skipped.push({ reportId: id, reason: recorded.error.message });
            continue;
          }
          const updated = appendHistory(
            { ...report, handoff: recorded.value },
            {
              at,
              by: input.keyLabel ?? actor.userId,
              summary:
                input.route === "pulled_by_agent"
                  ? `Claude Code が取得しました（鍵: ${input.keyLabel ?? input.keyId ?? "不明"}）。`
                  : "指示文をコピーしました。",
            },
          );
          const saved = await deps.repository.save(actor.workspaceId, updated);
          if (!saved.ok) {
            skipped.push({ reportId: id, reason: saved.error.message });
            continue;
          }
        }

        prompts.push({
          reportId: String(report.id),
          text: clean.value.text,
          userBlock: clean.value.userBlock,
          fingerprint: clean.value.fingerprint,
          templateVersion: template.value.version,
        });
      }

      return ok({ prompts, skipped, idempotencyText: HANDOFF_IDEMPOTENCY_TEXT });
    },
  };
}
