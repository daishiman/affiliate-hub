import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { BlogOpsRepositoryPort } from "@/application/ports/blog-ops";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import {
  ARTICLE_BLOCK_LABEL,
  ARTICLE_TEMPLATE_LABEL,
  ARTICLE_TEMPLATE_TITLE_RULE,
  type ArticleBlockKind,
  type ArticleTemplate,
  BLOG_ARTICLE_STATUS_LABEL,
  blocksOutOfTemplateOrder,
  type BlogArticleStatus,
  FRESHNESS_LABEL,
  type Freshness,
  type OperationalHealth,
  freshnessOf,
  deliveryHealth,
  deliveryOperationalState,
  missingBlocks,
  validateArticleRestore,
  validateArticleSlug,
} from "@/domain/blogops";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  containsCommercial,
  domainError,
  err,
  notFound,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";
import { isExpressionArticleBlock } from "@/application/adapters/expression-article-block";

/**
 * ブログ記事の CRUD。
 *
 * 生成の流れに乗る記事（`content.*`）とは別物である。
 * あちらは下書き→校正→承認→公開の**位置**を持つ。
 * こちらは読者に見える面の記事で、持っているのは
 * **版面（T1–T4）と、その版面が要求する部品が揃っているか**である。
 *
 * 版面ごとの必要部品はドメイン（`REQUIRED_BLOCKS`）が正本。
 * ここで必要部品を数え直さない。数え直すと、
 * 保存を断る基準と画面が出す注意書きがずれる。
 */
export type ManageBlogArticlesDeps = {
  readonly repository: BlogOpsRepositoryPort;
  readonly ids: IdGeneratorPort;
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
  readonly affiliateLinks?: never;
};

function guardEditorial(deps: ManageBlogArticlesDeps): void {
  const commercial = containsCommercial(deps as unknown as Record<string, unknown>);
  if (commercial.length > 0) {
    throw new Error(
      `記事の管理に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬額を記事の並び順・書き分けの入力にすることはできません。",
    );
  }
}

export type BlogArticleRow = {
  readonly articleId: string;
  readonly siteSlug: string;
  readonly slug: string;
  readonly title: string;
  readonly template: ArticleTemplate;
  readonly templateLabel: string;
  readonly status: BlogArticleStatus;
  readonly statusLabel: string;
  readonly authorName: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
  readonly freshness: Freshness;
  readonly freshnessLabel: string;
  readonly health: OperationalHealth;
};

export type ListBlogArticlesInput = { readonly siteSlug?: string | null };

export type ListBlogArticlesOutput = {
  readonly rows: readonly BlogArticleRow[];
  readonly total: number;
  readonly staleCount: number;
  readonly emptyReason: string | null;
};

export function createListBlogArticlesUseCase(
  deps: ManageBlogArticlesDeps,
): UseCase<ListBlogArticlesInput, ListBlogArticlesOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: ListBlogArticlesInput,
    ): Promise<Result<ListBlogArticlesOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "ブログ記事の一覧");
      if (!allowed.ok) return allowed;

      const found = await deps.repository.listArticles(actor.workspaceId, input.siteSlug ?? null);
      if (!found.ok) return found;

      const [blockKinds, parts, snapshots] = await Promise.all([
        deps.repository.listArticleBlockKinds(
          actor.workspaceId,
          found.value.map((article) => article.id),
        ),
        deps.repository.listDeliveryParts(actor.workspaceId, null),
        deps.repository.listDeliverySnapshots(actor.workspaceId, null),
      ]);
      if (!blockKinds.ok) return err(blockKinds.error);
      if (!parts.ok) return err(parts.error);
      if (!snapshots.ok) return err(snapshots.error);

      const now = deps.now();
      const rows = found.value.map((a): BlogArticleRow => {
        const freshness = freshnessOf(a.updatedAt, now);
        const compliance =
          missingBlocks(
            a.template,
            (blockKinds.value[a.id] ?? []).map((kind) => ({ kind })),
          ).length === 0
            ? "healthy"
            : "attention";
        const deliveryState = deliveryOperationalState(
          deliveryHealth(
            parts.value.filter((part) => part.siteSlug === a.siteSlug),
            snapshots.value.filter((snapshot) => snapshot.siteSlug === a.siteSlug),
          ).map((row) => row.state),
        );
        return {
          articleId: a.id,
          siteSlug: a.siteSlug,
          slug: a.slug,
          title: a.title,
          template: a.template,
          templateLabel: ARTICLE_TEMPLATE_LABEL[a.template],
          status: a.status,
          statusLabel: BLOG_ARTICLE_STATUS_LABEL[a.status],
          authorName: a.authorName,
          updatedAt: a.updatedAt.toISOString(),
          publishedAt: a.publishedAt?.toISOString() ?? null,
          freshness,
          freshnessLabel: FRESHNESS_LABEL[freshness],
          health: {
            compliance,
            delivery: deliveryState,
            freshness,
          },
        };
      });

      return ok({
        rows,
        total: rows.length,
        staleCount: rows.filter((r) => r.freshness === "stale").length,
        emptyReason:
          rows.length === 0 ? "このブログにはまだ記事が 1 本もありません。" : null,
      });
    },
  };
}

export type DeletedBlogArticleRow = {
  readonly articleId: string;
  readonly siteSlug: string;
  readonly slug: string;
  readonly title: string;
  readonly statusLabel: string;
  readonly deletedAt: string;
};

export type ListDeletedBlogArticlesOutput = {
  readonly rows: readonly DeletedBlogArticleRow[];
  readonly total: number;
  readonly emptyReason: string | null;
};

export function createListDeletedBlogArticlesUseCase(
  deps: ManageBlogArticlesDeps,
): UseCase<ListBlogArticlesInput, ListDeletedBlogArticlesOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "削除済みブログ記事の一覧");
      if (!allowed.ok) return allowed;
      const found = await deps.repository.listDeletedArticles(
        actor.workspaceId,
        input.siteSlug ?? null,
      );
      if (!found.ok) return found;
      const rows = found.value.map(({ article, deletedAt }) => ({
        articleId: article.id,
        siteSlug: article.siteSlug,
        slug: article.slug,
        title: article.title,
        statusLabel: BLOG_ARTICLE_STATUS_LABEL[article.status],
        deletedAt: deletedAt.toISOString(),
      }));
      return ok({
        rows,
        total: rows.length,
        emptyReason: rows.length === 0 ? "削除済みの記事はありません。" : null,
      });
    },
  };
}

export type BlogArticleBlockView = {
  readonly id: string;
  readonly kind: ArticleBlockKind;
  readonly kindLabel: string;
  readonly heading: string;
  readonly body: string;
  readonly position: number;
};

export type GetBlogArticleInput = { readonly articleId: string };

export type GetBlogArticleOutput = {
  readonly articleId: string;
  readonly siteSlug: string;
  readonly slug: string;
  readonly title: string;
  readonly lead: string;
  readonly template: ArticleTemplate;
  readonly templateLabel: string;
  /** その版面の題名の付け方。画面の注意書きに出す。 */
  readonly titleRule: string;
  readonly status: BlogArticleStatus;
  readonly authorName: string;
  readonly blocks: readonly BlogArticleBlockView[];
  readonly tagIds: readonly string[];
  /** 版面が要求していて、まだ無い部品。空なら公開できる。 */
  readonly missing: readonly ArticleBlockKind[];
  readonly missingLabels: readonly string[];
  /**
   * 在るけれど、版面の並びから外れている部品。
   *
   * **`missing` とは直し方が違う。**足りないものは「足す」、外れているものは
   * 「動かす」。同じ言葉で出すと、運営者は足りない部品を探しに行って空振りする。
   * 返るのは**動かす手数が最小になる集合**なので、ここに出た分だけ動かせば揃う。
   */
  readonly outOfOrder: readonly ArticleBlockKind[];
  readonly outOfOrderLabels: readonly string[];
  readonly revision: number;
};

export function createGetBlogArticleUseCase(
  deps: ManageBlogArticlesDeps,
): UseCase<GetBlogArticleInput, GetBlogArticleOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: GetBlogArticleInput,
    ): Promise<Result<GetBlogArticleOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "ブログ記事の閲覧");
      if (!allowed.ok) return allowed;

      const found = await deps.repository.findArticle(actor.workspaceId, input.articleId);
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("ブログ記事", input.articleId));

      const { article, blocks, tagIds } = found.value;
      const missing = missingBlocks(article.template, blocks);
      // 並びの判定は**並べ替えたあと**に行う。保存順 (`position`) が読者に出る順で、
      // 配列に入っている順ではない。
      const ordered = [...blocks].sort((a, b) => a.position - b.position);
      const outOfOrder = blocksOutOfTemplateOrder(article.template, ordered);
      return ok({
        articleId: article.id,
        siteSlug: article.siteSlug,
        slug: article.slug,
        title: article.title,
        lead: article.lead,
        template: article.template,
        templateLabel: ARTICLE_TEMPLATE_LABEL[article.template],
        titleRule: ARTICLE_TEMPLATE_TITLE_RULE[article.template],
        status: article.status,
        authorName: article.authorName,
        // 表現 carrier は専用フォームで直す。JSON transport を汎用本文欄へ漏らさない。
        blocks: ordered
          .filter((block) => !isExpressionArticleBlock(block))
          .map((b) => ({
            id: b.id,
            kind: b.kind,
            kindLabel: ARTICLE_BLOCK_LABEL[b.kind],
            heading: b.heading,
            body: b.body,
            position: b.position,
          })),
        tagIds,
        missing,
        missingLabels: missing.map((k) => ARTICLE_BLOCK_LABEL[k]),
        outOfOrder,
        outOfOrderLabels: outOfOrder.map((k) => ARTICLE_BLOCK_LABEL[k]),
        revision: article.revision ?? 1,
      });
    },
  };
}

export type CreateBlogArticleInput = {
  readonly siteSlug: string;
  readonly slug: string;
  readonly template: ArticleTemplate;
  readonly title: string;
  readonly lead: string;
  readonly authorName: string;
};

export type CreateBlogArticleOutput = {
  readonly articleId: string;
  /** 版面が要求する部品。作った直後は全部そろっていない。 */
  readonly requiredBlocks: readonly ArticleBlockKind[];
};

export function createCreateBlogArticleUseCase(
  deps: ManageBlogArticlesDeps,
): UseCase<CreateBlogArticleInput, CreateBlogArticleOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: CreateBlogArticleInput,
    ): Promise<Result<CreateBlogArticleOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.write", "ブログ記事の作成");
      if (!allowed.ok) return allowed;

      const slug = validateArticleSlug(input.slug);
      if (!slug.ok) return slug;
      const title = input.title.trim();
      if (title === "") {
        return err(validationError("記事の題名を入れてください。", "title"));
      }

      const existing = await deps.repository.listArticles(actor.workspaceId, input.siteSlug);
      if (!existing.ok) return existing;
      const deleted = await deps.repository.listDeletedArticles(actor.workspaceId, input.siteSlug);
      if (!deleted.ok) return deleted;
      if (
        existing.value.some((a) => a.slug === slug.value) ||
        deleted.value.some((row) => row.article.slug === slug.value)
      ) {
        return err(
          validationError(
            `URL の名前「${slug.value}」はこのブログに既にあります。同じ住所に 2 本の記事は置けません。`,
            "slug",
          ),
        );
      }

      const at = deps.now();
      const articleId = `bar_${deps.ids.newId()}`;
      const saved = await deps.repository.saveArticle(actor.workspaceId, {
        id: articleId,
        siteSlug: input.siteSlug,
        slug: slug.value,
        template: input.template,
        title,
        lead: input.lead.trim(),
        status: "draft",
        authorName: input.authorName.trim(),
        publishedAt: null,
        updatedAt: at,
        blocks: [],
        tagIds: [],
        expectedRevision: null,
      });
      if (!saved.ok) return saved;

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_article.created",
        targetType: "blog_article",
        targetId: articleId,
        after: { siteSlug: input.siteSlug, slug: slug.value, template: input.template },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure(`記事「${title}」を作りました`, { articleId }));
      }

      return ok({
        articleId,
        requiredBlocks: missingBlocks(input.template, []),
      });
    },
  };
}

export type UpdateBlogArticleInput = {
  readonly articleId: string;
  readonly expectedRevision?: number;
  readonly title?: string;
  readonly lead?: string;
  readonly template?: ArticleTemplate;
  readonly status?: BlogArticleStatus;
  readonly authorName?: string;
  readonly tagIds?: readonly string[];
  readonly blocks?: readonly {
    readonly id?: string;
    readonly kind: ArticleBlockKind;
    readonly heading: string;
    readonly body: string;
  }[];
  /** 既存aggregateを全置換せず、その末尾へ足す専用操作。 */
  readonly appendBlocks?: readonly {
    readonly id?: string;
    readonly kind: ArticleBlockKind;
    readonly heading: string;
    readonly body: string;
  }[];
};

export type UpdateBlogArticleOutput = {
  readonly articleId: string;
  readonly changed: readonly string[];
  readonly missing: readonly ArticleBlockKind[];
  readonly revision: number;
  /** サーバーが保存へ使った時刻。端末下書きの `draftSavedAt` とは別物。 */
  readonly persistedAt: string;
};

export function createUpdateBlogArticleUseCase(
  deps: ManageBlogArticlesDeps,
): UseCase<UpdateBlogArticleInput, UpdateBlogArticleOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: UpdateBlogArticleInput,
    ): Promise<Result<UpdateBlogArticleOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.write", "ブログ記事の変更");
      if (!allowed.ok) return allowed;

      const found = await deps.repository.findArticle(actor.workspaceId, input.articleId);
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("ブログ記事", input.articleId));
      const before = found.value;
      const currentRevision = before.article.revision ?? 1;
      if (input.expectedRevision !== undefined && input.expectedRevision !== currentRevision) {
        return err(
          domainError("CONFLICT", "ほかの人が先にこの記事を保存しました。", {
            field: "revision",
            suggestedAction: "この画面の内容は端末下書きに残っています。最新版を開き、差分を確認してください。",
            details: { expectedRevision: input.expectedRevision, currentRevision },
          }),
        );
      }

      const template = input.template ?? before.article.template;
      const title = input.title?.trim() ?? before.article.title;
      if (title === "") {
        return err(validationError("記事の題名を空にはできません。", "title"));
      }
      const status = input.status ?? before.article.status;

      if (input.blocks !== undefined && input.appendBlocks !== undefined) {
        return err(
          validationError(
            "記事の部品は、全体編集と追加を同時には行えません。画面を読み直してください。",
            "blocks",
          ),
        );
      }

      const blocks =
        input.appendBlocks !== undefined
          ? (() => {
              const firstPosition =
                before.blocks.reduce((max, block) => Math.max(max, block.position), -1) + 1;
              return [
                ...before.blocks,
                ...input.appendBlocks.map((block, index) => ({
                  id: block.id ?? `bab_${deps.ids.newId()}`,
                  kind: block.kind,
                  heading: block.heading.trim(),
                  body: block.body,
                  position: firstPosition + index,
                })),
              ];
            })()
          : input.blocks === undefined
          ? before.blocks
          : (() => {
              const submitted = input.blocks.map((b, index) => ({
                id: b.id ?? `bab_${deps.ids.newId()}`,
                kind: b.kind,
                heading: b.heading.trim(),
                body: b.body,
                position: index,
              }));
              const submittedIds = new Set(submitted.map((block) => block.id));
              // 汎用編集フォームに carrier を出さないため、送られてこなかった既存 carrier は保持する。
              return [
                ...submitted,
                ...before.blocks.filter(
                  (block) => isExpressionArticleBlock(block) && !submittedIds.has(block.id),
                ),
              ];
            })();

      const missing = missingBlocks(template, blocks);

      /*
       * 公開だけを断る。下書きと確認待ちは、部品が欠けたままでも保存させる。
       * 途中の状態を保存できないと、書き手は 1 回の編集で全部を埋めるしかなくなり、
       * 書きかけを画面の外（手元のメモ）へ逃がすようになる。
       */
      if (status === "published" && missing.length > 0) {
        return err(
          validationError(
            `この版面（${ARTICLE_TEMPLATE_LABEL[template]}）に要る部品が揃っていません: ` +
              `${missing.map((k) => ARTICLE_BLOCK_LABEL[k]).join(" / ")}。` +
              "揃うまで公開にはできません。下書きのままなら保存できます。",
            "blocks",
          ),
        );
      }

      const at = deps.now();
      const publishedAt =
        status === "published" ? (before.article.publishedAt ?? at) : before.article.publishedAt;

      const saved = await deps.repository.saveArticle(actor.workspaceId, {
        id: before.article.id,
        siteSlug: before.article.siteSlug,
        slug: before.article.slug,
        template,
        title,
        lead: input.lead?.trim() ?? before.article.lead,
        status,
        authorName: input.authorName?.trim() ?? before.article.authorName,
        publishedAt,
        updatedAt: at,
        blocks,
        tagIds: input.tagIds ?? before.tagIds,
        expectedRevision: input.expectedRevision ?? currentRevision,
      });
      if (!saved.ok) return saved;

      const changed: string[] = [];
      if (title !== before.article.title) changed.push("title");
      if (template !== before.article.template) changed.push("template");
      if (status !== before.article.status) changed.push("status");
      if (input.lead !== undefined && input.lead.trim() !== before.article.lead) changed.push("lead");
      if (input.blocks !== undefined || input.appendBlocks !== undefined) changed.push("blocks");
      if (input.tagIds !== undefined) changed.push("tags");

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_article.changed",
        targetType: "blog_article",
        targetId: before.article.id,
        before: { title: before.article.title, template: before.article.template, status: before.article.status },
        after: { title, template, status },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure(`記事「${title}」を保存しました`, { articleId: before.article.id }));
      }

      return ok({
        articleId: before.article.id,
        changed,
        missing,
        revision: currentRevision + 1,
        persistedAt: at.toISOString(),
      });
    },
  };
}

export type DeleteBlogArticleInput = {
  readonly articleId: string;
  readonly reason: string;
};

export type DeleteBlogArticleOutput = {
  readonly title: string;
  readonly siteSlug: string;
  readonly slug: string;
};

export function createDeleteBlogArticleUseCase(
  deps: ManageBlogArticlesDeps,
): UseCase<DeleteBlogArticleInput, DeleteBlogArticleOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: DeleteBlogArticleInput,
    ): Promise<Result<DeleteBlogArticleOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.write", "ブログ記事の削除");
      if (!allowed.ok) return allowed;

      const reason = input.reason.trim();
      if (reason === "") {
        return err(
          validationError(
            "削除する理由を書いてください。理由は監査記録に残り、削除済み一覧から復元できます。",
            "reason",
          ),
        );
      }

      const found = await deps.repository.findArticle(actor.workspaceId, input.articleId);
      if (!found.ok) return found;
      if (found.value === null) return err(notFound("ブログ記事", input.articleId));
      const target = found.value.article;

      const deleted = await deps.repository.deleteArticle(
        actor.workspaceId,
        input.articleId,
        deps.now(),
      );
      if (!deleted.ok) return deleted;

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_article.deleted",
        targetType: "blog_article",
        targetId: input.articleId,
        before: { siteSlug: target.siteSlug, slug: target.slug, title: target.title },
        reason,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure(`記事「${target.title}」を消しました`, { articleId: input.articleId }));
      }

      return ok({ title: target.title, siteSlug: target.siteSlug, slug: target.slug });
    },
  };
}

export type RestoreBlogArticleInput = { readonly articleId: string };
export type RestoreBlogArticleOutput = {
  readonly articleId: string;
  readonly siteSlug: string;
  readonly slug: string;
  readonly title: string;
};

export function createRestoreBlogArticleUseCase(
  deps: ManageBlogArticlesDeps,
): UseCase<RestoreBlogArticleInput, RestoreBlogArticleOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.write", "ブログ記事の復元");
      if (!allowed.ok) return allowed;

      const deleted = await deps.repository.listDeletedArticles(actor.workspaceId, null);
      if (!deleted.ok) return deleted;
      const target = deleted.value.find((row) => row.article.id === input.articleId);
      if (target === undefined) return err(notFound("削除済みブログ記事", input.articleId));

      const [activeArticles, activeSites] = await Promise.all([
        deps.repository.listArticles(actor.workspaceId, target.article.siteSlug),
        deps.repository.listNetwork(actor.workspaceId),
      ]);
      if (!activeArticles.ok) return activeArticles;
      if (!activeSites.ok) return activeSites;
      const valid = validateArticleRestore(
        target.article,
        activeArticles.value,
        activeSites.value.map((site) => site.siteSlug),
      );
      if (!valid.ok) return valid;

      const restored = await deps.repository.restoreArticle(
        actor.workspaceId,
        input.articleId,
        deps.now(),
      );
      if (!restored.ok) return restored;

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_article.restored",
        targetType: "blog_article",
        targetId: target.article.id,
        after: {
          siteSlug: target.article.siteSlug,
          slug: target.article.slug,
          title: target.article.title,
        },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure(`記事「${target.article.title}」を戻しました`, {
            articleId: target.article.id,
          }),
        );
      }
      return ok({
        articleId: target.article.id,
        siteSlug: target.article.siteSlug,
        slug: target.article.slug,
        title: target.article.title,
      });
    },
  };
}
