import type { DomainError, DomainErrorCode } from "@/domain/shared";

/**
 * ドメインのエラーを HTTP の形に直す。
 *
 * **ここが唯一の変換場所。** REST / WebMCP / バックエンド MCP の 3 つの入口で
 * それぞれ文言を書くと、同じ失敗が入口ごとに違う説明になる。
 *
 * ドメイン側は HTTP のことを知らない。だから対応表はこちらに置く。
 */
/**
 * エラーの種類 → HTTP の番号。**この表そのものが §16.4 の列挙**である。
 *
 * 外へ出しているのは、検査が全種類を回れるようにするため。
 * 検査の側で同じ一覧を書き写すと、種類が 1 つ増えたときに追随せず、
 * 新しい種類だけが誰にも試されないまま通る。
 */
export const ERROR_STATUS: Readonly<Record<DomainErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  // 他テナントのデータは「存在しない」と同じ扱いにする。
  // 403 を返すと「そのIDは存在する」と教えてしまう。
  TENANT_MISMATCH: 404,
  FORBIDDEN: 403,
  UNAUTHENTICATED: 401,
  INVARIANT_VIOLATED: 422,
  COMMERCIAL_INPUT_REJECTED: 422,
  PUBLISH_GATE_FAILED: 422,
  EVIDENCE_REQUIRED: 422,
  FACT_BOUNDARY_VIOLATED: 422,
  UPSTREAM_UNAVAILABLE: 502,
  RATE_LIMITED: 429,
  NOT_SUPPORTED: 501,
  NOT_IMPLEMENTED: 501,
};

export function statusOf(error: DomainError): number {
  return ERROR_STATUS[error.code] ?? 500;
}

/**
 * 存在を隠す必要がある種類。
 *
 * **番号を揃えるだけでは足りない。** 攻撃側は ID を 1 つずつ試し、
 * 返ってきた**本文の違い**だけを見る。番号がどちらも 404 でも、
 * 片方に `(id: xxx)` が付いていたり `code` が違ったりすれば、
 * 「こちらは他所に存在する」と読めてしまい、他所の Workspace の
 * 中身が列挙できる。
 *
 * だから外へ出る手前で**1 種類の本文へ潰す**。潰す場所をここ 1 箇所に
 * するのは、入口が 3 つ（REST / WebMCP / backend MCP）あるためで、
 * 各入口で潰すと 1 つ足したときに漏れる。
 *
 * 規範: 確定済み auth 章 AUTH-ACC-002（未存在 ID と同一の 404 応答・本文）
 */
const EXISTENCE_HIDING_CODES: readonly DomainErrorCode[] = ["NOT_FOUND", "TENANT_MISMATCH"];

/**
 * 外向きの応答から、存在の手がかりを落とす。
 *
 * ID を落とすので、本人が自分のものを取り違えたときの説明は弱くなる。
 * それでも落とすのは、**弱い説明は本人が一覧を見れば補えるが、
 * 漏れた存在は取り消せない**ため。詳しい理由は記録側（監査ログ）に残す。
 */
export function maskExistence(error: DomainError): DomainError {
  if (!EXISTENCE_HIDING_CODES.includes(error.code)) return error;
  return {
    code: "NOT_FOUND",
    message: "対象が見つかりません。",
    suggestedAction: "一覧から選び直すか、ID を確認してください。",
    retryable: false,
  };
}

/** API の失敗レスポンス。形は 1 種類だけにする。 */
export function errorResponse(input: DomainError): Response {
  const error = maskExistence(input);
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        suggestedAction: error.suggestedAction ?? null,
        field: error.field ?? null,
        retryable: error.retryable,
      },
    },
    {
      status: statusOf(error),
      headers: error.retryable ? { "Retry-After": "5" } : undefined,
    },
  );
}

export function okResponse<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}
