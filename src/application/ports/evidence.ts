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
  save(claim: Claim): PortResult<Claim>;
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
