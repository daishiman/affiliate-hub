"use client";

import { Icon } from "@/presentation/ui";
import type { BlogOpsState } from "./blog-ops-state";

/** 保存状態は色だけでなく、常にアイコンと短い文字で示す。 */
export function ArticleSaveStatus({
  state,
  pending,
  dirty,
}: {
  readonly state: BlogOpsState;
  readonly pending: boolean;
  readonly dirty: boolean;
}) {
  const view = pending
    ? { label: "保存中", icon: "schedule" as const }
    : state.status === "failed" && state.errorCode === "CONFLICT"
      ? { label: "保存競合", icon: "calloutWarn" as const }
      : state.status === "failed"
        ? { label: "保存失敗", icon: "calloutWarn" as const }
        : dirty
          ? { label: "未保存", icon: "article" as const }
          : { label: "保存済み", icon: "complete" as const };

  return (
    <p role="status" aria-live="polite" aria-atomic="true">
      <span data-save-status-icon={view.icon}>
        <Icon name={view.icon} />
      </span>{" "}
      <strong>{view.label}</strong>
      {view.label === "保存済み" && state.persistedAt !== undefined ? (
        <> — <time dateTime={state.persistedAt}>{new Date(state.persistedAt).toLocaleTimeString("ja-JP")}</time></>
      ) : null}
    </p>
  );
}
