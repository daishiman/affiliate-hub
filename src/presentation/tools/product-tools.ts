import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createCompareProductsUseCase,
  createExplainRankingUseCase,
  createFilterProductsUseCase,
  createFindAlternativesUseCase,
  createGetEvidenceUseCase,
  createGetProductUseCase,
  createListRankingUseCase,
  createListTestRunsUseCase,
} from "@/application/usecases/product/read-product";
import { defineTool } from "./define-tool";
import type { AnyToolDefinition } from "./tool-definition";

/**
 * 商品と根拠の道具。
 *
 * 仕様（ブログ層 §14.2）の読み取り 9 種のうち 8 種をここで満たす。
 * 残る `get_disclosure` は広告表示の文言を返すもので、
 * 記事に紐づくため `site-tools.ts` 側（`get_article`）が持つ。
 *
 * **画面が呼ぶユースケースと同一のものを載せている。**
 * ここで独自に計算・整形をしない。書いた時点で
 * 「画面の答え」と「AI の答え」がずれ始める。
 */
export function productTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const product = {
    products: deps.products,
    claims: deps.claims,
    evidence: deps.evidence,
    testRuns: deps.testRuns,
    rankingModels: deps.rankingModels,
    scoreCards: deps.scoreCards,
  };
  const productId = z.string().min(1);

  return [
    defineTool({
      name: "get_product",
      description: "商品 1 件の仕様と、その商品について言えること（事実／推測の区別つき）を返します。",
      schema: z.object({ productId }),
      readOnly: true,
      useCase: createGetProductUseCase(product),
    }),
    defineTool({
      name: "filter_products",
      description: "言葉やカテゴリーで商品を絞り込みます。0 件のときは理由を返します。",
      schema: z.object({
        text: z.string().optional(),
        categoryId: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      readOnly: true,
      useCase: createFilterProductsUseCase(product),
    }),
    defineTool({
      name: "compare_products",
      description:
        "2 つ以上の商品を比べます。全商品で値が揃っている項目だけを列にし、揃っていない項目は別に示します。",
      schema: z.object({ productIds: z.array(productId).min(2) }),
      readOnly: true,
      useCase: createCompareProductsUseCase(product),
    }),
    defineTool({
      name: "find_alternatives",
      description: "その商品の代わりになる候補を返します。報酬額は候補の選定に使いません。",
      schema: z.object({ productId, limit: z.number().int().min(1).max(20).optional() }),
      readOnly: true,
      useCase: createFindAlternativesUseCase(product),
    }),
    defineTool({
      name: "get_evidence",
      description: "その商品について言えることと、その根拠（出所・取得日・抜粋）を返します。",
      schema: z.object({ productId }),
      readOnly: true,
      useCase: createGetEvidenceUseCase(product),
    }),
    defineTool({
      name: "list_test_runs",
      description:
        "編集部が実際に測った記録を返します。記録が無い場合は「実測していない」と返します（作りません）。",
      schema: z.object({ productId }),
      readOnly: true,
      useCase: createListTestRunsUseCase(product),
    }),
    defineTool({
      name: "list_ranking",
      description:
        "評価基準にもとづく順位と、その評価基準の内訳を返します。報酬は評価の入力に含みません。",
      schema: z.object({ modelId: z.string().min(1), productIds: z.array(productId).min(1) }),
      readOnly: true,
      useCase: createListRankingUseCase(product),
    }),
    defineTool({
      name: "explain_ranking",
      description:
        "ある商品がその順位になった理由を、評価項目ごとの内訳で返します。選外の場合は選外の理由を返します。",
      schema: z.object({
        modelId: z.string().min(1),
        productIds: z.array(productId).min(1),
        productId,
      }),
      readOnly: true,
      useCase: createExplainRankingUseCase(product),
    }),
  ];
}
