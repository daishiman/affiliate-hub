import type { EditorialPersonaRepositoryPort } from "@/application/ports/authoring";
import {
  type AudiencePersona,
  type AuthorPersona,
  type FactBoundaryViolation,
  checkFactBoundary,
  checkProhibitedPhrases,
} from "@/domain/authoring";
import { requireCapability } from "@/domain/identity";
import {
  type AudiencePersonaId,
  type AuthorPersonaId,
  type DomainError,
  type Result,
  err,
  notFound,
  ok,
  taggedString,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 書き手と読者像の管理（プラットフォーム層 §13・§14）。
 *
 * **「誰が」「誰に向けて」書くかを決める場所。**
 * ここが空だと、AI は誰にでも当てはまるが誰にも刺さらない文章を書く。
 *
 * この文脈は Editorial 区分。報酬のつなぎ目は受け取らない。
 */
export type ManagePersonasDeps = {
  readonly personas: EditorialPersonaRepositoryPort;
  /**
   * 検証記録の照会。
   * 一人称の体験を書いてよいかは「その書き手の実測記録があるか」で決まるので、
   * 記録の有無を知る手段が要る。**報酬のつなぎ目はここに現れない。**
   */
  readonly affiliateLinks?: never;
};

const KNOWLEDGE_LABEL: Readonly<Record<AuthorPersona["knowledgeLevel"], string>> = {
  beginner: "はじめての人",
  intermediate: "ある程度慣れている人",
  expert: "詳しい人",
};

const PERSONA_TYPE_LABEL: Readonly<Record<AuthorPersona["personaType"], string>> = {
  real_person: "実在の人物",
  editorial_team: "編集部",
  brand_character: "案内役（架空）",
};

const AWARENESS_LABEL: Readonly<Record<AudiencePersona["awarenessStage"], string>> = {
  unaware: "困りごとにまだ気づいていない",
  problem_aware: "困りごとには気づいている",
  solution_aware: "解決の方法までは知っている",
  product_aware: "具体的な製品まで見ている",
};

const DETAIL_LABEL: Readonly<Record<AudiencePersona["preferredDetailLevel"], string>> = {
  short: "短く",
  standard: "ふつう",
  detailed: "くわしく",
};

// --- 書き手 -----------------------------------------------------------------

export type AuthorPersonaView = {
  readonly personaId: string;
  readonly displayName: string;
  readonly personaTypeLabel: string;
  readonly role: string;
  readonly knowledgeLabel: string;
  readonly expertise: readonly string[];
  readonly verifiedCredentials: readonly string[];
  readonly experienceYearsLabel: string;
  readonly firstPersonPronoun: string;
  readonly readerAddress: string;
  /** 文体の各軸。0〜1 の数字のままではなく、画面で読める形にして返す。 */
  readonly toneLabels: readonly { readonly axis: string; readonly label: string }[];
  readonly prohibitedPhrases: readonly string[];
  readonly disclosureStyle: string;
  readonly ctaStyle: string;
  readonly factBoundary: readonly string[];
  /** 実際に試した記録があるか。無ければ一人称の体験は書けない。 */
  readonly verifiedExperienceCount: number;
  /**
   * この書き手にできないこと。
   * 画面で「なぜこの操作ができないか」を出すために、判断をここで済ませる。
   */
  readonly limitations: readonly string[];
};

const TONE_AXIS_LABEL: Readonly<Record<keyof AuthorPersona["tone"], string>> = {
  formality: "かたさ",
  analytical: "理屈っぽさ",
  emotional: "気持ちの出し方",
  assertiveness: "言い切りの強さ",
  humor: "ユーモア",
  emojiUsage: "絵文字",
};

/** 0〜1 の数字を、読める言葉に直す。画面ごとに閾値を書かないための場所。 */
function toneLabel(value: number): string {
  if (value <= 0.2) return "ほとんど無し";
  if (value <= 0.4) return "ひかえめ";
  if (value <= 0.6) return "ふつう";
  if (value <= 0.8) return "強め";
  return "かなり強い";
}

function toAuthorView(persona: AuthorPersona): AuthorPersonaView {
  const limitations: string[] = [];
  if (persona.verifiedExperienceIds.length === 0) {
    limitations.push(
      "実際に試した記録が登録されていないため、「実際に使ってみた」といった一人称の体験は書けません。",
    );
  }
  if (persona.personaType === "brand_character") {
    limitations.push(
      "架空の人物のため、資格や経験年数を名乗らせることはできません（読者の誤認を防ぐため）。",
    );
  }
  if (persona.factBoundary.length === 0) {
    limitations.push("書いてよい事実の範囲が決まっていません。決めるまで公開はできません。");
  }

  return {
    personaId: String(persona.id),
    displayName: persona.displayName,
    personaTypeLabel: PERSONA_TYPE_LABEL[persona.personaType],
    role: persona.role,
    knowledgeLabel: KNOWLEDGE_LABEL[persona.knowledgeLevel],
    expertise: persona.expertise,
    verifiedCredentials: persona.verifiedCredentials,
    experienceYearsLabel:
      persona.experienceYears === null ? "未設定" : `${persona.experienceYears}年`,
    firstPersonPronoun: persona.firstPersonPronoun,
    readerAddress: persona.readerAddress,
    toneLabels: (Object.keys(TONE_AXIS_LABEL) as (keyof AuthorPersona["tone"])[]).map((axis) => ({
      axis: TONE_AXIS_LABEL[axis],
      label: toneLabel(persona.tone[axis]),
    })),
    prohibitedPhrases: persona.prohibitedPhrases,
    disclosureStyle: persona.disclosureStyle,
    ctaStyle: persona.ctaStyle,
    factBoundary: persona.factBoundary,
    verifiedExperienceCount: persona.verifiedExperienceIds.length,
    limitations,
  };
}

export type ListAuthorPersonasOutput = {
  readonly items: readonly AuthorPersonaView[];
  readonly total: number;
  readonly emptyReason: string | null;
};

export function createListAuthorPersonasUseCase(
  deps: ManagePersonasDeps,
): UseCase<Record<string, never>, ListAuthorPersonasOutput> {
  return {
    async execute(actor): Promise<Result<ListAuthorPersonasOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "書き手の一覧");
      if (!allowed.ok) return allowed;

      const listed = await deps.personas.listAuthors(actor.workspaceId, {
        limit: 50,
        cursor: null,
      });
      if (!listed.ok) return listed;

      const items = listed.value.items.map(toAuthorView);
      return ok({
        items,
        total: items.length,
        emptyReason:
          items.length === 0
            ? "書き手がまだ登録されていません。誰の立場で書くかが決まらないと、記事は作れません。"
            : null,
      });
    },
  };
}

export function createGetAuthorPersonaUseCase(
  deps: ManagePersonasDeps,
): UseCase<{ readonly personaId: string }, AuthorPersonaView> {
  return {
    async execute(actor, input): Promise<Result<AuthorPersonaView, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "書き手の参照");
      if (!allowed.ok) return allowed;

      const found = await deps.personas.findAuthor(
        actor.workspaceId,
        taggedString<"AuthorPersonaId">(input.personaId) as AuthorPersonaId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("書き手", input.personaId));
      return ok(toAuthorView(found.value));
    },
  };
}

// --- 読者像 -----------------------------------------------------------------

export type AudiencePersonaView = {
  readonly personaId: string;
  readonly name: string;
  readonly primaryJob: string;
  readonly currentSituation: string;
  readonly desiredOutcome: string;
  readonly knowledgeLabel: string;
  readonly awarenessLabel: string;
  readonly painPoints: readonly string[];
  readonly objections: readonly string[];
  /** 比較表の列と結論の根拠は、ここから決まる。 */
  readonly decisionCriteria: readonly string[];
  readonly budgetContext: string | null;
  readonly timeContext: string | null;
  readonly trustRequirements: readonly string[];
  readonly detailLabel: string;
  readonly commonQuestions: readonly string[];
  readonly desiredEmotionalState: string;
  readonly nextAction: string;
  readonly prohibitedAssumptions: readonly string[];
};

function toAudienceView(persona: AudiencePersona): AudiencePersonaView {
  return {
    personaId: String(persona.id),
    name: persona.name,
    primaryJob: persona.primaryJob,
    currentSituation: persona.currentSituation,
    desiredOutcome: persona.desiredOutcome,
    knowledgeLabel: KNOWLEDGE_LABEL[persona.knowledgeLevel],
    awarenessLabel: AWARENESS_LABEL[persona.awarenessStage],
    painPoints: persona.painPoints,
    objections: persona.objections,
    decisionCriteria: persona.decisionCriteria,
    budgetContext: persona.budgetContext,
    timeContext: persona.timeContext,
    trustRequirements: persona.trustRequirements,
    detailLabel: DETAIL_LABEL[persona.preferredDetailLevel],
    commonQuestions: persona.commonQuestions,
    desiredEmotionalState: persona.desiredEmotionalState,
    nextAction: persona.nextAction,
    prohibitedAssumptions: persona.prohibitedAssumptions,
  };
}

export type ListAudiencePersonasOutput = {
  readonly items: readonly AudiencePersonaView[];
  readonly total: number;
  readonly emptyReason: string | null;
  /** 知識量ごとの件数。1 種類に偏っていないかを画面で見るため。 */
  readonly countsByKnowledge: Readonly<Record<string, number>>;
};

export function createListAudiencePersonasUseCase(
  deps: ManagePersonasDeps,
): UseCase<Record<string, never>, ListAudiencePersonasOutput> {
  return {
    async execute(actor): Promise<Result<ListAudiencePersonasOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "読者像の一覧");
      if (!allowed.ok) return allowed;

      const listed = await deps.personas.listAudiences(actor.workspaceId, {
        limit: 50,
        cursor: null,
      });
      if (!listed.ok) return listed;

      const counts: Record<string, number> = {};
      for (const p of listed.value.items) {
        const key = KNOWLEDGE_LABEL[p.knowledgeLevel];
        counts[key] = (counts[key] ?? 0) + 1;
      }

      const items = listed.value.items.map(toAudienceView);
      return ok({
        items,
        total: items.length,
        countsByKnowledge: counts,
        emptyReason:
          items.length === 0
            ? "読者像がまだ登録されていません。誰に向けて書くかが決まらないと、比較の観点も決まりません。"
            : null,
      });
    },
  };
}

export function createGetAudiencePersonaUseCase(
  deps: ManagePersonasDeps,
): UseCase<{ readonly personaId: string }, AudiencePersonaView> {
  return {
    async execute(actor, input): Promise<Result<AudiencePersonaView, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "読者像の参照");
      if (!allowed.ok) return allowed;

      const found = await deps.personas.findAudience(
        actor.workspaceId,
        taggedString<"AudiencePersonaId">(input.personaId) as AudiencePersonaId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("読者像", input.personaId));
      return ok(toAudienceView(found.value));
    },
  };
}

// --- 事実の境界の確認 -------------------------------------------------------

export type CheckFactBoundaryInput = {
  readonly personaId: string;
  readonly body: string;
};

export type CheckFactBoundaryOutput = {
  readonly personaName: string;
  readonly passed: boolean;
  readonly violations: readonly FactBoundaryViolation[];
  readonly prohibitedPhrasesFound: readonly string[];
  /** 判定の結果を 1 行で。画面にも AI の返答にもそのまま出せる形で返す。 */
  readonly summary: string;
};

/**
 * 書いた文章が、その書き手の事実の範囲を越えていないかを見る。
 *
 * **同じ判定を 3 箇所（AI 生成直後・人の編集後・公開直前）で使う。**
 * 判定を書き分けると、片方だけ通ってしまう文章が必ず出る。
 * 判定そのものは domain の純関数にあり、ここは呼ぶだけ。
 */
export function createCheckFactBoundaryUseCase(
  deps: ManagePersonasDeps,
): UseCase<CheckFactBoundaryInput, CheckFactBoundaryOutput> {
  return {
    async execute(actor, input): Promise<Result<CheckFactBoundaryOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "事実の範囲の確認");
      if (!allowed.ok) return allowed;

      const found = await deps.personas.findAuthor(
        actor.workspaceId,
        taggedString<"AuthorPersonaId">(input.personaId) as AuthorPersonaId,
      );
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("書き手", input.personaId));

      const persona = found.value;
      const violations = checkFactBoundary(persona, input.body, {
        // 記録が 1 件も無い書き手には、一人称の体験を許さない。
        hasVerifiedTestRun: persona.verifiedExperienceIds.length > 0,
      });
      const prohibited = checkProhibitedPhrases(persona, input.body);
      const passed = violations.length === 0 && prohibited.length === 0;

      return ok({
        personaName: persona.displayName,
        passed,
        violations,
        prohibitedPhrasesFound: prohibited,
        summary: passed
          ? `${persona.displayName}が書ける範囲に収まっています。`
          : `直すところが${violations.length + prohibited.length}件あります。` +
            (violations.length > 0 ? "実際に試した記録が無い体験の書き方が含まれています。" : "") +
            (prohibited.length > 0
              ? `使わないと決めた言葉が含まれています（${prohibited.join("、")}）。`
              : ""),
      });
    },
  };
}
