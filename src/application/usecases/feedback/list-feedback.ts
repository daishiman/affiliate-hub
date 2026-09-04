import type { FeedbackFilter, FeedbackRepositoryPort } from "@/application/ports/feedback";
import {
  type FeedbackKind,
  type FeedbackReport,
  type FeedbackStatus,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_DISPOSITION_LABELS,
  hasBeenHandedOff,
} from "@/domain/feedback";
import { requireCapability } from "@/domain/identity";
import { type ActorContext, type DomainError, type Result, ok } from "@/domain/shared";
import type { UseCase } from "../usecase";
import { ensureFeedbackAccess } from "./feedback-access";

/**
 * 改善要望の一覧。
 *
 * 状態ごとの件数を**必ず一緒に返す**。件数を別の呼び出しにすると、
 * 絞り込んだ一覧と件数がずれた瞬間に、どちらが正しいか誰にも分からなくなる。
 *
 * 並び順は「新しい順」1 つに固定する。並び替えを増やす前に、
 * 絞り込みで足りるかを見る（絞り込みは足しても列の意味が変わらない）。
 */
export type ListFeedbackDeps = {
  readonly repository: FeedbackRepositoryPort;
};

export type ListFeedbackInput = FeedbackFilter;

export type FeedbackRow = {
  readonly id: string;
  readonly kind: FeedbackKind;
  readonly kindLabel: string;
  /** 一覧に出す 1 行分の抜粋。本文全体は詳細で読む。 */
  readonly summary: string;
  readonly screenName: string;
  readonly route: string;
  readonly status: FeedbackStatus;
  readonly statusLabel: string;
  readonly dispositionLabel: string | null;
  readonly submittedAt: Date;
  readonly handedOff: boolean;
  readonly handoffCount: number;
  readonly lastHandoffAt: Date | null;
  readonly beadsIssueId: string | null;
};

export type ListFeedbackOutput = {
  readonly rows: readonly FeedbackRow[];
  /** 状態ごとの件数。絞り込みを外した全体の数ではなく、いま見えている集合の数。 */
  readonly counts: Readonly<Record<FeedbackStatus, number>>;
  readonly emptyReason: string | null;
};

const SUMMARY_LENGTH = 60;

function summarize(body: string): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length <= SUMMARY_LENGTH ? oneLine : `${oneLine.slice(0, SUMMARY_LENGTH)}…`;
}

function toRow(report: FeedbackReport): FeedbackRow {
  return {
    id: String(report.id),
    kind: report.kind,
    kindLabel: FEEDBACK_KIND_LABELS[report.kind],
    summary: summarize(report.body),
    screenName: report.origin.screenName,
    route: report.origin.route,
    status: report.status,
    statusLabel: FEEDBACK_STATUS_LABELS[report.status],
    dispositionLabel:
      report.disposition === null ? null : FEEDBACK_DISPOSITION_LABELS[report.disposition.kind],
    submittedAt: report.submittedAt,
    handedOff: hasBeenHandedOff(report.handoff),
    handoffCount: report.handoff.count,
    lastHandoffAt: report.handoff.lastAt,
    beadsIssueId: report.beadsIssueId,
  };
}

export function createListFeedbackUseCase(
  deps: ListFeedbackDeps,
): UseCase<ListFeedbackInput, ListFeedbackOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ListFeedbackInput,
    ): Promise<Result<ListFeedbackOutput, DomainError>> {
      const allowed = requireCapability(actor, "feedback.read", "改善要望の参照");
      if (!allowed.ok) return allowed;

      const queried = await deps.repository.list(actor.workspaceId, input);
      if (!queried.ok) return queried;

      const rows = queried.value
        .filter((report) => ensureFeedbackAccess(actor, report).ok)
        .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
        .map(toRow);

      const counts = Object.fromEntries(
        FEEDBACK_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]),
      ) as Record<FeedbackStatus, number>;

      // 0 件のときに「なぜ 0 件か」を返す。白紙は「壊れている」と読まれる。
      const filtered =
        (input.statuses?.length ?? 0) > 0 ||
        (input.kinds?.length ?? 0) > 0 ||
        input.route !== undefined ||
        input.handedOff !== undefined;
      const emptyReason =
        rows.length > 0
          ? null
          : filtered
            ? "この絞り込みに当てはまる要望はありません。条件を外すと見つかることがあります。"
            : "まだ改善要望はありません。画面の右下のボタンから送れます。";

      return ok({ rows, counts, emptyReason });
    },
  };
}
