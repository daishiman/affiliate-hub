"use server";

import { revalidatePath } from "next/cache";
import { linkInboxUseCases, signedInActor } from "@/presentation/composition";
import { failureFromDomainError, notSignedInFailure } from "./use-case-result";

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
    return notSignedInFailure("リンクの登録");
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
    return failureFromDomainError(result.error);
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
    return notSignedInFailure("受信箱の操作");
  }

  const linkIngestionId = String(formData.get("linkIngestionId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const useCases = await linkInboxUseCases();

  if (intent === "resolve") {
    const programId = String(formData.get("programId") ?? "");
    const result = await useCases.resolve.execute(actor, { linkIngestionId, programId });
    if (!result.ok) return failureFromDomainError(result.error);
    revalidatePath(INBOX_PATH);
    return { status: "done", message: `広告主を「${result.value.programLabel}」に決めました。` };
  }

  if (intent === "match") {
    const productId = String(formData.get("productId") ?? "");
    const result = await useCases.match.execute(actor, { linkIngestionId, productId });
    if (!result.ok) return failureFromDomainError(result.error);
    revalidatePath(INBOX_PATH);
    return { status: "done", message: "商品に結びつけました。" };
  }

  /*
   * 記事に出せる成果リンクとして登録する。**受信箱の最後の一歩。**
   *
   * 商品名を画面から受け取るのは、それが写しの正本だからである
   * （`register-affiliate-link.ts` と `docs/product/design-decisions.md` §2）。
   * 空欄のまま押されたときは、ここで埋めずにユースケースに断らせる。
   * ここで「—」を入れて通すと、その文字列が読者のカードに商品名として出る。
   */
  if (intent === "register") {
    const productName = String(formData.get("productName") ?? "");
    const brand = String(formData.get("brand") ?? "");
    const oneLine = String(formData.get("oneLine") ?? "");
    const result = await useCases.register.execute(actor, {
      linkIngestionId,
      productName,
      ...(brand === "" ? {} : { brand }),
      ...(oneLine === "" ? {} : { oneLine }),
    });
    if (!result.ok) return failureFromDomainError(result.error);
    revalidatePath(INBOX_PATH);
    return { status: "done", message: result.value.message };
  }

  if (intent === "reject") {
    const reason = String(formData.get("reason") ?? "");
    const result = await useCases.reject.execute(actor, { linkIngestionId, reason });
    if (!result.ok) return failureFromDomainError(result.error);
    revalidatePath(INBOX_PATH);
    return { status: "done", message: "対象外にしました。理由も一緒に残しています。" };
  }

  return {
    status: "failed",
    message:
      "できることは、広告主を決める・商品に結びつける・成果リンクとして登録する・対象外にする、の 4 つです。",
  };
}
