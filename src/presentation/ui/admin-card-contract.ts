import type { AdminRouteId } from "./admin-route-metadata";

/**
 * 情報台帳で card を主表現にした管理 route の正本。
 *
 * ここでいう card は route 全体を囲う箱ではなく、個体の判断単位を並べる表現分類。
 * 実画面は Card・用途別 Form・FactList のいずれかで単位を分ける。Section は
 * 86 画面すべてに現れて単位を分けないため、ここでは印として数えない。
 */
export const ADMIN_CARD_ROUTE_IDS = [
  "products/[product]",
  "products/[product]/edit",
  "products/new",
  "evidence/new",
  "evidence/claims/new",
  "evidence/test-runs/new",
  "rankings/criteria",
  "rankings/models/new",
  "content/[variant]",
  "content/[variant]/edit",
  "content/[variant]/progress",
  "content/packages/new",
  "content/new",
  "content/published/[site]/[slug]/edit",
  "personas/new",
  "personas/audiences/new",
  "site-network/[node]",
  "site-network/new",
  "blog/articles/[article]",
  "blog/articles/new",
  "blog/evaluate/[article]",
  "blog/layout",
  "blog/pages",
  "blog/tags",
  "sites",
  "sites/[site]",
  "sites/[site]/edit",
  "sites/[site]/documents",
  "sites/[site]/appearance",
  "sites/[site]/placements",
  "sites/new",
  "distribution/[publication]",
  "distribution/[publication]/edit",
  "distribution/new",
  "affiliate/[conversion]",
  "affiliate/accounts/new",
  "affiliate/programs/new",
  "contact",
  "feedback/[report]",
  "settings/workspaces/edit",
  "settings/brands/new",
  "settings/brands/[brand]",
] as const satisfies readonly AdminRouteId[];

export type AdminCardRouteId = (typeof ADMIN_CARD_ROUTE_IDS)[number];

// 以前ここにあった ADMIN_CARD_CONTRACTS は 36 route 全件へ同一の定数
// ({ unitRenderers, routeWrapper: false }) を配るだけで route ごとの差が 1 つも無く、
// 描画コードからの参照も 0 件だった。主張 120 字・補助 4 以下といった制約は
// Card 本体 (src/presentation/ui/templates/app-shell.tsx) が実行時 throw で持っており、
// 型と throw が正本。二重管理をやめ、card 主表現の route 集合だけをここに残す。
