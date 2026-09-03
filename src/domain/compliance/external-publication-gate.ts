import type { ContentVariant } from "../authoring";
import {
  evaluateBasePublicationPolicy,
  type GateFailure,
  type GateResult,
} from "./publish-gate";

/**
 * 外部媒体へ渡すContentVariantの公開前評価。予約時とworker送信時の唯一の正本。
 *
 * サイト記事向け `evaluatePublishGate` は、記事種別・節・次回確認日など
 * サイト固有のcandidateを評価する。この関数は値を捏造してそこへ流さず、
 * 外部媒体で実際に保存されているcandidate（人の承認・表現確認・広告表記・根拠）を評価する。
 * どちらもComplianceがGateResultを返し、Publicationの`advance`がその結果だけを見る。
 */
export function evaluateExternalPublicationGate(
  variant: Pick<
    ContentVariant,
    | "status"
    | "complianceStatus"
    | "disclosure"
    | "authorPersonaId"
    | "claimIds"
    | "evidenceIds"
  >,
): GateResult {
  const failures: GateFailure[] = [
    ...evaluateBasePublicationPolicy({
      authorIds: [String(variant.authorPersonaId)],
      disclosureRequired: true,
      disclosureVisibleMessage: variant.disclosure,
      claimCount: variant.claimIds.length,
      evidenceCount: variant.evidenceIds.length,
    }),
  ];
  if (variant.status !== "approved" && variant.status !== "published") {
    failures.push({
      requirement: "human_approval",
      message: "人が承認していない記事は外部媒体へ配信できません。",
    });
  }
  if (variant.complianceStatus === "fail") {
    failures.push({
      requirement: "policy_compliance",
      message: "コンプライアンス確認で不合格の記事は外部媒体へ配信できません。",
    });
  }
  return { ok: failures.length === 0, failures, skipped: [] };
}
