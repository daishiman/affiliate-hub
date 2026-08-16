import type {
  EditorialRankingModelRepositoryPort,
  EditorialScoreCardRepositoryPort,
} from "./ports";
import type {
  EditorialContactPort,
  EditorialReaderToolPort,
  EditorialShortlistPort,
} from "./ports/reader-interaction";
import type {
  EditorialPublishedContentPort,
  EditorialSiteRepositoryPort,
} from "./ports/site";

/**
 * ユースケースが必要とするもの一式。
 *
 * ここに並ぶのは実装ではなく**つなぎ目の宣言（ポート）**だけ。
 * 「どの実装を使うか」は `src/infrastructure/composition.ts` が決める。
 *
 * 機能を足すときは、ここへポートを 1 行足す。
 * 足した瞬間に、組み立て側が実装を渡していないことが型検査で分かる。
 */
export type AppDeps = {
  readonly rankingModels: EditorialRankingModelRepositoryPort;
  readonly scoreCards: EditorialScoreCardRepositoryPort;
  readonly sites: EditorialSiteRepositoryPort;
  readonly publishedContent: EditorialPublishedContentPort;
  readonly shortlist: EditorialShortlistPort;
  readonly readerTools: EditorialReaderToolPort;
  readonly contact: EditorialContactPort;
};
