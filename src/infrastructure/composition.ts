import type { AppDeps } from "@/application/deps";
import {
  createCommercialD1LinkInboxRepository,
  type DrizzleD1,
} from "./persistence/d1/link-inbox-repository";
import { createD1SiteDraftRepository } from "./persistence/d1/site-draft-repository";
import { createD1SiteRepository } from "./persistence/d1/site-repository";
import {
  createD1FeedbackRepository,
  createD1IntegrationKeyStore,
} from "./persistence/d1/feedback-repository";
import { createEventPublisher } from "./platform/queue";
import { createLlmPorts } from "./llm/llm-setup";
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
  createSampleClickTracking,
  createSampleMetricsRepository,
} from "./persistence/sample/analytics-sample-repository";
import { createSampleTelemetrySink } from "./persistence/sample/telemetry-sample-sink";
import { createSampleImprovementRepository } from "./persistence/sample/improvement-sample-repository";
import {
  createSampleAffiliateAccountRepository,
  createSampleAffiliateLinkRepository,
  createSampleAffiliateProgramRepository,
  createSampleConversionRepository,
} from "./persistence/sample/affiliate-sample-repository";
import {
  createSampleAuditLog,
  createSampleBrandRepository,
  createSampleDisclosureRepository,
  createSampleMembershipRepository,
  createSampleWorkspaceRepository,
} from "./persistence/sample/settings-sample-repository";
import {
  createSampleFeedbackCaptureStore,
  createSampleFeedbackRepository,
  createSampleIntegrationKeyStore,
} from "./persistence/sample/feedback-sample-repository";
import { createHandoffTemplates } from "./generation/handoff-templates";
import { hashSecret, mintSecret } from "./platform/secret-minter";
import { createSampleLinkIngestionRepository } from "./persistence/sample/link-inbox-sample-repository";
import { createSampleSiteDraftRepository } from "./persistence/sample/site-draft-sample-repository";
import { createSampleSiteRepository } from "./persistence/sample/site-sample-repository";
import { idGenerator } from "./platform/id-generator";

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
export function createDeps(options: { readonly db?: DrizzleD1 | null } = {}): AppDeps {
  const db = options.db ?? null;
  const llmPorts = createLlmPorts();
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
    // ブログの下書きと、作られたブログは、保存先が用意できていれば本物（D1）。
    // ここを先に本物にしたのは、**入れる口（作成ウィザード）が既にあるから**。
    // 入れる口が無いものを本物にすると、一生埋まらない空の画面ができる。
    // 記事の本文（published_articles）はまだ見本のまま。
    sites: db === null ? createSampleSiteRepository() : createD1SiteRepository(db),
    siteDrafts: db === null ? createSampleSiteDraftRepository() : createD1SiteDraftRepository(db),
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
    // ★ 見本データ（スタブ）。数字。本物は公開して読まれ始めてから入る。
    metrics: createSampleMetricsRepository(),
    clickTracking: createSampleClickTracking(),
    // ★ 仮置き（スタブ）。この実行中だけ覚える。telemetry_events テーブルが
    //   できたらこの 1 行を差し替える。画面もイベントの形も変わらない。
    telemetry: createSampleTelemetrySink(),
    // ★ 見本データ（スタブ）。改善ループの記録と見せ方の設定。
    //   読み出しは見本を返し、保存は失敗を返す（保存できたことにしない）。
    improvement: createSampleImprovementRepository(),
    // 改善要望と鍵は、保存先が用意できていれば本物（D1）を使う。
    // 画面の写し（R2）だけは仮のまま。置き場は作れるが、見るための
    // 期限つき URL を配る口がまだ無く、保存だけ本物にすると
    // 「保存できているのに開けない」という切り分けにくい形になる。
    // 指示文のひな型は本物（版番号つきでコードと一緒に管理する）。
    feedback: db === null ? createSampleFeedbackRepository() : createD1FeedbackRepository(db),
    feedbackCaptures: createSampleFeedbackCaptureStore(),
    handoffTemplates: createHandoffTemplates(),
    integrationKeys:
      db === null
        ? createSampleIntegrationKeyStore({ hash: hashSecret })
        : createD1IntegrationKeyStore({ db, hash: hashSecret, newId: () => idGenerator.newId() }),
    mintSecret,
    // ★ 見本データ（スタブ）。作業場所・担当者・ブランド・広告表記・操作の記録。
    //   本物にするには認証（Better Auth + Google）と各テーブルが要る。
    workspaces: createSampleWorkspaceRepository(),
    memberships: createSampleMembershipRepository(),
    brands: createSampleBrandRepository(),
    disclosures: createSampleDisclosureRepository(),
    auditLog: createSampleAuditLog(),
    // 起きたことの発行。購読側（通知・再生成・リンク切れ検出）はまだ無いので
    // 記録だけする。購読を足すときに変えるのはこの 1 行だけ。
    events: createEventPublisher(null),
    // ID の作り方。試験では順番に増える作りへ差し替えて、結果を読めるようにする。
    ids: idGenerator,
    // 生成 AI。どこの提供元かは llm-setup.ts の 1 行が決める（シナリオ ②）。
    // 鍵が未登録のあいだはスタブが失敗を返す。空の記事を作らない。
    llm: llmPorts.llm,
    llmCosts: llmPorts.costs,
    // ★ 見本データ（スタブ）。提携先・提携条件・成果。
    //   本物の数字には各 ASP の API 申請と、利用者ご自身による接続情報の登録が要る。
    //   ここで作るものには商業の印が付いており、順位づけへは型として渡せない。
    affiliateAccounts: createSampleAffiliateAccountRepository(),
    affiliatePrograms: createSampleAffiliateProgramRepository(),
    affiliateLinks: createSampleAffiliateLinkRepository(),
    conversions: createSampleConversionRepository(),
    // 受信箱だけは、保存先が用意できていれば本物（D1）を使う。
    // **この 1 行が、変更容易性シナリオ ⑥ の実体。**
    // 上の呼び出し側（ユースケース・画面・ツール）は 1 行も変わらない。
    linkInbox:
      db === null
        ? createSampleLinkIngestionRepository()
        : createCommercialD1LinkInboxRepository(db),
  };
}
