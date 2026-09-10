import { ADMIN_ROUTE_METADATA, type AdminRouteId } from "./admin-route-metadata";

export type AdminDisclosureContract =
  | { readonly routeId: AdminRouteId; readonly strategy: "none" }
  | { readonly routeId: AdminRouteId; readonly strategy: "foldable" }
  | {
      readonly routeId: AdminRouteId;
      readonly strategy: "dedicated-route";
      readonly targetRouteId: AdminRouteId;
    };

/*
  2026-09-09: dev との合流で、宣言と実態が両方向にずれていた。

  `evidence` は「たたむ」と言い続けていたが、1 段辿っても `<Foldable>` が
  1 つも無い。逆に `blog/articles/deleted` と `blog/articles/new` は実際に
  たたんでいるのに宣言が無かった。**宣言だけが残るのも、実装だけが進むのも
  同じ壊れ方をする** — 台帳と実物のどちらを見ても、もう片方が分からなくなる。
  だから宣言は実測（`<Foldable` を描いているか）に合わせる。
*/
const FOLDABLE_ROUTES = new Set<AdminRouteId>([
  "analytics",
  "seo",
  "blog/articles/[article]",
  "blog/articles/deleted",
  "blog/articles/new",
  // 2026-09-08: `personas/audiences` は転送の殻になったため、たたむ中身を持つ
  // 実体である site 配下へ移した。転送だけの route を foldable と宣言し続けると、
  // 「たたんである」と台帳が言うのに開く物が無い状態になる。
  "sites/[site]/audience/personas",
  "feedback/[report]",
  "ui-catalog",
]);

const DEDICATED_ROUTES = new Map<AdminRouteId, AdminRouteId>([
  ["products", "products/[product]"],
  ["content", "content/[variant]"],
  ["blog/articles", "blog/articles/[article]"],
  ["sites", "sites/[site]"],
  ["distribution", "distribution/[publication]"],
  ["affiliate", "affiliate/[conversion]"],
  ["feedback", "feedback/[report]"],
]);

/**
 * ADMIN_ROUTE_METADATA の全routeを「たたむ」「専用画面へ送る」「開示なし」のいずれかへ1回だけ分類する。
 * 子routeがあるだけで dedicated にせず、一覧に実リンクがあるrouteだけを明示する。
 */
export const ADMIN_DISCLOSURE_CONTRACTS: readonly AdminDisclosureContract[] =
  ADMIN_ROUTE_METADATA.map((route) => {
    if (FOLDABLE_ROUTES.has(route.id)) return { routeId: route.id, strategy: "foldable" };
    const targetRouteId = DEDICATED_ROUTES.get(route.id);
    if (targetRouteId !== undefined) {
      return { routeId: route.id, strategy: "dedicated-route", targetRouteId };
    }
    return { routeId: route.id, strategy: "none" };
  });

const DISCLOSURE_BY_ROUTE = new Map(
  ADMIN_DISCLOSURE_CONTRACTS.map((contract) => [contract.routeId, contract]),
);

export function adminDisclosureContract(routeId: AdminRouteId): AdminDisclosureContract {
  const contract = DISCLOSURE_BY_ROUTE.get(routeId);
  if (contract === undefined) throw new Error(`Unknown admin disclosure contract: ${routeId}`);
  return contract;
}
