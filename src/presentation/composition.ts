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
  createCheckFactBoundaryUseCase,
  createGetAudiencePersonaUseCase,
  createGetAuthorPersonaUseCase,
  createListAudiencePersonasUseCase,
  createListAuthorPersonasUseCase,
} from "@/application/usecases/authoring/manage-personas";
import { createGetGenerationMatrixUseCase } from "@/application/usecases/authoring/plan-generation-matrix";
import { createReadWritingMethodUseCase } from "@/application/usecases/authoring/read-writing-method";
import {
  createCancelPublicationUseCase,
  createExportManualDraftUseCase,
  createGetPublicationUseCase,
  createListChannelsUseCase,
  createListPublicationsUseCase,
  createSchedulePublicationUseCase,
} from "@/application/usecases/distribution/manage-distribution";
import {
  createGetPublicationCalendarUseCase,
  createReschedulePublicationUseCase,
} from "@/application/usecases/distribution/publication-calendar";
import {
  createCheckFeedbackUseCase,
  createListMetricsUseCase,
  createListUsableMetricsUseCase,
} from "@/application/usecases/analytics/read-metrics";
import { createFilterMetricsUseCase } from "@/application/usecases/analytics/filter-metrics";
import { createAiUsageReportUseCase } from "@/application/usecases/analytics/ai-usage-report";
import { createExplainTelemetryUseCase } from "@/application/usecases/analytics/explain-telemetry";
import { createHandOffFeedbackUseCase } from "@/application/usecases/feedback/hand-off-feedback";
import { createListFeedbackUseCase } from "@/application/usecases/feedback/list-feedback";
import { createManageIntegrationKeysUseCase } from "@/application/usecases/feedback/manage-integration-keys";
import { createReadFeedbackUseCase } from "@/application/usecases/feedback/read-feedback";
import { createSubmitFeedbackUseCase } from "@/application/usecases/feedback/submit-feedback";
import { createUpdateFeedbackStatusUseCase } from "@/application/usecases/feedback/update-feedback-status";
import { createReviewLoopRunsUseCase } from "@/application/usecases/improvement/review-loop-runs";
import { createListImprovementDimensionsUseCase } from "@/application/usecases/improvement/list-improvement-dimensions";
import {
  createCheckGenerationInputUseCase,
  createReadGenerationPlanUseCase,
  createReviewMaterialUseCase,
} from "@/application/usecases/generation/read-generation-plan";
import { createDraftContentVariantUseCase } from "@/application/usecases/generation/draft-content-variant";
import type { GenerationInput } from "@/domain/generation";
import { sampleGenerationInput } from "@/infrastructure/persistence/sample/generation-sample-input";
import {
  createAdjustConversionUseCase,
  createGetConversionUseCase,
  createListAffiliateAccountsUseCase,
  createListAffiliateProgramsUseCase,
  createListConversionsUseCase,
  createListProductLinksUseCase,
} from "@/application/usecases/monetization/manage-affiliate";
import {
  createListLinkInboxUseCase,
  createMatchLinkIngestionUseCase,
  createRejectLinkIngestionUseCase,
  createResolveLinkIngestionUseCase,
  createSubmitAffiliateUrlUseCase,
} from "@/application/usecases/monetization/manage-link-inbox";
import {
  createGetSettingsOverviewUseCase,
  createListAuditLogUseCase,
  createListBrandsUseCase,
  createListDisclosuresUseCase,
  createListMembersUseCase,
  createListRolesUseCase,
} from "@/application/usecases/identity/manage-workspace";
import {
  createCreateSiteFromDraftUseCase,
  createGetSiteDraftUseCase,
  createListSiteDraftsUseCase,
  createSaveSiteDraftStepUseCase,
  createStartSiteDraftUseCase,
} from "@/application/usecases/site/build-site";
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
import { createGetDashboardUseCase } from "@/application/usecases/dashboard/read-dashboard";
import type { ActorContext } from "@/domain/shared";
import { taggedString } from "@/domain/shared";
import { type KeyScope, authorize } from "@/domain/feedback";
import type { StorageStatus } from "@/presentation/ui/patterns/stub-notice";
import { createDeps } from "@/infrastructure/composition";
import { telemetryStubNotice } from "@/infrastructure/persistence/sample/telemetry-sample-sink";
import { improvementStubNotice } from "@/infrastructure/persistence/sample/improvement-sample-repository";
import { feedbackStubNotice } from "@/infrastructure/persistence/sample/feedback-sample-repository";
import { sampleContentNotice } from "@/infrastructure/persistence/sample/content-sample-repository";
import { sampleSiteDraftNotice } from "@/infrastructure/persistence/sample/site-draft-sample-repository";
import { getCurrentActor, sampleActorNotice } from "@/infrastructure/identity/sample-actor";
import {
  SESSION_COOKIE_NAME,
  type ActorResolution,
} from "@/infrastructure/identity/session-actor";
import { sampleEditorialContentNotice } from "@/infrastructure/persistence/sample/content-editorial-sample-repository";
import { sampleDistributionNotice } from "@/infrastructure/persistence/sample/distribution-sample-repository";
import {
  SAMPLE_PERIODS,
  sampleAffiliateNotice,
} from "@/infrastructure/persistence/sample/affiliate-sample-repository";
import { sampleAnalyticsNotice } from "@/infrastructure/persistence/sample/analytics-sample-repository";
import { sampleLinkInboxNotice } from "@/infrastructure/persistence/sample/link-inbox-sample-repository";
import { tryGetDb } from "@/infrastructure/persistence/d1/connection";
import { tryGetBucket } from "@/infrastructure/platform/bucket-connection";
import { CAPTURE_RETENTION_DAYS } from "@/domain/feedback";
import { sampleProductNotice } from "@/infrastructure/persistence/sample/product-sample-repository";
import { sampleSettingsNotice } from "@/infrastructure/persistence/sample/settings-sample-repository";
import {
  SAMPLE_MODEL_ID,
  SAMPLE_PRODUCTS,
  sampleProductName,
} from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { buildToolCatalog, rankProductsTool } from "./tools/catalog";
import { toWebMcpDescriptors, type WebMcpDescriptor } from "./tools/webmcp-adapter";
import { toolNamesForPage, type PageKind } from "./tools/webmcp-policy";
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
export async function createToolCatalog(): Promise<readonly AnyToolDefinition[]> {
  // **接続を渡す。** 道具は画面と同じ処理を呼ぶのが前提なので、
  // ここで渡し忘れると「画面には保存されているのに AI からは見えない」
  // という、入口ごとに答えが違う状態になる。
  return buildToolCatalog(createDeps({ db: await tryGetDb() }));
}

/**
 * 外から来た呼び出しの身元確認。REST も MCP もこれを通る。
 *
 * 読み込みを関数の中に置いているのは、Cloudflare の実行環境に依存する処理を
 * 画面やテストの読み込み時点まで引きずり込まないため。
 */
export async function authenticateRequest(
  request: Request,
): Promise<
  { ok: true; scope: "bearer" | "same-origin" } | { ok: false; status: number; message: string }
> {
  const { authenticateApiRequest } = await import("@/infrastructure/platform/api-token");
  return authenticateApiRequest(request);
}

/**
 * 取りに来た相手（Claude Code）の身元確認。
 *
 * `authenticateRequest` と分けてある理由は、確かめている相手が違うから。
 * あちらは「この製品の入口を叩いてよい呼び出しか」、こちらは
 * **「どの作業場所の、何ができる鍵か」** を決める。混ぜると、
 * 全体の合言葉さえ知っていれば他人の要望が読めることになる。
 *
 * 作った身元は必ず `ai_service_account` にする。人しか押せない操作
 * （扱いを決める・鍵を管理する）は、この身元では構造上できない。
 */
export type IntegrationAccessResolution =
  | {
      ok: true;
      actor: ActorContext;
      keyId: string;
      keyLabel: string;
      recordUsage: (fetchedCount: number) => Promise<void>;
    }
  | { ok: false; status: number; message: string };

export async function resolveIntegrationAccess(
  request: Request,
  scope: KeyScope,
): Promise<IntegrationAccessResolution> {
  const header = request.headers.get("authorization") ?? "";
  const value = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (value === "") {
    return {
      ok: false,
      status: 401,
      message: "鍵がありません。Authorization ヘッダーに Bearer で付けてください。",
    };
  }

  const keys = createDeps({ db: await tryGetDb() }).integrationKeys;
  const found = await keys.authenticate(value);
  // 「無い鍵」と「潰れた保存先」を同じ文言で返す。どちらかを言い分けると、
  // 存在する鍵を総当たりで探し当てる手がかりになる。
  if (!found.ok || found.value === null) {
    return { ok: false, status: 401, message: "この鍵では取得できません。" };
  }
  const key = found.value;

  const now = new Date();
  const allowed = authorize(key, scope, now);
  if (!allowed.ok) {
    return {
      ok: false,
      status: allowed.error.code === "FORBIDDEN" ? 403 : 401,
      message: allowed.error.message,
    };
  }

  const within = await keys.withinRateLimit(key.id, now);
  if (!within.ok || !within.value) {
    return {
      ok: false,
      status: 429,
      message: `1 分あたり ${key.rateLimitPerMinute} 回までです。少し待ってからもう一度取りに来てください。`,
    };
  }

  return {
    ok: true,
    keyId: String(key.id),
    keyLabel: key.label,
    actor: {
      workspaceId: key.workspaceId,
      userId: `鍵: ${key.label}`,
      roles: ["ai_service_account"],
      isAiServiceAccount: true,
    },
    recordUsage: async (fetchedCount: number) => {
      await keys.recordUsage(key.workspaceId, {
        keyId: key.id,
        keyLabel: key.label,
        at: now,
        fetchedCount,
      });
    },
  };
}

/**
 * いま操作している人を決める、唯一の場所。
 *
 * **ログインの仕組みを差し替えるとき変えるのは、この関数の中だけ。**
 * 画面・ツール・API は `currentActor()` しか知らないので 1 行も変わらない
 * （変更容易性シナリオ ⑦）。
 *
 * 合言葉の取り出しだけをここで行うのは、`next/headers` が画面側の道具だから。
 * 有効かどうかの判定と権限の引き当ては infrastructure が持つ
 * （`session-repository` と `session-actor`）。
 */
async function resolveActor(): Promise<ActorResolution> {
  try {
    const { cookies } = await import("next/headers");
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
    if (token === null) return { kind: "anonymous" };

    const db = await tryGetDb();
    if (db === null) return { kind: "unavailable", reason: "保存先に接続できていません。" };

    const { createD1SessionReader } = await import(
      "@/infrastructure/identity/session-repository"
    );
    const { createSessionActorResolver } = await import(
      "@/infrastructure/identity/session-actor"
    );
    return await createSessionActorResolver({
      sessions: createD1SessionReader(db),
      memberships: createDeps({ db }).memberships,
    })(token);
  } catch {
    // 画面の外（テストや組み立て時）では合言葉を取り出せない。
    // ここで例外を投げると、ログインと関係のない場所が落ちる。
    return { kind: "anonymous" };
  }
}

/**
 * いま操作している人。
 *
 * ログインできていないあいだは見本のログイン情報を返す。
 * **黙って戻さない。** どちらで動いているかは `actorNotice()` が必ず画面に出す。
 */
export async function currentActor(): Promise<ActorContext> {
  const resolved = await resolveActor();
  return resolved.kind === "actor" ? resolved.actor : getCurrentActor();
}

/** いまどの身元で動いているかを画面に出すための一文。 */
export async function actorNotice(): Promise<string> {
  const resolved = await resolveActor();
  switch (resolved.kind) {
    case "actor":
      return "ログイン中の情報で表示しています。";
    case "not_member":
      return "ログインはできていますが、この作業場所の担当者として登録されていません。見本の情報で表示しています。";
    case "unavailable":
      return `ログイン状態を確認できませんでした（${resolved.reason}）。見本の情報で表示しています。`;
    case "anonymous":
      return sampleActorNotice();
  }
}

/**
 * 読者のページに載せる、AI 向けの操作宣言（WebMCP）。
 *
 * 4 つの決まりをここで守る。守る場所を 1 箇所にしないと、ページごとにずれる。
 *   1. 読み取り専用だけ（`toWebMcpDescriptors` が絞る）
 *   2. 1 ページ 6 件まで（`MAX_TOOLS_PER_PAGE`）
 *   3. ページ種別ごとに選ぶ（`PAGE_TOOLS`。記事と比較で要る道具は違う）
 *   4. すべて通常の画面操作でも同じことができる
 *
 * 機能フラグ（`WEBMCP_ENABLED`）が切れていれば空を返す。
 * 空でも画面は普通に使える（AI 向けの宣言が出ないだけ）。
 */
export function readerWebMcpDescriptors(
  kind: PageKind = "article",
): readonly WebMcpDescriptor[] {
  return descriptorsForPage(kind);
}

/**
 * 管理画面に載せる、AI 向けの操作宣言（WebMCP）。
 *
 * 状態を変える操作は載せない。承認と公開は人が画面で行う。
 */
export function adminWebMcpDescriptors(): readonly WebMcpDescriptor[] {
  return descriptorsForPage("admin");
}

function descriptorsForPage(kind: PageKind): readonly WebMcpDescriptor[] {
  const wanted = toolNamesForPage(kind, process.env as Record<string, string | undefined>);
  if (wanted.length === 0) return [];
  // 並び順は表の順に揃える。カタログの並びに任せると、
  // 同じページでも登録順が変わって挙動の説明が付かなくなる。
  // ここで要るのは名前と入力の形だけで、中身は一度も動かさない。
  // 保存先を待つ必要がないので接続を取りに行かない（画面の描画を遅らせない）。
  const catalog = buildToolCatalog(createDeps());
  const picked = wanted
    .map((name) => catalog.find((t) => t.name === name))
    .filter((t): t is NonNullable<typeof t> => t !== undefined);
  return toWebMcpDescriptors(picked);
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
export async function siteUseCases() {
  const deps = createDeps({ db: await tryGetDb() });
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
export async function contentUseCases() {
  // 保存先の接続をここで取る。取らないと、段階を進める操作が
  // 見本の上で成功したように見えて、次に開いたときには消えている。
  const deps = createDeps({ db: await tryGetDb() });
  const content = {
    packages: deps.contentPackages,
    variants: deps.contentVariants,
    personas: deps.personas,
    events: deps.events,
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
 * 書き手と読者像の入口。
 *
 * **記事を作る前に決めるもの。** 誰の立場で、誰に向けて書くかが決まらないと、
 * 比較の観点も、使ってよい言い回しも決まらない。
 */
export function personaUseCases() {
  const personas = { personas: createDeps().personas };
  return {
    listAuthors: createListAuthorPersonasUseCase(personas),
    getAuthor: createGetAuthorPersonaUseCase(personas),
    listAudiences: createListAudiencePersonasUseCase(personas),
    getAudience: createGetAudiencePersonaUseCase(personas),
    checkFactBoundary: createCheckFactBoundaryUseCase(personas),
  };
}

/**
 * 書き方の決めごとの入口。
 *
 * 節の並びや文体を 1 つ変えるときに触るのは domain の定義だけ。
 * 画面・AI 向けの道具・生成の指示文が同じ定義を見る。
 */
export function writingMethodUseCases() {
  return { readMethod: createReadWritingMethodUseCase() };
}

/**
 * 生成マトリクスの入口。
 *
 * **どの組み合わせを作るかを決める表。** 報酬のつなぎ目は渡さない。
 * 報酬額でセルを選ぶと、記事の並びが広告の並びになる。
 */
export async function generationMatrixUseCases() {
  const deps = createDeps({ db: await tryGetDb() });
  const matrix = {
    packages: deps.contentPackages,
    variants: deps.contentVariants,
    personas: deps.personas,
  };
  return {
    getMatrix: createGetGenerationMatrixUseCase(matrix),
  };
}

/** 見本データで開く企画。マトリクス画面の初期表示に使う。 */
export function sampleContentPackageId(): string {
  return "cp_laptop_2026";
}

/**
 * サイトの管理（運営者向け）の入口。
 *
 * ブログを 1 本増やしても、ここも画面も変わらない。
 * 変わるのは保存されている設計図の設定値だけ。
 */
export async function platformUseCases() {
  const sites = { sites: createDeps({ db: await tryGetDb() }).sites };
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
export async function distributionUseCases() {
  // 保存先の接続をここで取る。**画面ごとに取らない。**
  // 取り方が画面ごとに分かれると、片方だけ見本のまま残る。
  const deps = createDeps({ db: await tryGetDb() });
  const distribution = {
    connections: deps.channelConnections,
    publications: deps.publications,
    manualExport: deps.manualExport,
    variants: deps.contentVariants,
    ids: deps.ids,
  };
  return {
    listChannels: createListChannelsUseCase(distribution),
    listPublications: createListPublicationsUseCase(distribution),
    getPublication: createGetPublicationUseCase(distribution),
    exportManualDraft: createExportManualDraftUseCase(distribution),
    cancel: createCancelPublicationUseCase(distribution),
    schedule: createSchedulePublicationUseCase(distribution),
  };
}

/**
 * 投稿カレンダー。
 *
 * 配信の一覧と同じ元データを、日付で並べ直して見せるもの。
 * 数え直しや別の保存先を作らないので、一覧とカレンダーで件数がずれない。
 */
export async function publicationCalendarUseCases() {
  const deps = createDeps({ db: await tryGetDb() });
  const calendar = {
    publications: deps.publications,
    connections: deps.channelConnections,
    contentVariants: deps.contentVariants,
    contentPackages: deps.contentPackages,
    events: deps.events,
  };
  return {
    getCalendar: createGetPublicationCalendarUseCase(calendar),
    reschedule: createReschedulePublicationUseCase(calendar),
  };
}

/**
 * 提携と成果の入口。
 *
 * ASP を 1 つ増やすときに触るのは、つなぎ役の実装だけ。
 * ここも画面も、順位づけのコードも変わらない。
 */
export async function affiliateUseCases() {
  // 保存先の接続をここで取る。取らないと、金額を直す操作が見本の上で
  // 成功したように見えて、次に開くと元の額へ戻っている。
  // 文章と違い、数字は見ただけでは戻りに気づけない。
  const deps = createDeps({ db: await tryGetDb() });
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
 * 成果リンク受信箱の入口。
 *
 * 貼り付け・広告主の確定・商品との結びつけ・対象外にする、の 4 つ。
 * 画面のボタンも、AI 向けのツールも、REST も、ここから同じものを取る。
 */
export async function linkInboxUseCases() {
  // 保存先があれば D1、無ければ見本データ。**どちらで動いているかは画面に出す。**
  const deps = createDeps({ db: await tryGetDb() });
  const inbox = {
    inbox: deps.linkInbox,
    programs: deps.affiliatePrograms,
    ids: deps.ids,
    events: deps.events,
  };
  return {
    list: createListLinkInboxUseCase(inbox),
    submit: createSubmitAffiliateUrlUseCase(inbox),
    resolve: createResolveLinkIngestionUseCase(inbox),
    match: createMatchLinkIngestionUseCase(inbox),
    reject: createRejectLinkIngestionUseCase(inbox),
  };
}

/**
 * 受信箱がいま何で動いているかを画面に出すための一文。
 *
 * 保存されるのか、この場限りで消えるのかは、
 * 利用者にとって「使えるかどうか」が変わる違いなので、必ず出す。
 */
export async function linkInboxNotice(): Promise<StorageStatus> {
  const db = await tryGetDb();
  return {
    persisted: db !== null,
    what: "成果リンク受信箱の保存先",
    blockedBy: "link_ingestions テーブルの追加と D1 への接続",
    stubId: "persistence:link-inbox-sample",
    message:
      db === null
        ? sampleLinkInboxNotice()
        : "入れたリンクは保存されます（保存先: D1 の link_ingestions）。",
  };
}

/**
 * 数字の入口。
 *
 * 指標を 1 つ増やすときに触るのは domain の定義表だけ。
 * ここも画面も変わらず、数え方と「使ってよい用途」が同時に付いてくる。
 */
export async function analyticsUseCases() {
  // **接続を渡す。** 渡さないと、計測が D1 に貯まっていても
  // 画面には見本の数字が出続ける（受信箱・改善要望で実際に起きた形）。
  const analytics = { metrics: createDeps({ db: await tryGetDb() }).metrics };
  return {
    listMetrics: createListMetricsUseCase(analytics),
    listUsableMetrics: createListUsableMetricsUseCase(analytics),
    checkFeedback: createCheckFeedbackUseCase(analytics),
    filterMetrics: createFilterMetricsUseCase(analytics),
  };
}

/**
 * 計測の入口。
 *
 * 記録の受け口 (`/api/telemetry`) と AI 利用の画面が同じものを使う。
 * 記録先を差し替えるときに触るのは infrastructure の 1 行だけ。
 */
export async function telemetryUseCases() {
  const deps = { sink: createDeps({ db: await tryGetDb() }).telemetry };
  return {
    aiUsage: createAiUsageReportUseCase(deps),
    explain: createExplainTelemetryUseCase(),
  };
}

/**
 * 計測がいま何で動いているかを画面に出すための一文。
 *
 * 受信箱・改善要望と同じ形（`StorageStatus`）。**画面に条件を書かせない。**
 * ここを画面側の固定文にしていたため、保存先をつないだあとも
 * 「この実行中だけ覚えます」と出続ける事故が起きた（2026-08-17）。
 */
export async function telemetryNotice(): Promise<StorageStatus> {
  const db = await tryGetDb();
  return {
    persisted: db !== null,
    what: "計測の記録先",
    blockedBy: "telemetry_events テーブルの追加と D1 への接続",
    stubId: "persistence:telemetry-memory",
    message:
      db === null
        ? telemetryStubNotice()
        : "読まれた記録は保存されます（保存先: D1 の telemetry_events）。同意が要る記録は 90 日、回数だけの記録は 400 日で消えます。",
  };
}

/**
 * 改善ループの入口。
 *
 * 2 つとも**軸の中身を知らない**。色の実験も構成の実験も同じ道を通る。
 * 軸を 1 つ足したときにここが変わるなら、汎用のループになっていない。
 */
export function improvementUseCases() {
  const deps = { repository: createDeps().improvement };
  return {
    review: createReviewLoopRunsUseCase(deps),
    dimensions: createListImprovementDimensionsUseCase(deps),
  };
}

/** 改善ループの記録先が見本であることを画面に出すための一文。 */
export function improvementNotice(): string {
  return improvementStubNotice();
}

/**
 * 改善要望の入口（2 件目のループ）。
 *
 * 送る・一覧・詳細・状況変更・払い出し・鍵の管理の 6 つ。
 * 画面も REST も バックエンド MCP も、ここと同じユースケースを呼ぶ
 * （道具の一覧は `tools/feedback-tools.ts`）。**入口ごとに組み立て直さない。**
 */
export async function feedbackUseCases() {
  // **接続を渡す。** ここを `createDeps()` のままにすると、組み立て側で
  // D1 を選べるようにしても画面には一生届かず、つないだつもりで
  // 見本データが出続ける。実際にそうなっていた（preview で判明）。
  // 記録先（D1）と写しの置き場（R2）は別の接続。片方だけある環境が実在するので、
  // 両方を渡して、無い側だけが仮置きに落ちるようにする。
  const deps = createDeps({ db: await tryGetDb(), bucket: await tryGetBucket() });
  const feedback = {
    repository: deps.feedback,
    captures: deps.feedbackCaptures,
    ids: deps.ids,
    now: () => new Date(),
  };
  return {
    submit: createSubmitFeedbackUseCase(feedback),
    list: createListFeedbackUseCase({ repository: deps.feedback }),
    read: createReadFeedbackUseCase({
      repository: deps.feedback,
      captures: deps.feedbackCaptures,
    }),
    updateStatus: createUpdateFeedbackStatusUseCase({
      repository: deps.feedback,
      now: feedback.now,
    }),
    handOff: createHandOffFeedbackUseCase({
      repository: deps.feedback,
      templates: deps.handoffTemplates,
      now: feedback.now,
    }),
    keys: createManageIntegrationKeysUseCase({
      keys: deps.integrationKeys,
      ids: deps.ids,
      mintSecret: deps.mintSecret,
      now: feedback.now,
    }),
  };
}

/**
 * 改善要望がいま何で動いているかを画面に出すための一文。
 *
 * 受信箱（`linkInboxNotice`）と同じ形にしてある。保存されるのか、
 * この場限りで消えるのかは、利用者にとって「使えるかどうか」が変わる違いなので、
 * **どちらであっても黙らない**。
 */
export async function feedbackNotice(): Promise<StorageStatus> {
  const db = await tryGetDb();
  return {
    persisted: db !== null,
    what: "改善要望の記録先",
    blockedBy: "feedback_reports / integration_keys テーブルの追加と D1 への接続",
    stubId: "persistence:feedback-memory",
    message:
      db === null
        ? feedbackStubNotice()
        : "届いた要望は保存されます（保存先: D1 の feedback_reports）。",
  };
}

/**
 * 画面の写しがいま何で動いているかを画面に出すための一文。
 *
 * 要望の文章（D1）とは**置き場が違う**ので、お知らせも分けてある。
 * 1 つにまとめると、文章は保存されているのに写しだけ消える環境で、
 * どちらの話をしているのか分からない一文になる。
 */
export async function feedbackCaptureNotice(): Promise<StorageStatus> {
  const bucket = await tryGetBucket();
  return {
    persisted: bucket !== null,
    what: "画面の写しの置き場",
    blockedBy: "R2 バケットへの接続",
    stubId: "storage:feedback-capture-memory",
    message:
      bucket === null
        ? "画面の写しは、この実行中だけ覚える仮置きです。置き場につながっていないため、開くことはできません。"
        : `画面の写しは保存されます（保存先: R2）。${CAPTURE_RETENTION_DAYS} 日を過ぎたものは表示しません。`,
  };
}

/**
 * 生成の仕組みの入口。
 *
 * 3 つは外部に何も問い合わせない（決めごとそのものを読むだけ）。
 * 4 つめの `draft` だけが生成 AI を実際に呼ぶ。
 * どこの提供元を呼ぶかは `src/infrastructure/llm/llm-setup.ts` の 1 行が決めており、
 * ここも画面も、提供元の名前を知らない。
 */
export function generationUseCases() {
  const deps = createDeps();
  return {
    readPlan: createReadGenerationPlanUseCase(),
    checkInput: createCheckGenerationInputUseCase(),
    reviewMaterial: createReviewMaterialUseCase(),
    draft: createDraftContentVariantUseCase({ llm: deps.llm, costs: deps.llmCosts }),
  };
}

/**
 * 18 項目がそろった状態の見本。
 *
 * **見本データ（スタブ）である。** 画面で「そろった状態」を実際に押して
 * 確かめるためだけに置いてある。表示するときは見本であることを併記する。
 */
export function sampleGenerationInputForTrial(): GenerationInput {
  return sampleGenerationInput();
}

/**
 * 設定の入口。
 *
 * 役割を 1 つ増やすときに触るのは domain の権限表だけ。
 * ここも画面も変わらず、新しい役割が一覧に現れる。
 */
export function settingsUseCases() {
  const deps = createDeps();
  const settings = {
    workspaces: deps.workspaces,
    memberships: deps.memberships,
    brands: deps.brands,
    disclosures: deps.disclosures,
    auditLog: deps.auditLog,
  };
  return {
    getOverview: createGetSettingsOverviewUseCase(settings),
    listRoles: createListRolesUseCase(settings),
    listMembers: createListMembersUseCase(settings),
    listBrands: createListBrandsUseCase(settings),
    listDisclosures: createListDisclosuresUseCase(settings),
    listAuditLog: createListAuditLogUseCase(settings),
  };
}

/**
 * ホーム画面の 11 個の数字。
 *
 * ここだけは編集側と商業側の両方の保存先を渡す。
 * 読み取り専用であり、このまとまりは順位づけへは渡らない
 * （順位づけ側が商業のポートを受け取らない型になっている）。
 */
export async function dashboardUseCases() {
  const deps = createDeps({ db: await tryGetDb() });
  return {
    getDashboard: createGetDashboardUseCase({
      contentVariants: deps.contentVariants,
      products: deps.products,
      publications: deps.publications,
      channelConnections: deps.channelConnections,
      linkInbox: deps.linkInbox,
      affiliateLinks: deps.affiliateLinks,
      conversions: deps.conversions,
    }),
  };
}

/** 設定が見本データであることを画面に出すための一文。 */
export function settingsNotice(): string {
  return sampleSettingsNotice();
}

/**
 * 数字がいま何から出ているかを画面に出すための一文。
 *
 * 見本データなのか、実際の計測から導いた数字なのかは、
 * **その数字を信じてよいかが変わる違い**なので必ず出す。
 * 導ける指標が限られていることも、ここで一緒に伝える
 * （画面には「未計測」とだけ出るので、理由がどこにも無いと不具合に見える）。
 */
export async function analyticsNotice(): Promise<StorageStatus> {
  const db = await tryGetDb();
  return {
    persisted: db !== null,
    what: "数字の出どころ",
    blockedBy: "telemetry_events テーブルの追加と D1 への接続",
    stubId: "persistence:analytics-sample",
    message:
      db === null
        ? sampleAnalyticsNotice()
        : "計測の記録は保存されます。数字はその記録から毎回数え直しています（数字自体は貯めません）。いま数えられるのは表示回数・リンククリック数・スクロール到達・滞在時間で、それ以外は「未計測」と出ます。",
  };
}

/** 提携と成果が見本データであることを画面に出すための一文。 */
export function affiliateNotice(): string {
  return sampleAffiliateNotice();
}

/**
 * 提携と成果の画面に出す、いま何で動いているかの説明。
 *
 * **2 つのことを分けて書く。**
 *   1. 手で直した金額が保存されるか（保存先があれば保存される）
 *   2. 成果そのものがまだ見本であること（ASP の申請と接続の登録が要る）
 * 1 が済んだからといって 2 も済んだように読める文にすると、
 * 「本物の売上が出てこない」を故障と誤解させる。
 */
export async function affiliateStorageNotice(): Promise<StorageStatus> {
  const db = await tryGetDb();
  return {
    persisted: db !== null,
    what: "成果の金額の手修正の保存先",
    blockedBy: "各 ASP の利用申請と、ご自身による接続情報の登録",
    stubId: "persistence:affiliate-sample",
    message:
      db === null
        ? sampleAffiliateNotice()
        : "手で直した金額は保存されます（保存先: D1 の affiliate_conversions）。取り込んだ額はそのまま残します。ただし成果そのものはまだ見本で、本物の数字には各 ASP の申請と接続情報の登録が要ります。",
  };
}

/** 見本にある会計期間。画面の期間切り替えに使う。 */
export function affiliatePeriods(): readonly string[] {
  return SAMPLE_PERIODS;
}

/**
 * 配信がいま何で動いているかを画面に出すための一文。
 *
 * ここには**2 つの別の話**が混ざるので、混ぜたまま書かない。
 *   1. 予約したことが保存されるか（保存先の有無。D1 があれば済む）
 *   2. 実際に各サービスへ投稿できるか（利用者ご自身の認証が要る。まだ）
 * 1 が済んだからといって 2 も済んだように読める文にすると、
 * 「予約したのに投稿されない」を故障と誤解させる。両方を必ず書く。
 */
export async function distributionNotice(): Promise<StorageStatus> {
  const db = await tryGetDb();
  return {
    persisted: db !== null,
    what: "配信の予約と出し先の記録の保存先",
    blockedBy: "各サービスの接続設定（利用者ご自身による認証）",
    stubId: "persistence:distribution-sample",
    message:
      db === null
        ? sampleDistributionNotice()
        : "予約・取りやめは保存されます（保存先: D1 の publications）。ただし各サービスへの実際の投稿はまだ行いません（接続の認証が未登録のため）。出し先の一覧に並んでいるのは見本です。",
  };
}

/**
 * 記事の画面に出す、いま何で動いているかの説明。
 *
 * **2 つのことを分けて書く。**
 *   1. 記事の本文と進行の現在地が保存されるか（保存先があれば保存される）
 *   2. 企画と書き手が見本のままであること（作る入口がまだ無い）
 * 1 が済んだからといって 2 も済んだように読める文にすると、
 * 「書き手を増やせない」を故障と誤解させる。
 */
export async function editorialContentNotice(): Promise<StorageStatus> {
  const db = await tryGetDb();
  return {
    persisted: db !== null,
    what: "記事の本文と進行の現在地の保存先",
    blockedBy: "企画・書き手を作る入口（content_packages / personas）",
    stubId: "persistence:content-editorial-sample",
    message:
      db === null
        ? sampleEditorialContentNotice()
        : "進めた段階と承認は保存されます（保存先: D1 の content_variants）。はじめから並んでいる記事は見本で、消さずに残してあります。企画と書き手はまだ見本です（作る入口がないため）。",
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

/**
 * 読者の記録を、**どの作業場所のものとして残すか**を決める。
 *
 * 読者自身はどこにも所属していないが、記録は
 * 「そのブログを運営している人」の数字として読まれる必要がある。
 * ここを `readerActor()`（所属なし）のままにすると、
 * 計測は貯まるのに管理画面には一生出てこない。
 * **貯まっているのに 0 と出る**のは、いちばん切り分けにくい壊れ方になる。
 *
 * URL 名から引けなかったときは所属なしのまま記録する（捨てない）。
 * 捨てると、ブログの設定を直している最中の記録だけが消える。
 */
export async function readerActorForSite(siteSlug: string | null): Promise<ActorContext> {
  const base = readerActor();
  if (siteSlug === null || siteSlug === "") return base;
  // 読者向けのユースケース（`getSite`）は、外へ出せる項目だけを返すので
  // 作業場所を持っていない。ここは組み立ての層なので、保存先を直接引く。
  const found = await createDeps({ db: await tryGetDb() }).sites.findBySlug(siteSlug);
  if (!found.ok || found.value === null) return base;
  return { ...base, workspaceId: found.value.workspaceId };
}

/** 見本データで表示していることを読者向け画面に出すための一文。 */
export function siteSampleNotice(): string {
  return sampleContentNotice();
}

/** ブログ作成の下書きが仮置きの保存先であることを画面に出すための一文。 */
export function siteDraftSampleNotice(): string {
  return sampleSiteDraftNotice();
}

/**
 * ブログ作成の下書きがいま何で動いているかを画面に出すための一文。
 *
 * **画面に条件を書かせない。** 受信箱・改善要望と同じ形にしてある。
 * ここを画面側の固定文にしていたため、保存先をつないだあとも
 * 「しばらくすると消えます」と出続ける事故が起きた（2026-08-17）。
 */
export async function siteDraftNotice(): Promise<StorageStatus> {
  const db = await tryGetDb();
  return {
    persisted: db !== null,
    what: "ブログ作成の下書きの保存先",
    blockedBy: "site_drafts / site_blueprints テーブルの追加と D1 への接続",
    stubId: "persistence:site-draft-memory",
    message:
      db === null
        ? sampleSiteDraftNotice()
        : "作りかけの下書きも、作ったブログも保存されます（保存先: D1 の site_drafts / site_blueprints）。",
  };
}

/**
 * ブログの一覧がいま何で動いているかを画面に出すための一文。
 *
 * 保存先がつながっていても**見本の 3 本は残す**ので、
 * 「並んでいるものの一部は見本」であることは、つながったあとも黙らない。
 */
export async function siteStorageNotice(): Promise<StorageStatus> {
  const db = await tryGetDb();
  return {
    persisted: db !== null,
    what: "ブログの設計図の保存先",
    blockedBy: "site_blueprints テーブルの追加とマイグレーション",
    stubId: "persistence:site-sample",
    message:
      db === null
        ? siteSampleNotice()
        : "作ったブログは保存されます（保存先: D1 の site_blueprints）。はじめから並んでいる 3 本は見本で、消さずに残してあります。",
  };
}

/** 商品の表示名。ID をそのまま画面に出さないための対応表。 */
export function productDisplayName(productId: string): string {
  return sampleProductName(productId as never);
}

/**
 * ブログ作成ウィザードの入口 (§16.2)。
 *
 * **ブログを 1 本増やすのに、コードは 1 行も書かない。**
 * ここで作られるのは設計図のデータだけで、
 * 読者向けの画面 (`/s/<URL名>`) は既存のものをそのまま使う。
 */
export async function siteBuilderUseCases() {
  const deps = createDeps({ db: await tryGetDb() });
  const builder = { drafts: deps.siteDrafts, ids: deps.ids };
  return {
    listDrafts: createListSiteDraftsUseCase(builder),
    getDraft: createGetSiteDraftUseCase(builder),
    startDraft: createStartSiteDraftUseCase(builder),
    saveStep: createSaveSiteDraftStepUseCase(builder),
    createSite: createCreateSiteFromDraftUseCase(builder),
  };
}
