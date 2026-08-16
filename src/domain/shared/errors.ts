/**
 * 共通エラー型。
 *
 * 仕様書 (ブログ層 §16.4) のエラー形式に対応する。
 * REST / WebMCP / backend MCP の 3 アダプタは、この 1 種類のエラーを
 * それぞれの表現へ変換するだけにする。エラー文言を 3 箇所で書かない。
 *
 *   code             機械が分岐するための識別子。UPPER_SNAKE_CASE。
 *   message          利用者がそのまま読んで直せる説明。「invalid」では直せない。
 *   retryable        同じ入力でもう一度試す価値があるか。
 *   suggestedAction  次に何をすればよいか。エージェントもこれを読む。
 */
export type DomainErrorCode =
  // 入力・存在
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  // テナント・権限
  | "TENANT_MISMATCH"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  // 不変条件
  | "INVARIANT_VIOLATED"
  | "COMMERCIAL_INPUT_REJECTED"
  | "PUBLISH_GATE_FAILED"
  | "EVIDENCE_REQUIRED"
  | "FACT_BOUNDARY_VIOLATED"
  // 外部連携
  | "UPSTREAM_UNAVAILABLE"
  | "RATE_LIMITED"
  | "NOT_SUPPORTED"
  // 未実装 (たたき台のスタブが返す。空実装を成功で返さないため)
  | "NOT_IMPLEMENTED";

export type DomainError = {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly suggestedAction?: string;
  /** どの項目が原因か。フォーム表示とツール引数の再検証で使う。 */
  readonly field?: string;
  /** 追加文脈。秘密情報を入れてはならない (§26.3 機密情報のマスキング)。 */
  readonly details?: Readonly<Record<string, string | number | boolean | null>>;
};

export function domainError(
  code: DomainErrorCode,
  message: string,
  options: {
    retryable?: boolean;
    suggestedAction?: string;
    field?: string;
    details?: Readonly<Record<string, string | number | boolean | null>>;
  } = {},
): DomainError {
  return {
    code,
    message,
    retryable: options.retryable ?? false,
    suggestedAction: options.suggestedAction,
    field: options.field,
    details: options.details,
  };
}

export function validationError(message: string, field?: string): DomainError {
  return domainError("VALIDATION_FAILED", message, { field });
}

export function notFound(what: string, id: string): DomainError {
  return domainError("NOT_FOUND", `${what} が見つかりません (id: ${id})。`, {
    suggestedAction: "一覧から選び直すか、IDを確認してください。",
  });
}

/**
 * まだ実装していない処理が返す。
 *
 * たたき台では未実装が多数ある。空の成功を返すと「動いている」と誤認され、
 * 後から探せなくなる。未実装は必ずこの形で失敗として表面化させる。
 */
export function notImplemented(what: string): DomainError {
  return domainError("NOT_IMPLEMENTED", `${what} はまだ実装されていません (たたき台のスタブ)。`, {
    retryable: false,
    suggestedAction: "残課題リストを確認してください。",
  });
}
