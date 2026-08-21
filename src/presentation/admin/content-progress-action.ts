"use server";

import { revalidatePath } from "next/cache";
import type { ContentState } from "@/domain/authoring";
import { contentUseCases, signedInActor } from "@/presentation/composition";
import type { ContentProgressState } from "./content-progress-state";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";

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
 *
 * --- 身元の取り方について ---
 * `currentActor()` ではなく `signedInActor()` を使う。前者は身元を
 * 確かめられないとき**見本の身元へ落ちる**ので、ログインしていない人の操作が
 * ユースケースまで届く。届いた先の砦は**役の一覧**で、あれは人が編集する表である。
 *
 * 段階は戻せるので「取り返しがつく」側だが、承認まで進むと
 * **配信の予約が通るようになる**。配信は取り返しがつかない。
 * ここは取り返しがつかない扉の 1 つ手前の踏み台である（`ah-dao`）。
 */
export async function advanceContentStateAction(
  _prev: ContentProgressState,
  formData: FormData,
): Promise<ContentProgressState> {
  const actor = await signedInActor();
  if (actor === null) {
    // **`formData` を読む前に断る。** 読んでから断ると、断り文が
    // 「理由を書いてください」に化けて、押した人は理由を書いて何度も試す。
    return { status: "failed", message: notSignedInText("記事の段階を進めること") };
  }

  const variantId = String(formData.get("variantId") ?? "");
  const from = String(formData.get("from") ?? "") as ContentState;
  const to = String(formData.get("to") ?? "") as ContentState;
  /*
   * 取り下げの理由。**空欄の判定はここでしない。**
   * 空のまま送ってユースケースに断らせる（承認の欄と同じ形）。
   * 画面側でも断ると、REST や AI から呼んだときの文面と食い違う。
   */
  const reason = String(formData.get("reason") ?? "");

  const result = await (await contentUseCases()).advanceState.execute(actor, {
    variantId,
    from,
    to,
    reason,
  });

  if (!result.ok) {
    return {
      status: "failed",
      // 次にすることが書いてあるならそちらを出す。原因だけ出しても直せない。
      message: refusalText(result.error),
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
 *
 * **人にしかできない**操作なので、その人が誰かを確かめられないなら通せない。
 * `currentActor()` は身元を確かめられないとき見本の身元へ落ちるため、
 * `signedInActor()` を使う。承認が通ると配信の予約が通るようになり、
 * 配信は取り返しがつかない（`ah-dao`）。
 */
export async function approveContentAction(
  _prev: ContentProgressState,
  formData: FormData,
): Promise<ContentProgressState> {
  const actor = await signedInActor();
  if (actor === null) {
    // **`formData` を読む前に断る。** 読んでから断ると、断り文が
    // 「承認の理由を書いてください」に化けて、押した人は理由を書いて何度も試す。
    return { status: "failed", message: notSignedInText("記事の承認") };
  }

  const variantId = String(formData.get("variantId") ?? "");
  // 空欄の判定はここでしない。空のまま送ってユースケースに断らせる。
  // 画面側でも断ると、REST や AI から呼んだときの文面と食い違う。
  const reason = String(formData.get("reason") ?? "");

  const result = await (await contentUseCases()).approve.execute(actor, {
    variantId,
    reason,
  });

  if (!result.ok) {
    return {
      status: "failed",
      message: refusalText(result.error),
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
