/** @tier 1 @req REQ-P05 @types permission-matrix, equivalence, boundary */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/**
 * 書き手と読者像を登録する 2 つの操作。
 *
 * ここで測るのは domain の判定ではなく、**画面から来た欄をどう読むか**。
 * 空欄を 0 と読むか、null と読むか、渡さないかは業務の意味が違い、
 * その差は domain のテストからは見えない。
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let signedIn: ActorContext | null = { ...SAMPLE_ACTOR, roles: ["owner"] };
const executeAuthor = vi.fn();
const executeAudience = vi.fn();

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => signedIn,
  personaUseCases: async () => ({
    saveAuthor: { execute: executeAuthor },
    saveAudience: { execute: executeAudience },
  }),
}));

const { createAuthorPersonaAction, createAudiencePersonaAction } = await import(
  "@/presentation/admin/write/persona-form-action"
);

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

beforeEach(() => {
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  executeAuthor.mockReset();
  executeAudience.mockReset();
  revalidatePath.mockReset();
});

describe("createAuthorPersonaAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await createAuthorPersonaAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executeAuthor).not.toHaveBeenCalled();
  });

  it("経験年数が数でなければ、欄を名指しして断り、domain まで運ばない", async () => {
    const state = await createAuthorPersonaAction(IDLE, form({ experienceYears: "3年くらい" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("experienceYears");
    expect(executeAuthor).not.toHaveBeenCalled();
  });

  it("空欄のまま出すと、経験年数は 0 ではなく null、文体は既定の 0.5 で渡る", async () => {
    executeAuthor.mockResolvedValue(ok({ displayName: "名無し" }));
    await createAuthorPersonaAction(IDLE, form({}));

    const input = executeAuthor.mock.calls[0][1];
    expect(input.experienceYears).toBeNull();
    expect(input.expertise).toEqual([]);
    expect(input.displayName).toBe("");
    expect(input.tone).toEqual({
      formality: 0.5,
      analytical: 0.5,
      emotional: 0.5,
      assertiveness: 0.5,
      humor: 0.5,
      emojiUsage: 0.5,
    });
  });

  it("埋めて出すと、行の欄は 1 行 1 件へ割られ、登録後に一覧が描き直される", async () => {
    executeAuthor.mockResolvedValue(ok({ displayName: "山田" }));
    const state = await createAuthorPersonaAction(
      IDLE,
      form({
        displayName: "山田",
        personaType: "practitioner",
        role: "編集",
        expertise: "撮影\n\n 現像 ",
        verifiedCredentials: "資格A",
        experienceYears: "7",
        knowledgeLevel: "expert",
        firstPersonPronoun: "私",
        readerAddress: "あなた",
        "tone.humor": "0.1",
        prohibitedPhrases: "絶対",
        factBoundary: "医療",
        disclosureStyle: "冒頭",
        ctaStyle: "控えめ",
      }),
    );

    const [actor, input] = executeAuthor.mock.calls[0];
    expect(actor).toBe(signedIn);
    expect(input.expertise).toEqual(["撮影", "現像"]);
    expect(input.experienceYears).toBe(7);
    expect(input.tone.humor).toBe(0.1);
    expect(input.tone.formality).toBe(0.5);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/personas");
    expect(state).toEqual({
      status: "done",
      message: "山田 を書き手として登録しました。",
      personaListPath: "/admin/personas",
    });
  });

  it("domain が断ったら、断りの文と原因の欄をそのまま画面へ返す", async () => {
    executeAuthor.mockResolvedValue(
      err(domainError("FORBIDDEN", "資格を名乗れません。", { field: "verifiedCredentials" })),
    );
    const state = await createAuthorPersonaAction(IDLE, form({ displayName: "山田" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("verifiedCredentials");
    expect(state.message).toContain("資格を名乗れません。");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createAudiencePersonaAction", () => {
  it("未ログインなら、FormData を 1 度も読まずに断る", async () => {
    signedIn = null;
    const get = vi.fn();
    const state = await createAudiencePersonaAction(IDLE, { get } as unknown as FormData);

    expect(state.status).toBe("failed");
    expect(get).not.toHaveBeenCalled();
    expect(executeAudience).not.toHaveBeenCalled();
  });

  it("空欄の予算・時間・いまの状況は、空文字ではない形で渡る", async () => {
    executeAudience.mockResolvedValue(ok({ name: "読者" }));
    await createAudiencePersonaAction(IDLE, form({ name: "読者", budgetContext: "  " }));

    const input = executeAudience.mock.calls[0][1];
    // 鍵の有無では分けられない。渡す形が object literal なので、
    // `currentSituation` の鍵は値が undefined でも必ず立つ。
    // 分かれ目は値の側で、undefined は「既定に任せる」、null は「決めていない」。
    expect(input.currentSituation).toBeUndefined();
    expect(input.budgetContext).toBeNull();
    expect(input.timeContext).toBeNull();
  });

  it("埋めて出すと、決めた値がそのまま渡り、読者像の一覧が描き直される", async () => {
    executeAudience.mockResolvedValue(ok({ name: "初心者" }));
    const state = await createAudiencePersonaAction(
      IDLE,
      form({
        name: "初心者",
        primaryJob: "選ぶ",
        currentSituation: " 迷っている ",
        desiredOutcome: "決めたい",
        knowledgeLevel: "beginner",
        awarenessStage: "problem_aware",
        decisionCriteria: "値段\n重さ",
        painPoints: "情報が多い",
        objections: "高い",
        budgetContext: "3万円まで",
        timeContext: "今月中",
        preferredDetailLevel: "standard",
        preferredTone: "やさしい",
        desiredEmotionalState: "安心",
        nextAction: "買う",
        prohibitedAssumptions: "詳しい前提",
      }),
    );

    const input = executeAudience.mock.calls[0][1];
    expect(input.currentSituation).toBe("迷っている");
    expect(input.budgetContext).toBe("3万円まで");
    expect(input.timeContext).toBe("今月中");
    expect(input.decisionCriteria).toEqual(["値段", "重さ"]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/personas/audiences");
    expect(state).toEqual({
      status: "done",
      message: "初心者 を読者像として登録しました。",
      personaListPath: "/admin/personas/audiences",
    });
  });

  it("domain が断ったら、断りの文を画面へ返し、一覧を描き直さない", async () => {
    executeAudience.mockResolvedValue(err(domainError("CONFLICT", "同じ名前の読者像があります。")));
    const state = await createAudiencePersonaAction(IDLE, form({ name: "初心者" }));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("同じ名前の読者像があります。");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
