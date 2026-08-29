import type { DomainError } from "@/domain/shared";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";

/**
 * ユースケースの返り値から「成功したときの中身」だけを取り出す型。
 *
 * 画面を「骨格を組む関数」と「中身を出す関数」に分けると、
 * 中身の側は成功した値だけを受け取ることになる。その型を書くために
 * 各画面で `Awaited<ReturnType<…>>` を書き下すと、
 * **画面の数だけ同じ型の写しができる**（そして 1 つだけ書き間違える）。
 *
 * `Extract` を使うのは、返り値が成功と失敗の 2 つの形の**どちらか**だから。
 * 素直に `extends { ok: true }` と書くと、この 2 つに別々に当てはめられて
 * 失敗側が `never` に落ち、結果全体が `never` になる。
 *
 * 取り出しに `["value"]` を使わないのは、`T` が何であるかを
 * まだ知らない時点でも型として成り立つ必要があるため。
 * `Extract` の結果に `value` がある保証をこの場では書けない。
 * 一度 `Extract` を通してから `infer` するので、
 * 分配（union の各枝へ別々に当てる動き）はもう起きない。
 */
type Success<R> = Extract<R, { readonly ok: true }>;

export type SuccessOf<T> = Success<Awaited<T>> extends { readonly value: infer V } ? V : never;

/**
 * 管理画面の form action が画面へ返す最小の状態。
 *
 * 対象ごとの遷移先や補足値は各 state に残す。ここへ置くのは、どの form でも
 * 同じ意味になる status・message・field だけ。
 */
export type AdminActionState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。欄を特定できる失敗のときだけ入る。 */
  readonly field?: string;
};

export type AdminActionFailure = AdminActionState & {
  readonly status: "failed";
};

/**
 * 未認証を、管理画面で共通の失敗へ変える。
 *
 * 身元を確かめる境界は exported Server Action ごとに見える形で置く。
 * ここへ actor の取得まで隠すと、操作ごとの認証検査が境界を追えなくなる。
 */
export function notSignedInFailure(actionLabel: string): AdminActionFailure {
  return { status: "failed", message: notSignedInText(actionLabel) };
}

/** 業務側の断りを、管理画面で共通の失敗へ変える。 */
export function failureFromDomainError(error: DomainError): AdminActionFailure {
  return {
    status: "failed",
    message: refusalText(error),
    field: error.field,
  };
}
