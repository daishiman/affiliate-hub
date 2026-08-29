import type { EditorialPersonaRepositoryPort } from "@/application/ports/authoring";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import {
  type AudiencePersona,
  type AuthorPersona,
  type FactBoundaryViolation,
  checkFactBoundary,
  checkProhibitedPhrases,
  createAudiencePersona,
  createAuthorPersona,
} from "@/domain/authoring";
import { requireWorkspaceWideCapability } from "@/domain/identity";
import {
  type AudiencePersonaId,
  type AuthorPersonaId,
  type DomainError,
  type Result,
  domainError,
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
   * ID の作り方。**登録のときだけ要る。**
   *
   * 参照だけのユースケース（一覧・照会・範囲の確認）は ID を作らないので、
   * 省略できるようにしてある。必須にすると、読むだけの経路まで
   * 「ID を作れる道具」を持つことになり、持たせる理由の無い能力が広がる。
   */
  readonly ids?: IdGeneratorPort;
  /**
   * 検証記録の照会。
   * 一人称の体験を書いてよいかは「その書き手の実測記録があるか」で決まるので、
   * 記録の有無を知る手段が要る。**報酬のつなぎ目はここに現れない。**
   */
  readonly affiliateLinks?: never;
};

/**
 * 像を**書き換える**側の口。
 *
 * 参照だけの口（一覧・照会・範囲の確認）には持たせない。
 * 像はこれから作られる記事の語り口をまとめて決めるので、
 * 書き換えた人が残らない登録を型で作れないようにしておく。
 */
export type RecordedPersonasDeps = ManagePersonasDeps & {
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
};

/**
 * 登録の口が ID の作り方を持たずに組まれたとき。
 *
 * 空文字の ID を作ってしのがない。**同じ ID の行が上書きし合う**保存先ができ、
 * 書き手を 2 人登録したはずが 1 人になる。しかも保存は成功して返るので、
 * 利用者は次に一覧を開くまで気づけない。
 */
function idsMissing(what: string) {
  return err(
    domainError("NOT_IMPLEMENTED", `${what}の登録は、この画面からは行えません。`, {
      suggestedAction: "公開した環境（pnpm run preview か本番）で開いてください。",
    }),
  );
}

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
      const allowed = requireWorkspaceWideCapability(actor, "content.read", "書き手の一覧");
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
      const allowed = requireWorkspaceWideCapability(actor, "content.read", "書き手の参照");
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
      const allowed = requireWorkspaceWideCapability(actor, "content.read", "読者像の一覧");
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
      const allowed = requireWorkspaceWideCapability(actor, "content.read", "読者像の参照");
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

// --- 登録 -------------------------------------------------------------------

/**
 * 書き手を 1 人登録する。
 *
 * --- なぜ画面ごとに書かないか ---
 *
 * 画面・REST・WebMCP・バックエンド MCP の 4 経路がこの 1 つを呼ぶ。
 * 「架空の人物に資格を持たせない」（§13.3）の判定は
 * `createAuthorPersona` の中にあり、ここは呼ぶだけ。経路ごとに写すと、
 * 写した側だけが古くなり、片方の経路からだけ架空の資格が入る。
 *
 * --- 事実の範囲は最初から空でよい ---
 *
 * 実際に試した記録（`verifiedExperienceIds`）は登録の場では決められない。
 * 空で作ると、その書き手は一人称の体験を書けない状態から始まる。
 * **これは正しい初期値。** 記録が付くまで体験を書けないのが仕様であって、
 * 登録の手間を減らすために最初から書ける状態にしてはならない。
 */
export type SaveAuthorPersonaInput = {
  readonly displayName: string;
  readonly personaType: AuthorPersona["personaType"];
  readonly role: string;
  readonly knowledgeLevel: AuthorPersona["knowledgeLevel"];
  readonly firstPersonPronoun: string;
  readonly readerAddress: string;
  readonly tone: AuthorPersona["tone"];
  readonly expertise?: readonly string[];
  readonly verifiedCredentials?: readonly string[];
  readonly experienceYears?: number | null;
  readonly prohibitedPhrases?: readonly string[];
  readonly factBoundary?: readonly string[];
  readonly disclosureStyle: string;
  readonly ctaStyle: string;
};

export function createSaveAuthorPersonaUseCase(
  deps: RecordedPersonasDeps,
): UseCase<SaveAuthorPersonaInput, AuthorPersonaView> {
  return {
    async execute(actor, input): Promise<Result<AuthorPersonaView, DomainError>> {
      const allowed = requireWorkspaceWideCapability(actor, "content.write", "書き手の登録");
      if (!allowed.ok) return allowed;
      if (deps.ids === undefined) return idsMissing("書き手");

      const built = createAuthorPersona({
        id: taggedString<"AuthorPersonaId">(`ap_${deps.ids.newId()}`) as AuthorPersonaId,
        workspaceId: actor.workspaceId,
        displayName: input.displayName.trim(),
        personaType: input.personaType,
        role: input.role.trim(),
        expertise: input.expertise,
        verifiedCredentials: input.verifiedCredentials,
        experienceYears: input.experienceYears,
        knowledgeLevel: input.knowledgeLevel,
        firstPersonPronoun: input.firstPersonPronoun.trim(),
        readerAddress: input.readerAddress.trim(),
        tone: input.tone,
        prohibitedPhrases: input.prohibitedPhrases,
        factBoundary: input.factBoundary,
        disclosureStyle: input.disclosureStyle.trim(),
        ctaStyle: input.ctaStyle.trim(),
      });
      if (!built.ok) return built;

      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "persona.changed",
        targetType: "author_persona",
        targetId: String(built.value.id),
        before: null,
        after: {
          displayName: built.value.displayName,
          personaType: built.value.personaType,
          role: built.value.role,
        },
      });
      if (!entry.ok) return entry;

      const saved = await deps.personas.saveAuthor(built.value);
      if (!saved.ok) return saved;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("書き手の登録は済んでいます", appended.error.details));
      }
      return ok(toAuthorView(saved.value));
    },
  };
}

/**
 * 読者像を 1 つ登録する。
 *
 * **判断基準（`decisionCriteria`）を必須にしている。**
 * ここが空の読者像を作れると、その読者像で組んだ比較表に列が立たない。
 * 「あとで足す」を許すと、列の無い比較表が公開まで進んでしまう。
 */
export type SaveAudiencePersonaInput = {
  readonly name: string;
  readonly primaryJob: string;
  readonly currentSituation?: string;
  readonly desiredOutcome: string;
  readonly knowledgeLevel: AudiencePersona["knowledgeLevel"];
  readonly awarenessStage: AudiencePersona["awarenessStage"];
  readonly decisionCriteria: readonly string[];
  readonly painPoints?: readonly string[];
  readonly objections?: readonly string[];
  readonly budgetContext?: string | null;
  readonly timeContext?: string | null;
  readonly preferredDetailLevel: AudiencePersona["preferredDetailLevel"];
  readonly preferredTone: string;
  readonly desiredEmotionalState: string;
  readonly nextAction: string;
  readonly prohibitedAssumptions?: readonly string[];
};

export function createSaveAudiencePersonaUseCase(
  deps: RecordedPersonasDeps,
): UseCase<SaveAudiencePersonaInput, AudiencePersonaView> {
  return {
    async execute(actor, input): Promise<Result<AudiencePersonaView, DomainError>> {
      const allowed = requireWorkspaceWideCapability(actor, "content.write", "読者像の登録");
      if (!allowed.ok) return allowed;
      if (deps.ids === undefined) return idsMissing("読者像");

      const built = createAudiencePersona({
        id: taggedString<"AudiencePersonaId">(`dp_${deps.ids.newId()}`) as AudiencePersonaId,
        workspaceId: actor.workspaceId,
        name: input.name.trim(),
        primaryJob: input.primaryJob.trim(),
        currentSituation: input.currentSituation,
        desiredOutcome: input.desiredOutcome.trim(),
        knowledgeLevel: input.knowledgeLevel,
        awarenessStage: input.awarenessStage,
        decisionCriteria: input.decisionCriteria,
        painPoints: input.painPoints,
        objections: input.objections,
        budgetContext: input.budgetContext,
        timeContext: input.timeContext,
        preferredDetailLevel: input.preferredDetailLevel,
        preferredTone: input.preferredTone.trim(),
        desiredEmotionalState: input.desiredEmotionalState.trim(),
        nextAction: input.nextAction.trim(),
        prohibitedAssumptions: input.prohibitedAssumptions,
      });
      if (!built.ok) return built;

      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "persona.changed",
        targetType: "audience_persona",
        targetId: String(built.value.id),
        before: null,
        after: {
          name: built.value.name,
          primaryJob: built.value.primaryJob,
          awarenessStage: built.value.awarenessStage,
        },
      });
      if (!entry.ok) return entry;

      const saved = await deps.personas.saveAudience(built.value);
      if (!saved.ok) return saved;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("読者像の登録は済んでいます", appended.error.details));
      }
      return ok(toAudienceView(saved.value));
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
      const allowed = requireWorkspaceWideCapability(
        actor,
        "content.read",
        "事実の範囲の確認",
      );
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
