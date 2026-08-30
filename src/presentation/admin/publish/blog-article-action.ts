"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ARTICLE_BLOCK_KINDS,
  ARTICLE_TEMPLATES,
  BLOG_ARTICLE_STATUSES,
} from "@/domain/blogops";
import { blogOpsEntry, signedInActor } from "@/presentation/composition";
import {
  parseArticleBlocksOrFailure,
  parseEnumOrFailure,
  parseIntentOrFailure,
} from "./blog-action-input";
import type { BlogOpsState } from "./blog-ops-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

const LIST_PATH = "/admin/blog/articles";

/**
 * 記事を作る・直す・消す。
 *
 * --- 部品は「行の並び」で受け取る ---
 * 版面 (T1〜T4) が要求する部品は決まっているが、**画面は欠けたままでも保存できる**。
 * 公開へ進めるときだけユースケースが欠けを断る。ここで先に断ると、
 * 書きかけを保存できない画面になり、書き手は下書きを別の場所へ持ち出す。
 */
export async function manageBlogArticleAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("ブログ記事の編集");

  const entry = await blogOpsEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const intent = parseIntentOrFailure(
    text("intent"),
    ["create", "update", "delete", "restore"] as const,
  );
  if (!intent.ok) return intent.failure;

  if (intent.value === "delete") {
    const result = await entry.deleteArticle.execute(actor, {
      articleId: text("articleId"),
      reason: text("reason"),
    });
    if (!result.ok) {
      return failureFromDomainError(result.error);
    }
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/deleted`);
    revalidatePath(`/s/${result.value.siteSlug}/blog`);
    revalidatePath(`/s/${result.value.siteSlug}/blog/${result.value.slug}`);
    /*
     * 消したら**一覧へ戻す**。この画面に留めてはいけない。
     *
     * 削除フォームは記事 1 本の画面 (`/admin/blog/articles/[article]`) にある。
     * 消えた記事の画面をそのまま描き直すと、消した本人に
     * 「ブログ記事 が見つかりません (id: bar_...)」という**断り**が出る。
     * 操作は成功しているのに、失敗の顔で返っていることになる。
     * (2026-08-26 に `tests/e2e/blog-ops-crud.spec.ts` が実際にこれを踏んだ。)
     *
     * 何を消したかは行き先へ持っていく。`redirect()` は例外を投げるので、
     * ここから先の `return` には到達しない。
     */
    redirect(`${LIST_PATH}?deleted=${encodeURIComponent(result.value.title)}`);
  }

  if (intent.value === "restore") {
    const result = await entry.restoreArticle.execute(actor, { articleId: text("articleId") });
    if (!result.ok) return failureFromDomainError(result.error);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/deleted`);
    revalidatePath(`/s/${result.value.siteSlug}/blog`);
    revalidatePath(`/s/${result.value.siteSlug}/blog/${result.value.slug}`);
    return {
      status: "done",
      message: `記事「${result.value.title}」を同じ URL で戻しました。`,
    };
  }

  if (intent.value === "update") {
    const articleId = text("articleId");
    const rawExpectedRevision = text("expectedRevision");
    /*
     * revision欄を持たなかった旧画面・WebMCP入口は、migrationの新規値1として受ける。
     * 現在版が2以上ならrepositoryのCASがCONFLICTにするため、古い入口が最新本文を
     * 上書きすることはない。欄があるのに壊れている場合は従来どおり断る。
     */
    const expectedRevision =
      rawExpectedRevision === "" ? (_prev.revision ?? 1) : Number(rawExpectedRevision);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
      return {
        status: "failed",
        message: "保存前の版番を確認できませんでした。画面を読み直してください。",
        field: "revision",
      };
    }
    const template = parseEnumOrFailure(text("template"), ARTICLE_TEMPLATES, {
      field: "template",
      label: "記事の版面",
    });
    if (!template.ok) return template.failure;
    const status = parseEnumOrFailure(text("status"), BLOG_ARTICLE_STATUSES, {
      field: "status",
      label: "記事の状態",
    });
    if (!status.ok) return status.failure;
    const blocks = parseArticleBlocksOrFailure(formData, ARTICLE_BLOCK_KINDS);
    if (!blocks.ok) return blocks.failure;
    const result = await entry.updateArticle.execute(actor, {
      articleId,
      title: text("title"),
      lead: text("lead"),
      template: template.value,
      status: status.value,
      authorName: text("authorName"),
      tagIds: formData.getAll("tagIds").map(String).filter((id) => id !== ""),
      blocks: blocks.value,
      expectedRevision,
    });
    if (!result.ok) {
      return {
        ...failureFromDomainError(result.error),
        errorCode: result.error.code,
      };
    }
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${articleId}`);
    const { changed, missing } = result.value;
    return {
      status: "done",
      revision: result.value.revision,
      persistedAt: result.value.persistedAt,
      message:
        changed.length === 0
          ? "変わったところがないので、そのままにしました。"
          : missing.length === 0
            ? `${changed.join("・")} を保存しました。公開に必要な部品はそろっています。`
            : `${changed.join("・")} を保存しました。公開するには、あと ${missing.length} 種類の部品が要ります。`,
    };
  }

  const template = parseEnumOrFailure(text("template"), ARTICLE_TEMPLATES, {
    field: "template",
    label: "記事の版面",
  });
  if (!template.ok) return template.failure;
  const result = await entry.createArticle.execute(actor, {
    siteSlug: text("siteSlug"),
    slug: text("slug"),
    template: template.value,
    title: text("title"),
    lead: text("lead"),
    authorName: text("authorName"),
  });
  if (!result.ok) {
    return failureFromDomainError(result.error);
  }
  revalidatePath(LIST_PATH);
  return {
    status: "done",
    message: `下書きを作りました。この版面は ${result.value.requiredBlocks.length} 種類の部品を要求します。`,
  };
}
