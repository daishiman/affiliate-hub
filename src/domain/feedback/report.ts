import {
  type BrandId,
  type DomainError,
  type FeedbackCaptureId,
  type FeedbackReportId,
  type Result,
  type SiteId,
  type UserId,
  type WorkspaceId,
  domainError,
  err,
  ok,
  validationError,
} from "../shared";
import { type DispositionRecord } from "./disposition";
import { type HandoffState, emptyHandoffState } from "./handoff";
import { type FeedbackStatus } from "./status";

/**
 * Product Feedback コンテキスト / 改善要望 1 件（仕様 §5〜§6）。
 *
 * **1 件で 1 件**であり、標本ではない。件数がそろうのを待たない
 * （`domain/analytics/loop-kinds.ts` の `product_improvement` を参照）。
 *
 * 集約が持つのは「届いた声」と「そのとき自動で分かったこと」だけ。
 * 実装が進んだかどうかは Beads が正本で、ここには写さない（仕様 §12）。
 */
export const FEEDBACK_KINDS = ["not_working", "hard_to_use", "want_feature"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/**
 * 種類の表示名。
 *
 * 「バグ」「不具合」と書かない。送る人は不具合かどうかを判定できないし、
 * 判定を求めると「これは不具合と言えるだろうか」で送るのをやめてしまう。
 */
export const FEEDBACK_KIND_LABELS: Readonly<Record<FeedbackKind, string>> = {
  not_working: "うまく動かない",
  hard_to_use: "使いにくい・直したい",
  want_feature: "こんな機能がほしい",
};

/** 送信時に自動で分かる、画面の場所（FB-AC-11）。 */
export type FeedbackOrigin = {
  /** 画面名。利用者に書かせない。 */
  readonly screenName: string;
  readonly url: string;
  /** ルート（`/admin/sites/[site]` のような形）。画面名より変わりにくい。 */
  readonly route: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
};

/**
 * 技術情報（FB-AC-12）。
 *
 * 詳細画面では**件数を先に出す**。中身を開かないと 0 件かどうか分からないと、
 * 「何かエラーが出ていたのでは」と毎回開くことになる。
 */
export type TechnicalContext = {
  readonly jsErrors: readonly string[];
  readonly failedRequests: readonly string[];
  readonly userAgent: string;
  /** 直前の操作。何をしたら起きたのかをたどるために持つ。 */
  readonly recentActions: readonly string[];
  /**
   * 収集の時点で落とした項目の数（FB-AC-13）。
   * 0 でない場合は「一部を伏せました」と画面に出す。**黙って落とさない。**
   */
  readonly redactedCount: number;
};

/** 履歴の 1 行。**消さずに積む**（仕様 §9 FB-AC-22）。 */
export type FeedbackHistoryEntry = {
  readonly at: Date;
  readonly by: string;
  /** 何をしたか。利用者がそのまま読める日本語で入れる。 */
  readonly summary: string;
};

export type FeedbackReport = {
  readonly id: FeedbackReportId;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId | null;
  readonly siteId: SiteId | null;
  readonly kind: FeedbackKind;
  /** 改善したいこと（必須）。 */
  readonly body: string;
  /** どうなってほしいか（任意）。**空のときは画面で「記入はありません」と出す。** */
  readonly wish: string | null;
  readonly origin: FeedbackOrigin;
  readonly technical: TechnicalContext;
  /** そのときの画面。画像なしでも要望は成立する（FB-AC-10）。 */
  readonly captureId: FeedbackCaptureId | null;
  readonly submittedBy: UserId;
  readonly submittedAt: Date;
  readonly status: FeedbackStatus;
  readonly disposition: DispositionRecord | null;
  readonly handoff: HandoffState;
  /**
   * Beads の課題番号。**1 件につき最大 1 つ**（仕様 §12）。
   * 着手・完了の状態はここへ写さない。写すと必ず片方が古くなる。
   */
  readonly beadsIssueId: string | null;
  readonly history: readonly FeedbackHistoryEntry[];
};

/** 本文の上限。長すぎる本文は指示文の組み立てで切り詰められ、意図が落ちる。 */
export const MAX_BODY_LENGTH = 4000;
export const MAX_WISH_LENGTH = 200;

export function createFeedbackReport(input: {
  id: FeedbackReportId;
  workspaceId: WorkspaceId;
  brandId?: BrandId | null;
  siteId?: SiteId | null;
  kind: FeedbackKind;
  body: string;
  wish?: string | null;
  origin: FeedbackOrigin;
  technical: TechnicalContext;
  captureId?: FeedbackCaptureId | null;
  submittedBy: UserId;
  at: Date;
}): Result<FeedbackReport, DomainError> {
  if (!FEEDBACK_KINDS.includes(input.kind)) {
    return err(validationError("どれについての要望かを選んでください。", "kind"));
  }
  const body = input.body.trim();
  if (body === "") {
    return err(
      validationError("改善したいことを書いてください。", "body"),
    );
  }
  if (body.length > MAX_BODY_LENGTH) {
    return err(
      domainError(
        "VALIDATION_FAILED",
        `改善したいことが長すぎます（${body.length} 文字 / 上限 ${MAX_BODY_LENGTH} 文字）。`,
        { field: "body", suggestedAction: "困っている場面を 1 つに絞ると伝わりやすくなります。" },
      ),
    );
  }
  const wishRaw = input.wish ?? null;
  const wish = wishRaw === null || wishRaw.trim() === "" ? null : wishRaw.trim();
  if (wish !== null && wish.length > MAX_WISH_LENGTH) {
    return err(
      validationError(`どうなってほしいかは ${MAX_WISH_LENGTH} 文字までです。`, "wish"),
    );
  }
  if (input.origin.route.trim() === "") {
    return err(
      domainError("VALIDATION_FAILED", "どの画面から送られたのか分かりません。", {
        field: "route",
        suggestedAction: "画面の場所は自動で入ります。入っていない場合は送信の作りが誤っています。",
      }),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    brandId: input.brandId ?? null,
    siteId: input.siteId ?? null,
    kind: input.kind,
    body,
    wish,
    origin: input.origin,
    technical: input.technical,
    captureId: input.captureId ?? null,
    submittedBy: input.submittedBy,
    submittedAt: input.at,
    status: "open",
    disposition: null,
    handoff: emptyHandoffState(),
    beadsIssueId: null,
    history: [
      { at: input.at, by: String(input.submittedBy), summary: "改善要望が届きました。" },
    ],
  });
}

/** 履歴を積む。**上書きしない。** */
export function appendHistory(
  report: FeedbackReport,
  entry: FeedbackHistoryEntry,
): FeedbackReport {
  return { ...report, history: [...report.history, entry] };
}

/**
 * Beads の課題番号を結び付ける。
 *
 * すでに結び付いているときは差し替えない。差し替えると、
 * どちらの課題でこの要望を扱ったのかが履歴からたどれなくなる。
 */
export function linkBeadsIssue(
  report: FeedbackReport,
  issueId: string,
): Result<FeedbackReport, DomainError> {
  if (issueId.trim() === "") {
    return err(validationError("課題番号が空です。", "beadsIssueId"));
  }
  if (report.beadsIssueId !== null && report.beadsIssueId !== issueId) {
    return err(
      domainError(
        "CONFLICT",
        `この要望はすでに ${report.beadsIssueId} と結び付いています。`,
        {
          field: "beadsIssueId",
          suggestedAction: "1 件の要望が持つ課題番号は 1 つまでです。別の作業なら要望を分けてください。",
        },
      ),
    );
  }
  return ok({ ...report, beadsIssueId: issueId });
}

/** 「どうなってほしいか」が空のとき、画面へ出す文（黙って欄を消さない）。 */
export const WISH_ABSENT_TEXT = "本人からの記入はありません。";
