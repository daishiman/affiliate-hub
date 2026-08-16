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
