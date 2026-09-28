"use server";

import { revalidatePath } from "next/cache";
import { articleHref } from "@/application/read-models/published-article";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import { publishedArticleAdminUseCases, signedInActor } from "@/presentation/composition";
import { parseNonEmptyLines } from "../non-empty-lines";
import type { PublishedArticleFormState } from "./published-article-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

function sections(formData: FormData) {
  const ids = formData.getAll("sectionId").map(String);
  const headings = formData.getAll("sectionHeading").map(String);
  const bodies = formData.getAll("sectionBody").map(String);
  return ids.map((id, index) => ({
    id,
    heading: headings[index] ?? "",
    body: bodies[index] ?? "",
  }));
}

export async function updatePublishedArticleAction(
  previous: PublishedArticleFormState,
  formData: FormData,
): Promise<PublishedArticleFormState> {
  const savedRevision = previous.revision === undefined ? {} : { revision: previous.revision };
  const actor = await signedInActor();
  if (actor === null) return { ...notSignedInFailure("公開済み記事の訂正"), ...savedRevision };
  const siteSlug = String(formData.get("siteSlug") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const rawRevision = String(formData.get("expectedRevision") ?? "");
  const expectedRevision = /^[1-9]\d*$/.test(rawRevision) ? Number(rawRevision) : NaN;
  if (!Number.isSafeInteger(expectedRevision)) {
    return { status: "failed", message: "記事を開き直してから訂正してください。", ...savedRevision };
  }
  const result = await (await publishedArticleAdminUseCases()).update.execute(actor, {
    siteSlug,
    slug,
    expectedRevision,
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    authorName: String(formData.get("authorName") ?? ""),
    authorBio: String(formData.get("authorBio") ?? ""),
    authorCredentials: parseNonEmptyLines(String(formData.get("authorCredentials") ?? "")),
    sections: sections(formData),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!result.ok) return {
    ...failureFromDomainError(result.error),
    ...savedRevision,
    ...(result.error.code === "CONFLICT" ? { errorCode: "CONFLICT" as const } : {}),
  };
  revalidatePath("/admin/content/published");
  revalidatePath(`/admin/content/published/${encodeURIComponent(siteSlug)}/${encodeURIComponent(slug)}/edit`);
  revalidatePath(`${siteBasePathBySlug(siteSlug)}${articleHref(result.value)}`);
  return { status: "done", message: "訂正を保存しました。公開画面の更新日にも反映されます。", revision: expectedRevision + 1 };
}

export async function archivePublishedArticleAction(
  _previous: PublishedArticleFormState,
  formData: FormData,
): Promise<PublishedArticleFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("公開済み記事の非表示化");
  const siteSlug = String(formData.get("siteSlug") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const result = await (await publishedArticleAdminUseCases()).archive.execute(actor, {
    siteSlug,
    slug,
    reason: String(formData.get("archiveReason") ?? ""),
  });
  if (!result.ok) return failureFromDomainError(result.error);
  revalidatePath("/admin/content/published");
  revalidatePath(`/admin/content/published/${encodeURIComponent(siteSlug)}/${encodeURIComponent(slug)}/edit`);
  revalidatePath(siteBasePathBySlug(siteSlug));
  return {
    status: "done",
    message: "記事を非表示にしました。データは削除せず、管理一覧に残っています。",
  };
}
