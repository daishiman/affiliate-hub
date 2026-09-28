import Link from "next/link";
import type { ReactNode } from "react";
import type { ArticleSummary } from "@/application/read-models/published-article";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import {
  HOME_SORT_LABEL,
  HOME_SORTS,
  sortArticles,
  type HomeSort,
  type RatingSummary,
} from "@/domain/blogops";
import { routesFor } from "@/domain/authoring";
import {
  ArticleList,
  CategoryDirectory,
  EmptyView,
  ErrorView,
  SiteHomeHero,
  SiteSection,
  UI_COPY,
  type ArticleCardView,
  type CategoryDirectoryItem,
} from "@/presentation/ui";
import { telemetryAttrs } from "@/presentation/ui/telemetry-attrs";
import styles from "@/presentation/ui/templates/site.module.css";
import {
  siteHref,
  siteRouteHref,
  thumbnailContextOf,
  toArticleCards,
  toChrome,
} from "./view-model";

/** 並べ替えの切り替え 1 個分。**リンクである**ことを型でも残す。 */
export type HomeSortLinkView = {
  readonly sort: HomeSort;
  readonly label: string;
  readonly href: string;
  readonly current: boolean;
};

/** ブログトップを描くために必要な、取得処理を含まない表示用の形。 */
export type SiteHomeView = {
  readonly name: string;
  readonly purpose: string;
  readonly searchHref: string;
  /** いま選ばれている並び。見出しの説明文もこれで変える。 */
  readonly sort: HomeSort;
  /** 並べ替えの切り替え。**2 本のリンク**であり、押しボタンではない。 */
  readonly sortLinks: readonly HomeSortLinkView[];
  /** 運営者が明示的に選んだ記事。保存順を保ち、後続一覧には再掲しない。 */
  readonly featuredArticles: readonly ArticleCardView[];
  /** 保存された選択数。現在非公開の選択も数え、未設定と区別する。 */
  readonly featuredSelectedCount: number;
  readonly recentArticles: readonly ArticleCardView[];
  readonly categoryItems: readonly CategoryDirectoryItem[];
  /** 記事をすべて見る先。区画の最後に置く出口。 */
  readonly allArticlesHref: string;
  /** おすすめだけが表示可能な場合も、公開記事がある事実を失わない。 */
  readonly hasPublishedArticles: boolean;
};

/** 取得失敗を表示するときの、読者向けに整形済みの文言。 */
export type SiteHomeRecentErrorView = {
  readonly title: string;
  readonly body: string;
};

/** 並びごとの、区画の説明文。読者に「何の順か」を毎回言う。 */
const SORT_LEAD: Readonly<Record<HomeSort, string>> = {
  latest: "公開・更新された記事から順に紹介します。",
  popular: "読者の評価が集まっている記事から順に紹介します。",
};

/**
 * 設計図と記事一覧を、ブログトップがそのまま描ける形へ変える。
 *
 * 本画面も静的 preview もこの変換だけを通す。取得元や外枠は共有しないため、
 * preview の都合が本番のエラー処理や認証境界へ入り込まない。
 *
 * 並べ替えは**ここでする**。画面の中で並べると、静的 preview だけ
 * 別の並びになり、見比べても違いに気づけない。
 */
export function toSiteHomeView(
  siteSlug: string,
  blueprint: PublicSiteBlueprint,
  recent: readonly ArticleSummary[],
  options: {
    readonly sort?: HomeSort;
    /** 公開 slug ごとの読者評価。**「人気」の唯一の根拠**（無ければ最新順と同じ並び）。 */
    readonly ratings?: Readonly<Record<string, RatingSummary>>;
    /** 保存順で解決済みのおすすめ記事。 */
    readonly featuredArticles?: readonly ArticleSummary[];
    /** 保存した選択数。非公開中の記事も含む。 */
    readonly featuredSelectedCount?: number;
  } = {},
): SiteHomeView {
  const chrome = toChrome(siteSlug, blueprint);
  const sort = options.sort ?? "latest";
  const thumbnails = thumbnailContextOf(blueprint);
  const featured = options.featuredArticles ?? [];
  const featuredSlugs = new Set(featured.map((article) => article.slug));
  const ordered = sortArticles(
    recent.filter((article) => !featuredSlugs.has(article.slug)),
    sort,
    options.ratings ?? {},
  );
  const blogRoute = routesFor(blueprint).find((route) => route.key === "blog");
  return {
    name: blueprint.name,
    purpose: blueprint.purpose,
    searchHref: chrome.searchHref,
    sort,
    sortLinks: HOME_SORTS.map((candidate) => ({
      sort: candidate,
      label: HOME_SORT_LABEL[candidate],
      /*
        既定の並びは `?sort=` を付けない。付けると、同じ内容のトップが
        2 つの住所を持つことになり、検索側から見て別ページに見える。
      */
      href:
        candidate === "latest"
          ? `${siteHref(siteSlug, "/")}#home-articles`
          : `${siteHref(siteSlug, "/")}?sort=${candidate}#home-articles`,
      current: candidate === sort,
    })),
    featuredArticles: toArticleCards(siteSlug, featured, thumbnails),
    featuredSelectedCount: options.featuredSelectedCount ?? featured.length,
    recentArticles: toArticleCards(siteSlug, ordered, thumbnails),
    categoryItems: blueprint.categories.map((category) => ({
      href: siteHref(siteSlug, `/categories/${category.slug}`),
      label: category.name,
      description: category.oneLine,
    })),
    allArticlesHref:
      blogRoute === undefined
        ? siteHref(siteSlug, "/blog")
        : siteRouteHref(siteSlug, blogRoute),
    hasPublishedArticles: featured.length + ordered.length > 0,
  };
}

/**
 * 並べ替えの切り替え。
 *
 * **リンクで作る。** JavaScript が動かない読者にも並べ替えが届くことを、
 * 部品の形そのもので保証する（押しボタンにすると動作の実装が要る）。
 * 選ばれている方も `aria-current` を付けたリンクのままにしてあるのは、
 * 消すと「いま何順か」を読み上げから辿れなくなるため。
 */
function HomeSortSwitch({ links }: { readonly links: readonly HomeSortLinkView[] }) {
  return (
    <nav className={styles.homeSortSwitch} aria-label="記事の並べ替え">
      {links.map((link) => (
        <Link
          key={link.sort}
          href={link.href}
          {...telemetryAttrs({ kind: "filter_control", id: `home-sort:${link.sort}` })}
          aria-current={link.current ? "true" : undefined}
          data-current={link.current ? "true" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * ブログトップの本文だけを描く純粋な部品。
 *
 * データ取得、`SiteFrame` / `SiteShell`、CSS、ファイル出力は持たない。
 * 取得失敗の判断も呼び出し側で済ませ、ここには表示用文言だけを渡す。
 *
 * 区画の順は **おすすめ → 最新/人気 → カテゴリー → 記事一覧の出口 → 補助帯**。
 * まず運営者が選んだ入口を読み、次に全体へ広げ、テーマから探す。
 * 姉妹サイトや作り手ナビゲータは、その主動線を読み終えた後の補助帯とする。
 */
export function SiteHomeContent({
  view,
  recentError,
  bandsSlot,
}: {
  readonly view: SiteHomeView;
  readonly recentError?: SiteHomeRecentErrorView;
  /**
   * 旧設定から引き継ぐ補助帯。**この部品は中身を知らない。**
   *
   * canonical な記事・カテゴリー・一覧出口より後に置く。渡されなければ
   * 区画ごと現れない（空の見出しを並べない）。
   */
  readonly bandsSlot?: ReactNode;
}) {
  return (
    <div>
      <SiteHomeHero name={view.name} purpose={view.purpose} searchHref={view.searchHref} />
      <SiteSection
        id="featured-articles"
        eyebrow="おすすめ"
        title="おすすめ記事"
        lead="編集部が、最初に読んでほしい記事を選びました。"
      >
        {view.featuredArticles.length > 0 ? (
          <ArticleList
            articles={view.featuredArticles}
            showAuthor={false}
            telemetryPlacement="おすすめ"
            emptyTitle=""
            emptyBody=""
            headingLevel="h3"
            showCategory={false}
          />
        ) : (
          <EmptyView
            title={
              view.featuredSelectedCount === 0
                ? "おすすめ記事はまだ選ばれていません"
                : "選ばれたおすすめ記事は現在公開されていません"
            }
            body={
              view.featuredSelectedCount === 0
                ? "公開中の記事は、次の一覧から読めます。"
                : "再公開されるまで、公開中の記事一覧をご覧ください。"
            }
            action={<Link href="#home-articles">最新・人気の記事を見る</Link>}
          />
        )}
      </SiteSection>
      <SiteSection
        id="home-articles"
        eyebrow="記事"
        title="記事を読む"
        lead={SORT_LEAD[view.sort]}
      >
        <HomeSortSwitch links={view.sortLinks} />
        {recentError === undefined ? (
          <ArticleList
            articles={view.recentArticles}
            showAuthor={false}
            telemetryPlacement={`トップ記事:${view.sort}`}
            emptyTitle={
              view.hasPublishedArticles ? "ほかの記事はまだありません" : UI_COPY.article.emptyListTitle
            }
            emptyBody={
              view.hasPublishedArticles
                ? "選ばれたおすすめ記事からお読みください。"
                : UI_COPY.article.emptyListBody
            }
            headingLevel="h3"
          />
        ) : (
          <ErrorView title={recentError.title} body={recentError.body} />
        )}
      </SiteSection>

      <SiteSection
        id="category-articles"
        eyebrow="カテゴリー"
        title="カテゴリーから探す"
        lead="知りたいテーマを選び、関連記事をまとめて探せます。"
      >
        {view.categoryItems.length === 0 ? (
          <EmptyView
            title="カテゴリーはまだありません"
            body="記事をテーマ別に整理しています。準備が整うまでしばらくお待ちください。"
          />
        ) : (
          <CategoryDirectory items={view.categoryItems} />
        )}
      </SiteSection>

      {!view.hasPublishedArticles ? null : (
        <SiteSection
          id="all-articles"
          eyebrow="ぜんぶ見る"
          title="記事の一覧へ"
          lead="キーワードでも、絞り込みでも、公開中の記事を通しで探せます。"
        >
          <p className={styles.homeAllArticles}>
            <Link href={view.allArticlesHref} {...telemetryAttrs({ kind: "internal_link", id: view.allArticlesHref, placement: "トップ一覧出口" })}>公開中の記事をすべて見る</Link>
          </p>
        </SiteSection>
      )}
      {bandsSlot}
    </div>
  );
}
