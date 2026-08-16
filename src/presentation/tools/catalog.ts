import { z } from "zod";
import type { RankProductsInput } from "@/application/usecases/ranking/rank-products";
import { createRankProductsUseCase } from "@/application/usecases/ranking/rank-products";
import type { AppDeps } from "@/application/deps";
import type { RankingResult } from "@/domain/ranking";
import { ok } from "@/domain/shared";
import type { ProductId, RankingModelId } from "@/domain/shared";
import type { AnyToolDefinition, ToolDefinition } from "./tool-definition";
import { parseWith, toJsonSchema } from "./define-tool";
import { affiliateTools } from "./affiliate-tools";
import { analyticsTools } from "./analytics-tools";
import { contentTools } from "./content-tools";
import { distributionTools } from "./distribution-tools";
import { generationTools } from "./generation-tools";
import { dashboardTools } from "./dashboard-tools";
import { platformTools } from "./platform-tools";
import { productTools } from "./product-tools";
import { settingsTools } from "./settings-tools";
import { siteTools } from "./site-tools";

/**
 * ツールの一覧。
 *
 * ここに 1 つ足すと、REST・WebMCP・バックエンド MCP の 3 つに同時に現れる。
 * 入口ごとに登録作業をしない。登録漏れによる「画面にはあるが AI からは使えない」
 * (逆も) を構造的になくす。
 */

// ---------------------------------------------------------------------------
// rank_products
// ---------------------------------------------------------------------------

const rankProductsSchema = z.object({
  modelId: z.string().min(1),
  productIds: z.array(z.string().min(1)).min(1).max(50),
});

/**
 * ツールが必要とするもの一式。
 *
 * 定義は application が持つ (`AppDeps`)。ここで別に並べ直すと、
 * ポートを足したときに片方だけ古くなる。
 */
export type CatalogDeps = AppDeps;

/**
 * 画面からもこれを呼ぶ。
 *
 * 画面用に別の呼び出し口を作らないこと。作った時点で、
 * 画面と AI で違う順位が出る余地ができる。
 */
export function rankProductsTool(
  deps: CatalogDeps,
): ToolDefinition<RankProductsInput, RankingResult> {
  return {
    name: "rank_products",
    description:
      "指定した評価基準で商品を並べ替え、順位とその理由を返します。" +
      "報酬額や広告主の予算は評価に含みません (仕様上、含めることができません)。",
    inputSchema: toJsonSchema(rankProductsSchema),
    readOnly: true,
    requiresHumanApproval: false,
    parse: (raw) => {
      const parsed = parseWith(rankProductsSchema)(raw);
      if (!parsed.ok) return parsed;
      return ok({
        modelId: parsed.value.modelId as RankingModelId,
        productIds: parsed.value.productIds as ProductId[],
      });
    },
    // 一式をまるごと渡さず、順位づけに要る 2 つだけを渡す。
    // まるごと渡すと報酬のつなぎ目が紛れ込む余地が残る（型でも止まる）。
    useCase: createRankProductsUseCase({
      rankingModels: deps.rankingModels,
      scoreCards: deps.scoreCards,
    }),
  };
}

// ---------------------------------------------------------------------------

/**
 * カタログを組み立てる。
 *
 * ユースケースが増えたら、この配列に 1 行足す。
 * 入口 (REST / WebMCP / MCP) 側のコードは触らない。
 */
export function buildToolCatalog(deps: CatalogDeps): readonly AnyToolDefinition[] {
  return [
    rankProductsTool(deps),
    ...dashboardTools(deps),
    ...siteTools(deps),
    ...productTools(deps),
    ...contentTools(deps),
    ...platformTools(deps),
    ...distributionTools(deps),
    ...affiliateTools(deps),
    ...analyticsTools(deps),
    ...generationTools(),
    ...settingsTools(deps),
  ];
}

export function findTool(
  catalog: readonly AnyToolDefinition[],
  name: string,
): AnyToolDefinition | null {
  return catalog.find((t) => t.name === name) ?? null;
}

/** WebMCP に載せてよいもの。状態を変えるツールはページ内の AI へ渡さない。 */
export function readOnlyTools(catalog: readonly AnyToolDefinition[]): readonly AnyToolDefinition[] {
  return catalog.filter((t) => t.readOnly);
}
