/** @tier 1 @req REQ-P01 */
import { describe, expect, it } from "vitest";
import { createCapacityGuard, type CapacityKind } from "@/application/capacity";
import type {
  AcquireCapacityLeaseInput,
  WorkspaceRepositoryPort,
} from "@/application/ports/identity";
import { PLAN_LIMITS } from "@/domain/identity";
import { markGenerationCapacityConsumed } from "@/domain/generation";
import { type WorkspaceId, domainError, err, ok } from "@/domain/shared";
import { OTHER_WORKSPACE, WORKSPACE } from "../support/actors";
import { aWorkspace } from "../support/factories";
import { NOW } from "../support/clock";

const limits: Readonly<Record<CapacityKind, number>> = {
  brand: PLAN_LIMITS.solo.maxBrands,
  site: PLAN_LIMITS.solo.maxSites,
  member: PLAN_LIMITS.solo.maxMembers,
  generation: PLAN_LIMITS.solo.monthlyGenerations,
};

function guard(counts: Readonly<Record<string, number>>) {
  const active = new Map<
    string,
    AcquireCapacityLeaseInput & { readonly workspaceId: WorkspaceId }
  >();
  const count = (workspaceId: WorkspaceId, kind: CapacityKind) =>
    counts[`${String(workspaceId)}:${kind}`] ?? 0;
  const workspaces = {
    findById: async (workspaceId: WorkspaceId) =>
      ok(aWorkspace({ id: workspaceId, plan: "solo" })),
    async acquireCapacityLease(workspaceId: WorkspaceId, input: AcquireCapacityLeaseInput) {
      const activeCount = [...active.values()].filter(
        (lease) =>
          lease.workspaceId === workspaceId &&
          lease.kind === input.kind &&
          lease.expiresAt > input.now,
      ).length;
      if (count(workspaceId, input.kind) + activeCount >= input.limit) {
        return ok(false);
      }
      active.set(input.id, { ...input, workspaceId });
      return ok(true);
    },
    async releaseCapacityLease(workspaceId: WorkspaceId, id: string, now: Date) {
      const found = active.get(id);
      if (found?.workspaceId === workspaceId) active.delete(id);
      for (const [leaseId, lease] of active) {
        if (lease.workspaceId === workspaceId && lease.expiresAt <= now) active.delete(leaseId);
      }
      return ok(undefined);
    },
  } as unknown as WorkspaceRepositoryPort;
  return {
    active,
    capacity: createCapacityGuard({ workspaces, now: () => NOW }),
  };
}

describe("mutation 共通の容量 lease", () => {
  for (const kind of ["brand", "site", "member", "generation"] as const) {
    it(`${kind}: limit - 1 は mutation を通し、limit は始めない`, async () => {
      let calls = 0;
      const below = guard({ [`${WORKSPACE}:${kind}`]: limits[kind] - 1 });
      const at = guard({ [`${WORKSPACE}:${kind}`]: limits[kind] });

      const accepted = await below.capacity.withLease(WORKSPACE, kind, async () => {
        calls += 1;
        return ok("saved");
      });
      const blocked = await at.capacity.withLease(WORKSPACE, kind, async () => {
        calls += 1;
        return ok("must-not-run");
      });

      expect(accepted).toEqual(ok("saved"));
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.error.code).toBe("VALIDATION_FAILED");
      expect(calls).toBe(1);
    });
  }

  it("別 workspace の lease は互いを塞がない", async () => {
    const { capacity } = guard({});
    let releaseFirst!: () => void;
    let firstStarted!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const started = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });

    const first = capacity.withLease(WORKSPACE, "brand", async () => {
      firstStarted();
      await firstGate;
      return ok("first");
    });
    await started;
    const other = await capacity.withLease(OTHER_WORKSPACE, "brand", async () => ok("other"));
    releaseFirst();

    expect(other).toEqual(ok("other"));
    expect(await first).toEqual(ok("first"));
  });

  it("mutation が Result エラーでも lease を解放し、再試行できる", async () => {
    const { active, capacity } = guard({});

    const failed = await capacity.withLease(WORKSPACE, "brand", async () =>
      err(domainError("UPSTREAM_UNAVAILABLE", "保存できませんでした。")),
    );
    const retried = await capacity.withLease(WORKSPACE, "brand", async () => ok("retried"));

    expect(failed.ok).toBe(false);
    expect(retried).toEqual(ok("retried"));
    expect(active.size).toBe(0);
  });

  it("mutation が例外を投げても finally で lease を解放する", async () => {
    const { active, capacity } = guard({});

    await expect(
      capacity.withLease(WORKSPACE, "brand", async () => {
        throw new Error("fault injection");
      }),
    ).rejects.toThrow("fault injection");

    expect(active.size).toBe(0);
    expect(
      await capacity.withLease(WORKSPACE, "brand", async () => ok("retried")),
    ).toEqual(ok("retried"));
  });

  it("提供元で生成済み・利用量未確定の失敗は月末まで lease を保持する", async () => {
    const { active, capacity } = guard({});

    const failed = await capacity.withLease(WORKSPACE, "generation", async () =>
      err(
        markGenerationCapacityConsumed(
          domainError("UPSTREAM_UNAVAILABLE", "利用量を確定できませんでした。", {
            retryable: true,
          }),
        ),
      ),
    );

    expect(failed.ok).toBe(false);
    expect(active.size).toBe(1);
    expect([...active.values()][0]?.expiresAt).toEqual(
      new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + 1, 1)),
    );
  });
});
