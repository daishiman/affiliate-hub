/**
 * @tier 1
 * @req REQ-TM03
 * @types boundary
 *
 * AI 利用の一覧に**必ず付いてくる注意書き**。
 *
 * 要件の中心は数字ではなく、数字の限界の出し方である。
 *   - 概算であり請求額と一致しない
 *   - 価格表に無いモデルの呼び出しがあると、費用が過小に見える
 * これを画面側に書かせると、片方の画面にだけ注意書きが載る状態になる。
 * だから注意書きはユースケースが作り、画面はそれを出すだけ、と決めてある。
 *
 * ここを足した理由。2026-08-21 に測ったところ、
 * **価格未登録の注意書きを作る箇所を丸ごと消しても緑のまま通った。**
 * 追跡表の判定欄は `tests/ui/ai-usage-page.test.tsx` を指していたが、
 * あれは `telemetryUseCases` ごと差し替えたうえで注意書きを手で渡しており、
 * **このユースケースを 1 度も動かしていない。**
 */
import { describe, expect, it } from "vitest";
import type { TelemetrySinkPort } from "@/application/ports/telemetry";
import { createAiUsageReportUseCase } from "@/application/usecases/analytics/ai-usage-report";
import type { AiUsageRollup } from "@/domain/analytics";
import { domainError, err, ok } from "@/domain/shared";
import { WORKSPACE, anAnalyst, aNobody } from "../support/actors";

/** 集計 1 行。既定は「価格表にあるモデル」。 */
function aRollup(over: Partial<AiUsageRollup> = {}): AiUsageRollup {
  return {
    siteSlug: "blog-a",
    modelId: "claude-sonnet-5",
    provider: "anthropic",
    calls: 10,
    failures: 1,
    inputTokens: 100_000,
    outputTokens: 20_000,
    costJpy: 96,
    unpricedCalls: 0,
    avgDurationMs: 1200,
    ...over,
  };
}

/** 記録先の代わり。**このテストが見たいのは注意書きだけ**なので、返す行だけ差し替える。 */
function sinkOf(rows: readonly AiUsageRollup[] | DomainFailure): TelemetrySinkPort {
  const notUsed = () => {
    throw new Error("このテストでは呼ばれません");
  };
  return {
    aiUsage: async () => ("failure" in rows ? err(rows.failure) : ok(rows)),
    recordBatch: notUsed,
    purgeExpired: notUsed,
    forgetReader: notUsed,
  };
}

type DomainFailure = { readonly failure: ReturnType<typeof domainError> };

async function run(rows: readonly AiUsageRollup[] | DomainFailure) {
  const r = await createAiUsageReportUseCase({ sink: sinkOf(rows) }).execute(
    anAnalyst({ workspaceId: WORKSPACE }),
    {},
  );
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe("数字と一緒に、その数字の限界を返す", () => {
  it("価格未登録の呼び出しが 0 件のときは、その注意書きを出さない", async () => {
    // 0 件のときに出すと「いつも出ている文」になり、読み飛ばされる。
    const { caveats } = await run([aRollup({ unpricedCalls: 0 })]);
    expect(caveats.some((c) => c.includes("価格が登録されていない"))).toBe(false);
  });

  it("価格未登録の呼び出しが 1 件でもあれば、件数つきで注意書きを出す", async () => {
    // ここが要件の境目。**1 件目から出す。**
    const { caveats } = await run([aRollup({ unpricedCalls: 1 })]);
    const notice = caveats.find((c) => c.includes("価格が登録されていない"));
    expect(notice, "価格未登録のモデルがあるのに注意書きがありません").toBeDefined();
    expect(notice).toContain("1 件");
    // 「その分だけ費用が少なく見える」まで言う。件数だけでは読み手が判断できない。
    expect(notice).toContain("少なく見えています");
  });

  it("複数の行にまたがる価格未登録を、合計した件数で出す", async () => {
    const { caveats } = await run([
      aRollup({ modelId: "unknown-a", unpricedCalls: 2 }),
      aRollup({ modelId: "unknown-b", siteSlug: "blog-b", unpricedCalls: 3 }),
    ]);
    expect(caveats.find((c) => c.includes("価格が登録されていない"))).toContain("5 件");
  });

  it("概算であることと、失敗にも費用がかかることは、常に出す", async () => {
    // 数字が 1 行も無いときでも出す。空の一覧を「費用 0 円」と読まれないため。
    for (const rows of [[aRollup()], []]) {
      const { caveats } = await run(rows);
      expect(caveats.some((c) => c.includes("概算"))).toBe(true);
      expect(caveats.some((c) => c.includes("失敗した呼び出しにも費用"))).toBe(true);
    }
  });

  it("読み出せなかったときも、画面は開き、理由が残る", async () => {
    // 計測が読めないことで管理画面が落ちるのは、計測の都合の押し付け。
    const out = await run({ failure: domainError("NOT_IMPLEMENTED", "保存先が未実装です") });
    expect(out.rows).toEqual([]);
    expect(out.emptyReason).toContain("保存先が未実装です");
    expect(out.caveats.length).toBeGreaterThan(0);
  });

  it("数字を見る権限が無い人には返さない", async () => {
    const r = await createAiUsageReportUseCase({ sink: sinkOf([aRollup()]) }).execute(aNobody(), {});
    expect(r.ok).toBe(false);
  });
});
