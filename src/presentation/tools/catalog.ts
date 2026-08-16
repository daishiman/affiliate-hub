import { z } from "zod";
import type { RankProductsInput } from "@/application/usecases/ranking/rank-products";
import { createRankProductsUseCase } from "@/application/usecases/ranking/rank-products";
import type { AppDeps } from "@/application/deps";
import type { RankingResult } from "@/domain/ranking";
import { domainError, err, ok } from "@/domain/shared";
import type { DomainError, ProductId, RankingModelId, Result } from "@/domain/shared";
import type { AnyToolDefinition, ToolDefinition } from "./tool-definition";

/**
 * ツールの一覧。
 *
 * ここに 1 つ足すと、REST・WebMCP・バックエンド MCP の 3 つに同時に現れる。
 * 入口ごとに登録作業をしない。登録漏れによる「画面にはあるが AI からは使えない」
 * (逆も) を構造的になくす。
 */

/**
 * 入力検証は zod を 1 つの正本にする。
 *
 * ここから JSON Schema を作って配るので、
 * 「ツールが宣言している形」と「実際に受け付ける形」がずれない。
 */
function toJsonSchema(schema: z.ZodType): Readonly<Record<string, unknown>> {
  return z.toJSONSchema(schema) as Readonly<Record<string, unknown>>;
}

function parseWith<T>(schema: z.ZodType<T>): (raw: unknown) => Result<T, DomainError> {
  return (raw) => {
    const result = schema.safeParse(raw);
    if (result.success) return ok(result.data);
    const first = result.error.issues[0];
    return err(
      domainError("VALIDATION_FAILED", jaMessage(first), {
        field: first?.path.join(".") || undefined,
        suggestedAction: "入力の形式を確認して、もう一度お試しください。",
      }),
    );
  };
}

/** zod の英語メッセージのままでは利用者が直せないため、要点を日本語に置き換える。 */
function jaMessage(issue: z.core.$ZodIssue | undefined): string {
  if (issue === undefined) return "入力の形式が正しくありません。";
  const where = issue.path.length > 0 ? `「${issue.path.join(".")}」` : "入力";
  switch (issue.code) {
    case "invalid_type":
      return `${where}の形式が正しくありません。`;
    case "too_small":
      return `${where}が足りません。`;
    case "too_big":
      return `${where}が多すぎます。`;
    default:
      return `${where}を確認してください。`;
  }
}

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
    useCase: createRankProductsUseCase(deps),
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
  return [rankProductsTool(deps)];
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
