import { type DomainError, type Result, domainError, err, ok } from "../shared";

/**
 * Product Feedback コンテキスト / 扱い（仕様 §9 FB-AC-22）。
 *
 * 「対応しない」「重複」「廃棄」は**すべて取り消せる**。
 * 取り消せない操作にすると、判断に迷ったときに「とりあえず何もしない」が選ばれ、
 * 一覧が終わらないもので埋まる。
 *
 * 状態（`status.ts`）とは別に持つ。状態は進み方、扱いは打ち切り方であり、
 * 1 つの列にまとめると「見送り」と「廃棄」の区別が付かなくなる。
 */
export const FEEDBACK_DISPOSITIONS = ["will_not_fix", "duplicate", "discarded"] as const;
export type FeedbackDisposition = (typeof FEEDBACK_DISPOSITIONS)[number];

export const FEEDBACK_DISPOSITION_LABELS: Readonly<Record<FeedbackDisposition, string>> = {
  will_not_fix: "対応しない",
  duplicate: "重複",
  discarded: "廃棄",
};

export type DispositionRecord = {
  readonly kind: FeedbackDisposition;
  /** なぜそう扱ったか。空にできない。 */
  readonly reason: string;
  /** 重複のときだけ、どれと同じかを指す。 */
  readonly duplicateOf: string | null;
  readonly decidedBy: string;
  readonly decidedAt: Date;
};

export function decideDisposition(input: {
  kind: FeedbackDisposition;
  reason: string;
  duplicateOf?: string | null;
  decidedBy: string;
  at: Date;
}): Result<DispositionRecord, DomainError> {
  if (input.reason.trim() === "") {
    return err(
      domainError(
        "VALIDATION_FAILED",
        `「${FEEDBACK_DISPOSITION_LABELS[input.kind]}」にする理由を書いてください。`,
        { field: "reason" },
      ),
    );
  }
  const duplicateOf = input.duplicateOf ?? null;
  if (input.kind === "duplicate" && (duplicateOf === null || duplicateOf.trim() === "")) {
    return err(
      domainError("VALIDATION_FAILED", "どの要望と同じかを選んでください。", {
        field: "duplicateOf",
        suggestedAction: "同じものが分からないまま重複にすると、まとめた先をたどれません。",
      }),
    );
  }
  if (input.kind !== "duplicate" && duplicateOf !== null) {
    return err(
      domainError("VALIDATION_FAILED", "重複以外では、同じ要望の指定はできません。", {
        field: "duplicateOf",
      }),
    );
  }
  return ok({
    kind: input.kind,
    reason: input.reason.trim(),
    duplicateOf,
    decidedBy: input.decidedBy,
    decidedAt: input.at,
  });
}

/**
 * 扱いを取り消して元に戻す。
 *
 * 取り消しは「記録を消す」ではない。扱いを外すだけで、
 * 誰がいつ取り消したかは履歴（`report.ts` の `history`）に積む。
 */
export function undoDisposition(
  current: DispositionRecord | null,
): Result<null, DomainError> {
  if (current === null) {
    return err(
      domainError("VALIDATION_FAILED", "取り消せる扱いがありません。", {
        suggestedAction: "この要望は「対応しない」「重複」「廃棄」のいずれにもなっていません。",
      }),
    );
  }
  return ok(null);
}

/** 廃棄箱に入っているか。一覧の既定の絞り込みから外す判断に使う。 */
export function isDiscarded(current: DispositionRecord | null): boolean {
  return current?.kind === "discarded";
}
