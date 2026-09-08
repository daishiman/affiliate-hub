import { type AuditClock, buildAuditEntry } from "@/application/audit";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { ActorContext, DomainError } from "@/domain/shared";

/**
 * IndexNow へ公開 URL を知らせた結末。
 *
 * `detail` は画面へ返す診断であり、監査ログへは複製しない。外部接続の
 * 例外文が安全だと、この層から証明できないためである。監査へ残すのは
 * 列挙済みの status と、このファイルで固定した理由だけに絞る。
 */
export type IndexNowOutcome = {
  readonly status: "skipped" | "sent" | "failed";
  readonly detail: string;
};

export type RecordedIndexNowOutcome = IndexNowOutcome & {
  /** D1 などの永続監査へ書けたか。通知そのものの status とは分ける。 */
  readonly auditStatus: "recorded" | "failed";
};

export type RecordIndexNowOutcomeDeps = AuditClock & {
  readonly auditLog: AuditLogPort;
};

const AUDIT_REASON: Readonly<Record<IndexNowOutcome["status"], string>> = {
  sent: "IndexNow が公開 URL の通知を受理した。",
  skipped: "IndexNow 通知を送らない条件だったため、送信をスキップした。",
  failed: "IndexNow への公開 URL 通知が完了しなかった。",
};

function withAuditFailure(
  outcome: IndexNowOutcome,
  error: DomainError,
): RecordedIndexNowOutcome {
  return {
    ...outcome,
    auditStatus: "failed",
    detail: `${outcome.detail} ただし、通知結果の記録を保存できませんでした: ${error.message}`,
  };
}

/**
 * IndexNow の結末を、公開操作とは独立した監査行として追記する。
 *
 * 監査の失敗で通知済み・公開済みの事実を失敗へ言い換えない。呼び出し側が
 * 両方を表示できるよう、通知 status はそのままに `auditStatus` と detail へ
 * 記録失敗を足して返す。
 */
export async function recordIndexNowOutcome(
  deps: RecordIndexNowOutcomeDeps,
  actor: ActorContext,
  input: {
    readonly targetUrl: string;
    readonly outcome: IndexNowOutcome;
  },
): Promise<RecordedIndexNowOutcome> {
  const entry = buildAuditEntry(deps, actor, {
    action: "indexnow.notification_finished",
    targetType: "public_url",
    targetId: input.targetUrl,
    before: null,
    after: { status: input.outcome.status },
    reason: AUDIT_REASON[input.outcome.status],
  });
  if (!entry.ok) return withAuditFailure(input.outcome, entry.error);

  const appended = await deps.auditLog.append(entry.value);
  if (!appended.ok) return withAuditFailure(input.outcome, appended.error);

  return { ...input.outcome, auditStatus: "recorded" };
}
