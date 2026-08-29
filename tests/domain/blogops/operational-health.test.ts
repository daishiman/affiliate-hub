/**
 * @tier 1
 * @req REQ-BOPS10
 * @types decision-table, equivalence
 */
import { describe, expect, it } from "vitest";
import {
  deliveryOperationalState,
  selectOperationalRows,
  type OperationalHealth,
} from "@/domain/blogops";

describe("運用健全性", () => {
  it("未点検と欠落を健全に畳まない", () => {
    expect(deliveryOperationalState(["ok", "off"])).toBe("healthy");
    expect(deliveryOperationalState(["ok", "unchecked"])).toBe("unchecked");
    expect(deliveryOperationalState(["unchecked", "missing"])).toBe("attention");
  });

  it("要確認だけを先に絞り、同値は名前で安定させる", () => {
    const healthy: OperationalHealth = {
      compliance: "healthy",
      delivery: "healthy",
      freshness: "fresh",
    };
    const rows = [
      { name: "い", health: healthy },
      { name: "あ", health: { ...healthy, delivery: "unchecked" as const } },
      { name: "う", health: { ...healthy, freshness: "stale" as const } },
    ];

    expect(
      selectOperationalRows(rows, { health: "attention", sort: "attention" }, (row) => row).map(
        (row) => row.name,
      ),
    ).toEqual(["あ", "う"]);
  });
});
