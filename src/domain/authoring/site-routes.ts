import type { SiteBlueprint, StandardPage } from "./site-blueprint";

/**
 * ブログの画面の並び（情報アーキテクチャ）。
 *
 * ブログ層仕様 §7 の 18 ルートをここで表として持つ
 * （加えて「計測について」を 1 本足している。測るなら説明先が要る）。
 * **ルートを画面ファイルの有無で決めない。** 表を正本にして、
 * 「表にあるのに画面が無い」「画面があるのに表に無い」を
 * `tests/domain/site-routes.test.ts` が機械的に落とす。
 *
 * ブログを 1 本増やしてもこの表は変わらない。
 * 変わるのはブループリントの設定値だけ（変更容易性シナリオ③）。
 */

/** 画面の種類。ルートの形と、必要なデータの種類を決める。 */
export type RouteKind =
  /** 一覧を出す。1 件も無いことがありうる。 */
  | "listing"
  /** 記事 1 本。広告表示が必要。 */
  | "article"
  /** 人物の紹介。 */
  | "profile"
  /** 方針・規約などの固定文書。 */
  | "policy"
  /** 保存済み固定ページ。実際の語彙と公開可否は blogops の正本で決める。 */
  | "fixed-page"
  /** 操作する画面（検索・候補の保存・問い合わせ）。 */
  | "interactive";

export type SiteRoute = {
  readonly key: string;
  /** ルートの型。`{name}` は差し込み位置。 */
  readonly path: string;
  /** 画面の見出し。 */
  readonly label: string;
  readonly kind: RouteKind;
  /**
   * どこから来るか。**孤立ページを作らない**ための欄。
   * 空にできない（型で必須）。
   */
  readonly reachedFrom: string;
  /** ブループリントのどのページ設定に対応するか。無い場合は常に出す。 */
  readonly page: StandardPage | null;
  /** 広告表示（ステマ規制対応）が要るか。 */
  readonly requiresDisclosure: boolean;
};

/**
 * 18 ルート。並びは仕様書 §7 の順。
 *
 * `/privacy` と `/terms` は仕様上 1 項目にまとめられているが、
 * 画面は別なので 2 行に分けている。
 * ここに仕様書の 18 項目のほか、「計測について」1 本と
 * ブログの記事 2 本（一覧・記事）を足してあり、合計 22 行になる。
 */
export const SITE_ROUTES: readonly SiteRoute[] = [
  {
    key: "home",
    path: "/",
    label: "トップ",
    kind: "listing",
    reachedFrom: "サイトの入口",
    page: "home",
    requiresDisclosure: false,
  },
  {
    key: "category",
    path: "/categories/{category}",
    label: "カテゴリー",
    kind: "listing",
    reachedFrom: "トップ + 全ページ共通のナビゲーション",
    page: "category",
    requiresDisclosure: false,
  },
  {
    key: "ranking",
    path: "/best/{topic}",
    label: "おすすめ順位",
    kind: "article",
    reachedFrom: "トップ・カテゴリーページ",
    page: "ranking",
    requiresDisclosure: true,
  },
  {
    key: "review",
    path: "/reviews/{product}",
    label: "個別レビュー",
    kind: "article",
    reachedFrom: "順位表の商品名・比較表の商品名",
    page: "review",
    requiresDisclosure: true,
  },
  {
    key: "comparison",
    path: "/compare/{comparison}",
    label: "比較",
    kind: "article",
    reachedFrom: "カテゴリーページ・記事内リンク",
    page: "comparison",
    requiresDisclosure: true,
  },
  {
    key: "guide",
    path: "/guides/{topic}",
    label: "選び方・使い方",
    kind: "article",
    reachedFrom: "トップの初心者向け導線・カテゴリーページ",
    page: "how_to_choose",
    requiresDisclosure: true,
  },
  {
    /*
      ブログの記事一覧（feat-blog-ops-crud）。**`page: null` にしてある。**
      記事の並びは設計図の設定ではなく「書いた記事があるかどうか」で決まる。
      設定で消せる作りにすると、記事を書いたのに読者から辿れないブログが作れてしまう。
    */
    key: "blog",
    path: "/blog",
    label: "記事一覧",
    kind: "listing",
    reachedFrom: "全ページ共通のヘッダー・トップの新着",
    page: null,
    requiresDisclosure: false,
  },
  {
    /*
      記事 1 本。広告表示が要る（`requiresDisclosure: true`）。
      本文に商品への案内が入りうるので、入っていない記事でも
      **表示の有無を記事ごとの判断に委ねない。**
    */
    key: "blog-article",
    path: "/blog/{article}",
    label: "記事",
    kind: "article",
    reachedFrom: "記事一覧・タグ・関連記事",
    page: null,
    requiresDisclosure: true,
  },
  {
    /*
      固定ページ8種のうち contact 以外を受ける動的route。
      `{fixedPage}` を既定footerへ直接出さず、保存済み・公開済みの具体的なリンクは
      PublicSiteProjection が canonical 語彙から組み立てる。
    */
    key: "fixed-page",
    path: "/{fixedPage}",
    label: "運営情報の固定ページ",
    kind: "fixed-page",
    reachedFrom: "公開済み固定ページのフッターリンク",
    page: null,
    requiresDisclosure: false,
  },
  {
    key: "tool",
    path: "/tools/{tool}",
    label: "診断・計算",
    kind: "interactive",
    reachedFrom: "トップ・カテゴリーページ",
    page: "tools",
    requiresDisclosure: false,
  },
  {
    key: "search",
    path: "/search",
    label: "探す",
    kind: "interactive",
    reachedFrom: "全ページ共通のヘッダー",
    page: "search",
    requiresDisclosure: false,
  },
  {
    key: "shortlist",
    path: "/shortlist",
    label: "気になる商品",
    kind: "interactive",
    reachedFrom: "商品カードの保存操作・ヘッダー",
    page: "shortlist",
    requiresDisclosure: true,
  },
  {
    key: "author",
    path: "/authors/{author}",
    label: "書き手",
    kind: "profile",
    reachedFrom: "記事の書き手名",
    page: "authors",
    requiresDisclosure: false,
  },
  {
    key: "expert",
    path: "/experts/{expert}",
    label: "監修者",
    kind: "profile",
    reachedFrom: "記事の監修者表示",
    page: "experts",
    requiresDisclosure: false,
  },
  {
    key: "methodology",
    path: "/methodology",
    label: "評価方法",
    kind: "policy",
    reachedFrom: "記事の評価基準の説明・フッター",
    page: "methodology",
    requiresDisclosure: false,
  },
  {
    key: "editorial-policy",
    path: "/editorial-policy",
    label: "編集方針",
    kind: "policy",
    reachedFrom: "フッター",
    page: "editorial_policy",
    requiresDisclosure: false,
  },
  {
    key: "advertising-policy",
    path: "/advertising-policy",
    label: "広告に関する方針",
    kind: "policy",
    reachedFrom: "フッター + 記事の広告表示",
    page: "advertising_policy",
    requiresDisclosure: false,
  },
  {
    key: "ai-policy",
    path: "/ai-policy",
    label: "AI の使い方",
    kind: "policy",
    reachedFrom: "フッター",
    page: "ai_policy",
    requiresDisclosure: false,
  },
  {
    key: "corrections",
    path: "/corrections",
    label: "訂正",
    kind: "policy",
    reachedFrom: "フッター + 記事の訂正報告",
    page: "corrections",
    requiresDisclosure: false,
  },
  {
    key: "privacy",
    path: "/privacy",
    label: "個人情報の扱い",
    kind: "policy",
    reachedFrom: "フッター",
    page: "privacy",
    requiresDisclosure: false,
  },
  {
    /*
      計測についての説明。**測るなら必ず置く。**
      「何を記録するか」の説明先が無いまま同意を求めるのは、
      同意を取ったことにならない。`page: null` にしてあるので
      どのブログでも必ず出る（設定で消せない）。
    */
    key: "measurement",
    path: "/measurement",
    label: "計測について",
    kind: "policy",
    reachedFrom: "フッター / 計測のお願い",
    page: null,
    requiresDisclosure: false,
  },
  {
    key: "terms",
    path: "/terms",
    label: "利用規約",
    kind: "policy",
    reachedFrom: "フッター",
    page: "terms",
    requiresDisclosure: false,
  },
  {
    key: "contact",
    path: "/contact",
    label: "問い合わせ",
    kind: "interactive",
    reachedFrom: "フッター",
    page: "contact",
    requiresDisclosure: false,
  },
];

/**
 * このブログで出すルート。
 *
 * ブループリントの `pages` に無いページは出さない。
 * ただし信頼に関わるページ（方針・訂正・問い合わせ）は
 * `TRUST_REQUIRED_PAGES` により必ず `pages` に入るため、常に出る。
 */
/**
 * 出す画面の一覧。
 *
 * 受け取るのは `pages` だけ。設計図まるごとを要求すると、
 * 読者向けに識別子を落とした設計図をここへ渡せなくなる。
 * **関数が実際に読む項目だけを要求する**、を型でも守る。
 */
export function routesFor(blueprint: Pick<SiteBlueprint, "pages">): readonly SiteRoute[] {
  return SITE_ROUTES.filter((r) => r.page === null || blueprint.pages.includes(r.page));
}

/** フッターに出すもの。信頼のための固定ページ。 */
export function footerRoutes(blueprint: Pick<SiteBlueprint, "pages">): readonly SiteRoute[] {
  return routesFor(blueprint).filter((r) => r.kind === "policy" || r.key === "contact");
}

/** 実際の URL を作る。差し込み値が足りなければ型ではなく実行時に分かる。 */
export function buildPath(
  route: SiteRoute,
  params: Readonly<Record<string, string>> = {},
): string {
  return route.path.replace(/\{(\w+)\}/g, (whole, key: string) => params[key] ?? whole);
}

/** ルートの引き当て。無い名前を渡したら null（画面側で 404 にする）。 */
export function findRoute(key: string): SiteRoute | null {
  return SITE_ROUTES.find((r) => r.key === key) ?? null;
}
