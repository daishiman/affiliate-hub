import type {
  AffiliateAccount,
  AffiliateLink,
  AffiliateProgram,
  AffiliatePreview,
  AspKind,
  Conversion,
  LinkIngestion,
  LinkIngestionState,
  ProductSnapshot,
} from "@/domain/monetization";
import type {
  AffiliateAccountId,
  AffiliateLinkId,
  AffiliateProgramId,
  Commercial,
  ConversionId,
  LinkIngestionId,
  ProductId,
  WorkspaceId,
} from "@/domain/shared";
import type { PageRequest, Paged, PortResult } from "./common";

/**
 * Affiliate & Monetization のポート。すべて Commercial 区分。
 *
 * これらを組み立てるときは `markCommercial()` を通す。
 * ランキングのユースケースへ渡すとコンパイルが通らなくなる。
 */
export type AffiliateAccountRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: AffiliateAccountId): PortResult<AffiliateAccount | null>;
  list(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<AffiliateAccount>>;
  save(account: AffiliateAccount): PortResult<AffiliateAccount>;
};

export type AffiliateProgramRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: AffiliateProgramId): PortResult<AffiliateProgram | null>;
  list(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<AffiliateProgram>>;
  save(program: AffiliateProgram): PortResult<AffiliateProgram>;
};

export type AffiliateLinkRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: AffiliateLinkId): PortResult<AffiliateLink | null>;
  /**
   * 同じ URL の、いま使えるリンクを探す。**登録の前に必ず通す。**
   *
   * 受信箱の重複判定（`claimNormalizedUrl`）は「受け取った URL」の取り合いで、
   * こちらは「登録済みの成果リンク」を見る。別物なので両方要る。
   * 同じ URL が 2 本登録されると、記事に同じ商品が 2 枚並び、
   * クリックが 2 つの合言葉へ割れて、どちらの数字も本当の数にならない。
   *
   * 止まっているもの（停止・期限切れ）は返さない。差し替えは
   * 「旧を止めてから登録し直す」道なので、止まったものを重複扱いにすると
   * 差し替えができなくなる。
   */
  findUsableByOriginalUrl(
    workspaceId: WorkspaceId,
    originalUrl: string,
    at: Date,
  ): PortResult<AffiliateLink | null>;
  listByProduct(workspaceId: WorkspaceId, productId: ProductId): PortResult<readonly AffiliateLink[]>;
  /**
   * 手当てが要るリンク（期限切れ・停止済み）。
   *
   * 全件を持ってきて呼び出し側で絞ると、リンクが増えた時点で破綻する。
   * 「切れている」の判定は保存先が担い、ユースケースは件数と理由だけを扱う。
   */
  listNeedingAttention(
    workspaceId: WorkspaceId,
    at: Date,
    limit: number,
  ): PortResult<readonly AffiliateLink[]>;
  /**
   * 成果リンクを保存する。**商品の写しを一緒に渡さないと保存できない。**
   *
   * `AffiliateLink` は ASP が発行した URL とその素性しか持たず、
   * 読者のカードに出る商品名を持たない。ところが保存先の行は商品名を必須にする。
   * 引数を 1 つにすると、保存する実装が名前を**どこかから作る**しかなくなり、
   * 商品の表（まだ空）を引いて「—」で埋めるような創作がここで起きる。
   *
   * 2 つ目の引数にしてあるのは、**呼ぶ側が正本を言い切るまでコンパイルが通らない**
   * ようにするため。写しの正本は登録の操作をした人であり、保存先ではない。
   */
  save(link: AffiliateLink, snapshot: ProductSnapshot): PortResult<AffiliateLink>;
  /**
   * 同じworkspace・URLに使える行が無い場合だけ、一つのDB statementで作る。
   * 並行要求で先に作られた場合は、その正本とcreated=falseを返す。
   */
  createIfNoUsableUrl(
    link: AffiliateLink,
    snapshot: ProductSnapshot,
    at: Date,
  ): PortResult<{ readonly link: AffiliateLink; readonly created: boolean }>;
  /**
   * 登録済みの成果リンクを、**読者に出ている表記ごと**並べる。
   *
   * `AffiliateLink` は商品名を持たない（持たせると順位づけ側から名前が見える）。
   * だが「表記が古くなったリンクを止める」ためには、運営する人が
   * **いま読者に出ている名前**を見比べられなければならない。名前無しの一覧は、
   * ID の羅列を見ながら ASP の管理画面と突き合わせる作業になる。
   *
   * `save` が写しを別引数で受け取るのと同じ形にしてある。写しは
   * リンクの属性ではなく、リンクに添えて出し入れするものである。
   */
  listWithSnapshot(workspaceId: WorkspaceId): PortResult<readonly AffiliateLinkWithSnapshot[]>;
  /**
   * 成果リンクを止める。**行は書き換えず `disabled_at` を立てるだけ。**
   *
   * 表記を直す道は「止めてから新しい ID で登録し直す」の 2 手
   * （`docs/product/design-decisions.md` §2）。上書きの口をここに作ると、
   * 読者が実際に見た表記が、その日から誰にも分からなくなる。
   *
   * 見つからないもの・見本のものは失敗を返すこと。**黙って何もしないのは禁止。**
   * 押した人は止まったと思い、リンクは記事に出続ける。
   */
  disable(workspaceId: WorkspaceId, id: AffiliateLinkId, at: Date): PortResult<AffiliateLink>;
};

/** 成果リンクと、それに添えて保存してある読者向けの写し。 */
export type AffiliateLinkWithSnapshot = {
  readonly link: AffiliateLink;
  readonly snapshot: ProductSnapshot;
  /** legacy adapterは省略可。省略は「未確認・掲載先不明」として扱う。 */
  readonly lastCheckedAt?: Date | null;
  readonly placements?: readonly AffiliateLinkPlacement[];
};

export type AffiliateLinkPlacement = {
  readonly placementId: string;
  readonly siteSlug: string;
  readonly articleSlug: string;
  readonly blockId: string | null;
  readonly placement: string;
  readonly position: number;
  readonly status: "active" | "removed";
  readonly lastRenderedAt: Date | null;
  readonly updatedAt: Date;
};

export type ConversionRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: ConversionId): PortResult<Conversion | null>;
  findByExternalId(
    workspaceId: WorkspaceId,
    asp: AspKind,
    normalizedExternalId: string,
  ): PortResult<Conversion | null>;
  listByPeriod(workspaceId: WorkspaceId, period: string, page: PageRequest): PortResult<Paged<Conversion>>;
  save(conversion: Conversion): PortResult<Conversion>;
};

/**
 * 成果リンクの受信箱。
 *
 * 重複判定を「同じ形の URL が既にあるか」を**聞いてから入れる**形にしない。
 * 聞くのと入れるのが 2 手に分かれていると、2 人が同時に貼ったときに
 * 両方が「無い」を聞いて、どちらにも重複の印が付かないまま 2 行入る。
 * そのため、判定は下の `claimNormalizedUrl` に一手でやらせる。
 */
export type LinkIngestionRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: LinkIngestionId): PortResult<LinkIngestion | null>;
  list(
    workspaceId: WorkspaceId,
    filter: { state: LinkIngestionState | null },
    page: PageRequest,
  ): PortResult<Paged<LinkIngestion>>;
  /**
   * その正規化 URL の「最初の 1 本」を取りに行く。
   *
   * 返るのは**いま最初の 1 本として扱われている受信リンクの ID**。
   * `candidateId` がそのまま返れば自分が最初で、違う ID が返れば
   * その相手が先にいた（＝こちらが重複）ということ。
   *
   * 実装は、読んでから書くのではなく**一手で決着させる**こと。
   * 同時に呼ばれても、勝つのは必ず 1 本だけでなければならない。
   * 受け取り自体は弾かない（重複でも行は入る）。
   */
  claimNormalizedUrl(
    workspaceId: WorkspaceId,
    normalizedUrl: string,
    candidateId: LinkIngestionId,
  ): PortResult<LinkIngestionId>;
  /**
   * 取り合いから降りる。対象外にしたときに使う。
   *
   * 降ろさないと、捨てたリンクを相手に指した「重複」が延々と出続ける。
   * 自分が最初の 1 本でなければ何もしない（他人の取り分を消さない）。
   */
  releaseNormalizedUrl(
    workspaceId: WorkspaceId,
    normalizedUrl: string,
    id: LinkIngestionId,
  ): PortResult<void>;
  save(item: LinkIngestion): PortResult<LinkIngestion>;
};

export type CommercialLinkIngestionRepositoryPort = Commercial<LinkIngestionRepositoryPort>;

export type CommercialAffiliateLinkRepositoryPort = Commercial<AffiliateLinkRepositoryPort>;
export type CommercialConversionRepositoryPort = Commercial<ConversionRepositoryPort>;

export type AffiliatePreviewFetchResult =
  | { readonly kind: "ok"; readonly preview: AffiliatePreview }
  | { readonly kind: "rejected" | "failed"; readonly reason: string };

/**
 * URL preview は読み取り専用。本文や画像バイナリを返さず、9項目の抽出結果だけを返す。
 */
export type AffiliatePreviewFetcherPort = {
  retrieve(rawUrl: string): Promise<AffiliatePreviewFetchResult>;
};

/**
 * ASP との通信。
 *
 * ASP を 1 つ増やすときに触るのはこの契約の実装だけ。
 * ユースケースもドメインも変わらない (変更容易性シナリオ ①)。
 */
export type AspAdapterPort = {
  readonly asp: AspKind;
  /** 商品検索。編集用の商品情報を取る。報酬額はここでは返さない。 */
  searchProducts(query: { keyword: string; limit: number }): PortResult<readonly AspProductResult[]>;
  /** 成果データの取得。取込は Commercial 側でのみ使う。 */
  fetchConversions(range: { from: Date; to: Date }): PortResult<readonly AspConversionResult[]>;
  /** アフィリエイトリンクの発行。返る URL は改変せずそのまま保存する。 */
  createLink(input: { productExternalId: string }): PortResult<{ url: string }>;
};

export type AspProductResult = {
  readonly externalId: string;
  readonly name: string;
  readonly brandName: string | null;
  readonly imageUrl: string | null;
  readonly priceMinor: number | null;
  readonly currency: string;
  readonly merchantName: string;
  readonly productUrl: string;
  readonly retrievedAt: Date;
};

export type AspConversionResult = {
  readonly externalConversionId: string;
  readonly status: "pending" | "approved" | "rejected" | "cancelled";
  readonly occurredAt: Date;
  readonly rewardMinor: number | null;
  readonly currency: string;
  readonly linkRef: string | null;
};
