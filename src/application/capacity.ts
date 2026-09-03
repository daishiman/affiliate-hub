import type {
  CapacityLeaseKind,
  WorkspaceRepositoryPort,
} from "@/application/ports/identity";
import { hasConsumedGenerationCapacity } from "@/domain/generation";
import { checkCapacity, limitsOf } from "@/domain/identity";
import { type DomainError, type Result, type WorkspaceId, domainError, err } from "@/domain/shared";

export type CapacityKind = CapacityLeaseKind;

export type CapacityGuardPort = {
  withLease<T>(
    workspaceId: WorkspaceId,
    kind: CapacityKind,
    mutation: () => Promise<Result<T, DomainError>>,
  ): Promise<Result<T, DomainError>>;
};

/** Workers の通常リクエストより十分長く、異常終了時には自動で戻る期限。 */
const CAPACITY_LEASE_MILLISECONDS = 15 * 60 * 1_000;

/** 利用量確定不能時に生成枠を保持する、現在のUTC契約月の終端。 */
function leaseExpiry(now: Date, kind: CapacityKind): Date {
  if (kind !== "generation") {
    return new Date(now.getTime() + CAPACITY_LEASE_MILLISECONDS);
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/**
 * mutation と容量確保を 1 つのスコープに閉じ込める。
 *
 * 件数を application で読んでから保存すると、同時実行がどちらも「空きあり」を見る。
 * 保存先の条件付き INSERT で lease を 1 件だけ取得し、ここで必ず解放する。
 */
export function createCapacityGuard(deps: {
  readonly workspaces: WorkspaceRepositoryPort;
  readonly now: () => Date;
}): CapacityGuardPort {
  return {
    async withLease(workspaceId, kind, mutation) {
      const found = await deps.workspaces.findById(workspaceId);
      if (!found.ok) return err(found.error);
      if (found.value === null) {
        return err(
          domainError("NOT_FOUND", "この作業場所の契約情報が見つかりません。", {
            suggestedAction: "管理担当に確認してください。",
          }),
        );
      }
      const limits = limitsOf(found.value);
      const limit = {
        brand: limits.maxBrands,
        site: limits.maxSites,
        member: limits.maxMembers,
        generation: limits.monthlyGenerations,
      }[kind];
      const now = deps.now();
      const leaseId = crypto.randomUUID();
      const acquired = await deps.workspaces.acquireCapacityLease(workspaceId, {
        id: leaseId,
        kind,
        limit,
        now,
        expiresAt: leaseExpiry(now, kind),
      });
      if (!acquired.ok) return err(acquired.error);
      if (!acquired.value) {
        const blocked = checkCapacity(found.value, kind, limit);
        if (!blocked.ok) return err(blocked.error);
        return err(domainError("INVARIANT_VIOLATED", "容量を確保できませんでした。"));
      }

      let release = true;
      try {
        const result = await mutation();
        // 提供元で消費済み・利用量未確定なら、lease 自体を月末までの耐久記録にする。
        // 次の呼び出しは llm_usages + active lease を数えるため、上限を超えない。
        if (
          kind === "generation" &&
          !result.ok &&
          hasConsumedGenerationCapacity(result.error)
        ) {
          release = false;
        }
        return result;
      } finally {
        if (release) {
          // 保存先障害でも mutation の結果を上書きしない。残った印は期限で失効する。
          await deps.workspaces.releaseCapacityLease(workspaceId, leaseId, deps.now());
        }
      }
    },
  };
}
