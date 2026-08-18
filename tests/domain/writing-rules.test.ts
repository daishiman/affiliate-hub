/**
 * @tier 1
 * @req REQ-QC01, REQ-QC08, REQ-QC10, REQ-W01, REQ-W09, REQ-W10
 * @types equivalence, boundary, decision-table
 */
import { describe, expect, it } from "vitest";
import {
  ARTICLE_TYPES,
  COMMON_ARTICLE_SECTIONS,
  CONVERSATION_MAX_LENGTH,
  CONVERSATION_MIN_LENGTH,
  MAX_CONSECUTIVE_BLOCKS,
  MIN_DIFFERENT_AXES,
  type ConversationBlock,
  type DifferentiationAxes,
  createConversationBlock,
  differentiationGap,
  missingSections,
  requiredSectionsFor,
  validateConversationFlow,
} from "@/domain/authoring";
import { taggedString } from "@/domain/shared";

/**
 * 文章のきまりを、文書ではなくコードで守っていることを見る。
 *
 * 仕様書に書いてあるだけの決めごとは、書いた翌週から守られなくなる。
 * ここで固定するのは、公開の可否に効く 3 つ。
 *   1. 記事の型ごとに欠かせない節がそろっているか
 *   2. 吹き出しが本文を食っていないか、根拠が吹き出しだけに無いか
 *   3. 似たブログを増やそうとしていないか
 */

const ws = taggedString<"WorkspaceId">("ws_test");

function block(
  role: ConversationBlock["role"],
  overrides: Partial<ConversationBlock> = {},
): ConversationBlock {
  const result = createConversationBlock({
    id: taggedString<"ConversationBlockId">(`cb_${role}_${Math.random().toString(36).slice(2, 8)}`),
    workspaceId: ws,
    role,
    speakerName: "山田",
    // 40 文字以上 120 文字以下に収める
    text: "実際に 2 週間使ってみたところ、バッテリーは公表値より短く、9 時間ほどでした。用途によっては十分です。",
    factAlsoInBody: true,
  });
  if (!result.ok) throw new Error(result.error.message);
  return { ...result.value, ...overrides };
}

describe("記事の骨格", () => {
  it("共通の骨格は 25 節（仕様 §8 の数）", () => {
    expect(COMMON_ARTICLE_SECTIONS).toHaveLength(25);
  });

  it("節の名前が重複していない", () => {
    const ids = COMMON_ARTICLE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("どの型でも、広告表記・デメリット・出典・訂正報告は欠かせない", () => {
    for (const type of ARTICLE_TYPES) {
      const required = requiredSectionsFor(type);
      for (const id of ["disclosure", "cons", "sources", "correction_report"] as const) {
        expect(required, `${type} で ${id} が任意になっています`).toContain(id);
      }
    }
  });

  it("節が欠けたら、名前で返る（公開ゲートが使う）", () => {
    const missing = missingSections("ranking", ["h1", "body"]);
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.map((s) => s.id)).toContain("disclosure");
    // 「不足しています」だけで終わらせない。なぜ要るかも持っている。
    expect(missing.every((s) => s.purpose !== "")).toBe(true);
  });

  it("そろっていれば空で返る", () => {
    expect(missingSections("review", requiredSectionsFor("review"))).toEqual([]);
  });
});

describe("吹き出し", () => {
  it("短すぎる発言は作れない", () => {
    const r = createConversationBlock({
      id: taggedString<"ConversationBlockId">("cb_1"),
      workspaceId: ws,
      role: "reader_question",
      speakerName: "読者",
      text: "どれがいいの？",
      factAlsoInBody: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain(String(CONVERSATION_MIN_LENGTH));
  });

  it("長すぎる発言も作れない（本文を食うため）", () => {
    const r = createConversationBlock({
      id: taggedString<"ConversationBlockId">("cb_2"),
      workspaceId: ws,
      role: "guide_answer",
      speakerName: "案内役",
      text: "あ".repeat(CONVERSATION_MAX_LENGTH + 1),
      factAlsoInBody: true,
    });
    expect(r.ok).toBe(false);
  });

  it("40 文字ちょうど・120 文字ちょうどは作れて、その 1 つ外は作れない", () => {
    /*
     * 上の 2 件は端を固定していない。
     * 「短すぎる発言」は 7 文字で試しており、下限が 8 でも 39 でも同じ結果になる。
     * 「長すぎる発言」は `CONVERSATION_MAX_LENGTH + 1` 文字で作っているので、
     * **上限をいくつに変えても必ず 1 文字超える**。定数が 120 から 1200 になっても
     * このテストは緑のままで、赤くならないのに名前だけが「長すぎる」と主張する。
     *
     * ここは定数を輸入せず、実数で書く。値を変えるときは 2 か所直させる。
     */
    const make = (length: number) =>
      createConversationBlock({
        id: taggedString<"ConversationBlockId">(`cb_len_${length}`),
        workspaceId: ws,
        role: "guide_answer",
        speakerName: "案内役",
        text: "あ".repeat(length),
        factAlsoInBody: true,
      });

    expect(make(39).ok).toBe(false);
    expect(make(40).ok).toBe(true);
    expect(make(120).ok).toBe(true);
    expect(make(121).ok).toBe(false);
  });

  it("吹き出しは 2 個続けても通り、3 個で止まる", () => {
    // 上の「本文を挟まずに続けると止まる」は 3 個で試している。
    // 上限が 2 でも 1 でも同じ結果になるので、通る側の端をここで固定する。
    expect(
      validateConversationFlow([block("reader_question"), block("guide_answer")], {
        hasVerifiedExpert: true,
      }),
    ).toEqual([]);

    const three = validateConversationFlow(
      [block("reader_question"), block("guide_answer"), block("reader_question")],
      { hasVerifiedExpert: true },
    );
    expect(three.length).toBeGreaterThan(0);
  });

  it("話者名が空だと作れない（色だけで役割を分けさせない）", () => {
    const r = createConversationBlock({
      id: taggedString<"ConversationBlockId">("cb_3"),
      workspaceId: ws,
      role: "guide_answer",
      speakerName: "  ",
      text: "あ".repeat(50),
      factAlsoInBody: true,
    });
    expect(r.ok).toBe(false);
  });

  it("本文を挟めば、連続の数え直しになる", () => {
    const seq = [
      block("reader_question"),
      block("guide_answer"),
      "body" as const,
      block("reader_question"),
      block("guide_answer"),
    ];
    expect(validateConversationFlow(seq, { hasVerifiedExpert: true })).toEqual([]);
  });

  it("本文を挟まずに続けると止まる", () => {
    const seq = [block("reader_question"), block("guide_answer"), block("reader_question")];
    const issues = validateConversationFlow(seq, { hasVerifiedExpert: true });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].message).toContain(String(MAX_CONSECUTIVE_BLOCKS));
  });

  it("検証者の発言にある事実が本文に無ければ止まる", () => {
    const issues = validateConversationFlow(
      [block("reviewer_note", { factAlsoInBody: false })],
      { hasVerifiedExpert: true },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("本文にありません");
  });

  it("監修者がいないのに専門家の注意を載せられない", () => {
    const issues = validateConversationFlow([block("expert_caution")], {
      hasVerifiedExpert: false,
    });
    expect(issues.some((i) => i.message.includes("架空の専門家"))).toBe(true);
  });

  it("読者の疑問は、本文に事実が無くても止めない（疑問は事実ではない）", () => {
    const issues = validateConversationFlow(
      [block("reader_question", { factAlsoInBody: false })],
      { hasVerifiedExpert: true },
    );
    expect(issues).toEqual([]);
  });
});

describe("似たブログを増やさない", () => {
  const base: DifferentiationAxes = {
    targetReader: "動画編集をこれから始める人",
    searchIntent: "買う前に候補を絞りたい",
    articlePurpose: "候補を 3 つに絞る",
    evaluationAxis: "書き出し時間",
    usageScene: "自宅の作業机",
    uniqueExperience: "同じ素材で書き出し時間を実測",
    comparisonScope: "15 万円以下",
    conclusionStance: "1 台を名指し",
    internalLinkStrategy: "用途別ページへ送る",
    ctaStrategy: "価格確認へ送る",
  };

  it("言い換えただけのブログは足せない", () => {
    const gap = differentiationGap(base, { ...base, articlePurpose: "候補を 3 つにしぼる" });
    expect(gap.differentAxes).toEqual(["articlePurpose"]);
    expect(gap.sufficient).toBe(false);
  });

  it("軸が離れていれば別のブログとして足せる", () => {
    const other: DifferentiationAxes = {
      ...base,
      targetReader: "仕事で毎日書き出す人",
      evaluationAxis: "静音性",
      usageScene: "共有オフィス",
    };
    const gap = differentiationGap(base, other);
    expect(gap.differentAxes.length).toBeGreaterThanOrEqual(MIN_DIFFERENT_AXES);
    expect(gap.sufficient).toBe(true);
  });

  it("前後の空白だけの違いは、違いとして数えない", () => {
    const gap = differentiationGap(base, { ...base, targetReader: "  動画編集をこれから始める人 " });
    expect(gap.differentAxes).toEqual([]);
  });

  it("違う軸が 2 つでは足せず、3 つで足せる", () => {
    // 上の 2 件は 1 軸（足せない）と 3 軸（足せる）で、**間を見ていない**。
    // しかも合格側は `MIN_DIFFERENT_AXES` と比べているので、
    // 必要な軸数が 3 から 2 へ下がっても緑のままになる。ここは実数で書く。
    const two = differentiationGap(base, {
      ...base,
      targetReader: "仕事で毎日書き出す人",
      evaluationAxis: "静音性",
    });
    expect(two.differentAxes).toHaveLength(2);
    expect(two.sufficient).toBe(false);

    const three = differentiationGap(base, {
      ...base,
      targetReader: "仕事で毎日書き出す人",
      evaluationAxis: "静音性",
      usageScene: "共有オフィス",
    });
    expect(three.differentAxes).toHaveLength(3);
    expect(three.sufficient).toBe(true);
  });
});
