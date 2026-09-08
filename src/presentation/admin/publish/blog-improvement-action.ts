"use server";

import { revalidatePath } from "next/cache";
import { blogAeoEntry, blogSeoEntry, signedInActor } from "@/presentation/composition";
import { parseIntentOrFailure, parsePresentTextOrFailure } from "./blog-action-input";
import type { BlogOpsState } from "./blog-ops-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

/**
 * 改善層（SEO 診断・AEO）の入口。
 *
 * --- 公開面を作り直さない ---
 * 見た目や住所と違い、ここでの操作は読者に出ているものを 1 つも変えない
 * (AD-3)。診断は指摘を作るだけ、下書きは編集実体を指すだけである。
 * `revalidatePath("/s/…")` を書くと、「押したら読者側が変わった」と
 * 読める形になり、実際には変わらないので次の判断がずれる。
 */

const seoPath = (siteSlug: string) => `/admin/sites/${encodeURIComponent(siteSlug)}/seo`;
const aeoPath = (siteSlug: string) => `/admin/sites/${encodeURIComponent(siteSlug)}/aeo`;

function requiredText(
  formData: FormData,
  field: string,
  label: string,
): { readonly ok: true; readonly value: string } | { readonly ok: false; readonly state: BlogOpsState } {
  const parsed = parsePresentTextOrFailure(formData, { field, label });
  if (!parsed.ok) return { ok: false, state: parsed.failure };
  if (parsed.value === "") {
    return { ok: false, state: { status: "failed", message: `${label}が正しくありません。`, field } };
  }
  return { ok: true, value: parsed.value };
}

export async function manageBlogSeoAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("SEO 診断");

  const entry = await blogSeoEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const intent = parseIntentOrFailure(text("intent"), [
    "assess",
    "draft_fix",
    "dismiss",
  ] as const);
  if (!intent.ok) return intent.failure;

  const site = requiredText(formData, "siteSlug", "対象のブログ");
  if (!site.ok) return site.state;
  const siteSlug = site.value;

  if (intent.value === "assess") {
    /*
      記事名は空でよい。空ならブログ全体の診断で、記事どうしのタイトル重複
      （1 本だけ見ても分からない指摘）はこのときだけ出る。
    */
    const articleSlug = text("articleSlug");
    const result = await entry.manage.execute(actor, {
      action: "assess",
      siteSlug,
      ...(articleSlug === "" ? {} : { articleSlug }),
    });
    if (!result.ok) return failureFromDomainError(result.error);
    revalidatePath(seoPath(siteSlug));
    return {
      status: "done",
      message: `${result.value.assessedArticles ?? 0} 本を診断し、直す価値のある指摘が ${result.value.openFindings.length} 件あります。`,
    };
  }

  const finding = requiredText(formData, "findingId", "対象の指摘");
  if (!finding.ok) return finding.state;

  if (intent.value === "draft_fix") {
    const result = await entry.manage.execute(actor, {
      action: "draft_fix",
      siteSlug,
      findingId: finding.value,
    });
    if (!result.ok) return failureFromDomainError(result.error);
    revalidatePath(seoPath(siteSlug));
    /*
      **「下書きを作りました」と書かない。** 作ったのは文章ではなく、
      直す場所への道である。文章ができたと読まれると、確かめずに
      公開へ進む人が出る (src/infrastructure/improvement/seo-fix-drafter.ts)。
    */
    return {
      status: "done",
      message: "直す場所が分かりました。下の「直しに行く」から編集画面を開いてください。",
    };
  }

  const result = await entry.manage.execute(actor, {
    action: "dismiss",
    siteSlug,
    findingId: finding.value,
    reason: text("reason"),
  });
  if (!result.ok) return failureFromDomainError(result.error);
  revalidatePath(seoPath(siteSlug));
  return {
    status: "done",
    message: "この指摘は直さないと決めました。次の診断でも出てきません。",
  };
}

export async function manageBlogAeoAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("AEO の管理");

  const entry = await blogAeoEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const intent = parseIntentOrFailure(text("intent"), ["save_profile", "extract"] as const);
  if (!intent.ok) return intent.failure;

  const site = requiredText(formData, "siteSlug", "対象のブログ");
  if (!site.ok) return site.state;
  const siteSlug = site.value;

  if (intent.value === "save_profile") {
    const result = await entry.manage.execute(actor, {
      action: "save_profile",
      siteSlug,
      topicScope: text("topicScope"),
      audience: text("audience"),
      publisherName: text("publisherName"),
      /*
        印がある＝入っている、で読む。checkbox は外れているとキーごと
        来ないので、`=== "on"` で見ると「外した」と「欄が無かった」が
        同じ値に潰れる。ここは常にこの欄を出す画面なので、それでよい。
      */
      structuredDataEnabled: text("structuredDataEnabled") !== "",
    });
    if (!result.ok) return failureFromDomainError(result.error);
    revalidatePath(aeoPath(siteSlug));
    return { status: "done", message: "このブログの AEO の構えを保存しました。" };
  }

  const article = requiredText(formData, "articleSlug", "対象の記事");
  if (!article.ok) return article.state;

  const result = await entry.manage.execute(actor, {
    action: "extract",
    siteSlug,
    articleSlug: article.value,
  });
  if (!result.ok) return failureFromDomainError(result.error);
  revalidatePath(aeoPath(siteSlug));
  const count = result.value.extractedCount ?? 0;
  return {
    status: "done",
    message:
      count === 0
        ? "引用できる形の答えが 1 つも取れませんでした。問いと答えの対になっている場所がまだありません。"
        : `${count} 件の引用単位を取り直しました。`,
  };
}
