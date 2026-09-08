import type { IdGeneratorPort } from "@/application/ports/common";
import type { AiSearchAuditHistoryPort } from "@/application/ports/seo";
import type { PublishedArticle } from "@/application/read-models/published-article";
import {
  AI_SEARCH_ANALYZER_VERSION,
  type AiSearchCheck,
} from "@/application/seo/ai-search-audit";
import type { AuditTrigger } from "@/domain/seo/ai-search-audit-trigger";
import type { DomainError, Result, WorkspaceId } from "@/domain/shared";

/**
 * AI 検索適合の点検結果を 1 件、履歴へ残す（REQ-SEO07 / 受入 A3）。
 *
 * --- 実行主体（actor）を取らない理由 ---
 * これは人が起こす操作ではなく、公開と定期再点検の**後始末**である。
 * 公開そのものの権限は呼び出し元が既に確かめており、cron には actor が居ない。
 * ここで能力判定を求めると、cron 用に偽の actor を作ることになる。
 *
 * --- 判定を受け取る形にした理由 ---
 * `auditArticleForAiSearch` を中で呼ばず、結果を引数で受け取る。
 * 公開画面はもう判定を持っており、同じ記事を 2 度判定すると
 * **画面に出た結果と履歴に残る結果が別々に作られる**。
 * 判定ロジックが将来ぶれたとき、この 2 つは静かに食い違う。
 */

/**
 * 記事 1 本あたりに残す履歴の件数。
 *
 * 日数の窓（「90 日分」など）を併用しない。件数と日数の両方を持つと、
 * 「毎日更新する記事」と「年に 1 度の記事」で残り方が変わり、
 * 一覧の並びが記事ごとに違う意味を持つ。件数だけなら
 * 「直近 30 回」はどの記事でも同じ意味になる。
 */
export const AUDIT_HISTORY_WINDOW = 30;

export type RecordAiSearchAuditDeps = {
  readonly history: AiSearchAuditHistoryPort;
  readonly ids: IdGeneratorPort;
  readonly now: () => Date;
};

export type RecordAiSearchAuditInput = {
  readonly workspaceId: WorkspaceId;
  readonly article: PublishedArticle;
  readonly trigger: AuditTrigger;
  readonly checks: readonly AiSearchCheck[];
};

export async function recordAiSearchAudit(
  deps: RecordAiSearchAuditDeps,
  input: RecordAiSearchAuditInput,
): Promise<Result<void, DomainError>> {
  return deps.history.record(
    {
      id: deps.ids.newId(),
      workspaceId: input.workspaceId,
      siteSlug: input.article.siteSlug,
      slug: input.article.slug,
      trigger: input.trigger,
      checks: input.checks,
      analyzerVersion: AI_SEARCH_ANALYZER_VERSION,
      checkedAt: deps.now(),
    },
    AUDIT_HISTORY_WINDOW,
  );
}
