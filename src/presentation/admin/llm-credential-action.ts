"use server";

import { revalidatePath } from "next/cache";
import { currentActor, llmCredentialEntry } from "@/presentation/composition";
import { refusalText } from "@/presentation/refusal-text";
import type { LlmCredentialState } from "./llm-credential-state";

const PATH = "/admin/settings/llm";

/**
 * 鍵を登録する・失効させる・疎通を確かめる。
 *
 * --- 3 つを 1 つの関数にしている理由 ---
 * ユースケース側が 1 つの口だからである（`manage_llm_credentials`）。
 * 画面側だけ 3 つに割ると、権限の確認と目録の照合が 3 か所に散り、
 * どれか 1 つが緩いまま残る。
 *
 * --- 入力した鍵をこの関数の外へ出さない ---
 * `formData` から取り出した値は、そのままユースケースへ渡して終わりである。
 * 戻り値・記録・ログ・再描画のどれにも載せない。
 * 失敗したときも入力欄へ戻さない（戻すと、失敗した鍵が画面に残り続ける）。
 */
export async function manageLlmCredentialAction(
  _prev: LlmCredentialState,
  formData: FormData,
): Promise<LlmCredentialState> {
  const intent = String(formData.get("intent") ?? "");
  const providerId = String(formData.get("providerId") ?? "");

  if (providerId === "") {
    return { status: "failed", message: "どの提供元かが分かりませんでした。", field: "providerId" };
  }

  const entry = await llmCredentialEntry();
  if (!entry.ready) {
    // 使えない理由をそのまま返す。**「登録できませんでした」で終わらせない。**
    return { status: "failed", message: entry.reason };
  }

  const actor = await currentActor();
  const result = await entry.manage.execute(
    actor,
    intent === "register"
      ? { action: "register", providerId, apiKey: String(formData.get("apiKey") ?? "") }
      : intent === "revoke"
        ? { action: "revoke", providerId }
        : { action: "verify", providerId, modelId: String(formData.get("modelId") ?? "") },
  );

  if (!result.ok) {
    return {
      status: "failed",
      message: refusalText(result.error),
      field: result.error.field,
    };
  }

  revalidatePath(PATH);

  // 疎通確認は、失敗しても一覧が返る作りである（ユースケース側の判断）。
  // その失敗をここで握り潰すと、画面には「確かめました」とだけ出る。
  const failure = result.value.verifyFailure;
  if (failure !== null) {
    return {
      status: "failed",
      message: `${failure.message}${failure.suggestedAction === undefined ? "" : ` ${failure.suggestedAction}`}`,
    };
  }

  return {
    status: "done",
    message:
      intent === "register"
        ? "登録しました。値はこの先どこにも表示されません（末尾 4 文字だけ控えとして出ます）。"
        : intent === "revoke"
          ? "失効させました。使うには登録し直してください。"
          : "つながりました。この鍵とモデルで使えます。",
  };
}
