"use server";

import { headers } from "next/headers";
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
  const token = String(
    formData.get("cf-turnstile-response") ?? formData.get("humanCheckToken") ?? "",
  );
  const requestIdentity = await contactRequestIdentity();

  const result = await (await readerUseCases()).submitContact.execute(readerActor(), {
    siteSlug,
    body,
    replyTo: replyTo === "" ? undefined : replyTo,
    humanCheckToken: token === "" ? undefined : token,
    rateLimitIdentity: requestIdentity === undefined
      ? undefined
      : { scope: "ip", value: requestIdentity.remoteIp },
    remoteIp: requestIdentity?.remoteIp,
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

async function contactRequestIdentity(): Promise<
  { readonly remoteIp: string } | undefined
> {
  try {
    const incoming = await headers();
    // Cloudflareが認証して付ける値だけを信頼する。x-forwarded-forはクライアントが
    // 任意に名乗れる環境があるため、回数制限にもSiteverifyにも渡さない。
    const cloudflareIp = incoming.get("cf-connecting-ip")?.trim();
    if (!cloudflareIp) return undefined;
    return { remoteIp: cloudflareIp };
  } catch {
    // request metadata が取れない実行は、ユースケースが fail-closed で断る。
    return undefined;
  }
}
