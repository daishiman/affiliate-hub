"use server";

import { revalidatePath } from "next/cache";
import { THUMBNAIL_WIDTHS } from "@/domain/blogops";
import { blogOpsEntry, signedInActor } from "@/presentation/composition";
import { parseIntentOrFailure } from "./blog-action-input";
import type { BlogOpsState } from "./blog-ops-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

const LIST_PATH = "/admin/blog/articles";

/**
 * 記事の表紙（サムネイル）を登録する・外す。
 *
 * --- 縮小した絵はここでは作らない ---
 *
 * 320/640/1280 の絵は**送る側のブラウザが Canvas で作って**この入口へ渡す。
 * workerd に画像のデコーダは無く、`wrangler.jsonc` に Images のバインディングも
 * 置いていないので、ここで原本 1 枚から派生を作ることはできない。
 * だから受け取る形そのものが「原本 1 枚＋縮小 n 枚」になっている。
 *
 * **送られてきた幅が本当にその幅かは、ここでは確かめない。**画素を見るには
 * デコーダが要るからで、これは既知の穴である。嘘の幅を入れられても
 * 1 記事の 1 世代に閉じる（鍵が中身の指紋を含み、置いたら書き換えないため）。
 *
 * --- 幅ごとに別の名前で受け取る理由 ---
 *
 * `getAll("derived")` の並び順に頼ると、送る側が 1 枚落とした日に
 * 「640 の絵が 320 として配られる」が起きる。名前に幅を書いておけば、
 * 落ちた幅は**単に来ない**だけで、残りの対応がずれない。
 */
export async function manageArticleThumbnailAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("記事サムネイルの登録");

  const entry = await blogOpsEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const articleId = text("articleId");
  const intent = parseIntentOrFailure(text("intent"), ["set", "remove"] as const);
  if (!intent.ok) return intent.failure;

  if (intent.value === "remove") {
    const removed = await entry.removeThumbnail.execute(actor, { articleId });
    if (!removed.ok) return failureFromDomainError(removed.error);
    revalidatePath(`${LIST_PATH}/${articleId}`);
    return {
      status: "done",
      message: removed.value.removed
        ? "表紙を外しました。記事の一覧と記事の先頭から絵が消えます。"
        : "この記事にはもともと表紙がありません。",
    };
  }

  const original = formData.get("original");
  if (!(original instanceof File) || original.size === 0) {
    // ここだけは業務側まで行かずに断る。ファイルが無いと `mimeType` も
    // `original` も名乗れず、下の層が「形式が違う」と読み違えるため。
    return {
      status: "failed",
      message: "画像を選んでください。",
      field: "original",
    };
  }

  const derived: { readonly width: number; readonly bytes: ArrayBuffer }[] = [];
  for (const width of THUMBNAIL_WIDTHS) {
    const part = formData.get(`derived-${String(width)}`);
    if (!(part instanceof File) || part.size === 0) continue;
    derived.push({ width, bytes: await part.arrayBuffer() });
  }

  const stored = await entry.setThumbnail.execute(actor, {
    articleId,
    mimeType: original.type,
    original: await original.arrayBuffer(),
    derived,
    altText: text("altText"),
  });
  if (!stored.ok) return failureFromDomainError(stored.error);

  revalidatePath(`${LIST_PATH}/${articleId}`);
  return {
    status: "done",
    message:
      stored.value.derivedWidths.length === 0
        ? "表紙を登録しました。縮小版は作られていないため、原本 1 枚をそのまま配ります。"
        : `表紙を登録しました。${stored.value.derivedWidths.join(" / ")} の幅で配ります。`,
  };
}
