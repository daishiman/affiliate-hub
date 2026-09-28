import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { BlogOpsRepositoryPort } from "@/application/ports/blog-ops";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { EditorialPublishedContentPort } from "@/application/ports/site";
import {
  type ArticleSummary,
  toSummary,
} from "@/application/read-models/published-article";
import { MAX_FEATURED_ARTICLES } from "@/domain/blogops";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  containsCommercial,
  err,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

const CANDIDATE_LIMIT = 100;

export type ManageBlogHomeFeaturedArticlesDeps = {
  readonly repository: BlogOpsRepositoryPort;
  readonly publishedContent: EditorialPublishedContentPort;
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
  readonly now: () => Date;
  readonly affiliateLinks?: never;
};

function guardEditorial(deps: ManageBlogHomeFeaturedArticlesDeps): void {
  const commercial = containsCommercial(deps as unknown as Record<string, unknown>);
  if (commercial.length > 0) {
    throw new Error(
      `おすすめ記事の管理に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬額をおすすめの選定に使うことはできません。",
    );
  }
}

export type ReadBlogHomeFeaturedArticlesInput = {
  readonly siteSlug: string;
};

export type SelectedBlogHomeArticle = {
  readonly articleSlug: string;
  readonly article: ArticleSummary | null;
};

export type ReadBlogHomeFeaturedArticlesOutput = {
  readonly siteSlug: string;
  readonly selectedArticles: readonly SelectedBlogHomeArticle[];
  readonly candidateArticles: readonly ArticleSummary[];
  readonly selectedCount: number;
};

export function createReadBlogHomeFeaturedArticlesUseCase(
  deps: ManageBlogHomeFeaturedArticlesDeps,
): UseCase<ReadBlogHomeFeaturedArticlesInput, ReadBlogHomeFeaturedArticlesOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: ReadBlogHomeFeaturedArticlesInput,
    ): Promise<Result<ReadBlogHomeFeaturedArticlesOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "トップのおすすめ記事の閲覧");
      if (!allowed.ok) return allowed;

      const saved = await deps.repository.findBlogHomeFeaturedArticles(
        actor.workspaceId,
        input.siteSlug,
      );
      if (!saved.ok) return saved;
      const articleSlugs = saved.value?.articleSlugs ?? [];

      const selectedArticles: SelectedBlogHomeArticle[] = [];
      for (const articleSlug of articleSlugs) {
        const found = await deps.publishedContent.findArticle(input.siteSlug, articleSlug);
        if (!found.ok) return found;
        selectedArticles.push({
          articleSlug,
          article: found.value === null ? null : toSummary(found.value),
        });
      }

      const published = await deps.publishedContent.listRecent(input.siteSlug, CANDIDATE_LIMIT);
      if (!published.ok) return published;
      const selected = new Set(articleSlugs);

      return ok({
        siteSlug: input.siteSlug,
        selectedArticles,
        candidateArticles: published.value.filter((article) => !selected.has(article.slug)),
        selectedCount: articleSlugs.length,
      });
    },
  };
}

export type ReplaceBlogHomeFeaturedArticlesInput = {
  readonly siteSlug: string;
  readonly articleSlugs: readonly string[];
};

export type ReplaceBlogHomeFeaturedArticlesOutput = {
  readonly articleSlugs: readonly string[];
};

export function createReplaceBlogHomeFeaturedArticlesUseCase(
  deps: ManageBlogHomeFeaturedArticlesDeps,
): UseCase<ReplaceBlogHomeFeaturedArticlesInput, ReplaceBlogHomeFeaturedArticlesOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: ReplaceBlogHomeFeaturedArticlesInput,
    ): Promise<Result<ReplaceBlogHomeFeaturedArticlesOutput, DomainError>> {
      const allowed = requireCapability(actor, "site.manage", "トップのおすすめ記事の設定");
      if (!allowed.ok) return allowed;

      if (input.articleSlugs.length > MAX_FEATURED_ARTICLES) {
        return err(
          validationError(
            `おすすめ記事は${MAX_FEATURED_ARTICLES}件まで選んでください。`,
            "articleSlugs",
          ),
        );
      }
      if (new Set(input.articleSlugs).size !== input.articleSlugs.length) {
        return err(validationError("同じ記事を2回選ぶことはできません。", "articleSlugs"));
      }

      const saved = await deps.repository.findBlogHomeFeaturedArticles(
        actor.workspaceId,
        input.siteSlug,
      );
      if (!saved.ok) return saved;
      const before = saved.value?.articleSlugs ?? [];
      const alreadySelected = new Set(before);

      // 一時非公開の保存済み slug は intent として残す。新規追加だけを現在の公開投影で検査する。
      for (const articleSlug of input.articleSlugs) {
        if (alreadySelected.has(articleSlug)) continue;
        const found = await deps.publishedContent.findArticle(input.siteSlug, articleSlug);
        if (!found.ok) return found;
        if (found.value === null) {
          return err(
            validationError(
              "新しく選べるのは、このブログで現在公開中の記事だけです。",
              "articleSlugs",
            ),
          );
        }
      }

      const articleSlugs = [...input.articleSlugs];
      const replaced = await deps.repository.replaceBlogHomeFeaturedArticles(actor.workspaceId, {
        siteSlug: input.siteSlug,
        articleSlugs,
      });
      if (!replaced.ok) return replaced;

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_layout.changed",
        targetType: "blog_home_featured_articles",
        targetId: input.siteSlug,
        before: { articleSlugs: [...before] },
        after: { articleSlugs },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure("おすすめ記事の並びは保存されています", {
            siteSlug: input.siteSlug,
          }),
        );
      }

      return ok({ articleSlugs });
    },
  };
}
