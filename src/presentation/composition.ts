import {
  createGetArticleUseCase,
  createGetPersonUseCase,
  createGetPolicyDocumentUseCase,
  createGetSiteUseCase,
  createListByCategoryUseCase,
  createListCorrectionsUseCase,
  createListRecentArticlesUseCase,
  createListSitesUseCase,
  createSearchArticlesUseCase,
} from "@/application/usecases/site/read-site";
import {
  createGetReaderToolUseCase,
  createListReaderToolsUseCase,
  createListShortlistUseCase,
  createRemoveFromShortlistUseCase,
  createRunReaderToolUseCase,
  createSaveToShortlistUseCase,
  createSubmitContactUseCase,
} from "@/application/usecases/site/reader-interaction";
import {
  createAdvanceContentStateUseCase,
  createApproveContentUseCase,
  createGetContentUseCase,
  createListContentBoardUseCase,
  createListReviewOverdueUseCase,
} from "@/application/usecases/content/manage-content";
import {
  createCancelPublicationUseCase,
  createExportManualDraftUseCase,
  createGetPublicationUseCase,
  createListChannelsUseCase,
  createListPublicationsUseCase,
} from "@/application/usecases/distribution/manage-distribution";
import {
  createCheckFeedbackUseCase,
  createListMetricsUseCase,
  createListUsableMetricsUseCase,
} from "@/application/usecases/analytics/read-metrics";
import {
  createAdjustConversionUseCase,
  createGetConversionUseCase,
  createListAffiliateAccountsUseCase,
  createListAffiliateProgramsUseCase,
  createListConversionsUseCase,
  createListProductLinksUseCase,
} from "@/application/usecases/monetization/manage-affiliate";
import {
  createCheckSiteDifferentiationUseCase,
  createGetManagedSiteUseCase,
  createListManagedSitesUseCase,
} from "@/application/usecases/site/manage-sites";
import {
  createCompareProductsUseCase,
  createExplainRankingUseCase,
  createFilterProductsUseCase,
  createFindAlternativesUseCase,
  createGetEvidenceUseCase,
  createGetProductUseCase,
  createListTestRunsUseCase,
} from "@/application/usecases/product/read-product";
import type { ActorContext } from "@/domain/shared";
import { taggedString } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import { sampleContentNotice } from "@/infrastructure/persistence/sample/content-sample-repository";
import { getCurrentActor, sampleActorNotice } from "@/infrastructure/identity/sample-actor";
import { sampleEditorialContentNotice } from "@/infrastructure/persistence/sample/content-editorial-sample-repository";
import { sampleDistributionNotice } from "@/infrastructure/persistence/sample/distribution-sample-repository";
import {
  SAMPLE_PERIODS,
  sampleAffiliateNotice,
} from "@/infrastructure/persistence/sample/affiliate-sample-repository";
import { sampleAnalyticsNotice } from "@/infrastructure/persistence/sample/analytics-sample-repository";
import { sampleProductNotice } from "@/infrastructure/persistence/sample/product-sample-repository";
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

/**
 * 読者向けブログの入口。
 *
 * ブログ画面はこの 6 つしか呼ばない。保存先が見本から D1 に変わっても、
 * 画面のコードは 1 行も変わらない。
 */
export function siteUseCases() {
  const deps = createDeps();
  const site = { sites: deps.sites, content: deps.publishedContent };
  return {
    getSite: createGetSiteUseCase(site),
    listSites: createListSitesUseCase(site),
    listRecent: createListRecentArticlesUseCase(site),
    listByCategory: createListByCategoryUseCase(site),
    getArticle: createGetArticleUseCase(site),
    search: createSearchArticlesUseCase(site),
    getPerson: createGetPersonUseCase(site),
    listCorrections: createListCorrectionsUseCase(site),
    getPolicy: createGetPolicyDocumentUseCase(site),
  };
}

/**
 * 読者が自分で操作するもの（気になる商品・診断・問い合わせ）。
 *
 * 画面も REST も WebMCP もここから取る。入口ごとに組み立て直さない。
 */
export function readerUseCases() {
  const deps = createDeps();
  const reader = {
    shortlist: deps.shortlist,
    readerTools: deps.readerTools,
    contact: deps.contact,
  };
  return {
    listShortlist: createListShortlistUseCase(reader),
    saveToShortlist: createSaveToShortlistUseCase(reader),
    removeFromShortlist: createRemoveFromShortlistUseCase(reader),
    getReaderTool: createGetReaderToolUseCase(reader),
    listReaderTools: createListReaderToolsUseCase(reader),
    runReaderTool: createRunReaderToolUseCase(reader),
    submitContact: createSubmitContactUseCase(reader),
  };
}

/**
 * 商品・根拠の入口（編集部向け）。
 *
 * 画面・REST・WebMCP・MCP が呼ぶのは**同じこの 8 つ**。
 * `src/presentation/tools/product-tools.ts` も同じユースケースを載せているので、
 * 画面に出る内容と AI が返す内容がずれない。
 */
export function productUseCases() {
  const deps = createDeps();
  const product = {
    products: deps.products,
    claims: deps.claims,
    evidence: deps.evidence,
    testRuns: deps.testRuns,
    rankingModels: deps.rankingModels,
    scoreCards: deps.scoreCards,
  };
  return {
    getProduct: createGetProductUseCase(product),
    filterProducts: createFilterProductsUseCase(product),
    compareProducts: createCompareProductsUseCase(product),
    findAlternatives: createFindAlternativesUseCase(product),
    getEvidence: createGetEvidenceUseCase(product),
    listTestRuns: createListTestRunsUseCase(product),
    explainRanking: createExplainRankingUseCase(product),
  };
}

/**
 * 記事の入口（編集部向け）。
 *
 * 画面・REST・WebMCP・MCP が同じ 5 つを呼ぶ。
 * 承認と状態変更は AI から呼べない（`requiresHumanApproval`）。
 */
export function contentUseCases() {
  const deps = createDeps();
  const content = {
    packages: deps.contentPackages,
    variants: deps.contentVariants,
    personas: deps.personas,
  };
  return {
    listBoard: createListContentBoardUseCase(content),
    getContent: createGetContentUseCase(content),
    listReviewOverdue: createListReviewOverdueUseCase(content),
    advanceState: createAdvanceContentStateUseCase(content),
    approve: createApproveContentUseCase(content),
  };
}

/**
 * サイトの管理（運営者向け）の入口。
 *
 * ブログを 1 本増やしても、ここも画面も変わらない。
 * 変わるのは保存されている設計図の設定値だけ。
 */
export function platformUseCases() {
  const sites = { sites: createDeps().sites };
  return {
    listSites: createListManagedSitesUseCase(sites),
    getSite: createGetManagedSiteUseCase(sites),
    checkDifferentiation: createCheckSiteDifferentiationUseCase(sites),
  };
}

/**
 * 配信の入口。
 *
 * 出し先を 1 つ増やすときに触るのは、domain のチャネル能力表と
 * つなぎ役の実装だけ。ここも画面も変わらない。
 */
export function distributionUseCases() {
  const deps = createDeps();
  const distribution = {
    connections: deps.channelConnections,
    publications: deps.publications,
    manualExport: deps.manualExport,
  };
  return {
    listChannels: createListChannelsUseCase(distribution),
    listPublications: createListPublicationsUseCase(distribution),
    getPublication: createGetPublicationUseCase(distribution),
    exportManualDraft: createExportManualDraftUseCase(distribution),
    cancel: createCancelPublicationUseCase(distribution),
  };
}

/**
 * 提携と成果の入口。
 *
 * ASP を 1 つ増やすときに触るのは、つなぎ役の実装だけ。
 * ここも画面も、順位づけのコードも変わらない。
 */
export function affiliateUseCases() {
  const deps = createDeps();
  const affiliate = {
    accounts: deps.affiliateAccounts,
    programs: deps.affiliatePrograms,
    links: deps.affiliateLinks,
    conversions: deps.conversions,
  };
  return {
    listAccounts: createListAffiliateAccountsUseCase(affiliate),
    listPrograms: createListAffiliateProgramsUseCase(affiliate),
    listConversions: createListConversionsUseCase(affiliate),
    getConversion: createGetConversionUseCase(affiliate),
    listProductLinks: createListProductLinksUseCase(affiliate),
    adjustConversion: createAdjustConversionUseCase(affiliate),
  };
}

/**
 * 数字の入口。
 *
 * 指標を 1 つ増やすときに触るのは domain の定義表だけ。
 * ここも画面も変わらず、数え方と「使ってよい用途」が同時に付いてくる。
 */
export function analyticsUseCases() {
  const analytics = { metrics: createDeps().metrics };
  return {
    listMetrics: createListMetricsUseCase(analytics),
    listUsableMetrics: createListUsableMetricsUseCase(analytics),
    checkFeedback: createCheckFeedbackUseCase(analytics),
  };
}

/** 数字が見本データであることを画面に出すための一文。 */
export function analyticsNotice(): string {
  return sampleAnalyticsNotice();
}

/** 提携と成果が見本データであることを画面に出すための一文。 */
export function affiliateNotice(): string {
  return sampleAffiliateNotice();
}

/** 見本にある会計期間。画面の期間切り替えに使う。 */
export function affiliatePeriods(): readonly string[] {
  return SAMPLE_PERIODS;
}

/** 配信が見本データであることを画面に出すための一文。 */
export function distributionNotice(): string {
  return sampleDistributionNotice();
}

/** 記事が見本データであることを画面に出すための一文。 */
export function editorialContentNotice(): string {
  return sampleEditorialContentNotice();
}

/** 商品・根拠が見本データであることを画面に出すための一文。 */
export function productSampleNotice(): string {
  return sampleProductNotice();
}

/**
 * 読者。ログインしていない人。
 *
 * 公開済みの記事を読むのに権限は要らない。
 * 公開してよいかの判定は公開時に済んでいる。
 */
export function readerActor(): ActorContext {
  return {
    workspaceId: taggedString<"WorkspaceId">("ws_public"),
    userId: taggedString<"UserId">("anonymous"),
    roles: [],
    isAiServiceAccount: false,
  };
}

/** 見本データで表示していることを読者向け画面に出すための一文。 */
export function siteSampleNotice(): string {
  return sampleContentNotice();
}

/** 商品の表示名。ID をそのまま画面に出さないための対応表。 */
export function productDisplayName(productId: string): string {
  return sampleProductName(productId as never);
}
