import type { EditorialScoreCard, RankingModel } from "@/domain/ranking";
import type { Editorial, ProductId, RankingModelId, WorkspaceId } from "@/domain/shared";
import type { PageRequest, Paged, PortResult } from "./common";

/**
 * Ranking のポート。
 *
 * この文脈のポートはすべて Editorial 区分。
 * 報酬・広告主予算・販売実績に触れるポートをここに宣言してはならない。
 * 宣言したくなったら、それは Ranking ではなく Monetization の仕事。
 */
export type RankingModelRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: RankingModelId): PortResult<RankingModel | null>;
  list(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<RankingModel>>;
  save(model: RankingModel): PortResult<RankingModel>;
};

export type ScoreCardRepositoryPort = {
  listByModel(
    workspaceId: WorkspaceId,
    modelId: RankingModelId,
    productIds: readonly ProductId[],
  ): PortResult<readonly EditorialScoreCard[]>;
  /**
   * 点数表には作業場所の欄も評価方法の欄も無い（商品と点数だけを持つ）。
   * だから保存のときに両方を引数で渡す。
   *
   * 作業場所を渡さないと、**保存した時点でこの点数が誰のものか分からなくなる**。
   * 評価方法を渡さないと、**測り方を変えて付け直した点が前の版を上書きする**。
   * 版を上げる決まりは過去の順位を再現するためにあるので、
   * 上書きしてしまうとその決まりごと意味を失う。
   *
   * 点数表の型に 2 つを持たせないのは、持たせると点を渡すたびに
   * 「どの作業場所・どの方法のものか」を呼び出し側が書き換えられる形になるから。
   */
  save(
    workspaceId: WorkspaceId,
    modelId: RankingModelId,
    card: EditorialScoreCard,
  ): PortResult<EditorialScoreCard>;
};

export type EditorialRankingModelRepositoryPort = Editorial<RankingModelRepositoryPort>;
export type EditorialScoreCardRepositoryPort = Editorial<ScoreCardRepositoryPort>;
