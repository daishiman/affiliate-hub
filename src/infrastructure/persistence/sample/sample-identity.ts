import {
  type CategoryId,
  type ProductId,
  type RankingModelId,
  type WorkspaceId,
  taggedString,
} from "@/domain/shared";

/**
 * 見本データ全体で共有する識別子と、人が見る商品名の正本。
 *
 * repository 同士を import して識別子を借りると、保存先の実装順が依存関係に
 * なってしまう。ここは保存処理を持たず、見本をつなぐ最小限の identity だけを持つ。
 */
export const SAMPLE_WORKSPACE_ID = taggedString<"WorkspaceId">("ws_sample") as WorkspaceId;
export const SAMPLE_MODEL_ID = taggedString<"RankingModelId">(
  "rm_office_chair",
) as RankingModelId;
export const SAMPLE_CATEGORY_ID = taggedString<"CategoryId">("cat_chair") as CategoryId;

function productId(value: string): ProductId {
  return taggedString<"ProductId">(value) as ProductId;
}

export const SAMPLE_PRODUCTS = [
  { id: productId("p_alpha_15"), name: "ErgoOne Pro" },
  { id: productId("p_beta_14"), name: "FlexSeat 2" },
  { id: productId("p_gamma_16"), name: "DeskChair Air" },
  { id: productId("p_delta_13"), name: "WoodStool Basic" },
] as const satisfies readonly { readonly id: ProductId; readonly name: string }[];

export function sampleProductName(id: ProductId | string): string {
  return SAMPLE_PRODUCTS.find((product) => product.id === id)?.name ?? String(id);
}
