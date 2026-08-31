/** @vitest-environment jsdom */
/** @tier 1 @req REQ-BOPS04, REQ-BOPS05 @types state-transition, boundary */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDraft } from "@/presentation/ui";

const KEY = "test:blog-article-draft";
const NOW = new Date("2026-08-30T03:00:00.000Z");
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("600msの端末下書き", () => {
  it("入力から600ms後に版番と全値を保存する", () => {
    const { result } = renderHook(() =>
      useDraft({ revision: 1, title: "", rows: [] as string[] }, { key: KEY }),
    );

    act(() => result.current.update({ title: "書きかけ", rows: ["本文"] }));
    expect(result.current.dirty).toBe(true);
    act(() => vi.advanceTimersByTime(599));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    act(() => vi.advanceTimersByTime(1));

    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "{}").data).toEqual({
      revision: 1,
      title: "書きかけ",
      rows: ["本文"],
    });
  });

  it("7日以内は再読込で復元し、破棄またはサーバー保存成功で消せる", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        data: { revision: 1, title: "復元する下書き", rows: ["本文"] },
        at: NOW.getTime() - SEVEN_DAYS + 1,
      }),
    );
    const { result } = renderHook(() =>
      useDraft({ revision: 1, title: "", rows: [] as string[] }, { key: KEY }),
    );
    act(() => vi.runOnlyPendingTimers());

    expect(result.current.restored).toBe(true);
    expect(result.current.values.title).toBe("復元する下書き");
    expect(result.current.dirty).toBe(true);

    act(() => result.current.forget({ revision: 2 }));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(result.current.values).toMatchObject({ revision: 2, title: "復元する下書き" });
    expect(result.current.restored).toBe(false);
    expect(result.current.dirty).toBe(false);

    act(() => result.current.update({ title: "破棄する下書き" }));
    act(() => vi.advanceTimersByTime(600));
    act(() => result.current.clear());
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(result.current.values.title).toBe("");
  });

  it("7日を過ぎた下書きは復元せず削除する", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        data: { revision: 1, title: "期限切れ", rows: [] },
        at: NOW.getTime() - SEVEN_DAYS - 1,
      }),
    );
    const { result } = renderHook(() =>
      useDraft({ revision: 1, title: "", rows: [] as string[] }, { key: KEY }),
    );

    expect(result.current.restored).toBe(false);
    expect(result.current.values.title).toBe("");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});
