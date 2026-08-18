/**
 * @tier 1
 * @req REQ-WB01
 * @types permission-matrix, equivalence, boundary
 *
 * 読者側 読み取り 9 種（REQ-WB01）を、読者の身元で 1 つずつ呼ぶ。
 *
 *   同値      8 種それぞれが中身つきで返ること（面が違えば返るものも違う）
 *   境界      絞り込みが 0 件のとき・記事が無いとき（空の成功にしない）
 *   権限      管理用の読み取りは読者の身元では断られること、
 *             画面に出していないものは返らないこと
 */
import { describe, expect, it } from "vitest";
import { createToolCatalog, readerActor } from "@/presentation/composition";
import { findTool } from "@/presentation/tools/catalog";
import { invokeTool } from "@/presentation/tools/tool-definition";
import { PAGE_TOOLS } from "@/presentation/tools/webmcp-policy";
import { SAMPLE_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";

/**
 * 読者ページに載せている AI 向けの道具を、**読者の身元で 1 つずつ**呼ぶ。
 *
 * --- なぜこの検査が要るか ---
 * ここは 3 回目である。「口はあるが、その経路からは動かない」が
 * 表現ポリシー・操作の記録に続いて読者ページの道具でも起きた。
 * 3 つとも**画面上は正常に見える**（道具の名前が並んでいる）ので、
 * 使ってみて気づくことができない。
 *
 * だから「200 が返った」では止めない。**中身が返ることまで見る。**
 * ここの道具は記事にその面が無いとき空＋理由を返す作りなので、
 * 空だけを見て通すと「全部断られている」状態でも緑になってしまう。
 *
 * --- 何を守っているか ---
 *   1. 読者の身元で実行できる（`ah-83f` の受入条件）
 *   2. 記事に在るものは中身が返る（空＋理由で誤魔化されていない）
 *   3. 画面に出していないものは返らない（新しい漏れ口を作っていない）
 *   4. 管理用の読み取りは、読者の身元では引き続き断られる（`ah-2ro` を崩さない）
 */

const catalog = await createToolCatalog();
const reader = readerActor();

/** 見本の順位記事。順位・評価基準・商品カードが揃っている。 */
const RANKING_ARTICLE = { siteSlug: SAMPLE_SITE_SLUG, slug: "laptops-for-video-editing" };
/** 見本の比較記事。比較表が入っている。 */
const COMPARISON_ARTICLE = { siteSlug: SAMPLE_SITE_SLUG, slug: "alpha-vs-beta" };

async function callAsReader(name: string, args: Record<string, unknown>) {
  const tool = findTool(catalog, name);
  expect(tool, `${name} が目録にありません。`).not.toBeNull();
  if (tool === null) throw new Error(name);
  return invokeTool(tool, reader, args);
}

/** 読者ページに載せている道具の名前（管理画面ぶんは除く）。 */
const readerPageTools = [
  ...new Set(
    Object.entries(PAGE_TOOLS)
      .filter(([kind]) => kind !== "admin")
      .flatMap(([, names]) => names),
  ),
];

describe("読者の身元で、読者ページの道具が動く", () => {
  /**
   * まず全件をまとめて 1 度通す。
   *
   * 個別の検査だけにすると、`PAGE_TOOLS` に道具を足したときに
   * **その 1 件だけ検査されないまま**通る。一覧から引いて全件を舐める。
   */
  it.each(readerPageTools)("%s が、読者の身元で断られない", async (name) => {
    const tool = findTool(catalog, name);
    expect(tool, `${name} が目録にありません。`).not.toBeNull();
    if (tool === null) return;
    // 記事の文脈に加えて、商品を要る道具のために productId も渡す。
    // 余分な項目は入力の検証で落ちないことを確認済み（zod は既定で余りを捨てる）。
    const parsed = tool.parse({ ...RANKING_ARTICLE, productId: "p_alpha_15" });
    expect(parsed.ok, `${name} の入力が組み立てられません。`).toBe(true);
    if (!parsed.ok) return;
    const result = await tool.useCase.execute(reader, parsed.value);
    expect(result.ok, `${name} が読者の身元で断られました。`).toBe(true);
  });

  it("順位の一覧が、実際に中身つきで返る", async () => {
    const result = await callAsReader("reader_list_ranking", RANKING_ARTICLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as { entries: readonly { rank: number }[]; notice: string | null };
    expect(value.entries.length).toBeGreaterThan(0);
    // 空＋理由で誤魔化されていないこと。ここが緩いと「全部断られている」でも通る。
    expect(value.notice).toBeNull();
  });

  it("順位の理由が、重みつきの評価基準として返る", async () => {
    const result = await callAsReader("reader_explain_ranking", RANKING_ARTICLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as {
      criteria: readonly { label: string; weight: number; measurement: string }[];
    };
    expect(value.criteria.length).toBeGreaterThan(0);
    // 重みと測り方を隠さない。順位だけ見せて決め方を見せないのは、
    // 読者がその順位を自分で検算できない状態を作る。
    for (const c of value.criteria) {
      expect(c.weight).toBeGreaterThan(0);
      expect(c.measurement.trim()).not.toBe("");
    }
  });

  it("商品 1 件が、値の無い項目も省略せずに返る", async () => {
    const result = await callAsReader("reader_get_product", {
      ...RANKING_ARTICLE,
      productId: "p_alpha_15",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as {
      card: { name: string; specs: readonly { label: string; value: string | null }[] } | null;
    };
    expect(value.card?.name).toBe("Alpha Studio 15");
    // 値が無い項目を落とすと、商品ごとに並びが変わって横に見比べられなくなる。
    expect(value.card?.specs.some((s) => s.value === null)).toBe(true);
  });

  it("比較表が、比較記事から実際に返る", async () => {
    const result = await callAsReader("reader_compare_products", COMPARISON_ARTICLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as { columns: readonly unknown[]; rows: readonly unknown[] };
    expect(value.columns.length).toBeGreaterThan(0);
    expect(value.rows.length).toBeGreaterThan(0);
  });

  it("根拠が、事実・推測の区別つきで返る", async () => {
    const result = await callAsReader("reader_get_evidence", RANKING_ARTICLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as {
      claims: readonly { statement: string; kind: string }[];
    };
    expect(value.claims.length).toBeGreaterThan(0);
    for (const c of value.claims) {
      expect(["fact", "inference", "opinion"]).toContain(c.kind);
    }
  });

  it("ほかの選択肢が、同じ記事の中から返る", async () => {
    const result = await callAsReader("reader_find_alternatives", {
      ...RANKING_ARTICLE,
      productId: "p_alpha_15",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as { alternatives: readonly { productId: string }[] };
    expect(value.alternatives.length).toBeGreaterThan(0);
    // 尋ねた商品そのものを「代わり」として返さない。
    expect(value.alternatives.some((a) => a.productId === "p_alpha_15")).toBe(false);
  });

  it("絞り込みが、0 件のときも元の件数と理由を返す", async () => {
    const hit = await callAsReader("reader_filter_products", {
      ...RANKING_ARTICLE,
      text: "Alpha",
    });
    expect(hit.ok).toBe(true);
    if (!hit.ok) return;
    expect((hit.value as { cards: readonly unknown[] }).cards.length).toBeGreaterThan(0);

    const miss = await callAsReader("reader_filter_products", {
      ...RANKING_ARTICLE,
      text: "そんな商品はありません",
    });
    expect(miss.ok).toBe(true);
    if (!miss.ok) return;
    const value = miss.value as {
      cards: readonly unknown[];
      totalBeforeFilter: number;
      notice: string | null;
    };
    // 0 件を失敗にしない。ただし黙って空を返すこともしない。
    expect(value.cards).toEqual([]);
    expect(value.totalBeforeFilter).toBeGreaterThan(0);
    expect(value.notice ?? "").not.toBe("");
  });

  it("広告表示が、記事の判断と方針の文書として返る", async () => {
    const result = await callAsReader("reader_get_disclosure", RANKING_ARTICLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as { disclosureRequired: boolean; showsRankingNote: boolean };
    expect(value.disclosureRequired).toBe(true);
    // 順位のある記事では「報酬を順位に使っていない」も併せて出している。
    expect(value.showsRankingNote).toBe(true);
  });
});

describe("画面より広い出口を作っていない", () => {
  /**
   * 記事にその面が無いときは、**別の記事から持って来ない**。
   *
   * ここを埋めたくなるのが、いちばん自然な壊し方である。
   * 「比較記事で順位を聞かれたから、同じカテゴリーの順位記事を返す」は
   * 親切に見えて、読者がその順位の根拠を 1 行も読んでいない状態を作る。
   */
  it("比較記事に順位を尋ねても、ほかの記事の順位を返さない", async () => {
    const result = await callAsReader("reader_list_ranking", COMPARISON_ARTICLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as { entries: readonly unknown[]; notice: string | null };
    expect(value.entries).toEqual([]);
    expect(value.notice ?? "").not.toBe("");
  });

  it("その記事が扱っていない商品は返さない", async () => {
    const result = await callAsReader("reader_get_product", {
      ...COMPARISON_ARTICLE,
      productId: "p_alpha_15",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as { card: unknown | null; notice: string | null };
    expect(value.card).toBeNull();
    expect(value.notice ?? "").not.toBe("");
  });

  it("無い記事は、理由つきで断る（空の成功にしない）", async () => {
    const result = await callAsReader("reader_list_ranking", {
      siteSlug: SAMPLE_SITE_SLUG,
      slug: "no-such-article",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
    expect((result.error.suggestedAction ?? "").trim()).not.toBe("");
  });
});

describe("管理用の読み取りは、読者の身元では引き続き断られる", () => {
  /**
   * `ah-2ro` で作った状態を崩していないことの確認。
   *
   * 読者ページを直すために運営側の権限を緩めるのが、いちばんやりがちな直し方で、
   * それをやると読者ページは動くようになるが**運営側のデータが全部読める**。
   */
  it.each(["get_product", "list_ranking", "list_test_runs", "get_evidence"])(
    "%s は読者の身元では断られる",
    async (name) => {
      const result = await callAsReader(name, { productId: "p_alpha_15" });
      expect(result.ok, `${name} が読者の身元で通ってしまいました。`).toBe(false);
    },
  );
});
