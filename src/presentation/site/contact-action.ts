"use server";

import { readerActor, readerUseCases } from "@/presentation/composition";
import { refusalText } from "@/presentation/refusal-text";

/**
 * 問い合わせの送信。
 *
 * 画面から呼ぶのはこの関数だけで、中身は
 * **REST / WebMCP / バックエンド MCP と同じユースケース**を呼ぶ。
 * 画面用にもう 1 つ実装を作らない（作ると片方だけ検証が甘くなる）。
 */

/**
 * 送った結果。
 *
 * 成功は `done`。**この画面だけの呼び名を作らない**（2026-08-22 / ah-brd）。
 * 元は `sent` だったが、他 15 個のフォームは同じ意味を `done` と呼んでいた。
 * 名前が違うと、結果の出し方を共通部品（`FormResult`）に載せられなくなり、
 * 同じ 4 行をこの画面だけが自前で持ち続けることになる。
 */
export type ContactFormState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** どの欄が原因か。欄の下に出す。 */
  readonly field?: string;
};

export async function submitContactAction(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const siteSlug = String(formData.get("siteSlug") ?? "");
  const body = String(formData.get("body") ?? "");
  const replyTo = String(formData.get("replyTo") ?? "");
  const token = String(formData.get("humanCheckToken") ?? "");

  const result = await readerUseCases().submitContact.execute(readerActor(), {
    siteSlug,
    body,
    replyTo: replyTo === "" ? undefined : replyTo,
    humanCheckToken: token === "" ? undefined : token,
  });

  if (!result.ok) {
    return {
      status: "failed",
      message: refusalText(result.error),
      field: result.error.field,
    };
  }

  return {
    status: "done",
    message: `受け付けました（受付番号 ${result.value.receiptId}）。`,
  };
}
