import {
  createArchivePublishedArticleUseCase,
  createGetPublishedArticleUseCase,
  createListPublishedArticlesUseCase,
  createUpdatePublishedArticleUseCase,
} from "@/application/usecases/site/manage-published-articles";
import { createListFailingAuditsUseCase } from "@/application/usecases/seo/list-failing-audits";
import { createGetLatestAiSearchReauditRunUseCase } from "@/application/usecases/seo/get-latest-ai-search-reaudit-run";
import type { RecordAiSearchAuditDeps } from "@/application/usecases/seo/record-ai-search-audit";
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
  createListContactMessagesUseCase,
  createMarkContactHandledUseCase,
} from "@/application/usecases/site/manage-contact";
import {
  createAdvanceContentStateUseCase,
  createApproveContentUseCase,
  createGetContentUseCase,
  createListContentBoardUseCase,
  createListReviewOverdueUseCase,
} from "@/application/usecases/content/manage-content";
import {
  createListContentPackagesUseCase,
  createSaveContentPackageUseCase,
} from "@/application/usecases/authoring/manage-content-packages";
import {
  createCheckFactBoundaryUseCase,
  createGetAudiencePersonaUseCase,
  createGetAuthorPersonaUseCase,
  createListAudiencePersonasUseCase,
  createListAuthorPersonasUseCase,
  createSaveAudiencePersonaUseCase,
  createSaveAuthorPersonaUseCase,
} from "@/application/usecases/authoring/manage-personas";
import {
  allowedCriteriaForForm,
  createListRankingModelsUseCase,
  createSaveRankingModelUseCase,
  createSaveScoreCardUseCase,
} from "@/application/usecases/ranking/manage-rankings";
import {
  CLAIM_TYPE_LABELS,
  EVIDENCE_TYPE_LABELS,
  createSaveClaimUseCase,
  createSaveEvidenceUseCase,
  createSaveTestRunUseCase,
  createSearchEvidenceUseCase,
} from "@/application/usecases/evidence/manage-evidence";
import {
  readPublicArticleBlockOrder,
  readPublicBlogAppearance,
  type PublicBlogAppearance,
} from "@/application/read-models/public-blog-appearance";
import type { Appearance } from "@/domain/authoring/appearance";
import { createGetGenerationMatrixUseCase } from "@/application/usecases/authoring/plan-generation-matrix";
import { createReadWritingMethodUseCase } from "@/application/usecases/authoring/read-writing-method";
import {
  createCancelPublicationUseCase,
  createExportManualDraftUseCase,
  createGetContentChannelStatusUseCase,
  createGetPublicationUseCase,
  createListChannelsUseCase,
  createListPublicationsUseCase,
  createRegisterChannelConnectionUseCase,
  createSchedulePublicationUseCase,
  createUpdatePublicationUseCase,
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
import { createReadTrackingCoverageUseCase } from "@/application/usecases/analytics/read-tracking-coverage";
import { createAiUsageReportUseCase } from "@/application/usecases/analytics/ai-usage-report";
import { createExplainTelemetryUseCase } from "@/application/usecases/analytics/explain-telemetry";
import { createHandOffFeedbackUseCase } from "@/application/usecases/feedback/hand-off-feedback";
import { createListFeedbackUseCase } from "@/application/usecases/feedback/list-feedback";
import { createManageIntegrationKeysUseCase } from "@/application/usecases/feedback/manage-integration-keys";
import { createReadFeedbackUseCase } from "@/application/usecases/feedback/read-feedback";
import { createSubmitFeedbackUseCase } from "@/application/usecases/feedback/submit-feedback";
import { createUpdateFeedbackStatusUseCase } from "@/application/usecases/feedback/update-feedback-status";
import { createReviewLoopRunsUseCase } from "@/application/usecases/improvement/review-loop-runs";
import {
  createApproveVariantSpecUseCase,
  createConcludeLoopRunUseCase,
  createDraftVariantSpecUseCase,
  createRecordLoopObservationUseCase,
  createStartLoopRunUseCase,
  createStopLoopRunUseCase,
} from "@/application/usecases/improvement/run-improvement-loop";
import { createListImprovementDimensionsUseCase } from "@/application/usecases/improvement/list-improvement-dimensions";
import {
  createCheckGenerationInputUseCase,
  createReadGenerationPlanUseCase,
  createReviewMaterialUseCase,
} from "@/application/usecases/generation/read-generation-plan";
import { createDraftContentVariantUseCase } from "@/application/usecases/generation/draft-content-variant";
import { createCapacityGuard } from "@/application/capacity";
import { createListSelectableModelsUseCase } from "@/application/usecases/generation/list-selectable-models";
import type { GenerationInput } from "@/domain/generation";
import { sampleGenerationInput } from "@/infrastructure/persistence/sample/generation-sample-input";
import {
  aspOptions,
  createAdjustConversionUseCase,
  createGetConversionUseCase,
  createListAffiliateAccountsUseCase,
  createListAffiliateProgramsUseCase,
  createListConversionsUseCase,
  createListProductLinksUseCase,
  createSaveAffiliateAccountUseCase,
  createSaveAffiliateProgramUseCase,
} from "@/application/usecases/monetization/manage-affiliate";
import {
  createDisableAffiliateLinkUseCase,
  createListAffiliateLinksUseCase,
} from "@/application/usecases/monetization/manage-affiliate-links";
import { createRegisterAffiliateLinkUseCase } from "@/application/usecases/monetization/register-affiliate-link";
import { createPreviewAffiliateUrlUseCase } from "@/application/usecases/monetization/preview-affiliate-url";
import { createAffiliatePreviewFetcher } from "@/infrastructure/http/affiliate-preview-fetcher";
import {
  createListLinkInboxUseCase,
  createMatchLinkIngestionUseCase,
  createRejectLinkIngestionUseCase,
  createResolveLinkIngestionUseCase,
  createSubmitAffiliateUrlUseCase,
} from "@/application/usecases/monetization/manage-link-inbox";
import {
  createEditDisclosureUseCase,
  createEditPolicyRuleUseCase,
  createListPolicyRulesUseCase,
} from "@/application/usecases/compliance/manage-compliance";
import {
  PLAN_LABEL,
  createGetSettingsOverviewUseCase,
  createListAuditLogUseCase,
  createListBrandsUseCase,
  createListDisclosuresUseCase,
  createListMembersUseCase,
  createListRolesUseCase,
  createManageMembersUseCase,
  createSaveBrandUseCase,
  createUpdateWorkspaceUseCase,
} from "@/application/usecases/identity/manage-workspace";
import {
  createCreateSiteFromDraftUseCase,
  createGetSiteDraftUseCase,
  createListSiteDraftsUseCase,
  createSaveSiteDraftStepUseCase,
  createStartSiteDraftUseCase,
} from "@/application/usecases/site/build-site";
import { createInspectSiteCompositionUseCase } from "@/application/usecases/site/inspect-site-composition";
import {
  createCheckSiteDifferentiationUseCase,
  createGetManagedSiteUseCase,
  createListManagedSitesUseCase,
} from "@/application/usecases/site/manage-sites";
import {
  createListSiteDocumentsUseCase,
  createSaveSiteDocumentUseCase,
} from "@/application/usecases/site/manage-site-documents";
import {
  createDeleteManagedSiteUseCase,
  createUpdateManagedSiteUseCase,
} from "@/application/usecases/site/edit-sites";
import {
  createCreateProductUseCase,
  createDeleteProductUseCase,
  createUpdateProductUseCase,
} from "@/application/usecases/product/edit-product";
import {
  createCreateContentVariantUseCase,
  createDeleteContentVariantUseCase,
  createUpdateContentVariantUseCase,
} from "@/application/usecases/content/edit-content";
import { createCreateConceptDraftsUseCase } from "@/application/usecases/content/concept-drafts";
import {
  createPreparePublishArticleUseCase,
  createAuditArticleDraftUseCase,
  createPublishArticleUseCase,
} from "@/application/usecases/site/publish-article";
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
import { asFeedbackCaptureId, taggedString } from "@/domain/shared";
import { type KeyScope, authorize } from "@/domain/feedback";
import type { StorageStatus } from "@/presentation/ui/patterns/stub-notice";
import { createDeps, createLlmCredentialManagement } from "@/infrastructure/composition";
import { auditDenials } from "@/application/access-denial";
import { ensureFeedbackAccess } from "@/application/usecases/feedback/feedback-access";
import { requestIdOf, withRequestId } from "@/presentation/http/request-id";
import { appContext } from "@/infrastructure/app-context";
import {
  requestOriginFromRequest as resolveRequestOriginFromWebRequest,
  resolveRequestOrigin,
} from "@/infrastructure/http/request-origin";
import {
  createManageLlmCredentialsUseCase,
  type ManageLlmCredentialsInput,
  type ManageLlmCredentialsOutput,
} from "@/application/usecases/generation/manage-llm-credentials";
import type { LlmProviderDescriptor } from "@/application/ports/llm-credential";
import type { UseCase } from "@/application/usecases/usecase";
import {
  auditLogStubNotice,
  createUnavailableAuditLog,
} from "@/infrastructure/persistence/sample/audit-log-sample-repository";
import { telemetryStubNotice } from "@/infrastructure/persistence/sample/telemetry-sample-sink";
import {
  improvementStubBlockedBy,
  improvementStubNotice,
} from "@/infrastructure/persistence/sample/improvement-sample-repository";
import { feedbackStubNotice } from "@/infrastructure/persistence/sample/feedback-sample-repository";
import { sampleContentNotice } from "@/infrastructure/persistence/sample/content-sample-repository";
import { sampleSiteDraftNotice } from "@/infrastructure/persistence/sample/site-draft-sample-repository";
import { getCurrentActor, sampleActorNotice } from "@/infrastructure/identity/sample-actor";
import {
  SESSION_COOKIE_NAME,
  selectAdminReadActor,
  type ActorResolution,
} from "@/infrastructure/identity/session-actor";
import { sampleEditorialContentNotice } from "@/infrastructure/persistence/sample/content-editorial-sample-repository";
import { sampleDistributionNotice } from "@/infrastructure/persistence/sample/distribution-sample-repository";
import {
  SAMPLE_PERIODS,
  sampleAffiliateNotice,
} from "@/infrastructure/persistence/sample/affiliate-sample-repository";
import {
  createSampleArticleRatingPort,
} from "@/infrastructure/persistence/sample/blog-ops-sample-repository";
import { sampleAnalyticsNotice } from "@/infrastructure/persistence/sample/analytics-sample-repository";
import { sampleLinkInboxNotice } from "@/infrastructure/persistence/sample/link-inbox-sample-repository";
import {
  type ManageGuidelineReferencesInput,
  type ManageGuidelineReferencesOutput,
  createManageGuidelineReferencesUseCase,
} from "@/application/usecases/seo/manage-guideline-references";
import { createD1GuidelineReferenceRepository } from "@/infrastructure/persistence/d1/guideline-reference-repository";
import {
  recordIndexNowOutcome,
  type RecordedIndexNowOutcome,
} from "@/application/seo/indexnow-outcome-audit";
import {
  type BlogAppearanceView,
  type ManageBlogAppearanceInput,
  createManageBlogAppearanceUseCase,
} from "@/application/usecases/authoring/manage-blog-appearance";
import {
  type BlogPlacementsView,
  type ReviewBlogPlacementsInput,
  createReviewBlogPlacementsUseCase,
} from "@/application/usecases/authoring/review-blog-placements";
// ブログ運営コンソール (arch-blog-operations-console) の 4 層。
// 住所層 → 観測層 → 改善層 の順に並べてある。提示層はこのファイル自身。
import {
  type BlogDomainsView,
  type ManageCustomDomainsInput,
  createManageCustomDomainsUseCase,
} from "@/application/usecases/blog-ops/manage-custom-domains";
import {
  type BlogAudienceView,
  type ReadBlogAudienceInput,
  createReadBlogAudienceUseCase,
} from "@/application/usecases/blog-ops/read-blog-audience";
import {
  type RecordReaderInteractionsInput,
  type RecordReaderInteractionsResult,
  createRecordReaderInteractionsUseCase,
} from "@/application/usecases/blog-ops/record-reader-interactions";
import {
  type RebuildDailyMetricsInput,
  type RebuildDailyMetricsView,
  createRebuildDailyMetricsUseCase,
} from "@/application/usecases/blog-ops/rebuild-daily-metrics";
import {
  type BlogRevenueView,
  type ReadBlogRevenueInput,
  createReadBlogRevenueUseCase,
} from "@/application/usecases/blog-ops/read-blog-revenue";
import {
  type ManageSeoAssessmentInput,
  type SeoAssessmentView,
  createManageSeoAssessmentUseCase,
} from "@/application/usecases/blog-ops/manage-seo-assessment";
import {
  type AeoAnswersView,
  type ManageAeoAnswersInput,
  createManageAeoAnswersUseCase,
} from "@/application/usecases/blog-ops/manage-aeo-answers";
import { createD1CustomDomainRepository } from "@/infrastructure/persistence/d1/custom-domain-repository";
import { createCloudflareCustomHostnameProvider } from "@/infrastructure/domains/cloudflare-custom-hostname";
import {
  createD1BlogAudienceRepository,
  createD1BlogRevenueRepository,
  createD1MetricsRollup,
  createD1ReaderInteractionIntake,
} from "@/infrastructure/persistence/d1/reader-metrics-repository";
import {
  createD1AeoProfileRepository,
  createD1AnswerUnitRepository,
  createD1SeoAssessmentRepository,
} from "@/infrastructure/persistence/d1/seo-assessment-repository";
import {
  createAnswerUnitExtractor,
  createArticleSeoAnalyzer,
  createSeoFixDrafter,
} from "@/infrastructure/improvement";
import { createD1BlogAppearanceRepository } from "@/infrastructure/persistence/d1/blog-appearance-repository";
import { createD1BlogAffiliatePlacementRepository } from "@/infrastructure/persistence/d1/blog-affiliate-placement-repository";
import { tryGetDb } from "@/infrastructure/persistence/d1/connection";
import {
  createD1ArticleRatingPort,
} from "@/infrastructure/persistence/d1/blog-ops-repository";
import {
  createCreateBlogArticleUseCase,
  createCreateSiteNetworkNodeUseCase,
  createDeleteBlogArticleUseCase,
  createDeleteBlogTagUseCase,
  createDeleteSiteNetworkNodeUseCase,
  createEvaluateBlogArticlesUseCase,
  createGetBlogArticleUseCase,
  createListBlogArticlesUseCase,
  createListDeletedBlogArticlesUseCase,
  createListBlogTagsUseCase,
  createListSiteNetworkUseCase,
  createListDeletedSiteNetworkUseCase,
  createReadBlogLayoutUseCase,
  createSaveBlogLayoutBandUseCase,
  createSaveBlogLayoutSlotUseCase,
  createSaveBlogTagUseCase,
  createCheckBlogDeliveryUseCase,
  createSaveDeliveryPartUseCase,
  createListArticleRatingsUseCase,
  createSetArticleRatingHiddenUseCase,
  createRestoreBlogArticleUseCase,
  createRestoreSiteNetworkNodeUseCase,
  createSubmitArticleRatingUseCase,
  createUpdateBlogArticleUseCase,
  createUpdateSiteNetworkNodeUseCase,
} from "@/application/usecases/blog-ops";
import { tryGetBucket } from "@/infrastructure/platform/bucket-connection";
import { submitToIndexNow } from "@/infrastructure/indexnow/indexnow-client";
import { CAPTURE_RETENTION_DAYS } from "@/domain/feedback";
import type { ArticleRatingPort, PublicBlogPort } from "@/application/ports/blog-ops";
import {
  readPublicSiteComposition,
  type PublicProjectionEntry,
} from "@/presentation/site/public-site-projection";
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
  // 渡すものを名前で書く。`createDeps(context)` と書くと、
  // 何を渡したかが呼び出し側から読めなくなり、検査も人も追えない。
  const context = await appContext();
  return buildToolCatalog(createDeps({ db: context.db, env: context.env }));
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

/**
 * 連携の鍵を載せる見出し。
 *
 * `Authorization` と分けてあるのは、**1 つの呼び出しが 2 つの別のことを
 * 名乗る必要がある**ため。`Authorization: Bearer <MCP_TOKEN>` は
 * 「この入口を叩いてよい相手か」（門）、`X-Integration-Key` は
 * 「どの作業場所の誰か」（身元）である。見出しが 1 つしかないと、
 * MCP の入口では門しか名乗れず、身元が決まらないまま管理用のデータが出る
 * ことになる（それが `ah-p9e` の穴だった）。
 *
 * 鍵だけで来る既存の入口（`/api/feedback/pending`）のために、
 * `Authorization: Bearer <鍵>` も引き続き受ける。
 */
export const INTEGRATION_KEY_HEADER = "x-integration-key";

/** 呼び出しに載っている連携の鍵の平文。無ければ空文字。 */
function integrationKeyValue(request: Request): string {
  const dedicated = request.headers.get(INTEGRATION_KEY_HEADER)?.trim() ?? "";
  if (dedicated !== "") return dedicated;
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

export async function resolveIntegrationAccess(
  request: Request,
  scope: KeyScope,
): Promise<IntegrationAccessResolution> {
  const value = integrationKeyValue(request);
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
      // 連携鍵は membership 由来ではない。ブランド操作権限も持たない。
      scopedBrandIds: [],
      isAiServiceAccount: true,
      // 誰もログインしていないが、**どの鍵か**は照合してある。
      // だから記録に「鍵: ○○」と残してよい。人ではないことは
      // `isAiServiceAccount` の側が持っている。
      identified: true,
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
    const { createD1MembershipReader } = await import(
      "@/infrastructure/identity/membership-reader"
    );
    return await createSessionActorResolver({
      sessions: createD1SessionReader(db),
      // 権限は**本物の登録**から引く。ここを見本のままにすると、
      // ログインが成立しても全員が見本の役割で動く。
      memberships: createD1MembershipReader(db),
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
  const actor = selectAdminReadActor(resolved, await getCurrentActor());
  if (actor === null) {
    // 有効な session の利用者が担当から外れた／membership を確認できない場合に、
    // SAMPLE_ACTOR へ落として管理データを読み続けない。signin 側は currentActor を
    // 呼ばないため、ここから戻しても循環しない。
    const { redirect } = await import("next/navigation");
    redirect("/signin");
    throw new Error("redirect did not terminate");
  }
  return withRequestId(actor, await currentRequestId());
}

/**
 * いま処理している要求を指す名前を、見出しから取り出す。
 *
 * 画面の側（Server Action・サーバーで組み立てる画面）には `Request` が
 * 渡ってこないので、`next/headers` から取る。取れない場所（テスト・組み立て時）は
 * `null` になる。**そこで作らない**理由は `request-id.ts` に書いてある。
 */
async function currentRequestId(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    return requestIdOf(await headers());
  } catch {
    return null;
  }
}

/** Next Server Component / Server Action の見出しを request-origin の純規則へ写す。 */
export async function requestOriginFromNextHeaders(): Promise<string | null> {
  const { headers } = await import("next/headers");
  const requestHeaders = await headers();
  return resolveRequestOrigin({
    host: requestHeaders.get("host"),
    forwardedHost: requestHeaders.get("x-forwarded-host"),
    forwardedProtocol: requestHeaders.get("x-forwarded-proto"),
    defaultProtocol: "https",
  });
}

/** Web Request の薄い adapter も、presentation からはこの composition 境界を通す。 */
export function requestOriginFromWebRequest(request: Request): string | null {
  return resolveRequestOriginFromWebRequest(request);
}

/**
 * **ログインできている人だけ**を返す。できていなければ `null`。
 *
 * `currentActor()` との違いは、**戻り先が無いこと**である。
 * あちらは画面を動かし続けるために見本の身元へ落ちるが、その落とし方は
 * 「画面を組み立てる」ためのもので、**中身を外へ渡す口に使ってはいけない**。
 * 使うと、ログインしていない人が見本の権限のまま他人の画面の写しを開ける
 * （実際にそうなっていた。残課題 28 / `ah-3n1`）。
 *
 * 判断の分かれ目はこうである。
 *   - 画面を**組み立てる**    → `currentActor()`（見本で動かして、断りを画面に出す）
 *   - 保存された中身を**渡す** → `signedInActor()`（ログインしていなければ渡さない）
 *
 * `unavailable`（保存先に届かない）も `null` にする。**確かめられないときは渡さない。**
 * ここで「たぶん本人だろう」と通すと、保存先を落とせば認証を外せることになる。
 */
export async function signedInActor(): Promise<ActorContext | null> {
  const resolved = await resolveActor();
  if (resolved.kind !== "actor") return null;
  return withRequestId(resolved.actor, await currentRequestId());
}

/** capture IDから要望をserver-sideで逆引きし、workspace所有とbrand scopeを確認する。 */
export async function canReadFeedbackCapture(
  actor: ActorContext,
  captureId: string,
): Promise<boolean> {
  try {
    const deps = createDeps({ db: await tryGetDb() });
    const findByCaptureId = deps.feedback.findByCaptureId;
    const found = await findByCaptureId(actor.workspaceId, asFeedbackCaptureId(captureId));
    if (!found.ok || found.value === null) return false;
    return ensureFeedbackAccess(actor, found.value).ok;
  } catch {
    return false;
  }
}

/**
 * API の入口（`/api/tools` と `/api/mcp`）が使う身元を、**呼び出し元の種類から決める**。
 *
 * `api-token.ts` には、同一サイトからの呼び出しは
 * 「公開ページと同じ読み取り範囲を許すだけのもの」と書いてある。
 * ところが入口は `currentActor()` を呼んでいたため、ログインしていない人が
 * **見本の身元**（researcher / writer / reviewer / analyst / feedback_admin）で
 * 管理用の読み取りを通せていた。書いてある意図と、効いていた範囲がずれていた
 * （残課題 28 の 2 件目 / `ah-2ro`。原因は `ah-3n1` と同じ）。
 *
 * 決め方はこうである。
 *   - `bearer`      → 連携の鍵（`X-Integration-Key`）から**作業場所つきの身元**を組み立てる。
 *                     鍵が無い・通らないときは**読者**へ落とす
 *   - `same-origin` → ログインできていればその人、できていなければ**読者**
 *
 * `bearer` を `currentActor()` にしていたのが `ah-p9e` である。
 * `MCP_TOKEN` は「呼んでよい相手か」しか決めない。**どの作業場所の誰か**を
 * 決めないので `currentActor()` は見本へ落ち、身元の分からない呼び出しが
 * 見本の権限で管理用のデータを読めていた。門（`MCP_TOKEN`）と
 * 身元（連携の鍵）は別のものなので、名乗る見出しも分けてある。
 *
 * 鍵が通らないときに**断らずに読者へ落とす**のは、`actorForScope` が
 * 身元を返す関数で、断りを返せないため。管理用の読み取りは読者の身元では
 * 通らない（`FORBIDDEN` になる）ので、結果は「断られる」と同じである。
 * ここで見本へ落とすことだけはしない。それが 3 件の課題の共通の原因だった。
 *
 * 同一サイトを丸ごと断らないのは、読者ページの AI 向けの入口（WebMCP）が
 * この経路を使っているため。断ると、読者ページの案内が**黙って**動かなくなる。
 * 読者へ落とすぶんには、読者ページの画面がもともと通している範囲と同じになる。
 */
export async function actorForScope(
  scope: "bearer" | "same-origin",
  request: Request,
): Promise<ActorContext> {
  // 糸は**要求そのもの**から取る。API の入口にはここで `Request` が届いている。
  const requestId = requestIdOf(request.headers);
  if (scope === "bearer") {
    // 門を通ったこと（`MCP_TOKEN`）は、身元の根拠にならない。
    // 鍵が載っていなければ、鍵の照合そのものを試みない。
    if ((request.headers.get(INTEGRATION_KEY_HEADER)?.trim() ?? "") === "")
      return withRequestId(readerActor(), requestId);
    const access = await resolveIntegrationAccess(request, "read");
    return withRequestId(access.ok ? access.actor : readerActor(), requestId);
  }
  return withRequestId((await signedInActor()) ?? readerActor(), requestId);
}

/** いまどの身元で動いているかを画面に出すための一文。 */
export async function actorNotice(): Promise<string> {
  const resolved = await resolveActor();
  switch (resolved.kind) {
    case "actor":
      return "ログイン中の情報で表示しています。";
    case "not_member":
      return "ログインはできていますが、この作業場所の担当者として登録されていないため、管理情報は表示しません。";
    case "unavailable":
      return `ログイン状態を確認できませんでした（${resolved.reason}）。確認できるまで管理情報は表示しません。`;
    case "anonymous":
      return sampleActorNotice();
  }
}

/**
 * 読者のページに載せる、AI 向けの操作宣言（WebMCP）。
 *
 * 4 つの決まりをここで守る。守る場所を 1 箇所にしないと、ページごとにずれる。
 *   1. 表に名前があるものだけ（`PAGE_TOOLS`。`toWebMcpDescriptors` が絞る）。
 *      道具定義の `readOnly` は根拠にしない。旗を根拠にすると既定が「載る」になる
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

/**
 * 順位の画面が使う入口。型が付いているので、戻り値をキャストせずに描ける。
 *
 * **保存先の接続を渡す。** 渡していなかった頃は、評価基準を作っても
 * 点を入れても、順位の画面はいつも見本の 1 件で計算していた。
 * 画面は正常に見えるので、直したつもりのまま何も変わらない。
 */
export async function rankingTool(): Promise<ToolDefinition<RankProductsInput, RankingResult>> {
  return rankProductsTool(createDeps({ db: await tryGetDb() }));
}

/**
 * 順位づけの基準と点の管理の入口。
 *
 * **順位を見る入口（`rankingTool()`）とは別に置く。** あちらは
 * 「決めた測り方で並べる」操作で、こちらは測り方そのものを決める操作。
 * 混ぜると、順位を見に来た人が測り方を書き換えられる画面になる。
 */
export async function rankingUseCases() {
  const deps = createDeps({ db: await tryGetDb() });
  const ranking = {
    rankingModels: deps.rankingModels,
    scoreCards: deps.scoreCards,
    products: deps.products,
    evidence: deps.evidence,
    ids: deps.ids,
    auditLog: deps.auditLog,
    now: () => new Date(),
  };
  return auditDenials(deps, {
    listModels: createListRankingModelsUseCase(ranking),
    saveModel: createSaveRankingModelUseCase(ranking),
    saveScoreCard: createSaveScoreCardUseCase(ranking),
  });
}

/**
 * 根拠・言えること・検証記録の登録と参照。
 *
 * 3 つを 1 つの入口から返すのは、**どれか 1 つだけでは意味を持たない**から。
 * 別々の入口にすると、根拠だけ本物・主張は見本、のような中途の組み方が
 * 型の上で作れてしまい、画面から見ると正常に動いているように見える。
 */
export async function evidenceUseCases() {
  const deps = createDeps({ db: await tryGetDb() });
  const evidence = {
    evidence: deps.evidence,
    claims: deps.claims,
    testRuns: deps.testRuns,
    products: deps.products,
    memberships: deps.memberships,
    ids: deps.ids,
    auditLog: deps.auditLog,
    now: () => new Date(),
  };
  return auditDenials(deps, {
    searchEvidence: createSearchEvidenceUseCase(evidence),
    saveEvidence: createSaveEvidenceUseCase(evidence),
    saveClaim: createSaveClaimUseCase(evidence),
    saveTestRun: createSaveTestRunUseCase(evidence),
  });
}

/**
 * 登録の欄に並べる種類。
 *
 * domain の一覧（`EVIDENCE_TYPE_LABELS` / `CLAIM_TYPE_LABELS`）から作る。
 * 画面へ書き写すと、種類を足した日に**古い選択肢だけが残った画面**ができる。
 */
export function evidenceTypeOptions(): readonly { key: string; label: string }[] {
  return Object.entries(EVIDENCE_TYPE_LABELS).map(([key, label]) => ({ key, label }));
}

export function claimTypeOptions(): readonly { key: string; label: string }[] {
  return Object.entries(CLAIM_TYPE_LABELS).map(([key, label]) => ({ key, label }));
}

/**
 * ブランドの欄に並べる文体と言葉づかい、作業場所の欄に並べる契約の区分。
 *
 * `PLAN_LABEL` は application 側が持つ。画面へ書き写すと、
 * 区分を足した日に**選べない区分が上限の表にだけ出る**状態ができる。
 * 文体と言葉づかいは domain の型（`BrandVoice`）が持つ 2 択・3 択で、
 * 型に無い値を選ばせないために、ここで 1 度だけ日本語を当てる。
 */
export function brandPolitenessOptions(): readonly { key: string; label: string }[] {
  return [
    { key: "polite", label: "です・ます（敬体）" },
    { key: "plain", label: "だ・である（常体）" },
  ];
}

export function brandVocabularyOptions(): readonly { key: string; label: string }[] {
  return [
    { key: "plain", label: "やさしい言葉（専門語を避ける）" },
    { key: "mixed", label: "ふつう（専門語は説明を添える）" },
    { key: "technical", label: "専門的（読者は詳しい前提）" },
  ];
}

export function workspacePlanOptions(): readonly { key: string; label: string }[] {
  return Object.entries(PLAN_LABEL).map(([key, label]) => ({ key, label }));
}

/** 評価基準の欄に並べる指標。domain の許可一覧から作る（画面に書き写さない）。 */
export function rankingCriteriaOptions(): readonly { key: string; label: string }[] {
  return allowedCriteriaForForm().map((c) => ({ key: String(c.key), label: c.label }));
}

export type RankingScreenTarget = {
  readonly modelId: string;
  readonly productIds: readonly string[];
  /** 切り替えの選択肢。1 件しか無いときは画面が切り替え欄を出さない。 */
  readonly models: readonly { readonly modelId: string; readonly label: string }[];
  /** 商品 ID → 表示名。見本の名前しか知らない `productDisplayName` の代わり。 */
  readonly productNames: Readonly<Record<string, string>>;
  /** 順位を出せないときの理由。空表を黙って出さないため。 */
  readonly emptyReason: string | null;
};

/**
 * 順位の画面が表示する対象。
 *
 * **保存された評価基準と、保存された商品から決める。**
 * 以前はここが見本の評価方法 1 つと見本の商品 4 つの決め打ちで、
 * 商品をいくつ登録しても順位に 1 件も現れなかった。しかも画面は
 * 「順位が出ている」ように見えるので、登録した人からは壊れて見えない。
 *
 * 知らない基準 ID を渡されたら断らずに先頭へ落とす。URL を手で触った人が
 * 「表が出ない」ではなく「別の基準の順位が出ている」で気づけるほうが早い。
 */
export async function rankingScreenTarget(requestedModelId?: string): Promise<RankingScreenTarget> {
  const actor = await currentActor();
  const [models, products] = await Promise.all([
    (await rankingUseCases()).listModels.execute(actor, {}),
    // 上限を置く。順位は「絞ってから並べる」もので、登録した全商品を
    // 毎回採点対象にすると、点の無い商品が選外として延々と並ぶ。
    (await productUseCases()).filterProducts.execute(actor, { limit: 50 }),
  ]);

  const modelItems = models.ok ? models.value.items : [];
  const selected =
    modelItems.find((m) => m.modelId === requestedModelId) ?? modelItems[0] ?? null;
  const productItems = products.ok ? products.value.items : [];

  const productNames: Record<string, string> = {};
  for (const p of productItems) productNames[p.productId] = `${p.brand} ${p.name}`.trim();

  return {
    modelId: selected?.modelId ?? String(SAMPLE_MODEL_ID),
    productIds:
      productItems.length > 0
        ? productItems.map((p) => p.productId)
        : SAMPLE_PRODUCTS.map((p) => String(p.id)),
    models: modelItems.map((m) => ({
      modelId: m.modelId,
      label: `${m.audience}向け・${m.version}`,
    })),
    productNames,
    /*
     * 「読めなかった」と「1 件も無い」を同じ文にしない。
     *
     * 権限が足りずに商品の一覧を読めなかった人へ「商品がまだ登録されていません」と
     * 出すと、その人は**登録しようとして**、また断られる。原因が権限だと
     * 分かる文なら、担当者へ頼むという次の一手がその場で選べる。
     */
    emptyReason: !models.ok
      ? "評価基準を読める権限がありません。管理者に頼んでください。"
      : !products.ok
        ? "商品の一覧を読める権限がないため、見本の商品で表示しています。実際の順位は管理者に頼んでください。"
        : selected === null
          ? "評価基準がまだありません。どう測るかを決めないと順位は出せません。"
          : productItems.length === 0
            ? "商品がまだ登録されていません。見本の商品で表示しています。"
            : null,
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
  return auditDenials(deps, {
    getSite: createGetSiteUseCase(site),
    listSites: createListSitesUseCase(site),
    listRecent: createListRecentArticlesUseCase(site),
    listByCategory: createListByCategoryUseCase(site),
    getArticle: createGetArticleUseCase(site),
    search: createSearchArticlesUseCase(site),
    getPerson: createGetPersonUseCase(site),
    listCorrections: createListCorrectionsUseCase(site),
    getPolicy: createGetPolicyDocumentUseCase(site),
  });
}

/**
 * 読者が自分で操作するもの（気になる商品・診断・問い合わせ）。
 *
 * 画面も REST も WebMCP もここから取る。入口ごとに組み立て直さない。
 */
export async function readerUseCases() {
  const context = await appContext();
  const deps = createDeps({ db: context.db, env: context.env });
  const reader = {
    shortlist: deps.shortlist,
    readerTools: deps.readerTools,
    contact: deps.contact,
    contactRateLimitKeys: deps.contactRateLimitKeys,
    sites: deps.sites,
    humanCheck: deps.humanCheck,
  };
  return auditDenials(deps, {
    listShortlist: createListShortlistUseCase(reader),
    saveToShortlist: createSaveToShortlistUseCase(reader),
    removeFromShortlist: createRemoveFromShortlistUseCase(reader),
    getReaderTool: createGetReaderToolUseCase(reader),
    listReaderTools: createListReaderToolsUseCase(reader),
    runReaderTool: createRunReaderToolUseCase(reader),
    submitContact: createSubmitContactUseCase(reader),
  });
}

/**
 * 届いた問い合わせを運営者が読む側。
 *
 * `readerUseCases()` と分けているのは権限の有無が違うから。
 * 送るのは誰でもできる。読むのは `feedback.read` を持つ人だけ。
 */
export async function contactUseCases() {
  const deps = createDeps({ db: await tryGetDb() });
  const contact = {
    contact: deps.contact,
    sites: deps.sites,
    ids: deps.ids,
    auditLog: deps.auditLog,
  };
  return auditDenials(deps, {
    list: createListContactMessagesUseCase(contact),
    markHandled: createMarkContactHandledUseCase(contact),
  });
}

/**
 * 商品・根拠の入口（編集部向け）。
 *
 * 画面・REST・WebMCP・MCP が呼ぶのは**同じこの 8 つ**。
 * `src/presentation/tools/product-tools.ts` も同じユースケースを載せているので、
 * 画面に出る内容と AI が返す内容がずれない。
 */
export async function productUseCases() {
  /*
    接続を渡す。渡さないと、`productEditingUseCases()` で登録した商品が
    読む側には見えない。**書けるのに読めない**という、一番気づきにくい壊れ方をする。
    登録した本人は登録できたと思い、一覧を開いて「消えた」と受け取る。
  */
  const deps = createDeps({ db: await tryGetDb() });
  const product = {
    products: deps.products,
    claims: deps.claims,
    evidence: deps.evidence,
    testRuns: deps.testRuns,
    rankingModels: deps.rankingModels,
    scoreCards: deps.scoreCards,
  };
  return auditDenials(deps, {
    getProduct: createGetProductUseCase(product),
    filterProducts: createFilterProductsUseCase(product),
    compareProducts: createCompareProductsUseCase(product),
    findAlternatives: createFindAlternativesUseCase(product),
    getEvidence: createGetEvidenceUseCase(product),
    listTestRuns: createListTestRunsUseCase(product),
    explainRanking: createExplainRankingUseCase(product),
  });
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
    policyRules: deps.policyRules,
    auditLog: deps.auditLog,
    ids: deps.ids,
    events: deps.events,
    publications: deps.publications,
    articles: deps.publishedArticles,
  };
  return auditDenials(deps, {
    listBoard: createListContentBoardUseCase(content),
    getContent: createGetContentUseCase(content),
    listReviewOverdue: createListReviewOverdueUseCase(content),
    advanceState: createAdvanceContentStateUseCase(content),
    approve: createApproveContentUseCase(content),
  });
}

/** 公開後の記事を訂正・非表示化する管理画面の入口。 */
export async function publishedArticleAdminUseCases() {
  const deps = createDeps({ db: await tryGetDb() });
  const read = { articles: deps.publishedArticleAdmin };
  const write = {
    ...read,
    auditLog: deps.auditLog,
    ids: deps.ids,
    now: () => new Date(),
  };
  return {
    list: createListPublishedArticlesUseCase(read),
    get: createGetPublishedArticleUseCase(read),
    update: createUpdatePublishedArticleUseCase(write),
    archive: createArchivePublishedArticleUseCase(write),
    // 公開済み一覧と同じ入口に置く。落ちている記事は「別の画面で見るもの」ではなく、
    // 公開した記事そのものの状態なので、一覧を開いた人がそのまま気づけるようにする。
    listFailingAudits: createListFailingAuditsUseCase({
      history: deps.aiSearchAuditHistory,
    }),
    // 記事ごとの最新判定とは別に、定期処理そのものが完了したかを見せる。
    // workspace は usecase が actor から解き、画面入力では指定させない。
    getLatestReauditRun: createGetLatestAiSearchReauditRunUseCase({
      runs: deps.aiSearchReauditRuns,
    }),
  };
}

/**
 * AI 検索点検の履歴を残すための道具立て。
 *
 * usecase を返さず deps をそのまま返す。`recordAiSearchAudit` は actor を取らない
 * 後始末の手続きで、`UseCase` の形（actor を第 1 引数に取る）に当てはまらない。
 * 無理に合わせると、cron 側で偽の actor を作ることになる。
 */
export async function aiSearchAuditDeps(): Promise<RecordAiSearchAuditDeps> {
  const deps = createDeps({ db: await tryGetDb() });
  return {
    history: deps.aiSearchAuditHistory,
    ids: deps.ids,
    now: () => new Date(),
  };
}

/**
 * 書き手と読者像の入口。
 *
 * **記事を作る前に決めるもの。** 誰の立場で、誰に向けて書くかが決まらないと、
 * 比較の観点も、使ってよい言い回しも決まらない。
 */
export async function personaUseCases() {
  // 保存先の接続をここで取る。**取らないと本物の保存先へ届かない。**
  // `createDeps()` を db 無しで呼ぶと、書き手の保存先は見本のまま固定され、
  // 登録が成功したように見えて次に開くと消えている。
  const app = createDeps({ db: await tryGetDb() });
  const personas = {
    personas: app.personas,
    ids: app.ids,
    auditLog: app.auditLog,
    now: () => new Date(),
  };
  return auditDenials(app, {
    listAuthors: createListAuthorPersonasUseCase(personas),
    getAuthor: createGetAuthorPersonaUseCase(personas),
    listAudiences: createListAudiencePersonasUseCase(personas),
    getAudience: createGetAudiencePersonaUseCase(personas),
    checkFactBoundary: createCheckFactBoundaryUseCase(personas),
    saveAuthor: createSaveAuthorPersonaUseCase(personas),
    saveAudience: createSaveAudiencePersonaUseCase(personas),
  });
}

/**
 * 書き方の決めごとの入口。
 *
 * 節の並びや文体を 1 つ変えるときに触るのは domain の定義だけ。
 * 画面・AI 向けの道具・生成の指示文が同じ定義を見る。
 */
export function writingMethodUseCases() {
  const app = createDeps();
  return auditDenials(app, {
    readMethod: createReadWritingMethodUseCase(),
  });
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
  return auditDenials(deps, {
    getMatrix: createGetGenerationMatrixUseCase(matrix),
  });
}

/**
 * 企画（記事を何本も生む親）の入口。
 *
 * **記事の入口（`contentUseCases()`）とは別に置く。** あちらは 1 本の記事を
 * 進める操作で、こちらは「どの商品を・誰が・誰に向けて・何のために」という
 * 記事より前の決めごと。同じ入口に混ぜると、記事を 1 本作る操作と
 * 企画を立てる操作の区別が画面から消える。
 */
export async function contentPackageUseCases() {
  // 保存先の接続をここで取る。取らないと、立てた企画が
  // 次に開いたときには消えている。
  const app = createDeps({ db: await tryGetDb() });
  const packages = {
    packages: app.contentPackages,
    personas: app.personas,
    brands: app.brands,
    products: app.products,
    ids: app.ids,
    auditLog: app.auditLog,
    now: () => new Date(),
  };
  return auditDenials(app, {
    listPackages: createListContentPackagesUseCase(packages),
    savePackage: createSaveContentPackageUseCase(packages),
  });
}

/**
 * 見本データで開く企画。マトリクス画面の初期表示に使う。
 *
 * **記事を作る画面はもうこれを使っていない。** 使っていた頃は、作られる記事が
 * すべてこの 1 件にぶら下がり、「どの企画の記事か」の答えが全部同じになっていた。
 * 今は `/admin/content/packages` で選んだ企画が渡る。
 */
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
  // 環境も一緒に渡す。`db` だけ渡すと住所の基底ドメインが `null` になり、
  // この画面だけ「サブドメインは未設定です」と言い続ける。
  const app = createDeps(await appContext());
  const publicEntry = publicProjectionEntry(app.publicBlogSource, app.publicBlog);
  const sites = { sites: app.sites };
  return auditDenials(app, {
    listSites: createListManagedSitesUseCase(sites),
    getSite: createGetManagedSiteUseCase(sites),
    checkDifferentiation: createCheckSiteDifferentiationUseCase(sites),
    // 設計図（`getSite`）と対にする「実際に置かれているか」の口。
    // 同じ入口から取るのは、片方だけ別の保存先を向くのを防ぐため。
    inspectComposition: createInspectSiteCompositionUseCase({
      readComposition: (siteSlug) => readPublicSiteComposition(siteSlug, publicEntry),
      siteBaseDomain: app.siteBaseDomain,
    }),
  });
}

/**
 * 商品を人の手で登録する・直す・消す入口。
 *
 * 読む側の `productUseCases()` と分けているのは `product-tools.ts` と同じ理由で、
 * **参照の数え方が違う**ため。読むほうは根拠と順位が要り、書くほうが要るのは
 * 「この商品を使っている記事が何本あるか」だけである。
 *
 * こちらだけ `tryGetDb()` を通しているのは、登録した商品が
 * 次に開いたときに消えていては登録した意味が無いため。
 */
export async function productEditingUseCases() {
  const deps = createDeps({ db: await tryGetDb() });
  const editing = {
    products: deps.products,
    packages: deps.contentPackages,
    auditLog: deps.auditLog,
    ids: deps.ids,
  };
  return auditDenials(deps, {
    create: createCreateProductUseCase(editing),
    update: createUpdateProductUseCase(editing),
    remove: createDeleteProductUseCase(editing),
  });
}

/**
 * 記事の枠を作る・直す・消す入口。
 *
 * 盤面を読む `contentUseCases()` とは別に置く。あちらは段階を進める操作で、
 * こちらは中身を書き換える操作である。**承認が外れるのはこちらだけ**で、
 * 同じ入口にすると「進めたつもりが承認を外していた」が起きる。
 */
export async function contentEditingUseCases() {
  const deps = createDeps({ db: await tryGetDb() });
  const editing = {
    variants: deps.contentVariants,
    packages: deps.contentPackages,
    auditLog: deps.auditLog,
    ids: deps.ids,
  };
  return auditDenials(deps, {
    create: createCreateContentVariantUseCase(editing),
    update: createUpdateContentVariantUseCase(editing),
    remove: createDeleteContentVariantUseCase(editing),
    // ブログ別の書き分けは、1 本ずつ作る操作の上に載っている。
    // 同じつなぎ目から取るのは、片方だけ別の保存先を向くのを防ぐため。
    createConceptDrafts: createCreateConceptDraftsUseCase(editing),
  });
}

/**
 * ブログの設計図を直す・取り下げる入口。
 *
 * 読む `platformUseCases()` より依存が多い。書くのは登録の窓口 (`drafts`) で、
 * 取り下げの前に `publishedContent` で残っている記事を数えるため。
 */
export async function siteEditingUseCases() {
  const deps = createDeps({ db: await tryGetDb() });
  const siteEditing = {
    sites: deps.sites,
    drafts: deps.siteDrafts,
    publishedContent: deps.publishedContent,
    auditLog: deps.auditLog,
    ids: deps.ids,
  };
  return auditDenials(deps, {
    update: createUpdateManagedSiteUseCase(siteEditing),
    remove: createDeleteManagedSiteUseCase(siteEditing),
  });
}

/**
 * ブログの固定文書（運営者情報・各方針・規約・特商法表記）の入口。
 *
 * 記事とは別に置く。記事の下書きの口を渡すと、固定文書の画面から
 * 記事を書き換えられる形になり、権限の話がここに紛れ込む。
 */
export async function siteDocumentUseCases() {
  const deps = createDeps({ db: await tryGetDb() });
  const documentDeps = {
    sites: deps.sites,
    documents: deps.siteDocuments,
    ids: deps.ids,
    auditLog: deps.auditLog,
    now: () => new Date(),
  };
  return auditDenials(deps, {
    list: createListSiteDocumentsUseCase(documentDeps),
    save: createSaveSiteDocumentUseCase(documentDeps),
  });
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
  const context = await appContext();
  const deps = createDeps({ db: context.db, env: context.env });
  const distribution = {
    connections: deps.channelConnections,
    connectors: deps.channelConnectors,
    publications: deps.publications,
    manualExport: deps.manualExport,
    variants: deps.contentVariants,
    contentPackages: deps.contentPackages,
    ids: deps.ids,
    auditLog: deps.auditLog,
  };
  // 自分のブログへ出す口。**配信の画面に置く**。
  // 記事の一覧側へ置かないのは、出し先（どのブログ・どのカテゴリー）を
  // 決めるのが配信の仕事だから。両方に置くと、同じ記事が 2 度出る。
  const ownSite = {
    sites: deps.sites,
    packages: deps.contentPackages,
    variants: deps.contentVariants,
    publications: deps.publications,
    articles: deps.publishedArticles,
    offers: deps.articleOffers,
    auditLog: deps.auditLog,
    ids: deps.ids,
  };
  return auditDenials(deps, {
    listChannels: createListChannelsUseCase(distribution),
    listPublications: createListPublicationsUseCase(distribution),
    registerConnection: createRegisterChannelConnectionUseCase(distribution),
    getPublication: createGetPublicationUseCase(distribution),
    exportManualDraft: createExportManualDraftUseCase(distribution),
    cancel: createCancelPublicationUseCase(distribution),
    schedule: createSchedulePublicationUseCase(distribution),
    update: createUpdatePublicationUseCase(distribution),
    channelStatus: createGetContentChannelStatusUseCase(distribution),
    preparePublishArticle: createPreparePublishArticleUseCase(ownSite),
    publishArticle: createPublishArticleUseCase(ownSite),
    // 出す前の点検（REQ-SEO03）。公開と同じ道を通り、何も保存しない。
    auditArticleDraft: createAuditArticleDraftUseCase(ownSite),
  });
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
    auditLog: deps.auditLog,
    ids: deps.ids,
  };
  return auditDenials(deps, {
    getCalendar: createGetPublicationCalendarUseCase(calendar),
    reschedule: createReschedulePublicationUseCase(calendar),
  });
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
    ids: deps.ids,
    auditLog: deps.auditLog,
    now: () => new Date(),
  };
  return auditDenials(deps, {
    listAccounts: createListAffiliateAccountsUseCase(affiliate),
    listPrograms: createListAffiliateProgramsUseCase(affiliate),
    listConversions: createListConversionsUseCase(affiliate),
    getConversion: createGetConversionUseCase(affiliate),
    listProductLinks: createListProductLinksUseCase(affiliate),
    adjustConversion: createAdjustConversionUseCase(affiliate),
    // 登録の 2 口。**一覧しか無い間は、提携先も提携条件も見本のまま増やせなかった。**
    saveAccount: createSaveAffiliateAccountUseCase(affiliate),
    saveProgram: createSaveAffiliateProgramUseCase(affiliate),
    /*
     * 登録したリンクを見て、古くなったものを止める 2 口。
     * **止める口が無い間、表記を直す手段は 1 つも無かった。** 写しは上書きしない
     * 決まり（`docs/product/design-decisions.md` §2）なので、直し方は
     * 「止めて登録し直す」しかなく、その 1 手目が存在しなかった。
     */
    listLinks: createListAffiliateLinksUseCase(affiliate),
    disableLink: createDisableAffiliateLinkUseCase(affiliate),
  });
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
    auditLog: deps.auditLog,
    now: () => new Date(),
  };
  return auditDenials(deps, {
    list: createListLinkInboxUseCase(inbox),
    preview: createPreviewAffiliateUrlUseCase({
      fetcher: createAffiliatePreviewFetcher(),
      inbox: deps.linkInbox,
      links: deps.affiliateLinks,
    }),
    submit: createSubmitAffiliateUrlUseCase(inbox),
    resolve: createResolveLinkIngestionUseCase(inbox),
    match: createMatchLinkIngestionUseCase(inbox),
    reject: createRejectLinkIngestionUseCase(inbox),
    /*
     * 受信箱の最後の一歩。**ここまで来て初めて、記事に出せるリンクになる。**
     * 商品まで決めた 1 件を `affiliate_links` へ登録する口で、
     * これが無いと表は空のままで、公開した記事に成果リンクが 1 件も出ない。
     */
    register: createRegisterAffiliateLinkUseCase({
      inbox: deps.linkInbox,
      links: deps.affiliateLinks,
      ids: deps.ids,
      auditLog: deps.auditLog,
      now: () => new Date(),
    }),
  });
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
  const deps = createDeps({ db: await tryGetDb() });
  const analytics = { metrics: deps.metrics };
  return auditDenials(deps, {
    listMetrics: createListMetricsUseCase(analytics),
    listUsableMetrics: createListUsableMetricsUseCase(analytics),
    checkFeedback: createCheckFeedbackUseCase(analytics),
    filterMetrics: createFilterMetricsUseCase(analytics),
    // 数字の画面に「まだ突合できないリンクが何件あるか」を一緒に出す。
    // クリック数だけを出すと、出ている数字が全体の一部でしかないことに
    // 誰も気づけない（画面には何の異常も出ない）。
    trackingCoverage: createReadTrackingCoverageUseCase({
      trackingCoverage: deps.trackingCoverage,
    }),
  });
}

/**
 * 計測の入口。
 *
 * 記録の受け口 (`/api/telemetry`) と AI 利用の画面が同じものを使う。
 * 記録先を差し替えるときに触るのは infrastructure の 1 行だけ。
 */
export async function telemetryUseCases() {
  const app = createDeps({ db: await tryGetDb() });
  const deps = { sink: app.telemetry };
  return auditDenials(app, {
    aiUsage: createAiUsageReportUseCase(deps),
    explain: createExplainTelemetryUseCase(),
  });
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
 * 操作の記録がいま何で動いているかを画面に出すための一文。
 *
 * **この画面に出すことが、控えを許した条件そのものである。**
 * 記録は「残った」と言えること自体が意味を持つ唯一の種類なので、
 * 黙って控えへ落ちると「残っていると思われて、残っていない」になる。
 * それは記録が無い状態より悪い。
 */
export async function auditLogNotice(): Promise<StorageStatus> {
  const db = await tryGetDb();
  return {
    persisted: db !== null,
    what: "操作の記録先",
    blockedBy: "audit_logs テーブルの追加と D1 への接続",
    stubId: "persistence:audit-log-memory",
    message:
      db === null
        ? auditLogStubNotice()
        : "誰がいつ何をしたかは保存されます（保存先: D1 の audit_logs）。後から書き換えることはできません。",
  };
}

/**
 * 改善ループの入口。
 *
 * 2 つとも**軸の中身を知らない**。色の実験も構成の実験も同じ道を通る。
 * 軸を 1 つ足したときにここが変わるなら、汎用のループになっていない。
 */
export async function improvementUseCases() {
  // **接続を渡す。** 渡さないと、記録先の表を作っても画面には見本が出続ける。
  // 表を足した回にここを直し忘れ、`composition-wiring` の検査に捕まった。
  const app = createDeps({ db: await tryGetDb() });
  const deps = { repository: app.improvement };
  // 回す側は id と時刻が要る。読む側と同じ保存先を使う
  // （画面用にもう 1 つ保存の道を作らない）。
  // 回す側は id と時刻、それに**操作の記録先**が要る。読む側と同じ保存先を使う
  // （画面用にもう 1 つ保存の道を作らない）。
  const run = { ...deps, auditLog: app.auditLog, ids: app.ids, now: () => new Date() };
  return auditDenials(app, {
    review: createReviewLoopRunsUseCase(deps),
    dimensions: createListImprovementDimensionsUseCase(deps),
    draftSpec: createDraftVariantSpecUseCase(run),
    approveSpec: createApproveVariantSpecUseCase(run),
    start: createStartLoopRunUseCase(run),
    observe: createRecordLoopObservationUseCase(run),
    conclude: createConcludeLoopRunUseCase(run),
    stop: createStopLoopRunUseCase(run),
  });
}

/** 改善ループの記録先が見本であることを画面に出すための一文。 */
export function improvementNotice(): string {
  return improvementStubNotice();
}

/** 同じ画面の「何が済めば外れるか」。台帳の値をそのまま渡す。 */
export function improvementBlockedBy(): string {
  return improvementStubBlockedBy();
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
    brands: deps.brands,
    ids: deps.ids,
    auditLog: deps.auditLog,
    now: () => new Date(),
  };
  return auditDenials(deps, {
    submit: createSubmitFeedbackUseCase(feedback),
    list: createListFeedbackUseCase({ repository: deps.feedback }),
    read: createReadFeedbackUseCase({
      repository: deps.feedback,
      captures: deps.feedbackCaptures,
    }),
    updateStatus: createUpdateFeedbackStatusUseCase({
      repository: deps.feedback,
      ids: deps.ids,
      auditLog: deps.auditLog,
      now: feedback.now,
    }),
    handOff: createHandOffFeedbackUseCase({
      repository: deps.feedback,
      templates: deps.handoffTemplates,
      ids: deps.ids,
      auditLog: deps.auditLog,
      now: feedback.now,
    }),
    keys: createManageIntegrationKeysUseCase({
      keys: deps.integrationKeys,
      ids: deps.ids,
      mintSecret: deps.mintSecret,
      now: feedback.now,
      auditLog: deps.auditLog,
    }),
  });
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
 * `draft` だけが生成 AI を実際に呼ぶ。
 * どこの提供元を呼ぶかは `src/infrastructure/llm/llm-setup.ts` の 1 行が決めており、
 * ここも画面も、提供元の名前を知らない。
 *
 * `listModels` は選ぶ欄のための読み取りである。鍵の管理（`llmCredentialEntry`）とは
 * 別に組み立てている。あちらは `integration_key.manage` が要り、
 * 書く人に管理権限を配らないとモデルが選べない形にしたくないため。
 */
export async function generationUseCases() {
  // **環境も渡す。** 鍵は環境から取る。ここを `createDeps()` のままにすると、
  // 利用者が画面から鍵を登録しても、生成の呼び出しからは 1 件も見えない。
  const context = await appContext();
  const deps = createDeps({ db: context.db, env: context.env });
  const management = createLlmCredentialManagement(context);
  const capacity = createCapacityGuard({
    workspaces: deps.workspaces,
    now: () => new Date(),
  });
  return auditDenials(deps, {
    readPlan: createReadGenerationPlanUseCase(),
    checkInput: createCheckGenerationInputUseCase(),
    reviewMaterial: createReviewMaterialUseCase(),
    listModels: createListSelectableModelsUseCase({
      catalog: management.catalog,
      credentials: management.ready
        ? { available: true, vault: management.vault }
        : { available: false, reason: management.reason },
    }),
    // brands を渡すのは、AWS-ACC-03（ブランドの標準 CTA・標準免責が既定値として入る）が
    // 経路を限定していないため。ここを省くと、道具経路（/api/tools）では届くのに
    // 画面経路（/admin/generation）では届かない、という利用者から見て説明不能な差になる。
    // P10 の FR-01 が実測したのがまさにこの欠落である。
    draft: createDraftContentVariantUseCase({
      llm: deps.llm,
      costs: deps.llmCosts,
      brands: deps.brands,
      capacity,
    }),
  });
}

/**
 * 生成 AI の鍵を登録する画面の入口。
 *
 * **使える状態と使えない状態を、同じ型で返さない。**
 * 使えないときに空の一覧を返すと、画面は「まだ登録していない」と読む。
 * 実際には元締めの鍵が無い・保存先が無いのどちらかで、
 * 利用者がやることは登録ではなく設定である。
 *
 * 使えないときも提供元の一覧だけは返す。
 * 鍵をどこで発行するかの案内は、むしろ使えないときに要る。
 */
export type LlmCredentialEntry =
  | {
      readonly ready: true;
      readonly manage: UseCase<ManageLlmCredentialsInput, ManageLlmCredentialsOutput>;
    }
  | {
      readonly ready: false;
      readonly reason: string;
      readonly providers: readonly LlmProviderDescriptor[];
    };

export async function llmCredentialEntry(): Promise<LlmCredentialEntry> {
  const context = await appContext();
  const built = createLlmCredentialManagement(context);
  if (!built.ready) {
    const providers = await built.catalog.listProviders();
    return {
      ready: false,
      reason: built.reason,
      providers: providers.ok ? providers.value : [],
    };
  }
  const deps = createDeps({ db: context.db, env: context.env });
  return {
    ready: true,
    manage: createManageLlmCredentialsUseCase({
      vault: built.vault,
      catalog: built.catalog,
      connectivity: built.connectivity,
      auditLog: deps.auditLog,
      ids: deps.ids,
      now: () => new Date(),
    }),
  };
}

/**
 * SEO/AI 検索の指針の出典レジストリの入口。
 *
 * 保存先 (D1) が無い実行では `ready: false` と理由だけを返す。
 * 見本の保存先へ黙って落とすと、登録したつもりの出典が次の実行で消える。
 */
export type GuidelineReferenceEntry =
  | {
      readonly ready: true;
      readonly manage: UseCase<ManageGuidelineReferencesInput, ManageGuidelineReferencesOutput>;
    }
  | { readonly ready: false; readonly reason: string };

export async function guidelineReferenceEntry(): Promise<GuidelineReferenceEntry> {
  const db = await tryGetDb();
  if (db === null) {
    return {
      ready: false,
      reason:
        "保存先 (D1) が用意されていません。出典の登録と確認日の更新は、保存先がある実行でだけ使えます。",
    };
  }
  const deps = createDeps({ db });
  return {
    ready: true,
    manage: createManageGuidelineReferencesUseCase({
      references: createD1GuidelineReferenceRepository({ db, now: () => new Date() }),
      auditLog: deps.auditLog,
      ids: deps.ids,
      now: () => new Date(),
    }),
  };
}

/**
 * ブログの見た目（テンプレート・配色 2 層）の入口。
 *
 * 出典レジストリと同じく、保存先が無ければ `ready: false` を理由つきで返す。
 * 見本へ落とすと、選んだテンプレートが次の実行で消えているのに
 * 画面上は保存できたように見える（受入 A8 が最も壊れやすい形）。
 */
export type BlogAppearanceEntry =
  | {
      readonly ready: true;
      readonly manage: UseCase<ManageBlogAppearanceInput, BlogAppearanceView>;
    }
  | { readonly ready: false; readonly reason: string };

export async function blogAppearanceEntry(): Promise<BlogAppearanceEntry> {
  const db = await tryGetDb();
  if (db === null) {
    return {
      ready: false,
      reason:
        "保存先 (D1) が用意されていません。ブログの見せ方と配色の設定は、保存先がある実行でだけ使えます。",
    };
  }
  const deps = createDeps({ db });
  return {
    ready: true,
    manage: createManageBlogAppearanceUseCase({
      appearance: createD1BlogAppearanceRepository({ db, newId: () => deps.ids.newId() }),
      auditLog: deps.auditLog,
      ids: deps.ids,
      now: () => new Date(),
    }),
  };
}

/**
 * 公開面に効く配色を、保存された 2 層から読む（受入 A2-4）。
 *
 * **管理画面の入口（`blogAppearanceEntry`）と分けてある。** あちらは能力を要求する
 * ユースケースで、読者は能力を 1 つも持たない。読み取り専用のここを通す。
 *
 * 保存先が無い実行（見本データ）では設計図の配色をそのまま返す。
 * ここで `ready: false` を返して画面を止めると、保存先を繋ぐ前は
 * ブログが 1 本も開けなくなる。
 */
export async function publicBlogAppearance(input: {
  readonly siteSlug: string;
  readonly pagePath: string;
  readonly fallback: Appearance;
}): Promise<PublicBlogAppearance> {
  const db = await tryGetDb();
  if (db === null) return { appearance: input.fallback, resolved: false };
  const deps = createDeps({ db });
  /*
    読者は作業場所を持たない。**保存先の絞り込みを緩めずに**、
    ブログの持ち主の作業場所を引いてから読む（`readerActorForSite` と同じ形）。
    引けなければ読まない —— 誰の作業場所か分からないまま
    `blog_theme` を引くと、同じ名前のブログが別の作業場所にある日に
    他所の配色が出る。
  */
  const found = await deps.sites.findBySlug(input.siteSlug);
  if (!found.ok || found.value === null) {
    return { appearance: input.fallback, resolved: false };
  }
  return readPublicBlogAppearance({
    port: createD1BlogAppearanceRepository({ db, newId: () => deps.ids.newId() }),
    workspaceId: found.value.workspaceId,
    siteSlug: input.siteSlug,
    pagePath: input.pagePath,
    fallback: input.fallback,
  });
}

/**
 * 記事の中の塊の並び。ブログが選んだ見せ方から取る（受入 A1・A5）。
 *
 * 配色と同じ理由でここに置く（読者は能力を持たない）。
 * 選んでいない・保存先が無いときは `null` を返し、記事画面が既定の並びで描く。
 */
export async function publicArticleBlockOrder(
  siteSlug: string,
): Promise<readonly string[] | null> {
  const db = await tryGetDb();
  if (db === null) return null;
  const deps = createDeps({ db });
  const found = await deps.sites.findBySlug(siteSlug);
  if (!found.ok || found.value === null) return null;
  return readPublicArticleBlockOrder({
    port: createD1BlogAppearanceRepository({ db, newId: () => deps.ids.newId() }),
    workspaceId: found.value.workspaceId,
    siteSlug,
  });
}

/**
 * ブログ×成果リンクの掲載台帳の入口（受入 A6・A7）。
 *
 * 見た目の入口と分けてある。掲載の一覧は**記事の全体集合**を要するので
 * `blogOps` の保管庫まで引き連れる。配色の画面がその重さを払う理由は無い。
 */
export type BlogPlacementEntry =
  | {
      readonly ready: true;
      readonly review: UseCase<ReviewBlogPlacementsInput, BlogPlacementsView>;
    }
  | { readonly ready: false; readonly reason: string };

export async function blogPlacementEntry(): Promise<BlogPlacementEntry> {
  const db = await tryGetDb();
  if (db === null) {
    return {
      ready: false,
      reason:
        "保存先 (D1) が用意されていません。成果リンクの掲載状況は、保存先がある実行でだけ使えます。",
    };
  }
  const deps = createDeps({ db });
  return {
    ready: true,
    review: createReviewBlogPlacementsUseCase({
      placements: createD1BlogAffiliatePlacementRepository({
        db,
        newId: () => deps.ids.newId(),
      }),
      blogOps: deps.blogOps,
      auditLog: deps.auditLog,
      ids: deps.ids,
      now: () => new Date(),
    }),
  };
}

/**
 * ブログの住所（独自ドメイン）の入口。住所層。
 *
 * 証明書の発行元（Cloudflare for SaaS）を**ここで**渡す。鍵が無い実行では
 * 提供者側が `NOT_SUPPORTED` を返し、画面には「登録はできるが発行できない」
 * と出る。入口ごと `ready: false` にしないのは、すでに登録済みの住所の
 * 一覧まで見えなくなるためで、見えないと運用者は「消えた」と判断する。
 */
export type BlogDomainsEntry =
  | {
      readonly ready: true;
      readonly manage: UseCase<ManageCustomDomainsInput, BlogDomainsView>;
    }
  | { readonly ready: false; readonly reason: string };

export async function blogDomainsEntry(): Promise<BlogDomainsEntry> {
  const db = await tryGetDb();
  if (db === null) {
    return {
      ready: false,
      reason:
        "保存先 (D1) が用意されていません。ブログの住所（独自ドメイン）は、保存先がある実行でだけ管理できます。",
    };
  }
  const deps = createDeps({ db });
  return {
    ready: true,
    manage: createManageCustomDomainsUseCase({
      domains: createD1CustomDomainRepository({ db, newId: () => deps.ids.newId() }),
      provider: createCloudflareCustomHostnameProvider(),
      auditLog: deps.auditLog,
      ids: deps.ids,
      now: () => new Date(),
    }),
  };
}

/**
 * 読者の行動を受け取る口。観測層の**入り側**。
 *
 * --- 読み側 (`blogAudienceEntry`) と別にしてある理由 ---
 * 読み側は管理画面から、ここは公開面（読者が開いているページ）から呼ばれる。
 * 1 つにまとめると、読者向けの経路に管理画面用の読み取りポートまで
 * ぶら下がる。公開面に置くものは少ないほどよい。
 *
 * **保存先が無いときは `null` を返す。** 読み側のように理由の文言を返さない
 * のは、この口の呼び手が読者向けの経路で、返した文言を出す場所が
 * 無いためである（記録できなくても読者の画面は動く）。
 */
export async function readerInteractionIntakeEntry(): Promise<UseCase<
  RecordReaderInteractionsInput,
  RecordReaderInteractionsResult
> | null> {
  const db = await tryGetDb();
  if (db === null) return null;
  const deps = createDeps({ db });
  return createRecordReaderInteractionsUseCase({
    intake: createD1ReaderInteractionIntake({ db, newId: () => deps.ids.newId() }),
    now: () => new Date(),
  });
}

/**
 * 日次集計をやり直す入口。観測層の**作り直し側**。
 *
 * 定期実行 (`reader-metrics-scheduler.ts`) は当日と前日しか見ない。その窓から
 * 出た日を拾い直す手段がないと、集計が失敗した 1 日だけが永久に空のまま残る。
 * 窓を広げず、必要なときだけ手で指せるようにしてある。
 *
 * 受け側 (`readerInteractionIntakeEntry`) と別にしてあるのは、あちらが公開面から
 * 呼ばれる口だからである。読者向けの経路に、集計を作り直す力を置かない。
 */
export type MetricsRebuildEntry =
  | {
      readonly ready: true;
      readonly rebuild: UseCase<RebuildDailyMetricsInput, RebuildDailyMetricsView>;
    }
  | { readonly ready: false; readonly reason: string };

export async function metricsRebuildEntry(): Promise<MetricsRebuildEntry> {
  const db = await tryGetDb();
  if (db === null) {
    return {
      ready: false,
      reason:
        "保存先 (D1) が用意されていません。日次集計のやり直しは、保存先がある実行でだけ行えます。",
    };
  }
  const deps = createDeps({ db });
  return {
    ready: true,
    rebuild: createRebuildDailyMetricsUseCase({
      rollup: createD1MetricsRollup(db),
      auditLog: deps.auditLog,
      ids: deps.ids,
      now: () => new Date(),
    }),
  };
}

/**
 * 読者の像（どんな人が・どこで時間を使い・どこを押したか）の入口。観測層。
 *
 * **見本へ落とさない。** 配色と違い、ここに見本の数字を出すと、運用者は
 * それを自分のブログの実績として読む。数字は「無い」と分かるほうが安全で、
 * 「あるが嘘」は取り返しがつかない。
 */
export type BlogAudienceEntry =
  | {
      readonly ready: true;
      readonly read: UseCase<ReadBlogAudienceInput, BlogAudienceView>;
    }
  | { readonly ready: false; readonly reason: string };

export async function blogAudienceEntry(): Promise<BlogAudienceEntry> {
  const db = await tryGetDb();
  if (db === null) {
    return {
      ready: false,
      reason:
        "保存先 (D1) が用意されていません。読者の行動の集計は、保存先がある実行でだけ読めます。",
    };
  }
  return {
    ready: true,
    read: createReadBlogAudienceUseCase({
      audience: createD1BlogAudienceRepository(db),
    }),
  };
}

/**
 * 記事ごとの売上と PV の入口。観測層。
 *
 * **読者の像と別の入口にしてある。** 報酬データを見るには
 * `affiliate.read_revenue` が要り、読者の像は `analytics.read` で足りる。
 * 1 つの入口にまとめると、片方だけ見せたい役割に両方が渡る。
 */
export type BlogRevenueEntry =
  | {
      readonly ready: true;
      readonly read: UseCase<ReadBlogRevenueInput, BlogRevenueView>;
    }
  | { readonly ready: false; readonly reason: string };

export async function blogRevenueEntry(): Promise<BlogRevenueEntry> {
  const db = await tryGetDb();
  if (db === null) {
    return {
      ready: false,
      reason:
        "保存先 (D1) が用意されていません。記事ごとの売上と PV は、保存先がある実行でだけ読めます。",
    };
  }
  return {
    ready: true,
    read: createReadBlogRevenueUseCase({
      revenue: createD1BlogRevenueRepository(db),
    }),
  };
}

/**
 * SEO 診断の入口。改善層。
 *
 * 診断する側（`analyze`）と直す場所を特定する側（`draft`）を**ここで**束ねる。
 * 何を指摘とみなすかは差し替えたくなるが、指摘をどう保存するかは
 * 差し替えたくない。だから保管庫の外から渡している。
 */
export type BlogSeoEntry =
  | {
      readonly ready: true;
      readonly manage: UseCase<ManageSeoAssessmentInput, SeoAssessmentView>;
    }
  | { readonly ready: false; readonly reason: string };

export async function blogSeoEntry(): Promise<BlogSeoEntry> {
  const db = await tryGetDb();
  if (db === null) {
    return {
      ready: false,
      reason:
        "保存先 (D1) が用意されていません。SEO 診断は、保存先がある実行でだけ回せます。",
    };
  }
  const deps = createDeps({ db });
  return {
    ready: true,
    manage: createManageSeoAssessmentUseCase({
      seo: createD1SeoAssessmentRepository({
        db,
        newId: () => deps.ids.newId(),
        analyze: createArticleSeoAnalyzer(db),
        draft: createSeoFixDrafter(db),
      }),
      auditLog: deps.auditLog,
      ids: deps.ids,
      now: () => new Date(),
    }),
  };
}

/**
 * AEO（回答エンジン最適化）の入口。改善層。
 *
 * ブログ全体の構え（`profiles`）と、記事ごとの引用単位（`units`）を
 * 1 つのユースケースへ渡す。画面が別々に読むと、構えを保存した直後の
 * 一覧に古い構えが出る瞬間ができる。
 */
export type BlogAeoEntry =
  | {
      readonly ready: true;
      readonly manage: UseCase<ManageAeoAnswersInput, AeoAnswersView>;
    }
  | { readonly ready: false; readonly reason: string };

export async function blogAeoEntry(): Promise<BlogAeoEntry> {
  const db = await tryGetDb();
  if (db === null) {
    return {
      ready: false,
      reason:
        "保存先 (D1) が用意されていません。AEO の構えと引用単位は、保存先がある実行でだけ扱えます。",
    };
  }
  const deps = createDeps({ db });
  return {
    ready: true,
    manage: createManageAeoAnswersUseCase({
      profiles: createD1AeoProfileRepository(db),
      units: createD1AnswerUnitRepository({
        db,
        newId: () => deps.ids.newId(),
        extract: createAnswerUnitExtractor(db),
      }),
      auditLog: deps.auditLog,
      ids: deps.ids,
      now: () => new Date(),
    }),
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
export async function settingsUseCases() {
  // 操作の記録は保存先（D1）に本物がある。接続を取らずに組み立てると、
  // 設定画面の「操作の記録」だけが見本データを読み続け、
  // **実際に承認した記録が 1 件も出てこない**。
  const deps = createDeps({ db: await tryGetDb() });
  const settings = {
    workspaces: deps.workspaces,
    memberships: deps.memberships,
    brands: deps.brands,
    disclosures: deps.disclosures,
    auditLog: deps.auditLog,
  };
  const capacity = createCapacityGuard({
    workspaces: deps.workspaces,
    now: () => new Date(),
  });
  const compliance = {
    disclosures: deps.disclosures,
    policyRules: deps.policyRules,
    auditLog: deps.auditLog,
    ids: deps.ids,
    now: () => new Date(),
  };
  return auditDenials(deps, {
    getOverview: createGetSettingsOverviewUseCase(settings),
    listRoles: createListRolesUseCase(settings),
    listMembers: createListMembersUseCase(settings),
    /**
     * 担当者を書く口（招待・役割の変更・取り消し）。
     *
     * 読む口と同じ `settings` を渡す。保存先が用意できていれば本物（D1）で、
     * 無い実行では見本のまま保存が失敗を返す。**どちらで動いているかは
     * 画面に文字で出す**（`settingsNotice()`）。黙って見本へ落ちない。
     */
    manageMembers: createManageMembersUseCase({
      ...settings,
      ids: deps.ids,
      now: () => new Date(),
      capacity,
    }),
    listBrands: createListBrandsUseCase(settings),
    /**
     * ブランドを作る・直す口。
     *
     * **読む口と同じ保存先を渡す。** 別に組み立てると、直した内容が
     * 一覧に出ない（読み側だけ見本を読み続ける）状態が作れる。
     */
    saveBrand: createSaveBrandUseCase({
      ...settings,
      ids: deps.ids,
      now: () => new Date(),
      capacity,
    }),
    updateWorkspace: createUpdateWorkspaceUseCase({
      ...settings,
      ids: deps.ids,
      now: () => new Date(),
    }),
    listDisclosures: createListDisclosuresUseCase(settings),
    listAuditLog: createListAuditLogUseCase(settings),
    /**
     * 表記のきまりの一覧と、広告表記・きまりを**変える**口。
     *
     * §26 が必ず記録すると定めている 3 つのうち 1 つが
     * 「広告表記・ランキング基準の変更」で、ここがその変更の入口である。
     * 読む口と同じ保存先を渡す。用意できていれば本物（D1）で、
     * 無い実行では見本のまま保存が失敗を返す（`settingsNotice()` が画面に書く）。
     */
    listPolicyRules: createListPolicyRulesUseCase({ policyRules: deps.policyRules }),
    editDisclosure: createEditDisclosureUseCase(compliance),
    editPolicyRule: createEditPolicyRuleUseCase(compliance),
  });
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
  return auditDenials(deps, {
    getDashboard: createGetDashboardUseCase({
      contentVariants: deps.contentVariants,
      products: deps.products,
      publications: deps.publications,
      channelConnections: deps.channelConnections,
      linkInbox: deps.linkInbox,
      affiliateLinks: deps.affiliateLinks,
      conversions: deps.conversions,
    }),
  });
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
/**
 * 提携先の選択肢。
 *
 * ドメインの `ASP_LABEL` から作る。画面側に一覧を写すと、
 * ASP を 1 つ足したときに写したほうだけが古くなり、
 * 「保存はできるのに選べない種類」が生まれる。
 */
export function affiliateAspOptions(): readonly { key: string; label: string }[] {
  return aspOptions().map((o) => ({ key: o.key, label: o.label }));
}

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
        : // 自分のブログだけは**本当に出せる**ようになったので、そこを一緒くたにしない。
          // 「まだ投稿しません」とだけ書くと、出せるものを出せないと思わせる。
          "予約・取りやめは保存されます（保存先: D1 の publications）。自分のブログへは、この画面の「いまサイトに出す」から実際に公開できます。X や Instagram など外部サービスへの投稿はまだ行いません（接続の認証が未登録のため）。出し先の一覧に並んでいるのは見本です。",
  };
}

/**
 * 記事の画面に出す、いま何で動いているかの説明。
 *
 * **2 つのことを分けて書く。**
 *   1. 記事の本文と進行の現在地が保存されるか（保存先があれば保存される）
 *   2. はじめから並んでいるものが見本であること
 * 1 が済んだからといって 2 が消えるわけではない。見本を消すと、
 * まだ 1 件も作っていない状態と壊れている状態を画面から見分けられなくなる。
 *
 * **画面側にこの条件を書かない。** 書いていた頃は、保存先をつないだあとも
 * 「まだつながっていません」と出続けた（2026-08-17、Workers 上の確認で判明）。
 */
export async function editorialContentNotice(): Promise<StorageStatus> {
  const db = await tryGetDb();
  return {
    persisted: db !== null,
    what: "企画と記事の保存先",
    blockedBy: "保存先（D1）への接続",
    stubId: "persistence:content-editorial-sample",
    message:
      db === null
        ? sampleEditorialContentNotice()
        : "立てた企画と、進めた段階・承認は保存されます（保存先: D1 の content_packages / content_variants）。はじめから並んでいる企画と記事は見本で、消さずに残してあります。",
  };
}

/**
 * 書き手と読者像が保存されるか。
 *
 * 記事の側（`editorialContentNotice()`）と分けている。**同じ保存先の話ではなく、
 * 利用者がこの画面で気にしているのが「増やした書き手が残るか」だけ**だから。
 * 記事の進行の話を混ぜると、書き手の画面で記事の説明を読まされる。
 */
export async function personaStorageNotice(): Promise<StorageStatus> {
  const db = await tryGetDb();
  return {
    persisted: db !== null,
    what: "書き手と読者像の保存先",
    blockedBy: "保存先（D1）への接続",
    stubId: "persistence:content-editorial-sample",
    message:
      db === null
        ? sampleEditorialContentNotice()
        : "登録した書き手と読者像は保存されます（保存先: D1 の author_personas / audience_personas）。はじめから並んでいる分は見本で、消さずに残してあります。",
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
    scopedBrandIds: [],
    isAiServiceAccount: false,
    /**
     * **確かめていない。** `anonymous` は誰でもある。
     *
     * この身元でも操作の記録は残る（残さないと「誰も押していない」と
     * 「押したが記録を断った」が区別できない）。残る記録には
     * 確かめていない印が付き、`wasApprovedByHuman()` は人の承認として数えない。
     */
    identified: false,
  };
}

/**
 * 既知のブログについてだけ、読者の記録を残す作業場所を返す。
 *
 * 読者自身はどこにも所属していないが、行動の記録はブログを所有する
 * 作業場所へ積む必要がある。未知の名前を `ws_public` へ落とすと、誰からも
 * 読まれない孤立行が増えるため、保存する入口はこの strict な口を使う。
 */
export async function readerActorForKnownSite(
  siteSlug: string | null,
): Promise<ActorContext | null> {
  if (siteSlug === null || siteSlug.trim() === "") return null;
  // 読者向けのユースケース（`getSite`）は、外へ出せる項目だけを返すので
  // 作業場所を持っていない。ここは組み立ての層なので、保存先を直接引く。
  const found = await createDeps({ db: await tryGetDb() }).sites.findBySlug(siteSlug);
  if (!found.ok || found.value === null) return null;
  return { ...readerActor(), workspaceId: found.value.workspaceId };
}

/**
 * 表示・telemetry互換のresolver。既知siteの解決規則はstrictな口と共有し、
 * 見つからない場合だけ従来どおり所属なしの読者へ戻す。
 */
export async function readerActorForSite(siteSlug: string | null): Promise<ActorContext> {
  return (await readerActorForKnownSite(siteSlug)) ?? readerActor();
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
 * D1 モードでは保存実体だけ、sample モードでは見本だけを返す。
 * 一覧と公開解決のモードを揃え、開けない見本を保存済みのように見せない。
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
        : "作ったブログだけが表示・保存されます（保存先: D1 の site_blueprints）。見本は D1 の一覧には混ざりません。",
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
  // 保存先と環境を 1 度にそろえる。環境を省くと住所の基底ドメインが
  // `null` になり、画面から作ったブログだけ住所を持たない形になる。
  const deps = createDeps(await appContext());
  const publicEntry = publicProjectionEntry(deps.publicBlogSource, deps.publicBlog);
  const capacity = createCapacityGuard({
    workspaces: deps.workspaces,
    now: () => new Date(),
  });
  const builder = {
    drafts: deps.siteDrafts,
    ids: deps.ids,
    auditLog: deps.auditLog,
    now: () => new Date(),
    capacity,
    // 住所の基底ドメインは組み立て（`createDeps`）が 1 回だけ解釈したものを使う。
    // ユースケースに読ませると、手元と本番で同じ入力に別の答えを返す関数になる。
    siteBaseDomain: deps.siteBaseDomain,
    readComposition: (siteSlug: string) => readPublicSiteComposition(siteSlug, publicEntry),
  };
  return auditDenials(deps, {
    listDrafts: createListSiteDraftsUseCase(builder),
    getDraft: createGetSiteDraftUseCase(builder),
    startDraft: createStartSiteDraftUseCase(builder),
    saveStep: createSaveSiteDraftStepUseCase(builder),
    createSite: createCreateSiteFromDraftUseCase(builder),
  });
}

/**
 * 公開した記事を IndexNow で検索エンジンへ知らせる差し込み口。
 *
 * 送信の実体（鍵の取得・fetch）はインフラ層にあり、画面側はこの口だけを見る。
 * **失敗しても throw しない**（`submitToIndexNow` の契約）。通知は公開の条件では
 * ないので、通知先の障害が記事の公開を道連れにしない。鍵は戻り値にもログにも
 * 現れない。skipped/failed の別は呼び出し元が記録する。
 */
export async function notifyIndexNowOfPublish(
  actor: ActorContext,
  origin: string | null,
  targetPath: string,
): Promise<RecordedIndexNowOutcome> {
  const targetUrl = origin === null ? targetPath : `${origin}${targetPath}`;
  const outcome = await (async () => {
    if (origin === null) {
      return {
        status: "skipped" as const,
        detail: "信頼できる公開元 URL を確定できなかったため、IndexNow 通知をスキップしました。",
      };
    }

    const result = await submitToIndexNow(origin, [targetUrl]);
    switch (result.status) {
      case "sent":
        return { status: "sent" as const, detail: `${result.count} 件を通知しました。` };
      case "skipped":
        return { status: "skipped" as const, detail: result.reason };
      case "failed":
        return { status: "failed" as const, detail: result.error };
    }
  })();

  const db = await tryGetDb();
  const deps = createDeps({ db });
  return recordIndexNowOutcome(
    {
      // D1 が無い実行で、処理中のメモリへ書いただけなのに「永続記録済み」と
      // 返さない。公開環境では D1、本当に無い環境では明示的な失敗を返す。
      auditLog: db === null ? createUnavailableAuditLog() : deps.auditLog,
      ids: deps.ids,
      now: () => new Date(),
    },
    actor,
    { targetUrl, outcome },
  );
}

/* ------------------------------------------------------------------ *
 * ブログ運用（サイト網・版面・記事・固定ページ・タグ・評価）
 * ------------------------------------------------------------------ */

/**
 * 作成者向けの口。
 *
 * 出典の登録（`guidelineReferenceEntry`）と同じく、**保存先が無ければ
 * `ready:false` を理由つきで返す**。ここで見本へ落とすと、書いた記事が
 * 保存されていないのに保存されたように見える。
 */
export type BlogOpsEntry =
  | {
      readonly ready: true;
      readonly listNetwork: ReturnType<typeof createListSiteNetworkUseCase>;
      readonly listDeletedNetwork: ReturnType<typeof createListDeletedSiteNetworkUseCase>;
      readonly createNetworkNode: ReturnType<typeof createCreateSiteNetworkNodeUseCase>;
      readonly updateNetworkNode: ReturnType<typeof createUpdateSiteNetworkNodeUseCase>;
      readonly deleteNetworkNode: ReturnType<typeof createDeleteSiteNetworkNodeUseCase>;
      readonly restoreNetworkNode: ReturnType<typeof createRestoreSiteNetworkNodeUseCase>;
      readonly readLayout: ReturnType<typeof createReadBlogLayoutUseCase>;
      readonly saveLayoutSlot: ReturnType<typeof createSaveBlogLayoutSlotUseCase>;
      readonly saveLayoutBand: ReturnType<typeof createSaveBlogLayoutBandUseCase>;
      readonly saveDeliveryPart: ReturnType<typeof createSaveDeliveryPartUseCase>;
      /** 配信物を実際に組み立ててみて、結果を履歴として積む (受入 A9)。 */
      readonly checkDelivery: ReturnType<typeof createCheckBlogDeliveryUseCase>;
      readonly listArticles: ReturnType<typeof createListBlogArticlesUseCase>;
      readonly listDeletedArticles: ReturnType<typeof createListDeletedBlogArticlesUseCase>;
      readonly getArticle: ReturnType<typeof createGetBlogArticleUseCase>;
      readonly createArticle: ReturnType<typeof createCreateBlogArticleUseCase>;
      readonly updateArticle: ReturnType<typeof createUpdateBlogArticleUseCase>;
      readonly deleteArticle: ReturnType<typeof createDeleteBlogArticleUseCase>;
      readonly restoreArticle: ReturnType<typeof createRestoreBlogArticleUseCase>;
      readonly listTags: ReturnType<typeof createListBlogTagsUseCase>;
      readonly saveTag: ReturnType<typeof createSaveBlogTagUseCase>;
      readonly deleteTag: ReturnType<typeof createDeleteBlogTagUseCase>;
      readonly evaluate: ReturnType<typeof createEvaluateBlogArticlesUseCase>;
      /**
       * 記事 1 本に付いた票を 1 件ずつ読む口。**伏せたものも返す。**
       * 読者側の集計（`publicBlogEntry.summarizeRating`）とは別にしてある。
       * あちらは「読者に見える数」なので伏せた票が消えるのが正しく、
       * こちらは運営者が「何を伏せたか」を確かめる口なので、消えたら用を成さない。
       */
      readonly listRatings: ReturnType<typeof createListArticleRatingsUseCase>;
      /** 票を伏せる／戻す。**行は消さない。** */
      readonly setRatingHidden: ReturnType<typeof createSetArticleRatingHiddenUseCase>;
    }
  | { readonly ready: false; readonly reason: string };

export async function blogOpsEntry(): Promise<BlogOpsEntry> {
  const db = await tryGetDb();
  if (db === null) {
    return {
      ready: false,
      reason:
        "保存先 (D1) が用意されていません。ブログの版面・記事・固定ページの編集は、保存先がある実行でだけ使えます。",
    };
  }
  const deps = createDeps({ db });
  /*
    **保管庫は組み立て側 (`createDeps`) から受け取る。**
    ここで `createD1BlogOpsRepository(db)` を自前で作っていたころは、
    同じ保管庫の作り方が画面側と道具側の 2 か所にあった。
    2 か所あると、片方だけ差し替えた日に「画面ではできるが AI からはできない」が生まれる。
  */
  const repository = deps.blogOps;
  const now = () => new Date();
  const base = {
    repository,
    publishedContent: deps.publishedContent,
    ids: deps.ids,
    auditLog: deps.auditLog,
    now,
  };
  return {
    ready: true,
    listNetwork: createListSiteNetworkUseCase(base),
    listDeletedNetwork: createListDeletedSiteNetworkUseCase(base),
    createNetworkNode: createCreateSiteNetworkNodeUseCase(base),
    updateNetworkNode: createUpdateSiteNetworkNodeUseCase(base),
    deleteNetworkNode: createDeleteSiteNetworkNodeUseCase(base),
    restoreNetworkNode: createRestoreSiteNetworkNodeUseCase(base),
    readLayout: createReadBlogLayoutUseCase(base),
    saveLayoutSlot: createSaveBlogLayoutSlotUseCase(base),
    saveLayoutBand: createSaveBlogLayoutBandUseCase(base),
    saveDeliveryPart: createSaveDeliveryPartUseCase(base),
    checkDelivery: createCheckBlogDeliveryUseCase(base),
    listArticles: createListBlogArticlesUseCase(base),
    listDeletedArticles: createListDeletedBlogArticlesUseCase(base),
    getArticle: createGetBlogArticleUseCase(base),
    createArticle: createCreateBlogArticleUseCase(base),
    updateArticle: createUpdateBlogArticleUseCase(base),
    deleteArticle: createDeleteBlogArticleUseCase(base),
    restoreArticle: createRestoreBlogArticleUseCase(base),
    listTags: createListBlogTagsUseCase(base),
    saveTag: createSaveBlogTagUseCase(base),
    deleteTag: createDeleteBlogTagUseCase(base),
    evaluate: createEvaluateBlogArticlesUseCase({ repository, now }),
    listRatings: createListArticleRatingsUseCase(base),
    setRatingHidden: createSetArticleRatingHiddenUseCase(base),
  };
}

/**
 * 読者に見える面の入口。
 *
 * 作成者向けと**別の口**にしてある。同じ口を使い回すと、絞り忘れ 1 か所で
 * 下書きが読者側に出る。ここは `PublicBlogPort`（公開済みしか返さない）
 * だけを握る。
 *
 * **`ready: false` を持たない。** 保存先 (D1) が無いところでは見本へ落ちる。
 * 「用意できていません」を返す形にしていた頃は、記事の画面が
 * どんな住所でも 200 を返し、「無い記事は 404」という約束を
 * 確かめられる場所が本番だけになっていた（他の入口も同じ理由で見本へ落ちる）。
 */
export type PublicBlogEntry = {
  /** 見本を live と誤認させないための公開契約。 */
  readonly source: "live" | "sample";
  readonly port: PublicBlogPort;
  readonly submitRating: ReturnType<typeof createSubmitArticleRatingUseCase>;
  /**
   * いまの件数と平均を読むだけの口。
   *
   * 管理側の `summarizeRatings`（会社ごとに絞る）とは別にしてある。
   * 記事 1 本の所属は記事 id が決めるので、読者側に会社は要らない。
   */
  readonly summarizeRating: ArticleRatingPort["summarize"];
};

/** 読者面・管理表示・作成判定が共有する公開 reader の組み立て。 */
function publicProjectionEntry(
  source: PublicProjectionEntry["source"],
  port: PublicBlogPort,
): PublicProjectionEntry {
  return {
    source,
    port,
  };
}

export async function publicBlogEntry(): Promise<PublicBlogEntry> {
  const db = await tryGetDb();
  const deps = createDeps({ db });
  const entry = publicProjectionEntry(deps.publicBlogSource, deps.publicBlog);
  const publicBlog = entry.port;
  const ratings = db === null ? createSampleArticleRatingPort() : createD1ArticleRatingPort(db);
  return {
    source: entry.source,
    port: publicBlog,
    summarizeRating: ratings.summarize,
    submitRating: createSubmitArticleRatingUseCase({
      ratings,
      publicBlog,
      ids: deps.ids,
      now: () => new Date(),
    }),
  };
}
