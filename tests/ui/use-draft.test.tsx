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
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("600msの端末下書き", () => {
  it("同じ描画待ちの間に別々の章が更新されても両方の本文を保持する", () => {
    const { result } = renderHook(() => useDraft({ title: "最初", rows: [
      { id: "a", body: "旧A" }, { id: "b", body: "旧B" },
    ] }, { key: KEY }));

    act(() => {
      result.current.update({ title: "変更した見出し" });
      result.current.update((previous) => ({ rows: previous.rows.map((row) =>
        row.id === "a" ? { ...row, body: "アップロードA" } : row,
      ) }));
      result.current.update((previous) => ({ rows: previous.rows.map((row) =>
        row.id === "b" ? { ...row, body: "アップロードB" } : row,
      ) }));
    });

    expect(result.current.values).toEqual({ title: "変更した見出し", rows: [
      { id: "a", body: "アップロードA" }, { id: "b", body: "アップロードB" },
    ] });
    act(() => vi.advanceTimersByTime(600));
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "{}").data).toEqual(result.current.values);
  });

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
    // 破棄は直近のサーバー保存成功へ戻す。初回読込の古い版へは戻さない。
    expect(result.current.values).toMatchObject({ revision: 2, title: "復元する下書き" });
  });

  it("サーバー保存後の変更を破棄しても、成功した版番と本文を巻き戻さない", () => {
    const { result } = renderHook(() => useDraft({ revision: 1, title: "最初" }, { key: KEY }));
    act(() => result.current.update({ title: "保存する本文" }));
    act(() => result.current.forget({ revision: 2 }));
    act(() => result.current.update({ title: "その後の編集" }));
    act(() => result.current.clear());
    expect(result.current.values).toEqual({ revision: 2, title: "保存する本文" });
    expect(result.current.dirty).toBe(false);
  });

  it("送信後に届いた編集は古い送信の成功で保存済み扱いにしない", () => {
    const { result } = renderHook(() => useDraft({ revision: 1, title: "最初" }, { key: KEY }));
    act(() => result.current.update({ title: "送信した本文" }));
    const submitted = result.current.values;
    act(() => result.current.update({ title: "送信後の編集" }));
    act(() => result.current.forget({ revision: 2 }, submitted));

    expect(result.current.values).toEqual({ revision: 2, title: "送信後の編集" });
    expect(result.current.dirty).toBe(true);
    act(() => vi.advanceTimersByTime(600));
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "{}").data).toEqual(result.current.values);
    act(() => result.current.clear());
    expect(result.current.values).toEqual({ revision: 2, title: "送信した本文" });
  });

  for (const leave of ["unmount", "pagehide"] as const) {
    it(`600msを待たず${leave}しても直前の入力を端末に残す`, () => {
      const { result, unmount } = renderHook(() => useDraft({ title: "" }, { key: KEY }));
      act(() => result.current.update({ title: "直前の入力" }));
      act(() => {
        if (leave === "unmount") unmount();
        else window.dispatchEvent(new Event("pagehide"));
      });
      expect(JSON.parse(window.localStorage.getItem(KEY) ?? "{}").data).toEqual({ title: "直前の入力" });
    });
  }

  it("localStorageの読み書き・削除が拒否されても編集とサーバー保存を続けられる", () => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error("storage denied"); });
    }
    const { result } = renderHook(() => useDraft({ title: "" }, { key: KEY }));
    expect(() => act(() => {
      result.current.update({ title: "端末保存不可でも入力は残る" });
      vi.advanceTimersByTime(600);
    })).not.toThrow();
    expect(result.current.values.title).toBe("端末保存不可でも入力は残る");
    expect(result.current.dirty).toBe(true);
    expect(result.current.draftStorageError).toBeTruthy();
    expect(() => act(() => result.current.forget())).not.toThrow();
    expect(() => act(() => result.current.clear())).not.toThrow();
  });

  it("復元待ちの間に書き始めた内容を古い端末下書きで上書きしない", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ data: { title: "古い下書き" }, at: NOW.getTime() }));
    const { result } = renderHook(() => useDraft({ title: "" }, { key: KEY }));
    act(() => result.current.update({ title: "いま書いた内容" }));
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.values.title).toBe("いま書いた内容");
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
