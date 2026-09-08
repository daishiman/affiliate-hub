import type { Claim, Evidence, TestRun } from "@/domain/evidence";
import type {
  ClaimId,
  Editorial,
  EvidenceId,
  ProductId,
  TestRunId,
  WorkspaceId,
} from "@/domain/shared";
import type { PageRequest, Paged, PortResult } from "./common";

export type ClaimRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: ClaimId): PortResult<Claim | null>;
  listByProduct(workspaceId: WorkspaceId, productId: ProductId): PortResult<readonly Claim[]>;
  /** 期限切れが近い主張。更新の対象を見つける。 */
  listExpiringBefore(workspaceId: WorkspaceId, at: Date, limit: number): PortResult<readonly Claim[]>;
  /**
   * 既にある主張を直す（確認済みにする・期限を延ばす）。
   *
   * **どの商品についてかは変えない。** `Claim` は商品を知らないので
   * （`domain/evidence/claim.ts`）、ここへ渡しても伝えようがない。
   * 新しく入れるときは下の `saveForProduct` を使う。
   */
  save(claim: Claim): PortResult<Claim>;
  /**
   * 主張を新しく入れる。どの商品についてかを添える。
   *
   * `listByProduct` があるのに入れる側に商品が無いのは、
   * **紐付けを推測で埋めるしかない形**だった。推測で埋めると、
   * 関係のない商品のページに見覚えのない主張が現れる。
   */
  saveForProduct(
    workspaceId: WorkspaceId,
    productId: ProductId,
    claim: Claim,
  ): PortResult<Claim>;
};

export type EvidenceRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: EvidenceId): PortResult<Evidence | null>;
  listByIds(workspaceId: WorkspaceId, ids: readonly EvidenceId[]): PortResult<readonly Evidence[]>;
  search(workspaceId: WorkspaceId, query: { text?: string }, page: PageRequest): PortResult<Paged<Evidence>>;
  save(evidence: Evidence): PortResult<Evidence>;
};

export type TestRunRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: TestRunId): PortResult<TestRun | null>;
  listByProduct(workspaceId: WorkspaceId, productId: ProductId): PortResult<readonly TestRun[]>;
  save(run: TestRun): PortResult<TestRun>;
};

/** ランキングへ渡せる根拠ポート。Editorial 区分のみ。 */
export type EditorialClaimRepositoryPort = Editorial<ClaimRepositoryPort>;
export type EditorialEvidenceRepositoryPort = Editorial<EvidenceRepositoryPort>;
export type EditorialTestRunRepositoryPort = Editorial<TestRunRepositoryPort>;

/**
 * URL からの資料取込 (プラットフォーム層 §10)。
 *
 * 禁止事項をポートの契約として明記する:
 *   - robots.txt / 利用規約で禁止された取得を行わない
 *   - CAPTCHA やアクセス制御を回避しない
 *   - 取得したページ内のテキストを AI への指示として実行しない
 *   - 本文の全文保存を行わない (抜粋の上限は domain 側で強制)
 */
export type SourceFetchPort = {
  fetchArticle(url: string): PortResult<FetchedSource>;
};

export type FetchedSource = {
  readonly url: string;
  readonly finalUrl: string;
  readonly title: string | null;
  readonly siteName: string | null;
  readonly publishedAt: Date | null;
  /** 抜粋。全文は保持しない。 */
  readonly excerpt: string;
  /** robots.txt と利用規約の確認結果。取得可否の根拠になる。 */
  readonly permittedUsage: "quote_with_attribution" | "reference_only" | "unknown";
  readonly retrievedAt: Date;
};
