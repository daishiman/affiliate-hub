import type { AppDeps } from "@/application/deps";
import { createSampleContentRepository } from "./persistence/sample/content-sample-repository";
import {
  createSampleRankingModelRepository,
  createSampleScoreCardRepository,
} from "./persistence/sample/ranking-sample-repository";
import {
  createSampleContactSink,
  createSampleReaderToolRepository,
  createSampleShortlistRepository,
} from "./persistence/sample/reader-interaction-sample";
import { createSampleSiteRepository } from "./persistence/sample/site-sample-repository";

/**
 * 実装の組み立て。
 *
 * 「どの実装を使うか」を決めてよいのはこのファイルだけ。
 * ユースケース・画面・API はポート（つなぎ目の宣言）しか知らない。
 *
 * 差し替えの手数が短いことが、この層の存在理由:
 *   保存先を見本から D1 へ  → 下の 2 行を差し替えるだけ
 *   LLM の提供元を変える    → その行を差し替えるだけ
 * 呼び出し側は 1 行も変わらない。
 *
 * 入口ごとの組み立て（ツール一覧）は `src/presentation/composition.ts`。
 */
export function createDeps(): AppDeps {
  return {
    // ★ 見本データ（スタブ）。ranking_models / score_cards テーブルができたら差し替える。
    rankingModels: createSampleRankingModelRepository(),
    scoreCards: createSampleScoreCardRepository(),
    // ★ 見本データ（スタブ）。ブログ 2 本ぶんの設計図と記事。
    //   site_blueprints / published_articles テーブルができたら差し替える。
    sites: createSampleSiteRepository(),
    publishedContent: createSampleContentRepository(),
    // ★ 見本（スタブ）。読者が自分で操作するもの。
    //   保存先 (KV)・計算式・問い合わせの送信先が用意できたら差し替える。
    shortlist: createSampleShortlistRepository(),
    readerTools: createSampleReaderToolRepository(),
    contact: createSampleContactSink(),
  };
}
