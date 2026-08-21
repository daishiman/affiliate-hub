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

/** API の失敗レスポンス。形は 1 種類だけにする。 */
export function errorResponse(error: DomainError): Response {
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
