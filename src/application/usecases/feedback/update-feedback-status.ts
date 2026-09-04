import type { FeedbackRepositoryPort } from "@/application/ports/feedback";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import {
  type FeedbackDisposition,
  type FeedbackStatus,
  FEEDBACK_DISPOSITION_LABELS,
  FEEDBACK_STATUS_LABELS,
  appendHistory,
  assertStatusChange,
  decideDisposition,
  undoDisposition,
} from "@/domain/feedback";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  err,
  notFound,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";
import { ensureFeedbackAccess } from "./feedback-access";

/**
 * 対応状況と扱いを変える。
 *
 * 状態を進めることと、扱い（対応しない・重複・廃棄）を決めることを
 * **同じ 1 つの口**にしてある。分けると、画面が「状態も扱いも変えたい」ときに
 * 2 回呼ぶことになり、片方だけ通った状態が残る。
 *
 * どの操作でも履歴を 1 行積む。積まない道を作らない。
 */
export type UpdateFeedbackStatusDeps = {
  readonly repository: FeedbackRepositoryPort;
  readonly ids: IdGeneratorPort;
  /**
   * 誰が扱いを決めたかの記録。
   *
   * 要望そのものにも履歴（`appendHistory`）が 1 行積まれるが、**別物**である。
   * 履歴は要望と一緒に消える・書き換わりうるものを、要望を読む人に見せるためのもの。
   * 記録は追記しかできない側に残り、要望が消えても残る。
   * 「対応しない」と決めた判断は、要望が片付いた後にこそ問われる。
   */
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
};

export type UpdateFeedbackStatusInput = {
  readonly id: string;
  readonly status?: FeedbackStatus;
  /** 見送りの理由・状態変更のメモ。 */
  readonly note?: string | null;
  readonly disposition?: {
    readonly kind: FeedbackDisposition;
    readonly reason: string;
    readonly duplicateOf?: string | null;
  };
  /** 扱いを取り消して元に戻す。 */
  readonly undoDisposition?: boolean;
};

export type UpdateFeedbackStatusOutput = {
  readonly id: string;
  readonly statusLabel: string;
  readonly dispositionLabel: string | null;
  readonly historyCount: number;
};

export function createUpdateFeedbackStatusUseCase(
  deps: UpdateFeedbackStatusDeps,
): UseCase<UpdateFeedbackStatusInput, UpdateFeedbackStatusOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: UpdateFeedbackStatusInput,
    ): Promise<Result<UpdateFeedbackStatusOutput, DomainError>> {
      // 扱いを決める・取り消すのは人の判断。状態を進めるだけなら取りに来た側でもできる。
      const needsManage = input.disposition !== undefined || input.undoDisposition === true;
      const allowed = needsManage
        ? requireCapability(actor, "feedback.manage", "改善要望の扱いの決定")
        : requireCapability(actor, "feedback.status_update", "改善要望の対応状況の変更");
      if (!allowed.ok) return allowed;

      const found = await deps.repository.findById(actor.workspaceId, input.id);
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("改善要望", input.id));
      const accessible = ensureFeedbackAccess(actor, found.value);
      if (!accessible.ok) return accessible;

      const at = deps.now();
      // 変える前の姿をここで控える。下で `report` を差し替えていくので、
      // 保存の後に取ろうとすると、もう変わった後のものしか無い。
      const before = {
        status: accessible.value.status,
        disposition:
          accessible.value.disposition === null ? null : accessible.value.disposition.kind,
      };
      let report = accessible.value;

      if (input.status !== undefined) {
        const changed = assertStatusChange(report.status, input.status, input.note ?? null);
        if (!changed.ok) return changed;
        report = appendHistory(
          { ...report, status: changed.value },
          {
            at,
            by: actor.userId,
            summary: `「${FEEDBACK_STATUS_LABELS[changed.value]}」にしました。${
              input.note?.trim() ? `（${input.note.trim()}）` : ""
            }`,
          },
        );
      }

      if (input.disposition !== undefined) {
        const decided = decideDisposition({
          kind: input.disposition.kind,
          reason: input.disposition.reason,
          duplicateOf: input.disposition.duplicateOf,
          decidedBy: actor.userId,
          at,
        });
        if (!decided.ok) return decided;
        report = appendHistory(
          { ...report, disposition: decided.value },
          {
            at,
            by: actor.userId,
            summary: `「${FEEDBACK_DISPOSITION_LABELS[decided.value.kind]}」にしました。（${decided.value.reason}）`,
          },
        );
      }

      if (input.undoDisposition === true) {
        const undone = undoDisposition(report.disposition);
        if (!undone.ok) return undone;
        report = appendHistory(
          { ...report, disposition: undone.value },
          { at, by: actor.userId, summary: "扱いを取り消して元に戻しました。" },
        );
      }

      if (
        input.status === undefined &&
        input.disposition === undefined &&
        input.undoDisposition !== true
      ) {
        // 何も指定されていないのに保存すると、履歴に空の 1 行が積まれる。
        return err(validationError("変更する内容が指定されていません。", "status"));
      }

      const saved = await deps.repository.save(actor.workspaceId, report);
      if (!saved.ok) return saved;

      /*
       * 状態と扱いを 1 行にまとめて残す。**1 回の操作は 1 行**にしておかないと、
       * 記録の行数と、実際に人が押した回数が合わなくなる。
       *
       * 理由は扱いを決めたときのものを優先する。状態変更のメモより、
       * 「なぜ対応しないと決めたか」のほうが後から問われる。
       */
      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "feedback.status_changed",
        targetType: "feedback_report",
        targetId: String(report.id),
        before,
        after: {
          status: report.status,
          disposition: report.disposition === null ? null : report.disposition.kind,
        },
        reason: input.disposition?.reason ?? input.note ?? null,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("扱いの変更は保存されています", appended.error.details));
      }

      return ok({
        id: String(report.id),
        statusLabel: FEEDBACK_STATUS_LABELS[report.status],
        dispositionLabel:
          report.disposition === null
            ? null
            : FEEDBACK_DISPOSITION_LABELS[report.disposition.kind],
        historyCount: report.history.length,
      });
    },
  };
}
