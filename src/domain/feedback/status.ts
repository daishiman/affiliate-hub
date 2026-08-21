import { type DomainError, type Result, domainError, err, ok } from "../shared";

/**
 * Product Feedback コンテキスト / 対応状況（仕様 §9 FB-AC-21）。
 *
 * 表すのは「**受け取ってから作業する側へ渡すまで**」だけ。
 * 実装が進んだかどうかは Beads が正本であり、こちらへ写さない（仕様 §12）。
 * 写すと必ず片方が古くなり、どちらを見ればよいか誰にも分からなくなる。
 *
 * 遷移は表で持つ。分岐で書くと「この画面からだけ飛べる」抜け道ができる。
 */
export const FEEDBACK_STATUSES = ["open", "in_progress", "resolved", "declined"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_STATUS_LABELS: Readonly<Record<FeedbackStatus, string>> = {
  open: "未対応",
  in_progress: "対応中",
  resolved: "対応済み",
  declined: "見送り",
};

/** 一覧の絞り込みで「終わっていないもの」に入る状態。 */
export const UNFINISHED_STATUSES: readonly FeedbackStatus[] = ["open", "in_progress"];

const ALLOWED: Readonly<Record<FeedbackStatus, readonly FeedbackStatus[]>> = {
  open: ["in_progress", "resolved", "declined"],
  in_progress: ["resolved", "declined", "open"],
  // 終わったものからも戻せる。「間違って対応済みにした」を直せないと、
  // 正しい状態を保つより「触らない」が選ばれるようになる。
  resolved: ["in_progress", "open"],
  declined: ["open", "in_progress"],
};

export function canChangeStatus(from: FeedbackStatus, to: FeedbackStatus): boolean {
  return ALLOWED[from].includes(to);
}

/**
 * 見送りには理由が要る。
 *
 * 理由の無い見送りは、後から読んだ人に「検討したのか、放置したのか」が分からない。
 */
export function assertStatusChange(
  from: FeedbackStatus,
  to: FeedbackStatus,
  note: string | null,
): Result<FeedbackStatus, DomainError> {
  if (from === to) {
    return err(
      domainError("VALIDATION_FAILED", `すでに「${FEEDBACK_STATUS_LABELS[to]}」です。`, {
        field: "status",
      }),
    );
  }
  if (!canChangeStatus(from, to)) {
    return err(
      domainError(
        "INVARIANT_VIOLATED",
        `「${FEEDBACK_STATUS_LABELS[from]}」から「${FEEDBACK_STATUS_LABELS[to]}」へは進められません。`,
        { field: "status", suggestedAction: "先に「対応中」へ戻してください。" },
      ),
    );
  }
  if (to === "declined" && (note === null || note.trim() === "")) {
    return err(
      domainError("VALIDATION_FAILED", "見送る理由を書いてください。", {
        field: "note",
        suggestedAction:
          "理由が無いと、後から読んだ人には検討した結果なのか放置なのか分かりません。",
      }),
    );
  }
  return ok(to);
}
