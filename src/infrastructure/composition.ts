import type { AppDeps } from "@/application/deps";
import type {
  LlmConnectivityPort,
  LlmCredentialVaultPort,
  LlmProviderCatalogPort,
} from "@/application/ports/llm-credential";
import {
  createCommercialD1LinkInboxRepository,
  type DrizzleD1,
} from "./persistence/d1/link-inbox-repository";
import {
  createD1BlogOpsRepository,
  createD1PublicBlogPort,
} from "./persistence/d1/blog-ops-repository";
import { createD1SiteDraftRepository } from "./persistence/d1/site-draft-repository";
import {
  createD1ChannelConnectionRepository,
  createD1PublicationRepository,
} from "./persistence/d1/distribution-repository";
import { createD1ContentPackageRepository } from "./persistence/d1/content-package-repository";
import {
  createD1ClaimRepository,
  createD1EvidenceRepository,
  createD1TestRunRepository,
} from "./persistence/d1/evidence-repository";
import {
  createD1RankingModelRepository,
  createD1ScoreCardRepository,
} from "./persistence/d1/ranking-repository";
import { createD1ContentVariantRepository } from "./persistence/d1/content-repository";
import { createD1ConversionRepository } from "./persistence/d1/conversion-repository";
import { createD1ProductRepository } from "./persistence/d1/product-repository";
import { createD1PersonaRepository } from "./persistence/d1/persona-repository";
import { createD1SiteRepository } from "./persistence/d1/site-repository";
import {
  createD1ContentRepository,
  createD1PublishedArticleAdminRepository,
  createD1PublishedArticleWriter,
} from "./persistence/d1/published-article-repository";
import { createD1SiteDocumentRepository } from "./persistence/d1/site-document-repository";
import {
  createD1FeedbackRepository,
  createD1IntegrationKeyStore,
} from "./persistence/d1/feedback-repository";
import { createD1ImprovementRepository } from "./persistence/d1/improvement-repository";
import { createEventPublisher } from "./platform/queue";
import {
  createR2FeedbackCaptureStore,
  type CaptureBucket,
} from "./platform/feedback-capture-r2";
import { createLlmPorts } from "./llm/llm-setup";
import type { LlmKeyAccess, LlmUsageRecorder } from "./llm/key-access";
import { createLlmProviderCatalog } from "./llm/llm-provider-catalog";
import { createLlmConnectivity } from "./llm/llm-connectivity";
import { createD1LlmCredentialVault } from "./persistence/d1/llm-credential-repository";
import { createD1LlmUsage } from "./persistence/d1/llm-usage-repository";
import { MIN_MASTER_SECRET_LENGTH } from "./platform/secret-box";
import {
  createSampleContentRepository,
  createSamplePublishedArticleAdminRepository,
  createSamplePublishedArticleWriter,
  createSampleSiteDocumentRepository,
  createSampleTrackingCoverage,
} from "./persistence/sample/content-sample-repository";
import {
  createSampleRankingModelRepository,
  createSampleScoreCardRepository,
} from "./persistence/sample/ranking-sample-repository";
import { createD1ShortlistRepository } from "./persistence/d1/reader-shortlist-repository";
import { createD1ContactRepository } from "./persistence/d1/contact-repository";
import { createD1ReaderToolRepository } from "./persistence/d1/reader-tool-repository";
import {
  createSampleContactSink,
  createSampleReaderToolRepository,
  createSampleShortlistRepository,
} from "./persistence/sample/reader-interaction-sample";
import { createTurnstileHumanCheck } from "./platform/turnstile";
import { createContactRateLimitKeyDeriver } from "./platform/contact-rate-key";
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
  createSamplePublicationRepository,
} from "./persistence/sample/distribution-sample-repository";
import {
  createChannelConnectorProvider,
  createChannelExporter,
} from "./channels/channel-registry";
import { createSecretResolver } from "./platform/secret-resolver";
import { pickSiteBaseDomain } from "./platform/site-base-domain";
import {
  createSampleClickTracking,
  createSampleMetricsRepository,
  createSampleRedirectResolver,
  createSampleTrackingLinkIssuer,
} from "./persistence/sample/analytics-sample-repository";
import {
  createD1RedirectResolver,
  createD1TrackingCoverage,
  createD1TrackingLinkIssuer,
  createRedirectClickTracking,
} from "./persistence/d1/redirect-repository";
import { withTrackingLinkIssuance } from "./persistence/tracking-issuing-writer";
import { createSampleTelemetrySink } from "./persistence/sample/telemetry-sample-sink";
import {
  createD1TelemetryMetricsRepository,
  createD1TelemetrySink,
} from "./persistence/d1/telemetry-repository";
import { createD1AuditLog } from "./persistence/d1/audit-log-repository";
import { createD1DisclosureRepository } from "./persistence/d1/disclosure-repository";
import {
  createD1BrandRepository,
  createD1WorkspaceRepository,
} from "./persistence/d1/settings-repository";
import { createD1PolicyRuleRepository } from "./persistence/d1/policy-rule-repository";
import { createD1MembershipRepository } from "./persistence/d1/membership-repository";
import { createSampleImprovementRepository } from "./persistence/sample/improvement-sample-repository";
import {
  createSampleAffiliateAccountRepository,
  createSampleAffiliateLinkRepository,
  createSampleAffiliateProgramRepository,
  createSampleArticleOfferReader,
  createSampleConversionRepository,
} from "./persistence/sample/affiliate-sample-repository";
import { createD1ArticleOfferReader } from "./persistence/d1/affiliate-link-repository";
import { createD1AffiliateLinkRepository } from "./persistence/d1/commercial-affiliate-link-repository";
import {
  createD1AffiliateAccountRepository,
  createD1AffiliateProgramRepository,
} from "./persistence/d1/affiliate-program-repository";
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
import {
  createSampleBlogOpsRepository,
  createSamplePublicBlogPort,
} from "./persistence/sample/blog-ops-sample-repository";
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
  options: {
    readonly db?: DrizzleD1 | null;
    readonly bucket?: CaptureBucket | null;
    /**
     * Worker の環境（設定値と秘密情報）。
     *
     * **渡さないと、鍵を登録しても提供元アダプタからは 1 件も見えない。**
     * 既定を `{}` にしてあるのは、Workers の外（`pnpm dev`・自動テスト）でも
     * 組み立てが動くようにするためで、本番で省いてよいという意味ではない。
     * 入口が渡し忘れていないことは検査で固定してある
     * （tests/architecture/worker-env-wiring.test.ts）。
     */
    readonly env?: Readonly<Record<string, unknown>>;
  } = {},
): AppDeps {
  const db = options.db ?? null;
  const bucket = options.bucket ?? null;
  const appSigningSecret =
    typeof options.env?.BETTER_AUTH_SECRET === "string"
      ? options.env.BETTER_AUTH_SECRET
      : db === null
        ? "sample-contact-rate-limit-secret-not-for-production"
        : "";
  /**
   * 生成 AI。**鍵の預かり所と同じ組み立てを使う。**
   *
   * 別々に組み立てていたころは、鍵を登録できる状態かどうかの判定が
   * 2 か所にあった。判定が分かれると「登録画面では登録できるのに、
   * 生成だけが黙って失敗する」状態が作れてしまう。
   */
  const management = createLlmCredentialManagement({ db, env: options.env ?? {} });
  const llmPorts = createLlmPorts(
    management.ready
      ? {
          ready: true,
          vault: management.vault,
          usage: management.usage,
          catalog: management.catalog,
        }
      : { ready: false, reason: management.reason },
  );
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
  const sites = db === null ? createSampleSiteRepository() : createD1SiteRepository(db);
  const auditLog = db === null ? createSampleAuditLog() : createD1AuditLog(db);
  // 公開一覧・本文・SEO・構成レポートは、この 1 reader instance を共有する。
  // D1 版は住所の解決に `sites` を要るので、`sites` より後に組む。
  const publishedContent =
    db === null ? createSampleContentRepository() : createD1ContentRepository(db, sites);
  return {
    // 順位づけの基準と採点表も、保存先が用意できていれば本物（D1）。
    // **入れる口（/admin/rankings/models/new と /admin/rankings/scores）を
    // 先に用意してからつないでいる。**
    // それまでは見本の評価方法 1 つと見本の商品 4 つを決め打ちで見ており、
    // 商品をいくつ登録しても順位に現れなかった（しかも画面は正常に見えた）。
    rankingModels:
      db === null ? createSampleRankingModelRepository() : createD1RankingModelRepository(db),
    scoreCards: db === null ? createSampleScoreCardRepository() : createD1ScoreCardRepository(db),
    // 商品は、保存先が用意できていれば本物（D1）。
    // 入れる口（商品の登録・修正・削除）が先にできたので本物にした。
    // **見本の 4 商品は消さずに重ねる**（`d1/product-repository.ts` に理由）。
    //
    // 主張・根拠・検証記録も本物（D1）にした。ここも順番は同じで、
    // **入れる口（/admin/evidence/new・/admin/evidence/claims/new・
    // /admin/evidence/test-runs/new）を先に作ってからつないでいる。**
    // それまで `/admin/evidence` は見本の主張と根拠しか見ておらず、
    // **どれだけ調べても画面の中身が 1 文字も増えなかった。**
    products: db === null ? createSampleProductRepository() : createD1ProductRepository(db),
    claims: db === null ? createSampleClaimRepository() : createD1ClaimRepository(db),
    evidence: db === null ? createSampleEvidenceRepository() : createD1EvidenceRepository(db),
    testRuns: db === null ? createSampleTestRunRepository() : createD1TestRunRepository(db),
    // ブログの下書きと、作られたブログは、保存先が用意できていれば本物（D1）。
    // ここを先に本物にしたのは、**入れる口（作成ウィザード）が既にあるから**。
    // 入れる口が無いものを本物にすると、一生埋まらない空の画面ができる。
    //
    // 記事の本文（published_articles）も本物にした。**出す口（配信の画面の
    // 「いまサイトに出す」）を先に作ってからつないでいる**。読む口だけを
    // 本物にすると、書き込む操作が無いので一覧が永久に空のままになる。
    // 保存先が無い環境では、出す操作は**失敗を返す**（保存できたことにしない）。
    sites,
    siteDrafts:
      db === null ? createSampleSiteDraftRepository(auditLog) : createD1SiteDraftRepository(db),
    // 住所の基底ドメインはここで 1 回だけ解釈する。
    // 入口が `env` を渡し忘れると `null` になり、住所なし（`/s/<URL名>` だけ）で
    // 動く。**作成を止めない**のは、住所未設定は障害ではなく構成の状態だから。
    siteBaseDomain: pickSiteBaseDomain(options.env ?? {}),
    blogOps: db === null ? createSampleBlogOpsRepository() : createD1BlogOpsRepository(db),
    publicBlog:
      db === null
        ? createSamplePublicBlogPort(sites, publishedContent)
        : createD1PublicBlogPort(db, sites, publishedContent),
    publicBlogSource: db === null ? "sample" : "live",
    publishedContent,
    // ブログの固定文書（運営者情報・各方針・規約・特商法表記）。
    // **見本へ落とさない。** 落とすと、まだ書いていない運営者情報の位置に
    // 見本の運営者情報が出て、読者にはそれが本物として読まれる。
    // 未整備は未整備のまま（読者は 404）にして、管理画面の一覧で目立たせる。
    siteDocuments:
      db === null
        ? createSampleSiteDocumentRepository()
        : createD1SiteDocumentRepository({
            db,
            now: () => new Date(),
            newId: () => idGenerator.newId(),
          }),
    //
    // **出す口を合言葉の発行で包んでいる。** 記事を出す経路はここ 1 つなので、
    // 包んでおけば発行が漏れない。写しに書く作業場所は `save` の引数
    // （＝そのブログを持っている側）をそのまま使うので、読者の身元が
    // 写しへ入る経路が型の上で存在しない（残課題 25 / 56 の再発を構造で止める）。
    // 記事に載せる成果リンクは、保存先が用意できていれば本物（D1）。
    // **この 1 行が無いと、版の `affiliateLinkIds` は読者へ 1 件も届かない。**
    // 版は ID の列しか持たないので、引き当てる先が無ければ記事に出しようがない。
    // 返す形に報酬の欄が無いので、記事の組み立てへ渡せる（Editorial の印）。
    articleOffers:
      db === null ? createSampleArticleOfferReader() : createD1ArticleOfferReader(db),
    publishedArticles: withTrackingLinkIssuance(
      db === null ? createSamplePublishedArticleWriter() : createD1PublishedArticleWriter(db),
      db === null ? createSampleTrackingLinkIssuer() : createD1TrackingLinkIssuer(db),
    ),
    publishedArticleAdmin:
      db === null
        ? createSamplePublishedArticleAdminRepository()
        : createD1PublishedArticleAdminRepository(db),
    // 気になる商品は、保存先が用意できていれば本物（D1）。
    // **KV を待たずに D1 で作った。** 見本版は処理中のメモリに置くので、
    // 読者から見ると「保存できたのに翌日消えている」。何も知らせずに消える。
    // D1 はもう繋がっているので、先に消えないようにするほうが待つより早い。
    // ここは見本を重ねない。押していない商品が最初から並ぶ一覧は、読者の一覧ではない。
    shortlist: db === null ? createSampleShortlistRepository() : createD1ShortlistRepository(db),
    // 診断・計算は、保存先が用意できていれば本物（D1）。
    // 定義（入力欄と読み方）だけでなく**計算式まで保存側から取る**ので、
    // 道具を 1 つ増やすのに画面もコードも足さずに済む。
    // 式は `domain/authoring/reader-tool-formula.ts` が解く（`eval` に渡さない）。
    // 作り付けの 1 つはどちらの環境でも残る（`reader-tool-repository.ts` に理由）。
    readerTools:
      db === null ? createSampleReaderToolRepository() : createD1ReaderToolRepository(db),
    // 問い合わせも、保存先が用意できていれば本物（D1）。
    // メール通知はまだ無いが、**届いた分は /admin/contact で読める**。
    // 読む口を同時に作らずに保存だけ足すと「受け付けました」が嘘になる。
    // 保存先が無い環境では受け取らずに断る（`reader-interaction-sample.ts` に理由）。
    contact: db === null ? createSampleContactSink() : createD1ContactRepository(db),
    contactRateLimitKeys: createContactRateLimitKeyDeriver(appSigningSecret),
    humanCheck: createTurnstileHumanCheck(options.env ?? {}),
    // 記事（本文と進行の現在地）は、保存先が用意できていれば本物（D1）。
    // 入れる口（段階を進める・承認する）が先にあるので本物にした。
    // **見本は消さずに重ねる**（`d1/content-repository.ts` に理由）。
    //
    // 企画も、保存先が用意できていれば本物（D1）。
    // **入れる口（/admin/content/packages/new）を先に用意してからつないでいる。**
    // それまでは記事を作る画面が見本の企画 1 件を決め打ちで渡していたので、
    // 何本記事を作っても「どの企画の記事か」の答えが全部同じになっていた。
    contentPackages:
      db === null ? createSampleContentPackageRepository() : createD1ContentPackageRepository(db),
    contentVariants:
      db === null ? createSampleContentVariantRepository() : createD1ContentVariantRepository(db),
    // 書き手と読者像は、保存先が用意できていれば本物（D1）。
    // **入れる口（/admin/personas/new と /admin/personas/audiences/new）を
    // 先に作ってからつないでいる。** 読む口だけを本物にすると、
    // 書き込む操作が無いので一覧が永久に見本のままになる。
    // 見本は消さずに重ねる（`d1/persona-repository.ts` に理由）。
    personas: db === null ? createSamplePersonaRepository() : createD1PersonaRepository(db),
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
    channelConnectors: createChannelConnectorProvider({
      secrets: createSecretResolver(options.env ?? {}),
    }),
    publications: db === null ? createSamplePublicationRepository() : createD1PublicationRepository(db),
    // 書き出しは**保存先の有無で分けない**。外へ出さず、保存もせず、
    // 記事の中身と出し先の種類だけで文面が決まるので、見本の環境でも本物が動く。
    // ここを見本に落としていた間、出し先が何であっても手順書は note のまま出ていた。
    manualExport: createChannelExporter(),
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
    // 順位表に出ている成果リンクのうち、まだ合言葉が発行されていない件数。
    // **実際に読者へ出している記事から数える**（発行の記録の側から数えない。
    // 写しがあっても記事に合言葉が入っていなければ読者は ASP の URL を踏む）。
    trackingCoverage:
      db === null ? createSampleTrackingCoverage() : createD1TrackingCoverage(db),
    telemetry,
    // 改善ループの記録と見せ方の設定は、保存先が用意できていれば本物（D1）。
    //
    // **見本と混ぜない。** ほかの保存先は見本を重ねているが、ここは数字を伴う。
    // 見本の「良くなった」と実測が同じ一覧に並ぶと、どちらを見て判断したのかが
    // 後から区別できなくなる。保存先が無い環境では見本のまま（保存は失敗を返す）。
    improvement:
      db === null ? createSampleImprovementRepository() : createD1ImprovementRepository(db),
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
    // 作業場所も、保存先が用意できていれば**本物**（D1 の workspaces）。
    //
    // 上限（プランごとのブランド数・ブログ数・生成回数）は数えて出す。
    // 作業場所の行に持ち回ると、増やすたびに 2 か所へ書くことになり、
    // 落ちた回だけ数字がずれる。ずれた上限は、作れるはずのものを作らせない。
    workspaces:
      db === null ? createSampleWorkspaceRepository() : createD1WorkspaceRepository(db),
    // 担当者の登録は、保存先が用意できていれば**本物**（D1 の memberships）。
    //
    // **見本と混ぜない。** ほかの保存先は見本を重ねているが、ここは権限そのものである。
    // 見本の担当者が本物の一覧に並ぶと、実在しない人に役が付いて見え、
    // 「この作業場所には誰が入れるのか」を画面から確かめられなくなる。
    // 接続の無い実行では見本のまま（保存は失敗を返す。招待できたふりをしない）。
    memberships:
      db === null ? createSampleMembershipRepository() : createD1MembershipRepository(db),
    // ブランドも、保存先が用意できていれば**本物**（D1 の brands）。
    // 入れる口は /admin/settings/brands/new と /admin/settings/brands/[brand]。
    brands: db === null ? createSampleBrandRepository() : createD1BrandRepository(db),
    // 広告表記は、保存先が用意できていれば**本物**（D1 の disclosures）。
    //
    // **見本と混ぜない。** これは読者へ実際に出る断り文である。見本の
    // 「見本メーカー株式会社」が本物の一覧に並ぶと、存在しない提供元の表記を
    // 記事へ出せてしまう。接続の無い実行では見本のまま（保存は失敗を返す）。
    disclosures:
      db === null ? createSampleDisclosureRepository() : createD1DisclosureRepository(db),
    // 表記のきまりも、保存先が用意できていれば**本物**（D1 の policy_rules）。
    //
    // **表が空でも「きまり 0 件」にはならない。** D1 版が返すのは
    // 「初期ルール ＋ この作業場所の変更（無効化・上書き・追加）」で、
    // 触っていないきまりは `buildSeedPolicyRules()` 側が正本のまま返る。
    // 接続の無い実行では見本のまま（読み取りは初期ルール、保存は失敗を返す）。
    policyRules:
      db === null ? createSamplePolicyRuleRepository() : createD1PolicyRuleRepository(db),
    auditLog,
    // 起きたことの発行。購読側（通知・再生成・リンク切れ検出）はまだ無いので
    // 記録だけする。購読を足すときに変えるのはこの 1 行だけ。
    events: createEventPublisher(null),
    // ID の作り方。試験では順番に増える作りへ差し替えて、結果を読めるようにする。
    ids: idGenerator,
    // 生成 AI。どこの提供元かは llm-setup.ts の 1 行が決める（シナリオ ②）。
    // 鍵が未登録のあいだはスタブが失敗を返す。空の記事を作らない。
    llm: llmPorts.llm,
    llmCosts: llmPorts.costs,
    // 提携先と提携条件は、保存先が用意できていれば本物（D1）。
    // **入れる口（`/admin/affiliate/accounts/new`・`/admin/affiliate/programs/new`）を
    // 先に作ってからつないでいる。** 読む口だけを本物にしても、書く口が無ければ
    // 表は永久に空で、見本以外の提携先を 1 件も持てない。
    // 成果の取り込み自体には各 ASP の API 申請と、利用者ご自身による接続情報の
    // 登録が要る。ここで扱うのは**その手前の「どこと提携しているか」**だけで、
    // 秘密の値は列としても持たない（保管先の名前だけ）。
    affiliateAccounts:
      db === null
        ? createSampleAffiliateAccountRepository()
        : createD1AffiliateAccountRepository(db),
    affiliatePrograms:
      db === null
        ? createSampleAffiliateProgramRepository()
        : createD1AffiliateProgramRepository(db),
    // 成果リンクだけは、保存先が用意できていれば本物（D1）。
    // **入れる口（受信箱の「成果リンクとして登録する」）を先に作ってからつないでいる。**
    // 読む口だけを本物にしても、書く口が無ければ表は永久に空で、
    // 公開した記事に成果リンクが 1 件も出ない（残課題 58 / REQ-E13）。
    // 見本は消さずに重ねる（`d1/commercial-affiliate-link-repository.ts` に理由）。
    affiliateLinks:
      db === null ? createSampleAffiliateLinkRepository() : createD1AffiliateLinkRepository(db),
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

/**
 * 生成 AI の鍵を預かる仕組みの組み立て。
 *
 * --- なぜ `createDeps` に入れないか ---
 * **預かり所は「作らない」という状態を持つ。**
 * 元締めの鍵（`LLM_KEY_ENCRYPTION_SECRET`）が無い環境で預かり所を作ると、
 * 包めない値を保存先へ入れる道ができる。入った時点で、平文か
 * 開けられない塊のどちらかが残り、どちらも後から直せない。
 *
 * `AppDeps` の欄は全部そろっている前提で書かれているので、
 * そこへ「無いことがある口」を混ぜると、他の 40 個の口まで
 * 「無いかもしれない」と読む必要が出る。分けて置く。
 *
 * --- 使えない理由を捨てない ---
 * 作れなかったときに `null` だけ返すと、画面は
 * 「鍵が無い」「保存先が無い」「元締めの鍵が短い」を同じ空白として出す。
 * 利用者のやることは 3 つとも違う。理由を持って返す。
 */
export type LlmCredentialManagement =
  | {
      readonly ready: true;
      /**
       * 預かり所。**2 つの面を持つ 1 つの物**である。
       * 応用層へ渡すのは `LlmCredentialVaultPort` の面だけ（値を返す口が無い）。
       * `LlmKeyAccess` の面は提供元アダプタにだけ渡す。
       */
      readonly vault: LlmCredentialVaultPort & LlmKeyAccess;
      /** 使った量の記録先。呼び出しを組み立てるのに要る（省略できない）。 */
      readonly usage: LlmUsageRecorder;
      readonly catalog: LlmProviderCatalogPort;
      readonly connectivity: LlmConnectivityPort;
    }
  | {
      readonly ready: false;
      /** なぜ登録できないか。画面にそのまま出す 1 行。 */
      readonly reason: string;
      /**
       * 使えないときでも目録は返す。
       * **鍵をどこで発行するかの案内は、登録できない状態でこそ要る。**
       */
      readonly catalog: LlmProviderCatalogPort;
    };

export function createLlmCredentialManagement(options: {
  readonly db?: DrizzleD1 | null;
  readonly env?: Readonly<Record<string, unknown>>;
  readonly now?: () => Date;
}): LlmCredentialManagement {
  const db = options.db ?? null;
  const env = options.env ?? {};
  const now = options.now ?? (() => new Date());

  const rawCatalog = typeof env.LLM_PROVIDER_CATALOG === "string" ? env.LLM_PROVIDER_CATALOG : "";
  const catalog = createLlmProviderCatalog(rawCatalog);

  if (db === null) {
    return {
      ready: false,
      catalog,
      reason:
        "保存先（D1）につながっていないため、鍵を預かれません。公開した環境（pnpm run preview か本番）で開いてください。",
    };
  }

  const master = typeof env.LLM_KEY_ENCRYPTION_SECRET === "string" ? env.LLM_KEY_ENCRYPTION_SECRET : "";
  if (master === "") {
    return {
      ready: false,
      catalog,
      reason:
        "元締めの鍵（LLM_KEY_ENCRYPTION_SECRET）が未登録のため、API キーを包めません。ご自身のターミナルで `wrangler secret put LLM_KEY_ENCRYPTION_SECRET` を実行してください（値をこの画面やチャットに貼らないでください）。",
    };
  }
  if (master.length < MIN_MASTER_SECRET_LENGTH) {
    return {
      ready: false,
      catalog,
      reason: `元締めの鍵（LLM_KEY_ENCRYPTION_SECRET）が短すぎます（${MIN_MASTER_SECRET_LENGTH} 文字以上）。長いものへ入れ直してください。`,
    };
  }

  const vault = createD1LlmCredentialVault({ db, masterSecret: master, now });
  const usage = createD1LlmUsage({ db, ids: idGenerator, now });
  return {
    ready: true,
    vault,
    usage,
    catalog,
    // 疎通確認は鍵の値を使う。だから**預かり所そのもの**を渡す
    // （`LlmKeyAccess` の面。応用層には型として届かない）。
    connectivity: createLlmConnectivity({ vault, catalog, usage }),
  };
}
