/**
 * 画面の一覧と、開くのに必要な値。**描く道具を一切持たない。**
 *
 * 管理画面は production の `ADMIN_ROUTE_METADATA` から射影する。
 * 読者画面はこのファイルがテスト入力を持つ。ファイルの実在との突き合わせは
 * `page-render.test.tsx` が担い、追加画面だけ検査から漏れる状態を止める。
 *
 * 値の出どころは見本の保存先（src/infrastructure/persistence/sample/）。
 * ここに文字列を手で作らないのは、見本データ側の識別子が変わったときに
 * 「404 を描いて 200 になっている」状態に静かに落ちるため。
 *
 * **なぜ `route-table.ts` から割ったか**（2026-08-26）。
 * この表は 2 種類の走者が読む。1 つは vitest（`renderRoute` で描く）、
 * もう 1 つは Playwright（本物の通信で開く）。後者は React も jsdom も
 * 持ち込めないので、`route-table.ts` を import できず、
 * `tests/e2e/source-registries.ts` が **TypeScript の構文木を手で辿って**
 * この表を読んでいた。
 *
 * その読み手はリテラルしか解せない。`ADMIN` が
 * `ADMIN_ROUTE_METADATA.map(...)` の射影になった日から、E2E の 2 本
 * （`app-routes.spec.ts` / `pending-hit-targets.spec.ts`）は
 * **読み込みの時点で落ちて 1 件も走らなくなっていた。**
 * 表の書き方を production 寄りに直すたびに、構文木の読み手が置いていかれる。
 *
 * だから逆にした。**描く道具に依存しない表**をここへ置き、
 * vitest も Playwright も同じものを普通に import する。構文木の解釈は消えた。
 */

import { articleHref } from "@/application/read-models/published-article";
import { siteHref } from "@/presentation/site/view-model";
import { BLOG_OPS_SAMPLE_ROUTE_IDS } from "@/infrastructure/persistence/sample/blog-ops-sample-repository";
import { SAMPLE_ARTICLES } from "@/infrastructure/persistence/sample/content-sample-data";
import { SAMPLE_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";
import { ADMIN_ROUTE_METADATA } from "@/presentation/ui/admin-route-metadata";

/** 開ける画面 1 枚分。`file` は `src/app` からの相対パス。 */
export type RouteCase = {
  /** 例: `admin/products/[product]/page.tsx` */
  readonly file: string;
  /** 動的な部分（`[product]` など）に入れる値。 */
  readonly params?: Readonly<Record<string, string>>;
  /** `?` 以降。既定の表示を見たいときは省く。 */
  readonly searchParams?: Readonly<Record<string, string | readonly string[]>>;
  /**
   * DOMを描かず、この既知pathへ移すだけのlegacy adapter。
   *
   * **`behavior: "redirect"` のような印だけにしない。**行き先まで書かせると、
   * 「移しはするが、どこへ移すかは誰も見ていない」という検査を作れなくなる。
   */
  readonly redirectTo?: string;
};

/** 見本のブログ 1 つ。読者側の画面はすべてこれで開く。 */
export const SITE = SAMPLE_SITE_SLUG;
const CANONICAL_ARTICLE = SAMPLE_ARTICLES.find((article) => article.siteSlug === SITE);
const CANONICAL_ARTICLE_SLUG = CANONICAL_ARTICLE?.slug ?? "";
/*
  旧 `/blog/:slug` の移し先を**手で書かない。**行き先は記事の種別で変わる
  （順位は `/best`、比較は `/compare`…）ので、固定の path を書くと
  見本の記事が入れ替わった日に、検査だけが古い行き先を要求する。
  画面と同じ `articleHref` から引けば、ずれようがない。
*/
const CANONICAL_ARTICLE_PATH =
  CANONICAL_ARTICLE === undefined
    ? ""
    : siteHref(SITE, articleHref(CANONICAL_ARTICLE));

/** productionの正本から射影した運営側の画面。 */
const ADMIN_PARAM_EXAMPLES: Readonly<Record<string, string>> = {
  // 2026-08-26 まで `art_sample_review` / `net_sample_root` と手で書いていた。
  // どちらも見本に無い id で、2 枚は「見つかりません」を描いたまま緑だった。
  // 見本の側から取れば、id が変わった日に型が合わなくなって気づける。
  article: BLOG_OPS_SAMPLE_ROUTE_IDS.article,
  // 見本のブランド。`SAMPLE_BRANDS` に必ず 1 件あるものを選ぶ。
  // 無い番号にすると、走査が「そのブランドがありません」の側だけを見て、
  // **欄が 1 つも描かれないまま検査が通る**。
  brand: "br_sample",
  conversion: "cv_2026_08_a",
  node: BLOG_OPS_SAMPLE_ROUTE_IDS.node,
  product: "p_alpha_15",
  publication: "pub_own_site",
  report: "fb_sample_sort",
  site: SITE,
  // `/admin/content/published/[site]/[slug]/edit` — 見本のブログに載っている
  // 公開記事 1 本。文字列を手で書かないのは `article` と同じ理由で、
  // 見本の記事が入れ替わった日に「見つかりません」を描いたまま緑になるため。
  slug: CANONICAL_ARTICLE_SLUG,
  variant: "cv_alpha_review",
};

const ADMIN: readonly RouteCase[] = ADMIN_ROUTE_METADATA.map((route) => {
  const names = [...route.pattern.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]);
  return {
    file: route.file,
    ...(route.redirectOnly
      ? {
          searchParams: { site: SITE },
          redirectTo: `/admin/sites/${encodeURIComponent(SITE)}/documents`,
        }
      : {}),
    ...(names.length === 0
      ? {}
      : {
          params: Object.fromEntries(
            names.map((name) => {
              const example = ADMIN_PARAM_EXAMPLES[name];
              /*
                **表に無い名前は、ここで止める。** 以前は `undefined` がそのまま
                params に入り、`resolveAdminRoute` が描画の途中で投げていた。
                落ちる場所が「画面を描く検査」なので、原因が
                「値の表に 1 行足し忘れた」だと読み取れず、2026-08-30 に
                `[slug]` を足したときは 18 件が同じ例外で落ちた。
                欠けを射影の時点で名指しすれば、足す場所がそのまま出る。
              */
              if (example === undefined || example === "") {
                throw new Error(
                  `ADMIN_PARAM_EXAMPLES に "${name}" の例がない（${route.pattern}）。` +
                    "見本データから引ける値を 1 行足すこと。",
                );
              }
              return [name, example];
            }),
          ),
        }),
  };
});

/** 読者側の画面。すべて見本のブログ 1 つで開く。 */
const READER: readonly RouteCase[] = [
  { file: "s/[site]/page.tsx", params: { site: SITE } },
  {
    file: "s/[site]/[fixedPage]/page.tsx",
    params: { site: SITE, fixedPage: "profile" },
    redirectTo: `/s/${encodeURIComponent(SITE)}/operator`,
  },
  { file: "s/[site]/advertising-policy/page.tsx", params: { site: SITE } },
  { file: "s/[site]/ai-policy/page.tsx", params: { site: SITE } },
  { file: "s/[site]/authors/[author]/page.tsx", params: { site: SITE, author: "mochizuki" } },
  { file: "s/[site]/best/[topic]/page.tsx", params: { site: SITE, topic: "chairs-for-long-hours" } },
  { file: "s/[site]/blog/page.tsx", params: { site: SITE } },
  {
    file: "s/[site]/blog/[article]/page.tsx",
    params: { site: SITE, article: CANONICAL_ARTICLE_SLUG },
    redirectTo: CANONICAL_ARTICLE_PATH,
  },
  { file: "s/[site]/categories/[category]/page.tsx", params: { site: SITE, category: "chairs" } },
  { file: "s/[site]/compare/[comparison]/page.tsx", params: { site: SITE, comparison: "ergo-one-vs-flexseat" } },
  { file: "s/[site]/contact/page.tsx", params: { site: SITE } },
  { file: "s/[site]/corrections/page.tsx", params: { site: SITE } },
  { file: "s/[site]/editorial-policy/page.tsx", params: { site: SITE } },
  { file: "s/[site]/experts/[expert]/page.tsx", params: { site: SITE, expert: "sakuma" } },
  { file: "s/[site]/guides/[topic]/page.tsx", params: { site: SITE, topic: "choosing-desk-lighting" } },
  { file: "s/[site]/measurement/page.tsx", params: { site: SITE } },
  { file: "s/[site]/methodology/page.tsx", params: { site: SITE } },
  { file: "s/[site]/operator/page.tsx", params: { site: SITE } },
  { file: "s/[site]/privacy/page.tsx", params: { site: SITE } },
  { file: "s/[site]/reviews/[product]/page.tsx", params: { site: SITE, product: "ergo-one-pro" } },
  { file: "s/[site]/search/page.tsx", params: { site: SITE }, searchParams: { q: "椅子" } },
  { file: "s/[site]/shortlist/page.tsx", params: { site: SITE } },
  { file: "s/[site]/terms/page.tsx", params: { site: SITE } },
  { file: "s/[site]/tokushoho/page.tsx", params: { site: SITE } },
  { file: "s/[site]/tools/[tool]/page.tsx", params: { site: SITE, tool: "desk-fit" } },
];

/** どこにも属さない入口。 */
const ENTRY: readonly RouteCase[] = [{ file: "page.tsx" }, { file: "signin/page.tsx" }];

export const ROUTE_CASES: readonly RouteCase[] = [...ENTRY, ...ADMIN, ...READER];

/**
 * 移すだけの入口かどうか。
 *
 * HTMLを返す経路と分けるのは、redirect入口を描画して
 * 404/308 を握り潰さないため。
 */
export function isRedirectRoute(
  route: RouteCase,
): route is RouteCase & { readonly redirectTo: string } {
  return route.redirectTo !== undefined;
}

/** DOM・a11y・空状態など、描画結果を分類する検査だけが使う母集団。 */
export const RENDERABLE_ROUTE_CASES: readonly RouteCase[] = ROUTE_CASES.filter(
  (route) => !isRedirectRoute(route),
);
/**
 * 運営側の画面だけ。**権限を持った身元で描き直す**検査が使う。
 *
 * 既定の描画は見本の身元（読むだけ）で走るので、権限のある人にだけ見える部分は
 * 描かれない。同じ表から回すことで、画面を足したときに両方へ自動的に入る。
 *
 * **↑ ここも 2026-08-21 まで実現していなかった。**「権限を持った身元で描き直す
 * 検査」は 1 つも存在せず、この表を使う 2 つの検査（現在地とパンくず）は
 * **どちらも見本の身元で描いていた。**——**理由は正しく、実現していないだけ。**
 * いまは `worldOf`（`route-table.ts`）が前提を足す。
 *
 * **理由書きは、書いた時点の意図であって実装の記述ではない。**
 * 読むときは説明を信じる前に、その前提を足しているコードが実在するかを見ること。
 */
export const ADMIN_ROUTE_CASES: readonly RouteCase[] = ADMIN;
export const RENDERABLE_ADMIN_ROUTE_CASES: readonly RouteCase[] = ADMIN.filter(
  (route) => !isRedirectRoute(route),
);
