/**
 * @tier 1
 * @req REQ-BLOG01, REQ-BLOG02
 * @types equivalence, boundary
 *
 * ブログの型（テンプレート）と配色の 2 層（feat-blog-ui-builder）。
 *
 * --- なぜ 2026-08-24 に足したのか ---
 *
 * 実装は先に入っていたが、テストが 1 本も無かった。変更範囲のミューテーション
 * 実測で **165 変異すべてが未検査（スコア 0.00%）** として出た。
 * 「テンプレートを差し替えても既存記事は壊れない」という、この機能でいちばん
 * 大事な約束を、機械は 1 つも確かめていなかった。
 *
 * --- この検査が見ている向き ---
 *
 * ①並びの表そのもの（6 種の中身を名指しで固定する。静かに 1 種消えない）
 * ②並び替えがブロックを**落とさない**こと（REQ-BLOG01 の中核）
 * ③スロットの差し替え先が無いときに黙って空にしないこと
 * ④配色の上書きを外すと既定へ戻ること（REQ-BLOG02）
 *
 * 表の中身を名指しで書くのは冗長に見えるが、テンプレートの並びは
 * **利用者に見える約束**であって実装の都合ではない。`BLOG_TEMPLATES` から
 * 期待値を引いて突き合わせると、表を書き換えた瞬間にテストも一緒に動いて
 * しまい、何も見張らないテストになる。
 */
import { describe, expect, it } from "vitest";
import {
  BLOG_TEMPLATE_IDS,
  BLOG_TEMPLATES,
  EXPRESSION_BLOCK_KINDS,
  EXPRESSION_BLOCK_LABEL,
  LEGAL_PAGE_KINDS,
  LEGAL_PAGE_LABEL,
  type ExpressionBlock,
  fillSlots,
  findBlogTemplate,
  orderBlocksForTemplate,
  resolvePageTheme,
} from "@/domain/authoring/blog-template";
import { SITE_DOCUMENT_KEYS, SITE_DOCUMENT_LABEL } from "@/domain/authoring/site-routes";

/** 記事の中身は空でよい。ここで見ているのは並びと欠落だけ。 */
function block(kind: ExpressionBlock["kind"], slotName?: string): ExpressionBlock {
  const slot = slotName === undefined ? {} : { slot: { name: slotName, fallback: `${slotName} の代わり` } };
  switch (kind) {
    case "answer":
      return { kind, text: "結論", ...slot };
    case "key_points":
      return { kind, items: ["要点"], ...slot };
    case "faq":
      return { kind, items: [{ question: "q", answer: "a" }], ...slot };
    case "sources":
      return { kind, items: [{ label: "出典", checkedAt: "2026-08-01" }], ...slot };
    case "freshness":
      return { kind, asOf: "2026-08-01", ...slot };
    case "figure":
      return { kind, caption: "図", alt: "図の説明", ...slot };
    case "comparison":
      return { kind, caption: "比較", ...slot };
    case "cta":
      return { kind, label: "見る", href: "/x", ...slot };
    case "summary":
      return { kind, text: "まとめ", ...slot };
    case "spec_table":
      return { kind, rows: [{ label: "重さ", value: "1kg" }], ...slot };
  }
}

const kindsOf = (blocks: readonly ExpressionBlock[]) => blocks.map((b) => b.kind);

describe("テンプレートの表", () => {
  it("6 種が、この ID・この順で揃っている（静かに 1 種増えも減りもしない）", () => {
    expect([...BLOG_TEMPLATE_IDS]).toEqual([
      "review_focus",
      "comparison_focus",
      "howto",
      "news",
      "minimal",
      "gadget",
    ]);
    expect(BLOG_TEMPLATES.map((t) => t.id)).toEqual([...BLOG_TEMPLATE_IDS]);
  });

  it("ID がひとつも重なっていない", () => {
    expect(new Set(BLOG_TEMPLATES.map((t) => t.id)).size).toBe(BLOG_TEMPLATES.length);
  });

  it("表示名が 6 種とも入っている（空の名札を作らない）", () => {
    const labels = BLOG_TEMPLATES.map((t) => t.label);
    expect(labels).toEqual([
      "レビュー特化",
      "比較特化",
      "ハウツー",
      "ニュース",
      "ミニマル",
      "ガジェット寄り",
    ]);
  });

  it("設計図の型（pattern）が 1 種ずつ名指しで対応する", () => {
    const patterns = Object.fromEntries(BLOG_TEMPLATES.map((t) => [t.id, t.pattern]));
    expect(patterns).toEqual({
      review_focus: "specialist_review",
      comparison_focus: "comparison_lab",
      howto: "beginner_guide",
      news: "editorial_media",
      minimal: "personal_brand",
      gadget: "specialist_review",
    });
  });

  it("サイドバーを出すのは 4 種で、ニュースとミニマルは出さない", () => {
    const sidebar = Object.fromEntries(BLOG_TEMPLATES.map((t) => [t.id, t.sidebar]));
    expect(sidebar).toEqual({
      review_focus: true,
      comparison_focus: true,
      howto: true,
      news: false,
      minimal: false,
      gadget: true,
    });
  });

  it("トップの区画の並びが、型ごとに名指しで決まっている", () => {
    const home = Object.fromEntries(BLOG_TEMPLATES.map((t) => [t.id, [...t.homeSections]]));
    expect(home).toEqual({
      review_focus: ["recent", "ranking", "categories"],
      comparison_focus: ["comparison", "ranking", "recent", "categories"],
      howto: ["guide", "recent", "categories"],
      news: ["news", "recent", "categories"],
      minimal: ["recent"],
      gadget: ["ranking", "comparison", "recent", "categories"],
    });
  });

  it("薦める固定ページが型ごとに決まり、ミニマルだけ 0 件（信頼ページは別枠で必須）", () => {
    const pages = Object.fromEntries(BLOG_TEMPLATES.map((t) => [t.id, [...t.suggestedPages]]));
    expect(pages).toEqual({
      review_focus: ["review", "ranking", "authors"],
      comparison_focus: ["comparison", "ranking", "methodology"],
      howto: ["how_to_choose", "authors"],
      news: ["corrections", "editorial_policy"],
      minimal: [],
      gadget: ["review", "comparison", "ranking"],
    });
  });
});

describe("記事のブロックの推奨順", () => {
  it("どの型でも「結論 → 要点」で始まる（AI 検索に引用される形を先頭に置く）", () => {
    for (const template of BLOG_TEMPLATES) {
      expect(template.articleBlockOrder.slice(0, 2)).toEqual(["answer", "key_points"]);
    }
  });

  it("どの型でも FAQ・出典・鮮度が、この順で 1 度ずつ入っている", () => {
    for (const template of BLOG_TEMPLATES) {
      const order = [...template.articleBlockOrder];
      const aiLast = ["faq", "sources", "freshness"] as const;
      const positions = aiLast.map((k) => order.indexOf(k));
      expect(positions.every((p) => p >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      for (const kind of aiLast) {
        expect(order.filter((k) => k === kind)).toHaveLength(1);
      }
    }
  });

  it("推奨順に同じ種類を 2 度書いていない", () => {
    for (const template of BLOG_TEMPLATES) {
      expect(new Set(template.articleBlockOrder).size).toBe(template.articleBlockOrder.length);
    }
  });

  it("型ごとの推奨順が、名指しで決まっている", () => {
    const orders = Object.fromEntries(
      BLOG_TEMPLATES.map((t) => [t.id, [...t.articleBlockOrder]]),
    );
    expect(orders).toEqual({
      review_focus: [
        "answer", "key_points", "figure", "spec_table", "summary", "cta",
        "faq", "sources", "freshness",
      ],
      comparison_focus: [
        "answer", "key_points", "comparison", "spec_table", "figure", "summary", "cta",
        "faq", "sources", "freshness",
      ],
      howto: ["answer", "key_points", "figure", "summary", "cta", "faq", "sources", "freshness"],
      news: ["answer", "key_points", "summary", "figure", "faq", "sources", "freshness", "cta"],
      minimal: ["answer", "key_points", "summary", "faq", "sources", "freshness"],
      gadget: [
        "answer", "key_points", "spec_table", "figure", "comparison", "cta", "summary",
        "faq", "sources", "freshness",
      ],
    });
  });

  it("推奨順に出てくる種類は、すべて表現ブロックの一覧にある名前", () => {
    for (const template of BLOG_TEMPLATES) {
      for (const kind of template.articleBlockOrder) {
        expect(EXPRESSION_BLOCK_KINDS).toContain(kind);
      }
    }
  });
});

describe("表現ブロックと固定ページの名札", () => {
  it("表現ブロックは 10 種で、AI 検索向けの 5 種が先頭に並ぶ", () => {
    expect([...EXPRESSION_BLOCK_KINDS]).toEqual([
      "answer", "key_points", "faq", "sources", "freshness",
      "figure", "comparison", "cta", "summary", "spec_table",
    ]);
  });

  it("表現ブロックの名札が 10 種とも、この文言で入っている", () => {
    expect(EXPRESSION_BLOCK_LABEL).toEqual({
      answer: "結論（先に答え）",
      key_points: "要点",
      faq: "よくある質問",
      sources: "出典",
      freshness: "最終更新・〜時点",
      figure: "図解",
      comparison: "比較表",
      cta: "行動の呼びかけ",
      summary: "まとめ",
      spec_table: "スペック表",
    });
  });

  it("固定ページは公開語彙 8 種と同じ正本を指す", () => {
    expect([...LEGAL_PAGE_KINDS]).toEqual([
      "profile", "sitemap", "site_policy", "privacy_policy", "commercial_transaction", "contact", "review_guidelines", "company",
    ]);
    expect(LEGAL_PAGE_LABEL).toEqual({
      profile: "運営者プロフィール",
      sitemap: "サイトマップ",
      site_policy: "サイトポリシー",
      privacy_policy: "プライバシーポリシー",
      commercial_transaction: "特定商取引法に基づく表記",
      contact: "お問い合わせ",
      review_guidelines: "レビュー方針",
      company: "運営会社",
    });
  });
});

describe("型を ID から引く", () => {
  it("6 種とも、ID からその型が引ける", () => {
    for (const id of BLOG_TEMPLATE_IDS) {
      expect(findBlogTemplate(id)?.id).toBe(id);
    }
  });

  it("知らない ID・空文字は null（既定へ落とす判断は呼び出し側に残す）", () => {
    expect(findBlogTemplate("no_such_template")).toBeNull();
    expect(findBlogTemplate("")).toBeNull();
    // 大文字小文字は寄せない。ID は表の値そのもの。
    expect(findBlogTemplate("REVIEW_FOCUS")).toBeNull();
  });
});

describe("テンプレートの並びで記事を並べ直す（REQ-BLOG01 の中核）", () => {
  it("推奨順のとおりに並び替わる", () => {
    const template = { articleBlockOrder: ["answer", "summary", "cta"] as const };
    const ordered = orderBlocksForTemplate(template, [
      block("cta"),
      block("answer"),
      block("summary"),
    ]);
    expect(kindsOf(ordered)).toEqual(["answer", "summary", "cta"]);
  });

  it("元の配列を書き換えない（呼び出し側の記事が並び替えで動かない）", () => {
    const template = { articleBlockOrder: ["answer", "summary"] as const };
    const blocks = [block("summary"), block("answer")];
    orderBlocksForTemplate(template, blocks);
    expect(kindsOf(blocks)).toEqual(["summary", "answer"]);
  });

  it("1 つも無ければ、空のまま返す", () => {
    const template = { articleBlockOrder: ["answer"] as const };
    expect(orderBlocksForTemplate(template, [])).toEqual([]);
  });

  it("並びに無い種類は末尾へ回り、その中では元の順が保たれる", () => {
    // answer/summary だけを知っているテンプレートに、未知を 3 つ混ぜる。
    // 未知が 1 つだけだと「同順位のときは元の順」が踏まれず、検査にならない。
    const template = { articleBlockOrder: ["answer", "summary"] as const };
    const ordered = orderBlocksForTemplate(template, [
      block("cta"),
      block("summary"),
      block("figure"),
      block("answer"),
      block("spec_table"),
    ]);
    expect(kindsOf(ordered)).toEqual(["answer", "summary", "cta", "figure", "spec_table"]);
  });

  it("並びを 1 つも知らないテンプレートでも、元の順のまま全部返る", () => {
    const template = { articleBlockOrder: [] as const };
    const blocks = [block("cta"), block("figure"), block("answer")];
    expect(kindsOf(orderBlocksForTemplate(template, blocks))).toEqual(["cta", "figure", "answer"]);
  });

  it("同じ種類が 2 つあっても、その 2 つの前後は入れ替わらない", () => {
    const template = { articleBlockOrder: ["answer", "summary"] as const };
    const first = block("summary");
    const second = block("summary");
    const ordered = orderBlocksForTemplate(template, [first, second, block("answer")]);
    expect(ordered[1]).toBe(first);
    expect(ordered[2]).toBe(second);
  });

  it("6 種どのテンプレートでも、10 種すべてのブロックが 1 つも落ちない（REQ-BLOG01）", () => {
    const all = EXPRESSION_BLOCK_KINDS.map((kind) => block(kind));
    for (const template of BLOG_TEMPLATES) {
      const ordered = orderBlocksForTemplate(template, all);
      expect(ordered).toHaveLength(all.length);
      // 件数だけでなく、種類の集まりが元と同一であること（すり替えも許さない）。
      expect([...kindsOf(ordered)].sort()).toEqual([...kindsOf(all)].sort());
      // 推奨順に載っている種類はその順に、載っていない種類は元の順のまま末尾へ。
      const listed = [...template.articleBlockOrder];
      const rest = kindsOf(all).filter((k) => !listed.includes(k));
      expect(kindsOf(ordered)).toEqual([...listed, ...rest]);
    }
  });

  it("テンプレートを差し替えても、記事のブロックは行き来するだけで消えない（受入条件 1）", () => {
    const all = EXPRESSION_BLOCK_KINDS.map((kind) => block(kind));
    const before = orderBlocksForTemplate(BLOG_TEMPLATES[0], all);
    const after = orderBlocksForTemplate(BLOG_TEMPLATES[4], before);
    expect(after).toHaveLength(all.length);
    expect([...kindsOf(after)].sort()).toEqual([...kindsOf(all)].sort());
  });
});

describe("スロットの差し替え", () => {
  it("差し替え先があれば、そのブロックごと入れ替わる", () => {
    const filled = fillSlots([block("spec_table", "gadget_spec")], {
      gadget_spec: block("summary"),
    });
    expect(kindsOf(filled)).toEqual(["summary"]);
  });

  it("差し替え先が無い名前は、fallback を本文にした まとめ へ落ちる（黙って空にしない）", () => {
    const filled = fillSlots([block("spec_table", "gadget_spec")], {});
    expect(filled).toHaveLength(1);
    expect(filled[0].kind).toBe("summary");
    expect(filled[0]).toMatchObject({ text: "gadget_spec の代わり" });
  });

  it("スロットの付いていないブロックは、そのまま素通りする", () => {
    const plain = block("figure");
    const filled = fillSlots([plain], { gadget_spec: block("summary") });
    expect(filled[0]).toBe(plain);
  });

  it("差し替えても件数は変わらない（差し替えでブロックが消えない）", () => {
    const blocks = [block("answer"), block("spec_table", "a"), block("figure", "b")];
    const filled = fillSlots(blocks, { a: block("summary") });
    expect(filled).toHaveLength(blocks.length);
    expect(kindsOf(filled)).toEqual(["answer", "summary", "summary"]);
  });
});

describe("ページに効く配色（REQ-BLOG02）", () => {
  const blogTheme = { brandTheme: "blue", colorMode: "auto" } as const;

  it("上書きを外す（null）と、ブログ既定がそのまま返る", () => {
    expect(resolvePageTheme(blogTheme, null)).toEqual(blogTheme);
  });

  it("両方を上書きすると、両方が効く", () => {
    expect(resolvePageTheme(blogTheme, { brandTheme: "pink", colorMode: "dark" })).toEqual({
      brandTheme: "pink",
      colorMode: "dark",
    });
  });

  it("片方だけの上書きは、その欄だけが効く（もう片方は既定のまま）", () => {
    expect(resolvePageTheme(blogTheme, { brandTheme: "green" })).toEqual({
      brandTheme: "green",
      colorMode: "auto",
    });
    expect(resolvePageTheme(blogTheme, { colorMode: "light" })).toEqual({
      brandTheme: "blue",
      colorMode: "light",
    });
  });

  it("空の上書きは、何も上書きしない（null と同じ結果になる）", () => {
    expect(resolvePageTheme(blogTheme, {})).toEqual(blogTheme);
  });

  it("返ってくるのは新しい値で、ブログ既定そのものを書き換えない", () => {
    const result = resolvePageTheme(blogTheme, { brandTheme: "grey" });
    expect(result).not.toBe(blogTheme);
    expect(blogTheme.brandTheme).toBe("blue");
  });
});
