import { ADMIN_ROUTE_METADATA, type AdminRouteId } from "./admin-route-metadata";

export type AdminDisclosureContract =
  | { readonly routeId: AdminRouteId; readonly strategy: "none" }
  | { readonly routeId: AdminRouteId; readonly strategy: "foldable" }
  | {
      readonly routeId: AdminRouteId;
      readonly strategy: "dedicated-route";
      readonly targetRouteId: AdminRouteId;
    };

const FOLDABLE_ROUTES = new Set<AdminRouteId>([
  "evidence",
  "personas/audiences",
  "feedback/[report]",
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
