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
import {
  createSampleClaimRepository,
  createSampleEvidenceRepository,
  createSampleProductRepository,
  createSampleTestRunRepository,
} from "./persistence/sample/product-sample-repository";
import {
  createSampleContentPackageRepository,
  createSampleContentVariantRepository,
  createSamplePersonaRepository,
} from "./persistence/sample/content-editorial-sample-repository";
import {
  createSampleChannelConnectionRepository,
  createSampleManualExport,
  createSamplePublicationRepository,
} from "./persistence/sample/distribution-sample-repository";
import {
  createSampleAffiliateAccountRepository,
  createSampleAffiliateLinkRepository,
  createSampleAffiliateProgramRepository,
  createSampleConversionRepository,
} from "./persistence/sample/affiliate-sample-repository";
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
    // ★ 見本データ（スタブ）。順位表と同じ 4 商品。products / claims /
    //   evidence / test_runs テーブルができたら差し替える。
    products: createSampleProductRepository(),
    claims: createSampleClaimRepository(),
    evidence: createSampleEvidenceRepository(),
    testRuns: createSampleTestRunRepository(),
    // ★ 見本データ（スタブ）。ブログ 2 本ぶんの設計図と記事。
    //   site_blueprints / published_articles テーブルができたら差し替える。
    sites: createSampleSiteRepository(),
    publishedContent: createSampleContentRepository(),
    // ★ 見本（スタブ）。読者が自分で操作するもの。
    //   保存先 (KV)・計算式・問い合わせの送信先が用意できたら差し替える。
    shortlist: createSampleShortlistRepository(),
    readerTools: createSampleReaderToolRepository(),
    contact: createSampleContactSink(),
    // ★ 見本データ（スタブ）。記事の進行と書き手の設定。
    //   content_packages / content_variants / personas テーブルができたら差し替える。
    contentPackages: createSampleContentPackageRepository(),
    contentVariants: createSampleContentVariantRepository(),
    personas: createSamplePersonaRepository(),
    // ★ 見本データ（スタブ）。配信先の接続と配信の記録。
    //   実際の投稿には各サービスの認証が要り、それは利用者ご自身が登録する。
    channelConnections: createSampleChannelConnectionRepository(),
    publications: createSamplePublicationRepository(),
    manualExport: createSampleManualExport(),
    // ★ 見本データ（スタブ）。提携先・提携条件・成果。
    //   本物の数字には各 ASP の API 申請と、利用者ご自身による接続情報の登録が要る。
    //   ここで作るものには商業の印が付いており、順位づけへは型として渡せない。
    affiliateAccounts: createSampleAffiliateAccountRepository(),
    affiliatePrograms: createSampleAffiliateProgramRepository(),
    affiliateLinks: createSampleAffiliateLinkRepository(),
    conversions: createSampleConversionRepository(),
  };
}
