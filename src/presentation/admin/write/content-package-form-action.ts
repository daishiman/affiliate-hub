"use server";

import { revalidatePath } from "next/cache";
import type { ContentAngle, FunnelStage } from "@/domain/authoring";
import type { PolicyDomainScope } from "@/domain/compliance";
import { contentPackageUseCases, signedInActor } from "@/presentation/composition";
import type { ContentPackageFormState } from "./content-package-form-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

/**
 * 企画を 1 つ立てる操作。
 *
 * 画面用の別ルートを作らず、REST・WebMCP・MCP と同じ `save_content_package` の
 * ユースケースを呼ぶ。読者像が 0 件・切り口が 0 件・分野が未選択のときに断るのは
 * すべて domain 側（`createContentPackage`）。画面へ写すと写した側だけが古くなる。
 *
 * `currentActor()` ではなく `signedInActor()` を使う理由は
 * `persona-form-action.ts` と同じで、前者は身元を確かめられないとき
 * **見本の身元へ落ちる**。落ちた身元で企画が立てられると、
 * 誰が決めた方針なのか分からない記事がその企画から量産される。
 */
export async function createContentPackageAction(
  _prev: ContentPackageFormState,
  formData: FormData,
): Promise<ContentPackageFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("企画の登録");

  const result = await (await contentPackageUseCases()).savePackage.execute(actor, {
    brandId: String(formData.get("brandId") ?? ""),
    primarySubjectId: String(formData.get("primarySubjectId") ?? ""),
    domainScope: String(formData.get("domainScope") ?? "") as PolicyDomainScope,
    authorPersonaId: String(formData.get("authorPersonaId") ?? ""),
    // 複数選べる欄は `getAll`。`get` だと最初の 1 件しか届かず、
    // 3 人選んだのに 1 人だけ保存される——という気づけない欠け方をする。
    audiencePersonaIds: formData.getAll("audiencePersonaIds").map(String),
    objective: String(formData.get("objective") ?? ""),
    funnelStage: String(formData.get("funnelStage") ?? "") as FunnelStage,
    contentAngles: formData.getAll("contentAngles").map(String) as ContentAngle[],
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/content/packages");
  // 記事を作る画面の企画の選択肢もここで増える。作った直後に
  // 記事を作りに行って「さっき立てた企画が無い」となるのを防ぐ。
  revalidatePath("/admin/content/new");

  return {
    status: "done",
    message: `「${result.value.objective}」を企画として登録しました。`,
    packageListPath: "/admin/content/packages",
  };
}
