import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createCreateBlogArticleUseCase,
  createDeleteBlogArticleUseCase,
  createGetBlogArticleUseCase,
  createListBlogArticlesUseCase,
  createUpdateBlogArticleUseCase,
} from "@/application/usecases/blog-ops/manage-blog-articles";
import { createListBlogTagsUseCase } from "@/application/usecases/blog-ops/manage-blog-pages";
import {
  ARTICLE_BLOCK_KINDS,
  ARTICLE_TEMPLATES,
  BLOG_ARTICLE_STATUSES,
} from "@/domain/blogops";
import { defineTool } from "./define-tool";
import type { AnyToolDefinition } from "./tool-definition";

/**
 * ブログ運用の道具。
 *
 * **手元の CLI（Claude Code / Codex）から記事を書くための口である。**
 *
 * 新しい REST を足していない。足すと同じ操作に 2 つの入口ができ、
 * 権限判定と監査記録が 2 か所に分かれる（`docs/spec/feat-blog-ops-crud/api-contract.md`
 * がその決着を書いている）。ここへ 1 つ載せると、既にある
 * `/api/tools/[tool]`・`/api/mcp`・ページ内の AI の 3 つに同時に現れる。
 *
 * **画面が呼ぶユースケースと同じものをそのまま載せている。**
 * ここに専用の処理は 1 行も書かない。書いた時点で、
 * 画面から書いた記事と AI が書いた記事で通る検査が変わり始める。
 *
 * ## 人が押すもの
 *
 * 公開（`status` を変える）と削除は `requiresHumanApproval: true` にしてある。
 * 手元の CLI は必ず `ai_service_account` として通るので、
 * この 2 つは**構造上呼べない**。AI は下書きを積むところまでを担い、
 * 読者に出す判断と消す判断は人が画面で押す。
 *
 * ## 本文の書き方
 *
 * `body` は拡張 Markdown の 1 本の文字列である（`src/domain/blogops/prose-format.ts`）。
 * 素の文章はそのまま段落になる。記法は画面のエディタと同じものが読める。
 */

const articleId = z.string().min(1);
const siteSlug = z.string().min(1);

/** 保存できる節の並び。1 つの節は「種類・見出し・本文」でできている。 */
const blockInput = z.object({
  /** 既にある節を直すときだけ渡す。省くと新しい節として積まれる。 */
  id: z.string().min(1).optional(),
  kind: z.enum(ARTICLE_BLOCK_KINDS),
  heading: z.string(),
  body: z.string(),
});

export function blogOpsTools(deps: AppDeps): readonly AnyToolDefinition[] {
  /*
    **商業データのポートを渡さない。**渡すと `guardEditorial` が組み立ての時点で
    例外を投げる。報酬額を記事の並び順・書き分けの入力にできないようにするためで、
    ここで 1 つ足すと、その仕掛けが黙って外れる。
  */
  const base = {
    repository: deps.blogOps,
    ids: deps.ids,
    auditLog: deps.auditLog,
    now: () => new Date(),
  };

  return [
    defineTool({
      name: "list_blog_articles",
      description:
        "ブログ記事の一覧を返します。下書き・確認待ち・公開済みをすべて含み、" +
        "最後に直した日からの経過（新しい / そろそろ / 古い）も付きます。" +
        "報酬額は含みません (仕様上、含めることができません)。",
      schema: z.object({ siteSlug: siteSlug.nullable().optional() }),
      readOnly: true,
      useCase: createListBlogArticlesUseCase(base),
    }),
    defineTool({
      name: "get_blog_article",
      description:
        "記事 1 本を、節の並び・付いているタグ・記事型が要求する部品の過不足まで含めて返します。" +
        "`missing` は足す部品、`outOfOrder` は動かす部品で、直し方が違います。",
      schema: z.object({ articleId }),
      readOnly: true,
      useCase: createGetBlogArticleUseCase(base),
    }),
    defineTool({
      name: "create_blog_article",
      description:
        "記事の枠を作ります。作られるのは必ず下書きで、いきなり公開はできません。" +
        "返り値の `requiredBlocks` が、この記事型で公開までに要る部品です。",
      schema: z.object({
        siteSlug,
        slug: z.string().min(1),
        template: z.enum(ARTICLE_TEMPLATES),
        title: z.string().min(1),
        lead: z.string(),
        authorName: z.string().min(1),
        categorySlug: z.string().min(1),
      }),
      readOnly: false,
      useCase: createCreateBlogArticleUseCase(base),
    }),
    defineTool({
      name: "update_blog_article",
      description:
        "記事の題名・書き出し・記事型・タグ・本文の節を書き換えます。" +
        "`blocks` を渡すと節はまるごと置き換わります（渡した順が読者に出る順です）。" +
        "本文は拡張 Markdown の文字列で、素の文章はそのまま段落になります。" +
        "公開状態はここでは変えられません（人が画面で押します）。",
      schema: z.object({
        articleId,
        title: z.string().min(1).optional(),
        lead: z.string().optional(),
        template: z.enum(ARTICLE_TEMPLATES).optional(),
        authorName: z.string().min(1).optional(),
        tagIds: z.array(z.string().min(1)).optional(),
        blocks: z.array(blockInput).optional(),
      }),
      readOnly: false,
      useCase: createUpdateBlogArticleUseCase(base),
    }),
    defineTool({
      name: "set_blog_article_status",
      description:
        "記事を公開・確認待ち・下書き・保管へ移します。" +
        "読者に出す判断なので、人が画面から行います (AI からは呼べません)。",
      schema: z.object({ articleId, status: z.enum(BLOG_ARTICLE_STATUSES) }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createUpdateBlogArticleUseCase(base),
    }),
    defineTool({
      name: "delete_blog_article",
      description:
        "記事を本文ごと消します。後から中身を確かめられないので、消す理由が要ります。" +
        "人が画面から行います (AI からは呼べません)。",
      schema: z.object({ articleId, reason: z.string().min(1) }),
      readOnly: false,
      requiresHumanApproval: true,
      useCase: createDeleteBlogArticleUseCase(base),
    }),
    defineTool({
      name: "list_blog_tags",
      description:
        "そのブログのタグ（話題・作り手）の一覧を返します。" +
        "記事に付けるときは、ここで返る `tagId` を `update_blog_article` へ渡します。",
      schema: z.object({ siteSlug }),
      readOnly: true,
      useCase: createListBlogTagsUseCase(base),
    }),
  ];
}
