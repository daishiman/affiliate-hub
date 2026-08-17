import {
  type AuthorPersonaId,
  type DomainError,
  type Result,
  type TestRunId,
  type WorkspaceId,
  domainError,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Content Authoring コンテキスト / 書き手ペルソナ。
 *
 * 責務: AI が「誰の立場で」書くかを固定し、書いてはいけないことを機械で止める。
 */
export type AuthorPersonaType = "real_person" | "editorial_team" | "brand_character";
export type KnowledgeLevel = "beginner" | "intermediate" | "expert";

/** 文体の各軸 0.0〜1.0。プロンプトの変数として直接使う。 */
export type Tone = {
  readonly formality: number;
  readonly analytical: number;
  readonly emotional: number;
  readonly assertiveness: number;
  readonly humor: number;
  readonly emojiUsage: number;
};

export type AuthorPersona = {
  readonly id: AuthorPersonaId;
  readonly workspaceId: WorkspaceId;
  readonly displayName: string;
  readonly personaType: AuthorPersonaType;
  readonly role: string;
  readonly expertise: readonly string[];
  /** 実在の資格のみ。架空の資格を持たせてはならない (§13.3)。 */
  readonly verifiedCredentials: readonly string[];
  readonly experienceYears: number | null;
  /** この書き手が実際に検証した記録。一人称の体験を書ける根拠になる。 */
  readonly verifiedExperienceIds: readonly TestRunId[];
  readonly knowledgeLevel: KnowledgeLevel;
  readonly firstPersonPronoun: string;
  readonly readerAddress: string;
  readonly tone: Tone;
  readonly sentencePreferences: readonly string[];
  readonly preferredPhrases: readonly string[];
  readonly prohibitedPhrases: readonly string[];
  readonly values: readonly string[];
  readonly disclosureStyle: string;
  readonly ctaStyle: string;
  /** 書いてよい事実の範囲。ここに無い体験を一人称で書かせない。 */
  readonly factBoundary: readonly string[];
  readonly characterSpeakerIds: readonly string[];
};

export function createAuthorPersona(input: {
  id: AuthorPersonaId;
  workspaceId: WorkspaceId;
  displayName: string;
  personaType: AuthorPersonaType;
  role: string;
  expertise?: readonly string[];
  verifiedCredentials?: readonly string[];
  experienceYears?: number | null;
  verifiedExperienceIds?: readonly TestRunId[];
  knowledgeLevel: KnowledgeLevel;
  firstPersonPronoun: string;
  readerAddress: string;
  tone: Tone;
  sentencePreferences?: readonly string[];
  preferredPhrases?: readonly string[];
  prohibitedPhrases?: readonly string[];
  values?: readonly string[];
  disclosureStyle: string;
  ctaStyle: string;
  factBoundary?: readonly string[];
  characterSpeakerIds?: readonly string[];
}): Result<AuthorPersona, DomainError> {
  if (input.displayName.trim() === "") {
    return err(validationError("書き手の表示名が空です。", "displayName"));
  }
  for (const [key, value] of Object.entries(input.tone)) {
    if (value < 0 || value > 1) {
      return err(validationError(`文体「${key}」は 0.0〜1.0 で指定してください。`, "tone"));
    }
  }

  // 架空の人格に実在の資格・職歴・所有経験を持たせない (§13.3)。
  // ここを型ではなく生成時の検査にしているのは、ブランドキャラクター自体は
  // 正当な使い方であり、禁じるのは「資格を名乗ること」だけだから。
  if (input.personaType === "brand_character") {
    if ((input.verifiedCredentials ?? []).length > 0) {
      return err(
        domainError(
          "FACT_BOUNDARY_VIOLATED",
          "ブランドキャラクターに資格を設定できません。架空の人物が資格を名乗ると読者を誤認させます。",
          { field: "verifiedCredentials" },
        ),
      );
    }
    if (input.experienceYears !== null && input.experienceYears !== undefined) {
      return err(
        domainError(
          "FACT_BOUNDARY_VIOLATED",
          "ブランドキャラクターに経験年数を設定できません。",
          { field: "experienceYears" },
        ),
      );
    }
  }

  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    displayName: input.displayName,
    personaType: input.personaType,
    role: input.role,
    expertise: input.expertise ?? [],
    verifiedCredentials: input.verifiedCredentials ?? [],
    experienceYears: input.experienceYears ?? null,
    verifiedExperienceIds: input.verifiedExperienceIds ?? [],
    knowledgeLevel: input.knowledgeLevel,
    firstPersonPronoun: input.firstPersonPronoun,
    readerAddress: input.readerAddress,
    tone: input.tone,
    sentencePreferences: input.sentencePreferences ?? [],
    preferredPhrases: input.preferredPhrases ?? [],
    prohibitedPhrases: input.prohibitedPhrases ?? [],
    values: input.values ?? [],
    disclosureStyle: input.disclosureStyle,
    ctaStyle: input.ctaStyle,
    factBoundary: input.factBoundary ?? [],
    characterSpeakerIds: input.characterSpeakerIds ?? [],
  });
}

/**
 * 一人称の体験表現。
 *
 * これらを含む文は、対応する検証記録 (TestRun) がある場合だけ許可する (§13.3)。
 * 正規表現で機械的に拾う。網羅はできないが、最も多い型は止まる。
 */
export const FIRSTHAND_EXPERIENCE_PATTERNS: readonly RegExp[] = [
  /実際に(使って|試して|測って|持ち歩いて)/,
  /(使って|試して)みました/,
  /(私|筆者|編集部)(の|が)(環境|手元|自宅|職場)では/,
  /\d+\s*(日|週間|ヶ月|か月|年)(間)?(使|持ち歩|試)/,
  /触ってみ(た|ました)/,
  /体感で/,
];

export type FactBoundaryViolation = {
  readonly pattern: string;
  readonly excerpt: string;
  readonly message: string;
};

/**
 * 文章が書き手の事実境界を越えていないか検査する。
 *
 * 純粋関数にしてある。AI 生成直後・人間の編集後・公開直前の 3 箇所で
 * 同じ判定を使うため。判定を 3 回書くと必ずずれる。
 */
export function checkFactBoundary(
  persona: AuthorPersona,
  body: string,
  options: { hasVerifiedTestRun: boolean },
): readonly FactBoundaryViolation[] {
  if (options.hasVerifiedTestRun) return [];

  const violations: FactBoundaryViolation[] = [];
  for (const pattern of FIRSTHAND_EXPERIENCE_PATTERNS) {
    const m = pattern.exec(body);
    if (!m) continue;
    violations.push({
      pattern: pattern.source,
      excerpt: excerptAround(body, m.index),
      message:
        `「${m[0]}」は実際に使った記録がある場合だけ書けます。` +
        `${persona.displayName} に紐づく検証記録が登録されていません。` +
        `検証記録を登録するか、公式情報に基づく書き方へ直してください。`,
    });
  }
  return violations;
}

/** 禁止表現を含んでいないか。ペルソナ個別の禁止語を見る。 */
export function checkProhibitedPhrases(persona: AuthorPersona, body: string): readonly string[] {
  return persona.prohibitedPhrases.filter((p) => p.trim() !== "" && body.includes(p));
}

function excerptAround(body: string, index: number, radius = 30): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(body.length, index + radius);
  return `${start > 0 ? "…" : ""}${body.slice(start, end)}${end < body.length ? "…" : ""}`;
}
