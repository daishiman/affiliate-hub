import { describe, expect, it } from "vitest";
import { listStubs } from "@/infrastructure/stub-registry";
import {
  contentUseCases,
  createToolCatalog,
  currentActor,
  distributionUseCases,
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

  it("いまの見本のログインでは配信を作れず、その理由が記事の画面に先に出る", async () => {
    const actor = await currentActor();

    // ここは差し替えの無い**本番の組み立て**を通す。
    // 差し替えたテストだけで済ませると、画面の押しボタンが
    // 権限や保存先の都合で必ず断られる状態に気づけない（実際そうなっていた）。
    //
    // 見本のログインに公開の権限を足して緑にするのは**やらない**。
    // 足すと、認証が入っていない状態のまま公開まで通ってしまう
    // （`src/infrastructure/identity/sample-actor.ts` に理由が書いてある）。
    const got = await (await distributionUseCases()).schedule.execute(actor, {
      variantId: "cv_alpha_approved",
      channelKind: "own_site",
    });
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");

    // 押してから断るのではなく、開いた時点で理由が出ていること。
    const detail = await contentUseCases().getContent.execute(actor, {
      variantId: "cv_alpha_approved",
    });
    expect(detail.ok).toBe(true);
    if (!detail.ok) return;
    expect(detail.value.publishBlockedReason).toContain("権限");
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
