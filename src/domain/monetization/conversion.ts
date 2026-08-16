import {
  type AffiliateIngestionId,
  type AffiliateLinkId,
  type AffiliateProgramId,
  type ConversionId,
  type DomainError,
  type Money,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";
import type { AspKind } from "./affiliate-program";

/**
 * Affiliate & Monetization コンテキスト / 成果 (プラットフォーム層 §19.3)。
 *
 * Commercial 区分。ここの数値が Ranking や記事の評価へ流れてはならない。
 *
 * 取込データの扱い (data-lifecycle):
 *   1. ASP から取り込んだ値と、人が手で直した値を別の欄で持つ
 *   2. 確定済みの月は、後から取込値が変わっても据え置き、差分を通知する
 *   3. 突合は正規化キーで行う
 */
export type ConversionStatus =
  | "pending" // 発生。未確定
  | "approved" // 確定
  | "rejected" // 却下
  | "cancelled"; // 取消

export type Conversion = {
  readonly id: ConversionId;
  readonly workspaceId: WorkspaceId;
  readonly programId: AffiliateProgramId;
  readonly linkId: AffiliateLinkId | null;
  readonly asp: AspKind;
  /** ASP 側の成果 ID。突合の主キー。 */
  readonly externalConversionId: string;
  readonly status: ConversionStatus;
  readonly occurredAt: Date;
  readonly confirmedAt: Date | null;
  /** ASP から取り込んだ報酬額。取り込んだままの値を保持する。 */
  readonly ingestedReward: Money | null;
  /** 人が修正した報酬額。null なら修正なし。取込値を上書きしない。 */
  readonly adjustedReward: Money | null;
  /** 修正の理由。金額を変えた記録が無いと、後から検証できない。 */
  readonly adjustmentReason: string | null;
  /** 属する会計期間 (YYYY-MM)。締め処理の単位。 */
  readonly period: string;
  /** その期間が締め済みか。締め後は取込値の変更を反映しない。 */
  readonly periodClosed: boolean;
};

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function createConversion(input: {
  id: ConversionId;
  workspaceId: WorkspaceId;
  programId: AffiliateProgramId;
  linkId?: AffiliateLinkId | null;
  asp: AspKind;
  externalConversionId: string;
  status: ConversionStatus;
  occurredAt: Date;
  confirmedAt?: Date | null;
  ingestedReward?: Money | null;
  period: string;
}): Result<Conversion, DomainError> {
  if (input.externalConversionId.trim() === "") {
    return err(
      validationError(
        "ASP 側の成果 ID が必要です。無いと同じ成果を二重に取り込みます。",
        "externalConversionId",
      ),
    );
  }
  if (!PERIOD_PATTERN.test(input.period)) {
    return err(validationError("会計期間は YYYY-MM の形式で指定してください。", "period"));
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    programId: input.programId,
    linkId: input.linkId ?? null,
    asp: input.asp,
    externalConversionId: input.externalConversionId.trim(),
    status: input.status,
    occurredAt: input.occurredAt,
    confirmedAt: input.confirmedAt ?? null,
    ingestedReward: input.ingestedReward ?? null,
    adjustedReward: null,
    adjustmentReason: null,
    period: input.period,
    periodClosed: false,
  });
}

/** 実際に使う金額。手修正があればそちらを優先する。 */
export function effectiveReward(c: Conversion): Money | null {
  return c.adjustedReward ?? c.ingestedReward;
}

/**
 * 手修正を加える。
 *
 * 取込値 (ingestedReward) は書き換えない。
 * 書き換えると、次の取込との差分が出せなくなり、誤りに気づけなくなる。
 */
export function adjustReward(
  c: Conversion,
  amount: Money,
  reason: string,
): Result<Conversion, DomainError> {
  if (reason.trim() === "") {
    return err(validationError("金額を直した理由が必要です。", "adjustmentReason"));
  }
  return ok({ ...c, adjustedReward: amount, adjustmentReason: reason.trim() });
}

export type IngestionDiff = {
  readonly conversionId: ConversionId;
  readonly field: "status" | "reward";
  readonly before: string;
  readonly after: string;
  /** 締め済み期間のため反映しなかったか。 */
  readonly heldBecauseClosed: boolean;
};

/**
 * 取込値の更新を適用する。
 *
 * 締め済みの期間は据え置き、差分だけ返す。
 * 黙って過去の数字を書き換えると、締めた報告と食い違う。
 */
export function applyIngestedUpdate(
  c: Conversion,
  update: { status?: ConversionStatus; reward?: Money | null; confirmedAt?: Date | null },
): { conversion: Conversion; diffs: readonly IngestionDiff[] } {
  const diffs: IngestionDiff[] = [];
  let next = c;

  if (update.status !== undefined && update.status !== c.status) {
    diffs.push({
      conversionId: c.id,
      field: "status",
      before: c.status,
      after: update.status,
      heldBecauseClosed: c.periodClosed,
    });
    if (!c.periodClosed) next = { ...next, status: update.status };
  }

  if (update.reward !== undefined && !sameMoney(update.reward, c.ingestedReward)) {
    diffs.push({
      conversionId: c.id,
      field: "reward",
      before: describeMoney(c.ingestedReward),
      after: describeMoney(update.reward),
      heldBecauseClosed: c.periodClosed,
    });
    if (!c.periodClosed) next = { ...next, ingestedReward: update.reward };
  }

  if (!c.periodClosed && update.confirmedAt !== undefined) {
    next = { ...next, confirmedAt: update.confirmedAt };
  }

  return { conversion: next, diffs };
}

function sameMoney(a: Money | null | undefined, b: Money | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.amountMinor === b.amountMinor && a.currency === b.currency;
}

function describeMoney(m: Money | null | undefined): string {
  return m ? `${m.amountMinor} ${m.currency}` : "未取得";
}

/** 取込の実行記録。いつ・どこから・何件取り込んだか。 */
export type AffiliateIngestion = {
  readonly id: AffiliateIngestionId;
  readonly workspaceId: WorkspaceId;
  readonly asp: AspKind;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly recordCount: number;
  readonly newCount: number;
  readonly updatedCount: number;
  readonly heldCount: number;
  readonly error: string | null;
};

/**
 * 突合キーを正規化する。
 *
 * ASP により大文字小文字・前後空白・全角半角がまちまちなので、
 * 比較の前に必ずここを通す。素の文字列で比較すると重複が生まれる。
 */
export function normalizeExternalId(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}
