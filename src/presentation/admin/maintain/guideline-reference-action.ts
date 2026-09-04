"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/domain/identity";
import { guidelineReferenceEntry, signedInActor } from "@/presentation/composition";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";
import type { GuidelineReferenceState } from "./guideline-reference-state";

const PATH = "/admin/settings/seo";
const ID = z.string().trim().min(1).max(128);
const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const INPUT = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("add"),
    title: z.string().max(300),
    url: z.string().max(2_048),
    publisher: z.string().max(300),
    region: z.enum(["global", "jp"]),
    checkedAt: YMD,
    note: z.string().max(2_000).optional(),
  }),
  z.object({ intent: z.literal("recheck"), id: ID, checkedAt: YMD }),
  z.object({ intent: z.literal("verify_source"), id: ID, body: z.string().max(900_000) }),
  z.object({
    intent: z.literal("acknowledge_reopen"),
    id: ID,
    expectedContentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  }),
]);

/** `FormData` の File を文字列へ暗黙変換せず、境界で型違いとして断る。 */
function textValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

function boundaryInput(formData: FormData): unknown {
  const intent = textValue(formData, "intent");
  if (intent === "add") {
    return {
      intent,
      title: textValue(formData, "title"),
      url: textValue(formData, "url"),
      publisher: textValue(formData, "publisher"),
      region: textValue(formData, "region"),
      checkedAt: textValue(formData, "checkedAt"),
      ...(textValue(formData, "note") === undefined
        ? {}
        : { note: textValue(formData, "note") }),
    };
  }
  if (intent === "recheck") {
    return {
      intent,
      id: textValue(formData, "id"),
      checkedAt: textValue(formData, "checkedAt"),
    };
  }
  if (intent === "verify_source") {
    return { intent, id: textValue(formData, "id"), body: textValue(formData, "body") };
  }
  if (intent === "acknowledge_reopen") {
    return {
      intent,
      id: textValue(formData, "id"),
      expectedContentSha256: textValue(formData, "expectedContentSha256"),
    };
  }
  return { intent };
}

/**
 * SEO/AI 指針の出典を登録する・再確認 (確認日の更新) する・原典の取得を記録する。
 *
 * 4 つを 1 つの関数にしているのは、ユースケース側が 1 つの口だからである
 * (`manage_guideline_references`)。画面側だけ割ると、
 * 権限の確認と入力の検査が散る。どの操作かは `intent` で分ける。
 *
 * ログインを最初に見る。確かめられないときは formData を読む前に断る。
 */
export async function manageGuidelineReferenceAction(
  _prev: GuidelineReferenceState,
  formData: FormData,
): Promise<GuidelineReferenceState> {
  const actor = await signedInActor();
  if (actor === null) {
    return { status: "failed", message: notSignedInText("指針の出典の登録・再確認") };
  }

  // Server Action 自体でも membership から復元した actor の権限・workspace 範囲を
  // 毎回確認する。usecase 側の同じ確認は、別入口から呼ばれたときの防御になる。
  const allowed = requireCapability(actor, "site.manage", "SEO/AI 指針の出典の管理");
  if (!allowed.ok) {
    return { status: "failed", message: refusalText(allowed.error) };
  }

  const parsed = INPUT.safeParse(boundaryInput(formData));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      status: "failed",
      message: "入力内容を確認できませんでした。画面を読み込み直して、もう一度操作してください。",
      ...(typeof field === "string" ? { field } : { field: "intent" }),
    };
  }

  const entry = await guidelineReferenceEntry();
  if (!entry.ready) {
    // 使えない理由をそのまま返す。「登録できませんでした」で終わらせない。
    return { status: "failed", message: entry.reason };
  }

  const input = parsed.data;
  const intent = input.intent;

  const result = await entry.manage.execute(
    actor,
    intent === "verify_source"
      ? {
          action: "verify_source",
          id: input.id,
          body: input.body,
        }
      : intent === "recheck"
      ? {
          action: "recheck",
          id: input.id,
          checkedAt: input.checkedAt,
        }
      : intent === "acknowledge_reopen"
      ? {
          action: "acknowledge_reopen",
          id: input.id,
          expectedContentSha256: input.expectedContentSha256,
        }
      : {
          action: "add",
          title: input.title,
          url: input.url,
          publisher: input.publisher,
          region: input.region,
          checkedAt: input.checkedAt,
          ...(input.note === undefined || input.note.trim() === "" ? {} : { note: input.note.trim() }),
        },
  );

  if (!result.ok) {
    return {
      status: "failed",
      message: refusalText(result.error),
      field: result.error.field,
    };
  }

  revalidatePath(PATH);

  return {
    status: "done",
    message:
      intent === "verify_source"
        ? "原典の本文を取り込み、指紋と取得時刻を控えました。本文そのものは保存していません。前回と中身が変わっていれば、仕様の再評価の対象として下に出ます。"
        : intent === "recheck"
          ? "確認日を更新しました。次の見直しは 90 日後です。"
          : intent === "acknowledge_reopen"
            ? "この本文版について、仕様の再評価完了を記録しました。本文が再び変わったときは、もう一度ここに表示されます。"
          : "出典を登録しました。原典の本文を取り込むまでは「原典未取得」と表示されます。",
  };
}
