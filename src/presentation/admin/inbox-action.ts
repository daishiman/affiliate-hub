"use server";

import { revalidatePath } from "next/cache";
import { currentActor, linkInboxUseCases } from "@/presentation/composition";

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

export async function submitAffiliateUrlAction(
  _prev: InboxFormState,
  formData: FormData,
): Promise<InboxFormState> {
  const url = String(formData.get("url") ?? "");
  const note = String(formData.get("note") ?? "");

  const result = await linkInboxUseCases().submit.execute(await currentActor(), {
    url,
    // 画面から入れた、と分かるようにする。経路ごとに責任者が違う。
    source: "paste",
    note: note === "" ? undefined : note,
  });

  if (!result.ok) {
    return {
      status: "failed",
      message: result.error.suggestedAction ?? result.error.message,
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
 */
export async function advanceLinkIngestionAction(
  _prev: InboxFormState,
  formData: FormData,
): Promise<InboxFormState> {
  const linkIngestionId = String(formData.get("linkIngestionId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const actor = await currentActor();
  const useCases = linkInboxUseCases();

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

function failed(error: {
  message: string;
  suggestedAction?: string;
  field?: string;
}): InboxFormState {
  return {
    status: "failed",
    message: error.suggestedAction ?? error.message,
    field: error.field,
  };
}
