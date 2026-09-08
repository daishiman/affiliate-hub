"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function removeStoredDraft(key: string): string | null {
  try {
    window.localStorage.removeItem(key);
    return null;
  } catch {
    return "この端末の下書きを削除できません。次回は古い下書きが復元される可能性があります。";
  }
}

function hasDraftContent(values: Record<string, unknown>): boolean {
  return Object.values(values).some((value) => String(value ?? "").trim() !== "");
}

/**
 * 端末下書きを遅延保存し、直近のサーバー保存内容を破棄時の基準にする。
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
  const [draftStorageError, setDraftStorageError] = useState<string | null>(null);
  const current = useRef(empty);
  const acknowledged = useRef(empty);
  const pending = useRef<T | null>(null);
  const editVersion = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const removeStored = useCallback(() => {
    setDraftStorageError(removeStoredDraft(key));
  }, [key]);

  const persist = useCallback((next: T, notify = true) => {
    try {
      const hasContent = hasDraftContent(next);
      const at = Date.now();
      if (hasContent) window.localStorage.setItem(key, JSON.stringify({ data: next, at }));
      else window.localStorage.removeItem(key);
      if (pending.current === next) pending.current = null;
      if (notify) {
        setDraftSavedAt(hasContent ? new Date(at) : null);
        setDraftStorageError(null);
      }
    } catch {
      if (notify) setDraftStorageError("この端末に下書きを保存できません。画面を閉じる前にサーバーへ保存してください。");
    }
  }, [key]);

  const schedule = useCallback((next: T) => {
    clearTimeout(timer.current);
    pending.current = next;
    timer.current = setTimeout(() => persist(next), delay);
  }, [delay, persist]);

  useEffect(() => {
    const discardUnreadable = () => {
      const error = removeStoredDraft(key);
      if (error === null) return;
      const noticeTimer = window.setTimeout(() => setDraftStorageError(error), 0);
      return () => window.clearTimeout(noticeTimer);
    };
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return;
      const { data, at } = JSON.parse(raw) as { data: T; at: number };
      if (
        typeof data !== "object" || data === null || Array.isArray(data) ||
        !Number.isFinite(at) || Date.now() - at > ttl
      ) {
        return discardUnreadable();
      }
      if (hasDraftContent(data)) {
        const version = editVersion.current;
        const restoreTimer = window.setTimeout(() => {
          if (editVersion.current !== version) return;
          current.current = data;
          setValues(data);
          setRestored(true);
          setDraftSavedAt(new Date(at));
          setDirty(true);
        }, 0);
        return () => window.clearTimeout(restoreTimer);
      }
    } catch {
      return discardUnreadable();
    }
  }, [key, ttl]);

  useEffect(() => {
    const flush = () => {
      clearTimeout(timer.current);
      if (pending.current !== null) persist(pending.current);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearTimeout(timer.current);
      if (pending.current !== null) persist(pending.current, false);
    };
  }, [persist]);

  const update = useCallback(
    (patch: Partial<T> | ((previous: T) => Partial<T>)) => {
      editVersion.current += 1;
      // 複数の非同期編集が同じReact batchで完了しても、直前の更新を含めて扱う。
      const next = {
        ...current.current,
        ...(typeof patch === "function" ? patch(current.current) : patch),
      };
      current.current = next;
      setDirty(true);
      setValues(next);
      schedule(next);
    },
    [schedule],
  );

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    pending.current = null;
    editVersion.current += 1;
    removeStored();
    current.current = acknowledged.current;
    setValues(acknowledged.current);
    setRestored(false);
    setDraftSavedAt(null);
    setDirty(false);
  }, [removeStored]);

  /**
   * サーバー保存成功後だけ、端末下書きを忘れる。入力中の値はそのまま残す。
   * `submitted` を渡すと、その送信の開始後に変わった入力は未保存のまま残す。
   * `clear` は直近の保存成功へ戻す。初回読込時の古い版へ巻き戻さない。
   */
  const forget = useCallback((patch?: Partial<T>, submitted?: T) => {
    clearTimeout(timer.current);
    editVersion.current += 1;
    const saved = submitted ?? current.current;
    acknowledged.current = { ...saved, ...patch };
    const changed = saved !== current.current;
    // サーバーの版番などは反映し、送信後に書き直した同名の欄は上書きしない。
    const applicable = Object.fromEntries(Object.entries(patch ?? {}).filter(
      ([field]) => current.current[field] === saved[field],
    ));
    const next = changed ? { ...current.current, ...applicable } : acknowledged.current;
    current.current = next;
    setValues(next);
    if (changed) schedule(next);
    else {
      pending.current = null;
      removeStored();
    }
    setRestored(false);
    setDraftSavedAt(null);
    setDirty(changed);
  }, [removeStored, schedule]);

  return { values, update, clear, forget, restored, draftSavedAt, dirty, draftStorageError };
}
