"use server";

import { revalidatePath } from "next/cache";
import type { ContentState } from "@/domain/authoring";
import { contentUseCases, currentActor } from "@/presentation/composition";
import type { ContentProgressState } from "./content-progress-state";

/**
 * 記事の画面から段階を進める操作。
 *
 * ここは**4 つ目の入口**で、REST・WebMCP・バックエンド MCP と同じ
 * `advanceState` ユースケースを呼ぶ。進んでよいかの判断も、
 * 人の操作が要るかどうかも、いまどこにいるかの確認もユースケース側にある。
 * 画面側へ写した時点で「画面からは進められるが AI からは進められない」が生まれる。
 *
 * `from` を画面から送るのは、**押した人が見ていた段階**を伝えるため。
 * これを信じて進めるのではなく、保存先の値と食い違ったら断るために使う
 * （画面を開いたまま別の人が先へ進めていた場合に、後から押したほうが勝たない）。
 */
export async function advanceContentStateAction(
  _prev: ContentProgressState,
  formData: FormData,
): Promise<ContentProgressState> {
  const variantId = String(formData.get("variantId") ?? "");
  const from = String(formData.get("from") ?? "") as ContentState;
  const to = String(formData.get("to") ?? "") as ContentState;

  const result = await (await contentUseCases()).advanceState.execute(await currentActor(), {
    variantId,
    from,
    to,
  });

  if (!result.ok) {
    return {
      status: "failed",
      // 次にすることが書いてあるならそちらを出す。原因だけ出しても直せない。
      message: result.error.suggestedAction ?? result.error.message,
      field: result.error.field,
    };
  }

  revalidatePath(`/admin/content/${variantId}`);
  revalidatePath("/admin/content");

  return { status: "done", message: `「${result.value.label}」へ進めました。` };
}

/**
 * 記事の画面から承認する操作。
 *
 * 進める操作と分けてあるのは、承認が**人にしかできない**唯一の操作だからで、
 * 段階の選び直しと同じ見た目にすると、選択肢の 1 つとして押される。
 */
export async function approveContentAction(
  _prev: ContentProgressState,
  formData: FormData,
): Promise<ContentProgressState> {
  const variantId = String(formData.get("variantId") ?? "");

  const result = await (await contentUseCases()).approve.execute(await currentActor(), {
    variantId,
  });

  if (!result.ok) {
    return {
      status: "failed",
      message: result.error.suggestedAction ?? result.error.message,
      field: result.error.field,
    };
  }

  revalidatePath(`/admin/content/${variantId}`);
  revalidatePath("/admin/content");

  return {
    status: "done",
    message: "承認しました。この記事を出す配信を作れるようになりました。",
  };
}
