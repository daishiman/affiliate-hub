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

/**
 * 仕様 §8 の共通骨格 25 節を、**並び順・名前・必須かどうかまで手で書き写した表**。
 *
 * `COMMON_ARTICLE_SECTIONS` から作らないこと。作ると、節を書き換えても
 * 書き換わったほうの一覧を回して緑を返す
 * （`tests/domain/article-type-sections.test.ts` が型ごとの節で同じ形にしてある）。
 *
 * **2026-08-21 まで、この骨格には「25 件ある」という数の検査しか無かった。**
 * 25 件のうち名前が挙がっていたのは `disclosure` / `cons` / `sources` /
 * `correction_report` の 4 つだけで、残り 21 節は**必須を任意へ落としても緑**だった
 * （実測: `alternatives` と `update_log` を `required: false` にして
 * `tests/domain` / `tests/application` / `tests/presentation` の 2821 件が緑のまま）。
 * 必須が任意へ落ちると、その節が無いまま公開ゲートを通る。
 * 数だけを見る検査は、**入れ替えと格下げのどちらも見ていない**。
 */
const EXPECTED_COMMON: readonly (readonly [string, string, boolean])[] = [
  ["breadcrumb", "パンくず", true],
  ["disclosure", "広告・アフィリエイト表記", true],
  ["h1", "タイトル", true],
  ["one_sentence_conclusion", "一文の結論", true],
  ["dates", "公開日・更新日・検証日", true],
  ["byline", "著者・編集者・監修者", true],
  ["target_audience", "対象読者", false],
  ["suitable_for", "向いている人", true],
  ["not_suitable_for", "向いていない人", true],
  ["pros", "主要なメリット", true],
  ["cons", "主要なデメリット", true],
  ["quick_comparison", "簡易比較", false],
  ["toc", "目次", true],
  ["how_to_choose", "選び方または評価方法", true],
  ["body", "根拠付き本文", true],
  ["measurements", "実測・体験・引用", false],
  ["conversation", "会話ブロック", false],
  ["alternatives", "代替候補", true],
  ["faq", "FAQ", true],
  ["final_conclusion", "最終結論", true],
  ["merchant_options", "販売店の選択肢", false],
  ["sources", "出典", true],
  ["update_log", "更新履歴", true],
  ["correction_report", "訂正報告", true],
  ["author_profile", "著者情報", true],
];

describe("記事の骨格", () => {
  it("共通の骨格は 25 節（仕様 §8 の数）", () => {
    expect(COMMON_ARTICLE_SECTIONS).toHaveLength(25);
    // 書き写した表のほうも 25 行であること。表が痩せると上の数と一緒にずれる。
    expect(EXPECTED_COMMON).toHaveLength(25);
  });

  it("25 節が、並び順も名前も必須かどうかも仕様 §8 のとおり", () => {
    expect(COMMON_ARTICLE_SECTIONS.map((s) => [s.id, s.label, s.required])).toEqual(
      EXPECTED_COMMON.map((r) => [...r]),
    );
  });

  it("必須と書いた 20 節は、どの記事の型でも必須一覧に残る（黙って任意へ落ちない）", () => {
    /*
     * 上の 1 件は一覧そのものの形を見る。こちらは**公開ゲートが読む側**を見る。
     * `required` を任意へ落とすと、一覧の形は「そう書いてある」だけになり、
     * 節が無いまま公開できる状態が実際に生まれる。
     */
    const mustBeRequired = EXPECTED_COMMON.filter(([, , req]) => req).map(([id]) => id);
    expect(mustBeRequired).toHaveLength(20);
    for (const type of ARTICLE_TYPES) {
      const required = requiredSectionsFor(type);
      for (const id of mustBeRequired) {
        expect(required, `${type} で ${id} が必須一覧から落ちています`).toContain(id);
      }
    }
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

  /**
   * **話者は 4 役だけ（ブログ層 §11）。**
   *
   * `SpeakerRole` は型のうえの直和で、実行時の一覧をどこにも持っていない。
   * 2026-08-21 に測ったところ、5 つ目の役（`"sponsor_message"`）を足しても
   * **2836 件が緑のまま**通った。`SpeakerRole` は `conversation-block.ts` の外から
   * 1 度も参照されておらず、足した役は
   * `validateConversationFlow` のどの分岐にも当たらない
   * ＝**本文の裏付けを 1 度も問われない話者**が生まれる（`W03` 型）。
   *
   * 下の表はその実行時の一覧を兼ねる。`Record<SpeakerRole, …>` にしてあるので、
   * 役が増えれば `pnpm exec tsc --noEmit` が鍵の不足で落ち、
   * 役が減れば余分な鍵で落ちる。値のほうは実際に流して突き合わせる。
   */
  const SPEAKER_NEEDS_FACT_IN_BODY: Readonly<Record<ConversationBlock["role"], boolean>> = {
    reader_question: false, // 疑問は事実ではない
    guide_answer: false, // 要約と次の行動。事実そのものは本文が持つ
    reviewer_note: true, // 検証した人の感想。根拠が吹き出しだけに残ってはいけない
    expert_caution: true, // 専門性に基づく注意。同上
  };

  it("話者は 4 役で、役ごとに「本文の裏付けが要るか」が決まっている", () => {
    const roles = Object.keys(SPEAKER_NEEDS_FACT_IN_BODY) as ConversationBlock["role"][];
    expect(roles).toHaveLength(4);
    for (const role of roles) {
      const issues = validateConversationFlow([block(role, { factAlsoInBody: false })], {
        hasVerifiedExpert: true,
      });
      const stopped = issues.some((i) => i.message.includes("本文にありません"));
      expect(stopped, `${role} の扱いが表と違います`).toBe(SPEAKER_NEEDS_FACT_IN_BODY[role]);
    }
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
    /*
     * **この行は 2026-08-19 に `["articlePurpose"]` から書き換えた。**
     *
     * 名前（「足せない」）を担っているのは下の `sufficient: false` のほうで、
     * 名前はそれだけで満たされる。この行が固定していたのは
     * **名前が何も言っていない側** ——「言い換えを違う軸として数えるかどうか」—— で、
     * その固定は仕様と逆を向いていた。
     * 要求仕様 §16.6（`docs/spec/01-要求仕様書-v1.0.md:1367`）は
     * 「単なる言い換え記事を量産しない」と書いており、
     * 送り仮名だけを変えたものは違う軸ではない。
     *
     * 結論（足せない）だけが偶然合っていたので、緑のまま気づかれなかった。
     * **名前と断言が逆だったのではない。名前が触れていない側に断言が置かれていた。**
     * 名前を何度読んでも気づけない形である。
     */
    expect(gap.differentAxes).toEqual([]);
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
