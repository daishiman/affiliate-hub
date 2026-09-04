/**
 * @tier 1
 * @req REQ-BLOG04
 * 受入条件 A5（`docs/spec/feat-blog-ops-crud/requirements-baseline.md`）に対応する。
 * `@req` は要件表の ID しか拾わないので、受入 ID はここに文章で残す。
 * @types boundary, equivalence
 *
 * 記事の骨格 — 目次の階層・記事型ごとの部品列・商品カードの再掲場所。
 *
 * **当てるのは表との関係であって、表の中身の写しではない。**
 * `TEMPLATE_BLOCK_ORDER` をテストへ書き写すと、表を直すたびに 2 か所を直す羽目になり、
 * 片方だけ直した日に、テストは緑のまま守るものが減る。
 */
import { describe, expect, it } from "vitest";
import {
  ARTICLE_BLOCK_TOC_LEVEL,
  ARTICLE_TEMPLATES,
  blocksOutOfTemplateOrder,
  buildOutline,
  PRODUCT_CARD_PLACEMENTS,
  TEMPLATE_BLOCK_ORDER,
} from "@/domain/blogops";
import type { ArticleBlockKind, ArticleTemplate } from "@/domain/blogops";

function block(kind: ArticleBlockKind, heading: string = kind) {
  return { kind, heading };
}

/** 記事型の並びそのものを、その型の正しい記事として使う。 */
function inOrder(template: ArticleTemplate) {
  return TEMPLATE_BLOCK_ORDER[template].map((kind) => block(kind));
}

describe("目次の階層", () => {
  it("目次に載る部品と載らない部品の両方が表にある", () => {
    // 母集団の床（`form2-population-floor`）。
    // 全部 null の表でも「飾りは載らない」は緑になってしまう。
    const levels = Object.values(ARTICLE_BLOCK_TOC_LEVEL);
    expect(levels.filter((l) => l !== null).length).toBeGreaterThan(0);
    expect(levels.filter((l) => l === null).length).toBeGreaterThan(0);
  });

  it("表で null の部品は、見出しが入っていても目次に出ない", () => {
    const hidden = (Object.keys(ARTICLE_BLOCK_TOC_LEVEL) as ArticleBlockKind[]).filter(
      (kind) => ARTICLE_BLOCK_TOC_LEVEL[kind] === null,
    );
    const outline = buildOutline(hidden.map((kind) => block(kind, "見出しあり")));
    expect(outline).toEqual([]);
  });

  it("3 段目は直前の 2 段目にぶら下がり、番号は親-子になる", () => {
    const outline = buildOutline([
      block("spec-section", "必要な条件"),
      block("criterion-section", "軸 1"),
      block("criterion-section", "軸 2"),
      block("pick-section", "選んだもの"),
    ]);
    expect(outline.map((n) => n.label)).toEqual(["1", "2"]);
    expect(outline[0]?.children.map((c) => c.label)).toEqual(["1-1", "1-2"]);
    // 次の 2 段目は、前の子を引き継がない。
    expect(outline[1]?.children).toEqual([]);
  });

  it("親のいない 3 段目は捨てずに 2 段目として出す", () => {
    // 捨てると「目次に無い見出し」が本文にだけ在る状態になり、
    // 読者は目次を信用できなくなる。順序の誤りは運営側で言う。
    const outline = buildOutline([
      block("criterion-section", "軸だけが先にある"),
      block("spec-section", "必要な条件"),
    ]);
    expect(outline).toHaveLength(2);
    expect(outline.map((n) => n.label)).toEqual(["1", "2"]);
  });

  it("見出しが空の部品は目次に出ない（無題の行を作らない）", () => {
    const outline = buildOutline([
      block("spec-section", "  "),
      block("pick-section", "選んだもの"),
    ]);
    expect(outline).toHaveLength(1);
    expect(outline[0]?.label).toBe("1");
  });

  it("番号は 1 から通しで振られる", () => {
    const outline = buildOutline([
      block("spec-section", "あ"),
      block("pick-section", "い"),
      block("summary-section", "う"),
    ]);
    expect(outline.map((n) => n.label)).toEqual(["1", "2", "3"]);
  });
});

describe("記事型ごとの部品列", () => {
  it("全 4 型に並びが決まっている", () => {
    for (const template of ARTICLE_TEMPLATES) {
      expect(TEMPLATE_BLOCK_ORDER[template].length, `${template} の並びが空です`).toBeGreaterThan(
        0,
      );
    }
  });

  it("並びの中に同じ種類が 2 度出てこない（初出の順だけを持つ）", () => {
    for (const template of ARTICLE_TEMPLATES) {
      const order = TEMPLATE_BLOCK_ORDER[template];
      expect(new Set(order).size, `${template} に同じ種類が 2 度あります`).toBe(order.length);
    }
  });

  it("並びどおりの記事は、ずれ 0 件", () => {
    for (const template of ARTICLE_TEMPLATES) {
      expect(blocksOutOfTemplateOrder(template, inOrder(template)), template).toEqual([]);
    }
  });

  it("同じ種類が何度出てもずれにしない（判断軸は n 回、商品カードは 3 箇所）", () => {
    // 2 回目以降を数えると、正しく作った記事が必ず赤くなる。
    const repeated = [
      ...inOrder("T1"),
      ...inOrder("T1").filter((b) => b.kind === "criterion-section"),
      ...inOrder("T1").filter((b) => b.kind === "product-card"),
    ];
    expect(blocksOutOfTemplateOrder("T1", repeated)).toEqual([]);
  });

  it("並びに載っていない種類は、ずれの判定から外す", () => {
    // 型の列に無い部品を 1 つ足しただけで全体が赤くなると、
    // 運営者は足すのをやめる。検査が入れてよいものを止めてはいけない。
    const withExtra = [block("featured-image"), ...inOrder("T1"), block("breadcrumb")];
    expect(blocksOutOfTemplateOrder("T1", withExtra)).toEqual([]);
  });

  it("1 つだけ動かせば直る記事では、その 1 つだけを返す", () => {
    // 素直に前から数えると「まとめより後ろは全部ずれ」になり、
    // 1 手で済む直しを 10 手だと思わせる。
    const order = inOrder("T1");
    const moved = [order[order.length - 1], ...order.slice(0, -1)];
    expect(blocksOutOfTemplateOrder("T1", moved)).toEqual([order[order.length - 1].kind]);
  });

  it("ずれとして返るのは、実際にその記事にある種類だけ", () => {
    const order = inOrder("T1");
    const reversed = [...order].reverse();
    const out = blocksOutOfTemplateOrder("T1", reversed);
    expect(out.length).toBeGreaterThan(0);
    for (const kind of out) {
      expect(order.some((b) => b.kind === kind), `${kind} は記事にありません`).toBe(true);
    }
  });

  it("部品が 1 つ以下ならずれは無い", () => {
    expect(blocksOutOfTemplateOrder("T1", [])).toEqual([]);
    expect(blocksOutOfTemplateOrder("T1", [block("summary-section")])).toEqual([]);
  });

  it("同じ入力なら同じ答えを返す", () => {
    const order = inOrder("T1");
    const shuffled = [order[4], order[0], order[7], order[1], order[9]];
    const first = blocksOutOfTemplateOrder("T1", shuffled);
    expect(blocksOutOfTemplateOrder("T1", shuffled)).toEqual(first);
  });
});

describe("商品カードの再掲場所", () => {
  it("全 4 型に決まっている（無い型は空）", () => {
    for (const template of ARTICLE_TEMPLATES) {
      expect(Array.isArray(PRODUCT_CARD_PLACEMENTS[template]), template).toBe(true);
    }
    // 母集団の床。全部空なら「再掲しない型は空」は当たり前に緑になる。
    const withCards = ARTICLE_TEMPLATES.filter((t) => PRODUCT_CARD_PLACEMENTS[t].length > 0);
    expect(withCards.length).toBeGreaterThan(0);
  });

  it("再掲する場所は、その型の部品列に実在する", () => {
    // 部品列に無い場所を指すと、その再掲は永久に描かれない。
    // 描かれないことは画面を見ても分からない（そこには何も出ないだけ）。
    for (const template of ARTICLE_TEMPLATES) {
      for (const place of PRODUCT_CARD_PLACEMENTS[template]) {
        expect(
          TEMPLATE_BLOCK_ORDER[template].includes(place),
          `${template} の再掲先 ${place} が部品列にありません`,
        ).toBe(true);
      }
    }
  });

  it("同じ場所を 2 度挙げていない", () => {
    for (const template of ARTICLE_TEMPLATES) {
      const places = PRODUCT_CARD_PLACEMENTS[template];
      expect(new Set(places).size, `${template} に同じ再掲先が 2 度あります`).toBe(places.length);
    }
  });

  it("まとめ (比較・順位づけ) の型は 3 箇所に再掲する", () => {
    // 条文 A5 が名指ししている数。ここだけは数を直接当てる。
    expect(PRODUCT_CARD_PLACEMENTS.T1).toHaveLength(3);
  });
});
