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
import { failureFromDomainError, notSignedInFailure } from "./use-case-result";
import { parseExpressionBlockInput } from "./expression-block-input";
import { toExpressionArticleBlock } from "@/application/adapters/expression-article-block";

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
    ["create", "update", "delete", "restore", "append_expression"] as const,
  );
  if (!intent.ok) return intent.failure;

  if (intent.value === "append_expression") {
    const articleId = text("articleId");
    const expression = parseExpressionBlockInput(formData);
    if (!expression.ok) return expression.failure;
    const found = await entry.getArticle.execute(actor, { articleId });
    if (!found.ok) return failureFromDomainError(found.error);
    const carrier = toExpressionArticleBlock(expression.value, "", 0);
    const updated = await entry.updateArticle.execute(actor, {
      articleId,
      // 表示用getArticleはcarrierを隠すため、全置換入力へ流用しない。
      // repositoryの現行aggregateへusecaseが追記する専用DTOだけを渡す。
      appendBlocks: [{ kind: carrier.kind, heading: carrier.heading, body: carrier.body }],
    });
    if (!updated.ok) return failureFromDomainError(updated.error);
    revalidatePath(`${LIST_PATH}/${articleId}`);
    revalidatePath(`/s/${found.value.siteSlug}/blog/${found.value.slug}`);
    return { status: "done", message: "表現ブロックを記事へ追加し、公開表示へ反映しました。" };
  }

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
    });
    if (!result.ok) {
      return failureFromDomainError(result.error);
    }
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${articleId}`);
    const { changed, missing } = result.value;
    return {
      status: "done",
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
