import type { ArticleOffer } from "@/application/read-models/article-offer";
import type {
  ArticleSummary,
  PublishedArticle,
  PublishedPerson,
} from "@/application/read-models/published-article";
import type { ArticleType, SiteBlueprint, SiteDocumentKey } from "@/domain/authoring";
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

/**
 * ブランド 1 つと、それを扱っている記事の本数。
 *
 * 同じブランドを 2 度出す記事があっても 1 本と数える
 * （読者が知りたいのは「読める記事が何本あるか」であって、
 * 商品カードが何枚あるかではない）。
 */
export type BrandTally = {
  readonly name: string;
  readonly articleCount: number;
};

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
  /**
   * このブログが扱っているブランドと、その本数。
   *
   * 記事に出ている商品カードから数える。**商品台帳を引かない。**
   * 台帳を引くと、まだ記事にしていない商品のブランドまで出て、
   * 読者は「押しても記事が 1 本も無い」導線を渡される。
   *
   * 扱いが 0 本のブランドは返さない（数える対象がそもそも記事だから、
   * 0 本のブランドはここに現れようが無い）。
   */
  listBrands(siteSlug: string): PortResult<readonly BrandTally[]>;
  /** 書き手・監修者。 */
  findPerson(
    siteSlug: string,
    kind: "author" | "expert",
    slug: string,
  ): PortResult<PublishedPerson | null>;
  /** その人が書いた／監修した記事。役割を混ぜない。 */
  listByPerson(
    siteSlug: string,
    kind: "author" | "expert",
    personSlug: string,
  ): PortResult<readonly ArticleSummary[]>;
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
  /** 公開の写しだけを外す。編集原稿と監査履歴は消さない。 */
  unpublish(workspaceId: WorkspaceId, siteSlug: string, slug: string): PortResult<true>;
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

/**
 * ブログの固定文書（運営者情報・各方針・規約）の読み書き。
 *
 * 読者向けの `findPolicyDocument` と**同じ行を読む**。別々に持つと、
 * 管理画面で直した文と読者に出る文が食い違い、しかもその食い違いは
 * 両方の画面を並べて見た人にしか分からない。
 *
 * 本文は段落の配列で持つ。1 つの長い文字列にすると、
 * 改行の扱いが保存先ごとに変わる（読者に出る段落が消える事故がここで起きる）。
 */
export type SiteDocument = {
  /** `SITE_DOCUMENT_KEYS` の値。ルート表から導かれる。 */
  readonly key: SiteDocumentKey;
  readonly title: string;
  readonly body: readonly string[];
  /** まだ 1 度も保存していないものは null（「未整備」を日付の不在で表す）。 */
  readonly updatedAt: Date | null;
};

export type SiteDocumentRepositoryPort = {
  /** そのブログに保存されている文書。**未整備のものは返さない**（空欄を作らない）。 */
  listBySite(
    workspaceId: WorkspaceId,
    siteSlug: string,
  ): PortResult<readonly SiteDocument[]>;
  save(
    workspaceId: WorkspaceId,
    siteSlug: string,
    document: Pick<SiteDocument, "key" | "title" | "body">,
  ): PortResult<true>;
};

/**
 * 公開済み記事を運営者が訂正・非表示化する口。
 *
 * 読者の `PublishedContentPort` と分け、必ず workspaceId で絞る。
 * `archive` は物理削除ではなく、公開側から隠す操作である。
 */
export type PublishedArticleAdminPort = {
  list(
    workspaceId: WorkspaceId,
  ): PortResult<readonly { readonly article: PublishedArticle; readonly archivedAt: string | null }[]>;
  find(
    workspaceId: WorkspaceId,
    siteSlug: string,
    slug: string,
  ): PortResult<{ readonly article: PublishedArticle; readonly archivedAt: string | null } | null>;
  replace(workspaceId: WorkspaceId, article: PublishedArticle): PortResult<boolean>;
  archive(
    workspaceId: WorkspaceId,
    siteSlug: string,
    slug: string,
    archivedAt: string,
  ): PortResult<boolean>;
};

export type EditorialSiteRepositoryPort = Editorial<SiteRepositoryPort>;
export type EditorialSiteDocumentRepositoryPort = Editorial<SiteDocumentRepositoryPort>;
export type EditorialArticleOfferPort = Editorial<ArticleOfferPort>;
export type EditorialPublishedArticleWriterPort = Editorial<PublishedArticleWriterPort>;
export type EditorialPublishedArticleAdminPort = Editorial<PublishedArticleAdminPort>;
export type EditorialPublishedContentPort = Editorial<PublishedContentPort>;
