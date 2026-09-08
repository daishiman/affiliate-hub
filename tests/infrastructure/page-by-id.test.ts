/** @tier 1 @req REQ-P01 */
import { describe, expect, it } from "vitest";
import { pageById } from "@/infrastructure/persistence/page-by-id";

describe("ID cursorの共通ページング", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("続きがあるときだけ最後のIDを返し、次ページは重複しない", () => {
    const first = pageById(rows, { limit: 2, cursor: null }, (row) => row.id);
    const second = pageById(rows, { limit: 2, cursor: first.nextCursor }, (row) => row.id);
    expect(first).toEqual({ items: [{ id: "a" }, { id: "b" }], nextCursor: "b" });
    expect(second).toEqual({ items: [{ id: "c" }], nextCursor: null });
  });

  it("不明なcursorで先頭へ戻って重複させない", () => {
    expect(pageById(rows, { limit: 2, cursor: "missing" }, (row) => row.id)).toEqual({
      items: [],
      nextCursor: null,
    });
  });
});
