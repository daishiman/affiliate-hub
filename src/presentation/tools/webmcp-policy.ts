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

/**
 * 1 ページに載せてよい道具の上限。
 *
 * 多いほど良いものではない。選択肢が増えるほどエージェントは誤った道具を選ぶ。
 * 読み取り専用から始めて少数に絞る、が仕様（ブログ層 §14.4）の指示。
 *
 * **ここに置いてあるのは、上限と一覧が同じ決めごとだからである。**
 * 以前は `webmcp-adapter.ts` が持ち、この表がそれを取りに行っていた。
 * 掲載の根拠を表の側へ移した（下の `WEBMCP_LISTED_TOOLS`）ので、
 * 逆向きに参照すると輪になる。上限を表と同じ場所へ置いて向きを 1 つにした。
 * 取り出し口は `webmcp-adapter.ts` にも残してあるので、呼ぶ側は変わらない。
 */
export const MAX_TOOLS_PER_PAGE = 6;

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
 * **WebMCP に載せてよい道具の全体（③ の唯一の根拠）。**
 *
 * 上の表に名前が書いてあるものだけ。**書いていないものは載らない。**
 *
 * 以前は道具定義の `readOnly` がこれを決めていた。
 * `readOnly` は MCP の注釈（`readOnlyHint`）のために付ける旗で、
 * 「ページ内の AI へ渡してよいか」とは**別の問い**である。
 * 実際 `export_manual_draft` は「投稿はしない」という意味で `readOnly: true` と
 * 書かれ、その 1 語が黙って③に効いて**記事の本文をページ内の AI へ渡していた。**
 *
 * 旗を根拠にすると、**既定は「載る」**になる（読み取りの道具を足すと自動で候補に入る）。
 * 明示列挙を根拠にすると、**既定は「載らない」**になる。
 * 事故が起きるのは書き忘れたときなので、既定は載せない側へ倒す。
 *
 * 2026-08-21 の実測: `readOnly` を名乗る道具は 83 個、この表にあるのは 14 個。
 * 差の 69 個は、旗を根拠にしていた間ずっと**掲載の候補に入っていた。**
 */
export const WEBMCP_LISTED_TOOLS: ReadonlySet<string> = new Set(
  Object.values(PAGE_TOOLS).flat(),
);

/** その道具を WebMCP に載せてよいか。載せてよい理由は「表に書いてある」ことだけ。 */
export function isListedOnWebMcp(name: string): boolean {
  return WEBMCP_LISTED_TOOLS.has(name);
}

/**
 * 機能フラグの名前（統合仕様 §3「導入条件: 機能フラグ配下」）。
 *
 * 既定は有効。渡す道具は読み取り専用だけで、どれも同じことが画面でできるため、
 * 有効でも業務結果は変わらない。フラグは**まとめて止めるためのつまみ**として置く
 * （ブラウザ側の実装が変わって誤動作したときに、配り直さずに止められるように）。
 */
export const WEBMCP_FLAG = "WEBMCP_ENABLED";

/**
 * 「止める」と読む値の一覧。**外へ出しているのは、検査が全通りを回れるようにするため。**
 *
 * ここを閉じたままにすると、検査の側で同じ一覧を書き写すことになる。
 * 書き写した一覧は増えたときに追随しないので、値を 1 つ足しても誰も落ちない。
 */
export const WEBMCP_OFF_VALUES: readonly string[] = ["off", "false", "0", "no", "disabled"];

const OFF_VALUES = new Set(WEBMCP_OFF_VALUES);

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
