/**
 * @tier 1
 * @req REQ-P04, REQ-FD02
 * @types decision-table, boundary
 *
 * ランキングを作るユースケース（`rank-products.ts`）の**実行の側**。
 *
 * 組み立て時の遮断（商業データの印）は
 * `tests/architecture/commercial-isolation.test.ts` が見ている。
 * ただしあちらは `createRankProductsUseCase(...)` を**組み立てるだけ**で、
 * `execute` を 1 度も呼んでいない。2026-08-17 の実測でこのファイルに
 * 48 変異が「テストが通らない場所」として残っていたのはそのためである。
 *
 * ここで固定したいこと。
 *   1. **権限が要る。** 順位は運営の判断そのものなので、誰でも作れてはいけない。
 *   2. **他社の評価基準を読めない。** 「無い」と同じ語調で断る。
 *   3. **材料が無いときに空の順位を返さない。** 空の順位表は「該当なし」に見える。
 *   4. **並べ替えは domain の純粋関数に任せる。** ここで並べ直さない。
 */
import { describe, expect, it } from "vitest";
import type {
  EditorialRankingModelRepositoryPort,
  EditorialScoreCardRepositoryPort,
} from "@/application/ports/ranking";
import { createRankProductsUseCase } from "@/application/usecases/ranking/rank-products";
import type { EditorialScoreCard, RankingModel } from "@/domain/ranking";
import {
  type ProductId,
  type RankingModelId,
  type WorkspaceId,
  domainError,
  err,
  markEditorial,
  ok,
  taggedString,
} from "@/domain/shared";
import { OTHER_WORKSPACE, WORKSPACE, aNobody, anOwner } from "../support/actors";

const MODEL_ID = "rm-1" as RankingModelId;
const owner = anOwner({ workspaceId: WORKSPACE });

function aModel(over: Partial<RankingModel> = {}): RankingModel {
  return {
    id: MODEL_ID,
    workspaceId: WORKSPACE,
    categoryId: "cat-1" as RankingModel["categoryId"],
    version: "v3",
    audience: "初めて買う人",
    criteria: [
      {
        key: "measured_performance",
        weight: 0.6,
        measurement: "書き出し時間を実測",
        passThreshold: 0.4,
      },
      { key: "usability", weight: 0.4, measurement: "設定画面を触って評価", passThreshold: 0.4 },
    ],
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    affiliateCompensationIsInput: false,
    ...over,
  };
}

function aCard(
  productId: string,
  scores: EditorialScoreCard["scores"],
  over: Partial<EditorialScoreCard> = {},
): EditorialScoreCard {
  return {
    productId: productId as ProductId,
    scores,
    evidenceRefs: ["ev-1"],
    testedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...over,
  };
}

type Setup = {
  model?: RankingModel | null;
  modelFails?: boolean;
  cards?: readonly EditorialScoreCard[];
  cardsFails?: boolean;
};

/** 呼び出しの引数も覚える。何を渡して読みに行ったかを外から見るため。 */
function depsOf(setup: Setup = {}) {
  const listByModelCalls: {
    workspaceId: WorkspaceId;
    modelId: RankingModelId;
    productIds: readonly ProductId[];
  }[] = [];
  const notUsed = () => {
    throw new Error("このテストでは呼ばれません");
  };
  const rankingModels = markEditorial({
    async findById() {
      if (setup.modelFails) {
        return err(domainError("UPSTREAM_UNAVAILABLE", "評価基準を読めません。"));
      }
      return ok(setup.model === undefined ? aModel() : setup.model);
    },
    list: notUsed,
    save: notUsed,
  }) as unknown as EditorialRankingModelRepositoryPort;

  const scoreCards = markEditorial({
    async listByModel(
      workspaceId: WorkspaceId,
      modelId: RankingModelId,
      productIds: readonly ProductId[],
    ) {
      listByModelCalls.push({ workspaceId, modelId, productIds });
      if (setup.cardsFails) {
        return err(domainError("UPSTREAM_UNAVAILABLE", "評価の記録を読めません。"));
      }
      return ok(setup.cards ?? [aCard("p-1", { measured_performance: 0.9, usability: 0.8 })]);
    },
    save: notUsed,
  }) as unknown as EditorialScoreCardRepositoryPort;

  return { deps: { rankingModels, scoreCards }, listByModelCalls };
}

function run(setup: Setup = {}, actor = owner, productIds: readonly string[] = ["p-1"]) {
  const { deps, listByModelCalls } = depsOf(setup);
  const promise = createRankProductsUseCase(deps).execute(actor, {
    modelId: MODEL_ID,
    productIds: productIds as readonly ProductId[],
  });
  return { promise, listByModelCalls };
}

describe("順位を作れる人", () => {
  it("記事を読む権限が無ければ断る", async () => {
    const r = await run({}, aNobody({ workspaceId: WORKSPACE })).promise;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
  });

  it("権限があれば順位を作れる", async () => {
    const r = await run().promise;
    expect(r.ok).toBe(true);
  });

  it("ブランドとの対応を持たない順位材料を限定担当者へは出さない", async () => {
    const r = await run(
      {},
      anOwner({ scopedBrandIds: [taggedString<"BrandId">("brand-limited")] }),
    ).promise;

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("TENANT_MISMATCH");
  });
});

describe("材料が無いときに、空の順位を返さない", () => {
  it("商品が 1 件も指定されていなければ断る", async () => {
    // 空で通すと、保存先へ「対象なし」で問い合わせて空の順位表が出る。
    const r = await run({}, owner, []).promise;
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("VALIDATION_FAILED");
      expect(r.error.field).toBe("productIds");
    }
  });

  it("商品が無いときは、保存先を読みに行かない", async () => {
    const { promise, listByModelCalls } = run({}, owner, []);
    await promise;
    expect(listByModelCalls).toHaveLength(0);
  });

  it("評価の記録が 1 件も無ければ、根拠が要ると断る", async () => {
    const r = await run({ cards: [] }).promise;
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("EVIDENCE_REQUIRED");
      expect(r.error.suggestedAction).toBeTruthy();
    }
  });
});

describe("評価基準の取り出し", () => {
  it("評価基準が見つからなければ「見つかりません」で断る", async () => {
    const r = await run({ model: null }).promise;
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("NOT_FOUND");
      expect(r.error.suggestedAction).toBeTruthy();
    }
  });

  it("他社の評価基準は、順位を作る材料にしない", async () => {
    // 会社をまたいで読めると、他社の評価軸と重みがそのまま分かる。
    const r = await run({ model: aModel({ workspaceId: OTHER_WORKSPACE }) }).promise;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("TENANT_MISMATCH");
  });

  it("評価基準が読めないときは、その失敗をそのまま上げる", async () => {
    const r = await run({ modelFails: true }).promise;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("評価の記録が読めないときも、その失敗をそのまま上げる", async () => {
    // 「取れない」を 0 件にすると、根拠が無いという別の理由で断ってしまう。
    const r = await run({ cardsFails: true }).promise;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("点数表は、指定された会社・評価基準・商品で絞って読む", async () => {
    const { promise, listByModelCalls } = run({}, owner, ["p-1", "p-2"]);
    await promise;
    expect(listByModelCalls).toEqual([
      { workspaceId: WORKSPACE, modelId: MODEL_ID, productIds: ["p-1", "p-2"] },
    ]);
  });
});

describe("並べ替えの結果をそのまま返す", () => {
  it("重み付き合計の高い順に並ぶ", async () => {
    const r = await run({
      cards: [
        aCard("p-low", { measured_performance: 0.5, usability: 0.5 }),
        aCard("p-high", { measured_performance: 0.9, usability: 0.9 }),
      ],
    }).promise;
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.ranked.map((x) => x.productId)).toEqual(["p-high", "p-low"]);
    expect(r.value.ranked.map((x) => x.rank)).toEqual([1, 2]);
  });

  it("合格ラインを下回った商品は、理由つきで選外にする", async () => {
    const r = await run({
      cards: [
        aCard("p-ok", { measured_performance: 0.9, usability: 0.8 }),
        aCard("p-ng", { measured_performance: 0.1, usability: 0.8 }),
      ],
    }).promise;
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.ranked.map((x) => x.productId)).toEqual(["p-ok"]);
    expect(r.value.excluded.map((x) => x.productId)).toEqual(["p-ng"]);
    expect(r.value.excluded[0]?.failedCriteria).toEqual(["measured_performance"]);
  });

  it("評価基準の版と読者像を、結果に添えて返す", async () => {
    // 版が付いていないと、過去の順位を再現できない。
    const r = await run().promise;
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.modelVersion).toBe("v3");
    expect(r.value.audience).toBe("初めて買う人");
  });

  it("どう測ったかを、読者へ出せる形で一緒に返す", async () => {
    const r = await run().promise;
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.criteriaDisclosure.map((c) => c.key)).toEqual([
      "measured_performance",
      "usability",
    ]);
    expect(r.value.criteriaDisclosure[0]?.measurement).toBe("書き出し時間を実測");
  });

  it("同じ入力なら、何度呼んでも同じ順位になる", async () => {
    const cards = [
      aCard("p-b", { measured_performance: 0.7, usability: 0.7 }),
      aCard("p-a", { measured_performance: 0.7, usability: 0.7 }),
    ];
    const first = await run({ cards }).promise;
    const second = await run({ cards }).promise;
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.ranked.map((x) => x.productId)).toEqual(
      second.value.ranked.map((x) => x.productId),
    );
  });

  it("点数の形がおかしいときは、順位を作らずに断る", async () => {
    // 0〜1 の外の点数を通すと、選外の判定も合計も意味を失う。
    const r = await run({ cards: [aCard("p-1", { measured_performance: 1.5, usability: 0.8 })] })
      .promise;
    expect(r.ok).toBe(false);
  });
});
