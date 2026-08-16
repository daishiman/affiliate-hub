/**
 * 画面の一覧と、開くのに必要な値。
 *
 * これは「テストの入力」であると同時に、**画面が何本あるかの正本**でもある。
 * ファイルの実在と突き合わせる検査（page-render.test.tsx §1）を必ず一緒に置くこと。
 * 突き合わせが無いと、この表は「書いた人が知っている画面の一覧」に劣化し、
 * **後から足した画面だけが検査されないまま残る**。抜けるのはいつも新しい画面である。
 *
 * 値の出どころは見本の保存先（src/infrastructure/persistence/sample/）。
 * ここに文字列を手で作らないのは、見本データ側の識別子が変わったときに
 * 「404 を描いて 200 になっている」状態に静かに落ちるため。
 */

import { SAMPLE_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";

/** 開ける画面 1 枚分。`file` は `src/app` からの相対パス。 */
export type RouteCase = {
  /** 例: `admin/products/[product]/page.tsx` */
  readonly file: string;
  /** 動的な部分（`[product]` など）に入れる値。 */
  readonly params?: Readonly<Record<string, string>>;
  /** `?` 以降。既定の表示を見たいときは省く。 */
  readonly searchParams?: Readonly<Record<string, string | string[]>>;
};

const SITE = SAMPLE_SITE_SLUG;

/** 運営側の画面。 */
const ADMIN: readonly RouteCase[] = [
  { file: "admin/page.tsx" },
  { file: "admin/affiliate/page.tsx" },
  { file: "admin/affiliate/[conversion]/page.tsx", params: { conversion: "cv_2026_08_a" } },
  { file: "admin/ai-usage/page.tsx" },
  { file: "admin/analytics/page.tsx" },
  { file: "admin/content/page.tsx" },
  { file: "admin/content/[variant]/page.tsx", params: { variant: "cv_alpha_review" } },
  { file: "admin/content/matrix/page.tsx" },
  { file: "admin/distribution/page.tsx" },
  { file: "admin/distribution/[publication]/page.tsx", params: { publication: "pub_own_site" } },
  { file: "admin/distribution/calendar/page.tsx" },
  { file: "admin/evidence/page.tsx" },
  { file: "admin/generation/page.tsx" },
  { file: "admin/improvement/page.tsx" },
  { file: "admin/improvement/dimensions/page.tsx" },
  { file: "admin/inbox/page.tsx" },
  { file: "admin/personas/page.tsx" },
  { file: "admin/products/page.tsx" },
  { file: "admin/products/[product]/page.tsx", params: { product: "p_alpha_15" } },
  { file: "admin/products/compare/page.tsx" },
  { file: "admin/rankings/page.tsx" },
  { file: "admin/settings/page.tsx" },
  { file: "admin/sites/page.tsx" },
  { file: "admin/sites/[site]/page.tsx", params: { site: SITE } },
  { file: "admin/sites/new/page.tsx" },
  { file: "admin/tools/page.tsx" },
  { file: "admin/ui-catalog/page.tsx" },
  { file: "admin/writing/page.tsx" },
];

/** 読者側の画面。すべて見本のブログ 1 つで開く。 */
const READER: readonly RouteCase[] = [
  { file: "s/[site]/page.tsx", params: { site: SITE } },
  { file: "s/[site]/advertising-policy/page.tsx", params: { site: SITE } },
  { file: "s/[site]/ai-policy/page.tsx", params: { site: SITE } },
  { file: "s/[site]/authors/[author]/page.tsx", params: { site: SITE, author: "miwa" } },
  { file: "s/[site]/best/[topic]/page.tsx", params: { site: SITE, topic: "laptops-for-video-editing" } },
  { file: "s/[site]/categories/[category]/page.tsx", params: { site: SITE, category: "laptops" } },
  { file: "s/[site]/compare/[comparison]/page.tsx", params: { site: SITE, comparison: "alpha-vs-beta" } },
  { file: "s/[site]/contact/page.tsx", params: { site: SITE } },
  { file: "s/[site]/corrections/page.tsx", params: { site: SITE } },
  { file: "s/[site]/editorial-policy/page.tsx", params: { site: SITE } },
  { file: "s/[site]/experts/[expert]/page.tsx", params: { site: SITE, expert: "arai" } },
  { file: "s/[site]/guides/[topic]/page.tsx", params: { site: SITE, topic: "choosing-storage" } },
  { file: "s/[site]/measurement/page.tsx", params: { site: SITE } },
  { file: "s/[site]/methodology/page.tsx", params: { site: SITE } },
  { file: "s/[site]/privacy/page.tsx", params: { site: SITE } },
  { file: "s/[site]/reviews/[product]/page.tsx", params: { site: SITE, product: "alpha-studio-15" } },
  { file: "s/[site]/search/page.tsx", params: { site: SITE }, searchParams: { q: "ノートパソコン" } },
  { file: "s/[site]/shortlist/page.tsx", params: { site: SITE } },
  { file: "s/[site]/terms/page.tsx", params: { site: SITE } },
  { file: "s/[site]/tools/[tool]/page.tsx", params: { site: SITE, tool: "storage-estimator" } },
];

/** どこにも属さない入口。 */
const ENTRY: readonly RouteCase[] = [{ file: "page.tsx" }, { file: "signin/page.tsx" }];

export const ROUTE_CASES: readonly RouteCase[] = [...ENTRY, ...ADMIN, ...READER];

/**
 * 同じ画面を別の状態でもう一度開く場合。
 *
 * 状態違いを `ROUTE_CASES` に混ぜないのは、そこが**画面の本数**を表す表であり、
 * 混ぜるとファイルとの突き合わせができなくなるため。
 */
export const ROUTE_STATE_CASES: readonly (RouteCase & { readonly state: string })[] = [
  { state: "検索語が空のとき", file: "s/[site]/search/page.tsx", params: { site: SITE } },
  {
    state: "見つからない商品を指定したとき",
    file: "s/[site]/reviews/[product]/page.tsx",
    params: { site: SITE, product: "存在しない商品" },
  },
  {
    state: "存在しないブログを指定したとき",
    file: "s/[site]/page.tsx",
    params: { site: "no-such-site" },
  },
  { state: "対応待ちだけを見るとき", file: "admin/inbox/page.tsx", searchParams: { state: "pending" } },
  {
    state: "前の月を見るとき",
    file: "admin/affiliate/page.tsx",
    searchParams: { period: "2026-07" },
  },
];

/** 画面を読み込むときの指定。`renderRoute` に渡す。 */
export function importPathOf(file: string): string {
  return `@/app/${file.replace(/\.tsx$/, "")}`;
}

/** Next.js が画面に渡す形（`params` も `searchParams` も Promise）に整える。 */
export function propsOf(route: RouteCase): Record<string, unknown> {
  return {
    params: Promise.resolve(route.params ?? {}),
    searchParams: Promise.resolve(route.searchParams ?? {}),
  };
}
