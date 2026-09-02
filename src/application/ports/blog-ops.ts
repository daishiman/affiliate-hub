import type {
  ArticleBlockKind,
  ArticleRating,
  ArticleTemplate,
  BlogArticle,
  BlogArticleBlock,
  BlogArticleStatus,
  BlogTagKind,
  DeliveryPart,
  LayoutRegion,
  NetworkRole,
  NetworkStatus,
  RatingSummary,
  SiteNetworkNode,
  TopBand,
} from "@/domain/blogops";
import type { WorkspaceId } from "@/domain/shared";
import type { SiteBlueprint } from "@/domain/authoring";
import type {
  ArticleSummary,
  PublishedArticle,
} from "@/application/read-models/published-article";
import type { SiteDocument } from "./site";
import type { PortResult } from "./common";

/**
 * ブログ運用（作成者向け）のポート。
 *
 * すべて **Editorial 区分**。読者に見える面の並び・記事・タグを扱うので、
 * 報酬に関わるポートをここへ混ぜると「報酬の高い記事を上に出す」実装が書ける。
 *
 * 名前を `*RepositoryPort` にしてあるのは飾りではない。
 * `tests/architecture/tenant-scoped-ports.test.ts` はこの語尾の型だけを見て、
 * 全メソッドが `workspaceId` を取るかを検査する。語尾を変えると検査から外れる。
 */

export type SiteNetworkRecord = SiteNetworkNode;

/** 通常一覧から分離した削除済みの節点。元データと削除日時を失わない。 */
export type DeletedSiteNetworkRecord = {
  readonly node: SiteNetworkRecord;
  readonly deletedAt: Date;
};

export type BlogLayoutSlotRecord = {
  readonly id: string;
  readonly siteSlug: string;
  readonly region: LayoutRegion;
  readonly slotKey: string;
  readonly title: string;
  readonly body: string;
  readonly position: number;
  readonly enabled: boolean;
};

export type BlogLayoutBandRecord = {
  readonly id: string;
  readonly siteSlug: string;
  readonly band: TopBand;
  readonly title: string;
  readonly enabled: boolean;
  readonly position: number;
  /** 帯に並べる件数の上限。0 は「置くが空」ではなく「1 件も出さない」。 */
  readonly itemLimit: number;
};

export type BlogDeliveryPartRecord = {
  readonly id: string;
  readonly siteSlug: string;
  readonly part: DeliveryPart;
  readonly enabled: boolean;
  readonly note: string;
  readonly position: number;
};

/**
 * 配信物を生成してみた結果 1 件 (受入 A9)。
 *
 * `BlogDeliveryPartRecord` (出す / 切るの設定) と**別の型**にしてある。
 * 1 つに畳むと、設定を保存したときに結果まで一緒に書き換わり、
 * 「いつの結果か」が言えなくなる。
 */
export type BlogDeliverySnapshotRecord = {
  readonly id: string;
  readonly siteSlug: string;
  readonly part: DeliveryPart;
  readonly ok: boolean;
  readonly detail: string;
  readonly checkedAt: Date;
};

export type BlogTagRecord = {
  readonly id: string;
  readonly siteSlug: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  /** ブランドか話題か。`brand-tag-cloud` に出るのは `brand` だけ。 */
  readonly kind: BlogTagKind;
};

/** 記事 1 本と、その本文の部品・付いているタグ。画面 1 枚が要る分をまとめて返す。 */
export type BlogArticleDetail = {
  readonly article: BlogArticle;
  readonly blocks: readonly BlogArticleBlock[];
  readonly tagIds: readonly string[];
};

/** 記事集約を丸ごと保持する削除済み read model。本文・タグ結合は削除しない。 */
export type DeletedBlogArticleRecord = BlogArticleDetail & {
  readonly deletedAt: Date;
};

export type SaveSiteNetworkInput = {
  readonly id: string;
  readonly siteSlug: string;
  readonly role: NetworkRole;
  readonly parentSlug: string | null;
  readonly name: string;
  readonly oneLine: string;
  readonly position: number;
  readonly status: NetworkStatus;
};

export type SaveBlogArticleInput = {
  readonly id: string;
  readonly siteSlug: string;
  readonly slug: string;
  readonly template: ArticleTemplate;
  readonly title: string;
  readonly lead: string;
  readonly status: BlogArticleStatus;
  readonly authorName: string;
  /** 公開projectionの分類。下書きはnull、公開時はsite blueprintとの一致が必須。 */
  readonly categorySlug: string | null;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
  readonly blocks: readonly {
    readonly id: string;
    readonly kind: ArticleBlockKind;
    readonly heading: string;
    readonly body: string;
    readonly position: number;
  }[];
  readonly tagIds: readonly string[];
  /** null/undefined は新規作成。更新は画面が読んだ版番を渡す。 */
  readonly expectedRevision?: number | null;
};

/**
 * 作成者向けの保管庫。
 *
 * 全メソッドの第一引数が `workspaceId` なのは、
 * 同じ役割を持つ別の会社の人が他社のブログ構成を読めないようにするため。
 */
export type BlogOpsRepositoryPort = {
  listNetwork(workspaceId: WorkspaceId): PortResult<readonly SiteNetworkRecord[]>;
  listDeletedNetwork(workspaceId: WorkspaceId): PortResult<readonly DeletedSiteNetworkRecord[]>;
  findNetworkNode(workspaceId: WorkspaceId, nodeId: string): PortResult<SiteNetworkRecord | null>;
  saveNetworkNode(workspaceId: WorkspaceId, input: SaveSiteNetworkInput): PortResult<true>;
  deleteNetworkNode(workspaceId: WorkspaceId, nodeId: string, deletedAt: Date): PortResult<true>;
  restoreNetworkNode(workspaceId: WorkspaceId, nodeId: string, restoredAt: Date): PortResult<true>;

  listLayoutSlots(workspaceId: WorkspaceId, siteSlug: string): PortResult<readonly BlogLayoutSlotRecord[]>;
  saveLayoutSlot(workspaceId: WorkspaceId, input: BlogLayoutSlotRecord): PortResult<true>;
  listLayoutBands(workspaceId: WorkspaceId, siteSlug: string): PortResult<readonly BlogLayoutBandRecord[]>;
  saveLayoutBand(workspaceId: WorkspaceId, input: BlogLayoutBandRecord): PortResult<true>;

  listDeliveryParts(
    workspaceId: WorkspaceId,
    siteSlug: string | null,
  ): PortResult<readonly BlogDeliveryPartRecord[]>;
  saveDeliveryPart(workspaceId: WorkspaceId, input: BlogDeliveryPartRecord): PortResult<true>;

  /** 点検の記録は**積む**。上書きにすると「いつ壊れたか」が消える。 */
  listDeliverySnapshots(
    workspaceId: WorkspaceId,
    siteSlug: string | null,
  ): PortResult<readonly BlogDeliverySnapshotRecord[]>;
  saveDeliverySnapshot(
    workspaceId: WorkspaceId,
    input: BlogDeliverySnapshotRecord,
  ): PortResult<true>;

  listArticles(workspaceId: WorkspaceId, siteSlug: string | null): PortResult<readonly BlogArticle[]>;
  listDeletedArticles(
    workspaceId: WorkspaceId,
    siteSlug: string | null,
  ): PortResult<readonly DeletedBlogArticleRecord[]>;
  findArticle(workspaceId: WorkspaceId, articleId: string): PortResult<BlogArticleDetail | null>;
  /** 一覧の適合判定用。記事ごとの N+1 読み取りを避ける。 */
  listArticleBlockKinds(
    workspaceId: WorkspaceId,
    articleIds: readonly string[],
  ): PortResult<Readonly<Record<string, readonly ArticleBlockKind[]>>>;
  saveArticle(workspaceId: WorkspaceId, input: SaveBlogArticleInput): PortResult<true>;
  deleteArticle(workspaceId: WorkspaceId, articleId: string, deletedAt: Date): PortResult<true>;
  restoreArticle(workspaceId: WorkspaceId, articleId: string, restoredAt: Date): PortResult<true>;

  listTags(workspaceId: WorkspaceId, siteSlug: string): PortResult<readonly BlogTagRecord[]>;
  saveTag(workspaceId: WorkspaceId, input: BlogTagRecord): PortResult<true>;
  deleteTag(workspaceId: WorkspaceId, tagId: string): PortResult<true>;

  /** 記事ごとの評価の集計。 */
  summarizeRatings(
    workspaceId: WorkspaceId,
    articleIds: readonly string[],
  ): PortResult<Readonly<Record<string, RatingSummary>>>;

  /**
   * 記事 1 本に付いた票を 1 件ずつ。**伏せたものも返す。**
   *
   * 集計 (`summarizeRatings`) と分けてある。集計は「読者に見える数」なので
   * 伏せた票が消えるのが正しいが、こちらは運営者が「何を伏せたか」を
   * 確かめる口なので、**伏せたものが消えたら用を成さない。**
   */
  listRatings(
    workspaceId: WorkspaceId,
    articleId: string,
  ): PortResult<readonly ArticleRating[]>;

  /** 票を伏せる／戻す。**行は消さない。** */
  setRatingHidden(
    workspaceId: WorkspaceId,
    ratingId: string,
    hidden: boolean,
  ): PortResult<true>;
};

/**
 * 閲覧者の評価のポート。
 *
 * **記事を読み書きするポートと分けてある。** 読者からの要求で動くのはここだけで、
 * ここに記事の保存メソッドが無いことが、
 * 「読者の操作で記事本文が書き換わる経路」を型の上で作れなくしている。
 *
 * `*RepositoryPort` を名乗らないのは、読者に作業場所（workspace）が無いため。
 * 既に `SiteRepositoryPort.findBySlug` が同じ理由で会社の絞り込みを免除されている。
 * 所属は `articleId` が決める。
 */
export type ArticleRatingPort = {
  /** 評価を 1 件置く。同じ読者が押し直したら上書きする（票が増えない）。 */
  put(input: {
    readonly id: string;
    readonly articleId: string;
    readonly readerKey: string;
    readonly score: number;
    readonly comment: string | null;
    readonly createdAt: Date;
  }): PortResult<true>;
  /** 記事 1 本の平均と件数。0 件は失敗ではない。 */
  summarize(articleId: string): PortResult<RatingSummary>;
};

/**
 * 読者に見える面の読み取り。
 *
 * 作成者向けの `BlogOpsRepositoryPort` と分けているのは、
 * 公開状態の記事しか返さない口を型で分けるため。
 * 同じ口にすると、下書きが読者側の一覧へ出る事故が実装ミス 1 つで起きる。
 */
export type PublicSiteReader = {
  /** workspaceId を落とした公開用設計図。request 内で解決した正本と同じもの。 */
  readonly blueprint: Omit<SiteBlueprint, "workspaceId">;
  /** 公開本文は canonical public projection からだけ読む。 */
  findArticleBySlug(slug: string): PortResult<PublishedArticle | null>;
  /** 公開一覧は本文と同じ projection の要約。 */
  listPublished(limit: number): PortResult<readonly ArticleSummary[]>;
  /** 編集 aggregate から公開した記事だけが持つ、評価の対象 ID。 */
  findSourceArticleId(slug: string): PortResult<string | null>;
  /** 描画用。enabled の枠だけを返す。 */
  listLayoutSlots(): PortResult<readonly BlogLayoutSlotRecord[]>;
  /** 作成完了判定用。disabled を含む未削除の枠実体を返す。 */
  listProvisionedLayoutSlots(): PortResult<readonly BlogLayoutSlotRecord[]>;
  /** 描画用。enabled の帯だけを返す。 */
  listLayoutBands(): PortResult<readonly BlogLayoutBandRecord[]>;
  /** 作成完了判定用。disabled を含む未削除の帯実体を返す。 */
  listProvisionedLayoutBands(): PortResult<readonly BlogLayoutBandRecord[]>;
  listDeliveryParts(): PortResult<readonly BlogDeliveryPartRecord[]>;
  listNetwork(): PortResult<readonly SiteNetworkRecord[]>;
  listTags(): PortResult<readonly BlogTagRecord[]>;
  /**
   * このブログに保存されているサイト文書。**未整備のものは返さない。**
   *
   * 描画のための読み口ではなく、公開投影が `provisioningComplete` を
   * 判定するための件数確認である。文書の本文は `PolicyPage` が
   * `findPolicyDocument` から直接読む（同じ行を 2 つの道で読まない）。
   */
  listDocuments(): PortResult<readonly SiteDocument[]>;
};

export type PublicBlogPort = {
  /**
   * URL を request ごとに一度だけ公開 identity へ解決する。
   * null は「存在するサイトだが記事が空」ではなく、公開サイト自体が無いことを表す。
   */
  openSite(siteSlug: string): PortResult<PublicSiteReader | null>;
};
