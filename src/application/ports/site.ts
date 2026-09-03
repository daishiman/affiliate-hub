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
export type EditorialPublishedArticleWriterPort = Editorial<PublishedArticleWriterPort>;
export type EditorialPublishedArticleAdminPort = Editorial<PublishedArticleAdminPort>;
export type EditorialPublishedContentPort = Editorial<PublishedContentPort>;
