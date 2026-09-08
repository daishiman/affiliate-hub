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
  "affiliate/accounts/new": "提携先（ASP アカウント）を 1 つ登録する",
  "affiliate/programs/new": "提携条件（広告主と報酬の決め方）を 1 つ登録する",
  "affiliate/links": "読者に出ているリンクのうち、表記が古くなったものを止める",
  "ai-usage": "AI の利用量と費用を確かめる",
  analytics: "どこに手を入れるべきかを決める",
  content: "次に手を付ける記事を決める",
  "content/[variant]": "本文を読み、残すか次へ進めるか判断する",
  "content/[variant]/edit": "記事の文章を直す",
  "content/[variant]/progress": "この記事を公開へ向けて次の段階へ進める",
  "content/matrix": "誰に・どの切り口で・どの媒体へ出すかを決め、記事案を作る",
  "content/packages": "何のために記事を書くかを決める",
  "content/packages/new": "企画を 1 つ立てる",
  "content/new": "記事を 1 本作る",
  "content/published": "読者に出ている記事から、訂正する 1 本を探す",
  "content/published/[site]/[slug]/edit": "読者に出ている文章を訂正し、変更理由を残す",
  distribution: "止まっている配信を見つけて対処する",
  "distribution/[publication]": "1 配信の進行を確かめ、次の操作をする",
  "distribution/[publication]/edit": "予定した配信の出し先と日時を直す",
  "distribution/calendar": "予定の偏りと承認漏れを確かめ、必要なら日時を直す",
  "distribution/new": "承認済みの記事を出し先へ登録する",
  evidence: "出所のない内容を見つける",
  "evidence/new": "根拠を 1 つ登録する",
  "evidence/claims/new": "商品について言えることを 1 つ登録する",
  "evidence/test-runs/new": "実際に測った記録を 1 つ登録する",
  contact: "読者から届いた問い合わせを読み、対応の済んだものに印を付ける",
  feedback: "届いた改善要望から次に扱うものを選び、実装へ渡す",
  "feedback/[report]": "1 件の要望を扱うか決め、必要なら実装へ渡す",
  generation: "AI に何を渡し、どこから人が決めるかを調べる (参照専用)",
  "generation/inputs": "AI に渡す素材の過不足を見る",
  "generation/prompt": "指示文の組み立て方を読む",
  improvement: "試している比較の結果を見て、次の試作を決める",
  "improvement/dimensions": "試してよいもの / 変えないものを調べる (参照専用)",
  inbox: "成果リンクを受け取り、広告主と商品を決める",
  personas: "書き手と読者像を決める",
  "personas/new": "書き手を 1 人作る",
  "personas/audiences": "誰に向けて書くかを決める",
  "personas/audiences/new": "読者像を 1 つ作る",
  products: "商品をさがして詳細へ進む",
  "products/[product]": "1 商品の内容を確かめ、素材として残すか判断する",
  "products/[product]/edit": "登録済みの商品の値を直す",
  "products/compare": "複数商品を同じ項目で比べる",
  "products/new": "商品を 1 つ登録する",
  rankings: "決めた基準での順位と、その理由を確かめる",
  "rankings/criteria": "何をどう測って並べているかを読む",
  "rankings/models": "保存されている評価基準を並べ、次に使う版を選ぶ",
  "rankings/models/new": "評価基準を 1 つ作る",
  "rankings/scores": "決めた基準で、商品 1 つの点を記録する",
  settings: "設定したい対象へ移動する (索引)",
  "settings/appearance": "この端末での見た目を選ぶ",
  "settings/audit": "誰がいつ何をしたかを辿る",
  "settings/compliance": "広告であることの表示と、表現を止めるきまりを直す",
  "settings/integration-access": "取得用の鍵を発行・失効する",
  "settings/llm": "生成 AI の API キーを登録・確認・失効する",
  "settings/members": "誰が何を担当しているかを見る",
  "settings/roles": "役割で許される操作を確かめる",
  "settings/seo": "SEO/AI 指針の出典を登録し、90 日超を再確認する",
  "settings/workspaces": "この作業場所の契約と表示を確かめる",
  "settings/workspaces/edit": "作業場所の名前・契約の区分・時間帯・通貨を直す",
  "settings/brands/new": "ブランドを 1 つ作る",
  "settings/brands/[brand]": "ブランドの名前・問い合わせ先・文体を直す",
  "site-network": "ブログ同士のつながりを見て、行き止まりを見つける",
  "site-network/[node]": "1 本のつながりを直す / 外す",
  "site-network/deleted": "削除済みのつながりを確かめ、必要なら戻す",
  "site-network/new": "つながりに 1 本足す",
  blog: "ブログの見た目と中身のどこを直すか決める (索引)",
  "blog/articles": "次に手を入れる記事を決める",
  "blog/articles/[article]": "記事の中身を直し、公開まで進める",
  "blog/articles/deleted": "削除済みの記事を確かめ、必要なら戻す",
  "blog/articles/new": "記事を 1 本作る",
  "blog/delivery": "読者へ届く経路 (feed・sitemap など) の出し入れを決める",
  "blog/evaluate": "読者の評価から、手を入れる記事を選ぶ",
  "blog/evaluate/[article]": "この記事に付いた票を 1 件ずつ見て、伏せるかどうかを決める",
  "blog/layout": "ヘッダー・サイドバー・帯に何を出すか決める",
  "blog/pages": "運営が示す固定ページの不足を埋める",
  "blog/tags": "記事をまとめるタグを整える",
  sites: "運用中のブログを選ぶ / 新しく作る",
  "sites/[site]": "1 ブログの設計図を確かめ、運用を続けるか判断する",
  "sites/[site]/edit": "ブログの設計図を直す",
  "sites/[site]/documents":
    "運営者情報・各方針・規約・特定商取引法に基づく表記を書き、未記入を無くす",
  "sites/[site]/appearance": "このブログの見せ方と配色を決め、ページ単位の例外を管理する",
  "sites/[site]/placements": "記事のどこに成果リンクを出しているかを確かめ、掲載の抜けを埋める",
  "sites/[site]/domains": "このブログの住所（独自ドメイン）を登録し、読者へ見せる 1 つを決める",
  "sites/[site]/audience": "どんな読者がどこを読んでいるかを確かめ、次に直す記事を決める",
  "sites/[site]/revenue": "どの記事が稼いでいるかを確かめ、伸ばす記事と畳む記事を決める",
  "sites/[site]/seo": "検索から届かない原因を 1 つ選び、直しに行く",
  "sites/[site]/aeo": "回答エンジンに引用される形になっているかを確かめ、足りない答えを補う",
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
  "src/presentation/admin/write/content-progress-action.ts",
  "advanceContentStateAction",
);
const approveContentAction = edge(
  "src/presentation/admin/write/content-progress-action.ts",
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
  "src/presentation/admin/maintain/llm-credential-action.ts",
  "manageLlmCredentialAction",
);
const manageMemberAction = edge(
  "src/presentation/admin/maintain/member-action.ts",
  "manageMemberAction",
);
const manageGuidelineReferenceAction = edge(
  "src/presentation/admin/maintain/guideline-reference-action.ts",
  "manageGuidelineReferenceAction",
);

const editPolicyRuleAction = edge(
  "src/presentation/admin/maintain/compliance-action.ts",
  "editPolicyRuleAction",
);

export const ADMIN_SCREEN_RUNTIME_ENTRIES: readonly AdminScreenRuntimeEntry[] = [
  screenMutation(
    "compliance.edit-disclosure",
    "settings/compliance",
    edge("src/presentation/admin/maintain/compliance-forms.tsx", "EditDisclosureForm"),
    edge("src/presentation/admin/maintain/compliance-action.ts", "editDisclosureAction"),
  ),
  screenMutation(
    "compliance.add-policy-rule",
    "settings/compliance",
    edge("src/presentation/admin/maintain/compliance-forms.tsx", "AddPolicyRuleForm"),
    editPolicyRuleAction,
  ),
  screenMutation(
    "compliance.stop-policy-rule",
    "settings/compliance",
    edge("src/presentation/admin/maintain/compliance-forms.tsx", "StopPolicyRuleForm"),
    editPolicyRuleAction,
  ),
  screenMutation(
    "affiliate.adjust-conversion",
    "affiliate/[conversion]",
    edge("src/presentation/admin/earn/adjust-conversion-form.tsx", "AdjustConversionForm"),
    edge("src/presentation/admin/earn/adjust-conversion-action.ts", "adjustConversionAction"),
  ),
  screenMutation(
    "affiliate.save-account",
    "affiliate/accounts/new",
    edge("src/presentation/admin/earn/affiliate-account-form.tsx", "SaveAffiliateAccountForm"),
    edge("src/presentation/admin/earn/affiliate-form-action.ts", "saveAffiliateAccountAction"),
  ),
  screenMutation(
    "affiliate.save-program",
    "affiliate/programs/new",
    edge("src/presentation/admin/earn/affiliate-program-form.tsx", "SaveAffiliateProgramForm"),
    edge("src/presentation/admin/earn/affiliate-form-action.ts", "saveAffiliateProgramAction"),
  ),
  screenMutation(
    "affiliate.disable-link",
    "affiliate/links",
    edge("src/presentation/admin/earn/affiliate-ledger.tsx", "AffiliateLedger"),
    edge("src/presentation/admin/delete-form-action.ts", "disableAffiliateLinkAction"),
  ),
  screenMutation(
    "content.create-concept-drafts",
    "content/matrix",
    edge("src/app/admin/content/matrix/page.tsx", "ContentMatrixPage"),
    edge("src/presentation/admin/write/concept-drafts-action.ts", "createConceptDraftsAction"),
  ),
  screenMutation(
    "content.create-package",
    "content/packages/new",
    edge("src/presentation/admin/write/content-package-form.tsx", "CreateContentPackageForm"),
    edge("src/presentation/admin/write/content-package-form-action.ts", "createContentPackageAction"),
  ),
  screenMutation(
    "content.create",
    "content/new",
    edge("src/presentation/admin/write/content-form.tsx", "CreateContentForm"),
    edge("src/presentation/admin/write/content-form-action.ts", "createContentVariantAction"),
  ),
  screenMutation(
    "content.update",
    "content/[variant]/edit",
    edge("src/presentation/admin/write/content-form.tsx", "UpdateContentForm"),
    edge("src/presentation/admin/write/content-form-action.ts", "updateContentVariantAction"),
  ),
  screenMutation(
    "content.advance",
    "content/[variant]/progress",
    edge("src/presentation/admin/write/content-progress-form.tsx", "AdvanceContentStateForm"),
    contentProgressAction,
  ),
  screenMutation(
    "content.approve",
    "content/[variant]/progress",
    edge("src/presentation/admin/write/content-progress-form.tsx", "ApproveContentForm"),
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
  /*
    2026-08-30 の統合で合流した 2 件。**同じ画面の同じ form が 2 つの action を持つ。**
    訂正（`update`）と取り下げ（`archive`）は、どちらも読者に出ている文を変える
    業務状態変更だが、後戻りの仕方が違う——訂正は書き直せるが、取り下げは
    読者から消える。畳んで 1 件にすると、片方だけを止めた履歴が残らなくなる。
  */
  screenMutation(
    "published-article.update",
    "content/published/[site]/[slug]/edit",
    edge("src/presentation/admin/publish/published-article-form.tsx", "PublishedArticleForm"),
    edge("src/presentation/admin/publish/published-article-action.ts", "updatePublishedArticleAction"),
  ),
  screenMutation(
    "published-article.archive",
    "content/published/[site]/[slug]/edit",
    edge("src/presentation/admin/publish/published-article-form.tsx", "PublishedArticleForm"),
    edge("src/presentation/admin/publish/published-article-action.ts", "archivePublishedArticleAction"),
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
    edge("src/presentation/admin/publish/publication-form.tsx", "UpdatePublicationForm"),
    edge("src/presentation/admin/publish/publication-form-action.ts", "updatePublicationAction"),
  ),
  screenMutation(
    "distribution.reschedule",
    "distribution/calendar",
    edge("src/presentation/admin/publish/reschedule-form.tsx", "RescheduleForm"),
    edge("src/presentation/admin/publish/reschedule-action.ts", "reschedulePublicationAction"),
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
    edge("src/presentation/admin/publish/publish-article-form.tsx", "PublishArticleForm"),
    edge("src/presentation/admin/publish/publish-article-action.ts", "publishArticleAction"),
  ),
  screenMutation(
    "distribution.register-connection",
    "distribution",
    edge("src/presentation/admin/publish/bluesky-connection-form.tsx", "BlueskyConnectionForm"),
    edge("src/presentation/admin/publish/bluesky-connection-action.ts", "registerBlueskyConnectionAction"),
  ),
  screenMutation(
    "contact.mark-handled",
    "contact",
    edge("src/presentation/admin/maintain/contact-forms.tsx", "ContactHandledForm"),
    edge("src/presentation/admin/maintain/contact-action.ts", "markContactHandledAction"),
  ),
  screenMutation(
    "feedback.change-status",
    "feedback/[report]",
    edge("src/presentation/admin/maintain/feedback-forms.tsx", "FeedbackStatusForm"),
    changeFeedbackStatusAction,
  ),
  screenMutation(
    "feedback.change-disposition",
    "feedback/[report]",
    edge("src/presentation/admin/maintain/feedback-forms.tsx", "FeedbackDispositionForm"),
    changeFeedbackStatusAction,
  ),
  screenMutation(
    "feedback.handoff-list",
    "feedback",
    edge("src/presentation/admin/maintain/feedback-forms.tsx", "FeedbackHandoffForm"),
    handOffFeedbackAction,
  ),
  screenMutation(
    "feedback.handoff-detail",
    "feedback/[report]",
    edge("src/presentation/admin/maintain/feedback-forms.tsx", "FeedbackHandoffForm"),
    handOffFeedbackAction,
  ),
  screenMutation(
    "integration-access.issue",
    "settings/integration-access",
    edge("src/presentation/admin/maintain/integration-access-form.tsx", "IssueIntegrationAccessForm"),
    manageIntegrationAccessAction,
  ),
  screenMutation(
    "integration-access.revoke",
    "settings/integration-access",
    edge("src/presentation/admin/maintain/integration-access-form.tsx", "RevokeIntegrationAccessForm"),
    manageIntegrationAccessAction,
  ),
  screenMutation(
    "inbox.submit-url",
    "inbox",
    edge("src/presentation/admin/earn/inbox-forms.tsx", "SubmitAffiliateUrlForm"),
    edge("src/presentation/admin/earn/inbox-action.ts", "submitAffiliateUrlAction"),
  ),
  screenMutation(
    "inbox.advance",
    "inbox",
    edge("src/presentation/admin/earn/inbox-forms.tsx", "AdvanceIngestionForm"),
    edge("src/presentation/admin/earn/inbox-action.ts", "advanceLinkIngestionAction"),
  ),
  screenMutation(
    "improvement.draft-spec",
    "improvement",
    edge("src/presentation/admin/observe/improvement-forms.tsx", "DraftVariantSpecForm"),
    edge("src/presentation/admin/observe/improvement-action.ts", "draftVariantSpecAction"),
  ),
  screenMutation(
    "improvement.approve-spec",
    "improvement",
    edge("src/presentation/admin/observe/improvement-forms.tsx", "ApproveVariantSpecForm"),
    edge("src/presentation/admin/observe/improvement-action.ts", "approveVariantSpecAction"),
  ),
  screenMutation(
    "improvement.start-run",
    "improvement",
    edge("src/presentation/admin/observe/improvement-forms.tsx", "StartLoopRunForm"),
    edge("src/presentation/admin/observe/improvement-action.ts", "startLoopRunAction"),
  ),
  screenMutation(
    "improvement.advance-run",
    "improvement",
    edge("src/presentation/admin/observe/improvement-forms.tsx", "AdvanceLoopRunForm"),
    edge("src/presentation/admin/observe/improvement-action.ts", "advanceLoopRunAction"),
  ),
  screenMutation(
    "llm.register-key",
    "settings/llm",
    edge("src/presentation/admin/maintain/llm-credential-form.tsx", "RegisterLlmKeyForm"),
    manageLlmCredentialAction,
  ),
  screenMutation(
    "llm.verify-key",
    "settings/llm",
    edge("src/presentation/admin/maintain/llm-credential-form.tsx", "VerifyLlmKeyForm"),
    manageLlmCredentialAction,
  ),
  screenMutation(
    "llm.revoke-key",
    "settings/llm",
    edge("src/presentation/admin/maintain/llm-credential-form.tsx", "RevokeLlmKeyForm"),
    manageLlmCredentialAction,
  ),
  screenMutation(
    "guideline.register",
    "settings/seo",
    edge("src/presentation/admin/maintain/guideline-reference-form.tsx", "RegisterGuidelineReferenceForm"),
    manageGuidelineReferenceAction,
  ),
  screenMutation(
    "guideline.recheck",
    "settings/seo",
    edge("src/presentation/admin/maintain/guideline-reference-form.tsx", "RecheckGuidelineReferenceForm"),
    manageGuidelineReferenceAction,
  ),
  screenMutation(
    "guideline.verify-source",
    "settings/seo",
    edge("src/presentation/admin/maintain/guideline-reference-form.tsx", "VerifyGuidelineSourceForm"),
    manageGuidelineReferenceAction,
  ),
  screenMutation(
    "guideline.acknowledge-reopen",
    "settings/seo",
    edge("src/presentation/admin/maintain/guideline-reference-form.tsx", "AcknowledgeGuidelineReopenForm"),
    manageGuidelineReferenceAction,
  ),
  screenMutation(
    "member.invite",
    "settings/members",
    edge("src/presentation/admin/maintain/member-forms.tsx", "InviteMemberForm"),
    manageMemberAction,
  ),
  screenMutation(
    "member.change-roles",
    "settings/members",
    edge("src/presentation/admin/maintain/member-forms.tsx", "ChangeMemberRolesForm"),
    manageMemberAction,
  ),
  screenMutation(
    "member.revoke",
    "settings/members",
    edge("src/presentation/admin/maintain/member-forms.tsx", "RevokeMemberForm"),
    manageMemberAction,
  ),
  screenMutation(
    "persona.create-author",
    "personas/new",
    edge("src/presentation/admin/write/persona-form.tsx", "CreateAuthorPersonaForm"),
    edge("src/presentation/admin/write/persona-form-action.ts", "createAuthorPersonaAction"),
  ),
  screenMutation(
    "persona.create-audience",
    "personas/audiences/new",
    edge("src/presentation/admin/write/persona-form.tsx", "CreateAudiencePersonaForm"),
    edge("src/presentation/admin/write/persona-form-action.ts", "createAudiencePersonaAction"),
  ),
  screenMutation(
    "product.create",
    "products/new",
    edge("src/presentation/admin/material/product-form.tsx", "CreateProductForm"),
    edge("src/presentation/admin/material/product-form-action.ts", "createProductAction"),
  ),
  screenMutation(
    "product.update",
    "products/[product]/edit",
    edge("src/presentation/admin/material/product-form.tsx", "UpdateProductForm"),
    edge("src/presentation/admin/material/product-form-action.ts", "updateProductAction"),
  ),
  screenMutation(
    "product.delete",
    "products/[product]",
    edge("src/app/admin/products/[product]/page.tsx", "ProductDetailPage"),
    edge("src/presentation/admin/delete-form-action.ts", "deleteProductAction"),
  ),
  screenMutation(
    "evidence.create",
    "evidence/new",
    edge("src/presentation/admin/material/evidence-form.tsx", "CreateEvidenceForm"),
    edge("src/presentation/admin/material/evidence-form-action.ts", "createEvidenceAction"),
  ),
  screenMutation(
    "evidence.create-claim",
    "evidence/claims/new",
    edge("src/presentation/admin/material/claim-form.tsx", "CreateClaimForm"),
    edge("src/presentation/admin/material/evidence-form-action.ts", "createClaimAction"),
  ),
  screenMutation(
    "evidence.create-test-run",
    "evidence/test-runs/new",
    edge("src/presentation/admin/material/test-run-form.tsx", "CreateTestRunForm"),
    edge("src/presentation/admin/material/evidence-form-action.ts", "createTestRunAction"),
  ),
  screenMutation(
    "brand.save",
    "settings/brands/new",
    edge("src/presentation/admin/maintain/brand-form.tsx", "SaveBrandForm"),
    edge("src/presentation/admin/maintain/settings-form-action.ts", "saveBrandAction"),
  ),
  screenMutation(
    "brand.save-edit",
    "settings/brands/[brand]",
    edge("src/presentation/admin/maintain/brand-form.tsx", "SaveBrandForm"),
    edge("src/presentation/admin/maintain/settings-form-action.ts", "saveBrandAction"),
  ),
  screenMutation(
    "workspace.update",
    "settings/workspaces/edit",
    edge("src/presentation/admin/maintain/workspace-form.tsx", "UpdateWorkspaceForm"),
    edge("src/presentation/admin/maintain/settings-form-action.ts", "updateWorkspaceAction"),
  ),
  screenMutation(
    "ranking.create-model",
    "rankings/models/new",
    edge("src/presentation/admin/material/ranking-model-form.tsx", "CreateRankingModelForm"),
    edge("src/presentation/admin/material/ranking-form-action.ts", "createRankingModelAction"),
  ),
  screenMutation(
    "ranking.save-score",
    "rankings/scores",
    edge("src/presentation/admin/material/score-card-form.tsx", "SaveScoreCardForm"),
    edge("src/presentation/admin/material/ranking-form-action.ts", "saveScoreCardAction"),
  ),
  screenMutation(
    "site.start-draft",
    "sites/new",
    edge("src/app/admin/sites/new/page.tsx", "NewSitePage"),
    edge("src/presentation/admin/publish/site-wizard-action.ts", "startSiteDraftAction"),
  ),
  screenMutation(
    "site.save-draft-step",
    "sites/new",
    edge("src/presentation/admin/publish/site-wizard-form.tsx", "SiteWizardStepForm"),
    edge("src/presentation/admin/publish/site-wizard-action.ts", "saveSiteDraftStepAction"),
  ),
  screenMutation(
    "site.create-from-draft",
    "sites/new",
    edge("src/presentation/admin/publish/site-wizard-form.tsx", "SiteWizardStepForm"),
    edge("src/presentation/admin/publish/site-wizard-action.ts", "createSiteFromDraftAction"),
  ),
  screenMutation(
    "site.update",
    "sites/[site]/edit",
    edge("src/presentation/admin/publish/site-form.tsx", "UpdateSiteForm"),
    edge("src/presentation/admin/publish/site-form-action.ts", "updateManagedSiteAction"),
  ),
  screenMutation(
    "site.save-document",
    "sites/[site]/documents",
    edge("src/presentation/admin/publish/site-document-form.tsx", "SiteDocumentForm"),
    edge("src/presentation/admin/publish/site-document-action.ts", "saveSiteDocumentAction"),
  ),
  screenMutation(
    "site.save-appearance",
    "sites/[site]/appearance",
    edge("src/presentation/admin/publish/blog-appearance-form.tsx", "BlogAppearanceForm"),
    edge("src/presentation/admin/publish/blog-appearance-action.ts", "manageBlogAppearanceAction"),
  ),
  /*
    同じ画面・同じ action だが、form を畳まない。
    全体の配色を決める操作と、1 ページだけ例外を置く操作は、
    間違えたときの直し方が違う（前者は全ページに出る、後者は 1 枚だけ）。
  */
  screenMutation(
    "site.save-page-theme-override",
    "sites/[site]/appearance",
    edge("src/presentation/admin/publish/blog-appearance-form.tsx", "PageThemeOverrideForms"),
    edge("src/presentation/admin/publish/blog-appearance-action.ts", "manageBlogAppearanceAction"),
  ),
  /*
    住所（独自ドメイン）。登録と、登録済み 1 件への操作を分けてある。
    登録は「読者にはまだ見えない行を足す」だけだが、行への操作には
    正規の切り替えと取り下げが含まれ、こちらは読者が着く先を変える。
    畳むと、取り下げの重さが登録と同じに見える。
  */
  screenMutation(
    "site.register-custom-domain",
    "sites/[site]/domains",
    edge("src/presentation/admin/publish/blog-domain-form.tsx", "RegisterBlogDomainForm"),
    edge("src/presentation/admin/publish/blog-domain-action.ts", "manageBlogDomainAction"),
  ),
  screenMutation(
    "site.operate-custom-domain",
    "sites/[site]/domains",
    edge("src/presentation/admin/publish/blog-domain-form.tsx", "BlogDomainRow"),
    edge("src/presentation/admin/publish/blog-domain-action.ts", "manageBlogDomainAction"),
  ),
  /*
    観測層。読む画面の中に 1 つだけ置いた保存操作。
    日次集計は毎日自動で作り直されるが、見ているのは当日と前日だけで、
    それより前に失敗した日は空のまま残る。直す口が無いと、運営者は
    「数字が無い」のか「集計が落ちた」のかを画面から区別できない。
  */
  screenMutation(
    "site.rebuild-daily-metrics",
    "sites/[site]/audience",
    edge("src/presentation/admin/observe/metrics-rebuild-form.tsx", "RebuildDailyMetricsForm"),
    edge("src/presentation/admin/observe/metrics-rebuild-action.ts", "rebuildDailyMetricsAction"),
  ),
  /*
    改善層（SEO / AEO）。読者に出ているものは 1 つも変えない (AD-3) が、
    診断を回すこと自体は保存される操作なので、mutation として数える。
    数えないと、「押しても何も起きない画面」に見えて追跡から漏れる。
  */
  screenMutation(
    "site.assess-seo",
    "sites/[site]/seo",
    edge("src/presentation/admin/publish/blog-improvement-form.tsx", "SeoAssessForm"),
    edge("src/presentation/admin/publish/blog-improvement-action.ts", "manageBlogSeoAction"),
  ),
  screenMutation(
    "site.handle-seo-finding",
    "sites/[site]/seo",
    edge("src/presentation/admin/publish/blog-improvement-form.tsx", "SeoFindingRow"),
    edge("src/presentation/admin/publish/blog-improvement-action.ts", "manageBlogSeoAction"),
  ),
  screenMutation(
    "site.save-aeo-profile",
    "sites/[site]/aeo",
    edge("src/presentation/admin/publish/blog-improvement-form.tsx", "AeoProfileForm"),
    edge("src/presentation/admin/publish/blog-improvement-action.ts", "manageBlogAeoAction"),
  ),
  screenMutation(
    "site.extract-answer-units",
    "sites/[site]/aeo",
    edge("src/presentation/admin/publish/blog-improvement-form.tsx", "AeoExtractForm"),
    edge("src/presentation/admin/publish/blog-improvement-action.ts", "manageBlogAeoAction"),
  ),
  screenMutation(
    "site.save-placement",
    "sites/[site]/placements",
    edge("src/presentation/admin/publish/blog-placement-form.tsx", "BlogPlacementForm"),
    edge("src/presentation/admin/publish/blog-placement-action.ts", "manageBlogPlacementAction"),
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
    edge("src/presentation/admin/write/fact-boundary-form.tsx", "FactBoundaryCheckForm"),
    edge("src/presentation/admin/write/fact-boundary-action.ts", "checkFactBoundaryAction"),
  ),
  classifiedScreenEntry(
    "ui-catalog.sample-submit",
    "ui-demo",
    "ui-catalog",
    "送信中表示の見本用で、signedInActorの確認後も実データを変更しない",
    edge("src/app/admin/ui-catalog/page.tsx", "UiCatalogPage"),
    edge("src/app/admin/ui-catalog/sample-action.ts", "sampleAction"),
  ),
  screenMutation(
    "site-network.create-node",
    "site-network/new",
    edge("src/presentation/admin/publish/site-network-form.tsx", "SiteNetworkForm"),
    edge("src/presentation/admin/publish/site-network-action.ts", "manageSiteNetworkAction"),
  ),
  screenMutation(
    "site-network.update-node",
    "site-network/[node]",
    edge("src/presentation/admin/publish/site-network-form.tsx", "SiteNetworkForm"),
    edge("src/presentation/admin/publish/site-network-action.ts", "manageSiteNetworkAction"),
  ),
  screenMutation(
    "site-network.restore-node",
    "site-network/deleted",
    edge("src/presentation/admin/publish/site-network-form.tsx", "SiteNetworkRestoreForm"),
    edge("src/presentation/admin/publish/site-network-action.ts", "manageSiteNetworkAction"),
  ),
  screenMutation(
    "blog.save-layout-slot",
    "blog/layout",
    edge("src/presentation/admin/publish/blog-layout-form.tsx", "BlogLayoutSlotForm"),
    edge("src/presentation/admin/publish/blog-layout-action.ts", "manageBlogLayoutAction"),
  ),
  screenMutation(
    "blog.save-top-band",
    "blog/layout",
    edge("src/presentation/admin/publish/blog-layout-form.tsx", "BlogLayoutBandForm"),
    edge("src/presentation/admin/publish/blog-layout-action.ts", "manageBlogLayoutAction"),
  ),
  screenMutation(
    "blog.save-delivery-part",
    "blog/delivery",
    edge("src/presentation/admin/publish/blog-delivery-form.tsx", "BlogDeliveryForm"),
    edge("src/presentation/admin/publish/blog-layout-action.ts", "manageBlogDeliveryAction"),
  ),
  /*
    点検は**保存と別の意味 entry** である。同じ画面に居るが、
    保存 (`blog.save-delivery-part`) は「出す / 切る」の意思を書き、
    点検は「出せたか」の観測を積む。1 件に畳むと、保存した人が緑を作れる。
  */
  screenMutation(
    "blog.check-delivery",
    "blog/delivery",
    edge("src/presentation/admin/publish/blog-delivery-check.tsx", "BlogDeliveryCheck"),
    edge("src/presentation/admin/publish/blog-layout-action.ts", "checkBlogDeliveryAction"),
  ),
  screenMutation(
    "blog.create-article",
    "blog/articles/new",
    edge("src/presentation/admin/publish/blog-article-form.tsx", "BlogArticleCreateForm"),
    edge("src/presentation/admin/publish/blog-article-action.ts", "manageBlogArticleAction"),
  ),
  screenMutation(
    "blog.edit-article",
    "blog/articles/[article]",
    edge("src/presentation/admin/publish/blog-article-form.tsx", "BlogArticleEditForm"),
    edge("src/presentation/admin/publish/blog-article-action.ts", "manageBlogArticleAction"),
  ),
  screenMutation(
    "blog.append-expression-block",
    "blog/articles/[article]",
    edge("src/presentation/admin/publish/expression-block-form.tsx", "ExpressionBlockAppendForm"),
    edge("src/presentation/admin/publish/blog-article-action.ts", "manageBlogArticleAction"),
  ),
  screenMutation(
    "blog.restore-article",
    "blog/articles/deleted",
    edge("src/presentation/admin/publish/blog-article-form.tsx", "BlogArticleRestoreForm"),
    edge("src/presentation/admin/publish/blog-article-action.ts", "manageBlogArticleAction"),
  ),
  screenMutation(
    "blog.hide-rating",
    "blog/evaluate/[article]",
    edge("src/presentation/admin/publish/blog-rating-form.tsx", "BlogRatingHideForm"),
    edge("src/presentation/admin/publish/blog-rating-action.ts", "manageBlogRatingAction"),
  ),
  screenMutation(
    "blog.save-tag",
    "blog/tags",
    edge("src/presentation/admin/publish/blog-tag-form.tsx", "BlogTagForm"),
    edge("src/presentation/admin/publish/blog-tag-action.ts", "manageBlogTagAction"),
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
