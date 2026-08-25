import type { ArticleOffer } from "@/application/read-models/article-offer";
import type {
  ArticleSummary,
  PublishedArticle,
  PublishedPerson,
} from "@/application/read-models/published-article";
import type { ArticleType, SiteBlueprint } from "@/domain/authoring";
import type { Editorial, WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * 読者向けブログのポート。
 *
 * すべて **Editorial 区分**。読者向けの読み取り経路に、
 * 報酬に関わるポートを混ぜることはできない。
 * 混ぜられると「よく売れている商品を上に出す」実装が書けてしまう。
 *
 * ブログを何本増やしてもこの宣言は変わらない。
 * 変わるのはブループリントの設定値だけ。
 */

export type SiteRepositoryPort = {
  /** URL の名前からブログを引く。無ければ null（画面側で 404）。 */
  findBySlug(slug: string): PortResult<SiteBlueprint | null>;
  /** 運用中のブログ一覧。プラットフォーム側の一覧画面で使う。 */
  list(): PortResult<readonly { readonly slug: string; readonly blueprint: SiteBlueprint }[]>;
};

export type PublishedContentPort = {
  /** トップに出す新着。 */
  listRecent(siteSlug: string, limit: number): PortResult<readonly ArticleSummary[]>;
  /** カテゴリー内の記事。カテゴリーが空でも失敗にしない（空一覧を返す）。 */
  listByCategory(siteSlug: string, categorySlug: string): PortResult<readonly ArticleSummary[]>;
  /** 記事 1 本。 */
  findArticle(siteSlug: string, slug: string): PortResult<PublishedArticle | null>;
  /** 自然文での検索。件数 0 は失敗ではない。 */
  search(siteSlug: string, query: string, limit: number): PortResult<readonly ArticleSummary[]>;
  /** 書き手・監修者。 */
  findPerson(
    siteSlug: string,
    kind: "author" | "expert",
    slug: string,
  ): PortResult<PublishedPerson | null>;
  /** その人が書いた記事。 */
  listByPerson(siteSlug: string, personSlug: string): PortResult<readonly ArticleSummary[]>;
  /** 訂正の履歴。訂正が無いことも「無い」と表示するために、空配列で返す。 */
  listCorrections(
    siteSlug: string,
  ): PortResult<
    readonly {
      readonly id: string;
      readonly correctedAt: string;
      readonly articleSlug: string;
      /** 記事の URL を作るのに要る。訂正だけを見て記事へ戻れるようにする。 */
      readonly articleType: ArticleType;
      readonly articleTitle: string;
      readonly what: string;
      readonly why: string;
    }[]
  >;
  /** 方針などの固定文書。 */
  findPolicyDocument(
    siteSlug: string,
    key: string,
  ): PortResult<{ readonly title: string; readonly body: readonly string[] } | null>;
};

/**
 * 記事を読者ページへ出す（書き込み側）。
 *
 * 読み口（`PublishedContentPort`）と分ける理由:
 * 読者向けの経路は読むだけでよく、書ける口を混ぜると、
 * 読者からの要求で記事を書き換える経路が型の上で作れてしまう。
 *
 * 保存するのは**そのとき出した内容そのもの**（写し）。
 * 人物やカテゴリーの登録内容があとで変わっても、
 * すでに読者が読んだ記事は変わらない。
 */
export type PublishedArticleWriterPort = {
  save(workspaceId: WorkspaceId, article: PublishedArticle): PortResult<true>;
};

/**
 * 成果リンクの ID から、読者に見せる写しを引く口。
 *
 * 記事の版（`ContentVariant`）が持っているのは成果リンクの ID の列だけで、
 * URL も商品名も無い。公開の手続きはこの口を通して ID を引き当て、
 * 読者に出す商品カードを組み立てる。
 *
 * **報酬に関わる欄は写し（[[ArticleOffer]]）に無い。** 有ると、公開の手続きが
 * 「報酬の高い順に並べる」を書ける形になる（Editorial / Commercial の遮断）。
 * この口が Editorial 印なのは、そのための宣言である。
 *
 * 見つからなかった ID は**返さない**。空の写しを返すと、名前の無いカードが
 * 読者に出る。呼び出し側（公開の手続き）は、返ってこなかったぶんを
 * 「出せなかったもの」として公開の結果に出す。
 */
export type ArticleOfferPort = {
  listByIds(
    workspaceId: WorkspaceId,
    affiliateLinkIds: readonly string[],
    at: Date,
  ): PortResult<readonly ArticleOffer[]>;
};

export type EditorialSiteRepositoryPort = Editorial<SiteRepositoryPort>;
export type EditorialArticleOfferPort = Editorial<ArticleOfferPort>;
export type EditorialPublishedArticleWriterPort = Editorial<PublishedArticleWriterPort>;
export type EditorialPublishedContentPort = Editorial<PublishedContentPort>;
