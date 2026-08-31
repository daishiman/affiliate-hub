"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  contentEditingUseCases,
  platformUseCases,
  signedInActor,
} from "@/presentation/composition";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";

/**
 * 選んだブログの数だけ記事の枠を作る操作 (A5)。
 *
 * 繰り返し方も既定の決め方もここには無い。あるのは
 * 「送られてきた形をユースケースの入力へ直すこと」だけである。
 * 判断を持ち込むと、同じ判断が道具の側にもう 1 つ生まれる。
 *
 * 結果は場所（URL）で返す。この画面のフォームは `useActionState` を
 * 使っていない（押す物が 1 つで、押した後は別の画面へ移るため）。
 * 状態を持たない代わりに、成功も失敗も**戻った先の画面が読み取れる形**で渡す。
 */
export async function createConceptDraftsAction(formData: FormData): Promise<void> {
  const actor = await signedInActor();
  if (actor === null) {
    redirect(`/admin/content/matrix?failed=${encodeURIComponent(notSignedInText("記事の作成"))}`);
  }

  const packageId = String(formData.get("contentPackageId") ?? "");

  /*
   * ブログの名前は、送られてきた id から引き直す。
   *
   * **画面から名前を受け取らない。** 受け取ると、押した人の手元で
   * 名前を書き換えた記録が残せてしまう。id は設計図と突き合わせられるが、
   * 名前は突き合わせる先が無い。
   */
  const sites = await (await platformUseCases()).listSites.execute(actor, {});
  if (!sites.ok) {
    redirect(`/admin/content/matrix?failed=${encodeURIComponent(refusalText(sites.error))}`);
  }
  const nameBySlug = new Map(sites.value.items.map((s) => [s.slug, s.name]));

  const targets = readTargets(formData, nameBySlug);

  const result = await (await contentEditingUseCases()).createConceptDrafts.execute(actor, {
    contentPackageId: packageId,
    targets,
  });

  if (!result.ok) {
    redirect(`/admin/content/matrix?failed=${encodeURIComponent(refusalText(result.error))}`);
  }

  revalidatePath("/admin/content");
  revalidatePath("/admin/content/matrix");
  redirect(`/admin/content?created=${result.value.created.length}`);
}

/**
 * `concept[<siteId>][<axis>]` の形で届く隠し値を、ブログ 1 本ずつにまとめ直す。
 *
 * 3 軸が揃っていないブログは落とす。欠けた軸を空文字で埋めると、
 * 「誰に向けて」が空欄の書き出しが記事の枠に残る。
 */
function readTargets(
  formData: FormData,
  nameBySlug: ReadonlyMap<string, string>,
): readonly {
  readonly siteName: string;
  readonly audience: string;
  readonly searchIntent: string;
  readonly stance: string;
}[] {
  const bySite = new Map<string, Record<string, string>>();
  for (const [key, value] of formData.entries()) {
    const matched = /^concept\[([^\]]+)\]\[([^\]]+)\]$/.exec(key);
    if (matched === null) continue;
    const [, siteId, axis] = matched;
    if (siteId === undefined || axis === undefined) continue;
    const axes = bySite.get(siteId) ?? {};
    axes[axis] = String(value);
    bySite.set(siteId, axes);
  }

  const targets = [];
  for (const [siteId, axes] of bySite) {
    const audience = axes.audience ?? "";
    const searchIntent = axes.searchIntent ?? "";
    const stance = axes.stance ?? "";
    if (audience === "" || searchIntent === "" || stance === "") continue;
    targets.push({
      siteName: nameBySlug.get(siteId) ?? siteId,
      audience,
      searchIntent,
      stance,
    });
  }
  return targets;
}
