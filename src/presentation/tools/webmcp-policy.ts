/**
 * ページ内 AI（WebMCP）に何を渡すかの決めごと（ブログ層 §14.2〜§14.6、統合仕様 §3）。
 *
 * 決めごとを 1 箇所に集めるのは、ページごとに書くと必ずずれるため。
 * ずれると「この記事ページだけ AI が比較できない」のような、
 * 利用者からは理由の見えない差が生まれる。
 *
 * ここが持つのは 3 つ。
 *   1. どのページ種別に、どの道具を渡すか（6 個以下）
 *   2. 機能をまとめて止められるつまみ（機能フラグ）
 *   3. 「これは 6 個以下か」「読み取り専用か」を機械で確かめられる形
 */

import { MAX_TOOLS_PER_PAGE } from "./webmcp-adapter";

export type PageKind =
  | "article"
  | "comparison"
  | "ranking"
  | "product"
  | "category"
  | "site_home"
  | "admin";

export const PAGE_KIND_LABELS: Readonly<Record<PageKind, string>> = {
  article: "記事ページ",
  comparison: "比較ページ",
  ranking: "順位ページ",
  product: "商品ページ",
  category: "カテゴリーページ",
  site_home: "ブログのトップ",
  admin: "管理画面",
};

/**
 * ページ種別ごとに渡す道具。
 *
 * **すべて読み取り専用で、6 個以下。**
 * 多いほど良いものではない。選択肢が増えるほど、エージェントは誤った道具を選ぶ。
 * また、ここに載せてよいのは「同じことが通常の画面操作でもできる」ものだけ。
 * AI からしかできない機能を作らないため。
 *
 * 名前は仕様書 §24 の名前で書く（別名は `spec-contract.ts` が繋いでいる）。
 */
export const PAGE_TOOLS: Readonly<Record<PageKind, readonly string[]>> = {
  // 記事ページ: 読んでいる順位と、その理由・根拠・広告表記
  article: ["list_ranking", "get_product", "compare_products", "get_evidence", "explain_ranking", "get_disclosure"],
  // 比較ページ: 並べる・絞る・根拠・代替。順位の説明はここでは出さない
  comparison: ["compare_products", "get_evidence", "filter_products", "find_alternatives", "get_product"],
  ranking: ["list_ranking", "explain_ranking", "get_product", "get_evidence", "find_alternatives"],
  product: ["get_product", "get_evidence", "list_test_runs", "find_alternatives", "get_disclosure"],
  category: ["filter_products", "list_ranking", "get_product"],
  site_home: ["list_ranking", "filter_products"],
  // 管理画面: 状況の把握だけ。承認と公開は人が画面で行う
  admin: [
    "list_content_board",
    "list_review_overdue",
    "list_publications",
    "list_conversions",
    "list_metrics",
    "list_managed_sites",
  ],
};

/**
 * 機能フラグの名前（統合仕様 §3「導入条件: 機能フラグ配下」）。
 *
 * 既定は有効。渡す道具は読み取り専用だけで、どれも同じことが画面でできるため、
 * 有効でも業務結果は変わらない。フラグは**まとめて止めるためのつまみ**として置く
 * （ブラウザ側の実装が変わって誤動作したときに、配り直さずに止められるように）。
 */
export const WEBMCP_FLAG = "WEBMCP_ENABLED";

const OFF_VALUES = new Set(["off", "false", "0", "no", "disabled"]);

export function isWebMcpEnabled(env: Readonly<Record<string, string | undefined>> = {}): boolean {
  const raw = env[WEBMCP_FLAG];
  if (raw === undefined) return true;
  return !OFF_VALUES.has(raw.trim().toLowerCase());
}

/** そのページ種別に渡す道具の名前。フラグが切れていれば空。 */
export function toolNamesForPage(
  kind: PageKind,
  env: Readonly<Record<string, string | undefined>> = {},
): readonly string[] {
  if (!isWebMcpEnabled(env)) return [];
  return PAGE_TOOLS[kind].slice(0, MAX_TOOLS_PER_PAGE);
}
