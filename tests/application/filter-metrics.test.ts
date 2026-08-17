/** @tier 1 */
import { describe, expect, it } from "vitest";
import type { AnalyticsAxisKey } from "@/domain/analytics";
import { ANALYTICS_AXES } from "@/domain/analytics";
import { analyticsUseCases, createToolCatalog, currentActor } from "@/presentation/composition";

/**
 * 数字の絞り込み (§9.10 / §22.8)。
 *
 * ここで固定したいのは、いちばん誤解を生む 1 点。
 *   **「分けられない」を 0 と書かない。**
 * 「この商品の読了率 0%」は記事を書き直す判断につながるが、
 * 実際は商品ごとに読了率を数えていないだけ、ということが起きる。
 * その差が消えないよう、値ではなく理由が返ることをテストで留める。
 */

async function filter(axes: Partial<Record<AnalyticsAxisKey, string>> = {}) {
  const actor = await currentActor();
  const result = await (await analyticsUseCases()).filterMetrics.execute(actor, { axes });
  expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("切り口の一覧", () => {
  it("仕様書の 11 軸がそのまま出る（順序も同じ）", async () => {
    const view = await filter();
    expect(view.axes).toHaveLength(11);
    expect(view.axes.map((a) => a.key)).toEqual(ANALYTICS_AXES.map((a) => a.key));
  });

  it("どの軸にも「何が分かるか」の説明がある", async () => {
    const view = await filter();
    for (const axis of view.axes) {
      expect(axis.label.length, axis.key).toBeGreaterThan(0);
      expect(axis.whatItTells.length, axis.key).toBeGreaterThan(5);
    }
  });

  it("選べない軸は、空の選択肢ではなく理由を返す", async () => {
    const view = await filter();
    for (const axis of view.axes) {
      if (axis.options.length === 0) {
        expect(axis.unavailableReason, `${axis.key} に理由がありません`).not.toBeNull();
        expect(axis.unavailableReason?.length ?? 0).toBeGreaterThan(5);
      } else {
        expect(axis.unavailableReason, `${axis.key} は選べるのに理由が付いています`).toBeNull();
      }
    }
  });

  it("投稿日時は、値の一覧ではなく理由を返す（日付は列挙するものではない）", async () => {
    const view = await filter();
    const axis = view.axes.find((a) => a.key === "publishedAt");
    expect(axis?.unavailableReason).not.toBeNull();
  });

  it("選べる軸の選択肢には、表示用の名前が付いている", async () => {
    const view = await filter();
    const site = view.axes.find((a) => a.key === "site");
    expect(site?.options.length ?? 0).toBeGreaterThan(0);
    for (const o of site?.options ?? []) {
      expect(o.value.length).toBeGreaterThan(0);
      expect(o.label.length).toBeGreaterThan(0);
    }
  });
});

describe("絞り込まないとき", () => {
  it("絞り込み中の一文を出さない", async () => {
    const view = await filter();
    expect(view.filterSummary).toBeNull();
    expect(view.appliedAxisCount).toBe(0);
  });

  it("「分けられない」は 1 件も出ない（全体の値は全部出せる）", async () => {
    const view = await filter();
    expect(view.unsplittableCount).toBe(0);
  });

  it("お金に近い切り口の注意は出さない", async () => {
    const view = await filter();
    expect(view.commercialWarning).toBeNull();
  });
});

describe("分けられない指標を 0 と書かない", () => {
  it("絞り込むと、分けて数えていない指標は値ではなく理由を返す", async () => {
    const view = await filter({ site: "site_makuring" });
    const unsplittable = view.rows.filter((r) => r.value === null && r.unavailableReason !== null);
    expect(unsplittable.length).toBeGreaterThan(0);
    for (const row of unsplittable) {
      // 「0」と読める表示になっていないこと
      expect(row.valueLabel).not.toBe("0");
      expect(row.valueLabel).not.toBe("0%");
      expect(row.unavailableReason?.length ?? 0).toBeGreaterThan(10);
    }
    expect(view.unsplittableCount).toBe(unsplittable.length);
  });

  it("分けて数えている指標は、絞り込んでも値が出る", async () => {
    const view = await filter({ site: "site_makuring" });
    const views = view.rows.find((r) => r.key === "page_views");
    expect(views?.value).not.toBeNull();
    expect(views?.unavailableReason).toBeNull();
  });

  it("絞り込むと、全体より値が小さくなる（絞ったのに同じ数字にならない）", async () => {
    const all = await filter();
    const one = await filter({ site: "site_makuring" });
    const allViews = all.rows.find((r) => r.key === "page_views")?.value ?? 0;
    const oneViews = one.rows.find((r) => r.key === "page_views")?.value ?? 0;
    expect(oneViews).toBeGreaterThan(0);
    expect(oneViews).toBeLessThan(allViews);
  });

  it("当てはまるものが無い条件では、0 ではなく理由を返す", async () => {
    const view = await filter({ site: "site_does_not_exist" });
    expect(view.emptyReason).not.toBeNull();
    expect(view.emptyReason).toContain("条件");
  });
});

describe("いま何で絞っているかを言葉で出す", () => {
  it("絞り込み中の一文に、軸の名前と選んだ値の名前が入る", async () => {
    const view = await filter({ site: "site_makuring" });
    expect(view.filterSummary).not.toBeNull();
    expect(view.filterSummary).toContain("ブログ");
    expect(view.appliedAxisCount).toBe(1);
  });

  it("2 つの軸で絞ると、両方が一文に入る", async () => {
    const view = await filter({ site: "site_makuring", channel: "own_site" });
    expect(view.appliedAxisCount).toBe(2);
    expect(view.filterSummary).toContain("ブログ");
    expect(view.filterSummary).toContain("媒体");
  });

  it("知らない軸の指定は黙って捨てる（絞ったことにしない）", async () => {
    const actor = await currentActor();
    const result = await (await analyticsUseCases()).filterMetrics.execute(actor, {
      axes: { not_an_axis: "x" } as unknown as Partial<Record<AnalyticsAxisKey, string>>,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.appliedAxisCount).toBe(0);
    expect(result.value.filterSummary).toBeNull();
  });
});

describe("お金に近い切り口の注意", () => {
  it("CTA・販売店・ASP で絞ると、順位へ戻さない注意が出る", async () => {
    for (const key of ["cta", "merchant", "asp"] as const) {
      const view = await filter({ [key]: "x" } as Partial<Record<AnalyticsAxisKey, string>>);
      expect(view.commercialWarning, `${key} で注意が出ていません`).not.toBeNull();
      expect(view.commercialWarning).toContain("順位");
    }
  });

  it("お金に近くない切り口では注意を出さない（毎回出すと読まれなくなる）", async () => {
    const view = await filter({ site: "site_makuring" });
    expect(view.commercialWarning).toBeNull();
  });

  it("注意には、代わりに何に使えるかが書いてある", async () => {
    const view = await filter({ asp: "a8" });
    expect(view.commercialWarning).toContain("書き直し");
  });
});

describe("道具としても同じことができる", () => {
  it("filter_metrics が道具の一覧に登録されている", async () => {
    const catalog = (await createToolCatalog());
    const tool = catalog.find((t) => t.name === "filter_metrics");
    expect(tool, "filter_metrics が登録されていません").toBeDefined();
    expect(tool?.readOnly).toBe(true);
  });

  it("道具の説明に、分けられない指標の扱いが書いてある", async () => {
    const catalog = (await createToolCatalog());
    const tool = catalog.find((t) => t.name === "filter_metrics");
    expect(tool?.description).toContain("分けられません");
  });
});
