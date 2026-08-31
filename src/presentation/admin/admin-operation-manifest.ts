import type { AdminRouteId } from "@/presentation/ui";

/**
 * 管理画面の 16 操作セルの意味 task manifest。
 *
 * route や component の配置ではなく、「どの画面で、どの入口から、
 * どの Server Action / 読み取りを通じ、どの tool をどの権限で使うか」を
 * 1 行にする。UI を共通 component へ移しても、uiEntry の移動先だけを直せば
 * task 集合と他の edge は変わらない。
 */

export type AdminSubject = "site" | "content" | "product" | "publication";
export type AdminOperation = "list" | "create" | "update" | "delete";

type UiEntryEdge = {
  readonly module: `src/${string}.tsx`;
  readonly exportName: string;
};

type FormActionEdge =
  | {
      readonly kind: "server-action";
      readonly module: `src/${string}.ts`;
      readonly exportName: string;
    }
  | {
      readonly kind: "server-read";
      /** uiEntry が実際に呼ぶ読み取り式。 */
      readonly expression: string;
    };

type PermissionEdge = {
  readonly readOnly: boolean;
  readonly requiresHumanApproval: boolean;
};

export type AdminOperationTask = {
  readonly id: `${AdminSubject}.${AdminOperation}`;
  readonly subjectKey: AdminSubject;
  readonly subject: string;
  readonly operation: AdminOperation;
  readonly label: string;
  readonly uiEntry: UiEntryEdge;
  readonly uiRoute: `/admin/${string}`;
  readonly formAction: FormActionEdge;
  readonly tool: string;
  readonly permission: PermissionEdge;
};

export const ADMIN_OPERATION_MANIFEST = [
  {
    id: "site.list",
    subjectKey: "site",
    subject: "ブログ",
    operation: "list",
    label: "一覧",
    uiEntry: { module: "src/app/admin/sites/page.tsx", exportName: "SitesPage" },
    uiRoute: "/admin/sites",
    formAction: { kind: "server-read", expression: "uc.listSites.execute" },
    tool: "list_managed_sites",
    permission: { readOnly: true, requiresHumanApproval: false },
  },
  {
    id: "site.create",
    subjectKey: "site",
    subject: "ブログ",
    operation: "create",
    label: "作成",
    uiEntry: {
      module: "src/presentation/admin/publish/site-wizard-form.tsx",
      exportName: "SiteWizardStepForm",
    },
    uiRoute: "/admin/sites/new",
    formAction: {
      kind: "server-action",
      module: "src/presentation/admin/publish/site-wizard-action.ts",
      exportName: "createSiteFromDraftAction",
    },
    tool: "create_site_from_draft",
    permission: { readOnly: false, requiresHumanApproval: true },
  },
  {
    id: "site.update",
    subjectKey: "site",
    subject: "ブログ",
    operation: "update",
    label: "更新",
    uiEntry: { module: "src/presentation/admin/publish/site-form.tsx", exportName: "UpdateSiteForm" },
    uiRoute: "/admin/sites/[site]/edit",
    formAction: {
      kind: "server-action",
      module: "src/presentation/admin/publish/site-form-action.ts",
      exportName: "updateManagedSiteAction",
    },
    tool: "update_managed_site",
    permission: { readOnly: false, requiresHumanApproval: false },
  },
  {
    id: "site.delete",
    subjectKey: "site",
    subject: "ブログ",
    operation: "delete",
    label: "削除",
    uiEntry: { module: "src/app/admin/sites/[site]/page.tsx", exportName: "SiteDetailPage" },
    uiRoute: "/admin/sites/[site]",
    formAction: {
      kind: "server-action",
      module: "src/presentation/admin/delete-form-action.ts",
      exportName: "deleteManagedSiteAction",
    },
    tool: "delete_managed_site",
    permission: { readOnly: false, requiresHumanApproval: true },
  },
  {
    id: "content.list",
    subjectKey: "content",
    subject: "記事",
    operation: "list",
    label: "一覧",
    uiEntry: { module: "src/app/admin/content/page.tsx", exportName: "ContentPage" },
    uiRoute: "/admin/content",
    formAction: { kind: "server-read", expression: "uc.listBoard.execute" },
    tool: "list_content_board",
    permission: { readOnly: true, requiresHumanApproval: false },
  },
  {
    id: "content.create",
    subjectKey: "content",
    subject: "記事",
    operation: "create",
    label: "作成",
    uiEntry: { module: "src/presentation/admin/write/content-form.tsx", exportName: "CreateContentForm" },
    uiRoute: "/admin/content/new",
    formAction: {
      kind: "server-action",
      module: "src/presentation/admin/write/content-form-action.ts",
      exportName: "createContentVariantAction",
    },
    tool: "create_content_variant",
    permission: { readOnly: false, requiresHumanApproval: false },
  },
  {
    id: "content.update",
    subjectKey: "content",
    subject: "記事",
    operation: "update",
    label: "更新",
    uiEntry: { module: "src/presentation/admin/write/content-form.tsx", exportName: "UpdateContentForm" },
    uiRoute: "/admin/content/[variant]/edit",
    formAction: {
      kind: "server-action",
      module: "src/presentation/admin/write/content-form-action.ts",
      exportName: "updateContentVariantAction",
    },
    tool: "update_content_variant",
    permission: { readOnly: false, requiresHumanApproval: false },
  },
  {
    id: "content.delete",
    subjectKey: "content",
    subject: "記事",
    operation: "delete",
    label: "削除",
    uiEntry: {
      module: "src/app/admin/content/[variant]/page.tsx",
      exportName: "ContentDetailPage",
    },
    uiRoute: "/admin/content/[variant]",
    formAction: {
      kind: "server-action",
      module: "src/presentation/admin/delete-form-action.ts",
      exportName: "deleteContentVariantAction",
    },
    tool: "delete_content_variant",
    permission: { readOnly: false, requiresHumanApproval: true },
  },
  {
    id: "product.list",
    subjectKey: "product",
    subject: "商品",
    operation: "list",
    label: "一覧",
    uiEntry: { module: "src/app/admin/products/page.tsx", exportName: "ProductsPage" },
    uiRoute: "/admin/products",
    formAction: { kind: "server-read", expression: "uc.filterProducts.execute" },
    tool: "filter_products",
    permission: { readOnly: true, requiresHumanApproval: false },
  },
  {
    id: "product.create",
    subjectKey: "product",
    subject: "商品",
    operation: "create",
    label: "作成",
    uiEntry: { module: "src/presentation/admin/material/product-form.tsx", exportName: "CreateProductForm" },
    uiRoute: "/admin/products/new",
    formAction: {
      kind: "server-action",
      module: "src/presentation/admin/material/product-form-action.ts",
      exportName: "createProductAction",
    },
    tool: "create_product",
    permission: { readOnly: false, requiresHumanApproval: false },
  },
  {
    id: "product.update",
    subjectKey: "product",
    subject: "商品",
    operation: "update",
    label: "更新",
    uiEntry: { module: "src/presentation/admin/material/product-form.tsx", exportName: "UpdateProductForm" },
    uiRoute: "/admin/products/[product]/edit",
    formAction: {
      kind: "server-action",
      module: "src/presentation/admin/material/product-form-action.ts",
      exportName: "updateProductAction",
    },
    tool: "update_product",
    permission: { readOnly: false, requiresHumanApproval: false },
  },
  {
    id: "product.delete",
    subjectKey: "product",
    subject: "商品",
    operation: "delete",
    label: "削除",
    uiEntry: {
      module: "src/app/admin/products/[product]/page.tsx",
      exportName: "ProductDetailPage",
    },
    uiRoute: "/admin/products/[product]",
    formAction: {
      kind: "server-action",
      module: "src/presentation/admin/delete-form-action.ts",
      exportName: "deleteProductAction",
    },
    tool: "delete_product",
    permission: { readOnly: false, requiresHumanApproval: true },
  },
  {
    id: "publication.list",
    subjectKey: "publication",
    subject: "SNS投稿",
    operation: "list",
    label: "一覧",
    uiEntry: {
      module: "src/app/admin/distribution/page.tsx",
      exportName: "DistributionPage",
    },
    uiRoute: "/admin/distribution",
    formAction: { kind: "server-read", expression: "uc.listPublications.execute" },
    tool: "list_publications",
    permission: { readOnly: true, requiresHumanApproval: false },
  },
  {
    id: "publication.create",
    subjectKey: "publication",
    subject: "SNS投稿",
    operation: "create",
    label: "作成",
    uiEntry: {
      module: "src/presentation/admin/schedule-publication-form.tsx",
      exportName: "SchedulePublicationForm",
    },
    uiRoute: "/admin/distribution/new",
    formAction: {
      kind: "server-action",
      module: "src/presentation/admin/schedule-publication-action.ts",
      exportName: "schedulePublicationAction",
    },
    tool: "schedule_publication",
    permission: { readOnly: false, requiresHumanApproval: true },
  },
  {
    id: "publication.update",
    subjectKey: "publication",
    subject: "SNS投稿",
    operation: "update",
    label: "更新",
    uiEntry: {
      module: "src/presentation/admin/publish/publication-form.tsx",
      exportName: "UpdatePublicationForm",
    },
    uiRoute: "/admin/distribution/[publication]/edit",
    formAction: {
      kind: "server-action",
      module: "src/presentation/admin/publish/publication-form-action.ts",
      exportName: "updatePublicationAction",
    },
    tool: "update_publication",
    permission: { readOnly: false, requiresHumanApproval: false },
  },
  {
    id: "publication.delete",
    subjectKey: "publication",
    subject: "SNS投稿",
    operation: "delete",
    label: "取り下げ",
    uiEntry: {
      module: "src/app/admin/distribution/[publication]/page.tsx",
      exportName: "PublicationPage",
    },
    uiRoute: "/admin/distribution/[publication]",
    formAction: {
      kind: "server-action",
      module: "src/presentation/admin/delete-form-action.ts",
      exportName: "cancelPublicationAction",
    },
    tool: "cancel_publication",
    permission: { readOnly: false, requiresHumanApproval: true },
  },
] as const satisfies readonly AdminOperationTask[];

export type AdminOperationId = (typeof ADMIN_OPERATION_MANIFEST)[number]["id"];

const OPERATION_BY_ID = new Map(ADMIN_OPERATION_MANIFEST.map((task) => [task.id, task]));

/** UI が正本から tool / route を取るための唯一の参照口。 */
export function adminOperation(id: AdminOperationId): (typeof ADMIN_OPERATION_MANIFEST)[number] {
  const task = OPERATION_BY_ID.get(id);
  if (task === undefined) throw new Error(`Unknown admin operation: ${id}`);
  return task;
}

/** manifest のURLを AdminShell の route metadata キーへ写す。 */
export function adminOperationRouteId(task: AdminOperationTask): AdminRouteId {
  return task.uiRoute.slice("/admin/".length) as AdminRouteId;
}
