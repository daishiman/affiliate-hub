import { z } from "zod";
import { withAccessDenialAudit } from "@/application/access-denial";
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
import { blogOpsTools } from "./blog-ops-tools";
import { contentTools } from "./content-tools";
import { distributionTools } from "./distribution-tools";
import { feedbackTools } from "./feedback-tools";
import { generationTools } from "./generation-tools";
import { dashboardTools } from "./dashboard-tools";
import { platformTools } from "./platform-tools";
import { productTools } from "./product-tools";
import { readerTools } from "./reader-tools";
import { settingsTools } from "./settings-tools";
import { siteTools } from "./site-tools";
import { contractAliasTools } from "./spec-contract";

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
  const own = [
    rankProductsTool(deps),
    ...dashboardTools(deps),
    ...siteTools(deps),
    ...readerTools(deps),
    ...productTools(deps),
    ...contentTools(deps),
    ...blogOpsTools(deps),
    ...platformTools(deps),
    ...distributionTools(deps),
    ...affiliateTools(deps),
    ...analyticsTools(deps),
    ...generationTools(deps),
    ...settingsTools(deps),
    ...feedbackTools(deps),
  ];
  /*
   * REST / WebMCP / MCP が共通して通る catalog の最終境界で、use case の拒否を包む。
   * 元の道具を先に 1 回だけ包み、その参照から別名を作る。別名ごとに包むと、
   * 「別名は元と同じ処理を指す」という catalog の契約が崩れ、同じ処理の写しが増える。
   * 入口の scope / 人の承認ゲートは `invokeTool` の責務で、ここへ二重計上しない。
   */
  const audited = own.map((tool) => ({
    ...tool,
    useCase: withAccessDenialAudit(deps, tool.name, tool.useCase),
  }));

  // 仕様書 §24 の名前でも、上で包んだ**同じユースケース**へ入れるようにする。
  // 処理は増えない。名前の対応が付いていないものは載らず、スタブとして表に残る。
  return [...audited, ...contractAliasTools(audited)];
}

export function findTool(
  catalog: readonly AnyToolDefinition[],
  name: string,
): AnyToolDefinition | null {
  return catalog.find((t) => t.name === name) ?? null;
}

/**
 * 読み取り専用を**名乗っている**もの。
 *
 * **WebMCP に載せてよいものの一覧ではない。**載せる先は
 * `webmcp-policy.ts` の `PAGE_TOOLS` が名前で決める（`isListedOnWebMcp`）。
 * ここを載せる根拠に使うと、読み取りの道具を足しただけで
 * ページ内の AI の手が届く範囲が広がる。
 */
export function readOnlyTools(catalog: readonly AnyToolDefinition[]): readonly AnyToolDefinition[] {
  return catalog.filter((t) => t.readOnly);
}
