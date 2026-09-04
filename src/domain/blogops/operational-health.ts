import type { DeliveryHealthState } from "./delivery-snapshot";
import { FRESHNESS_LABEL, type Freshness } from "./blog-article";

export type OperationalHealthState = "healthy" | "attention" | "unchecked";

export type OperationalHealth = {
  readonly compliance: Exclude<OperationalHealthState, "unchecked">;
  readonly delivery: OperationalHealthState;
  readonly freshness: Freshness | "unknown";
};

export const OPERATIONAL_HEALTH_LABEL = {
  compliance: { healthy: "適合", attention: "要確認" },
  delivery: { healthy: "健全", attention: "要確認", unchecked: "未点検" },
  freshness: { ...FRESHNESS_LABEL, unknown: "記事なし" },
} as const;

export function deliveryOperationalState(
  states: readonly DeliveryHealthState[],
): OperationalHealthState {
  if (states.some((state) => state === "missing")) return "attention";
  if (states.some((state) => state === "unchecked")) return "unchecked";
  return "healthy";
}

export function operationalHealthNeedsAttention(health: OperationalHealth): boolean {
  return (
    health.compliance === "attention" ||
    health.delivery !== "healthy" ||
    health.freshness === "stale" ||
    health.freshness === "unknown"
  );
}

export type OperationalHealthQuery = {
  readonly health: "all" | "attention" | "healthy";
  readonly sort: "attention" | "freshness" | "name";
};

const FRESHNESS_RANK: Readonly<Record<OperationalHealth["freshness"], number>> = {
  stale: 0,
  unknown: 1,
  aging: 2,
  fresh: 3,
};

/** 記事とサイトが同じ絞り込み・並び順に従うための唯一の変換。 */
export function selectOperationalRows<T>(
  rows: readonly T[],
  query: OperationalHealthQuery,
  read: (row: T) => { readonly name: string; readonly health: OperationalHealth },
): readonly T[] {
  const filtered = rows.filter((row) => {
    if (query.health === "all") return true;
    return operationalHealthNeedsAttention(read(row).health) === (query.health === "attention");
  });
  return [...filtered].sort((left, right) => {
    const a = read(left);
    const b = read(right);
    if (query.sort === "name") return a.name.localeCompare(b.name, "ja");
    if (query.sort === "freshness") {
      return FRESHNESS_RANK[a.health.freshness] - FRESHNESS_RANK[b.health.freshness];
    }
    return (
      Number(operationalHealthNeedsAttention(b.health)) -
        Number(operationalHealthNeedsAttention(a.health)) ||
      a.name.localeCompare(b.name, "ja")
    );
  });
}
