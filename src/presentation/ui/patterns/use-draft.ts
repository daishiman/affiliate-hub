"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** ux-design 正本の §4-1 `useDraft` をそのまま React 用に移植。 */
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
  const [savedAt, setSavedAt] = useState<Date | null>(null);
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
      setValues((previous) => {
        const next = { ...previous, ...patch };
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          const hasContent = Object.values(next).some(
            (value) => String(value ?? "").trim() !== "",
          );
          if (hasContent) {
            window.localStorage.setItem(key, JSON.stringify({ data: next, at: Date.now() }));
            setSavedAt(new Date());
          } else {
            window.localStorage.removeItem(key);
            setSavedAt(null);
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
    setSavedAt(null);
  }, [empty, key]);

  return { values, update, clear, restored, savedAt };
}
