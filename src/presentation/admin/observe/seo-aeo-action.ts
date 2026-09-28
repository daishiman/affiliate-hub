"use server";

import { revalidatePath } from "next/cache";
import { MAX_CITATION_MONTHLY_SEARCH_LIMIT } from "@/application/ports/seo-measurement";
import type { DomainError } from "@/domain/shared";
import { seoMeasurementUseCases, signedInActor } from "@/presentation/composition";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";
import type { SeoAeoFormState } from "./seo-aeo-state";

/**
 * 検索と AI からの見え方を動かす操作。
 *
 * ==========================================================================
 * ここに判断を書かない
 * ==========================================================================
 *
 * 反映してよいかを決めるのは `decideAutoApply`（ドメイン）で、
 * 確認した差分と対象記事の一致を確かめるのは `manage-seo-auto-apply`（ユースケース）である。
 * 画面から呼ぶのはここだけだが、**中身は REST / WebMCP と同じ口**を呼ぶ。
 *
 * ==========================================================================
 * 身元は `signedInActor()` で取る
 * ==========================================================================
 *
 * `currentActor()` はログインできていないとき見本の身元へ落ちる。
 * ここは画面を組み立てる場所ではなく**記事を書き換える場所**なので、
 * 確かめられないときは渡さない側に倒す。
 */

const SEO_PATH = "/admin/seo";

/** 反映・取消で変わる公開内容と編集画面を、次の表示へ揃える。 */
function revalidateArticleViews(): void {
  revalidatePath(SEO_PATH);
  revalidatePath("/s/[site]", "layout");
  revalidatePath("/admin/content/published");
  revalidatePath("/admin/content/published/[site]/[slug]/edit", "page");
  revalidatePath("/admin/blog/articles");
  revalidatePath("/admin/blog/articles/[article]", "page");
}

/** ログインできていないときの断り。文言は管理画面で 1 つに揃える。 */
const NOT_SIGNED_IN: SeoAeoFormState = notSignedInFailure("検索と AI からの見え方の操作");

/**
 * 保存先がつながっていないときの断り。
 *
 * 見本へ倒さない。**計測は「何が起きているか」を見せる画面**なので、
 * 見本の数字が出ると、運営者はそれを自分のブログの状態として読む。
 */
const NO_STORAGE: SeoAeoFormState = {
  status: "failed",
  message: "保存先につながっていないため、この操作はできません。",
};

/** 画面で確認した記事と差分だけを反映する。全体実行の入力は受け取らない。 */
export async function applySeoRevisionAction(
  _prev: SeoAeoFormState,
  formData: FormData,
): Promise<SeoAeoFormState> {
  const siteSlug = String(formData.get("siteSlug") ?? "");
  const articleSlug = String(formData.get("articleSlug") ?? "");
  const approvalToken = String(formData.get("approvalToken") ?? "");
  if (siteSlug === "" || articleSlug === "" || approvalToken === "") {
    return { status: "failed", message: "対象の記事と差分を確認してから、反映してください。" };
  }
  const actor = await signedInActor();
  if (actor === null) return NOT_SIGNED_IN;
  const uc = await seoMeasurementUseCases(actor.workspaceId);
  if (uc === null) return NO_STORAGE;
  const result = await uc.manage.execute(actor, { action: "apply", siteSlug, articleSlug, approvalToken });
  if (!result.ok) return failed(result.error);
  if (result.value.action !== "apply") return failed(unexpected());
  revalidateArticleViews();
  return { status: "done", message: "確認した差分をこの記事に反映しました。反映の記録から取り消せます。" };
}

/**
 * 反映を 1 つ取り消す。
 *
 * **1 操作で戻せることが要件**（NFR5）である。確認の画面を挟まないのは、
 * 取り消しそのものが「間違えたときの戻り道」だからで、
 * 戻り道に段を足すと、慌てている人ほど戻れなくなる。
 */
export async function revertSeoAutoApplyAction(
  _prev: SeoAeoFormState,
  formData: FormData,
): Promise<SeoAeoFormState> {
  const logId = String(formData.get("logId") ?? "");
  if (logId === "") {
    return { status: "failed", message: "どの反映を取り消すかが分かりません。", field: "logId" };
  }

  const actor = await signedInActor();
  if (actor === null) return NOT_SIGNED_IN;
  const uc = await seoMeasurementUseCases(actor.workspaceId);
  if (uc === null) return NO_STORAGE;

  const result = await uc.manage.execute(actor, { action: "revert", logId });
  if (!result.ok) return failed(result.error);
  if (result.value.action !== "revert") return failed(unexpected());

  revalidateArticleViews();
  return { status: "done", message: "この反映を取り消し、変更前の内容へ戻しました。" };
}

/**
 * 自動反映を止める・再開する。
 *
 * **止めても収集は止まらない**（NFR4）。止まるのは書き換えだけで、
 * 何が起きているかを見せるのは止めない。止めた瞬間に画面が古い数字で
 * 固まると、運営者は再開してよいかを判断できなくなる。
 */
export async function setSeoAutoApplyPausedAction(
  _prev: SeoAeoFormState,
  formData: FormData,
): Promise<SeoAeoFormState> {
  const paused = String(formData.get("paused") ?? "") === "true";

  const actor = await signedInActor();
  if (actor === null) return NOT_SIGNED_IN;
  const uc = await seoMeasurementUseCases(actor.workspaceId);
  if (uc === null) return NO_STORAGE;

  const result = await uc.manage.execute(actor, { action: paused ? "pause" : "resume" });
  if (!result.ok) return failed(result.error);

  revalidatePath(SEO_PATH);
  return {
    status: "done",
    message: paused
      ? "記事の差分反映を止めました。観測は続きます。"
      : "記事の差分反映を再開しました。確認した差分を反映できます。",
  };
}

/** 作業場所の全ブログで共有する、月あたりのAI検索回数を変更する。 */
export async function setSeoCitationMonthlyLimitAction(
  _prev: SeoAeoFormState,
  formData: FormData,
): Promise<SeoAeoFormState> {
  const raw = String(formData.get("limit") ?? "").trim();
  if (!/^(0|[1-9]\d*)$/.test(raw)) {
    return { status: "failed", message: "月次上限は0以上の整数で入力してください。", field: "limit" };
  }
  const limit = Number(raw);
  if (!Number.isSafeInteger(limit) || limit > MAX_CITATION_MONTHLY_SEARCH_LIMIT) {
    return { status: "failed", message: `月次上限は0〜${MAX_CITATION_MONTHLY_SEARCH_LIMIT}回で入力してください。`, field: "limit" };
  }
  const actor = await signedInActor();
  if (actor === null) return NOT_SIGNED_IN;
  const uc = await seoMeasurementUseCases(actor.workspaceId);
  if (uc === null) return NO_STORAGE;
  const result = await uc.manage.execute(actor, { action: "set_citation_monthly_limit", limit });
  if (!result.ok) return failed(result.error);
  if (result.value.action !== "set_citation_monthly_limit") return failed(unexpected());
  revalidatePath(SEO_PATH);
  return { status: "done", message: "月次上限を保存しました。今月の使用済み・未確認の回数は戻りません。" };
}

function failed(error: DomainError): SeoAeoFormState {
  return failureFromDomainError(error);
}

/**
 * 起きないはずの取り合わせ。
 *
 * ユースケースは要求した action と同じ action を返す約束になっている。
 * それでも分岐を書くのは、約束が破れたときに**黙って成功と表示する**のを
 * 避けるためである。
 */
function unexpected(): DomainError {
  return {
    code: "VALIDATION_FAILED",
    message: "予期しない応答でした。もう一度お試しください。",
    retryable: true,
  };
}
