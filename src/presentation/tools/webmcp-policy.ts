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
 * 読者ページに載せる道具は `reader_` で始まる（`reader-tools.ts`）。
 * これは呼びやすさのための愛称ではなく、**向き先が違う**ことの印である。
 * `reader_` の付かない `get_product` などは `read-product.ts`（運営側・`product.read` が要る）
 * を呼ぶもので、読者の身元では断られる。読者ページの画面は権限の要らない
 * 公開の道を通っているので、道具も同じ道へ揃えた（ah-83f）。
 * 揃える前は、読者ページに載っている道具が読者の権限では 1 つも動かなかった。
 *
 * 管理画面の道具は仕様書 §24 の名前のまま（別名は `spec-contract.ts` が繋いでいる）。
 */
export const PAGE_TOOLS: Readonly<Record<PageKind, readonly string[]>> = {
  // 記事ページ: 読んでいる順位と、その理由・根拠・広告表記
  article: [
    "reader_list_ranking",
    "reader_get_product",
    "reader_compare_products",
    "reader_get_evidence",
    "reader_explain_ranking",
    "reader_get_disclosure",
  ],
  // 比較ページ: 並べる・絞る・根拠・代替。順位の説明はここでは出さない
  comparison: [
    "reader_compare_products",
    "reader_get_evidence",
    "reader_filter_products",
    "reader_find_alternatives",
    "reader_get_product",
  ],
  ranking: [
    "reader_list_ranking",
    "reader_explain_ranking",
    "reader_get_product",
    "reader_get_evidence",
    "reader_find_alternatives",
  ],
  // 商品（個別レビュー）ページ。`list_test_runs` は載せない —
  // 検証の記録は画面に出ていないので、道具からだけ出すと画面より広い出口になる。
  product: [
    "reader_get_product",
    "reader_get_evidence",
    "reader_find_alternatives",
    "reader_get_disclosure",
  ],
  category: ["reader_filter_products", "reader_list_ranking", "reader_get_product"],
  site_home: ["reader_list_ranking", "reader_filter_products"],
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
