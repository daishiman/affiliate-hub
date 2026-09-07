import { and, eq, getTableColumns, isNotNull, isNull } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type {
  AffiliatePlacement,
  AffiliatePlacementArticleUpdate,
  ArticlePlacements,
  BlogAffiliatePlacementPort,
} from "@/application/ports/blog-affiliate-placement";
import { blogAffiliatePlacements, articles } from "@/db/schema";
import { err, ok, validationError, type WorkspaceId } from "@/domain/shared";
import { createD1BlogOpsRepository } from "./blog-ops-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * ブログ×アフィリエイト配置台帳（D1）。
 *
 * すべての問い合わせの where 1 段目が `workspace_id` である。
 * 索引は `(site_slug, article_slug)` 始まりなので、逆引き（A7）は
 * 作業場所で絞ったあとの走査になる。**現時点の行数では走査で足りる。**
 * 遅くなったら索引を足す——遅くなる前に足さない
 * （`admin-api-contract.md` §5.3）。
 */

export type BlogAffiliatePlacementRepositoryDeps = {
  readonly db: DrizzleD1;
  readonly newId: () => string;
};

function toPlacement(row: {
  siteSlug: string;
  articleSlug: string;
  placement: string;
  trackingCode: string | null;
  position: number;
}): AffiliatePlacement {
  return {
    siteSlug: row.siteSlug,
    articleSlug: row.articleSlug,
    placement: row.placement,
    position: row.position,
    ...(row.trackingCode === null ? {} : { trackingCode: row.trackingCode }),
  };
}

export function createD1BlogAffiliatePlacementRepository(
  deps: BlogAffiliatePlacementRepositoryDeps,
): BlogAffiliatePlacementPort {
  const { db, newId } = deps;

  /**
   * 追跡コードは NULL を取りうる。「コード無しの掲載」を指すために
   * `= NULL` は使えない（SQL では NULL = NULL が真にならない）ので、
   * 未指定は `IS NULL` へ写す。ここを取り違えると、コード無しの掲載が
   * 一度作られたら二度と消せない行になる。
   */
  const codeMatches = (trackingCode: string | undefined) =>
    trackingCode === undefined
      ? isNull(blogAffiliatePlacements.trackingCode)
      : eq(blogAffiliatePlacements.trackingCode, trackingCode);

  async function validateArticleUpdate(
    input: {
      readonly workspaceId: WorkspaceId;
      readonly siteSlug: string;
      readonly articleSlug: string;
      readonly articleUpdate?: AffiliatePlacementArticleUpdate;
    },
  ) {
    const { workspaceId, siteSlug, articleSlug, articleUpdate } = input;
    const [article] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(
        eq(articles.workspaceId, workspaceId),
        eq(articles.siteSlug, siteSlug),
        eq(articles.slug, articleSlug),
      ))
      .limit(1);
    if (articleUpdate === undefined) {
      return article === undefined
        ? ok(true)
        : err(validationError("記事全体と一緒に保存してください。削除済みの記事は先に復元してください。", "articleUpdate"));
    }
    if (
      article === undefined || article.id !== articleUpdate.id ||
      articleUpdate.siteSlug !== siteSlug || articleUpdate.slug !== articleSlug ||
      !Number.isInteger(articleUpdate.expectedRevision) || articleUpdate.expectedRevision < 1
    ) {
      return err(validationError("同じ記事の最新版を開いて掲載を変更してください。", "articleUpdate"));
    }
    return ok(true);
  }

  async function commitPlacement(
    workspaceId: WorkspaceId,
    scope: Pick<AffiliatePlacement, "siteSlug" | "articleSlug">,
    articleUpdate: AffiliatePlacementArticleUpdate | undefined,
    mutation: BatchItem<"sqlite">,
  ) {
    if (articleUpdate !== undefined) {
      return createD1BlogOpsRepository(db, {
        workspaceId, articleId: articleUpdate.id, statements: [mutation],
      }).saveArticle(workspaceId, articleUpdate);
    }
    // 孤児の事前確認直後に記事が作成されても、台帳だけを変更しない。
    // 削除済記事も復元用本文を持つため孤児とはみなさない。
    // 現存記事があれば主キー重複で同じbatchを中断し、無ければ0行で通過する。
    const orphanGuard = db.insert(articles).select(
      db.select(getTableColumns(articles)).from(articles).where(and(
        eq(articles.workspaceId, workspaceId), eq(articles.siteSlug, scope.siteSlug),
        eq(articles.slug, scope.articleSlug),
      )),
    );
    await db.batch([orphanGuard, mutation]);
    return ok(true);
  }

  return {
    async listBySite({ workspaceId, siteSlug, knownArticleSlugs }) {
      try {
        const rows = await db
          .select()
          .from(blogAffiliatePlacements)
          .where(
            and(
              eq(blogAffiliatePlacements.workspaceId, workspaceId),
              eq(blogAffiliatePlacements.siteSlug, siteSlug),
            ),
          );

        const byArticle = new Map<string, AffiliatePlacement[]>();
        /*
          記事の全体集合を先に空で並べる。台帳に無い記事＝掲載 0 件で、
          それこそがこの一覧の見どころ（掲載漏れ）である。
          後から足すと、台帳にある記事が先頭に固まって順序が偏る。
        */
        for (const slug of knownArticleSlugs ?? []) byArticle.set(slug, []);

        for (const row of rows) {
          const list = byArticle.get(row.articleSlug);
          if (list === undefined) byArticle.set(row.articleSlug, [toPlacement(row)]);
          else list.push(toPlacement(row));
        }

        const entries: ArticlePlacements[] = [];
        for (const [articleSlug, placements] of byArticle) {
          // 同じ記事の中は position 順。同値は台帳の並びのまま残す。
          entries.push({
            articleSlug,
            placements: [...placements].sort((a, b) => a.position - b.position),
          });
        }
        return ok(entries);
      } catch (cause) {
        return storageFailure("ブログの掲載一覧の取得", cause);
      }
    },

    async listByAffiliate({ workspaceId, trackingCode, placement }) {
      try {
        const conditions = [eq(blogAffiliatePlacements.workspaceId, workspaceId)];
        // 未指定の条件は足さない。「絞り込み無し＝全件」を素直に表す。
        if (trackingCode !== undefined) {
          conditions.push(eq(blogAffiliatePlacements.trackingCode, trackingCode));
        }
        if (placement !== undefined) {
          conditions.push(eq(blogAffiliatePlacements.placement, placement));
        }
        const rows = await db
          .select()
          .from(blogAffiliatePlacements)
          .where(and(...conditions));
        return ok(rows.map(toPlacement));
      } catch (cause) {
        return storageFailure("掲載の逆引き", cause);
      }
    },

    async save({ workspaceId, placement, articleUpdate }) {
      try {
        const valid = await validateArticleUpdate({ workspaceId, ...placement, articleUpdate });
        if (!valid.ok) return valid;
        const row = {
          id: newId(),
          workspaceId,
          siteSlug: placement.siteSlug,
          articleSlug: placement.articleSlug,
          placement: placement.placement,
          trackingCode: placement.trackingCode ?? null,
          position: placement.position,
        };
        const insert = db.insert(blogAffiliatePlacements).values(row);
        const placementMutation =
          placement.trackingCode === undefined
            ? insert.onConflictDoUpdate({
                target: [
                  blogAffiliatePlacements.workspaceId,
                  blogAffiliatePlacements.siteSlug,
                  blogAffiliatePlacements.articleSlug,
                  blogAffiliatePlacements.placement,
                ],
                targetWhere: isNull(blogAffiliatePlacements.trackingCode),
                set: { position: placement.position },
              })
            : insert.onConflictDoUpdate({
                target: [
                  blogAffiliatePlacements.workspaceId,
                  blogAffiliatePlacements.siteSlug,
                  blogAffiliatePlacements.articleSlug,
                  blogAffiliatePlacements.placement,
                  blogAffiliatePlacements.trackingCode,
                ],
                targetWhere: isNotNull(blogAffiliatePlacements.trackingCode),
                set: { position: placement.position },
              });

        const saved = await commitPlacement(workspaceId, placement, articleUpdate, placementMutation);
        if (!saved.ok) return saved;
        return ok(placement);
      } catch (cause) {
        return storageFailure("掲載の保存", cause);
      }
    },

    async remove({
      workspaceId,
      siteSlug,
      articleSlug,
      placement,
      trackingCode,
      articleUpdate,
    }) {
      try {
        const valid = await validateArticleUpdate({ workspaceId, siteSlug, articleSlug, articleUpdate });
        if (!valid.ok) return valid;
        const placementMutation = db
          .delete(blogAffiliatePlacements)
          .where(
            and(
              eq(blogAffiliatePlacements.workspaceId, workspaceId),
              eq(blogAffiliatePlacements.siteSlug, siteSlug),
              eq(blogAffiliatePlacements.articleSlug, articleSlug),
              eq(blogAffiliatePlacements.placement, placement),
              codeMatches(trackingCode),
            ),
          );
        const saved = await commitPlacement(workspaceId, { siteSlug, articleSlug }, articleUpdate, placementMutation);
        if (!saved.ok) return saved;
        return ok(undefined);
      } catch (cause) {
        return storageFailure("掲載の削除", cause);
      }
    },
  };
}
