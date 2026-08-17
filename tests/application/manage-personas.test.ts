/**
 * @tier 1
 * @req REQ-P05
 * @types equivalence, boundary
 */
import { describe, expect, it } from "vitest";
import type { EditorialPersonaRepositoryPort } from "@/application/ports/authoring";
import {
  type ManagePersonasDeps,
  createCheckFactBoundaryUseCase,
  createGetAudiencePersonaUseCase,
  createGetAuthorPersonaUseCase,
  createListAudiencePersonasUseCase,
  createListAuthorPersonasUseCase,
} from "@/application/usecases/authoring/manage-personas";
import type { AudiencePersona, AuthorPersona, Tone } from "@/domain/authoring";
import { createAudiencePersona, createAuthorPersona } from "@/domain/authoring";
import { domainError, err, markEditorial, ok, taggedString } from "@/domain/shared";
import type { AudiencePersonaId, AuthorPersonaId, TestRunId, WorkspaceId } from "@/domain/shared";
import { currentActor, personaUseCases } from "@/presentation/composition";
import { WORKSPACE, aNobody, anOwner } from "../support/actors";

/**
 * 書き手と読者像の確認。
 *
 * ここで固定したいのは「できないことに理由が付く」こと。
 * 理由の無いまま操作を塞ぐと、利用者には壊れているようにしか見えない。
 */
describe("書き手", () => {
  it("一覧が空でなく、空のときは理由が付く", async () => {
    const result = await personaUseCases().listAuthors.execute(await currentActor(), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.total).toBeGreaterThan(0);
    // 件数があるときに理由文を出すと、画面に空の案内が二重に出る。
    expect(result.value.emptyReason).toBeNull();
  });

  it("文体の度合いは数字ではなく読める言葉で返る", async () => {
    const result = await personaUseCases().listAuthors.execute(await currentActor(), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const author of result.value.items) {
      expect(author.toneLabels.length).toBeGreaterThan(0);
      for (const tone of author.toneLabels) {
        expect(tone.label.trim()).not.toBe("");
        // 0.35 のような生の数字を画面へ流さない
        expect(tone.label).not.toMatch(/^[0-9.]+$/);
      }
    }
  });

  it("架空の書き手には、資格を名乗れない理由が付く", async () => {
    const result = await personaUseCases().listAuthors.execute(await currentActor(), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const character = result.value.items.find((a) => a.personaTypeLabel === "案内役（架空）");
    expect(character).toBeDefined();
    if (character === undefined) return;

    expect(character.verifiedCredentials).toEqual([]);
    expect(character.limitations.some((l) => l.includes("資格"))).toBe(true);
  });

  it("居ない書き手を指すと、見つからないと分かる誤りが返る", async () => {
    const result = await personaUseCases().getAuthor.execute(await currentActor(), {
      personaId: "ap_does_not_exist",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message.trim()).not.toBe("");
  });
});

describe("読者像", () => {
  it("知識量が 1 種類に偏っていない見本を持つ", async () => {
    const result = await personaUseCases().listAudiences.execute(await currentActor(), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.total).toBeGreaterThan(0);
    // 見本が初心者だけだと、書き分けの確認ができないまま画面が「動いて」しまう
    expect(Object.keys(result.value.countsByKnowledge).length).toBeGreaterThan(1);
  });

  it("選ぶときの基準が空の読者像を作らない", async () => {
    const result = await personaUseCases().listAudiences.execute(await currentActor(), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const audience of result.value.items) {
      // 比較表の列はここから決まる。空だと列の決めようが無い。
      expect(audience.decisionCriteria.length).toBeGreaterThan(0);
      expect(audience.nextAction.trim()).not.toBe("");
    }
  });
});

describe("事実の範囲の確認", () => {
  async function firstAuthorId(): Promise<string> {
    const list = await personaUseCases().listAuthors.execute(await currentActor(), {});
    if (!list.ok) throw new Error("見本の書き手を取得できませんでした");
    const withoutTestRun = list.value.items.find((a) => a.verifiedExperienceCount === 0);
    return (withoutTestRun ?? list.value.items[0]!).personaId;
  }

  it("試した記録が無い書き手の一人称の体験は止まる", async () => {
    const personaId = await firstAuthorId();
    const result = await personaUseCases().checkFactBoundary.execute(await currentActor(), {
      personaId,
      body: "実際に使ってみたところ、書き出しがとても速くなりました。",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.passed).toBe(false);
    expect(result.value.violations.length).toBeGreaterThan(0);
    // どこが問題かを本文の抜粋で示す。指摘だけでは直しようが無い。
    for (const violation of result.value.violations) {
      expect(violation.excerpt.trim()).not.toBe("");
      expect(violation.message.trim()).not.toBe("");
    }
  });

  it("公式情報に基づく書き方は通る", async () => {
    const personaId = await firstAuthorId();
    const result = await personaUseCases().checkFactBoundary.execute(await currentActor(), {
      personaId,
      body: "メーカーの公表値では、書き出し時間は前の型より短くなっています。",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passed).toBe(true);
    expect(result.value.summary.trim()).not.toBe("");
  });

  it("通っても止まっても、必ず 1 行の説明が返る", async () => {
    const personaId = await firstAuthorId();
    for (const body of ["実際に試しました。", "公式の仕様では対応しています。"]) {
      const result = await personaUseCases().checkFactBoundary.execute(await currentActor(), {
        personaId,
        body,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.summary.trim()).not.toBe("");
      expect(result.value.personaName.trim()).not.toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// ここから下は、保存先を差し替えて確かめるぶん。
//
// 上の見本データでは通らない道（読み出しの失敗・0 件・権限なし・
// 文体の目盛りの境目）は、見本を増やしても確かめられない。
// 見本を「都合のよい形」に寄せると、見本自体が読めなくなる。
// ---------------------------------------------------------------------------

const owner = anOwner();

/**
 * 5 つのユースケースをまとめて回すための型。
 *
 * 入力の形はそれぞれ違うが、**権限と読み出し失敗の扱いは全部同じ**であるべきなので、
 * ここだけは 1 つの物差しで測る。
 */
type AnyUseCase = {
  execute(
    actor: ReturnType<typeof anOwner>,
    input: { personaId: string; body: string },
  ): Promise<{ readonly ok: boolean; readonly error: { readonly code: string } }>;
};

function aTone(over: Partial<Tone> = {}): Tone {
  return {
    formality: 0.5,
    analytical: 0.5,
    emotional: 0.5,
    assertiveness: 0.5,
    humor: 0.5,
    emojiUsage: 0.5,
    ...over,
  };
}

function anAuthor(over: Partial<Parameters<typeof createAuthorPersona>[0]> = {}): AuthorPersona {
  const built = createAuthorPersona({
    id: taggedString<"AuthorPersonaId">("ap_test") as AuthorPersonaId,
    workspaceId: WORKSPACE as WorkspaceId,
    displayName: "三輪 さとし",
    personaType: "real_person",
    role: "編集担当",
    knowledgeLevel: "expert",
    firstPersonPronoun: "私",
    readerAddress: "あなた",
    tone: aTone(),
    disclosureStyle: "冒頭に広告表記を置く",
    ctaStyle: "押しつけない",
    factBoundary: ["メーカー公表値", "自社の計測記録"],
    verifiedExperienceIds: [taggedString<"TestRunId">("tr_1") as TestRunId],
    ...over,
  });
  if (!built.ok) throw new Error(`書き手を組み立てられませんでした: ${built.error.message}`);
  return built.value;
}

function anAudience(
  over: Partial<Parameters<typeof createAudiencePersona>[0]> = {},
): AudiencePersona {
  const built = createAudiencePersona({
    id: taggedString<"AudiencePersonaId">("dp_test") as AudiencePersonaId,
    workspaceId: WORKSPACE as WorkspaceId,
    name: "はじめて編集する人",
    primaryJob: "手持ちのパソコンで動画を編集し終えたい",
    desiredOutcome: "書き出しで待たされずに終える",
    knowledgeLevel: "beginner",
    awarenessStage: "problem_aware",
    decisionCriteria: ["書き出し時間", "価格"],
    desiredEmotionalState: "これなら選べる、と思える",
    nextAction: "比較表から 1 台に絞る",
    ...over,
  });
  if (!built.ok) throw new Error(`読者像を組み立てられませんでした: ${built.error.message}`);
  return built.value;
}

type RepoOverrides = {
  readonly authors?: readonly AuthorPersona[];
  readonly audiences?: readonly AudiencePersona[];
  readonly author?: AuthorPersona | null;
  readonly audience?: AudiencePersona | null;
  readonly fail?: boolean;
};

function personaDeps(over: RepoOverrides = {}): ManagePersonasDeps {
  const boom = async () => err(domainError("UPSTREAM_UNAVAILABLE", "保存先に接続できません。"));
  const personas = markEditorial({
    async listAuthors() {
      if (over.fail === true) return boom();
      return ok({ items: over.authors ?? [], nextCursor: null });
    },
    async listAudiences() {
      if (over.fail === true) return boom();
      return ok({ items: over.audiences ?? [], nextCursor: null });
    },
    async findAuthor() {
      if (over.fail === true) return boom();
      return ok(over.author ?? null);
    },
    async findAudience() {
      if (over.fail === true) return boom();
      return ok(over.audience ?? null);
    },
    async saveAuthor(p: AuthorPersona) {
      return ok(p);
    },
    async saveAudience(p: AudiencePersona) {
      return ok(p);
    },
  }) as unknown as EditorialPersonaRepositoryPort;
  return { personas };
}

describe("見られる人", () => {
  it.each([
    ["書き手の一覧", createListAuthorPersonasUseCase],
    ["書き手 1 人", createGetAuthorPersonaUseCase],
    ["読者像の一覧", createListAudiencePersonasUseCase],
    ["読者像 1 つ", createGetAudiencePersonaUseCase],
    ["事実の範囲の確認", createCheckFactBoundaryUseCase],
  ])("%s: 記事を読む権限が無い人には出さない", async (_name, create) => {
    const usecase = (create as (d: ManagePersonasDeps) => AnyUseCase)(personaDeps());
    const result = await usecase.execute(aNobody(), { personaId: "ap_test", body: "本文" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});

describe("読み出せなかったとき", () => {
  it.each([
    ["書き手の一覧", createListAuthorPersonasUseCase],
    ["書き手 1 人", createGetAuthorPersonaUseCase],
    ["読者像の一覧", createListAudiencePersonasUseCase],
    ["読者像 1 つ", createGetAudiencePersonaUseCase],
    ["事実の範囲の確認", createCheckFactBoundaryUseCase],
  ])("%s: 0 件や「見つからない」に言い換えない", async (_name, create) => {
    const usecase = (create as (d: ManagePersonasDeps) => AnyUseCase)(
      personaDeps({ fail: true }),
    );
    const result = await usecase.execute(owner, { personaId: "ap_test", body: "本文" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("1 人も登録されていないとき", () => {
  it("書き手が居ないときは、記事が作れない理由まで書く", async () => {
    const result = await createListAuthorPersonasUseCase(personaDeps()).execute(owner, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(0);
    expect(result.value.emptyReason).toContain("記事は作れません");
  });

  it("読者像が居ないときは、比較の観点が決まらないことを書く", async () => {
    const result = await createListAudiencePersonasUseCase(personaDeps()).execute(owner, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.emptyReason).toContain("比較の観点");
    // 0 件のときに数え上げが壊れない（画面のグラフが例外で落ちない）。
    expect(result.value.countsByKnowledge).toEqual({});
  });

  it("居ない書き手を指したときは、指した ID を添えて「見つからない」と返す", async () => {
    const result = await createGetAuthorPersonaUseCase(personaDeps()).execute(owner, {
      personaId: "ap_missing",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
    expect(JSON.stringify(result.error)).toContain("ap_missing");
  });

  it("居ない読者像を指したときも同じ形で返す", async () => {
    const result = await createGetAudiencePersonaUseCase(personaDeps()).execute(owner, {
      personaId: "dp_missing",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });
});

describe("文体の度合いの言い換え", () => {
  /** 目盛りの境目。ここがずれると、同じ書き手が日によって別の強さに見える。 */
  it.each([
    [0, "ほとんど無し"],
    [0.2, "ほとんど無し"],
    [0.21, "ひかえめ"],
    [0.4, "ひかえめ"],
    [0.41, "ふつう"],
    [0.6, "ふつう"],
    [0.61, "強め"],
    [0.8, "強め"],
    [0.81, "かなり強い"],
    [1, "かなり強い"],
  ])("%s は「%s」と出す", async (value, label) => {
    const result = await createGetAuthorPersonaUseCase(
      personaDeps({ author: anAuthor({ tone: aTone({ formality: value as number }) }) }),
    ).execute(owner, { personaId: "ap_test" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const formality = result.value.toneLabels.find((t) => t.axis === "かたさ");
    expect(formality?.label).toBe(label);
  });

  it("軸を 1 つも落とさずに返す", async () => {
    const result = await createGetAuthorPersonaUseCase(
      personaDeps({ author: anAuthor() }),
    ).execute(owner, { personaId: "ap_test" });
    expect(result.ok && result.value.toneLabels).toHaveLength(6);
  });
});

describe("この書き手にできないこと", () => {
  it("試した記録が無いときは、一人称の体験を書けないと出す", async () => {
    const result = await createGetAuthorPersonaUseCase(
      personaDeps({ author: anAuthor({ verifiedExperienceIds: [] }) }),
    ).execute(owner, { personaId: "ap_test" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.verifiedExperienceCount).toBe(0);
    expect(result.value.limitations.some((l) => l.includes("一人称"))).toBe(true);
  });

  it("書いてよい事実の範囲が空のときは、公開できないと出す", async () => {
    const result = await createGetAuthorPersonaUseCase(
      personaDeps({ author: anAuthor({ factBoundary: [] }) }),
    ).execute(owner, { personaId: "ap_test" });
    expect(result.ok && result.value.limitations.some((l) => l.includes("公開"))).toBe(true);
  });

  it("すべて揃っている書き手には、できないことを並べない", async () => {
    const result = await createGetAuthorPersonaUseCase(
      personaDeps({ author: anAuthor() }),
    ).execute(owner, { personaId: "ap_test" });
    expect(result.ok && result.value.limitations).toEqual([]);
  });

  it("経験年数が未設定のときは、0年ではなく未設定と出す", async () => {
    const result = await createGetAuthorPersonaUseCase(
      personaDeps({ author: anAuthor({ experienceYears: null }) }),
    ).execute(owner, { personaId: "ap_test" });
    // 0年と書くと「1 年未満の人」に見える。分かっていないことは分かっていないと書く。
    expect(result.ok && result.value.experienceYearsLabel).toBe("未設定");
  });

  it("経験年数があるときは、年を付けて出す", async () => {
    const result = await createGetAuthorPersonaUseCase(
      personaDeps({ author: anAuthor({ experienceYears: 8 }) }),
    ).execute(owner, { personaId: "ap_test" });
    expect(result.ok && result.value.experienceYearsLabel).toBe("8年");
  });
});

describe("読者像の言い換え", () => {
  it.each([
    ["unaware", "困りごとにまだ気づいていない"],
    ["problem_aware", "困りごとには気づいている"],
    ["solution_aware", "解決の方法までは知っている"],
    ["product_aware", "具体的な製品まで見ている"],
  ] as const)("%s は「%s」と出す", async (stage, label) => {
    const result = await createGetAudiencePersonaUseCase(
      personaDeps({ audience: anAudience({ awarenessStage: stage }) }),
    ).execute(owner, { personaId: "dp_test" });
    expect(result.ok && result.value.awarenessLabel).toBe(label);
  });

  it.each([
    ["short", "短く"],
    ["standard", "ふつう"],
    ["detailed", "くわしく"],
  ] as const)("詳しさ %s は「%s」と出す", async (level, label) => {
    const result = await createGetAudiencePersonaUseCase(
      personaDeps({ audience: anAudience({ preferredDetailLevel: level }) }),
    ).execute(owner, { personaId: "dp_test" });
    expect(result.ok && result.value.detailLabel).toBe(label);
  });

  it("書かれていない項目は、空文字ではなく「無い」として返す", async () => {
    const result = await createGetAudiencePersonaUseCase(
      personaDeps({ audience: anAudience() }),
    ).execute(owner, { personaId: "dp_test" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 予算・時間は「決めていない」ことがある。空文字にすると空欄と区別が付かない。
    expect(result.value.budgetContext).toBeNull();
    expect(result.value.timeContext).toBeNull();
    expect(result.value.painPoints).toEqual([]);
    expect(result.value.detailLabel).toBe("ふつう");
  });

  it("知識量ごとの件数を数える", async () => {
    const result = await createListAudiencePersonasUseCase(
      personaDeps({
        audiences: [
          anAudience({ knowledgeLevel: "beginner" }),
          anAudience({ knowledgeLevel: "beginner" }),
          anAudience({ knowledgeLevel: "expert" }),
        ],
      }),
    ).execute(owner, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.countsByKnowledge).toEqual({ "はじめての人": 2, 詳しい人: 1 });
    expect(result.value.emptyReason).toBeNull();
  });
});

describe("読者像を作るときの決まり", () => {
  it.each([
    [{ name: "  " }, "name"],
    [{ primaryJob: " " }, "primaryJob"],
    [{ decisionCriteria: [] }, "decisionCriteria"],
    [{ nextAction: "" }, "nextAction"],
  ])("%o は受け付けない", (over, field) => {
    const built = createAudiencePersona({
      id: taggedString<"AudiencePersonaId">("dp_x") as AudiencePersonaId,
      workspaceId: WORKSPACE as WorkspaceId,
      name: "読者",
      primaryJob: "用事",
      desiredOutcome: "結果",
      knowledgeLevel: "beginner",
      awarenessStage: "problem_aware",
      decisionCriteria: ["条件"],
      desiredEmotionalState: "気持ち",
      nextAction: "次の行動",
      ...(over as Record<string, unknown>),
    } as Parameters<typeof createAudiencePersona>[0]);
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.error.field).toBe(field);
  });
});

describe("事実の範囲の確認（保存先を差し替えて）", () => {
  it("使わないと決めた言葉が入っていたら、その言葉を挙げて止める", async () => {
    const result = await createCheckFactBoundaryUseCase(
      personaDeps({ author: anAuthor({ prohibitedPhrases: ["圧倒的", "神"] }) }),
    ).execute(owner, { personaId: "ap_test", body: "圧倒的な速さでした。" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passed).toBe(false);
    expect(result.value.prohibitedPhrasesFound).toEqual(["圧倒的"]);
    // どの言葉が引っかかったかを書かないと、書き手は直しようがない。
    expect(result.value.summary).toContain("圧倒的");
  });

  it("止まったときは、直すところの件数を出す", async () => {
    const result = await createCheckFactBoundaryUseCase(
      personaDeps({
        author: anAuthor({ verifiedExperienceIds: [], prohibitedPhrases: ["圧倒的"] }),
      }),
    ).execute(owner, { personaId: "ap_test", body: "実際に使ってみたところ、圧倒的でした。" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const total = result.value.violations.length + result.value.prohibitedPhrasesFound.length;
    expect(total).toBeGreaterThan(1);
    expect(result.value.summary).toContain(`${total}件`);
  });

  it("問題が無いときは、書ける範囲に収まっていると出す", async () => {
    const result = await createCheckFactBoundaryUseCase(
      personaDeps({ author: anAuthor({ prohibitedPhrases: ["圧倒的"] }) }),
    ).execute(owner, { personaId: "ap_test", body: "メーカーの公表値では前の型より短くなっています。" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passed).toBe(true);
    expect(result.value.summary).toContain("収まっています");
  });

  it("空の禁止語は、どの本文にも当たらない", async () => {
    const result = await createCheckFactBoundaryUseCase(
      personaDeps({ author: anAuthor({ prohibitedPhrases: ["", "  "] }) }),
    ).execute(owner, { personaId: "ap_test", body: "メーカーの公表値です。" });
    // 空文字は「どの文字列にも含まれる」ため、素直に書くと全部止まる。
    expect(result.ok && result.value.prohibitedPhrasesFound).toEqual([]);
  });
});
