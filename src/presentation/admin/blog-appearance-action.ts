"use server";

import { revalidatePath } from "next/cache";
import { normalizePagePath } from "@/domain/authoring/page-path";
import { blogAppearanceEntry, signedInActor } from "@/presentation/composition";
import { parseIntentOrFailure, parsePresentTextOrFailure } from "./blog-action-input";
import type { BlogOpsState } from "./blog-ops-state";
import { failureFromDomainError, notSignedInFailure } from "./use-case-result";

/**
 * 作り直す管理画面の道。**ブログ 1 つに 1 本ある**ので、固定の文字列にできない。
 * `/admin/blog/…` のような 1 本の道にすると、隣のブログの画面まで
 * 作り直すか、自分の画面が古いまま残るかのどちらかになる。
 */
const adminPath = (siteSlug: string) =>
  `/admin/sites/${encodeURIComponent(siteSlug)}/appearance`;

/**
 * ブログの見た目（テンプレート 6 種・配色 2 層）を決める。
 *
 * --- 作業場所をフォームから受け取らない ---
 * 契約 C6。`workspaceId` は `actor` から取る。FormData から取ると、
 * 開発者道具で 1 文字書き換えるだけで他人のブログの配色を変えられる。
 * この画面は入力欄が少なく、`siteSlug` だけが外から来る値なので、
 * 「所有しているか」の判定は保管庫（`ownsSite`）が必ず通す。
 *
 * --- 変更のたびに公開面も作り直す ---
 * 配色は読者に出るページの見た目そのものなので、`/s/<slug>` の
 * layout ごと作り直す。管理画面だけ新しくすると、
 * 「保存したのに反映されない」に見える（実際には出す側の古い写しが出ている）。
 */
export async function manageBlogAppearanceAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("ブログの見た目の設定");

  const entry = await blogAppearanceEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const intent = parseIntentOrFailure(text("intent"), [
    "select_template",
    "save_theme",
    "save_override",
    "clear_override",
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

  /** 保存したあとは、管理画面と公開面の両方を作り直す。 */
  const refresh = () => {
    revalidatePath(adminPath(siteSlug));
    revalidatePath(`/s/${siteSlug}`, "layout");
  };

  if (intent.value === "select_template") {
    const result = await entry.manage.execute(actor, {
      action: "select_template",
      siteSlug,
      templateId: text("templateId"),
    });
    if (!result.ok) return failureFromDomainError(result.error);
    refresh();
    return { status: "done", message: "ブログの見せ方を切り替えました。" };
  }

  if (intent.value === "save_theme") {
    const result = await entry.manage.execute(actor, {
      action: "save_theme",
      siteSlug,
      brandTheme: text("brandTheme"),
      colorMode: text("colorMode"),
    });
    if (!result.ok) return failureFromDomainError(result.error);
    refresh();
    return { status: "done", message: "ブログ全体の配色を保存しました。" };
  }

  const parsedPagePath = parsePresentTextOrFailure(formData, {
    field: "pagePath",
    label: "対象のページ",
  });
  if (!parsedPagePath.ok || parsedPagePath.value === "") {
    return {
      status: "failed",
      message: parsedPagePath.ok
        ? "対象のページが正しくありません。"
        : parsedPagePath.failure.message,
    };
  }

  if (intent.value === "clear_override") {
    const result = await entry.manage.execute(actor, {
      action: "clear_override",
      siteSlug,
      pagePath: parsedPagePath.value,
    });
    if (!result.ok) return failureFromDomainError(result.error);
    refresh();
    return { status: "done", message: "このページの上書きを解除し、全体の配色に戻しました。" };
  }

  /*
    空欄は「その軸は上書きしない」。ここで欠測を検査しない。
    <select> の「既定のまま」は空の option で表すのが自然で、
    そこを不備にすると既定へ戻す操作ができなくなる。
    両軸とも空なら、下層が行を消す（不変条件 I2）。
  */
  const result = await entry.manage.execute(actor, {
    action: "save_override",
    siteSlug,
    pagePath: parsedPagePath.value,
    brandTheme: text("brandTheme"),
    colorMode: text("colorMode"),
  });
  if (!result.ok) return failureFromDomainError(result.error);
  refresh();
  /*
    両軸とも空だと下層が行を消す。「保存しました」とだけ返すと、
    上書きが消えたことに気づかないまま元に戻ったと思う人が出る。
    返ってきた一覧に自分のページが居るかで、起きたことを言い分ける。
  */
  // 保存先は正規化した道で持つ。生の入力と比べると `/about/` で必ず外れる。
  const kept = result.value.overrides.some(
    (o) => o.pagePath === normalizePagePath(parsedPagePath.value),
  );
  return {
    status: "done",
    message: kept
      ? "このページだけの配色を保存しました。"
      : "上書きが空だったので、このページは全体の配色に戻りました。",
  };
}
