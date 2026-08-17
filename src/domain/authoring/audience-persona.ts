import {
  type AudiencePersonaId,
  type DomainError,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";
import type { KnowledgeLevel } from "./author-persona";

/**
 * 読者ペルソナ (プラットフォーム層 §14)。
 *
 * 「誰に向けて書くか」を固定する。ここが空だと、AI は必ず
 * 「誰にでも当てはまるが誰にも刺さらない文章」を書く。
 */
export type AwarenessStage = "unaware" | "problem_aware" | "solution_aware" | "product_aware";
export type DetailLevel = "short" | "standard" | "detailed";

export type AudiencePersona = {
  readonly id: AudiencePersonaId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  /** この読者が片付けたい用事。1 文で書く。 */
  readonly primaryJob: string;
  readonly currentSituation: string;
  readonly desiredOutcome: string;
  readonly knowledgeLevel: KnowledgeLevel;
  readonly awarenessStage: AwarenessStage;
  readonly painPoints: readonly string[];
  readonly objections: readonly string[];
  readonly decisionCriteria: readonly string[];
  readonly budgetContext: string | null;
  readonly timeContext: string | null;
  readonly trustRequirements: readonly string[];
  readonly preferredDetailLevel: DetailLevel;
  readonly preferredTone: string;
  readonly preferredChannels: readonly string[];
  readonly commonQuestions: readonly string[];
  readonly desiredEmotionalState: string;
  readonly nextAction: string;
  /** 「当然知っている」と決めつけてはいけないこと。 */
  readonly prohibitedAssumptions: readonly string[];
};

export function createAudiencePersona(input: {
  id: AudiencePersonaId;
  workspaceId: WorkspaceId;
  name: string;
  primaryJob: string;
  currentSituation?: string;
  desiredOutcome: string;
  knowledgeLevel: KnowledgeLevel;
  awarenessStage: AwarenessStage;
  painPoints?: readonly string[];
  objections?: readonly string[];
  decisionCriteria: readonly string[];
  budgetContext?: string | null;
  timeContext?: string | null;
  trustRequirements?: readonly string[];
  preferredDetailLevel?: DetailLevel;
  preferredTone?: string;
  preferredChannels?: readonly string[];
  commonQuestions?: readonly string[];
  desiredEmotionalState: string;
  nextAction: string;
  prohibitedAssumptions?: readonly string[];
}): Result<AudiencePersona, DomainError> {
  if (input.name.trim() === "") {
    return err(validationError("読者ペルソナの名前が空です。", "name"));
  }
  if (input.primaryJob.trim() === "") {
    return err(
      validationError("この読者が片付けたい用事が空です。誰に向けて書くか決まりません。", "primaryJob"),
    );
  }
  if (input.decisionCriteria.length === 0) {
    return err(
      validationError(
        "判断条件が 1 つもありません。比較表の列と結論の根拠がこれで決まります。",
        "decisionCriteria",
      ),
    );
  }
  if (input.nextAction.trim() === "") {
    return err(validationError("読み終えた読者にしてほしい行動が空です。", "nextAction"));
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    name: input.name,
    primaryJob: input.primaryJob,
    currentSituation: input.currentSituation ?? "",
    desiredOutcome: input.desiredOutcome,
    knowledgeLevel: input.knowledgeLevel,
    awarenessStage: input.awarenessStage,
    painPoints: input.painPoints ?? [],
    objections: input.objections ?? [],
    decisionCriteria: input.decisionCriteria,
    budgetContext: input.budgetContext ?? null,
    timeContext: input.timeContext ?? null,
    trustRequirements: input.trustRequirements ?? [],
    preferredDetailLevel: input.preferredDetailLevel ?? "standard",
    preferredTone: input.preferredTone ?? "",
    preferredChannels: input.preferredChannels ?? [],
    commonQuestions: input.commonQuestions ?? [],
    desiredEmotionalState: input.desiredEmotionalState,
    nextAction: input.nextAction,
    prohibitedAssumptions: input.prohibitedAssumptions ?? [],
  });
}
