import type { PublishedArticle } from "@/application/read-models/published-article";
import type { AiSearchCheck } from "@/application/seo/ai-search-audit";
import type { ArticleType } from "@/domain/authoring";
import type { AuditTrigger } from "@/domain/seo/ai-search-audit-trigger";
import type { AiSearchReauditRun } from "@/domain/seo/ai-search-reaudit-run";
import type { WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

export type { AiSearchReauditRun } from "@/domain/seo/ai-search-reaudit-run";

/**
 * AI 検索適合の点検履歴のポート（feat-seo-aeo-gap-closure / REQ-SEO07）。
 *
 * 点検そのもの（`auditArticleForAiSearch`）は純関数のままで、
 * ここは「その結果をどこへ置き、どう読み返すか」だけを宣言する。
 * 判定に保存の関心を持たせると、「点検したら記録される」という副作用が
 * 呼び出し側からもテストからも見えなくなる。
 */

/** 履歴へ 1 行足すときの中身。id と時刻は呼び出し側（usecase）が決める。 */
export type AiSearchAuditRecord = {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly siteSlug: string;
  readonly slug: string;
  readonly trigger: AuditTrigger;
  readonly checks: readonly AiSearchCheck[];
  readonly analyzerVersion: string;
  readonly checkedAt: Date;
};

/** 再点検の対象。記事の中身まで返すのは、呼び出し側が N+1 で引き直さないため。 */
export type StaleAuditTarget = {
  readonly workspaceId: WorkspaceId;
  readonly article: PublishedArticle;
};

/** 「最新の点検で落ちている記事」1 件。`checks` は保存された当時の 7 件そのまま。 */
export type LatestFailingAudit = {
  readonly siteSlug: string;
  readonly slug: string;
  readonly title: string;
  readonly type: ArticleType;
  readonly checkedAt: string;
  readonly trigger: AuditTrigger;
  readonly passedCount: number;
  readonly totalCount: number;
  readonly checks: readonly AiSearchCheck[];
};

/** 公開中の記事のうち、少なくとも 1 回は点検履歴がある範囲。 */
export type AiSearchAuditCoverage = {
  readonly publishedCount: number;
  readonly auditedCount: number;
};

export type AiSearchAuditHistoryPort = {
  /**
   * 1 行足し、その記事の履歴を新しい順 `window` 件に切り詰める。
   *
   * **追記と刈り取りを 1 つの操作にしてある。**別々の口にすると、
   * 追記だけ呼んで刈り取りを呼ばない経路がいつか生まれ、
   * 履歴が無限に伸びる。伸びても誰も困らないので、気づかれない。
   */
  record(entry: AiSearchAuditRecord, window: number): PortResult<void>;
  /**
   * 最終点検が `before` より古い（または履歴が 1 件も無い）公開記事。
   *
   * 取り下げ済み（`archived_at` 有り）は含めない。読者に出ていない記事を
   * 点検しても、直す先が無い。並びは「最後に点検した時刻の古い順」で、
   * 履歴が無いものが最優先。
   */
  listStale(input: {
    readonly before: Date;
    readonly limit: number;
  }): PortResult<readonly StaleAuditTarget[]>;
  /**
   * 最新の点検で `passed_count < total_count` だった記事。
   *
   * **契機（trigger）で絞らない。**公開直後に落ちた記事も定期再点検で
   * 落ちた記事も、直す必要があることに変わりは無い。
   * 並びは点検時刻の新しい順、同時刻は `slug` の昇順。
   */
  listLatestFailing(input: {
    readonly workspaceId: WorkspaceId;
    readonly siteSlug?: string;
    readonly limit: number;
  }): PortResult<readonly LatestFailingAudit[]>;
  /**
   * 公開中の記事数と、そのうち点検済みの記事数。
   * 失敗一覧が 0 件でも「全合格」と「未点検」を混同しないための口。
   */
  getCoverage(input: {
    readonly workspaceId: WorkspaceId;
    readonly siteSlug?: string;
  }): PortResult<AiSearchAuditCoverage>;
};

/** 定期再点検の最新の最終状態。記事ごとの点検履歴とは分けて保存する。 */
export type AiSearchReauditRunPort = {
  save(run: AiSearchReauditRun): PortResult<void>;
  /** UI は actor の workspaceId だけを渡す。横断取得の口は持たない。 */
  getLatest(workspaceId: WorkspaceId): PortResult<AiSearchReauditRun | null>;
  /** cron が対象取得に失敗しても、停止されていない workspace へ結果を残すための口。 */
  listKnownWorkspaceIds(): PortResult<readonly WorkspaceId[]>;
};
