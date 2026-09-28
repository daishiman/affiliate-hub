import { ARTICLE_TYPES, type ArticleType } from "./article-structure";
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
  /** 旧固定ページ URL。互換写像で canonical policy URL へ転送する。 */
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
 * 30 行。並びは仕様書 §7 の順で、**索引はその記事の直前に置く**。
 *
 * `/privacy` と `/terms` は仕様上 1 項目にまとめられているが、
 * 画面は別なので 2 行に分けている。
 * ここに仕様書の 18 項目のほか、「計測について」1 本、
 * ブログの記事 2 本（一覧・記事）、
 * 記事タイプの索引 5 本（`/best`・`/reviews`・`/compare`・`/guides`・`/tools`）
 * を足してあり、合計 30 行になる。
 *
 * --- 索引 5 本を足した理由（2026-09-05・残課題 ah-milz） ---
 *
 * `/best/{topic}` の親は `/best` である。にもかかわらず `/best` には
 * 画面が無く、**根に置いた動的ルート `/{fixedPage}` が受けていた。**
 * 記事のパンくずは「おすすめ順位 › 記事名」と出るのに、
 * 「おすすめ順位」は行き先を持たない**押せない文字**だった。
 *
 * 押せると思って押す文字を置くのは、置かないより悪い。
 * 索引を作れば、パンくずの親が本物のリンクになり、
 * `BreadcrumbList` にも実在する親 URL を載せられる。
 */
export const SITE_ROUTES = [
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
    /*
      おすすめ順位の索引。**記事と同じ `page` を持たせてある。**
      設定で順位記事を出さないブログでは索引も出ない。別々にすると、
      記事が 1 本も出ないブログに空の索引だけが残る。

      名札は記事ルートと同じ言葉にしてある。パンくずの親のリンク文字と
      索引の見出しが違う言葉になると、押した読者は別の場所へ来たと感じる。
    */
    key: "ranking-index",
    path: "/best",
    label: "おすすめ順位",
    kind: "listing",
    reachedFrom: "順位記事のパンくず・トップ・カテゴリーページ",
    page: "ranking",
    requiresDisclosure: false,
  },
  {
    key: "ranking",
    path: "/best/{topic}",
    label: "おすすめ順位",
    kind: "article",
    reachedFrom: "おすすめ順位の索引・トップ・カテゴリーページ",
    page: "ranking",
    requiresDisclosure: true,
  },
  {
    key: "review-index",
    path: "/reviews",
    label: "個別レビュー",
    kind: "listing",
    reachedFrom: "レビュー記事のパンくず・トップ",
    page: "review",
    requiresDisclosure: false,
  },
  {
    key: "review",
    path: "/reviews/{product}",
    label: "個別レビュー",
    kind: "article",
    reachedFrom: "個別レビューの索引・順位表の商品名・比較表の商品名",
    page: "review",
    requiresDisclosure: true,
  },
  {
    key: "comparison-index",
    path: "/compare",
    label: "比較",
    kind: "listing",
    reachedFrom: "比較記事のパンくず・トップ・カテゴリーページ",
    page: "comparison",
    requiresDisclosure: false,
  },
  {
    key: "comparison",
    path: "/compare/{comparison}",
    label: "比較",
    kind: "article",
    reachedFrom: "比較の索引・カテゴリーページ・記事内リンク",
    page: "comparison",
    requiresDisclosure: true,
  },
  {
    key: "guide-index",
    path: "/guides",
    label: "選び方・使い方",
    kind: "listing",
    reachedFrom: "選び方の記事のパンくず・トップの初心者向け導線",
    page: "how_to_choose",
    requiresDisclosure: false,
  },
  {
    key: "guide",
    path: "/guides/{topic}",
    label: "選び方・使い方",
    kind: "article",
    reachedFrom: "選び方・使い方の索引・トップの初心者向け導線・カテゴリーページ",
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
      固定文書8種のうち contact 以外に使われていた旧URLを受ける動的route。
      `FixedPageKind` は互換写像にだけ使い、`SiteDocumentKey` の canonical URLへ
      308転送する。文書の読み取り・公開可否判定・footer投影はこのrouteで行わない。
    */
    key: "fixed-page",
    path: "/{fixedPage}",
    label: "旧固定ページURL（転送）",
    kind: "fixed-page",
    reachedFrom: "旧URLの外部リンク・ブックマーク",
    page: null,
    requiresDisclosure: false,
  },
  {
    /*
      道具の索引だけは `kind: "listing"`。道具そのものは操作する画面だが、
      索引は「どんな道具があるか」を並べるだけで、操作は 1 つも持たない。
    */
    key: "tool-index",
    path: "/tools",
    label: "診断・計算",
    kind: "listing",
    reachedFrom: "道具のページのパンくず・トップ・カテゴリーページ",
    page: "tools",
    requiresDisclosure: false,
  },
  {
    key: "tool",
    path: "/tools/{tool}",
    label: "診断・計算",
    kind: "interactive",
    reachedFrom: "診断・計算の索引・トップ・カテゴリーページ",
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
    /*
      運営者情報。**`page: null`（設定で消せない）にしてある。**

      誰が運営しているか分からないブログは、読者にとって
      「書いてあることを誰の責任で読めばよいか」が無い状態になる。
      設定で消せる形にすると、消えていること自体に誰も気づかない。
    */
    key: "operator",
    path: "/operator",
    label: "運営者情報",
    kind: "policy",
    reachedFrom: "フッター",
    page: null,
    requiresDisclosure: false,
  },
  {
    /*
      特定商取引法に基づく表記。こちらも `page: null`。

      アフィリエイトだけなら販売者ではないので必須とは限らないが、
      **必要かどうかを画面の有無で表さない。** 必要になった日に
      「無い」ことに気づける場所が要る。中身が未整備なら未整備と出す。
    */
    key: "tokushoho",
    path: "/tokushoho",
    label: "特定商取引法に基づく表記",
    kind: "policy",
    reachedFrom: "フッター",
    page: null,
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
] as const satisfies readonly SiteRoute[];

/**
 * 本文が固定文書として**編集できない**ルート。
 *
 * 訂正は記事の訂正履歴から、計測についてはこちらの計測の作りから
 * それぞれ本文が組み上がる。編集できる文書として並べると、
 * 打ち込んだ本文と実際に出る本文が別物になる。
 */
type SiteRouteEntry = (typeof SITE_ROUTES)[number];
type PolicySiteRoute = Extract<SiteRouteEntry, { readonly kind: "policy" }>;

const GENERATED_POLICY_ROUTES = [
  "corrections",
  "measurement",
] as const satisfies readonly PolicySiteRoute["key"][];
type GeneratedPolicyRouteKey = (typeof GENERATED_POLICY_ROUTES)[number];
type SiteDocumentRoute = Exclude<PolicySiteRoute, { readonly key: GeneratedPolicyRouteKey }>;
export type SiteDocumentKey = SiteDocumentRoute["key"];

function isSiteDocumentRoute(route: SiteRouteEntry): route is SiteDocumentRoute {
  return (
    route.kind === "policy" &&
    !(GENERATED_POLICY_ROUTES as readonly string[]).includes(route.key)
  );
}

/**
 * 固定文書として編集できるページの鍵。
 *
 * **ルート表から導く。手で並べない。** 手で並べると、ルートを 1 本足した日に
 * 「画面はあるのに編集できない（＝見本のまま出続ける）」ページが生まれ、
 * それは公開されるまで誰にも見えない。
 *
 * 保存先は `legal_page` 表。表の `kind` はこの鍵をそのまま入れる。
 */
export const SITE_DOCUMENT_KEYS: readonly SiteDocumentKey[] = SITE_ROUTES.filter(
  isSiteDocumentRoute,
).map((route) => route.key);

/**
 * `legal_page.kind` で、8種のブログ固定ページと共有できない4種。
 *
 * privacy / terms / operator / tokushoho は既存の公開語彙に対応するが、
 * この4種には対応先が無い。近い名前へ寄せると、2つの画面が同じ行を
 * 上書きするため、保存上だけの独立した名札を持つ。
 */
export const SITE_DOCUMENT_ONLY_STORAGE_KINDS = [
  "methodology",
  "editorial_policy",
  "advertising_policy",
  "ai_policy",
] as const;
export type SiteDocumentOnlyStorageKind =
  (typeof SITE_DOCUMENT_ONLY_STORAGE_KINDS)[number];

/** 編集画面のURL鍵 → `legal_page.kind`。全鍵の写像はここ1か所に限定する。 */
export const SITE_DOCUMENT_KIND_BY_KEY = {
  methodology: "methodology",
  "editorial-policy": "editorial_policy",
  "advertising-policy": "advertising_policy",
  "ai-policy": "ai_policy",
  privacy: "privacy_policy",
  terms: "site_policy",
  operator: "profile",
  tokushoho: "commercial_transaction",
} as const satisfies Readonly<Record<SiteDocumentKey, string>>;
export type SiteDocumentStorageKind =
  (typeof SITE_DOCUMENT_KIND_BY_KEY)[SiteDocumentKey];

/** 固定文書の名札。画面の見出しと同じ言葉を使う（別名を作らない）。 */
export const SITE_DOCUMENT_LABEL = Object.fromEntries(
  SITE_DOCUMENT_KEYS.map((key) => [key, findRoute(key)?.label ?? key]),
) as Readonly<Record<SiteDocumentKey, string>>;

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

/**
 * 記事タイプ → その索引ルートの鍵。
 *
 * `satisfies Record<ArticleType, …>` にしてあるので、記事タイプを 1 つ足すと
 * **ここが型で赤くなる。**索引を作らないまま記事タイプだけ増えると、
 * その種類の記事のパンくずの親だけが押せない文字に戻る。
 */
export const ARTICLE_INDEX_ROUTE_KEY = {
  ranking: "ranking-index",
  review: "review-index",
  comparison: "comparison-index",
  guide: "guide-index",
  tool: "tool-index",
} as const satisfies Readonly<Record<ArticleType, string>>;

/**
 * 記事タイプの索引ルート。**URL も名札もここ 1 か所から出す。**
 *
 * 記事画面のパンくずの親と、索引画面自身の見出しが同じ言葉になるのは
 * 両方がこれを呼ぶからである。画面側に文字列で持たせると、
 * 「おすすめ順位」を押したら「ランキング」という見出しが出る、が作れてしまう。
 */
export function articleIndexRoute(type: ArticleType): SiteRoute {
  const key = ARTICLE_INDEX_ROUTE_KEY[type];
  const route = findRoute(key);
  /*
    表に無いのはコードの誤りで、読者の入力では起こらない。
    既定値で塞ぐと、パンくずの親だけが別の言葉のまま公開される。黙らせない。
  */
  if (route === null) throw new Error(`ルート表に ${key} がありません`);
  return route;
}

// ---------------------------------------------------------------------------
// 機械（検索・AI 検索）へ渡してよい入口
// ---------------------------------------------------------------------------

/**
 * 中身が**閲覧者ごとに違う**ルート。sitemap には載せない。
 *
 * `/search` はクエリが無ければ入力欄しか無く、`/shortlist` はその端末に
 * 保存した商品だけを出す。クローラーが開くとどちらも中身が空になる。
 * 空の URL を「これが私のページです」と差し出すのは、渡さないより悪い。
 *
 * **`kind: "interactive"` で括らない。**`/contact` も interactive だが、
 * こちらは誰が開いても同じ案内が出る本物の固定ページで、載せてよい。
 * 分けているのは操作の有無ではなく「中身が閲覧者に依るか」である。
 */
const VIEWER_SPECIFIC_ROUTE_KEYS = [
  "search",
  "shortlist",
] as const satisfies readonly SiteRouteEntry["key"][];

/**
 * その URL を機械へ差し出してよいか。
 *
 * 落とすのは 3 種類だけ:
 * 1. `{name}` を含む型（値を知らないと URL にならない。記事・カテゴリー・
 *    書き手などは、値を持っている呼び出し側が別に足す）
 * 2. 旧 URL の転送ルート（`kind: "fixed-page"`。308 で別の URL へ送るので、
 *    載せると canonical でない住所を宣伝することになる）
 * 3. 閲覧者ごとに中身が違うルート（上の `VIEWER_SPECIFIC_ROUTE_KEYS`）
 */
export function isCrawlableRoute(route: SiteRoute): boolean {
  return (
    !route.path.includes("{") &&
    route.kind !== "fixed-page" &&
    !(VIEWER_SPECIFIC_ROUTE_KEYS as readonly string[]).includes(route.key)
  );
}

/** 全記事を並べる一覧。設定では消せない、ブログの骨格そのもの。 */
const ALL_ARTICLE_LISTING_KEYS = [
  "home",
  "blog",
] as const satisfies readonly SiteRouteEntry["key"][];

const ARTICLE_INDEX_KEYS: readonly string[] = ARTICLE_TYPES.map(
  (type) => ARTICLE_INDEX_ROUTE_KEY[type],
);

/**
 * この画面が並べる記事の選び方。sitemap の `lastmod` と
 * 「空の索引を載せない」判定の両方がここを見る。
 *
 * - `all`: 全記事（トップ・記事一覧）
 * - `under-path`: その道の下の記事（記事タイプの索引。`/best` に対する `/best/…`）
 * - `none`: 一覧ではない（方針・問い合わせなど）
 *
 * **記事タイプの索引を path の形で見分けない。**「1 段の道は索引」と読むと、
 * `/measurement` のような固定ページまで索引に見える。鍵で引く。
 */
export function listedArticleScope(route: SiteRoute): "all" | "under-path" | "none" {
  if ((ALL_ARTICLE_LISTING_KEYS as readonly string[]).includes(route.key)) return "all";
  if (ARTICLE_INDEX_KEYS.includes(route.key)) return "under-path";
  return "none";
}
