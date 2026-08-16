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
  save(card: EditorialScoreCard): PortResult<EditorialScoreCard>;
};

export type EditorialRankingModelRepositoryPort = Editorial<RankingModelRepositoryPort>;
export type EditorialScoreCardRepositoryPort = Editorial<ScoreCardRepositoryPort>;
