import type {
  AffiliateAccount,
  AffiliateLink,
  AffiliateProgram,
  AspKind,
  Conversion,
  LinkIngestion,
  LinkIngestionState,
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
  save(link: AffiliateLink): PortResult<AffiliateLink>;
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
