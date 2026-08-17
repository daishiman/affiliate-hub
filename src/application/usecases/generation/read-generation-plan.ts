import {
  GENERATION_AGENTS,
  GENERATION_INPUT_FIELDS,
  GENERATION_SKILLS,
  type GenerationInput,
  MAX_REVISION_ROUNDS,
  MAX_SCHEMA_RETRIES,
  OUTPUT_REQUIRED_FIELDS,
  PROMPT_BLOCKS,
  SELF_REPORTED_FIELDS,
  STAGE_BRIDGE,
  bridgeBreaches,
  generatedVariantJsonSchema,
  missingInputFields,
  promptPath,
  reviewMaterial,
  selfInspectionBreaches,
  separationBreaches,
  skillOrderBreaches,
} from "@/domain/generation";
import { requireCapability } from "@/domain/identity";
import { err, ok } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 生成の仕組みを読むユースケース。
 *
 * 「AI がどう書くか」を見せる画面ではない。
 * **何を渡し、何を渡さず、どこから先は人が決めるか**を見せる。
 * 仕組みが見えないと、出てきた文章を信じるかどうかを人が判断できない。
 *
 * ここは外部に何も問い合わせない。決めごとそのものを返す。
 */

export type GenerationPlan = {
  readonly promptVersion: string;
  readonly blocks: readonly {
    readonly id: string;
    readonly order: number;
    readonly label: string;
    readonly role: string;
    readonly mustNotContain: string;
  }[];
  readonly inputs: readonly {
    readonly key: string;
    readonly label: string;
    readonly why: string;
    readonly addedByDesign: boolean;
    readonly optionalWhen: string | null;
  }[];
  readonly skills: readonly {
    readonly id: string;
    readonly label: string;
    readonly responsibility: string;
    readonly startsWhen: string;
    readonly dependsOn: readonly string[];
    readonly agentLabel: string;
    readonly promptFile: string;
  }[];
  readonly agents: readonly {
    readonly id: string;
    readonly label: string;
    readonly kindLabel: string;
    readonly responsibility: string;
    readonly mustNot: string;
    readonly canGenerate: boolean;
    readonly freshContext: boolean;
  }[];
  readonly stages: readonly {
    readonly state: string;
    readonly label: string;
    readonly advancedBy: "ai" | "human";
    readonly why: string;
    readonly skillLabels: readonly string[];
  }[];
  readonly outputFields: readonly string[];
  /** 合否に使ってはならない欄。 */
  readonly selfReportedFields: readonly string[];
  readonly outputSchema: Readonly<Record<string, unknown>>;
  readonly maxSchemaRetries: number;
  readonly maxRevisionRounds: number;
  /** 決まりが崩れている箇所。空であることが正常。 */
  readonly breaches: readonly string[];
};

const AGENT_KIND_LABEL: Readonly<Record<string, string>> = {
  collect: "集める",
  write: "書く",
  verify: "確かめる",
  convert: "作り直す",
  integrate: "まとめる",
};

export function createReadGenerationPlanUseCase(): UseCase<
  { readonly promptVersion?: string },
  GenerationPlan
> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "生成の仕組みの確認");
      if (!allowed.ok) return err(allowed.error);

      const version = input.promptVersion ?? "v1";
      const agentLabel = new Map(GENERATION_AGENTS.map((a) => [a.id, a.label]));

      return ok({
        promptVersion: version,
        blocks: PROMPT_BLOCKS.map((b) => ({
          id: b.id,
          order: b.order,
          label: b.label,
          role: b.role,
          mustNotContain: b.mustNotContain,
        })),
        inputs: GENERATION_INPUT_FIELDS.map((f) => ({
          key: f.key,
          label: f.label,
          why: f.why,
          addedByDesign: f.addedByDesign,
          optionalWhen: f.optionalWhen,
        })),
        skills: GENERATION_SKILLS.map((s) => ({
          id: s.id,
          label: s.label,
          responsibility: s.responsibility,
          startsWhen: s.startsWhen,
          dependsOn: s.dependsOn,
          agentLabel: agentLabel.get(s.agentId) ?? s.agentId,
          promptFile: promptPath(version as `v${number}`, s.promptKind),
        })),
        agents: GENERATION_AGENTS.map((a) => ({
          id: a.id,
          label: a.label,
          kindLabel: AGENT_KIND_LABEL[a.kind] ?? a.kind,
          responsibility: a.responsibility,
          mustNot: a.mustNot,
          canGenerate: (a.tools as readonly string[]).includes("generate"),
          freshContext: a.freshContext,
        })),
        stages: STAGE_BRIDGE.map((s) => ({
          state: s.state,
          label: s.label,
          advancedBy: s.advancedBy,
          why: s.why,
          skillLabels: s.skillIds.map((id) => {
            const skill = GENERATION_SKILLS.find((x) => x.id === id);
            return skill?.label ?? id;
          }),
        })),
        outputFields: [...OUTPUT_REQUIRED_FIELDS],
        selfReportedFields: [...SELF_REPORTED_FIELDS],
        outputSchema: generatedVariantJsonSchema(),
        maxSchemaRetries: MAX_SCHEMA_RETRIES,
        maxRevisionRounds: MAX_REVISION_ROUNDS,
        breaches: [...separationBreaches(), ...selfInspectionBreaches(), ...skillOrderBreaches(), ...bridgeBreaches()],
      });
    },
  };
}

// --- 入力の充足を見る -------------------------------------------------------

export type InputReadiness = {
  readonly ready: boolean;
  readonly missing: readonly { readonly key: string; readonly label: string; readonly howToFill: string }[];
  /** そろっている欄の数 / 全体。 */
  readonly filled: number;
  readonly total: number;
  readonly blockedReason: string | null;
};

export function createCheckGenerationInputUseCase(): UseCase<
  { readonly provided?: Partial<GenerationInput> },
  InputReadiness
> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "生成に渡す項目の確認");
      if (!allowed.ok) return err(allowed.error);

      const provided = input.provided ?? {};
      const missing = missingInputFields(provided);
      const total = GENERATION_INPUT_FIELDS.length;
      return ok({
        ready: missing.length === 0,
        missing: missing.map((m) => ({ key: m.key, label: m.label, howToFill: m.howToFill })),
        filled: total - missing.length,
        total,
        blockedReason:
          missing.length === 0
            ? null
            : `${missing.length} 件そろっていないため、生成を始められません。足りないまま始めると、素材に無いことが本文に混ざります。`,
      });
    },
  };
}

// --- 取り込んだ文章を確かめる ----------------------------------------------

export type MaterialReviewResult = {
  readonly accepted: boolean;
  readonly heldReason: string | null;
  readonly findings: readonly {
    readonly patternId: string;
    readonly whatItTries: string;
    readonly excerpt: string;
  }[];
  readonly whatHappensNext: string;
};

export function createReviewMaterialUseCase(): UseCase<
  { readonly text: string },
  MaterialReviewResult
> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "取り込んだ文章の確認");
      if (!allowed.ok) return err(allowed.error);

      const review = reviewMaterial(input.text ?? "");
      return ok({
        accepted: review.accepted,
        heldReason: review.heldReason,
        findings: review.findings.map((f) => ({
          patternId: f.patternId,
          whatItTries: f.whatItTries,
          excerpt: f.excerpt,
        })),
        whatHappensNext: review.accepted
          ? "この文章は資料として渡せます。指示としては読ませません。"
          : "この文章は自動で消さずに保留にします。担当者が中身を見て、使うかどうかを決めてください。",
      });
    },
  };
}
