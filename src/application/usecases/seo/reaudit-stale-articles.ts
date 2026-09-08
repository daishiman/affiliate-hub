import { auditArticleForAiSearch } from "@/application/seo/ai-search-audit";
import type { DomainError, Result, WorkspaceId } from "@/domain/shared";
import { ok } from "@/domain/shared";
import {
  type RecordAiSearchAuditDeps,
  recordAiSearchAudit,
} from "./record-ai-search-audit";

/**
 * 最後の点検から時間が経った公開記事を再点検する（REQ-SEO07 / 受入 A4）。
 *
 * --- なぜ再点検が要るか ---
 * 点検が見るのは記事の中身だけではない。「いつの情報か」は日が経つほど
 * 古くなり、公開した日は通っていた記事が、半年後には落ちている。
 * 公開時にしか点検しないと、**その落ち方は誰にも見えない**。
 *
 * --- 時刻を引数で受け取る理由 ---
 * `new Date()` を中で呼ばない。cron の起動時刻（`scheduledTime`）を
 * そのまま使うことで、テストが偽の時計を仕込まずに済む。
 * 偽の時計は、仕込み忘れた 1 本のテストが実時間で走って
 * 「たまに落ちる」形になる。
 */

/** 何日経った記事を再点検の対象にするか。 */
export const REAUDIT_AFTER_DAYS = 7;

/**
 * 1 起動あたりの上限。
 *
 * 記事が何千本あっても、cron の 1 回で全部を触らない。古い順に取るので、
 * 積み残しは次の起動が拾う。上限を外すと、記事が増えた日に
 * cron の実行時間だけが黙って伸び、Workers の上限へ当たった日に止まる。
 */
export const REAUDIT_BATCH_LIMIT = 50;

export type ReauditStaleArticlesResult = {
  readonly scanned: number;
  readonly recorded: number;
  readonly failed: number;
};

export type WorkspaceReauditStaleArticlesResult = ReauditStaleArticlesResult & {
  readonly workspaceId: WorkspaceId;
};

export type ReauditStaleArticlesByWorkspaceResult = {
  readonly total: ReauditStaleArticlesResult;
  readonly byWorkspace: readonly WorkspaceReauditStaleArticlesResult[];
};

export async function reauditStaleArticles(
  deps: RecordAiSearchAuditDeps,
  input: { readonly now: Date },
): Promise<Result<ReauditStaleArticlesResult, DomainError>> {
  const result = await reauditStaleArticlesByWorkspace(deps, input);
  return result.ok ? ok(result.value.total) : result;
}

/**
 * scheduler が run-state を workspace 単位に残すための詳細版。
 * 対象取得と記事ごとの処理は通常版と共有し、同じ再点検を 2 系統にしない。
 */
export async function reauditStaleArticlesByWorkspace(
  deps: RecordAiSearchAuditDeps,
  input: { readonly now: Date },
): Promise<Result<ReauditStaleArticlesByWorkspaceResult, DomainError>> {
  const before = new Date(input.now.getTime() - REAUDIT_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const stale = await deps.history.listStale({ before, limit: REAUDIT_BATCH_LIMIT });
  if (!stale.ok) return stale;

  let recorded = 0;
  let failed = 0;
  const byWorkspace = new Map<WorkspaceId, { scanned: number; recorded: number; failed: number }>();
  for (const target of stale.value) {
    const workspace = byWorkspace.get(target.workspaceId) ?? {
      scanned: 0,
      recorded: 0,
      failed: 0,
    };
    workspace.scanned += 1;
    byWorkspace.set(target.workspaceId, workspace);
    /*
      1 本の失敗で残りを止めない。止めると、壊れた記事 1 本が
      その後ろに並ぶ全部の再点検を無期限に塞ぐ（古い順に取るので、
      その記事は毎回先頭に来続ける）。
    */
    const result = await recordAiSearchAudit(deps, {
      workspaceId: target.workspaceId,
      article: target.article,
      trigger: "scheduled",
      checks: auditArticleForAiSearch(target.article, input.now),
    });
    if (result.ok) {
      recorded += 1;
      workspace.recorded += 1;
    } else {
      failed += 1;
      workspace.failed += 1;
    }
  }
  return ok({
    total: { scanned: stale.value.length, recorded, failed },
    byWorkspace: [...byWorkspace].map(([workspaceId, counts]) => ({
      workspaceId,
      ...counts,
    })),
  });
}
