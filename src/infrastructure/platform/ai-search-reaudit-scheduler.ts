import { drizzle } from "drizzle-orm/d1";
import {
  type ReauditStaleArticlesResult,
  reauditStaleArticlesByWorkspace,
} from "@/application/usecases/seo/reaudit-stale-articles";
import type { RecordAiSearchAuditDeps } from "@/application/usecases/seo/record-ai-search-audit";
import * as schema from "@/db/schema";
import {
  failAiSearchReauditRun,
  finishAiSearchReauditRun,
} from "@/domain/seo/ai-search-reaudit-run";
import type { WorkspaceId } from "@/domain/shared";
import { createD1AiSearchAuditHistoryRepository } from "../persistence/d1/ai-search-audit-history-repository";
import { createD1AiSearchReauditRunRepository } from "../persistence/d1/ai-search-reaudit-run-repository";
import type { DrizzleD1 } from "../persistence/d1/link-inbox-repository";

/**
 * AI 検索適合の定期再点検（REQ-SEO07 / 受入 A4）。
 *
 * --- `createDeps()` を呼ばない ---
 * ここは `worker-entry.js` から直に読まれる。`createDeps()` を通すと、
 * 画面が使う 226 ファイル・約 1018 KiB の合成が Worker のバンドルへ**二重に**載り、
 * 3 MiB の上限へ当たる。2026-08-30 に実際にそれで公開が落ちた。
 * `distribution-scheduler.ts` が同じ理由で同じ形をしている。
 * 必要な口（履歴の保存先）だけをここで組み立てる。
 * `tests/architecture/worker-entry-weight.test.ts` がこの重さを見張っている。
 *
 * --- 時刻を渡し切る ---
 * `controller.scheduledTime` を受け取って下まで運ぶ。途中で `new Date()` を
 * 取り直すと、同じ 1 回の実行の中で記事ごとに点検時刻がばらけ、
 * 「どこまでが同じ夜の再点検か」を後から束ねられなくなる。
 */

export function createD1AiSearchAuditDeps(db: DrizzleD1, now: Date): RecordAiSearchAuditDeps {
  return {
    history: createD1AiSearchAuditHistoryRepository(db),
    // id の作り方を知っているのは infrastructure だけでよい。
    ids: { newId: () => `aud_${crypto.randomUUID()}` },
    now: () => now,
  };
}

/**
 * 定期実行から呼ぶ 1 本。**入口（`worker-entry.js`）が呼ぶのはこれだけ。**
 *
 * `getDb()` を使わないのは、あちらがリクエストの文脈から接続を取るためで、
 * 定期実行にはその文脈が無い。
 */
export async function runScheduledAiSearchReaudit(
  binding: D1Database,
  now: Date,
  completedAt: () => Date = () => new Date(),
): Promise<ReauditStaleArticlesResult> {
  const db = drizzle(binding, { schema });
  const deps = createD1AiSearchAuditDeps(db, now);
  const runs = createD1AiSearchReauditRunRepository(db);
  const knownWorkspaces = await runs.listKnownWorkspaceIds();
  if (!knownWorkspaces.ok) throw new Error(knownWorkspaces.error.message);

  const result = await reauditStaleArticlesByWorkspace(deps, { now });
  const finishedAt = completedAt();
  /*
    取得そのものに失敗したときだけ Result が失敗になる（1 本ごとの失敗は
    `failed` に数えて続ける）。0 件として返すと、入口が成功ログを残して
    障害が「対象なし」に見える。ここでは失敗として入口へ渡し、入口側が
    記録したうえで握る。そうすれば Cloudflare の再実行は積まれず、
    次の cron が同じ記事を拾い直せる。
  */
  if (!result.ok) {
    await saveRunsOrThrow(
      knownWorkspaces.value.map((workspaceId) =>
        failAiSearchReauditRun({ workspaceId, startedAt: now, completedAt: finishedAt }),
      ),
      runs.save,
    );
    throw new Error(result.error.message);
  }

  const resultByWorkspace = new Map(
    result.value.byWorkspace.map((summary) => [summary.workspaceId, summary] as const),
  );
  const workspaceIds = unionWorkspaceIds(knownWorkspaces.value, resultByWorkspace.keys());
  await saveRunsOrThrow(
    workspaceIds.map((workspaceId) => {
      const summary = resultByWorkspace.get(workspaceId) ?? {
        scanned: 0,
        recorded: 0,
        failed: 0,
      };
      return finishAiSearchReauditRun({
        workspaceId,
        startedAt: now,
        completedAt: finishedAt,
        ...summary,
      });
    }),
    runs.save,
  );
  return result.value.total;
}

function unionWorkspaceIds(
  known: readonly WorkspaceId[],
  processed: Iterable<WorkspaceId>,
): readonly WorkspaceId[] {
  const byValue = new Map(known.map((workspaceId) => [String(workspaceId), workspaceId]));
  for (const workspaceId of processed) byValue.set(String(workspaceId), workspaceId);
  return [...byValue.values()];
}

async function saveRunsOrThrow(
  states: readonly ReturnType<typeof finishAiSearchReauditRun>[],
  save: ReturnType<typeof createD1AiSearchReauditRunRepository>["save"],
): Promise<void> {
  // 1 workspace の保存失敗で他の最終状態まで残らなくしない。
  const results = await Promise.all(states.map((state) => save(state)));
  const failed = results.find((result) => !result.ok);
  if (failed !== undefined && !failed.ok) throw new Error(failed.error.message);
}
