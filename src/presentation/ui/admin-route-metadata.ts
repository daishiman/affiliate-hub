/**
 * 管理画面のroute metadataの正本。
 *
 * 画面ファイル、実URL、親子関係、パンくず、サイドバー、分類を別々の表へ
 * 書き写さない。route IDを1件追加すれば、各射影が同時に増える。
 */

import type { IconName } from "./primitives/icon";

export const ADMIN_NAV_GROUP_LABELS = {
  material: "素材",
  write: "書く",
  publish: "出す",
  earn: "稼ぐ",
  observe: "見る",
  maintain: "整える",
} as const;

export type AdminNavGroupId = keyof typeof ADMIN_NAV_GROUP_LABELS;

type NavDefinition = {
  readonly group: AdminNavGroupId | null;
  readonly requires: string | null;
  readonly icon: IconName;
};

type RouteDefinition = {
  readonly label: string | null;
  readonly parent: string | null;
  readonly nav: NavDefinition | null;
};

const nav = (
  label: string,
  group: AdminNavGroupId | null,
  requires: string | null,
  icon: IconName,
): RouteDefinition => ({ label, parent: "", nav: { group, requires, icon } });

const child = (parent: string, label: string | null): RouteDefinition => ({
  label,
  parent,
  nav: null,
});

/**
 * キーは `/admin/` より後ろのroute pattern。空文字だけが `/admin` を表す。
 * 並び順はそのままサイドバーの業務順になる。
 */
const ADMIN_ROUTE_DEFINITIONS = {
  "": { label: "ホーム", parent: null, nav: { group: null, requires: null, icon: "home" } },
  products: nav("商品", "material", "product.read", "product"),
  "products/[product]": child("products", null),
  "products/[product]/edit": child("products/[product]", "編集"),
  "products/compare": child("products", "商品を比べる"),
  "products/new": child("products", "商品を追加"),
  evidence: nav("根拠", "material", "content.read", "evidence"),
  rankings: nav("評価基準と順位", "material", "content.read", "ranking"),
  "rankings/criteria": child("rankings", "評価基準"),
  content: nav("記事", "write", "content.read", "article"),
  "content/[variant]": child("content", null),
  "content/[variant]/edit": child("content/[variant]", "文章を直す"),
  "content/[variant]/progress": child("content/[variant]", "公開までの進み具合"),
  "content/matrix": child("content", "記事案をまとめて作る"),
  "content/new": child("content", "記事を作る"),
  personas: nav("書き手と読者像", "write", "content.read", "audience"),
  "personas/audiences": child("personas", "読者像"),
  writing: nav("書き方の決めごと", "write", "content.read", "writing"),
  generation: nav("生成の仕組み", "write", "content.read", "generation"),
  "generation/inputs": child("generation", "生成に使う情報"),
  "generation/prompt": child("generation", "生成指示"),
  sites: nav("サイト", "publish", "content.read", "site"),
  "sites/[site]": child("sites", null),
  "sites/[site]/edit": child("sites/[site]", "サイトを直す"),
  "sites/new": child("sites", "サイトを作る"),
  distribution: nav("配信", "publish", "content.read", "distribution"),
  "distribution/[publication]": child("distribution", null),
  "distribution/[publication]/edit": child("distribution/[publication]", "配信を直す"),
  "distribution/calendar": child("distribution", "配信カレンダー"),
  "distribution/new": child("distribution", "配信を作る"),
  affiliate: nav("提携と成果", "earn", "affiliate.read_revenue", "affiliate"),
  "affiliate/[conversion]": child("affiliate", null),
  inbox: nav("成果リンクの受信箱", "earn", "affiliate.read_revenue", "inbox"),
  analytics: nav("数字", "observe", "analytics.read", "analytics"),
  "ai-usage": nav("AI の利用と費用", "observe", "analytics.read", "aiUsage"),
  improvement: nav("改善の状況", "observe", "analytics.read", "improvement"),
  "improvement/dimensions": child("improvement", "改善の観点"),
  feedback: nav("使い勝手を直す", "maintain", "feedback.read", "feedback"),
  "feedback/[report]": child("feedback", null),
  tools: nav("AI から使える道具", "maintain", "content.read", "tool"),
  "ui-catalog": nav("画面部品の見本", "maintain", "content.read", "component"),
  settings: nav("設定", "maintain", "content.read", "settings"),
  "settings/appearance": child("settings", "見た目"),
  "settings/audit": child("settings", "操作の記録"),
  "settings/compliance": child("settings", "広告表記ときまり"),
  "settings/integration-access": child("settings", "外部連携の権限"),
  "settings/llm": child("settings", "AI 接続"),
  "settings/members": child("settings", "メンバー"),
  "settings/roles": child("settings", "役割"),
  "settings/workspaces": child("settings", "作業場所"),
} as const satisfies Record<string, RouteDefinition>;

export type AdminRouteId = keyof typeof ADMIN_ROUTE_DEFINITIONS;

export type AdminRouteMetadata = {
  readonly id: AdminRouteId;
  readonly file: string;
  readonly pattern: string;
  readonly label: string | null;
  readonly parent: AdminRouteId | null;
  readonly nav: NavDefinition | null;
};

const patternOf = (id: AdminRouteId): string => (id === "" ? "/admin" : `/admin/${id}`);
const fileOf = (id: AdminRouteId): string =>
  id === "" ? "admin/page.tsx" : `admin/${id}/page.tsx`;

export const ADMIN_ROUTE_METADATA: readonly AdminRouteMetadata[] = Object.entries(
  ADMIN_ROUTE_DEFINITIONS,
).map(([id, definition]) => ({
  id: id as AdminRouteId,
  file: fileOf(id as AdminRouteId),
  pattern: patternOf(id as AdminRouteId),
  label: definition.label,
  parent: definition.parent as AdminRouteId | null,
  nav: definition.nav,
}));

const ROUTE_BY_ID = new Map(ADMIN_ROUTE_METADATA.map((route) => [route.id, route]));

function metadataOf(id: AdminRouteId): AdminRouteMetadata {
  const route = ROUTE_BY_ID.get(id);
  if (route === undefined) throw new Error(`Unknown admin route: ${id}`);
  return route;
}

function fillPattern(
  pattern: string,
  params: Readonly<Record<string, string>>,
): string {
  return pattern.replace(/\[([^\]]+)\]/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Missing admin route parameter: ${name}`);
    return encodeURIComponent(value);
  });
}

function ancestorsOf(route: AdminRouteMetadata): readonly AdminRouteMetadata[] {
  const ancestors: AdminRouteMetadata[] = [];
  let parent = route.parent;
  while (parent !== null) {
    const metadata = metadataOf(parent);
    ancestors.unshift(metadata);
    parent = metadata.parent;
  }
  return ancestors;
}

export type AdminBreadcrumb = { readonly label: string; readonly href?: string };

export type ResolvedAdminRoute = {
  readonly actualRoutePath: string;
  readonly navContextPath: string;
  readonly breadcrumbs: (
    currentLabel: string,
    dynamicLabels?: Readonly<Partial<Record<AdminRouteId, string>>>,
  ) => readonly AdminBreadcrumb[];
};

/** 実route、選択中ナビ、パンくずを同じroute IDから別々に射影する。 */
export function resolveAdminRoute(
  id: AdminRouteId,
  params: Readonly<Record<string, string>> = {},
): ResolvedAdminRoute {
  const route = metadataOf(id);
  const ancestors = ancestorsOf(route);
  const navRoute = [...ancestors, route].findLast((candidate) => candidate.nav !== null);
  if (navRoute === undefined) throw new Error(`Admin route has no nav ancestor: ${id}`);

  return {
    actualRoutePath: fillPattern(route.pattern, params),
    navContextPath: navRoute.pattern,
    breadcrumbs: (currentLabel, dynamicLabels = {}) => [
      ...ancestors.map((ancestor) => {
        const label = ancestor.label ?? dynamicLabels[ancestor.id];
        if (label === undefined) {
          throw new Error(`Missing breadcrumb label for admin route: ${ancestor.id}`);
        }
        return { label, href: fillPattern(ancestor.pattern, params) };
      }),
      { label: route.label ?? currentLabel },
    ],
  };
}
