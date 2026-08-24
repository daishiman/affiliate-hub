import {
  ADMIN_ROUTE_METADATA,
  type AdminRouteId,
} from "@/presentation/ui/admin-route-metadata";

/**
 * 管理画面の「1画面1目的」と、実際に状態を変える入口のproduction正本。
 * information-priority-map.json の primary_task は、この値との一致を検査する仕様投影。
 *
 * screen task（意味）とruntime edge（置き場所）を分ける。componentを移しても
 * uiEntryだけが変わり、screen/mutationのIDとprimary taskは変わらない。
 */

type SourceEdge = {
  readonly module: string;
  readonly exportName: string;
};

type RuntimeClassification = "business-mutation" | "read-only" | "ui-demo";
export type AdminScreenTaskId = `screen:${AdminRouteId}`;

type ScreenRuntimeEntry = {
  readonly id: string;
  readonly classification: RuntimeClassification;
  readonly scope: "screen";
  readonly routeId: AdminRouteId;
  readonly ownerTaskId: AdminScreenTaskId | null;
  readonly primaryTaskAffecting: boolean;
  readonly reason: string;
  readonly uiEntry: SourceEdge;
  readonly action: SourceEdge;
};

type GlobalRuntimeEntry = {
  readonly id: string;
  readonly classification: "business-mutation";
  readonly scope: "global-shell";
  readonly ownerTaskId: null;
  readonly primaryTaskAffecting: false;
  readonly reason: string;
  readonly uiEntry: SourceEdge;
  readonly action: SourceEdge;
};

export type AdminScreenRuntimeEntry = ScreenRuntimeEntry | GlobalRuntimeEntry;

const PRIMARY_TASK_BY_ROUTE_ID = {
  "": "次に手を付ける仕事へ移動する",
  affiliate: "提携先ごとの成果金額を見る",
  "affiliate/[conversion]": "1 成果の内訳を確かめ、必要なら金額を直す",
  "ai-usage": "AI の利用量と費用を確かめる",
  analytics: "どこに手を入れるべきかを決める",
  content: "次に手を付ける記事を決める",
  "content/[variant]": "本文を読み、残すか次へ進めるか判断する",
  "content/[variant]/edit": "記事の文章を直す",
  "content/[variant]/progress": "この記事を公開へ向けて次の段階へ進める",
  "content/matrix": "誰に・どの切り口で・どの媒体へ出すかを決め、記事案を作る",
  "content/new": "記事を 1 本作る",
  distribution: "止まっている配信を見つけて対処する",
  "distribution/[publication]": "1 配信の進行を確かめ、次の操作をする",
  "distribution/[publication]/edit": "予定した配信の出し先と日時を直す",
  "distribution/calendar": "予定の偏りと承認漏れを確かめ、必要なら日時を直す",
  "distribution/new": "承認済みの記事を出し先へ登録する",
  evidence: "出所のない内容を見つける",
  feedback: "届いた改善要望から次に扱うものを選び、実装へ渡す",
  "feedback/[report]": "1 件の要望を扱うか決め、必要なら実装へ渡す",
  generation: "AI に何を渡し、どこから人が決めるかを調べる (参照専用)",
  "generation/inputs": "AI に渡す素材の過不足を見る",
  "generation/prompt": "指示文の組み立て方を読む",
  improvement: "試している比較の結果を見て、次の試作を決める",
  "improvement/dimensions": "試してよいもの / 変えないものを調べる (参照専用)",
  inbox: "成果リンクを受け取り、広告主と商品を決める",
  personas: "書き手と読者像を決める",
  "personas/audiences": "誰に向けて書くかを決める",
  products: "商品をさがして詳細へ進む",
  "products/[product]": "1 商品の内容を確かめ、素材として残すか判断する",
  "products/[product]/edit": "登録済みの商品の値を直す",
  "products/compare": "複数商品を同じ項目で比べる",
  "products/new": "商品を 1 つ登録する",
  rankings: "決めた基準での順位と、その理由を確かめる",
  "rankings/criteria": "何をどう測って並べているかを読む",
  settings: "設定したい対象へ移動する (索引)",
  "settings/appearance": "この端末での見た目を選ぶ",
  "settings/audit": "誰がいつ何をしたかを辿る",
  "settings/compliance": "広告であることの表示と、表現を止めるきまりを直す",
  "settings/integration-access": "取得用の鍵を発行・失効する",
  "settings/llm": "生成 AI の API キーを登録・確認・失効する",
  "settings/members": "誰が何を担当しているかを見る",
  "settings/roles": "役割で許される操作を確かめる",
  "settings/workspaces": "この作業場所の契約と表示を確かめる",
  sites: "運用中のブログを選ぶ / 新しく作る",
  "sites/[site]": "1 ブログの設計図を確かめ、運用を続けるか判断する",
  "sites/[site]/edit": "ブログの設計図を直す",
  "sites/new": "ブログを 1 本作る",
  tools: "AI から使える道具を調べる (参照専用)",
  "ui-catalog": "使える部品を探す (参照専用・見本帳)",
  writing: "書き方の決めごとを調べる (参照専用)",
} as const satisfies Record<AdminRouteId, string>;

export const ADMIN_SCREEN_TASK_MANIFEST = ADMIN_ROUTE_METADATA.map((route) => ({
  taskId: `screen:${route.id}` as AdminScreenTaskId,
  routeId: route.id,
  route: route.pattern,
  primaryTask: PRIMARY_TASK_BY_ROUTE_ID[route.id],
}));

const edge = (module: string, exportName: string): SourceEdge => ({ module, exportName });

function screenMutation(
  id: string,
  routeId: AdminRouteId,
  uiEntry: SourceEdge,
  action: SourceEdge,
): ScreenRuntimeEntry {
  return {
    id,
    classification: "business-mutation",
    scope: "screen",
    routeId,
    ownerTaskId: `screen:${routeId}`,
    primaryTaskAffecting: true,
    reason: "この画面のprimary taskを完了する業務状態変更",
    uiEntry,
    action,
  };
}

function classifiedScreenEntry(
  id: string,
  classification: "read-only" | "ui-demo",
  routeId: AdminRouteId,
  reason: string,
  uiEntry: SourceEdge,
  action: SourceEdge,
): ScreenRuntimeEntry {
  return {
    id,
    classification,
    scope: "screen",
    routeId,
    ownerTaskId: null,
    primaryTaskAffecting: false,
    reason,
    uiEntry,
    action,
  };
}

const contentProgressAction = edge(
  "src/presentation/admin/content-progress-action.ts",
  "advanceContentStateAction",
);
const approveContentAction = edge(
  "src/presentation/admin/content-progress-action.ts",
  "approveContentAction",
);
const schedulePublicationAction = edge(
  "src/presentation/admin/schedule-publication-action.ts",
  "schedulePublicationAction",
);
const changeFeedbackStatusAction = edge(
  "src/presentation/admin/feedback-action.ts",
  "changeFeedbackStatusAction",
);
const handOffFeedbackAction = edge(
  "src/presentation/admin/feedback-action.ts",
  "handOffFeedbackAction",
);
const manageIntegrationAccessAction = edge(
  "src/presentation/admin/feedback-action.ts",
  "manageIntegrationAccessAction",
);
const manageLlmCredentialAction = edge(
  "src/presentation/admin/llm-credential-action.ts",
  "manageLlmCredentialAction",
);
const manageMemberAction = edge(
  "src/presentation/admin/member-action.ts",
  "manageMemberAction",
);

const editPolicyRuleAction = edge(
  "src/presentation/admin/compliance-action.ts",
  "editPolicyRuleAction",
);

export const ADMIN_SCREEN_RUNTIME_ENTRIES: readonly AdminScreenRuntimeEntry[] = [
  screenMutation(
    "compliance.edit-disclosure",
    "settings/compliance",
    edge("src/presentation/admin/compliance-forms.tsx", "EditDisclosureForm"),
    edge("src/presentation/admin/compliance-action.ts", "editDisclosureAction"),
  ),
  screenMutation(
    "compliance.add-policy-rule",
    "settings/compliance",
    edge("src/presentation/admin/compliance-forms.tsx", "AddPolicyRuleForm"),
    editPolicyRuleAction,
  ),
  screenMutation(
    "compliance.stop-policy-rule",
    "settings/compliance",
    edge("src/presentation/admin/compliance-forms.tsx", "StopPolicyRuleForm"),
    editPolicyRuleAction,
  ),
  screenMutation(
    "affiliate.adjust-conversion",
    "affiliate/[conversion]",
    edge("src/presentation/admin/adjust-conversion-form.tsx", "AdjustConversionForm"),
    edge("src/presentation/admin/adjust-conversion-action.ts", "adjustConversionAction"),
  ),
  screenMutation(
    "content.create-concept-drafts",
    "content/matrix",
    edge("src/app/admin/content/matrix/page.tsx", "ContentMatrixPage"),
    edge("src/presentation/admin/concept-drafts-action.ts", "createConceptDraftsAction"),
  ),
  screenMutation(
    "content.create",
    "content/new",
    edge("src/presentation/admin/content-form.tsx", "CreateContentForm"),
    edge("src/presentation/admin/content-form-action.ts", "createContentVariantAction"),
  ),
  screenMutation(
    "content.update",
    "content/[variant]/edit",
    edge("src/presentation/admin/content-form.tsx", "UpdateContentForm"),
    edge("src/presentation/admin/content-form-action.ts", "updateContentVariantAction"),
  ),
  screenMutation(
    "content.advance",
    "content/[variant]/progress",
    edge("src/presentation/admin/content-progress-form.tsx", "AdvanceContentStateForm"),
    contentProgressAction,
  ),
  screenMutation(
    "content.approve",
    "content/[variant]/progress",
    edge("src/presentation/admin/content-progress-form.tsx", "ApproveContentForm"),
    approveContentAction,
  ),
  screenMutation(
    "content.schedule-publication",
    "content/[variant]/progress",
    edge("src/presentation/admin/schedule-publication-form.tsx", "SchedulePublicationForm"),
    schedulePublicationAction,
  ),
  screenMutation(
    "content.delete",
    "content/[variant]",
    edge("src/app/admin/content/[variant]/page.tsx", "ContentDetailPage"),
    edge("src/presentation/admin/delete-form-action.ts", "deleteContentVariantAction"),
  ),
  screenMutation(
    "distribution.schedule",
    "distribution/new",
    edge("src/presentation/admin/schedule-publication-form.tsx", "SchedulePublicationForm"),
    schedulePublicationAction,
  ),
  screenMutation(
    "distribution.update",
    "distribution/[publication]/edit",
    edge("src/presentation/admin/publication-form.tsx", "UpdatePublicationForm"),
    edge("src/presentation/admin/publication-form-action.ts", "updatePublicationAction"),
  ),
  screenMutation(
    "distribution.reschedule",
    "distribution/calendar",
    edge("src/presentation/admin/reschedule-form.tsx", "RescheduleForm"),
    edge("src/presentation/admin/reschedule-action.ts", "reschedulePublicationAction"),
  ),
  screenMutation(
    "distribution.cancel",
    "distribution/[publication]",
    edge("src/app/admin/distribution/[publication]/page.tsx", "PublicationPage"),
    edge("src/presentation/admin/delete-form-action.ts", "cancelPublicationAction"),
  ),
  screenMutation(
    "distribution.publish-article",
    "distribution/[publication]",
    edge("src/presentation/admin/publish-article-form.tsx", "PublishArticleForm"),
    edge("src/presentation/admin/publish-article-action.ts", "publishArticleAction"),
  ),
  screenMutation(
    "feedback.change-status",
    "feedback/[report]",
    edge("src/presentation/admin/feedback-forms.tsx", "FeedbackStatusForm"),
    changeFeedbackStatusAction,
  ),
  screenMutation(
    "feedback.change-disposition",
    "feedback/[report]",
    edge("src/presentation/admin/feedback-forms.tsx", "FeedbackDispositionForm"),
    changeFeedbackStatusAction,
  ),
  screenMutation(
    "feedback.handoff-list",
    "feedback",
    edge("src/presentation/admin/feedback-forms.tsx", "FeedbackHandoffForm"),
    handOffFeedbackAction,
  ),
  screenMutation(
    "feedback.handoff-detail",
    "feedback/[report]",
    edge("src/presentation/admin/feedback-forms.tsx", "FeedbackHandoffForm"),
    handOffFeedbackAction,
  ),
  screenMutation(
    "integration-access.issue",
    "settings/integration-access",
    edge("src/presentation/admin/integration-access-form.tsx", "IssueIntegrationAccessForm"),
    manageIntegrationAccessAction,
  ),
  screenMutation(
    "integration-access.revoke",
    "settings/integration-access",
    edge("src/presentation/admin/integration-access-form.tsx", "RevokeIntegrationAccessForm"),
    manageIntegrationAccessAction,
  ),
  screenMutation(
    "inbox.submit-url",
    "inbox",
    edge("src/presentation/admin/inbox-forms.tsx", "SubmitAffiliateUrlForm"),
    edge("src/presentation/admin/inbox-action.ts", "submitAffiliateUrlAction"),
  ),
  screenMutation(
    "inbox.advance",
    "inbox",
    edge("src/presentation/admin/inbox-forms.tsx", "AdvanceIngestionForm"),
    edge("src/presentation/admin/inbox-action.ts", "advanceLinkIngestionAction"),
  ),
  screenMutation(
    "improvement.draft-spec",
    "improvement",
    edge("src/presentation/admin/improvement-forms.tsx", "DraftVariantSpecForm"),
    edge("src/presentation/admin/improvement-action.ts", "draftVariantSpecAction"),
  ),
  screenMutation(
    "improvement.approve-spec",
    "improvement",
    edge("src/presentation/admin/improvement-forms.tsx", "ApproveVariantSpecForm"),
    edge("src/presentation/admin/improvement-action.ts", "approveVariantSpecAction"),
  ),
  screenMutation(
    "improvement.start-run",
    "improvement",
    edge("src/presentation/admin/improvement-forms.tsx", "StartLoopRunForm"),
    edge("src/presentation/admin/improvement-action.ts", "startLoopRunAction"),
  ),
  screenMutation(
    "improvement.advance-run",
    "improvement",
    edge("src/presentation/admin/improvement-forms.tsx", "AdvanceLoopRunForm"),
    edge("src/presentation/admin/improvement-action.ts", "advanceLoopRunAction"),
  ),
  screenMutation(
    "llm.register-key",
    "settings/llm",
    edge("src/presentation/admin/llm-credential-form.tsx", "RegisterLlmKeyForm"),
    manageLlmCredentialAction,
  ),
  screenMutation(
    "llm.verify-key",
    "settings/llm",
    edge("src/presentation/admin/llm-credential-form.tsx", "VerifyLlmKeyForm"),
    manageLlmCredentialAction,
  ),
  screenMutation(
    "llm.revoke-key",
    "settings/llm",
    edge("src/presentation/admin/llm-credential-form.tsx", "RevokeLlmKeyForm"),
    manageLlmCredentialAction,
  ),
  screenMutation(
    "member.invite",
    "settings/members",
    edge("src/presentation/admin/member-forms.tsx", "InviteMemberForm"),
    manageMemberAction,
  ),
  screenMutation(
    "member.change-roles",
    "settings/members",
    edge("src/presentation/admin/member-forms.tsx", "ChangeMemberRolesForm"),
    manageMemberAction,
  ),
  screenMutation(
    "member.revoke",
    "settings/members",
    edge("src/presentation/admin/member-forms.tsx", "RevokeMemberForm"),
    manageMemberAction,
  ),
  screenMutation(
    "product.create",
    "products/new",
    edge("src/presentation/admin/product-form.tsx", "CreateProductForm"),
    edge("src/presentation/admin/product-form-action.ts", "createProductAction"),
  ),
  screenMutation(
    "product.update",
    "products/[product]/edit",
    edge("src/presentation/admin/product-form.tsx", "UpdateProductForm"),
    edge("src/presentation/admin/product-form-action.ts", "updateProductAction"),
  ),
  screenMutation(
    "product.delete",
    "products/[product]",
    edge("src/app/admin/products/[product]/page.tsx", "ProductDetailPage"),
    edge("src/presentation/admin/delete-form-action.ts", "deleteProductAction"),
  ),
  screenMutation(
    "site.start-draft",
    "sites/new",
    edge("src/app/admin/sites/new/page.tsx", "NewSitePage"),
    edge("src/presentation/admin/site-wizard-action.ts", "startSiteDraftAction"),
  ),
  screenMutation(
    "site.save-draft-step",
    "sites/new",
    edge("src/presentation/admin/site-wizard-form.tsx", "SiteWizardStepForm"),
    edge("src/presentation/admin/site-wizard-action.ts", "saveSiteDraftStepAction"),
  ),
  screenMutation(
    "site.create-from-draft",
    "sites/new",
    edge("src/presentation/admin/site-wizard-form.tsx", "SiteWizardStepForm"),
    edge("src/presentation/admin/site-wizard-action.ts", "createSiteFromDraftAction"),
  ),
  screenMutation(
    "site.update",
    "sites/[site]/edit",
    edge("src/presentation/admin/site-form.tsx", "UpdateSiteForm"),
    edge("src/presentation/admin/site-form-action.ts", "updateManagedSiteAction"),
  ),
  screenMutation(
    "site.delete",
    "sites/[site]",
    edge("src/app/admin/sites/[site]/page.tsx", "SiteDetailPage"),
    edge("src/presentation/admin/delete-form-action.ts", "deleteManagedSiteAction"),
  ),
  {
    id: "shell.submit-feedback",
    classification: "business-mutation",
    scope: "global-shell",
    ownerTaskId: null,
    primaryTaskAffecting: false,
    reason: "全画面で改善要望を送れる横断補助口であり、各画面のprimary taskには数えない",
    uiEntry: edge("src/presentation/admin/admin-shell.tsx", "AdminShell"),
    action: edge("src/presentation/admin/feedback-action.ts", "submitFeedbackAction"),
  },
  classifiedScreenEntry(
    "persona.check-fact-boundary",
    "read-only",
    "personas",
    "文章を判定して結果を返すだけで業務状態を変更しない",
    edge("src/presentation/admin/fact-boundary-form.tsx", "FactBoundaryCheckForm"),
    edge("src/presentation/admin/fact-boundary-action.ts", "checkFactBoundaryAction"),
  ),
  classifiedScreenEntry(
    "ui-catalog.sample-submit",
    "ui-demo",
    "ui-catalog",
    "送信中表示の見本用で、signedInActorの確認後も実データを変更しない",
    edge("src/app/admin/ui-catalog/page.tsx", "UiCatalogPage"),
    edge("src/app/admin/ui-catalog/sample-action.ts", "sampleAction"),
  ),
];

/** runtime edgeを変えても、意味taskの集合が変わらないことを観測する射影。 */
export function semanticAdminTaskSet(
  screens: readonly { readonly taskId: string }[],
  runtimeEntries: readonly { readonly id: string; readonly classification: RuntimeClassification }[],
): readonly string[] {
  return [
    ...screens.map((screen) => screen.taskId),
    ...runtimeEntries
      .filter((entry) => entry.classification === "business-mutation")
      .map((entry) => `mutation:${entry.id}`),
  ].sort();
}
