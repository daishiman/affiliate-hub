import type {
  EditorialRankingModelRepositoryPort,
  EditorialScoreCardRepositoryPort,
} from "@/application/ports/ranking";
import { requireWorkspaceWideCapability } from "@/domain/identity";
import { type RankingResult, rankProducts } from "@/domain/ranking";
import {
  type ActorContext,
  type DomainError,
  type ProductId,
  type RankingModelId,
  type Result,
  assertSameTenant,
  containsCommercial,
  domainError,
  err,
  missingMark,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * ランキングを作るユースケース。
 *
 * このファイルは仕様の中核制約が守られていることを示す代表例。
 *
 *   - 依存の型は Editorial 印の付いたポートだけ。
 *     報酬に関わるポート (Commercial 印) を渡すとコンパイルが通らない。
 *   - 組み立て時に実行時の印も確認する。`as any` で型を外しても失敗する。
 *   - 並べ替えそのものは domain/ranking の純粋関数が行う。
 *     画面・AI 回答・WebMCP・MCP のどこから呼んでも同じ順位になる。
 *
 * 根拠: プラットフォーム層 §12.3 / §19.4、ブログ層 §4.7 / §17.4
 */
export type RankProductsDeps = {
  readonly rankingModels: EditorialRankingModelRepositoryPort;
  readonly scoreCards: EditorialScoreCardRepositoryPort;
  /**
   * 商業側のつなぎ目は「持てない」ことを型で宣言する。
   *
   * TypeScript は余分な項目が付いたオブジェクトも受け取ってしまうため、
   * `AppDeps` をまるごと渡すと報酬のつなぎ目が紛れ込む余地が残る。
   * ここで `never` と宣言しておくと、まるごと渡した時点で
   * コンパイルが通らなくなる（実行するまでもなく止まる）。
   */
  readonly affiliateLinks?: never;
  readonly conversions?: never;
  readonly affiliatePrograms?: never;
  readonly affiliateAccounts?: never;
};

/**
 * 実行時に「編集の印」を求めるポート。
 *
 * `RankProductsDeps` のうち**データを持つもの**だけを挙げる。
 * データではない依存（`ids` や `now` のようなもの）はここに入れない。
 * 依存を足したときは、この一覧にも足す（足し忘れは下の決定表で赤くなる）。
 */
const RANKING_DATA_PORTS = ["rankingModels", "scoreCards"] as const;

export type RankProductsInput = {
  readonly modelId: RankingModelId;
  readonly productIds: readonly ProductId[];
};

export function createRankProductsUseCase(
  deps: RankProductsDeps,
): UseCase<RankProductsInput, RankingResult> {
  // 型を外して渡された場合に備え、実行時の印も確認する。
  const runtimeDeps = deps as unknown as Record<string, unknown>;

  const commercial = containsCommercial(runtimeDeps);
  if (commercial.length > 0) {
    // ここは起動時に落とす。誤った並び順を読者へ出すより、動かない方がよい。
    throw new Error(
      `ランキングに商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬・広告主予算・販売実績を評価の入力にすることはできません。",
    );
  }

  /*
   * 印が無いものも落とす（fail-closed）。
   *
   * 「商業と名乗っているものだけ」を落とす形にしていたころは、印を付け忘れたポートが
   * 素通りしていた。実行時の印は `as any` 相当で型を外した回を捕まえるために置いたもので、
   * その回はたいてい印も付いていない。いちばん効いてほしい場面で効かない形だった。
   * 提携側（`manage-affiliate.ts`）と同じ向きに揃えている。
   */
  const unmarked = missingMark(runtimeDeps, "editorial", RANKING_DATA_PORTS);
  if (unmarked.length > 0) {
    throw new Error(
      `ランキングに編集データの印が付いていないポートが渡されています: ${unmarked.join(", ")}。` +
        "印が無いポートは、商業データが混ざっていないことを確かめられません。",
    );
  }

  return {
    async execute(
      actor: ActorContext,
      input: RankProductsInput,
    ): Promise<Result<RankingResult, DomainError>> {
      const allowed = requireWorkspaceWideCapability(actor, "content.read", "ランキングの参照");
      if (!allowed.ok) return allowed;

      if (input.productIds.length === 0) {
        return err(
          domainError("VALIDATION_FAILED", "並べ替える商品が指定されていません。", {
            field: "productIds",
          }),
        );
      }

      const modelResult = await deps.rankingModels.findById(actor.workspaceId, input.modelId);
      if (!modelResult.ok) return modelResult;
      if (modelResult.value === null) {
        return err(
          domainError("NOT_FOUND", "評価基準が見つかりません。", {
            suggestedAction: "評価基準を選び直してください。",
          }),
        );
      }
      const tenantChecked = assertSameTenant(actor, modelResult.value, "評価基準");
      if (!tenantChecked.ok) return tenantChecked;
      const model = tenantChecked.value;

      const cardsResult = await deps.scoreCards.listByModel(
        actor.workspaceId,
        input.modelId,
        input.productIds,
      );
      if (!cardsResult.ok) return cardsResult;

      if (cardsResult.value.length === 0) {
        return err(
          domainError("EVIDENCE_REQUIRED", "評価の記録がある商品がありません。", {
            suggestedAction: "商品ごとの評価を先に登録してください。",
          }),
        );
      }

      // 並べ替えは純粋関数。副作用も外部依存も無いので、同じ入力なら常に同じ順位になる。
      return rankProducts(model, cardsResult.value);
    },
  };
}
