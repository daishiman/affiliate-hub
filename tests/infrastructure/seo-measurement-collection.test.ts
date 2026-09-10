/**
 * @tier 1
 * @req REQ-SEO12
 * @types decision-table, equivalence, boundary, tenant-isolation
 *
 * SEO / AEO の収集を定時に回す本体（`runSeoMeasurementCollection`）。
 *
 * --- なぜここを見るのか ---
 *
 * 既にある `seo-measurement-scheduler.test.ts` が見ているのは、予算の計算や
 * 期間の切り出しといった**部品**だけで、それらを組み立てて全ブログを回す
 * 本体は実測（2026-09-08）で 18.6% だった。部品が正しくても、
 * **組み立ての順番を間違えると予算は二重に使われる。**そこがここの主題。
 *
 * 見るのは 4 つ。
 *
 * 1. **起点が無いなら推測しない。**`PUBLIC_SITE_ORIGIN` が空のとき、
 *    `https://<何か>` を組み立てると他人のサイトを読みに行く形になる。
 * 2. **予算は呼び出しの前に取る。**外部呼び出しが例外で落ちても、
 *    取った枠は返らない。返してしまうと次のブログが同じ枠を使い、
 *    プロセス全体の上限を越える。
 * 3. **1 つ落ちても続ける。**しかも例外の本文は外へ出さない
 *    （URL・検索語・資格情報が入り得る）。
 * 4. **費用のかかる系統は週 1 回、ブログごとに曜日をずらす。**
 */
import { describe, expect, it, vi } from "vitest";
import { domainError, err, ok } from "@/domain/shared";
import {
  SEARCH_CONSOLE_QUERY_ROWS_PER_RUN,
  STATIC_AUDIT_PAGES_PER_RUN,
  runSeoMeasurementCollection,
} from "@/infrastructure/platform/seo-measurement-scheduler";

const mocked = vi.hoisted(() => ({
  drizzle: vi.fn(),
  createCollect: vi.fn(),
  createRepositories: vi.fn(),
  createStaticAudits: vi.fn(),
  createStaticAuditCollector: vi.fn(),
  createSearchConsole: vi.fn(),
  createAiCitation: vi.fn(),
}));

vi.mock("drizzle-orm/d1", () => ({ drizzle: mocked.drizzle }));
vi.mock("@/application/usecases/seo/collect-seo-measurements", () => ({
  createCollectSeoMeasurements: mocked.createCollect,
}));
vi.mock("@/infrastructure/persistence/d1/seo-measurement-repository", () => ({
  createD1SeoMeasurementRepositories: mocked.createRepositories,
}));
vi.mock("@/infrastructure/persistence/d1/seo-static-audit-repository", () => ({
  createD1SeoStaticAuditRepository: mocked.createStaticAudits,
}));
vi.mock("@/infrastructure/seo/aeo-measurement/static-audit-collector", () => ({
  createStaticAuditCollector: mocked.createStaticAuditCollector,
}));
vi.mock("@/infrastructure/seo/aeo-measurement/search-console-client", () => ({
  createSearchConsoleClient: mocked.createSearchConsole,
}));
vi.mock("@/infrastructure/seo/aeo-measurement/ai-citation-client", () => ({
  createAiCitationClient: mocked.createAiCitation,
}));

const DB = {} as D1Database;
const ENV = { PUBLIC_SITE_ORIGIN: "https://example.test" } as const;

type Row = { workspaceId: string; siteSlug: string };
type Executed = { actor: unknown; input: Record<string, unknown> };

/**
 * `listSeoCollectionTargets` は同じファイルの中にあるので差し替えられない。
 * drizzle の側を、最後に `await` できる連鎖として組む。
 */
function queryReturning(rows: readonly Row[]) {
  const chain: Record<string, unknown> = {};
  for (const step of ["select", "from", "leftJoin", "where"]) {
    chain[step] = () => chain;
  }
  chain["orderBy"] = () => Promise.resolve([...rows]);
  return chain;
}

/** `collect.execute` が何を受け取ったかを残す。予算の受け渡しはここでしか見えない。 */
function scheduler(options: {
  rows: readonly Row[];
  /** 系統ごとの返り値。既定は成功で、消費 0 行。 */
  outcome?: (input: Record<string, unknown>) => unknown;
}) {
  const executed: Executed[] = [];
  mocked.drizzle.mockReturnValue(queryReturning(options.rows));
  mocked.createRepositories.mockReturnValue({
    measurementArticles: {}, findings: {}, metrics: {}, queryMetrics: {},
    collections: {}, settings: {}, citationBudgets: {},
  });
  mocked.createStaticAudits.mockReturnValue({});
  mocked.createStaticAuditCollector.mockReturnValue({});
  mocked.createSearchConsole.mockReturnValue({});
  mocked.createAiCitation.mockReturnValue({});
  mocked.createCollect.mockImplementation(() => ({
    workspaceOf: () => "ws",
    execute: async (actor: unknown, input: Record<string, unknown>) => {
      executed.push({ actor, input });
      return (options.outcome?.(input) ?? succeeded(input)) as never;
    },
  }));
  return executed;
}

function succeeded(input: Record<string, unknown>, queryRowsFetched = 0) {
  return ok({
    source: input["action"],
    pagesExamined: 0,
    findingsAdded: 0,
    findingsResolved: 0,
    queryRowsFetched,
    queryRowsStored: queryRowsFetched,
    skippedReason: null,
  });
}

const AT = new Date("2026-09-08T17:00:00.000Z");

function inputsFor(executed: readonly Executed[], action: string) {
  return executed.map((call) => call.input).filter((input) => input["action"] === action);
}

describe("SEO 収集の定時実行", () => {
  it("起点が設定されていないときは、推測でURLを組まずに理由を返して終わる", async () => {
    scheduler({ rows: [{ workspaceId: "ws-1", siteSlug: "alpha" }] });
    for (const env of [{}, { PUBLIC_SITE_ORIGIN: "   " }, { PUBLIC_SITE_ORIGIN: 42 }]) {
      const result = await runSeoMeasurementCollection(DB, env, AT);
      expect(result).toEqual({
        sites: 0,
        outcomes: [],
        failures: [{ siteSlug: "-", message: "PUBLIC_SITE_ORIGIN が設定されていません。" }],
      });
    }
  });

  it("取り下げていないブログを回し、系統ごとの結果を積む", async () => {
    const executed = scheduler({
      rows: [{ workspaceId: "ws-1", siteSlug: "alpha" }, { workspaceId: "ws-1", siteSlug: "beta" }],
    });
    const result = await runSeoMeasurementCollection(DB, ENV, AT);
    expect(result.sites).toBe(2);
    expect(result.failures).toEqual([]);
    expect(new Set(result.outcomes.map((outcome) => outcome.siteSlug))).toEqual(
      new Set(["alpha", "beta"]),
    );
    expect(inputsFor(executed, "static_audit")[0]).toMatchObject({
      siteSlug: expect.any(String),
      origin: "https://example.test",
      limit: STATIC_AUDIT_PAGES_PER_RUN,
    });
  });

  it("静的解析の枠は全ブログ合計。1 つ目が使い切ったら 2 つ目は 0 になる", async () => {
    const executed = scheduler({
      rows: [{ workspaceId: "ws-1", siteSlug: "alpha" }, { workspaceId: "ws-1", siteSlug: "beta" }],
    });
    await runSeoMeasurementCollection(DB, ENV, AT);
    expect(inputsFor(executed, "static_audit").map((input) => input["limit"]))
      .toEqual([STATIC_AUDIT_PAGES_PER_RUN, 0]);
  });

  it("Search Console の枠は使った分だけ次のブログへ戻る", async () => {
    const executed = scheduler({
      rows: [{ workspaceId: "ws-1", siteSlug: "alpha" }, { workspaceId: "ws-1", siteSlug: "beta" }],
      outcome: (input) => succeeded(input, input["action"] === "search_console" ? 12_345 : 0),
    });
    await runSeoMeasurementCollection(DB, ENV, AT);
    expect(inputsFor(executed, "search_console").map((input) => input["queryRowBudget"]))
      .toEqual([SEARCH_CONSOLE_QUERY_ROWS_PER_RUN, SEARCH_CONSOLE_QUERY_ROWS_PER_RUN - 12_345]);
  });

  it("失敗した回は枠を返さない（返すと次のブログが同じ枠を二重に使う）", async () => {
    const executed = scheduler({
      rows: [{ workspaceId: "ws-1", siteSlug: "alpha" }, { workspaceId: "ws-1", siteSlug: "beta" }],
      outcome: (input) =>
        input["action"] === "search_console" && input["siteSlug"] === "alpha"
          ? err(domainError("UPSTREAM_UNAVAILABLE", "Search Console が応答しません。"))
          : succeeded(input),
    });
    const result = await runSeoMeasurementCollection(DB, ENV, AT);
    expect(inputsFor(executed, "search_console").map((input) => input["queryRowBudget"]))
      .toEqual([SEARCH_CONSOLE_QUERY_ROWS_PER_RUN, 0]);
    expect(result.failures).toContainEqual({
      siteSlug: "alpha",
      message: "Search Console が応答しません。",
    });
  });

  it("例外は固定文だけを残す（本文にはURL・検索語・資格情報が入り得る）", async () => {
    scheduler({
      rows: [{ workspaceId: "ws-1", siteSlug: "alpha" }],
      outcome: (input) => {
        if (input["action"] !== "static_audit") return succeeded(input);
        throw new Error("https://example.test/s/alpha?key=sk-secret へ接続できません");
      },
    });
    const result = await runSeoMeasurementCollection(DB, ENV, AT);
    expect(result.failures).toEqual([
      { siteSlug: "alpha", message: "static_audit の収集で予期しない失敗が起きました。" },
    ]);
    // 落ちたのは 1 系統だけで、次の系統は続いている。
    expect(result.outcomes.map((outcome) => outcome.source)).toContain("search_console");
  });

  it("Search Console は確定済みの 7 日ぶんを、直近 3 日を外して取る", async () => {
    const executed = scheduler({ rows: [{ workspaceId: "ws-1", siteSlug: "alpha" }] });
    await runSeoMeasurementCollection(DB, ENV, AT);
    expect(inputsFor(executed, "search_console")[0]).toMatchObject({
      siteUrl: "https://example.test/s/alpha/",
      startDate: "2026-08-30",
      endDate: "2026-09-05",
    });
  });

  it("被引用の確認は週 1 回。7 日回して 1 度だけ走る", async () => {
    const days = Array.from({ length: 7 }, (_, back) =>
      new Date(AT.getTime() + back * 86_400_000));
    let citations = 0;
    for (const day of days) {
      const executed = scheduler({ rows: [{ workspaceId: "ws-1", siteSlug: "alpha" }] });
      await runSeoMeasurementCollection(DB, ENV, day);
      citations += inputsFor(executed, "ai_citation").length;
    }
    expect(citations).toBe(1);
  });

  it("被引用の入力には、その作業場所の中での並び順と総数が入る", async () => {
    // 曜日が当たる日を 7 日のどこかから見つけ、その日の入力を見る。
    for (let back = 0; back < 7; back += 1) {
      const executed = scheduler({
        rows: [
          { workspaceId: "ws-1", siteSlug: "gamma" },
          { workspaceId: "ws-1", siteSlug: "alpha" },
        ],
      });
      await runSeoMeasurementCollection(DB, ENV, new Date(AT.getTime() + back * 86_400_000));
      const forAlpha = inputsFor(executed, "ai_citation").find((input) => input["siteSlug"] === "alpha");
      if (forAlpha === undefined) continue;
      // slug 昇順で数える。追加順にすると、1 つ消えたときに全部の番号が動く。
      expect(forAlpha).toMatchObject({ activeSiteCount: 2, siteOrdinal: 0 });
      return;
    }
    throw new Error("7 日のどこかで被引用が走るはずが、一度も走らなかった");
  });

  it("先頭に来るブログは UTC の日ごとに回る（同じブログが枠を独り占めしない）", async () => {
    const heads: string[] = [];
    for (let back = 0; back < 3; back += 1) {
      const executed = scheduler({
        rows: [
          { workspaceId: "ws-1", siteSlug: "alpha" },
          { workspaceId: "ws-1", siteSlug: "beta" },
          { workspaceId: "ws-1", siteSlug: "gamma" },
        ],
      });
      await runSeoMeasurementCollection(DB, ENV, new Date(AT.getTime() + back * 86_400_000));
      heads.push(String(executed[0]?.input["siteSlug"]));
    }
    expect(new Set(heads).size).toBe(3);
  });

  it("秘密は空文字なら「無い」として渡す（登録済みで認可失敗、という壊れ方を作らない）", async () => {
    scheduler({ rows: [{ workspaceId: "ws-1", siteSlug: "alpha" }] });
    await runSeoMeasurementCollection(
      DB,
      { ...ENV, GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT: "  ", AEO_CITATION_API_KEY: 7 },
      AT,
    );
    expect(mocked.createSearchConsole).toHaveBeenCalledWith({ serviceAccountJson: undefined });
    expect(mocked.createAiCitation).toHaveBeenCalledWith({ apiKey: undefined });
  });

  it("時計の身元は作業場所つきで、確かめてある扱いにする", async () => {
    const executed = scheduler({ rows: [{ workspaceId: "ws-1", siteSlug: "alpha" }] });
    await runSeoMeasurementCollection(DB, ENV, AT);
    expect(executed[0]?.actor).toEqual({
      workspaceId: "ws-1",
      userId: "system:seo-measurement",
      roles: ["workspace_admin"],
      scopedBrandIds: [],
      isAiServiceAccount: false,
      identified: true,
    });
  });
});
