/**
 * @tier 1
 * @req REQ-P05, REQ-B01
 * @types equivalence, boundary
 *
 * 書き手と読者像の保存先（D1）。
 *
 * ここで見るのは 4 つ。
 *   1. 保存先が落ちても投げず、断りとして返すこと（`site_repository` と同じ約束）
 *   2. 例外の中身（表の名前）を画面へ出す言葉に混ぜないこと
 *   3. 保存された分が見本より**先**に並ぶこと
 *   4. 保存先に無い ID は見本を見に行くこと
 *
 * 3 と 4 は「見本を消さずに重ねる」ことの中身である。重ねる向きを逆にすると、
 * 見本と同じ ID を保存し直しても古い見本が返り、直したはずの設定が元へ戻る。
 *
 * 本物の D1 は動かせないので、問い合わせの組み立てだけを受け取る偽の接続を使う。
 * SQL が正しいかはここでは分からない。**分からないことを分かった形にしない**ため、
 * 実際の疎通は `pnpm run preview` での確認に回している。
 */
import { describe, expect, it } from "vitest";
import type { AudiencePersonaRow, AuthorPersonaRow } from "@/db/schema";
import { asWorkspaceId, readDataClass, taggedString } from "@/domain/shared";
import type { AuthorPersonaId, WorkspaceId } from "@/domain/shared";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import { createD1PersonaRepository } from "@/infrastructure/persistence/d1/persona-repository";
import {
  SAMPLE_AUDIENCE_PERSONAS,
  SAMPLE_AUTHOR_PERSONAS,
} from "@/infrastructure/persistence/sample/content-editorial-sample-repository";

const WS = asWorkspaceId("ws_sample") as WorkspaceId;
const PAGE = { limit: 50, cursor: null };

/** どの問い合わせも落ちる接続。表が無い・形がずれている状態。 */
function brokenDb(): DrizzleD1 {
  const boom = () => {
    throw new Error("D1_ERROR: no such table: author_personas");
  };
  return { select: boom, insert: boom } as unknown as DrizzleD1;
}

/** 問い合わせの形だけ受け取って、決めた行を返す偽の接続。 */
function fakeDb(rows: readonly unknown[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
    orderBy: () => Promise.resolve(rows),
  };
  return { select: () => chain } as unknown as DrizzleD1;
}

/** 保存の問い合わせだけを受け取って、何を渡されたかを覚えておく接続。 */
function recordingDb(): { db: DrizzleD1; saved: Record<string, unknown>[] } {
  const saved: Record<string, unknown>[] = [];
  const chain = {
    values: (v: Record<string, unknown>) => {
      saved.push(v);
      return chain;
    },
    onConflictDoUpdate: () => Promise.resolve(undefined),
  };
  return { db: { insert: () => chain } as unknown as DrizzleD1, saved };
}

function authorRow(over: Partial<AuthorPersonaRow> = {}): AuthorPersonaRow {
  return {
    id: "ap_stored",
    workspaceId: "ws_sample",
    displayName: "あ（保存された書き手）",
    updatedAt: new Date("2026-08-26T00:00:00.000Z"),
    personaJson: JSON.stringify({
      displayName: "あ（保存された書き手）",
      personaType: "editorial_team",
      role: "編集部",
      expertise: [],
      verifiedCredentials: [],
      experienceYears: null,
      verifiedExperienceIds: [],
      knowledgeLevel: "intermediate",
      firstPersonPronoun: "編集部",
      readerAddress: "みなさん",
      tone: {
        formality: 0.5,
        analytical: 0.5,
        emotional: 0.5,
        assertiveness: 0.5,
        humor: 0.5,
        emojiUsage: 0,
      },
      sentencePreferences: [],
      preferredPhrases: [],
      prohibitedPhrases: [],
      values: [],
      disclosureStyle: "広告を含みます。",
      ctaStyle: "公式で確かめてください。",
      factBoundary: ["公式に載っている仕様"],
      characterSpeakerIds: [],
    }),
    ...over,
  };
}

function audienceRow(over: Partial<AudiencePersonaRow> = {}): AudiencePersonaRow {
  return {
    id: "dp_stored",
    workspaceId: "ws_sample",
    name: "あ（保存された読者像）",
    updatedAt: new Date("2026-08-26T00:00:00.000Z"),
    personaJson: JSON.stringify({
      name: "あ（保存された読者像）",
      primaryJob: "はじめての 1 台を選ぶ",
      currentSituation: "",
      desiredOutcome: "迷わず決めたい",
      knowledgeLevel: "beginner",
      awarenessStage: "problem_aware",
      painPoints: [],
      objections: [],
      decisionCriteria: ["値段", "重さ"],
      budgetContext: null,
      timeContext: null,
      trustRequirements: [],
      preferredDetailLevel: "standard",
      preferredTone: "落ち着いた説明",
      preferredChannels: [],
      commonQuestions: [],
      desiredEmotionalState: "納得している",
      nextAction: "公式で値段を見る",
      prohibitedAssumptions: [],
    }),
    ...over,
  };
}

describe("書き手と読者像の保存先（D1）が落ちたとき", () => {
  it("一覧は、投げずに断りとして返す", async () => {
    const result = await createD1PersonaRepository(brokenDb()).listAuthors(WS, PAGE);

    // 投げると画面が 500 になり、押した人には何が起きたか分からない。
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("落ちているのに通っています");
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(result.error.retryable).toBe(true);
  });

  it("1 人を引くときも、投げずに断りとして返す", async () => {
    const result = await createD1PersonaRepository(brokenDb()).findAuthor(
      WS,
      taggedString<"AuthorPersonaId">("ap_x") as AuthorPersonaId,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("落ちているのに通っています");
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("読者像の側も同じ約束で断る", async () => {
    const result = await createD1PersonaRepository(brokenDb()).listAudiences(WS, PAGE);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("落ちているのに通っています");
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("例外の中身を、画面へ出す言葉に混ぜない", async () => {
    const result = await createD1PersonaRepository(brokenDb()).listAuthors(WS, PAGE);
    if (result.ok) throw new Error("落ちているのに通っています");

    // 表の名前は利用者の役に立たないうえ、内部の作りを外へ出すことになる（§26.3）。
    expect(result.error.message).not.toContain("author_personas");
    expect(result.error.suggestedAction ?? "").not.toContain("author_personas");
  });
});

describe("見本を消さずに重ねる", () => {
  it("保存された書き手が見本より先に並ぶ", async () => {
    const result = await createD1PersonaRepository(fakeDb([authorRow()])).listAuthors(WS, PAGE);
    if (!result.ok) throw new Error("読み出せていません");

    // 先頭が保存された分であること。逆にすると、見本と同じ ID を保存し直しても
    // 古い見本が返り、直したはずの設定が次に開くと元へ戻る。
    expect(String(result.value.items[0].id)).toBe("ap_stored");
    expect(result.value.items.length).toBe(1 + SAMPLE_AUTHOR_PERSONAS.length);
  });

  it("1 人も保存していなくても、一覧は空にならない", async () => {
    const result = await createD1PersonaRepository(fakeDb([])).listAuthors(WS, PAGE);
    if (!result.ok) throw new Error("読み出せていません");

    // 空だと「まだ作っていない」のか「壊れている」のかを画面から見分けられない。
    expect(result.value.items.length).toBe(SAMPLE_AUTHOR_PERSONAS.length);
  });

  it("読者像も同じ重ね方をする", async () => {
    const result = await createD1PersonaRepository(fakeDb([audienceRow()])).listAudiences(WS, PAGE);
    if (!result.ok) throw new Error("読み出せていません");

    expect(String(result.value.items[0].id)).toBe("dp_stored");
    expect(result.value.items.length).toBe(1 + SAMPLE_AUDIENCE_PERSONAS.length);
  });

  it("保存先に無い ID は見本を見に行く", async () => {
    const sample = SAMPLE_AUTHOR_PERSONAS[0];
    const result = await createD1PersonaRepository(fakeDb([])).findAuthor(WS, sample.id);
    if (!result.ok) throw new Error("読み出せていません");

    // 見本の書き手を選んだ記事が、保存先をつないだ日に
    // 「書き手が見つかりません」で開けなくなるのを防ぐ。
    expect(result.value?.displayName).toBe(sample.displayName);
  });

  it("保存先にも見本にも無い ID は、見つからないとして null を返す", async () => {
    const result = await createD1PersonaRepository(fakeDb([])).findAuthor(
      WS,
      taggedString<"AuthorPersonaId">("ap_nowhere") as AuthorPersonaId,
    );
    if (!result.ok) throw new Error("読み出せていません");

    // ここで見本の 1 人目を返すと、消した書き手が別人として生き続ける。
    expect(result.value).toBeNull();
  });
});

describe("保存するときの列の切り方", () => {
  it("並べ替えに使う名前だけを列に出し、残りは JSON 1 列へ入れる", async () => {
    const { db, saved } = recordingDb();
    const persona = SAMPLE_AUTHOR_PERSONAS[0];

    const result = await createD1PersonaRepository(db).saveAuthor(persona);
    expect(result.ok).toBe(true);

    const row = saved[0];
    expect(row.displayName).toBe(persona.displayName);
    // 文体の 6 軸は列にしない。軸を 1 つ足すたびに保存先の作り直しが要る形にすると、
    // 書き手の設計そのものが保存先の都合で歪む。
    expect(row.tone).toBeUndefined();
    const stored = JSON.parse(String(row.personaJson));
    expect(stored.tone).toEqual(persona.tone);
    // ID は列にあるので JSON 側には持たせない（2 か所に持つと必ず食い違う）。
    expect(stored.id).toBeUndefined();
    expect(stored.workspaceId).toBeUndefined();
  });

  it("読者像の判断基準は JSON に入り、名前だけが列に出る", async () => {
    const { db, saved } = recordingDb();
    const persona = SAMPLE_AUDIENCE_PERSONAS[0];

    const result = await createD1PersonaRepository(db).saveAudience(persona);
    expect(result.ok).toBe(true);

    expect(saved[0].name).toBe(persona.name);
    expect(JSON.parse(String(saved[0].personaJson)).decisionCriteria).toEqual(
      persona.decisionCriteria,
    );
  });

  it("保存が落ちても、投げずに断りとして返す", async () => {
    const result = await createD1PersonaRepository(brokenDb()).saveAuthor(
      SAMPLE_AUTHOR_PERSONAS[0],
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("落ちているのに通っています");
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("報酬のつなぎ目を持ち込まない", () => {
  it("書き手の保存先は編集用の印が付いている", () => {
    // 記事の並べ方を決める側へ、報酬額の見える口を渡さないための印。
    expect(readDataClass(createD1PersonaRepository(fakeDb([])))).toBe("editorial");
  });
});
