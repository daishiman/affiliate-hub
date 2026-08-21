/**
 * @tier 1
 * @req REQ-W02, REQ-W03, REQ-W04, REQ-W05
 * @types decision-table, equivalence
 *
 * 記事の型ごとに足す節を、**5 つの型ぜんぶ**で当てる。
 *
 * ここを足した理由。もともと型固有の節を名指ししていたのは
 * `tests/application/writing-method.test.ts` の 2 件だけで、
 * 順位の記事 6 節のうち 3 節、やり方の記事 8 節のうち 3 節しか見ていなかった。
 * **1 つを詳しく見る記事（4 節）・比べる記事（2 節）・道具のページ（2 節）は 0 節**で、
 * 「検証条件」も「差分表」も丸ごと消して緑のまま通った。
 * 型ごとの構成は 5 つで 1 つの決まりなので、1 型だけ試して全部ぶん緑にしない。
 *
 * 期待値は**この表に手で書き写す**。`ARTICLE_TYPE_SECTIONS` から作ると、
 * 節を 1 つ消したときに繰り返しが 1 周短くなるだけで緑のままになる。
 * 節を足すときも足すときで、この表を直させる（数が合わないと落ちる）。
 */
import { describe, expect, it } from "vitest";
import {
  ARTICLE_TYPES,
  ARTICLE_TYPE_SECTIONS,
  type ArticleType,
  type SectionId,
  requiredSectionsFor,
  sectionsFor,
} from "@/domain/authoring";

type Row = { id: SectionId; label: string; required: boolean };

/** 仕様 §9 の型ごとの追加節。並び順まで含めて手で書き写したもの。 */
const EXPECTED: Readonly<Record<ArticleType, readonly Row[]>> = {
  ranking: [
    { id: "use_case_best", label: "用途別ベスト", required: true },
    { id: "methodology", label: "評価基準", required: true },
    { id: "test_conditions", label: "検証条件", required: true },
    { id: "ranking_list", label: "ランキング", required: true },
    { id: "product_cards", label: "各商品カード", required: true },
    { id: "excluded_products", label: "選外商品", required: true },
  ],
  review: [
    { id: "test_conditions", label: "検証条件", required: true },
    { id: "measurements", label: "実測", required: true },
    { id: "experience", label: "長期使用", required: false },
    { id: "quick_comparison", label: "競合比較", required: true },
  ],
  comparison: [
    { id: "quick_comparison", label: "差分表", required: true },
    { id: "use_case_best", label: "用途別結論", required: true },
  ],
  guide: [
    { id: "outcome_state", label: "完了後の状態", required: true },
    { id: "required_time", label: "必要時間", required: true },
    { id: "required_cost", label: "必要費用", required: true },
    { id: "prerequisites", label: "事前準備", required: true },
    { id: "steps", label: "全手順", required: true },
    { id: "success_state", label: "成功状態", required: true },
    { id: "troubleshooting", label: "エラー対処", required: true },
    { id: "next_action", label: "次の行動", required: true },
  ],
  tool: [
    { id: "outcome_state", label: "このツールでできること", required: true },
    { id: "how_to_choose", label: "計算・判定の根拠", required: true },
  ],
};

/** 期待の側の合計。実装から数えない。 */
const EXPECTED_TOTAL = 6 + 4 + 2 + 8 + 2;

function row(s: { id: SectionId; label: string; required: boolean }): Row {
  return { id: s.id, label: s.label, required: s.required };
}

describe("記事の型ごとに足す節", () => {
  it("数を先に見る（型の数も、節の合計も、表と合う）", () => {
    expect(ARTICLE_TYPES).toHaveLength(Object.keys(EXPECTED).length);
    const total = ARTICLE_TYPES.reduce((n, t) => n + ARTICLE_TYPE_SECTIONS[t].length, 0);
    expect(total, "型固有の節を足し引きしたら、この表も直すこと").toBe(EXPECTED_TOTAL);
  });

  it.each(ARTICLE_TYPES)("%s の追加節は、並びも名前も必須かどうかも表のとおり", (type) => {
    expect(ARTICLE_TYPE_SECTIONS[type].map(row)).toEqual(EXPECTED[type]);
  });

  it.each(ARTICLE_TYPES)("%s の追加節のうち必須のものは、公開ゲートの必須一覧に入る", (type) => {
    const required = requiredSectionsFor(type);
    for (const r of EXPECTED[type]) {
      if (!r.required) continue;
      expect(required, `${type} で ${r.id} が必須一覧から落ちています`).toContain(r.id);
    }
  });

  it("推奨どまりの節は、必須一覧に入らない（長期使用だけがそれ）", () => {
    const optional = ARTICLE_TYPES.flatMap((t) =>
      EXPECTED[t].filter((r) => !r.required).map((r) => `${t}/${r.id}`),
    );
    expect(optional).toEqual(["review/experience"]);
    expect(requiredSectionsFor("review")).not.toContain("experience");
  });

  it("よその型の節が紛れ込んでいない", () => {
    // 「順位」は順位の記事にだけ、「全手順」はやり方の記事にだけ現れる。
    // 共通の骨格にも無い（あると、どの型でも必須になってしまう）。
    const onlyIn: Readonly<Record<string, ArticleType>> = {
      ranking_list: "ranking",
      product_cards: "ranking",
      excluded_products: "ranking",
      methodology: "ranking",
      experience: "review",
      steps: "guide",
      troubleshooting: "guide",
      required_time: "guide",
      required_cost: "guide",
      prerequisites: "guide",
      success_state: "guide",
      next_action: "guide",
    };
    for (const [id, owner] of Object.entries(onlyIn)) {
      for (const type of ARTICLE_TYPES) {
        const has = sectionsFor(type).some((s) => s.id === id);
        expect(has, `${id} は ${owner} だけのはずが ${type} にもあります`).toBe(type === owner);
      }
    }
  });

  it("同じ節を型が持ち直したときは、型のほうの言い方が勝つ", () => {
    /*
     * `quick_comparison` は共通の骨格では「簡易比較」で推奨どまり。
     * 1 つを詳しく見る記事では「競合比較」、比べる記事では「差分表」になり、
     * どちらも必須へ変わる。**同じ id で意味が変わる**ので、
     * 上書きが効いていないと、比べる記事から差分表が任意で落とせてしまう。
     */
    const labelOf = (t: ArticleType) =>
      sectionsFor(t).find((s) => s.id === "quick_comparison");
    expect(labelOf("review")).toMatchObject({ label: "競合比較", required: true });
    expect(labelOf("comparison")).toMatchObject({ label: "差分表", required: true });
    // 上書きしていない型では、共通の言い方のまま推奨どまり。
    expect(labelOf("guide")).toMatchObject({ label: "簡易比較", required: false });
  });

  it("型が足した節は、本文より前に入る（読む前に前提が出そろう）", () => {
    for (const type of ARTICLE_TYPES) {
      const ids = sectionsFor(type).map((s) => s.id);
      const body = ids.indexOf("body");
      for (const r of EXPECTED[type]) {
        // 共通側にもある id（上書き）は元の位置に残るので、追加ぶんだけ見る。
        // `quick_comparison` と `measurements` は共通の骨格が持っている。
        const isExtra = !["quick_comparison", "measurements"].includes(r.id);
        if (!isExtra) continue;
        expect(ids.indexOf(r.id), `${type}/${r.id} が本文より後ろにあります`).toBeLessThan(body);
      }
    }
  });

  it("追加節にも「なぜ置くか」がある（AI への指示文を兼ねる）", () => {
    for (const type of ARTICLE_TYPES) {
      for (const s of ARTICLE_TYPE_SECTIONS[type]) {
        expect(s.purpose.length, `${type}/${s.id} の理由が空です`).toBeGreaterThan(5);
      }
    }
  });
});
