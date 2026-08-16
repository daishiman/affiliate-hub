import type { ActorContext } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import { getCurrentActor, sampleActorNotice } from "@/infrastructure/identity/sample-actor";
import {
  SAMPLE_MODEL_ID,
  SAMPLE_PRODUCTS,
  sampleProductName,
} from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { buildToolCatalog, rankProductsTool } from "./tools/catalog";
import type { AnyToolDefinition, ToolDefinition } from "./tools/tool-definition";
import type { RankProductsInput } from "@/application/usecases/ranking/rank-products";
import type { RankingResult } from "@/domain/ranking";

/**
 * 入口の組み立て。
 *
 * **presentation の中で infrastructure を読んでよいのはこのファイルだけ。**
 * 画面や API ルートが実装を直接読み始めると、
 * 保存先や AI 提供元を変えるたびに全画面を書き換えることになる。
 * この 1 ファイルに閉じ込めておけば、差し替えはここだけで済む。
 *
 * 画面・REST・MCP・WebMCP はすべてこの 1 つのツール一覧を見る。
 * 入口ごとに作り直すと、片方にだけ古い定義が残る。
 */
export function createToolCatalog(): readonly AnyToolDefinition[] {
  return buildToolCatalog(createDeps());
}

/** いま操作している人。認証が入るまでは見本のログイン情報を返す。 */
export function currentActor(): Promise<ActorContext> {
  return getCurrentActor();
}

/** 見本のログイン情報で動いていることを画面に出すための一文。 */
export function actorNotice(): string {
  return sampleActorNotice();
}

/** 順位の画面が使う入口。型が付いているので、戻り値をキャストせずに描ける。 */
export function rankingTool(): ToolDefinition<RankProductsInput, RankingResult> {
  return rankProductsTool(createDeps());
}

/**
 * 順位の画面が表示する対象。
 *
 * いまは見本データ。商品を選ぶ画面ができたら、そこからの選択に差し替える。
 */
export function rankingScreenTarget(): { modelId: string; productIds: readonly string[] } {
  return {
    modelId: String(SAMPLE_MODEL_ID),
    productIds: SAMPLE_PRODUCTS.map((p) => String(p.id)),
  };
}

/** 商品の表示名。ID をそのまま画面に出さないための対応表。 */
export function productDisplayName(productId: string): string {
  return sampleProductName(productId as never);
}
