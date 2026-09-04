"use server";

import { cookies } from "next/headers";
import { publicBlogEntry, readerActor } from "@/presentation/composition";
import { refusalText } from "@/presentation/refusal-text";
import { READER_KEY_COOKIE, READER_KEY_MAX_AGE } from "@/presentation/site/reader-rating-state";

/**
 * 読者の評価を受け取る。
 *
 * **読者に会社（作業場所）は無い。** 管理側の口（`blogOpsEntry`）を使い回すと、
 * 絞り忘れ 1 か所で下書きが読者に出る。ここは公開済みしか返さない口
 * (`publicBlogEntry`) だけを握る。
 */

export type ReaderRatingState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  readonly field?: string;
  /** 押したあとの件数と平均。まだ 1 票も無ければ `average` は null。 */
  readonly summary?: { readonly count: number; readonly average: number | null };
};

/**
 * この端末の目印を読む。無ければ作って置く。
 *
 * **名前や連絡先は一切使わない。** 使えるのは「同じ端末か」だけで足り、
 * それ以上を持つと、評価を押しただけの読者の記録が個人の記録になる。
 */
async function readerKey(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(READER_KEY_COOKIE)?.value;
  if (existing !== undefined && existing !== "") return existing;

  const fresh = crypto.randomUUID();
  jar.set(READER_KEY_COOKIE, fresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: READER_KEY_MAX_AGE,
  });
  return fresh;
}

export async function submitReaderRatingAction(
  _prev: ReaderRatingState,
  formData: FormData,
): Promise<ReaderRatingState> {
  const entry = await publicBlogEntry();

  const siteSlug = String(formData.get("siteSlug") ?? "");
  const articleSlug = String(formData.get("articleSlug") ?? "");
  const raw = String(formData.get("score") ?? "");
  const comment = String(formData.get("comment") ?? "");

  /*
    数字にできない入力はここで止める。`Number("")` は 0 になるので、
    そのまま渡すと「1〜5 の外」という理由で断られ、読者には
    「選んでいない」と「0 を選んだ」の区別が付かない返事になる。
  */
  if (raw === "") {
    return { status: "failed", message: "点数を選んでください。", field: "score" };
  }

  const result = await entry.submitRating.execute(readerActor(), {
    siteSlug,
    articleSlug,
    readerKey: await readerKey(),
    score: Number(raw),
    comment: comment.trim() === "" ? null : comment,
  });

  if (!result.ok) {
    /*
     * `field` はそのまま通す。**画面に無い欄の名前をここで濾すのは間違い。**
     * 濾すと「断りが消える」症状は隠れるが、原因 (画面に無い欄名を返している) は
     * usecase 側に残り、`tests/architecture/refusal-field-wiring.test.ts` からも見えなくなる。
     * 出せない欄名を返さないのは usecase の責任なので、そちらで直す。
     */
    return { status: "failed", message: refusalText(result.error), field: result.error.field };
  }

  return {
    status: "done",
    message: "ありがとうございました。",
    summary: { count: result.value.count, average: result.value.average },
  };
}
