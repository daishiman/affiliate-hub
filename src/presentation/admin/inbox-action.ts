"use server";

import { revalidatePath } from "next/cache";
import type { DomainError } from "@/domain/shared";
import { linkInboxUseCases, signedInActor } from "@/presentation/composition";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";

/**
 * 受信箱の操作。
 *
 * 画面から呼ぶのはこの 2 つだけで、中身は
 * **REST / WebMCP / バックエンド MCP と同じユースケース**を呼ぶ。
 * 画面用にもう 1 つ実装を作らない（作ると片方だけ検証が甘くなる）。
 */

export type InboxFormState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。欄の下に出す。 */
  readonly field?: string;
  /** 注意して伝えたいこと（重複など）。成功していても出す。 */
  readonly warn?: boolean;
};

const INBOX_PATH = "/admin/inbox";

/**
 * --- 身元の取り方について ---
 * `currentActor()` ではなく `signedInActor()` を使う。前者は身元を
 * 確かめられないとき**見本の身元へ落ちる**ので、ログインしていない人の操作が
 * ユースケースまで届く。届いた先の砦は**役の一覧**で、あれは人が編集する表である。
 *
 * 2026-08-19 の実測では、ログインしていない状態で URL が本当に受信箱へ入った
 * （`ah-dao`）。受信箱は誰でも書ける置き場ではない。
 */
export async function submitAffiliateUrlAction(
  _prev: InboxFormState,
  formData: FormData,
): Promise<InboxFormState> {
  const actor = await signedInActor();
  if (actor === null) {
    // **`formData` を読む前に断る。** 読んでから断ると、断り文が
    // 「URL を入れてください」に化けて、押した人は URL を直して何度も試す。
    return { status: "failed", message: notSignedInText("リンクの登録") };
  }

  const url = String(formData.get("url") ?? "");
  const note = String(formData.get("note") ?? "");

  const submitUseCases = await linkInboxUseCases();
  const result = await submitUseCases.submit.execute(actor, {
    url,
    // 画面から入れた、と分かるようにする。経路ごとに責任者が違う。
    source: "paste",
    note: note === "" ? undefined : note,
  });

  if (!result.ok) {
    return {
      status: "failed",
      message: refusalText(result.error),
      field: result.error.field,
    };
  }

  revalidatePath(INBOX_PATH);
  return {
    status: "done",
    message: result.value.message,
    warn: result.value.duplicate,
  };
}

/**
 * 受信箱の 1 件を次へ進める、または対象外にする。
 *
 * 3 つの操作を 1 つの入口にまとめている。
 * ボタンごとに入口を分けると、権限の確認を書き忘れる箇所が 3 倍になる。
 *
 * 身元も同じ理由でここ 1 か所で確かめる。`currentActor()` は身元を
 * 確かめられないとき**見本の身元へ落ちる**ので、`signedInActor()` を使う。
 * 2026-08-19 の実測では、ログインしていない状態で取り込みが本当に進んだ
 * （「対象外にしました。理由も一緒に残しています。」が返った。`ah-dao`）。
 */
export async function advanceLinkIngestionAction(
  _prev: InboxFormState,
  formData: FormData,
): Promise<InboxFormState> {
  const actor = await signedInActor();
  if (actor === null) {
    // **`formData` を読む前に断る。** 読んでから断ると、断り文が
    // 「理由を書いてください」に化けて、押した人は理由を書いて何度も試す。
    return { status: "failed", message: notSignedInText("受信箱の操作") };
  }

  const linkIngestionId = String(formData.get("linkIngestionId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const useCases = await linkInboxUseCases();

  if (intent === "resolve") {
    const programId = String(formData.get("programId") ?? "");
    const result = await useCases.resolve.execute(actor, { linkIngestionId, programId });
    if (!result.ok) return failed(result.error);
    revalidatePath(INBOX_PATH);
    return { status: "done", message: `広告主を「${result.value.programLabel}」に決めました。` };
  }

  if (intent === "match") {
    const productId = String(formData.get("productId") ?? "");
    const result = await useCases.match.execute(actor, { linkIngestionId, productId });
    if (!result.ok) return failed(result.error);
    revalidatePath(INBOX_PATH);
    return { status: "done", message: "商品に結びつけました。" };
  }

  if (intent === "reject") {
    const reason = String(formData.get("reason") ?? "");
    const result = await useCases.reject.execute(actor, { linkIngestionId, reason });
    if (!result.ok) return failed(result.error);
    revalidatePath(INBOX_PATH);
    return { status: "done", message: "対象外にしました。理由も一緒に残しています。" };
  }

  return {
    status: "failed",
    message: "できることは、広告主を決める・商品に結びつける・対象外にする、の 3 つです。",
  };
}

function failed(error: DomainError): InboxFormState {
  return {
    status: "failed",
    message: refusalText(error),
    field: error.field,
  };
}
