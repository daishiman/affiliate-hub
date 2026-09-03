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

/** 組の各要素が持つ成功値の型。位置ごとに別の型を保つ。 */
type OkValues<T extends readonly Result<unknown, unknown>[]> = {
  readonly [K in keyof T]: T[K] extends Result<infer V, unknown> ? V : never;
};

/** 組の要素が返しうる失敗の型。 */
type ErrOf<T extends readonly Result<unknown, unknown>[]> =
  T[number] extends Result<unknown, infer E> ? E : never;

/**
 * 型の違う `Result` を組で受け、全部成功したときだけ値の組を返す。
 *
 * `collect` は同じ型の配列用で、型の違う読み取りを束ねられない。
 * 束ねる道具が無いと、呼び出し側は「失敗を返す番人」と
 * 「型を絞り込むための番人」を別々に書くことになる。
 * すると後者は**構造的に到達しない枝**になり、読む人には
 * 意味のある分岐に見えたまま、永遠に真にならない。
 * 1 つの関数で両方を担うのは、その死んだ枝を作らせないため。
 */
export function collectAll<T extends readonly Result<unknown, unknown>[]>(
  ...results: T
): Result<OkValues<T>, ErrOf<T>> {
  const values: unknown[] = [];
  for (const r of results) {
    if (!r.ok) return err(r.error as ErrOf<T>);
    values.push(r.value);
  }
  return ok(values as unknown as OkValues<T>);
}
