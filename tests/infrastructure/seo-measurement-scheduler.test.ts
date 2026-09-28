/** @tier 1 @req REQ-SEO12 @types boundary, equivalence */
import { describe, expect, it } from "vitest";
import {
  rotateTargets,
  reserveQueryRows,
  reserveStaticPages,
  returnUnusedQueryRows,
  settledSearchConsoleWindow,
  type CollectionTarget,
} from "@/infrastructure/platform/seo-measurement-scheduler";

const targets: readonly CollectionTarget[] = [
  { workspaceId: "one", siteSlug: "alpha" },
  { workspaceId: "two", siteSlug: "beta" },
  { workspaceId: "three", siteSlug: "gamma" },
];

describe("SEO measurement scheduler bounds", () => {
  it("Search Consoleは直近3日を除く確定済み7日だけを選ぶ", () => {
    expect(settledSearchConsoleWindow(new Date("2026-09-06T17:00:00.000Z"))).toEqual({
      startDate: "2026-08-28",
      endDate: "2026-09-03",
    });
  });

  it("共有query予算の先頭siteをUTC日ごとに回して固定siteへ偏らせない", () => {
    const order = (day: number) => rotateTargets(targets, new Date(day * 86_400_000))
      .map((target) => target.siteSlug);
    expect(order(0)).toEqual(["alpha", "beta", "gamma"]);
    expect(order(1)).toEqual(["beta", "gamma", "alpha"]);
    expect(order(2)).toEqual(["gamma", "alpha", "beta"]);
  });

  it("外部処理前にquery allocationを予約し、成功時だけ未使用分を次siteへ戻す", () => {
    const reservation = reserveQueryRows(40_000);
    expect(reservation).toEqual({ allocated: 40_000, remaining: 0 });
    // error pathでは返却関数を呼ばず remaining=0 のままなので二重消費しない。
    expect(reservation.remaining).toBe(0);
    expect(returnUnusedQueryRows(reservation.allocated, 12_345)).toBe(27_655);
  });

  it("静的監査は全ブログ合計25ページを先に予約し、後続siteで再利用しない", () => {
    const first = reserveStaticPages(25);
    expect(first).toEqual({ allocated: 25, remaining: 0 });
    expect(reserveStaticPages(first.remaining)).toEqual({ allocated: 0, remaining: 0 });
    expect(reserveStaticPages(100).allocated).toBe(25);
  });
});
