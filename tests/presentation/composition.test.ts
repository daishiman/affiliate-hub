import { describe, expect, it } from "vitest";
import { listStubs } from "@/infrastructure/stub-registry";
import {
  createToolCatalog,
  currentActor,
  productDisplayName,
  rankingScreenTarget,
  rankingTool,
} from "@/presentation/composition";
import { invokeTool } from "@/presentation/tools/tool-definition";

/**
 * 組み立て（合成）の確認。
 *
 * 画面が呼ぶ経路と AI が呼ぶ経路が、同じ 1 つの組み立てを通ることを固定する。
 * ここが分かれると「画面では出るのに AI からは出ない」が起きる。
 */
describe("組み立て", () => {
  it("画面の入口と AI の入口が同じ順位を返す", async () => {
    const actor = await currentActor();
    const target = rankingScreenTarget();

    // 画面が使う型付きの入口
    const fromScreen = await invokeTool(rankingTool(), actor, target);

    // AI が使うカタログ経由の入口
    const tool = (await createToolCatalog()).find((t) => t.name === "rank_products");
    expect(tool).toBeDefined();
    const fromAi = await invokeTool(tool!, actor, target);

    expect(fromScreen.ok).toBe(true);
    expect(fromAi.ok).toBe(true);
    if (!fromScreen.ok || !fromAi.ok) return;
    expect(fromScreen.value).toEqual(fromAi.value);
  });

  it("順位には理由が付き、選外にも理由が付く", async () => {
    const actor = await currentActor();
    const result = await invokeTool(rankingTool(), actor, rankingScreenTarget());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.ranked.length).toBeGreaterThan(0);
    for (const row of result.value.ranked) {
      expect(row.breakdown.length).toBeGreaterThan(0);
    }

    // 見本データには合格ラインを下回る商品を 1 件入れてある。
    // 「選外の理由が空文字のまま画面に出る」不具合をここで止める。
    expect(result.value.excluded.length).toBeGreaterThan(0);
    for (const row of result.value.excluded) {
      expect(row.reason.trim()).not.toBe("");
    }
  });

  it("読者へ見せる評価基準が空にならない", async () => {
    const actor = await currentActor();
    const result = await invokeTool(rankingTool(), actor, rankingScreenTarget());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.criteriaDisclosure.length).toBeGreaterThan(0);
    for (const c of result.value.criteriaDisclosure) {
      expect(c.measurement.trim()).not.toBe("");
    }
  });

  it("商品は ID ではなく名前で表示できる", () => {
    const target = rankingScreenTarget();
    for (const id of target.productIds) {
      expect(productDisplayName(id)).not.toBe(id);
    }
  });

  it("見本の保存先はスタブとして名乗っている", () => {
    const ids = listStubs().map((s) => s.id);
    expect(ids).toContain("persistence:ranking-sample");
    expect(ids).toContain("identity:sample-actor");
  });
});
