"use server";

import { revalidatePath } from "next/cache";
import { FIXED_PAGE_KINDS, FIXED_PAGE_STATUSES } from "@/domain/blogops";
import { blogOpsEntry, signedInActor } from "@/presentation/composition";
import {
  parseEnumOrFailure,
  parseIntentOrFailure,
  parsePresentTextOrFailure,
} from "./blog-action-input";
import type { BlogOpsState } from "./blog-ops-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

const PATH = "/admin/blog/pages";

/**
 * 運営が示す固定ページ（運営者情報・方針・問い合わせなど）を書く・消す。
 *
 * 消すのに理由を要るようにしてあるのは、**この 8 枚が「誰が運営しているか」を
 * 示す唯一の場所**だからである。1 枚欠けると、読者にも検索側にも
 * 「示していないブログ」に見える。
 */
export async function manageBlogPageAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("固定ページの編集");

  const entry = await blogOpsEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const kind = parseEnumOrFailure(text("kind"), FIXED_PAGE_KINDS, {
    field: "kind",
    label: "固定ページの種類",
  });
  if (!kind.ok) return kind.failure;
  const intent = parseIntentOrFailure(text("intent"), ["save", "delete", "restore"] as const);
  if (!intent.ok) return intent.failure;
  const parsedSiteSlug = parsePresentTextOrFailure(formData, {
    field: "siteSlug",
    label: "対象のブログ",
  });
  if (!parsedSiteSlug.ok || parsedSiteSlug.value === "") {
    return {
      status: "failed",
      message: parsedSiteSlug.ok
        ? "対象のブログが正しくありません。"
        : parsedSiteSlug.failure.message,
    };
  }
  const siteSlug = parsedSiteSlug.value;

  if (intent.value === "restore") {
    const pageId = parsePresentTextOrFailure(formData, {
      field: "pageId",
      label: "復元する固定ページ",
    });
    if (!pageId.ok || pageId.value === "") {
      return {
        status: "failed",
        message: pageId.ok
          ? "復元する固定ページが正しくありません。"
          : pageId.failure.message,
      };
    }
    const result = await entry.restoreFixedPage.execute(actor, {
      siteSlug,
      pageId: pageId.value,
    });
    if (!result.ok) return failureFromDomainError(result.error);
    revalidatePath(PATH);
    revalidatePath(`/s/${result.value.siteSlug}`, "layout");
    return { status: "done", message: "固定ページを元の内容で戻しました。" };
  }

  if (intent.value === "delete") {
    const result = await entry.deleteFixedPage.execute(actor, {
      siteSlug,
      kind: kind.value,
      reason: text("reason"),
    });
    if (!result.ok) {
      return failureFromDomainError(result.error);
    }
    revalidatePath(PATH);
    revalidatePath(`/s/${siteSlug}`, "layout");
    return { status: "done", message: "固定ページを消しました。不足として一覧に戻ります。" };
  }

  const status = parseEnumOrFailure(text("status"), FIXED_PAGE_STATUSES, {
    field: "status",
    label: "公開状態",
  });
  if (!status.ok) return status.failure;

  const result = await entry.saveFixedPage.execute(actor, {
    siteSlug,
    kind: kind.value,
    title: text("title"),
    body: text("body"),
    status: status.value,
  });
  if (!result.ok) {
    return failureFromDomainError(result.error);
  }
  revalidatePath(PATH);
  revalidatePath(`/s/${siteSlug}`, "layout");
  return { status: "done", message: "固定ページを保存しました。" };
}
