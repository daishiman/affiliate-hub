import type { AppDeps } from "@/application/deps";
import {
  createCommercialD1LinkInboxRepository,
  type DrizzleD1,
} from "./persistence/d1/link-inbox-repository";
import { createD1SiteDraftRepository } from "./persistence/d1/site-draft-repository";
import {
  createD1ChannelConnectionRepository,
  createD1PublicationRepository,
} from "./persistence/d1/distribution-repository";
import { createD1ContentVariantRepository } from "./persistence/d1/content-repository";
import { createD1ConversionRepository } from "./persistence/d1/conversion-repository";
import { createD1SiteRepository } from "./persistence/d1/site-repository";
import {
  createD1ContentRepository,
  createD1PublishedArticleWriter,
} from "./persistence/d1/published-article-repository";
import {
  createD1FeedbackRepository,
  createD1IntegrationKeyStore,
} from "./persistence/d1/feedback-repository";
import { createEventPublisher } from "./platform/queue";
import {
  createR2FeedbackCaptureStore,
  type CaptureBucket,
} from "./platform/feedback-capture-r2";
import { createLlmPorts } from "./llm/llm-setup";
import {
  createSampleContentRepository,
  createSamplePublishedArticleWriter,
} from "./persistence/sample/content-sample-repository";
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
  createSampleRedirectResolver,
} from "./persistence/sample/analytics-sample-repository";
import {
  createD1RedirectResolver,
  createRedirectClickTracking,
} from "./persistence/d1/redirect-repository";
import { createSampleTelemetrySink } from "./persistence/sample/telemetry-sample-sink";
import {
  createD1TelemetryMetricsRepository,
  createD1TelemetrySink,
} from "./persistence/d1/telemetry-repository";
import { createD1AuditLog } from "./persistence/d1/audit-log-repository";
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
import { createSamplePolicyRuleRepository } from "./persistence/sample/policy-rule-sample-repository";
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
export function createDeps(
  options: { readonly db?: DrizzleD1 | null; readonly bucket?: CaptureBucket | null } = {},
): AppDeps {
  const db = options.db ?? null;
  const bucket = options.bucket ?? null;
  const llmPorts = createLlmPorts();
  // 計測の記録先は、保存先が用意できていれば本物（D1）。
  // 入れる口（/api/telemetry と画面の収集係）と読む口（/admin/analytics）が
  // 両方そろったのでつないだ。片方しか無い状態でつなぐと、
  // 貯まるだけで誰も見ない記録か、中身の無い画面のどちらかになる。
  //
  // **ここで先に作っているのは、転送の入口（/go/）も同じ記録先を使うから。**
  // 2 つ作ると、同じクリックが 2 つの経路で別々に貯まる余地ができる。
  const telemetry =
    db === null
      ? createSampleTelemetrySink()
      : createD1TelemetrySink({ db, newId: () => idGenerator.newId() });
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
    //
    // 記事の本文（published_articles）も本物にした。**出す口（配信の画面の
    // 「いまサイトに出す」）を先に作ってからつないでいる**。読む口だけを
    // 本物にすると、書き込む操作が無いので一覧が永久に空のままになる。
    // 保存先が無い環境では、出す操作は**失敗を返す**（保存できたことにしない）。
    sites: db === null ? createSampleSiteRepository() : createD1SiteRepository(db),
    siteDrafts: db === null ? createSampleSiteDraftRepository() : createD1SiteDraftRepository(db),
    publishedContent: db === null ? createSampleContentRepository() : createD1ContentRepository(db),
    publishedArticles:
      db === null ? createSamplePublishedArticleWriter() : createD1PublishedArticleWriter(db),
    // ★ 見本（スタブ）。読者が自分で操作するもの。
    //   保存先 (KV)・計算式・問い合わせの送信先が用意できたら差し替える。
    shortlist: createSampleShortlistRepository(),
    readerTools: createSampleReaderToolRepository(),
    contact: createSampleContactSink(),
    // 記事（本文と進行の現在地）は、保存先が用意できていれば本物（D1）。
    // 入れる口（段階を進める・承認する）が先にあるので本物にした。
    // **見本は消さずに重ねる**（`d1/content-repository.ts` に理由）。
    //
    // ★ 企画と書き手はまだ見本データ（スタブ）。
    //   表を作っていないのではなく、**作る入口がどこにも無い**ため。
    //   入口の無い表を先に用意すると、一生埋まらない空の一覧が画面に増える。
    contentPackages: createSampleContentPackageRepository(),
    contentVariants:
      db === null ? createSampleContentVariantRepository() : createD1ContentVariantRepository(db),
    personas: createSamplePersonaRepository(),
    // 配信の記録は、保存先が用意できていれば本物（D1）。
    // 入れる口（記事の画面の「この記事を出す」）が先にあるので本物にした。
    // **見本は消さずに重ねる**（`d1/distribution-repository.ts` に理由）。
    //
    // 実際の投稿そのものは行わない。各サービスの認証が要り、
    // それは利用者ご自身がブラウザで登録するものだから。
    // 出し先の接続も、行を作る入口が付くまでは見本が並ぶ。
    channelConnections:
      db === null
        ? createSampleChannelConnectionRepository()
        : createD1ChannelConnectionRepository(db),
    publications: db === null ? createSamplePublicationRepository() : createD1PublicationRepository(db),
    manualExport: createSampleManualExport(),
    // 数字は、保存先が用意できていれば**計測の記録から導く**（D1）。
    // 指標を別の表に貯めないので、ここで渡すのは同じ接続 1 つだけ。
    // 接続が無い環境では見本データに落ちる（何で動いているかは画面に出す）。
    metrics:
      db === null ? createSampleMetricsRepository() : createD1TelemetryMetricsRepository(db),
    // 転送の入口（/go/<合言葉>）で押されたことの記録と、転送先の読み取り。
    //
    // **クリックを専用の表に貯めない。** 記録先は計測と同じ `telemetry_events` で、
    // 画面から送るクリックと同じ形（`affiliate_click`）になる。別の表にすると
    // 同じ「クリック数」が 2 つでき、食い違ったときにどちらが正しいか決められない。
    // 二重に数えないための印は `recordedVia`（redirect / browser）。
    clickTracking:
      db === null ? createSampleClickTracking() : createRedirectClickTracking({ telemetry }),
    redirectResolver: db === null ? createSampleRedirectResolver() : createD1RedirectResolver(db),
    telemetry,
    // ★ 見本データ（スタブ）。改善ループの記録と見せ方の設定。
    //   読み出しは見本を返し、保存は失敗を返す（保存できたことにしない）。
    improvement: createSampleImprovementRepository(),
    // 改善要望と鍵は、保存先が用意できていれば本物（D1）を使う。
    // 画面の写しは置き場が別（R2）なので、判定も別にする。D1 があっても
    // R2 が無い環境はあり得るし、その逆もある。片方の有無でもう片方を
    // 「つながっているつもり」にしない。
    // 指示文のひな型は本物（版番号つきでコードと一緒に管理する）。
    feedback: db === null ? createSampleFeedbackRepository() : createD1FeedbackRepository(db),
    feedbackCaptures:
      bucket === null ? createSampleFeedbackCaptureStore() : createR2FeedbackCaptureStore(bucket),
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
    // ★ 見本データ（スタブ）。中身は初期ルールそのもので、読み取りは本物と同じ結果を返す。
    policyRules: createSamplePolicyRuleRepository(),
    auditLog: db === null ? createSampleAuditLog() : createD1AuditLog(db),
    // 起きたことの発行。購読側（通知・再生成・リンク切れ検出）はまだ無いので
    // 記録だけする。購読を足すときに変えるのはこの 1 行だけ。
    events: createEventPublisher(null),
    // ID の作り方。試験では順番に増える作りへ差し替えて、結果を読めるようにする。
    ids: idGenerator,
    // 生成 AI。どこの提供元かは llm-setup.ts の 1 行が決める（シナリオ ②）。
    // 鍵が未登録のあいだはスタブが失敗を返す。空の記事を作らない。
    llm: llmPorts.llm,
    llmCosts: llmPorts.costs,
    // ★ 見本データ（スタブ）。提携先・提携条件・提携リンク。
    //   本物の数字には各 ASP の API 申請と、利用者ご自身による接続情報の登録が要る。
    //   ここで作るものには商業の印が付いており、順位づけへは型として渡せない。
    affiliateAccounts: createSampleAffiliateAccountRepository(),
    affiliatePrograms: createSampleAffiliateProgramRepository(),
    affiliateLinks: createSampleAffiliateLinkRepository(),
    // 成果は、保存先が用意できていれば本物（D1）。取り込みはまだ ASP の
    // 接続待ちだが、**金額を手で直す入口が画面にある**ので保存先を先に本物にした。
    // 入口があるのに保存できないと、直した額が次に開くと元へ戻る。
    // 数字は見ただけでは戻りに気づけず、そのまま締めの報告に使われる。
    conversions:
      db === null ? createSampleConversionRepository() : createD1ConversionRepository(db),
    // 受信箱だけは、保存先が用意できていれば本物（D1）を使う。
    // **この 1 行が、変更容易性シナリオ ⑥ の実体。**
    // 上の呼び出し側（ユースケース・画面・ツール）は 1 行も変わらない。
    linkInbox:
      db === null
        ? createSampleLinkIngestionRepository()
        : createCommercialD1LinkInboxRepository(db),
  };
}
