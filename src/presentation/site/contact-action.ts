"use server";

import { readerActor, readerUseCases } from "@/presentation/composition";

/**
 * 問い合わせの送信。
 *
 * 画面から呼ぶのはこの関数だけで、中身は
 * **REST / WebMCP / バックエンド MCP と同じユースケース**を呼ぶ。
 * 画面用にもう 1 つ実装を作らない（作ると片方だけ検証が甘くなる）。
 */

export type ContactFormState = {
  readonly status: "idle" | "sent" | "failed";
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
      message: result.error.suggestedAction ?? result.error.message,
      field: result.error.field,
    };
  }

  return {
    status: "sent",
    message: `受け付けました（受付番号 ${result.value.receiptId}）。`,
  };
}
