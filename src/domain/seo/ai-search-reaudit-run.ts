import type { WorkspaceId } from "@/domain/shared";

export const AI_SEARCH_REAUDIT_RUN_STATUSES = ["succeeded", "partial", "failed"] as const;
export type AiSearchReauditRunStatus = (typeof AI_SEARCH_REAUDIT_RUN_STATUSES)[number];

export const AI_SEARCH_REAUDIT_FAILURE_CODES = [
  "target_list_unavailable",
  "article_audit_failed",
] as const;
export type AiSearchReauditFailureCode =
  (typeof AI_SEARCH_REAUDIT_FAILURE_CODES)[number];

/**
 * workspace 単位の、直近 1 回の定期再点検の最終状態。
 *
 * 記事ごとの履歴とは役割が違う。これは「今回の cron 自体が
 * 完了したか」を管理画面へ伝えるための小さな投影である。
 */
export type AiSearchReauditRun = {
  readonly workspaceId: WorkspaceId;
  readonly status: AiSearchReauditRunStatus;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly scanned: number;
  readonly recorded: number;
  readonly failed: number;
  readonly failureCode: AiSearchReauditFailureCode | null;
};

type FinishedRunInput = Omit<
  AiSearchReauditRun,
  "status" | "failureCode"
>;

function assertFinishedCounts(input: FinishedRunInput): void {
  const counts = [input.scanned, input.recorded, input.failed];
  if (counts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error("AI search re-audit counts must be non-negative safe integers.");
  }
  if (input.scanned !== input.recorded + input.failed) {
    throw new Error("AI search re-audit scanned must equal recorded plus failed.");
  }
  if (input.completedAt.getTime() < input.startedAt.getTime()) {
    throw new Error("AI search re-audit completedAt must not precede startedAt.");
  }
}

/** 対象取得後に最後まで走った run。0 件は正常に succeeded。 */
export function finishAiSearchReauditRun(input: FinishedRunInput): AiSearchReauditRun {
  assertFinishedCounts(input);
  const status =
    input.failed === 0 ? "succeeded" : input.recorded === 0 ? "failed" : "partial";
  return {
    ...input,
    status,
    failureCode: input.failed === 0 ? null : "article_audit_failed",
  };
}

/** 対象一覧そのものを取得できず、記事単位の処理へ進めなかった run。 */
export function failAiSearchReauditRun(input: {
  readonly workspaceId: WorkspaceId;
  readonly startedAt: Date;
  readonly completedAt: Date;
}): AiSearchReauditRun {
  if (input.completedAt.getTime() < input.startedAt.getTime()) {
    throw new Error("AI search re-audit completedAt must not precede startedAt.");
  }
  return {
    ...input,
    status: "failed",
    scanned: 0,
    recorded: 0,
    failed: 0,
    failureCode: "target_list_unavailable",
  };
}
