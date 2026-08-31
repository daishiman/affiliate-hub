"use server";

import { revalidatePath } from "next/cache";
import { blogPlacementEntry, signedInActor } from "@/presentation/composition";
import { parseIntentOrFailure, parsePresentTextOrFailure } from "./blog-action-input";
import type { BlogOpsState } from "./blog-ops-state";
import { failureFromDomainError, notSignedInFailure } from "./use-case-result";

/** 作り直す管理画面の道。ブログ 1 つに 1 本あるので、固定の文字列にできない。 */
const adminPath = (siteSlug: string) =>
  `/admin/sites/${encodeURIComponent(siteSlug)}/placements`;

/**
 * 記事のどこに成果リンクを出しているかの台帳を書く（受入 A6・A7）。
 *
 * 読者が見るリンクの正本は記事の `cta` ブロックで、台帳は逆引き index。
 * D1 adapter が両方を同じ batch で変えるので、成功時は公開経路も再検証する。
 *
 * --- 位置は数値をそのまま受ける ---
 * 並びの重複を許す設計なので、欠測も不正も 0 に倒す。
 * ここを不備にすると、位置を気にしていない人が保存できなくなる。
 */
export async function manageBlogPlacementAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("成果リンクの掲載");

  const entry = await blogPlacementEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const intent = parseIntentOrFailure(text("intent"), ["save", "remove"] as const);
  if (!intent.ok) return intent.failure;

  for (const [field, label] of [
    ["siteSlug", "対象のブログ"],
    ["articleSlug", "対象の記事"],
  ] as const) {
    const parsed = parsePresentTextOrFailure(formData, { field, label });
    if (!parsed.ok || parsed.value === "") {
      return {
        status: "failed",
        message: parsed.ok ? `${label}が正しくありません。` : parsed.failure.message,
      };
    }
  }
  const siteSlug = text("siteSlug");
  const articleSlug = text("articleSlug");
  const trackingCode = text("trackingCode");

  /*
    位置は「並びの目安」であって鍵ではない。数として読めなければ 0。
    ここを不備として突き返すと、位置を気にしていない人の保存が止まる。
  */
  const parsedPosition = Number.parseInt(text("position"), 10);
  const position = Number.isFinite(parsedPosition) && parsedPosition >= 0 ? parsedPosition : 0;

  const common = {
    siteSlug,
    articleSlug,
    placement: text("placement"),
    ...(trackingCode === "" ? {} : { trackingCode }),
  } as const;

  const result =
    intent.value === "save"
      ? await entry.review.execute(actor, { action: "save", ...common, position })
      : await entry.review.execute(actor, { action: "remove", ...common });
  if (!result.ok) return failureFromDomainError(result.error);
  revalidatePath(adminPath(siteSlug));
  revalidatePath(`/s/${siteSlug}/blog/${articleSlug}`);

  /*
    掲載漏れの数を答えに載せる。保存した 1 件の成否だけを返すと、
    「1 件足したのに、まだ 5 本が空のまま」が画面を読み直すまで分からない。
  */
  const missing = result.value.kind === "by_site" ? result.value.missingCount : 0;
  const tail = missing === 0 ? "掲載漏れはありません。" : `掲載のない記事があと ${missing} 本あります。`;
  return {
    status: "done",
    message: intent.value === "save"
      ? `掲載を記録し、読者の記事へ反映しました。${tail}`
      : `掲載を外し、読者の記事へ反映しました。${tail}`,
  };
}
