import type { FeedbackReport } from "@/domain/feedback";
import {
  type ActorContext,
  type DomainError,
  type Result,
  assertBrandScope,
  assertSameTenant,
  err,
  ok,
} from "@/domain/shared";

/** workspace 所有とmembershipのbrand scopeを、feedbackの全入口で同じ順序で確認する。 */
export function ensureFeedbackAccess(
  actor: ActorContext,
  report: FeedbackReport,
): Result<FeedbackReport, DomainError> {
  const owned = assertSameTenant(actor, report, "改善要望");
  if (!owned.ok) return owned;
  const scoped = assertBrandScope(actor, report.brandId, "改善要望");
  return scoped.ok ? ok(report) : err(scoped.error);
}
