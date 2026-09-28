/**
 * @tier 1
 * @req REQ-BOPC03
 * @req feat-reader-behavior-analytics, feat-blog-metrics-rollup
 * @types equivalence, decision-table, boundary
 *
 * 読者行動の日次集計を回す口（`runReaderMetricsRollup`）。
 *
 * --- なぜここを見るのか ---
 *
 * 実測（2026-09-08）で **0.0%**。定期実行からしか呼ばれないので、
 * 壊れても手元では誰も踏まない。踏むのは深夜 2 時の cron だけで、
 * 落ちた事実は「管理画面の数字が今日も動いていない」としてしか出ない。
 *
 * 見るのは 3 つ。
 *
 * 1. **集計してから消す。**逆にすると、まだ日次の行になっていない観測が
 *    集計される前に消える。順序そのものが守りなので、順序を固定する。
 * 2. **1 組の失敗で全体を止めない。**1 つのブログの不調が、全部のブログの
 *    数字を古いまま据え置くことにならない。
 * 3. **上限に当たったことを黙らせない。**`truncated` が立つ。
 */
import { describe, expect, it, vi } from "vitest";
import { domainError, err, ok } from "@/domain/shared";
import { RAW_EVENT_RETENTION_DAYS } from "@/domain/analytics/reader-interaction";
import {
  READER_METRICS_ROLLUP_LIMIT,
  ROLLUP_DAYS,
  runReaderMetricsRollup,
} from "@/infrastructure/platform/reader-metrics-scheduler";

const mocked = vi.hoisted(() => ({
  createRollup: vi.fn(),
  drizzle: vi.fn(),
}));

vi.mock("drizzle-orm/d1", () => ({ drizzle: mocked.drizzle }));
vi.mock("@/infrastructure/persistence/d1/reader-metrics-repository", () => ({
  createD1MetricsRollup: mocked.createRollup,
}));

const AT = new Date("2026-09-08T17:00:00.000Z");
const DB = {} as D1Database;

type Target = { workspaceId: string; siteSlug: string; day: string };

/** 呼ばれた順番を残す。順序そのものが守りなので、結果だけでは足りない。 */
function rollupPort(options: {
  pending: readonly Target[] | "fail";
  failDays?: readonly string[];
  purged?: number | "fail";
}) {
  const calls: string[] = [];
  let purgeBefore: Date | undefined;
  const port = {
    pendingDays: vi.fn(async (days: readonly string[], limit: number) => {
      calls.push(`pending:${days.join(",")}:${limit}`);
      if (options.pending === "fail") return err(domainError("UPSTREAM_UNAVAILABLE", "集計対象の数え上げに失敗しました。"));
      return ok([...options.pending]);
    }),
    rollupDay: vi.fn(async (workspaceId: string, siteSlug: string, day: string) => {
      calls.push(`rollup:${siteSlug}:${day}`);
      if (options.failDays?.includes(day)) return err(domainError("UPSTREAM_UNAVAILABLE", "集計に失敗しました。"));
      return ok(undefined);
    }),
    purgeExpiredEvents: vi.fn(async (before: Date) => {
      calls.push("purge");
      purgeBefore = before;
      if (options.purged === "fail") return err(domainError("UPSTREAM_UNAVAILABLE", "掃除に失敗しました。"));
      return ok({ deleted: options.purged ?? 0 });
    }),
  };
  mocked.drizzle.mockReturnValue({});
  mocked.createRollup.mockReturnValue(port);
  return { port, calls, purgeBeforeAt: () => purgeBefore };
}

function target(siteSlug: string, day: string): Target {
  return { workspaceId: "ws-1", siteSlug, day };
}

describe("読者行動の日次集計（定期実行）", () => {
  it("当日を含む ROLLUP_DAYS 日ぶんを新しい順に、上限つきで数え上げる", async () => {
    const { calls } = rollupPort({ pending: [] });
    await runReaderMetricsRollup(DB, AT);
    expect(calls[0]).toBe(`pending:2026-09-08,2026-09-07:${READER_METRICS_ROLLUP_LIMIT}`);
    expect(ROLLUP_DAYS).toBe(2);
  });

  it("集計を全部終えてから消す（逆順にすると未集計の観測が先に消える）", async () => {
    const { calls } = rollupPort({
      pending: [target("alpha", "2026-09-08"), target("beta", "2026-09-08")],
    });
    await runReaderMetricsRollup(DB, AT);
    expect(calls).toEqual([
      `pending:2026-09-08,2026-09-07:${READER_METRICS_ROLLUP_LIMIT}`,
      "rollup:alpha:2026-09-08",
      "rollup:beta:2026-09-08",
      "purge",
    ]);
  });

  it("1 組が失敗しても残りを続け、成功と失敗を別々に数える", async () => {
    rollupPort({
      pending: [
        target("alpha", "2026-09-08"),
        target("beta", "2026-09-08"),
        target("gamma", "2026-09-07"),
      ],
      failDays: ["2026-09-07"],
      purged: 12,
    });
    const result = await runReaderMetricsRollup(DB, AT);
    expect(result).toEqual({ rolled: 2, failed: 1, truncated: false, purged: 12 });
  });

  it("保持期限の起点は起動時刻から RAW_EVENT_RETENTION_DAYS 遡った時刻ちょうど", async () => {
    const { purgeBeforeAt } = rollupPort({ pending: [] });
    await runReaderMetricsRollup(DB, AT);
    expect(purgeBeforeAt()?.toISOString()).toBe(
      new Date(AT.getTime() - RAW_EVENT_RETENTION_DAYS * 86_400_000).toISOString(),
    );
  });

  it("上限ちょうどまで返ってきたら truncated を立てる（黙って打ち切らない）", async () => {
    rollupPort({
      pending: Array.from({ length: READER_METRICS_ROLLUP_LIMIT }, (_, index) =>
        target(`site-${index}`, "2026-09-08"),
      ),
    });
    const result = await runReaderMetricsRollup(DB, AT);
    expect(result.rolled).toBe(READER_METRICS_ROLLUP_LIMIT);
    expect(result.truncated).toBe(true);
  });

  it("上限に 1 件足りなければ truncated は立たない（境界）", async () => {
    rollupPort({
      pending: Array.from({ length: READER_METRICS_ROLLUP_LIMIT - 1 }, (_, index) =>
        target(`site-${index}`, "2026-09-08"),
      ),
    });
    expect((await runReaderMetricsRollup(DB, AT)).truncated).toBe(false);
  });

  it("数え上げに失敗したら集計も掃除もせずに投げる", async () => {
    const { calls } = rollupPort({ pending: "fail" });
    await expect(runReaderMetricsRollup(DB, AT)).rejects.toThrow("集計対象の数え上げに失敗しました。");
    expect(calls).toEqual([`pending:2026-09-08,2026-09-07:${READER_METRICS_ROLLUP_LIMIT}`]);
  });

  it("掃除に失敗したら投げる（消せていないことを成功として返さない）", async () => {
    rollupPort({ pending: [target("alpha", "2026-09-08")], purged: "fail" });
    await expect(runReaderMetricsRollup(DB, AT)).rejects.toThrow("掃除に失敗しました。");
  });
});
