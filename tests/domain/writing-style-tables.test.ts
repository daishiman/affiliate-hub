/**
 * @tier 1
 * @req REQ-W06, REQ-W08, REQ-W11
 * @types decision-table, equivalence
 *
 * 文章仕様の 3 つの一覧を、**全行に**当てる。
 *   1. 段落の並べ方 `PARAGRAPH_ORDER`（7 段）
 *   2. 文体の決まり `STYLE_RULES`（9 件）
 *   3. 記事タイプごとの書き出し `OPENING_PATTERNS`（型ごと）
 *
 * ここを足した理由。3 件とも、当たっていた範囲が一覧のごく一部だった。
 *   - 並べ方は先頭「結論」と末尾「次の行動」の 2 つだけ。**間の 5 段は入れ替えても緑**
 *   - 文体の決まりは「理由が空でない」の総当たりのみ。9 という数も中身も誰も見ていない
 *   - 書き出しの型は**テストからの参照が 1 つも無かった**
 *
 * 期待値は**手で書き写す**。表を回して当てるだけだと、行を 1 つ消したときに
 * 繰り返しが 1 周短くなるだけで緑になる（回している数と、当てている中身は別）。
 * `tests/domain/telemetry-tables.test.ts` と同じ形である。
 */
import { describe, expect, it } from "vitest";
import { ARTICLE_TYPES, type ArticleType } from "@/domain/authoring/article-structure";
import { MAX_SENTENCES_PER_PARAGRAPH } from "@/domain/authoring/quality-check";
import {
  OPENING_PATTERNS,
  PARAGRAPH_ORDER,
  STYLE_RULES,
} from "@/domain/authoring/writing-style";

/**
 * 仕様 §10.1 の並び。**順番そのものが要件**なので、集合ではなく配列で書き写す。
 * 1 つ入れ替えただけで落ちる形にしてある。
 */
const EXPECTED_PARAGRAPH_STEPS = [
  "結論",
  "理由",
  "根拠",
  "具体例",
  "例外",
  "読者にとっての意味",
  "次の行動",
] as const;

/**
 * 仕様 §10.3 の決まり。id と、その決まりが何を禁じ／求めているかの要点を書き写す。
 *
 * `must` は説明文に必ず含まれる語である。文言を作り替えて中身が別物になったときに
 * 落ちるようにするためで、**説明文の全文を写しているわけではない**
 * （全文を写すと、句読点を直しただけで落ちてこの表が捨てられる）。
 */
const EXPECTED_STYLE_RULES = [
  { id: "one_point_per_paragraph", must: "1 論点" },
  { id: "1to3_sentences", must: "1〜3 文" },
  { id: "heading_states_conclusion", must: "見出し" },
  { id: "explain_jargon_first_use", must: "専門用語" },
  { id: "units_and_conditions", must: "単位" },
  { id: "absolute_dates", must: "日付" },
  { id: "no_unfounded_superlatives", must: "根拠なく" },
  { id: "drawback_with_workaround", must: "回避策" },
  { id: "material_before_cta", must: "CTA" },
] as const;

/**
 * 記事タイプごとの書き出しで、必ず示すもの。
 *
 * キーの一覧は**書き写さない**。`ARTICLE_TYPES`（登録表）から取る。
 * ここに 5 つ書き並べると、記事タイプが 6 つ目に増えた日に
 * 書き出しの型が無いまま緑になる。
 */
const EXPECTED_OPENING: Readonly<Record<ArticleType, string>> = {
  ranking: "最有力",
  review: "向かないか",
  comparison: "違い",
  guide: "読み終える",
  tool: "分かります",
};

describe("段落の並べ方 (REQ-W06)", () => {
  it("7 段が仕様の順番どおりに並んでいる", () => {
    expect(PARAGRAPH_ORDER.map((p) => p.step)).toEqual([...EXPECTED_PARAGRAPH_STEPS]);
  });

  it("どの段にも、なぜその位置かの説明がある", () => {
    const empty = PARAGRAPH_ORDER.filter((p) => p.description.trim() === "");
    expect(empty.map((p) => p.step)).toEqual([]);
  });

  it("説明が段どうしで使い回されていない", () => {
    const seen = new Set(PARAGRAPH_ORDER.map((p) => p.description));
    expect(seen.size).toBe(PARAGRAPH_ORDER.length);
  });

  it("空振り防止: 書き写した並びが空でない", () => {
    expect(EXPECTED_PARAGRAPH_STEPS.length).toBeGreaterThan(0);
  });
});

describe("文体の決まり (REQ-W08)", () => {
  it("9 件が仕様の順番どおりに並んでいる", () => {
    expect(STYLE_RULES.map((r) => r.id)).toEqual(EXPECTED_STYLE_RULES.map((r) => r.id));
  });

  it.each(EXPECTED_STYLE_RULES)("$id の決まりが書き換わっていない", ({ id, must }) => {
    const found = STYLE_RULES.find((r) => r.id === id);
    expect(found, `${id} が STYLE_RULES から消えています。`).toBeDefined();
    expect(found?.rule).toContain(must);
  });

  it.each(EXPECTED_STYLE_RULES)("$id に理由が付いている", ({ id }) => {
    expect(STYLE_RULES.find((r) => r.id === id)?.why?.trim()).not.toBe("");
  });

  /**
   * `quality-check.ts` は「STYLE_RULES の『1 段落は原則 1〜3 文』と同じ値」と
   * コメントで言っているが、コメントは値が離れても黙る。ここで結び直す。
   */
  it("1 段落の文の数の上限が、文体の決まりと同じ値である", () => {
    const rule = STYLE_RULES.find((r) => r.id === "1to3_sentences");
    expect(rule?.rule).toContain(`1〜${MAX_SENTENCES_PER_PARAGRAPH} 文`);
  });

  it("空振り防止: 書き写した決まりが空でない", () => {
    expect(EXPECTED_STYLE_RULES.length).toBeGreaterThan(0);
  });
});

describe("記事タイプごとの書き出し (REQ-W11)", () => {
  it("登録されている記事タイプすべてに書き出しの型がある", () => {
    expect(Object.keys(OPENING_PATTERNS).sort()).toEqual([...ARTICLE_TYPES].sort());
  });

  it.each(ARTICLE_TYPES)("%s の書き出しが、何を先に示すかを言っている", (type) => {
    const opening = OPENING_PATTERNS[type];
    expect(opening?.trim(), `${type} の書き出しの型がありません。`).not.toBe("");
    expect(opening).toContain(EXPECTED_OPENING[type]);
  });

  it("書き出しの型が記事タイプどうしで使い回されていない", () => {
    const values = ARTICLE_TYPES.map((t) => OPENING_PATTERNS[t]);
    expect(new Set(values).size).toBe(ARTICLE_TYPES.length);
  });

  it("空振り防止: 記事タイプの登録表が空でない", () => {
    expect(ARTICLE_TYPES.length).toBeGreaterThan(0);
  });
});
