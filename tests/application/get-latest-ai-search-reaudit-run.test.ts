/**
 * @tier 2
 * @req REQ-SEO07
 * @types tenant-isolation, permission-matrix, fault-injection
 */
import { describe, expect, it } from "vitest";
import type {
  AiSearchReauditRun,
  AiSearchReauditRunPort,
} from "@/application/ports/seo";
import { createGetLatestAiSearchReauditRunUseCase } from "@/application/usecases/seo/get-latest-ai-search-reaudit-run";
import { domainError, err, ok } from "@/domain/shared";
import { aNobody, anOwner, OTHER_WORKSPACE, WORKSPACE } from "../support/actors";
import { NOW } from "../support/clock";

function aRun(over: Partial<AiSearchReauditRun> = {}): AiSearchReauditRun {
  return {
    workspaceId: WORKSPACE,
    status: "succeeded",
    startedAt: NOW,
    completedAt: new Date(NOW.getTime() + 2_000),
    scanned: 3,
    recorded: 3,
    failed: 0,
    failureCode: null,
    ...over,
  };
}

function runsReturning(value: AiSearchReauditRun | null) {
  const asked: string[] = [];
  const port = {
    getLatest: async (workspaceId: string) => {
      asked.push(workspaceId);
      return ok(value);
    },
    save: async () => ok(undefined),
  } as unknown as AiSearchReauditRunPort;
  return { port, asked };
}

describe("最新の定期再点検実行", () => {
  it("actor の workspace だけで最新実行を取得する", async () => {
    const latest = aRun();
    const { port, asked } = runsReturning(latest);
    const useCase = createGetLatestAiSearchReauditRunUseCase({ runs: port });

    const result = await useCase.execute(anOwner(), {});

    expect(result).toEqual(ok(latest));
    expect(asked).toEqual([WORKSPACE]);
    expect(asked).not.toContain(OTHER_WORKSPACE);
  });

  it("実行履歴が無い場合は null をそのまま返す", async () => {
    const { port } = runsReturning(null);
    const useCase = createGetLatestAiSearchReauditRunUseCase({ runs: port });

    expect(await useCase.execute(anOwner(), {})).toEqual(ok(null));
  });

  it("取得失敗を成功に置き換えない", async () => {
    const failure = domainError(
      "UPSTREAM_UNAVAILABLE",
      "定期再点検の実行履歴を読み取れませんでした。",
    );
    const port = {
      getLatest: async () => err(failure),
      save: async () => ok(undefined),
    } as unknown as AiSearchReauditRunPort;

    const result = await createGetLatestAiSearchReauditRunUseCase({ runs: port }).execute(
      anOwner(),
      {},
    );

    expect(result).toEqual(err(failure));
  });

  it("読み取り権限が無い場合は保存先へ進まない", async () => {
    const { port, asked } = runsReturning(aRun());

    const result = await createGetLatestAiSearchReauditRunUseCase({ runs: port }).execute(
      aNobody(),
      {},
    );

    expect(result.ok).toBe(false);
    expect(asked).toEqual([]);
  });
});
