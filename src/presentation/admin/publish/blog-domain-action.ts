"use server";

import { revalidatePath } from "next/cache";
import { blogDomainsEntry, signedInActor } from "@/presentation/composition";
import { parseIntentOrFailure, parsePresentTextOrFailure } from "./blog-action-input";
import type { BlogOpsState } from "./blog-ops-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

/**
 * ブログの住所（独自ドメイン）を登録・確認・切り替え・取り下げする。
 *
 * --- なぜ公開面まで作り直すか ---
 * 正規の住所を切り替えると、読者向けページが名乗る住所（正規 URL）が変わる。
 * 管理画面だけ作り直すと、切り替えたつもりの住所が古い写しのまま出続け、
 * 検索側には 2 つの住所が同じ内容で見える。
 *
 * --- 取り下げに理由を要る形にしてある ---
 * 住所を取り下げると、その住所を踏んだ読者はどこにも着かない。
 * 「なぜ止めたか」が行に残っていないと、あとで同じ住所を登録し直してよいのか、
 * 二度と使ってはいけないのかを、誰も判断できなくなる。
 */
const adminPath = (siteSlug: string) =>
  `/admin/sites/${encodeURIComponent(siteSlug)}/domains`;

export async function manageBlogDomainAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("ブログの住所の管理");

  const entry = await blogDomainsEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const intent = parseIntentOrFailure(text("intent"), [
    "register",
    "sync",
    "set_canonical",
    "revoke",
  ] as const);
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

  const refresh = () => {
    revalidatePath(adminPath(siteSlug));
    revalidatePath(`/s/${siteSlug}`, "layout");
  };

  if (intent.value === "register") {
    const result = await entry.manage.execute(actor, {
      action: "register",
      siteSlug,
      hostname: text("hostname"),
    });
    if (!result.ok) return failureFromDomainError(result.error);
    refresh();
    /*
      「登録しました」で終えない。この時点ではまだ読者は開けない。
      DNS に何を置くかを画面が出しているので、そこへ目を向けさせる。
    */
    return {
      status: "done",
      message:
        result.value.notice ??
        "住所を登録しました。下の DNS 設定を置くと、所有権の確認が始まります。",
    };
  }

  const parsedDomainId = parsePresentTextOrFailure(formData, {
    field: "domainId",
    label: "対象の住所",
  });
  if (!parsedDomainId.ok || parsedDomainId.value === "") {
    return {
      status: "failed",
      message: parsedDomainId.ok
        ? "対象の住所が正しくありません。"
        : parsedDomainId.failure.message,
    };
  }
  const domainId = parsedDomainId.value;

  if (intent.value === "sync") {
    const result = await entry.manage.execute(actor, { action: "sync", siteSlug, domainId });
    if (!result.ok) return failureFromDomainError(result.error);
    refresh();
    return {
      status: "done",
      message: result.value.notice ?? "外部の状態を取り直しました。",
    };
  }

  if (intent.value === "set_canonical") {
    const result = await entry.manage.execute(actor, {
      action: "set_canonical",
      siteSlug,
      domainId,
    });
    if (!result.ok) return failureFromDomainError(result.error);
    refresh();
    return { status: "done", message: "読者へ見せる住所を切り替えました。" };
  }

  const result = await entry.manage.execute(actor, {
    action: "revoke",
    siteSlug,
    domainId,
    reason: text("reason"),
  });
  if (!result.ok) return failureFromDomainError(result.error);
  refresh();
  return {
    status: "done",
    message: "住所を取り下げました。既定の住所（/s/…）では今までどおり読めます。",
  };
}
