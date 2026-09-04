import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { RAW_EVENT_RETENTION_DAYS, toRollupDay } from "@/domain/analytics";
import { createD1MetricsRollup } from "../persistence/d1/reader-metrics-repository";

/**
 * 読者行動の日次集計と、生イベントの保持期限。定期実行から呼ぶ（観測層）。
 *
 * --- `createDeps()` を呼ばないこと ---
 * ここは `worker-entry.js` から直に読まれる経路にある。理由と、戻したときに
 * 何が起きるか（型は通り、cron も動き、落ちるのは数か月後の公開）は
 * `distribution-scheduler.ts` の doc に書いてある。同じ制約がここにも掛かる。
 * 引き込みが増えていないことは `tests/architecture/worker-entry-weight.test.ts` が見る。
 *
 * --- 集計と掃除を同じ回で、この順にやる理由 ---
 * 掃除は生イベントを消す。集計より先に消すと、**まだ集計していない日の
 * 観測が、集計される前に消える**。集計を先にすれば、消えるのは既に
 * 日次の行になった観測だけになる。
 */

/**
 * 1 回で集計し直す (作業場所, ブログ, 日) の上限。
 *
 * 上限を置くのは実行時間のためで、溢れたぶんは翌日の回が拾う。
 * ただし翌日の回が拾えるのは、その日がまだ `ROLLUP_DAYS` の窓に
 * 入っているあいだだけである。ここに毎日ぶつかるようになったら、
 * 数を増やすのではなく待ち行列へ分ける（`distribution-scheduler.ts` と同じ判断）。
 */
export const READER_METRICS_ROLLUP_LIMIT = 200;

/**
 * 何日ぶんを集計し直すか（当日を含めて遡る日数）。
 *
 * 2 日なのは、定期実行が UTC の 17 時に走るためである。その時点で
 * 「今日 (UTC)」はまだ終わっておらず、観測が増え続けている。
 * 今日だけを集計すると昨日の最後の 7 時間が入らず、昨日だけを集計すると
 * 管理画面の当日が常に空になる。両方やって、どちらも置き換える。
 */
export const ROLLUP_DAYS = 2;

export type ReaderMetricsRollupResult = {
  /** 集計し直した (作業場所, ブログ, 日) の件数。 */
  readonly rolled: number;
  /** 集計に失敗した件数。次の回が同じ組を拾い直す。 */
  readonly failed: number;
  /** 上限に達し、この回では拾えなかった組が残っているか。 */
  readonly truncated: boolean;
  /** 保持期限を過ぎて消した生イベントの件数。 */
  readonly purged: number;
};

/** 当日から遡って `ROLLUP_DAYS` 日ぶんの `YYYY-MM-DD`。新しい順。 */
function rollupTargetDays(at: Date): readonly string[] {
  const days: string[] = [];
  for (let back = 0; back < ROLLUP_DAYS; back += 1) {
    days.push(toRollupDay(new Date(at.getTime() - back * 24 * 60 * 60 * 1000)));
  }
  return days;
}

export async function runReaderMetricsRollup(
  binding: D1Database,
  at: Date,
): Promise<ReaderMetricsRollupResult> {
  const rollup = createD1MetricsRollup(drizzle(binding, { schema }));

  const pending = await rollup.pendingDays(rollupTargetDays(at), READER_METRICS_ROLLUP_LIMIT);
  if (!pending.ok) throw new Error(pending.error.message);

  let rolled = 0;
  let failed = 0;
  for (const target of pending.value) {
    /*
     * 1 組の失敗で全体を止めない。集計は置き換えなので、失敗した組は
     * 次の回が同じ日をもう一度やり直せば正しい値になる。止めてしまうと、
     * 1 つのブログの不調が全部のブログの数字を古いまま据え置く。
     */
    const done = await rollup.rollupDay(target.workspaceId, target.siteSlug, target.day);
    if (done.ok) rolled += 1;
    else failed += 1;
  }

  // 集計のあとで消す（順序の理由は冒頭の doc）。
  const before = new Date(at.getTime() - RAW_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const purged = await rollup.purgeExpiredEvents(before);
  if (!purged.ok) throw new Error(purged.error.message);

  return {
    rolled,
    failed,
    truncated: pending.value.length === READER_METRICS_ROLLUP_LIMIT,
    purged: purged.value.deleted,
  };
}
