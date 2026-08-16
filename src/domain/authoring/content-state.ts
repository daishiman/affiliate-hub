import { type DomainError, type Result, domainError, ok, err } from "../shared";

/**
 * コンテンツの状態遷移 (プラットフォーム層 §18.1)。
 *
 * 遷移表をコードで持つ理由: 「承認を飛ばして公開」を型と検査で止めるため。
 * 状態を文字列で持ち回り、画面ごとに if で判断すると必ず抜ける。
 */
export const CONTENT_STATES = [
  "IDEA",
  "RESEARCHING",
  "BRIEF_READY",
  "GENERATED",
  "FACT_CHECK",
  "COMPLIANCE_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "MONITORING",
  "REFRESH_DUE",
  "ARCHIVED",
] as const;
export type ContentState = (typeof CONTENT_STATES)[number];

/** 許可された遷移。ここに無い遷移は行えない。 */
const ALLOWED: Readonly<Record<ContentState, readonly ContentState[]>> = {
  IDEA: ["RESEARCHING", "ARCHIVED"],
  RESEARCHING: ["BRIEF_READY", "ARCHIVED"],
  BRIEF_READY: ["GENERATED", "RESEARCHING", "ARCHIVED"],
  GENERATED: ["FACT_CHECK", "BRIEF_READY", "ARCHIVED"],
  FACT_CHECK: ["COMPLIANCE_REVIEW", "GENERATED", "ARCHIVED"],
  COMPLIANCE_REVIEW: ["APPROVED", "FACT_CHECK", "ARCHIVED"],
  APPROVED: ["SCHEDULED", "PUBLISHED", "COMPLIANCE_REVIEW", "ARCHIVED"],
  SCHEDULED: ["PUBLISHED", "APPROVED", "ARCHIVED"],
  PUBLISHED: ["MONITORING", "REFRESH_DUE", "ARCHIVED"],
  MONITORING: ["REFRESH_DUE", "ARCHIVED"],
  REFRESH_DUE: ["RESEARCHING", "GENERATED", "PUBLISHED", "ARCHIVED"],
  ARCHIVED: [],
};

/** 人間の承認なしに入れない状態。AI サービスアカウントはここへ進められない。 */
export const HUMAN_APPROVAL_REQUIRED: ReadonlySet<ContentState> = new Set<ContentState>([
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
]);

export function transition(
  from: ContentState,
  to: ContentState,
  actor: { isAiServiceAccount: boolean },
): Result<ContentState, DomainError> {
  if (!ALLOWED[from].includes(to)) {
    return err(
      domainError("CONFLICT", `${from} から ${to} へは進めません。`, {
        suggestedAction: `${from} から進める先: ${ALLOWED[from].join(" / ") || "なし"}`,
      }),
    );
  }
  if (actor.isAiServiceAccount && HUMAN_APPROVAL_REQUIRED.has(to)) {
    return err(
      domainError("FORBIDDEN", `${to} への変更は人が行う必要があります。`, {
        suggestedAction: "担当者が内容を確認してから操作してください。",
      }),
    );
  }
  return ok(to);
}

export function allowedNextStates(from: ContentState): readonly ContentState[] {
  return ALLOWED[from];
}
