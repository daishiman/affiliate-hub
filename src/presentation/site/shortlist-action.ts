"use server";

import { revalidatePath } from "next/cache";
import { readerActor, readerUseCases } from "@/presentation/composition";
import { refusalText } from "@/presentation/refusal-text";
import { ensureReaderIdentity } from "./reader-identity";
import type { ShortlistFormState } from "./shortlist-form-state";

/**
 * 「気になる商品」の保存と取り外し。
 *
 * 画面から呼ぶのはこの 2 つだけで、中身は
 * **REST / WebMCP / バックエンド MCP と同じユースケース**を呼ぶ。
 * 画面用にもう 1 つ実装を作らない（作ると片方だけ検証が甘くなる）。
 *
 * --- 合言葉はここで発行する ---
 * 読者を分ける合言葉は、押した瞬間に初めて配る。読むだけの画面では配らない。
 * 記事を 1 枚見ただけの人に印を付けないため（`reader-identity.ts`）。
 */

function read(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function saveToShortlistAction(
  _prev: ShortlistFormState,
  formData: FormData,
): Promise<ShortlistFormState> {
  const siteSlug = read(formData, "siteSlug");
  const productId = read(formData, "productId");
  const productName = read(formData, "productName");
  const fromArticleHref = read(formData, "fromArticleHref");
  const oneLine = read(formData, "oneLine");

  const readerKey = await ensureReaderIdentity();

  const result = await (await readerUseCases()).saveToShortlist.execute(readerActor(), {
    siteSlug,
    readerKey,
    item: {
      productId,
      productName,
      // 押した時刻はサーバで決める。ブラウザの時計を信じると、
      // 時計のずれた端末で保存したものだけが一覧の先頭に居座る。
      shortlistedAt: new Date().toISOString(),
      ...(fromArticleHref === "" ? {} : { fromArticleHref }),
      ...(oneLine === "" ? {} : { oneLine }),
    },
  });

  if (!result.ok) {
    return { status: "failed", message: refusalText(result.error), field: result.error.field };
  }

  revalidatePath(`/s/${siteSlug}/shortlist`);
  return { status: "done", message: "「気になる」に保存しました。" };
}

export async function removeFromShortlistAction(
  _prev: ShortlistFormState,
  formData: FormData,
): Promise<ShortlistFormState> {
  const siteSlug = read(formData, "siteSlug");
  const productId = read(formData, "productId");

  const readerKey = await ensureReaderIdentity();

  const result = await (await readerUseCases()).removeFromShortlist.execute(readerActor(), {
    siteSlug,
    readerKey,
    productId,
  });

  if (!result.ok) {
    return { status: "failed", message: refusalText(result.error), field: result.error.field };
  }

  revalidatePath(`/s/${siteSlug}/shortlist`);
  return { status: "done", message: "「気になる」から外しました。" };
}
