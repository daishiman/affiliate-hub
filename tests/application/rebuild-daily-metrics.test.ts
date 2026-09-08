/**
 * @tier 1
 * @req REQ-BOPC02
 * @req feat-blog-metrics-rollup
 * @types boundary, equivalence, decision-table, tenant-isolation
 *
 * 日次集計を、日付を指定してやり直す入口。
 *
 * --- ここで守るのは「やり直しが壊さないこと」 ---
 *
 * 集計は足し込みではなく**置き換え**なので、この入口の誤りは
 * 「数字が出ない」ではなく「**正しかった数字が 0 になる**」形で現れる。
 * 出た瞬間に元の値はもう無いので、あとから直せない。だから見るのは
 * 主に「呼ばせない」側になる:
 *
 *   1. 権限の無い人が呼べないこと
 *   2. 未来の日・保持期限より前の日を呼べないこと（0 上書きの防止）
 *   3. 他の作業場所の組を巻き込まないこと
 *   4. 指定した 1 日以外を触らないこと
 *
 * 集計そのものの中身（どの列をどう足すか）は
 * `tests/integration/d1-reader-metrics.test.ts` が見る。
 */
import { describe, expect, it } from "vitest";
import type { MetricsRollupPort } from "@/application/ports/blog-observability";
import type { AuditLogPort } from "@/application/ports/compliance";
import { createRebuildDailyMetricsUseCase } from "@/application/usecases/blog-ops/rebuild-daily-metrics";
import { RAW_EVENT_RETENTION_DAYS } from "@/domain/analytics";
import type { AuditLogId } from "@/domain/shared/ids";
import type { WorkspaceId } from "@/domain/shared/ids";
import { domainError, err, ok } from "@/domain/shared";
import { OTHER_WORKSPACE, WORKSPACE, anAnalyst, anOwner } from "../support/actors";

const SITE = "metrics-blog";
/** 「今」。やり直せる日の線引きがここから決まるので、動かさず注入する。 */
const NOW = new Date("2026-09-04T12:00:00Z");
const TODAY = "2026-09-04";
const YESTERDAY = "2026-09-03";

/** `NOW` から n 日前の日付。保持期限の境界を手で書き写さないため。 */
function daysBefore(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type Target = { workspaceId: WorkspaceId; siteSlug: string; day: string };

/**
 * 観測のある組を返す偽の口。**やり直した組を控える。**
 *
 * 「何件やり直したか」ではなく「**どの組をやり直したか**」を見たいので、
 * 数ではなく引数そのものを残す。件数だけだと、指定した日の代わりに
 * 別の日を 1 件やり直しても緑になる。
 */
function fakeRollup(pending: readonly Target[], failOn: string | null = null) {
  const rebuilt: Target[] = [];
  const asked: { days: readonly string[]; limit: number }[] = [];
  const port: MetricsRollupPort = {
    async pendingDays(days, limit) {
      asked.push({ days, limit });
      return ok(pending.filter((target) => days.includes(target.day)));
    },
    async rollupDay(workspaceId, siteSlug, day) {
      if (day === failOn) return err(domainError("UPSTREAM_UNAVAILABLE", "集計に失敗しました。"));
      rebuilt.push({ workspaceId, siteSlug, day });
      return ok(true as const);
    },
    async purgeExpiredEvents() {
      return ok({ deleted: 0 });
    },
  };
  return { port, rebuilt, asked };
}

function fakeAudit(fail = false) {
  const entries: { action: string; targetId: string }[] = [];
  const port: AuditLogPort = {
    async append(entry) {
      if (fail) return err(domainError("UPSTREAM_UNAVAILABLE", "記録を書けません。"));
      entries.push({ action: entry.action, targetId: entry.targetId });
      return ok("audit-1" as AuditLogId);
    },
    async listByTarget() {
      return ok([]);
    },
    async search() {
      return ok({ items: [], total: 0, page: 1, perPage: 20, nextCursor: null });
    },
  };
  return { port, entries };
}

function useCase(
  parts: { rollup?: ReturnType<typeof fakeRollup>; audit?: ReturnType<typeof fakeAudit> } = {},
) {
  const rollup =
    parts.rollup ?? fakeRollup([{ workspaceId: WORKSPACE, siteSlug: SITE, day: YESTERDAY }]);
  const audit = parts.audit ?? fakeAudit();
  const usecase = createRebuildDailyMetricsUseCase({
    rollup: rollup.port,
    auditLog: audit.port,
    ids: { newId: () => "id-1" },
    now: () => NOW,
  });
  return { usecase, rollup, audit };
}

describe("呼べる人と、呼べない人", () => {
  it("運営できる人は、指定した日をやり直せる", async () => {
    const { usecase, rollup } = useCase();

    const result = await usecase.execute(anOwner(), { siteSlug: SITE, day: YESTERDAY });

    expect(result.ok).toBe(true);
    expect(rollup.rebuilt).toEqual([{ workspaceId: WORKSPACE, siteSlug: SITE, day: YESTERDAY }]);
  });

  it("数字を見るだけの人（analyst）は、やり直せない", async () => {
    /*
     * 見るだけの人がこれを呼べると、閲覧の権限だけで画面の数字を
     * 作り直せることになる。読む操作と書く操作の境目がここで消える。
     */
    const { usecase, rollup } = useCase();

    const result = await usecase.execute(anAnalyst(), { siteSlug: SITE, day: YESTERDAY });

    expect(result.ok).toBe(false);
    expect(rollup.rebuilt, "断ったのに集計が走っています").toEqual([]);
  });
});

describe("やり直してよい日か", () => {
  it("今日はやり直せる", async () => {
    const { usecase, rollup } = useCase({
      rollup: fakeRollup([{ workspaceId: WORKSPACE, siteSlug: SITE, day: TODAY }]),
    });

    const result = await usecase.execute(anOwner(), { siteSlug: SITE, day: TODAY });

    expect(result.ok).toBe(true);
    expect(rollup.rebuilt.map((t) => t.day)).toEqual([TODAY]);
  });

  it("まだ来ていない日は断る", async () => {
    const { usecase, rollup } = useCase();

    const result = await usecase.execute(anOwner(), { siteSlug: SITE, day: "2026-09-05" });

    expect(result.ok).toBe(false);
    expect(rollup.rebuilt).toEqual([]);
  });

  it("保持期限の内側の、いちばん古い日はやり直せる", async () => {
    const day = daysBefore(RAW_EVENT_RETENTION_DAYS);
    const { usecase, rollup } = useCase({
      rollup: fakeRollup([{ workspaceId: WORKSPACE, siteSlug: SITE, day }]),
    });

    const result = await usecase.execute(anOwner(), { siteSlug: SITE, day });

    expect(result.ok, "保持期限のちょうど境目を断っています").toBe(true);
    expect(rollup.rebuilt.map((t) => t.day)).toEqual([day]);
  });

  it("保持期限より前の日は断る（ここが 0 上書きの入口になる）", async () => {
    /*
     * 生の観測は 90 日で消える。消えた日をやり直すと、集計は
     * 「観測 0 件」を根拠に 0 の行を書く。今ある正しい集計が消える。
     */
    const day = daysBefore(RAW_EVENT_RETENTION_DAYS + 1);
    const { usecase, rollup } = useCase();

    const result = await usecase.execute(anOwner(), { siteSlug: SITE, day });

    expect(result.ok).toBe(false);
    expect(rollup.rebuilt, "保持期限より前の日を集計しに行っています").toEqual([]);
  });

  it("日付の形が違えば、集計を呼びに行かない", async () => {
    const { usecase, rollup } = useCase();

    for (const day of ["2026/09/03", "9月3日", "2026-9-3", ""]) {
      const result = await usecase.execute(anOwner(), { siteSlug: SITE, day });
      expect(result.ok, `${day} を受け取ってしまいました`).toBe(false);
    }
    expect(rollup.rebuilt).toEqual([]);
  });

  it("どのブログか言われなければ断る", async () => {
    const { usecase, rollup } = useCase();

    const result = await usecase.execute(anOwner(), { siteSlug: "  ", day: YESTERDAY });

    expect(result.ok).toBe(false);
    expect(rollup.rebuilt).toEqual([]);
  });
});

describe("指定した 1 日と 1 ブログしか触らない", () => {
  it("同じ日の別のブログを巻き込まない", async () => {
    const { usecase, rollup } = useCase({
      rollup: fakeRollup([
        { workspaceId: WORKSPACE, siteSlug: SITE, day: YESTERDAY },
        { workspaceId: WORKSPACE, siteSlug: "other-blog", day: YESTERDAY },
      ]),
    });

    const result = await usecase.execute(anOwner(), { siteSlug: SITE, day: YESTERDAY });

    expect(result.ok).toBe(true);
    expect(rollup.rebuilt.map((t) => t.siteSlug)).toEqual([SITE]);
  });

  it("他の作業場所の同名ブログを巻き込まない", async () => {
    /*
     * `pendingDays` は作業場所をまたいで数え上げる（定期実行が全体を回すため）。
     * 絞り込みを忘れると、同じ slug を使っている別の利用者の数字が動く。
     */
    const { usecase, rollup } = useCase({
      rollup: fakeRollup([
        { workspaceId: WORKSPACE, siteSlug: SITE, day: YESTERDAY },
        { workspaceId: OTHER_WORKSPACE, siteSlug: SITE, day: YESTERDAY },
      ]),
    });

    const result = await usecase.execute(anOwner(), { siteSlug: SITE, day: YESTERDAY });

    expect(result.ok).toBe(true);
    expect(rollup.rebuilt.map((t) => t.workspaceId)).toEqual([WORKSPACE]);
  });

  it("数え上げに渡す日が、指定した 1 日だけである", async () => {
    // ここが 2 日ぶんになると、指定していない日まで置き換わる。
    const { usecase, rollup } = useCase();

    await usecase.execute(anOwner(), { siteSlug: SITE, day: YESTERDAY });

    expect(rollup.asked.map((a) => a.days)).toEqual([[YESTERDAY]]);
  });

  it("その日に観測が無ければ、0 件として返し、書きに行かない", async () => {
    /*
     * 「無い観測を 0 の行として書く」を防ぐ最後の砦。成功で返すのは、
     * これが失敗ではなく「直すものが無かった」だからで、
     * 件数を返して画面が言い分けられるようにしてある。
     */
    const { usecase, rollup } = useCase({ rollup: fakeRollup([]) });

    const result = await usecase.execute(anOwner(), { siteSlug: SITE, day: YESTERDAY });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.rebuilt).toBe(0);
    expect(rollup.rebuilt).toEqual([]);
  });
});

describe("誰がいつ作り直したかが残る", () => {
  it("1 回の操作につき、記録は 1 行", async () => {
    // 組ごとに書くと、1 日やり直しただけで記録が何行も増え、
    // 承認や公開の記録がその中に埋もれる。
    const { usecase, audit } = useCase({
      rollup: fakeRollup([
        { workspaceId: WORKSPACE, siteSlug: SITE, day: YESTERDAY },
        { workspaceId: WORKSPACE, siteSlug: SITE, day: YESTERDAY },
      ]),
    });

    await usecase.execute(anOwner(), { siteSlug: SITE, day: YESTERDAY });

    expect(audit.entries).toEqual([
      { action: "metrics_rollup.rebuilt", targetId: `${SITE}/${YESTERDAY}` },
    ]);
  });

  it("記録を書けなければ、成功として返さない", async () => {
    const { usecase } = useCase({ audit: fakeAudit(true) });

    const result = await usecase.execute(anOwner(), { siteSlug: SITE, day: YESTERDAY });

    expect(result.ok).toBe(false);
  });

  it("集計に失敗した回も記録に残したうえで、失敗として返す", async () => {
    /*
     * 失敗を握り潰さないだけでなく、**走った事実を残す**。
     * 記録が無いと、数字が動いたのに誰も触っていないように見える。
     */
    const { usecase, audit } = useCase({
      rollup: fakeRollup(
        [{ workspaceId: WORKSPACE, siteSlug: SITE, day: YESTERDAY }],
        YESTERDAY,
      ),
    });

    const result = await usecase.execute(anOwner(), { siteSlug: SITE, day: YESTERDAY });

    expect(result.ok).toBe(false);
    expect(audit.entries).toHaveLength(1);
  });
});
