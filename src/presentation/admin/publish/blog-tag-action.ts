"use server";

import { BLOG_TAG_KINDS } from "@/domain/blogops";
import { blogOpsEntry, signedInActor } from "@/presentation/composition";
import { revalidatePath } from "next/cache";
import { parseEnumOrFailure, parseIntentOrFailure } from "./blog-action-input";
import type { BlogOpsState } from "./blog-ops-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

const PATH = "/admin/blog/tags";

/**
 * タグを足す・直す・消す。
 *
 * `tagId` が空なら新しく作り、入っていれば直す。1 つの口にしているのは、
 * 画面が同じ 1 つの欄の並びを両方に使うためである。
 */
export async function manageBlogTagAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("タグの編集");

  const entry = await blogOpsEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const siteSlug = text("siteSlug");
  const intent = parseIntentOrFailure(text("intent"), ["save", "delete"] as const);
  if (!intent.ok) return intent.failure;

  if (intent.value === "delete") {
    const result = await entry.deleteTag.execute(actor, {
      siteSlug,
      tagId: text("tagId"),
      reason: text("reason"),
    });
    if (!result.ok) {
      return failureFromDomainError(result.error);
    }
    revalidatePath(PATH);
    return {
      status: "done",
      message: `「${result.value.name}」を消しました。付いていた記事はタグ無しになります。`,
    };
  }

  const tagId = text("tagId");
  const kind = parseEnumOrFailure(text("kind"), BLOG_TAG_KINDS, {
    field: "kind",
    label: "タグの種類",
  });
  if (!kind.ok) return kind.failure;
  const result = await entry.saveTag.execute(actor, {
    ...(tagId === "" ? {} : { tagId }),
    siteSlug,
    slug: text("slug"),
    name: text("name"),
    description: text("description"),
    kind: kind.value,
  });
  if (!result.ok) {
    return failureFromDomainError(result.error);
  }
  revalidatePath(PATH);
  return { status: "done", message: tagId === "" ? "タグを足しました。" : "タグを直しました。" };
}
