/**
 * @tier 1
 * @req REQ-BLOG01, REQ-BLOG02, A1, A2, A5, A8
 * @types equivalence, boundary, regression
 *
 * feat-blog-ui-builder の受入 A1（テンプレート）・A2（配色 2 層）の
 * **ドメイン側**の確認。
 *
 * ここが見るのは「差し替えても壊れない」「外すと戻る」という
 * 2 つの不変条件そのものであって、画面の見た目ではない。
 * 画面は差し替えられるが、この 2 つが崩れたら
 * どんな画面を作っても受入は満たせない。
 *
 * 永続化（A8）と画面（A1 の選択 UI・A2 の設定 UI）は
 * まだ存在しない。それらは `sticky-layout.test.ts` と同じく
 * P06 の実装で緑になる。
 */
import { describe, expect, it } from "vitest";
import {
  BLOG_TEMPLATES,
  BLOG_TEMPLATE_IDS,
  EXPRESSION_BLOCK_KINDS,
  type ExpressionBlock,
  fillSlots,
  findBlogTemplate,
  orderBlocksForTemplate,
  resolvePageTheme,
} from "@/domain/authoring/blog-template";

const anArticle: readonly ExpressionBlock[] = [
  { kind: "answer", text: "この用途なら B が良い。" },
  { kind: "spec_table", rows: [{ label: "重さ", value: "1.2kg" }] },
  { kind: "figure", caption: "内部構造", src: "/img/x.png" },
  { kind: "faq", items: [{ question: "電池は持つ？", answer: "約 10 時間。" }] },
] as readonly ExpressionBlock[];

describe("A1 テンプレート 6 種", () => {
  it("6 種すべてが引ける（語彙と定義が一致している）", () => {
    expect(BLOG_TEMPLATE_IDS).toHaveLength(6);
    for (const id of BLOG_TEMPLATE_IDS) {
      expect(findBlogTemplate(id)).not.toBeNull();
    }
    expect(BLOG_TEMPLATES).toHaveLength(BLOG_TEMPLATE_IDS.length);
  });

  it("知らない名前は null（外から来た値を素通しさせない）", () => {
    expect(findBlogTemplate("そんなテンプレートはない")).toBeNull();
    expect(findBlogTemplate("")).toBeNull();
  });

  /**
   * **A1 の本体。**
   *
   * 「差し替えても既存記事が壊れない」を
   * 「どのテンプレートで並べ替えてもブロックの集合が変わらない」に翻訳する。
   *
   * 並び **順** は変わってよい。変わってはいけないのは **集合** である。
   * ここを集合でなく順序で見ると、テンプレートが並びを決めるという
   * 本来の役目まで禁止してしまう。
   */
  it("どのテンプレートへ差し替えてもブロックの集合が変わらない", () => {
    const before = [...anArticle].map((b) => b.kind).sort();

    for (const id of BLOG_TEMPLATE_IDS) {
      const template = findBlogTemplate(id);
      expect(template).not.toBeNull();
      const after = orderBlocksForTemplate(template!, anArticle)
        .map((b) => b.kind)
        .sort();
      expect(after, `テンプレート ${id} で集合が変わった`).toEqual(before);
    }
  });

  it("推奨順に無いブロックは飛ばされる（消えない）", () => {
    // minimal は推奨順が短い。載っていない kind が落ちないことを見る。
    const minimal = findBlogTemplate("minimal");
    expect(minimal).not.toBeNull();
    const ordered = orderBlocksForTemplate(minimal!, anArticle);
    expect(ordered).toHaveLength(anArticle.length);
  });

  it("テンプレートは『使えるブロック』を決めない", () => {
    // 全 10 種を 1 記事に入れても、どのテンプレートでも 10 種のまま出る。
    const everything = EXPRESSION_BLOCK_KINDS.map(
      (kind) => ({ kind, text: "x", items: [], rows: [] }) as unknown as ExpressionBlock,
    );
    for (const id of BLOG_TEMPLATE_IDS) {
      const t = findBlogTemplate(id)!;
      expect(orderBlocksForTemplate(t, everything)).toHaveLength(EXPRESSION_BLOCK_KINDS.length);
    }
  });
});

describe("A2 配色 2 層（既定と上書き）", () => {
  const blogDefault = { brandTheme: "indigo-teal", colorMode: "dark" } as const;

  it("上書きが無ければブログ既定が効く", () => {
    expect(resolvePageTheme(blogDefault, null)).toEqual(blogDefault);
  });

  it("上書きを外すと既定へ戻る（A2 の本体）", () => {
    const overridden = resolvePageTheme(blogDefault, { brandTheme: "pink" });
    expect(overridden.brandTheme).toBe("pink");

    // 「外す」は null を渡すこと＝行が無いこと。
    expect(resolvePageTheme(blogDefault, null)).toEqual(blogDefault);
  });

  it("軸ごとに独立して上書きできる（境界）", () => {
    // 配色だけ上書き、明暗は既定のまま。
    expect(resolvePageTheme(blogDefault, { brandTheme: "green" })).toEqual({
      brandTheme: "green",
      colorMode: "dark",
    });
    // 明暗だけ上書き、配色は既定のまま。
    expect(resolvePageTheme(blogDefault, { colorMode: "light" })).toEqual({
      brandTheme: "indigo-teal",
      colorMode: "light",
    });
  });

  it("空の上書きは既定と同じ（＝行を作る意味が無い）", () => {
    // 両軸とも未指定の上書きは、既定と 1 文字も違わない。
    // つまりこの行を保存することに意味は無く、
    // 保存経路は DELETE へ倒さなければならない（不変条件 I2）。
    expect(resolvePageTheme(blogDefault, {})).toEqual(blogDefault);
  });
});

describe("A5 スロット差し替え", () => {
  const withSlot: readonly ExpressionBlock[] = [
    {
      kind: "summary",
      text: "ガジェット向けの説明",
      slot: { name: "gadget_note", fallback: "この機種に固有の注意はありません。" },
    },
  ] as readonly ExpressionBlock[];

  it("差し替え先があれば置き換わる", () => {
    const replaced = fillSlots(withSlot, {
      gadget_note: { kind: "summary", text: "キッチン向けの説明" } as ExpressionBlock,
    });
    expect(replaced[0]).toEqual({ kind: "summary", text: "キッチン向けの説明" });
  });

  /**
   * **黙って空にしない。**
   *
   * 空になると「書き忘れ」と「差し替え先が無い」が区別できない。
   * 読者から見れば同じ空白だが、直し方は正反対である。
   */
  it("差し替え先が無ければ fallback が出る（空にならない）", () => {
    const replaced = fillSlots(withSlot, {});
    expect(replaced).toHaveLength(1);
    expect(replaced[0]).toEqual({
      kind: "summary",
      text: "この機種に固有の注意はありません。",
    });
  });

  it("スロットの無いブロックは触られない", () => {
    const plain: readonly ExpressionBlock[] = [{ kind: "answer", text: "答え" }];
    expect(fillSlots(plain, { whatever: { kind: "summary", text: "x" } as ExpressionBlock })).toEqual(
      plain,
    );
  });
});
