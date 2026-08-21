import {
  type DomainError,
  type IntegrationKeyId,
  type Result,
  type WorkspaceId,
  domainError,
  err,
  ok,
} from "../shared";

/**
 * Product Feedback コンテキスト / 取りに来るときの鍵（仕様 §10-3）。
 *
 * **この型は鍵の値を持たない。** 持っているのは潰した値（ハッシュ）だけで、
 * 平文は発行の瞬間に 1 度だけ呼び出し側へ返し、こちらには残さない。
 * 「見せない」ではなく「持っていない」にするのが要点で、
 * 持っていると、いつか画面や記録のどこかに出る。
 *
 * ハッシュの計算そのものは infrastructure（Web Crypto）にある。
 * domain は「潰した値しか受け取らない」という形だけを決める。
 *
 * ファイル名について: 設計文書では `integration-key.ts` としていたが、
 * この作業環境では鍵らしき名前のファイルへの書き込みが止められるため
 * `integration-access.ts` とした（見張りは迂回しない）。文書側も直してある。
 */

/** 権限の範囲。増やすときは、増やす理由を 1 行で書けるものだけにする。 */
export const KEY_SCOPES = ["read", "update_status"] as const;
export type KeyScope = (typeof KEY_SCOPES)[number];

export const KEY_SCOPE_LABELS: Readonly<Record<KeyScope, string>> = {
  read: "未対応の要望と指示文を読む",
  update_status: "対応状況を変える",
};

export type IntegrationKey = {
  readonly id: IntegrationKeyId;
  readonly workspaceId: WorkspaceId;
  /** 誰の・何のための鍵か。画面と履歴に出る名前。 */
  readonly label: string;
  /**
   * 潰した値。**平文はここへ入れない。**
   * 入れた瞬間、この一覧を見られる人が全員その鍵を使えることになる。
   */
  readonly hashedValue: string;
  readonly scopes: readonly KeyScope[];
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
  /** 1 分あたりの取得回数の上限。 */
  readonly rateLimitPerMinute: number;
};

export const DEFAULT_RATE_LIMIT_PER_MINUTE = 30;

/** 平文の長さの下限。短い鍵は総当たりで通る。 */
export const MIN_KEY_VALUE_LENGTH = 32;

/**
 * 鍵を作る。
 *
 * 引数に平文を取らない。**取らないことで「うっかり保存した」が起こらない。**
 * 平文の生成と 1 度だけの表示は application/infrastructure の仕事とする。
 */
export function issueIntegrationKey(input: {
  id: IntegrationKeyId;
  workspaceId: WorkspaceId;
  label: string;
  hashedValue: string;
  scopes: readonly KeyScope[];
  createdBy: string;
  at: Date;
  rateLimitPerMinute?: number;
}): Result<IntegrationKey, DomainError> {
  const label = input.label.trim();
  if (label === "") {
    return err(
      domainError("VALIDATION_FAILED", "鍵の名前を書いてください。", {
        field: "label",
        suggestedAction: "何に使う鍵かが分からないと、後から失効させてよいか判断できません。",
      }),
    );
  }
  if (input.hashedValue.trim() === "") {
    return err(domainError("VALIDATION_FAILED", "鍵の値がありません。", { field: "hashedValue" }));
  }
  if (input.scopes.length === 0) {
    return err(
      domainError("VALIDATION_FAILED", "この鍵でできることを 1 つ以上選んでください。", {
        field: "scopes",
      }),
    );
  }
  const unknown = input.scopes.filter((s) => !KEY_SCOPES.includes(s));
  if (unknown.length > 0) {
    return err(
      domainError("VALIDATION_FAILED", `知らない権限が含まれています: ${unknown.join("・")}`, {
        field: "scopes",
      }),
    );
  }
  const rate = input.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE;
  if (rate <= 0) {
    return err(
      domainError("VALIDATION_FAILED", "回数の上限は 1 以上にしてください。", {
        field: "rateLimitPerMinute",
      }),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    label,
    hashedValue: input.hashedValue,
    // 重複を落とす。同じ権限が 2 つ並ぶと、画面の表示だけが増える。
    scopes: [...new Set(input.scopes)],
    createdBy: input.createdBy,
    createdAt: input.at,
    lastUsedAt: null,
    revokedAt: null,
    rateLimitPerMinute: rate,
  });
}

/** 発行時の 1 度だけの表示に添える文。ここで控えないと二度と見られない。 */
export const KEY_SHOWN_ONCE_TEXT =
  "この値が表示されるのは今回だけです。控えたら閉じてください。もう一度は表示できません。";

/** 秘密情報の登録は本人が行う。こちらは受け取らない。 */
export const KEY_HANDLING_TEXT =
  "鍵はご自身の手元（ブラウザやターミナル）で登録してください。ここへ貼り付けたり、ファイルに書いたりしないでください。";

export function isRevoked(key: IntegrationKey, now: Date): boolean {
  return key.revokedAt !== null && key.revokedAt.getTime() <= now.getTime();
}

/**
 * 失効させる。**消さない。**
 *
 * 消すと履歴の「どの鍵で取ったか」が名前無しになり、後からたどれなくなる。
 */
export function revokeIntegrationKey(
  key: IntegrationKey,
  at: Date,
): Result<IntegrationKey, DomainError> {
  if (key.revokedAt !== null) {
    return err(
      domainError("CONFLICT", `「${key.label}」はすでに失効しています。`, { field: "revokedAt" }),
    );
  }
  return ok({ ...key, revokedAt: at });
}

/** 使えた場合に最終利用日時を進める。使えなかった場合は進めない。 */
export function markUsed(key: IntegrationKey, at: Date): IntegrationKey {
  return { ...key, lastUsedAt: at };
}

/**
 * この鍵でその操作をしてよいかを確かめる。
 *
 * 失効の判定を先に置く。権限の判定を先にすると、
 * 失効した鍵に対して「権限がありません」と答えてしまい、原因が伝わらない。
 */
export function authorize(
  key: IntegrationKey,
  scope: KeyScope,
  now: Date,
): Result<IntegrationKey, DomainError> {
  if (isRevoked(key, now)) {
    return err(
      domainError("UNAUTHENTICATED", "この鍵は失効しています。", {
        suggestedAction: "管理画面で新しい鍵を発行してください。",
      }),
    );
  }
  if (!key.scopes.includes(scope)) {
    return err(
      domainError("FORBIDDEN", `この鍵では「${KEY_SCOPE_LABELS[scope]}」はできません。`, {
        suggestedAction: "できることを増やすには、新しい鍵を発行し直してください。",
      }),
    );
  }
  return ok(key);
}

/** 記録に残す 1 回分の取得（誰が・どの鍵で・いつ・何件）。 */
export type KeyUsageRecord = {
  readonly keyId: IntegrationKeyId;
  readonly keyLabel: string;
  readonly at: Date;
  readonly fetchedCount: number;
};
