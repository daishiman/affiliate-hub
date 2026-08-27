"use server";

import { revalidatePath } from "next/cache";
import type {
  AuthorPersonaType,
  AwarenessStage,
  DetailLevel,
  KnowledgeLevel,
  Tone,
} from "@/domain/authoring";
import { personaUseCases, signedInActor } from "@/presentation/composition";
import { type PersonaFormState, parseLines, parseToneValue } from "./persona-form-state";
import { failureFromDomainError, notSignedInFailure } from "./use-case-result";

/**
 * 書き手を 1 人登録する操作。
 *
 * 画面用の別ルートを作らず、REST・WebMCP・MCP と同じ `save_author_persona` の
 * ユースケースを呼ぶ。資格を名乗れる／名乗れないの判定も、文体の範囲の検査も
 * domain 側にある。画面へ写した時点で、写した側だけが古くなる。
 *
 * `currentActor()` ではなく `signedInActor()` を使う理由は
 * `product-form-action.ts` と同じで、前者は身元を確かめられないとき
 * **見本の身元へ落ちる**。落ちた身元で書き手が登録できると、
 * 誰が決めた立場なのか分からない署名で記事が出る。
 */
export async function createAuthorPersonaAction(
  _prev: PersonaFormState,
  formData: FormData,
): Promise<PersonaFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("書き手の登録");

  const experienceYearsRaw = String(formData.get("experienceYears") ?? "").trim();
  const experienceYears = experienceYearsRaw === "" ? null : Number(experienceYearsRaw);
  if (experienceYears !== null && !Number.isFinite(experienceYears)) {
    return {
      status: "failed",
      field: "experienceYears",
      message: "経験年数は数で入れてください。空のままでも構いません。",
    };
  }

  const result = await (await personaUseCases()).saveAuthor.execute(actor, {
    displayName: String(formData.get("displayName") ?? ""),
    personaType: String(formData.get("personaType") ?? "") as AuthorPersonaType,
    role: String(formData.get("role") ?? ""),
    expertise: parseLines(String(formData.get("expertise") ?? "")),
    verifiedCredentials: parseLines(String(formData.get("verifiedCredentials") ?? "")),
    experienceYears,
    knowledgeLevel: String(formData.get("knowledgeLevel") ?? "") as KnowledgeLevel,
    firstPersonPronoun: String(formData.get("firstPersonPronoun") ?? ""),
    readerAddress: String(formData.get("readerAddress") ?? ""),
    tone: readTone(formData),
    prohibitedPhrases: parseLines(String(formData.get("prohibitedPhrases") ?? "")),
    factBoundary: parseLines(String(formData.get("factBoundary") ?? "")),
    disclosureStyle: String(formData.get("disclosureStyle") ?? ""),
    ctaStyle: String(formData.get("ctaStyle") ?? ""),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/personas");

  return {
    status: "done",
    message: `${result.value.displayName} を書き手として登録しました。`,
    personaListPath: "/admin/personas",
  };
}

/**
 * 読者像を 1 つ登録する操作。
 *
 * 書き手と別の操作にしてある。**決める順番も、決める人も違う**からで、
 * 1 つのフォームに混ぜると、どちらか片方だけ埋めた状態を保存できてしまう。
 */
export async function createAudiencePersonaAction(
  _prev: PersonaFormState,
  formData: FormData,
): Promise<PersonaFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("読者像の登録");

  const result = await (await personaUseCases()).saveAudience.execute(actor, {
    name: String(formData.get("name") ?? ""),
    primaryJob: String(formData.get("primaryJob") ?? ""),
    currentSituation: emptyToUndefined(formData.get("currentSituation")),
    desiredOutcome: String(formData.get("desiredOutcome") ?? ""),
    knowledgeLevel: String(formData.get("knowledgeLevel") ?? "") as KnowledgeLevel,
    awarenessStage: String(formData.get("awarenessStage") ?? "") as AwarenessStage,
    decisionCriteria: parseLines(String(formData.get("decisionCriteria") ?? "")),
    painPoints: parseLines(String(formData.get("painPoints") ?? "")),
    objections: parseLines(String(formData.get("objections") ?? "")),
    // 予算と時間は「無い」ではなく「決めていない」。空欄を空文字で保存すると、
    // 画面で「予算: 」という空の見出しが立ち、調べた結果に見える。
    budgetContext: emptyToNull(formData.get("budgetContext")),
    timeContext: emptyToNull(formData.get("timeContext")),
    preferredDetailLevel: String(formData.get("preferredDetailLevel") ?? "") as DetailLevel,
    preferredTone: String(formData.get("preferredTone") ?? ""),
    desiredEmotionalState: String(formData.get("desiredEmotionalState") ?? ""),
    nextAction: String(formData.get("nextAction") ?? ""),
    prohibitedAssumptions: parseLines(String(formData.get("prohibitedAssumptions") ?? "")),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/personas/audiences");

  return {
    status: "done",
    message: `${result.value.name} を読者像として登録しました。`,
    personaListPath: "/admin/personas/audiences",
  };
}

/**
 * 文体の 6 軸をまとめて読む。
 *
 * 1 軸ずつ書き下していない。軸を 1 本足したときに**足し忘れる場所**を
 * ここ 1 か所に閉じるため。`Tone` の形は domain が持っているので、
 * 型の側から漏れが見つかる。
 */
function readTone(formData: FormData): Tone {
  return {
    formality: parseToneValue(formData.get("tone.formality")),
    analytical: parseToneValue(formData.get("tone.analytical")),
    emotional: parseToneValue(formData.get("tone.emotional")),
    assertiveness: parseToneValue(formData.get("tone.assertiveness")),
    humor: parseToneValue(formData.get("tone.humor")),
    emojiUsage: parseToneValue(formData.get("tone.emojiUsage")),
  };
}

/** 空欄は「渡さない」。ユースケース側の既定に任せる。 */
function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  const text = String(value ?? "").trim();
  return text === "" ? undefined : text;
}

/** 空欄は「決めていない」。`null` を明示して、空文字と区別する。 */
function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}
