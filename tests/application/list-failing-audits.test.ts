/**
 * @tier 2
 * @req REQ-SEO07
 * @types equivalence, boundary
 */
import { describe, expect, it } from "vitest";
import type { AiSearchAuditHistoryPort, LatestFailingAudit } from "@/application/ports/seo";
import { createListFailingAuditsUseCase } from "@/application/usecases/seo/list-failing-audits";
import { ok } from "@/domain/shared";
import { anOwner } from "../support/actors";
import { NOW, daysFrom } from "../support/clock";

/**
 * 落ちている記事の一覧（受入 A5）のうち、**usecase が持っている判断**を見る。
 *
 * --- ここで見ないもの ---
 * 「その記事の**最新の**点検が落ちているか」の判定は SQL 側
 * （`listLatestFailing` の相関副問い合わせ）にあり、ここでは見られない。
 * 偽の保存先を置くと、検査するのは偽物が最新をどう選ぶかであって、
 * 本番で走る SQL ではなくなる。test-design の T5-2 は
 * `tests/integration/d1-ai-search-audit-history.test.ts` の
 * 「最新の点検だけを見る」で、本物の D1 に対して検査している。
 *
 * ここで見るのは 3 つ:
 *   1. 落ちた項目だけを取り出し、通った項目を混ぜないこと
 *   2. 上限で切ったことを黙らないこと（`truncated`）
 *   3. 保存先が返した並びを、usecase が並べ替えないこと
 */

function aFailing(over: Partial<LatestFailingAudit> = {}): LatestFailingAudit {
  return {
    siteSlug: "demo",
    slug: "quiet-laptop",
    title: "静かなノートパソコンの選び方",
    type: "guide",
    checkedAt: NOW.toISOString(),
    trigger: "publish",
    passedCount: 5,
    totalCount: 7,
    checks: [
      { check: "冒頭に結論がある", ok: true, hint: "一文の結論（summary）を書く。" },
      { check: "要点が箇条で読める", ok: false, hint: "要点を 3〜5 個の箇条書きにする。" },
      { check: "書き手が名乗っている", ok: false, hint: "書き手の名前と経歴を入れる。" },
    ],
    ...over,
  };
}

/** 保存先の代役。**受け取った引数を控える**（limit+1 で取ることの証拠になる）。 */
function historyReturning(
  rows: readonly LatestFailingAudit[],
  coverage = { publishedCount: rows.length, auditedCount: rows.length },
) {
  const asked: { limit?: number; siteSlug?: string } = {};
  const port = {
    record: async () => ok(undefined),
    listStale: async () => ok([]),
    listLatestFailing: async (input: { limit: number; siteSlug?: string }) => {
      asked.limit = input.limit;
      asked.siteSlug = input.siteSlug;
      return ok(rows.slice(0, input.limit));
    },
    getCoverage: async () => ok(coverage),
  } as unknown as AiSearchAuditHistoryPort;
  return { port, asked };
}

describe("落ちている記事の一覧", () => {
  it("落ちた項目だけを出し、通った項目は混ぜない", async () => {
    /*
      保存先が返す 1 行には通った項目も入っている（点検の全文を残しているため）。
      画面へ渡すのは直す手がかりになるものだけ。通った項目を並べると、
      直すところが 2 件なのに 7 行の一覧になり、どれを直すのか読めない。
    */
    const { port } = historyReturning([aFailing()]);
    const uc = createListFailingAuditsUseCase({ history: port });

    const listed = await uc.execute(anOwner(), {});

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.rows).toHaveLength(1);
    expect(listed.value.rows[0]?.failed).toEqual([
      { check: "要点が箇条で読める", hint: "要点を 3〜5 個の箇条書きにする。" },
      { check: "書き手が名乗っている", hint: "書き手の名前と経歴を入れる。" },
    ]);
    expect(listed.value.truncated).toBe(false);
    expect(listed.value.coverage).toEqual({
      publishedCount: 1,
      auditedCount: 1,
      uncheckedCount: 0,
    });
  });

  it("落ちている記事だけが並び、通っている記事は保存先から来ない", async () => {
    // T5-1。保存先は「最新が落ちている行」だけを返す約束なので、
    // usecase が受け取った件数がそのまま画面の件数になる。
    const { port } = historyReturning([
      aFailing({ slug: "quiet-laptop" }),
      aFailing({ slug: "cool-monitor" }),
    ]);
    const uc = createListFailingAuditsUseCase({ history: port });

    const listed = await uc.execute(anOwner(), {});

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.rows.map((row) => row.slug)).toEqual(["quiet-laptop", "cool-monitor"]);
  });

  it("60 件あるとき、既定では 50 件を出し、続きがあることを黙らない", async () => {
    // T5-3。上限ちょうどの 50 件が返っただけでは「これで全部」と読まれる。
    const rows = Array.from({ length: 60 }, (_, i) =>
      aFailing({ slug: `stale-${String(i).padStart(2, "0")}` }),
    );
    const { port, asked } = historyReturning(rows);
    const uc = createListFailingAuditsUseCase({ history: port });

    const listed = await uc.execute(anOwner(), {});

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.rows).toHaveLength(50);
    expect(listed.value.truncated).toBe(true);
    // 「ちょうど上限」と「まだ続きがある」を区別するには 1 件多く取るしかない。
    expect(asked.limit).toBe(51);
  });

  it("ちょうど 50 件のときは、続きがあると言わない", async () => {
    const rows = Array.from({ length: 50 }, (_, i) => aFailing({ slug: `stale-${i}` }));
    const { port } = historyReturning(rows);
    const uc = createListFailingAuditsUseCase({ history: port });

    const listed = await uc.execute(anOwner(), {});

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.rows).toHaveLength(50);
    expect(listed.value.truncated).toBe(false);
  });

  it("保存先が返した並びを、usecase は並べ替えない", async () => {
    /*
      並び（点検日の新しい順・同時刻は slug 昇順）は SQL の ORDER BY が持つ。
      ここで並べ替えると、決め方が 2 か所になり、片方だけ直る日が来る。
    */
    const { port } = historyReturning([
      aFailing({ slug: "c", checkedAt: NOW.toISOString() }),
      aFailing({ slug: "a", checkedAt: daysFrom(NOW, -1).toISOString() }),
      aFailing({ slug: "b", checkedAt: daysFrom(NOW, -1).toISOString() }),
    ]);
    const uc = createListFailingAuditsUseCase({ history: port });

    const listed = await uc.execute(anOwner(), {});

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.rows.map((row) => row.slug)).toEqual(["c", "a", "b"]);
  });

  it("履歴が無い公開記事の件数を、全合格と混同せず未点検として返す", async () => {
    const { port } = historyReturning([], { publishedCount: 3, auditedCount: 1 });
    const uc = createListFailingAuditsUseCase({ history: port });

    const listed = await uc.execute(anOwner(), {});

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.rows).toHaveLength(0);
    expect(listed.value.coverage).toEqual({
      publishedCount: 3,
      auditedCount: 1,
      uncheckedCount: 2,
    });
  });
});
