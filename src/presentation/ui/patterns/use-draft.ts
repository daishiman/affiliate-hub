"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ux-design 正本の §4-1 `useDraft` をそのまま React 用に移植。
 *
 * 返す時刻は `draftSavedAt`（**端末の localStorage へ書けた時刻**）。
 * サーバーが保存へ使った時刻（`BlogOpsState.persistedAt`）とも、
 * 読者が「気になる」を押した時刻（`ShortlistItem.shortlistedAt`）とも別物で、
 * 3 つとも `savedAt` と呼んでいたため取り違えが起きていた。
 */
export function useDraft<T extends Record<string, unknown>>(
  empty: T,
  {
    key,
    delay = 600,
    ttl = 7 * 24 * 60 * 60 * 1000,
  }: { readonly key: string; readonly delay?: number; readonly ttl?: number },
) {
  const [values, setValues] = useState<T>(empty);
  const [restored, setRestored] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return;
      const { data, at } = JSON.parse(raw) as { data: T; at: number };
      if (Date.now() - at > ttl) {
        window.localStorage.removeItem(key);
        return;
      }
      const hasContent = Object.values(data).some((value) => String(value ?? "").trim() !== "");
      if (hasContent) {
        const restoreTimer = window.setTimeout(() => {
          setValues(data);
          setRestored(true);
          setDraftSavedAt(new Date(at));
          setDirty(true);
        }, 0);
        return () => window.clearTimeout(restoreTimer);
      }
    } catch {
      window.localStorage.removeItem(key);
    }
  }, [key, ttl]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  const update = useCallback(
    (patch: Partial<T>) => {
      setDirty(true);
      setValues((previous) => {
        const next = { ...previous, ...patch };
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          const hasContent = Object.values(next).some(
            (value) => String(value ?? "").trim() !== "",
          );
          if (hasContent) {
            window.localStorage.setItem(key, JSON.stringify({ data: next, at: Date.now() }));
            setDraftSavedAt(new Date());
          } else {
            window.localStorage.removeItem(key);
            setDraftSavedAt(null);
          }
        }, delay);
        return next;
      });
    },
    [delay, key],
  );

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    window.localStorage.removeItem(key);
    setValues(empty);
    setRestored(false);
    setDraftSavedAt(null);
    setDirty(false);
  }, [empty, key]);

  /**
   * サーバー保存成功後だけ、端末下書きを忘れる。入力中の値はそのまま残す。
   * `clear` は利用者が「端末下書きを破棄」したとき用で、初期値へ戻す点が違う。
   */
  const forget = useCallback((patch?: Partial<T>) => {
    clearTimeout(timer.current);
    window.localStorage.removeItem(key);
    if (patch !== undefined) setValues((previous) => ({ ...previous, ...patch }));
    setRestored(false);
    setDraftSavedAt(null);
    setDirty(false);
  }, [key]);

  return { values, update, clear, forget, restored, draftSavedAt, dirty };
}
