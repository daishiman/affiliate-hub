"use server";

import { revalidatePath } from "next/cache";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import { signedInActor, siteDocumentUseCases } from "@/presentation/composition";
import type { SiteDocumentState } from "./site-document-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

/**
 * ブログの固定文書を 1 枚保存する。
 *
 * 本文は 1 つの欄に書いてもらい、**空行で段落に割る**。
 * 段落ごとに入力欄を並べると、3 段落を書くのに欄を 3 回足す操作が要る。
 * 割り方をここに置いているのは、画面の都合（1 欄）を保存の形（配列）へ
 * 直す仕事だからで、ユースケース側は最初から段落の配列を受け取る。
 */
export async function saveSiteDocumentAction(
  _prev: SiteDocumentState,
  formData: FormData,
): Promise<SiteDocumentState> {
  const actor = await signedInActor();
  if (actor === null) {
    return notSignedInFailure("固定ページの保存");
  }

  const siteSlug = String(formData.get("siteSlug") ?? "");
  const key = String(formData.get("key") ?? "");
  const body = String(formData.get("body") ?? "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");

  const result = await (await siteDocumentUseCases()).save.execute(actor, {
    siteSlug,
    key,
    title: String(formData.get("title") ?? ""),
    body,
  });

  if (!result.ok) {
    return failureFromDomainError(result.error);
  }

  // 管理画面と読者の画面の両方を作り直す。管理画面だけだと、
  // 直した本人には新しい文が見え、読者には古い文が出たままになる。
  revalidatePath(`/admin/sites/${encodeURIComponent(siteSlug)}/documents`);
  revalidatePath(siteBasePathBySlug(siteSlug), "layout");

  return { status: "done", message: "保存しました。読者の画面にも出ています。" };
}
