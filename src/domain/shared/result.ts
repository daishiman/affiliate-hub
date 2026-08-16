/**
 * 成功か失敗かを戻り値で表す型。
 *
 * ドメイン層では throw を使わない。理由は 2 つ。
 *   1. 業務上ありうる失敗 (根拠が足りない、公開条件を満たさない) は例外ではなく結果である。
 *   2. throw は呼び出し側の型に現れないため、扱い漏れをコンパイラが検出できない。
 *
 * 想定外の失敗 (DB断・ネットワーク断) は infrastructure 層で throw してよい。
 */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return !r.ok;
}

/** 成功時だけ値を変換する。失敗はそのまま通す。 */
export function mapOk<T, U, E>(r: Result<T, E>, f: (value: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}

/** 全部成功したときだけ配列を返す。1 つでも失敗したら最初の失敗を返す。 */
export function collect<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const r of results) {
    if (!r.ok) return r;
    values.push(r.value);
  }
  return ok(values);
}
