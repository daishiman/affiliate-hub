import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type {
  ArticleRatingPort,
  BlogArticleDetail,
  BlogDeliveryPartRecord,
  BlogDeliverySnapshotRecord,
  BlogLayoutBandRecord,
  BlogLayoutSlotRecord,
  BlogOpsRepositoryPort,
  BlogTagRecord,
  DeletedSiteNetworkRecord,
  FixedPageRecord,
  PublicBlogPort,
  PublicSiteReader,
  SaveBlogArticleInput,
  SaveSiteNetworkInput,
  SiteNetworkRecord,
} from "@/application/ports/blog-ops";
import type { PortResult } from "@/application/ports/common";
import type {
  EditorialPublishedContentPort,
  EditorialSiteRepositoryPort,
} from "@/application/ports/site";
import { projectBlogArticle } from "@/application/read-models/published-article";
import {
  type ArticleBlockKind,
  type ArticleTemplate,
  ARTICLE_TYPE_BY_TEMPLATE,
  type BlogArticle,
  type BlogArticleStatus,
  type DeliveryPart,
  type FixedPageKind,
  FIXED_PAGE_KINDS,
  type FixedPageStatus,
  type LayoutRegion,
  type NetworkRole,
  type NetworkStatus,
  type RatingSummary,
  summarizeRatings,
  UNCATEGORIZED_ARTICLE_CATEGORY,
} from "@/domain/blogops";
import { domainError, err, ok, validationError } from "@/domain/shared";
import {
  type BlogArticleRow,
  articles as blogArticles,
  blogArticleBlocks,
  blogArticleRatings,
  blogArticleTags,
  blogDeliveryParts,
  blogDeliverySnapshots,
  blogLayoutBands,
  blogLayoutSlots,
  blogTags,
  legalPages,
  publishedArticles,
  publishedArticleTombstones,
  siteBlueprints,
  siteNetworkNodes,
} from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import {
  createD1ContentRepository,
  publishedArticleSaveStatements,
  sourcedPublishedArticleUnpublishStatements,
} from "./published-article-repository";
import { storageFailure } from "./storage-failure";

/**
 * ブログ運用の保存先（D1）。
 *
 * 作法は他の D1 実装と同じ 3 つ。
 *
 *   1. **絞り込みは必ず `workspaceId` から始める。** 作成者向けの口は
 *      全メソッドが第一引数に取るので、`where` の先頭に必ず置く。
 *   2. **見本で埋めない。** 保存先に無いものは無いまま返す。
 *      見本を混ぜると、画面が「まだ作っていない」と「保存先が落ちている」を
 *      区別できなくなる。空かどうかの判断はユースケース側の仕事。
 *   3. **例外はそのまま画面へ出さない**（`storageFailure`）。
 *
 * 記事の保存だけは 3 つの表（本体・部品・タグの結び）を D1 batch へまとめる。
 * batch は 1 取引なので、CAS 競合や部品の競合などで途中の文が失敗しても、
 * 公開中の本体と既存部品・タグ結合は書き換わらない。
 */

function toNetwork(row: typeof siteNetworkNodes.$inferSelect): SiteNetworkRecord {
  return {
    id: row.id,
    siteSlug: row.siteSlug,
    role: row.role as NetworkRole,
    parentSlug: row.parentSlug,
    name: row.name,
    oneLine: row.oneLine,
    position: row.position,
    status: row.status as NetworkStatus,
  };
}

function toDeletedNetwork(
  row: typeof siteNetworkNodes.$inferSelect,
): DeletedSiteNetworkRecord {
  if (row.deletedAt === null) throw new Error("deletedAt の無い節点を削除済みとして読めません。");
  return { node: toNetwork(row), deletedAt: row.deletedAt };
}

function toArticle(row: BlogArticleRow): BlogArticle {
  if (row.siteSlug === null || row.template === null) {
    throw new Error("ブログ所属または記事型の無い articles 行をブログ記事として読めません。");
  }
  return {
    id: row.id,
    siteSlug: row.siteSlug,
    slug: row.slug,
    template: row.template as ArticleTemplate,
    title: row.title,
    lead: row.lead,
    status: row.status as BlogArticleStatus,
    authorName: row.authorName,
    categorySlug: row.publicCategorySlug,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    revision: row.revision,
  };
}

async function loadDeletedDetail(
  db: DrizzleD1,
  row: BlogArticleRow,
) {
  if (row.deletedAt === null) throw new Error("deletedAt の無い記事を削除済みとして読めません。");
  return { ...(await loadDetail(db, row)), deletedAt: row.deletedAt };
}

function toSlot(row: typeof blogLayoutSlots.$inferSelect): BlogLayoutSlotRecord {
  return {
    id: row.id,
    siteSlug: row.siteSlug,
    region: row.region as LayoutRegion,
    slotKey: row.slotKey,
    title: row.title,
    body: row.body,
    position: row.position,
    enabled: row.enabled,
  };
}

function toBand(row: typeof blogLayoutBands.$inferSelect): BlogLayoutBandRecord {
  return {
    id: row.id,
    siteSlug: row.siteSlug,
    band: row.band,
    title: row.title,
    enabled: row.enabled,
    position: row.position,
    itemLimit: row.itemLimit,
  };
}

function toPart(row: typeof blogDeliveryParts.$inferSelect): BlogDeliveryPartRecord {
  return {
    id: row.id,
    siteSlug: row.siteSlug,
    part: row.part as DeliveryPart,
    enabled: row.enabled,
    note: row.note,
    position: row.position,
  };
}

function toTag(row: typeof blogTags.$inferSelect): BlogTagRecord {
  return {
    id: row.id,
    siteSlug: row.siteSlug,
    slug: row.slug,
    name: row.name,
    description: row.description,
    kind: row.kind,
  };
}

function toPage(row: typeof legalPages.$inferSelect): FixedPageRecord {
  return {
    id: row.id,
    siteSlug: row.siteSlug,
    kind: row.kind as FixedPageKind,
    title: row.title,
    body: row.body,
    status: row.status as FixedPageStatus,
    deletedAt: row.deletedAt,
    updatedAt: row.updatedAt,
  };
}

/** 記事 1 本ぶんの部品とタグを読み揃える。3 回の問い合わせを 1 か所にまとめる。 */
async function loadDetail(db: DrizzleD1, row: BlogArticleRow): Promise<BlogArticleDetail> {
  // `articles.workspace_id` は旧AI記事のぶんが null のままなので、子表側の
  // 空文字と突き合わせる。**null と '' を混ぜて持たない**ように、子表は
  // notNull default '' で揃えてある（`drizzle/0033_tenant_scope_blog_children.sql`）。
  const rowWorkspaceId = row.workspaceId ?? "";
  const blocks = await db
    .select()
    .from(blogArticleBlocks)
    .where(
      and(
        eq(blogArticleBlocks.workspaceId, rowWorkspaceId),
        eq(blogArticleBlocks.articleId, row.id),
      ),
    )
    .orderBy(asc(blogArticleBlocks.position));
  const tags = await db
    .select()
    .from(blogArticleTags)
    .where(
      and(eq(blogArticleTags.workspaceId, rowWorkspaceId), eq(blogArticleTags.articleId, row.id)),
    );
  return {
    article: toArticle(row),
    blocks: blocks.map((b) => ({
      id: b.id,
      kind: b.kind as ArticleBlockKind,
      heading: b.heading,
      body: b.body,
      position: b.position,
    })),
    tagIds: tags.map((t) => t.tagId),
  };
}

function ownedResourceNotFound(what: string) {
  return err(
    domainError("NOT_FOUND", `${what}が見つかりません。`, {
      suggestedAction: "一覧から選び直してください。",
    }),
  );
}

async function ownsUniqueSiteSlug(
  db: DrizzleD1,
  workspaceId: string,
  siteSlug: string,
): Promise<boolean> {
  const rows = await db
    .select({ workspaceId: siteNetworkNodes.workspaceId })
    .from(siteNetworkNodes)
    .where(and(eq(siteNetworkNodes.siteSlug, siteSlug), isNull(siteNetworkNodes.deletedAt)))
    .limit(2);
  return rows.length === 1 && rows[0]?.workspaceId === workspaceId;
}

type PublicSiteIdentity = {
  readonly workspaceId: string;
  readonly siteSlug: string;
  readonly blueprint: PublicSiteReader["blueprint"];
};

/**
 * 公開 URL を、既存 SiteRepository の正本から tenant identity へ一度だけ解決する。
 * 同じ slug のサイト網が複数 tenant にあれば、どちらを出すか推測せず閉じる。
 */
async function resolvePublicSiteIdentity(
  db: DrizzleD1,
  sites: EditorialSiteRepositoryPort,
  siteSlug: string,
): PortResult<PublicSiteIdentity | null> {
  const site = await sites.findBySlug(siteSlug);
  if (!site.ok) return err(site.error);
  if (site.value === null) return ok(null);
  const rows = await db
    .select({
      workspaceId: siteNetworkNodes.workspaceId,
      status: siteNetworkNodes.status,
      deletedAt: siteNetworkNodes.deletedAt,
    })
    .from(siteNetworkNodes)
    .where(eq(siteNetworkNodes.siteSlug, siteSlug))
    .limit(2);
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row === undefined ||
    row.workspaceId !== site.value.workspaceId ||
    row.status !== "active" ||
    row.deletedAt !== null
  ) {
    return ok(null);
  }
  const { workspaceId: _workspaceId, ...blueprint } = site.value;
  return ok({ workspaceId: row.workspaceId, siteSlug, blueprint });
}

export function createD1BlogOpsRepository(db: DrizzleD1): BlogOpsRepositoryPort {
  return {
    async listNetwork(workspaceId): PortResult<readonly SiteNetworkRecord[]> {
      try {
        const rows = await db
          .select()
          .from(siteNetworkNodes)
          .where(
            and(eq(siteNetworkNodes.workspaceId, workspaceId), isNull(siteNetworkNodes.deletedAt)),
          )
          .orderBy(asc(siteNetworkNodes.position));
        return ok(rows.map(toNetwork));
      } catch (cause) {
        return storageFailure("サイト網の読み取り", cause);
      }
    },

    async listDeletedNetwork(workspaceId) {
      try {
        const rows = await db
          .select()
          .from(siteNetworkNodes)
          .where(
            and(
              eq(siteNetworkNodes.workspaceId, workspaceId),
              isNotNull(siteNetworkNodes.deletedAt),
            ),
          )
          .orderBy(desc(siteNetworkNodes.deletedAt));
        return ok(rows.map(toDeletedNetwork));
      } catch (cause) {
        return storageFailure("削除済みサイト網の読み取り", cause);
      }
    },

    async findNetworkNode(workspaceId, nodeId): PortResult<SiteNetworkRecord | null> {
      try {
        const rows = await db
          .select()
          .from(siteNetworkNodes)
          .where(
            and(
              eq(siteNetworkNodes.workspaceId, workspaceId),
              eq(siteNetworkNodes.id, nodeId),
              isNull(siteNetworkNodes.deletedAt),
            ),
          )
          .limit(1);
        return ok(rows[0] ? toNetwork(rows[0]) : null);
      } catch (cause) {
        return storageFailure("サイト網の読み取り", cause);
      }
    },

    async saveNetworkNode(workspaceId, input: SaveSiteNetworkInput): PortResult<true> {
      try {
        const existing = await db
          .select({
            workspaceId: siteNetworkNodes.workspaceId,
            siteSlug: siteNetworkNodes.siteSlug,
            deletedAt: siteNetworkNodes.deletedAt,
          })
          .from(siteNetworkNodes)
          .where(eq(siteNetworkNodes.id, input.id))
          .limit(1);
        const current = existing[0];
        if (
          current !== undefined &&
          (current.workspaceId !== workspaceId ||
            current.siteSlug !== input.siteSlug ||
            current.deletedAt !== null)
        ) {
          return ownedResourceNotFound("サイト網");
        }

        if (current === undefined) {
          await db.insert(siteNetworkNodes).values({ ...input, workspaceId, updatedAt: new Date() });
        } else {
          const updated = await db
            .update(siteNetworkNodes)
            .set({
              role: input.role,
              parentSlug: input.parentSlug,
              name: input.name,
              oneLine: input.oneLine,
              position: input.position,
              status: input.status,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(siteNetworkNodes.workspaceId, workspaceId),
                eq(siteNetworkNodes.id, input.id),
              ),
            )
            .returning({ id: siteNetworkNodes.id });
          if (updated.length === 0) return ownedResourceNotFound("サイト網");
        }
        return ok(true);
      } catch (cause) {
        return storageFailure("サイト網の保存", cause);
      }
    },

    async deleteNetworkNode(workspaceId, nodeId, deletedAt): PortResult<true> {
      try {
        const updated = await db
          .update(siteNetworkNodes)
          .set({ deletedAt, updatedAt: deletedAt })
          .where(
            and(
              eq(siteNetworkNodes.workspaceId, workspaceId),
              eq(siteNetworkNodes.id, nodeId),
              isNull(siteNetworkNodes.deletedAt),
            ),
          )
          .returning({ id: siteNetworkNodes.id });
        if (updated.length === 0) return ownedResourceNotFound("サイト網");
        return ok(true);
      } catch (cause) {
        return storageFailure("サイト網からの削除", cause);
      }
    },

    async restoreNetworkNode(workspaceId, nodeId, restoredAt): PortResult<true> {
      try {
        const updated = await db
          .update(siteNetworkNodes)
          .set({ deletedAt: null, updatedAt: restoredAt })
          .where(
            and(
              eq(siteNetworkNodes.workspaceId, workspaceId),
              eq(siteNetworkNodes.id, nodeId),
              isNotNull(siteNetworkNodes.deletedAt),
            ),
          )
          .returning({ id: siteNetworkNodes.id });
        if (updated.length === 0) return ownedResourceNotFound("削除済みサイト網");
        return ok(true);
      } catch (cause) {
        return storageFailure("サイト網の復元", cause);
      }
    },

    async listLayoutSlots(workspaceId, siteSlug): PortResult<readonly BlogLayoutSlotRecord[]> {
      try {
        const rows = await db
          .select()
          .from(blogLayoutSlots)
          .where(
            and(eq(blogLayoutSlots.workspaceId, workspaceId), eq(blogLayoutSlots.siteSlug, siteSlug)),
          )
          .orderBy(asc(blogLayoutSlots.position));
        return ok(rows.map(toSlot));
      } catch (cause) {
        return storageFailure("枠の設定の読み取り", cause);
      }
    },

    async saveLayoutSlot(workspaceId, input): PortResult<true> {
      try {
        const [current] = await db
          .select({
            workspaceId: blogLayoutSlots.workspaceId,
            siteSlug: blogLayoutSlots.siteSlug,
          })
          .from(blogLayoutSlots)
          .where(eq(blogLayoutSlots.id, input.id))
          .limit(1);
        if (
          current !== undefined &&
          (current.workspaceId !== workspaceId || current.siteSlug !== input.siteSlug)
        ) {
          return ownedResourceNotFound("枠の設定");
        }
        if (current === undefined) {
          await db.insert(blogLayoutSlots).values({ ...input, workspaceId });
        } else {
          const updated = await db
            .update(blogLayoutSlots)
            .set({
              title: input.title,
              body: input.body,
              position: input.position,
              enabled: input.enabled,
            })
            .where(
              and(
                eq(blogLayoutSlots.workspaceId, workspaceId),
                eq(blogLayoutSlots.siteSlug, input.siteSlug),
                eq(blogLayoutSlots.id, input.id),
              ),
            )
            .returning({ id: blogLayoutSlots.id });
          if (updated.length === 0) return ownedResourceNotFound("枠の設定");
        }
        return ok(true);
      } catch (cause) {
        return storageFailure("枠の設定の保存", cause);
      }
    },

    async listLayoutBands(workspaceId, siteSlug): PortResult<readonly BlogLayoutBandRecord[]> {
      try {
        const rows = await db
          .select()
          .from(blogLayoutBands)
          .where(
            and(eq(blogLayoutBands.workspaceId, workspaceId), eq(blogLayoutBands.siteSlug, siteSlug)),
          )
          .orderBy(asc(blogLayoutBands.position));
        return ok(rows.map(toBand));
      } catch (cause) {
        return storageFailure("帯の設定の読み取り", cause);
      }
    },

    async saveLayoutBand(workspaceId, input): PortResult<true> {
      try {
        const [current] = await db
          .select({
            workspaceId: blogLayoutBands.workspaceId,
            siteSlug: blogLayoutBands.siteSlug,
          })
          .from(blogLayoutBands)
          .where(eq(blogLayoutBands.id, input.id))
          .limit(1);
        if (
          current !== undefined &&
          (current.workspaceId !== workspaceId || current.siteSlug !== input.siteSlug)
        ) {
          return ownedResourceNotFound("帯の設定");
        }
        if (current === undefined) {
          await db.insert(blogLayoutBands).values({ ...input, workspaceId });
        } else {
          const updated = await db
            .update(blogLayoutBands)
            .set({
              title: input.title,
              enabled: input.enabled,
              position: input.position,
              itemLimit: input.itemLimit,
            })
            .where(
              and(
                eq(blogLayoutBands.workspaceId, workspaceId),
                eq(blogLayoutBands.siteSlug, input.siteSlug),
                eq(blogLayoutBands.id, input.id),
              ),
            )
            .returning({ id: blogLayoutBands.id });
          if (updated.length === 0) return ownedResourceNotFound("帯の設定");
        }
        return ok(true);
      } catch (cause) {
        return storageFailure("帯の設定の保存", cause);
      }
    },

    async listDeliveryParts(workspaceId, siteSlug): PortResult<readonly BlogDeliveryPartRecord[]> {
      try {
        const rows = await db
          .select()
          .from(blogDeliveryParts)
          .where(
            siteSlug === null
              ? eq(blogDeliveryParts.workspaceId, workspaceId)
              : and(
                  eq(blogDeliveryParts.workspaceId, workspaceId),
                  eq(blogDeliveryParts.siteSlug, siteSlug),
                ),
          )
          .orderBy(asc(blogDeliveryParts.position));
        return ok(rows.map(toPart));
      } catch (cause) {
        return storageFailure("配信部品の読み取り", cause);
      }
    },

    async saveDeliveryPart(workspaceId, input): PortResult<true> {
      try {
        const [current] = await db
          .select({
            workspaceId: blogDeliveryParts.workspaceId,
            siteSlug: blogDeliveryParts.siteSlug,
          })
          .from(blogDeliveryParts)
          .where(eq(blogDeliveryParts.id, input.id))
          .limit(1);
        if (
          current !== undefined &&
          (current.workspaceId !== workspaceId || current.siteSlug !== input.siteSlug)
        ) {
          return ownedResourceNotFound("配信部品");
        }
        if (current === undefined) {
          await db.insert(blogDeliveryParts).values({ ...input, workspaceId });
        } else {
          const updated = await db
            .update(blogDeliveryParts)
            .set({ enabled: input.enabled, note: input.note, position: input.position })
            .where(
              and(
                eq(blogDeliveryParts.workspaceId, workspaceId),
                eq(blogDeliveryParts.siteSlug, input.siteSlug),
                eq(blogDeliveryParts.id, input.id),
              ),
            )
            .returning({ id: blogDeliveryParts.id });
          if (updated.length === 0) return ownedResourceNotFound("配信部品");
        }
        return ok(true);
      } catch (cause) {
        return storageFailure("配信部品の保存", cause);
      }
    },

    async listDeliverySnapshots(
      workspaceId,
      siteSlug,
    ): PortResult<readonly BlogDeliverySnapshotRecord[]> {
      try {
        const rows = await db
          .select()
          .from(blogDeliverySnapshots)
          .where(
            siteSlug === null
              ? eq(blogDeliverySnapshots.workspaceId, workspaceId)
              : and(
                  eq(blogDeliverySnapshots.workspaceId, workspaceId),
                  eq(blogDeliverySnapshots.siteSlug, siteSlug),
                ),
          )
          .orderBy(desc(blogDeliverySnapshots.checkedAt));
        return ok(
          rows.map((row) => ({
            id: row.id,
            siteSlug: row.siteSlug,
            part: row.part,
            ok: row.ok,
            detail: row.detail,
            checkedAt: row.checkedAt,
          })),
        );
      } catch (cause) {
        return storageFailure("配信の点検結果の読み取り", cause);
      }
    },

    async saveDeliverySnapshot(workspaceId, input): PortResult<true> {
      try {
        /*
          **`onConflictDoUpdate` を付けない。**点検は積むもので、
          同じ id が二度来るのは呼ぶ側が id を作り損ねたときだけ。
          そこで黙って上書きすると、履歴が 1 件ずつ静かに消える。
        */
        await db.insert(blogDeliverySnapshots).values({ ...input, workspaceId });
        return ok(true);
      } catch (cause) {
        return storageFailure("配信の点検結果の保存", cause);
      }
    },

    async listArticles(workspaceId, siteSlug): PortResult<readonly BlogArticle[]> {
      try {
        const where =
          siteSlug === null
            ? and(eq(blogArticles.workspaceId, workspaceId), isNull(blogArticles.deletedAt))
            : and(
                eq(blogArticles.workspaceId, workspaceId),
                eq(blogArticles.siteSlug, siteSlug),
                isNull(blogArticles.deletedAt),
              );
        const rows = await db
          .select()
          .from(blogArticles)
          .where(where)
          .orderBy(desc(blogArticles.updatedAt));
        return ok(rows.map(toArticle));
      } catch (cause) {
        return storageFailure("記事の読み取り", cause);
      }
    },

    async listDeletedArticles(workspaceId, siteSlug) {
      try {
        const where =
          siteSlug === null
            ? and(eq(blogArticles.workspaceId, workspaceId), isNotNull(blogArticles.deletedAt))
            : and(
                eq(blogArticles.workspaceId, workspaceId),
                eq(blogArticles.siteSlug, siteSlug),
                isNotNull(blogArticles.deletedAt),
              );
        const rows = await db
          .select()
          .from(blogArticles)
          .where(where)
          .orderBy(desc(blogArticles.deletedAt));
        return ok(await Promise.all(rows.map((row) => loadDeletedDetail(db, row))));
      } catch (cause) {
        return storageFailure("削除済み記事の読み取り", cause);
      }
    },

    async findArticle(workspaceId, articleId): PortResult<BlogArticleDetail | null> {
      try {
        const rows = await db
          .select()
          .from(blogArticles)
          .where(
            and(
              eq(blogArticles.workspaceId, workspaceId),
              eq(blogArticles.id, articleId),
              isNull(blogArticles.deletedAt),
            ),
          )
          .limit(1);
        const row = rows[0];
        if (row === undefined) return ok(null);
        return ok(await loadDetail(db, row));
      } catch (cause) {
        return storageFailure("記事の読み取り", cause);
      }
    },

    async listArticleBlockKinds(workspaceId, articleIds) {
      try {
        if (articleIds.length === 0) return ok({});
        const owned = await db
          .select({ id: blogArticles.id })
          .from(blogArticles)
          .where(
            and(
              eq(blogArticles.workspaceId, workspaceId),
              inArray(blogArticles.id, [...articleIds]),
              isNull(blogArticles.deletedAt),
            ),
          );
        const ownedIds = owned.map((row) => row.id);
        if (ownedIds.length === 0) return ok({});
        const rows = await db
          .select({ articleId: blogArticleBlocks.articleId, kind: blogArticleBlocks.kind })
          .from(blogArticleBlocks)
          .where(
            and(
              eq(blogArticleBlocks.workspaceId, workspaceId),
              inArray(blogArticleBlocks.articleId, ownedIds),
            ),
          );
        const result: Record<string, ArticleBlockKind[]> = Object.fromEntries(
          ownedIds.map((id) => [id, []]),
        );
        for (const row of rows) result[row.articleId]?.push(row.kind as ArticleBlockKind);
        return ok(result);
      } catch (cause) {
        return storageFailure("記事部品の一括読み取り", cause);
      }
    },

    async saveArticle(workspaceId, input: SaveBlogArticleInput): PortResult<true> {
      try {
        if (new Set(input.tagIds).size !== input.tagIds.length) {
          return err(validationError("同じタグを記事へ複数回付けることはできません。", "tagIds"));
        }
        if (input.tagIds.length > 0) {
          const scopedTags = await db
            .select({
              id: blogTags.id,
              workspaceId: blogTags.workspaceId,
              siteSlug: blogTags.siteSlug,
            })
            .from(blogTags)
            .where(inArray(blogTags.id, [...input.tagIds]));
          if (
            scopedTags.length !== input.tagIds.length ||
            scopedTags.some(
              (tag) => tag.workspaceId !== workspaceId || tag.siteSlug !== input.siteSlug,
            )
          ) {
            return err(
              validationError(
                "記事と同じワークスペース・サイトにあるタグだけを指定してください。",
                "tagIds",
              ),
            );
          }
        }

        const existing = await db
          .select({
            workspaceId: blogArticles.workspaceId,
            siteSlug: blogArticles.siteSlug,
            deletedAt: blogArticles.deletedAt,
            revision: blogArticles.revision,
            publicCategorySlug: blogArticles.publicCategorySlug,
          })
          .from(blogArticles)
          .where(eq(blogArticles.id, input.id))
          .limit(1);
        const current = existing[0];
        if (
          current !== undefined &&
          (current.workspaceId !== workspaceId ||
            current.siteSlug !== input.siteSlug ||
            current.deletedAt !== null)
        ) {
          return ownedResourceNotFound("記事");
        }

        const [publicRows, tombstoneRows] = await Promise.all([
          db
            .select({
              workspaceId: publishedArticles.workspaceId,
              sourceArticleId: publishedArticles.sourceArticleId,
            })
            .from(publishedArticles)
            .where(
              and(
                eq(publishedArticles.siteSlug, input.siteSlug),
                eq(publishedArticles.slug, input.slug),
              ),
            )
            .limit(1),
          db
            .select({ workspaceId: publishedArticleTombstones.workspaceId })
            .from(publishedArticleTombstones)
            .where(
              and(
                eq(publishedArticleTombstones.siteSlug, input.siteSlug),
                eq(publishedArticleTombstones.slug, input.slug),
              ),
            )
            .limit(1),
        ]);
        const publicRow = publicRows[0];
        const tombstone = tombstoneRows[0];
        if (
          input.status === "published" &&
          ((publicRow !== undefined &&
            (publicRow.workspaceId !== workspaceId || publicRow.sourceArticleId !== input.id)) ||
            (tombstone !== undefined && tombstone.workspaceId !== workspaceId))
        ) {
          return err(
            domainError("CONFLICT", "この URL には別の公開記事があります。", {
              field: "slug",
              suggestedAction: "公開済み記事を確認し、別の URL 名を使ってください。",
            }),
          );
        }
        if (input.status === "published" && input.publishedAt === null) {
          return err(validationError("公開日時の無い記事は公開できません。", "publishedAt"));
        }
        const categorySlug = input.categorySlug ?? current?.publicCategorySlug ?? null;
        const blueprintRows =
          categorySlug === null
            ? []
            : await db
                .select({ blueprintJson: siteBlueprints.blueprintJson })
                .from(siteBlueprints)
                .where(
                  and(
                    eq(siteBlueprints.workspaceId, workspaceId),
                    eq(siteBlueprints.slug, input.siteSlug),
                  ),
                )
                .limit(1);
        const blueprint =
          blueprintRows[0] === undefined
            ? null
            : (JSON.parse(blueprintRows[0].blueprintJson) as {
                readonly categories?: readonly { readonly slug?: string }[];
              });
        const categoryBelongsToSite =
          categorySlug !== null &&
          (blueprint?.categories?.some((category) => category.slug === categorySlug) === true ||
            (current?.publicCategorySlug === UNCATEGORIZED_ARTICLE_CATEGORY.slug &&
              categorySlug === UNCATEGORIZED_ARTICLE_CATEGORY.slug));
        if (categorySlug !== null && !categoryBelongsToSite) {
          return err(
            validationError("カテゴリをブログの設計図から選んでください。", "categorySlug"),
          );
        }
        if (input.status === "published" && categorySlug === null) {
          return err(validationError("公開するカテゴリを選んでください。", "categorySlug"));
        }
        if (input.status === "published" && input.authorName.trim() === "") {
          return err(validationError("公開記事の書き手が入っていません。", "authorName"));
        }

        const projectionStatements: BatchItem<"sqlite">[] = [];
        if (input.status === "published" && input.publishedAt !== null) {
          projectionStatements.push(
            ...publishedArticleSaveStatements(
              db,
              workspaceId,
              projectBlogArticle({
                id: input.id,
                siteSlug: input.siteSlug,
                slug: input.slug,
                type: ARTICLE_TYPE_BY_TEMPLATE[input.template],
                title: input.title,
                lead: input.lead,
                authorName: input.authorName,
                publishedAt: input.publishedAt,
                updatedAt: input.updatedAt,
                categorySlug: categorySlug ?? "",
                blocks: input.blocks,
              }),
              input.id,
            ),
          );
        } else if (publicRow?.sourceArticleId === input.id) {
          projectionStatements.push(
            ...sourcedPublishedArticleUnpublishStatements(
              db,
              workspaceId,
              input.siteSlug,
              input.slug,
              input.id,
              input.updatedAt,
            ),
          );
        }

        let articleMutation;
        let casGuard = null;
        if (current === undefined) {
          articleMutation = db.insert(blogArticles).values({
            id: input.id,
            workspaceId,
            siteSlug: input.siteSlug,
            slug: input.slug,
            type: ARTICLE_TYPE_BY_TEMPLATE[input.template],
            template: input.template,
            title: input.title,
            lead: input.lead,
            status: input.status,
            publicCategorySlug: categorySlug,
            authorName: input.authorName,
            publishedAt: input.publishedAt,
            updatedAt: input.updatedAt,
            revision: 1,
          });
        } else {
          const expectedRevision = input.expectedRevision ?? current.revision;
          if (expectedRevision !== current.revision) {
            return err(
              domainError("CONFLICT", "ほかの人が先にこの記事を保存しました。", {
                field: "revision",
                suggestedAction: "最新版を開き、端末下書きとの差分を確認してください。",
              }),
            );
          }
          const nextRevision = current.revision + 1;
          const saveToken = crypto.randomUUID();
          articleMutation = db
            .update(blogArticles)
            .set({
              template: input.template,
              type: ARTICLE_TYPE_BY_TEMPLATE[input.template],
              title: input.title,
              lead: input.lead,
              status: input.status,
              publicCategorySlug: categorySlug,
              authorName: input.authorName,
              publishedAt: input.publishedAt,
              updatedAt: input.updatedAt,
              revision: nextRevision,
              saveToken,
            })
            .where(
              and(
                eq(blogArticles.workspaceId, workspaceId),
                eq(blogArticles.siteSlug, input.siteSlug),
                eq(blogArticles.id, input.id),
                eq(blogArticles.revision, expectedRevision),
                isNull(blogArticles.deletedAt),
              ),
            );

          // CAS update が 0 件だった場合だけ、同じ主キーを INSERT して batch を失敗させる。
          // revision だけでは「同じ版を読んだ2保存」を区別できないため、勝者固有の
          // saveToken まで一致したときだけ 0 行 SELECT になる。失敗時は本体・部品・タグを
          // まとめて rollback でき、古い画面が新しい本文の子要素だけ消すこともない。
          casGuard = db.insert(blogArticles).select(
            db
              .select({
                id: blogArticles.id,
                slug: blogArticles.slug,
                workspaceId: blogArticles.workspaceId,
                siteSlug: blogArticles.siteSlug,
                template: blogArticles.template,
                type: blogArticles.type,
                title: blogArticles.title,
                summary: blogArticles.summary,
                lead: blogArticles.lead,
                status: blogArticles.status,
                categoryId: blogArticles.categoryId,
                publicCategorySlug: blogArticles.publicCategorySlug,
                disclosureId: blogArticles.disclosureId,
                ownerId: blogArticles.ownerId,
                authorName: blogArticles.authorName,
                publishedAt: blogArticles.publishedAt,
                deletedAt: blogArticles.deletedAt,
                updatedAt: blogArticles.updatedAt,
                revision: blogArticles.revision,
                saveToken: blogArticles.saveToken,
                testedAt: blogArticles.testedAt,
                nextReviewAt: blogArticles.nextReviewAt,
                targetAudience: blogArticles.targetAudience,
                suitableFor: blogArticles.suitableFor,
                notSuitableFor: blogArticles.notSuitableFor,
                createdAt: blogArticles.createdAt,
              })
              .from(blogArticles)
              .where(
                and(
                  eq(blogArticles.workspaceId, workspaceId),
                  eq(blogArticles.siteSlug, input.siteSlug),
                  eq(blogArticles.id, input.id),
                  or(isNull(blogArticles.saveToken), ne(blogArticles.saveToken, saveToken)),
                ),
              ),
          );
        }
        // 子表も作業場所で絞る。記事 ID だけで消すと、他所の作業場所の記事 ID を
        // 渡された時に消せてしまう。ID が推測しにくいことを守りにしない。
        const deleteBlocks = db
          .delete(blogArticleBlocks)
          .where(
            and(
              eq(blogArticleBlocks.workspaceId, workspaceId),
              eq(blogArticleBlocks.articleId, input.id),
            ),
          );
        const deleteTags = db
          .delete(blogArticleTags)
          .where(
            and(
              eq(blogArticleTags.workspaceId, workspaceId),
              eq(blogArticleTags.articleId, input.id),
            ),
          );
        const insertBlocks =
          input.blocks.length === 0
            ? null
            : db.insert(blogArticleBlocks).values(
                input.blocks.map((b) => ({
                  id: b.id,
                  workspaceId,
                  articleId: input.id,
                  kind: b.kind,
                  heading: b.heading,
                  body: b.body,
                  position: b.position,
                })),
              );
        const insertTags =
          input.tagIds.length === 0
            ? null
            : db
                .insert(blogArticleTags)
                .values(input.tagIds.map((tagId) => ({ workspaceId, articleId: input.id, tagId })));

        const batch: BatchItem<"sqlite">[] = [articleMutation];
        if (casGuard !== null) batch.push(casGuard);
        batch.push(deleteBlocks);
        if (insertBlocks !== null) batch.push(insertBlocks);
        batch.push(deleteTags);
        if (insertTags !== null) batch.push(insertTags);
        batch.push(...projectionStatements);
        await db.batch(batch as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
        return ok(true);
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message.toLowerCase() : "";
        if (
          reason.includes("unique constraint failed: articles.id") ||
          reason.includes(
            "unique constraint failed: articles.workspace_id, articles.site_slug, articles.slug",
          )
        ) {
          return err(
            domainError("CONFLICT", "ほかの人が先にこの記事を保存しました。", {
              field: "revision",
              suggestedAction: "最新版を開き、端末下書きとの差分を確認してください。",
            }),
          );
        }
        if (
          reason.includes("published_article_source_conflict") ||
          reason.includes("published_article_url_state_conflict") ||
          reason.includes(
            "unique constraint failed: published_articles.site_slug, published_articles.slug",
          )
        ) {
          return err(
            domainError("CONFLICT", "この URL には別の公開記事があります。", {
              field: "slug",
              suggestedAction: "公開済み記事を確認し、別の URL 名を使ってください。",
            }),
          );
        }
        return storageFailure("記事の保存", cause);
      }
    },

    async deleteArticle(workspaceId, articleId, deletedAt): PortResult<true> {
      try {
        const articles = await db
          .select({ siteSlug: blogArticles.siteSlug, slug: blogArticles.slug })
          .from(blogArticles)
          .where(
            and(
              eq(blogArticles.workspaceId, workspaceId),
              eq(blogArticles.id, articleId),
              isNull(blogArticles.deletedAt),
            ),
          )
          .limit(1);
        const article = articles[0];
        if (article?.siteSlug === null || article === undefined) return ownedResourceNotFound("記事");
        const publicRows = await db
          .select({ sourceArticleId: publishedArticles.sourceArticleId })
          .from(publishedArticles)
          .where(
            and(
              eq(publishedArticles.workspaceId, workspaceId),
              eq(publishedArticles.siteSlug, article.siteSlug),
              eq(publishedArticles.slug, article.slug),
            ),
          )
          .limit(1);
        const mutation = db
          .update(blogArticles)
          .set({ deletedAt, updatedAt: deletedAt })
          .where(
            and(
              eq(blogArticles.workspaceId, workspaceId),
              eq(blogArticles.id, articleId),
              isNull(blogArticles.deletedAt),
            ),
          )
          .returning({ id: blogArticles.id });
        const deleted =
          publicRows[0]?.sourceArticleId === articleId
            ? (
                await db.batch([
                  mutation,
                  ...sourcedPublishedArticleUnpublishStatements(
                    db,
                    workspaceId,
                    article.siteSlug,
                    article.slug,
                    articleId,
                    deletedAt,
                  ),
                ] as const)
              )[0]
            : await mutation;
        if (deleted.length === 0) return ownedResourceNotFound("記事");
        return ok(true);
      } catch (cause) {
        return storageFailure("記事の削除", cause);
      }
    },

    async restoreArticle(workspaceId, articleId, restoredAt): PortResult<true> {
      try {
        const rows = await db
          .select()
          .from(blogArticles)
          .where(
            and(
              eq(blogArticles.workspaceId, workspaceId),
              eq(blogArticles.id, articleId),
              isNotNull(blogArticles.deletedAt),
            ),
          )
          .limit(1);
        const row = rows[0];
        if (row === undefined) return ownedResourceNotFound("削除済み記事");

        const mutation = db
          .update(blogArticles)
          .set({ deletedAt: null, updatedAt: restoredAt })
          .where(
            and(
              eq(blogArticles.workspaceId, workspaceId),
              eq(blogArticles.id, articleId),
              isNotNull(blogArticles.deletedAt),
            ),
          )
          .returning({ id: blogArticles.id });
        if (row.status !== "published") {
          const restored = await mutation;
          if (restored.length === 0) return ownedResourceNotFound("削除済み記事");
          return ok(true);
        }

        if (
          row.siteSlug === null ||
          row.template === null ||
          row.publishedAt === null ||
          row.publicCategorySlug === null
        ) {
          return err(
            domainError("CONFLICT", "公開記事を同じ内容で戻すための記録が足りません。", {
              suggestedAction: "カテゴリと公開日時を修復してから、もう一度戻してください。",
            }),
          );
        }
        const [tombstoneRows, blueprintRows, detail] = await Promise.all([
          db
            .select({ workspaceId: publishedArticleTombstones.workspaceId })
            .from(publishedArticleTombstones)
            .where(
              and(
                eq(publishedArticleTombstones.siteSlug, row.siteSlug),
                eq(publishedArticleTombstones.slug, row.slug),
              ),
            )
            .limit(1),
          db
            .select({ blueprintJson: siteBlueprints.blueprintJson })
            .from(siteBlueprints)
            .where(
              and(
                eq(siteBlueprints.workspaceId, workspaceId),
                eq(siteBlueprints.slug, row.siteSlug),
              ),
            )
            .limit(1),
          loadDeletedDetail(db, row),
        ]);
        if (tombstoneRows[0]?.workspaceId !== String(workspaceId)) {
          return err(
            domainError("CONFLICT", "元の公開URLを安全に確認できないため戻せません。", {
              suggestedAction: "公開記事の取り下げ記録を確認してください。",
            }),
          );
        }
        const blueprint =
          blueprintRows[0] === undefined
            ? null
            : (JSON.parse(blueprintRows[0].blueprintJson) as {
                readonly categories?: readonly { readonly slug?: string }[];
              });
        const categoryStillValid =
          row.publicCategorySlug === UNCATEGORIZED_ARTICLE_CATEGORY.slug ||
          blueprint?.categories?.some(
            (category) => category.slug === row.publicCategorySlug,
          ) === true;
        if (!categoryStillValid) {
          return err(
            validationError(
              "元の公開カテゴリがブログの設計図に無いため戻せません。",
              "categorySlug",
            ),
          );
        }

        const restoredArticle = projectBlogArticle({
          id: row.id,
          siteSlug: row.siteSlug,
          slug: row.slug,
          type: ARTICLE_TYPE_BY_TEMPLATE[row.template as ArticleTemplate],
          title: row.title,
          lead: row.lead,
          authorName: row.authorName,
          categorySlug: row.publicCategorySlug,
          publishedAt: row.publishedAt,
          updatedAt: restoredAt,
          blocks: detail.blocks,
        });
        const results = await db.batch([
          mutation,
          ...publishedArticleSaveStatements(
            db,
            workspaceId,
            restoredArticle,
            row.id,
          ),
        ] as const);
        if (results[0].length === 0) return ownedResourceNotFound("削除済み記事");
        return ok(true);
      } catch (cause) {
        return storageFailure("記事の復元", cause);
      }
    },

    async listTags(workspaceId, siteSlug): PortResult<readonly BlogTagRecord[]> {
      try {
        const rows = await db
          .select()
          .from(blogTags)
          .where(and(eq(blogTags.workspaceId, workspaceId), eq(blogTags.siteSlug, siteSlug)))
          .orderBy(asc(blogTags.slug));
        return ok(rows.map(toTag));
      } catch (cause) {
        return storageFailure("タグの読み取り", cause);
      }
    },

    async saveTag(workspaceId, input): PortResult<true> {
      try {
        const existing = await db
          .select({ workspaceId: blogTags.workspaceId, siteSlug: blogTags.siteSlug })
          .from(blogTags)
          .where(eq(blogTags.id, input.id))
          .limit(1);
        const current = existing[0];
        if (
          current !== undefined &&
          (current.workspaceId !== workspaceId || current.siteSlug !== input.siteSlug)
        ) {
          return ownedResourceNotFound("タグ");
        }

        if (current === undefined) {
          await db.insert(blogTags).values({ ...input, workspaceId });
        } else {
          const updated = await db
            .update(blogTags)
            .set({
              slug: input.slug,
              name: input.name,
              description: input.description,
              kind: input.kind,
            })
            .where(and(eq(blogTags.workspaceId, workspaceId), eq(blogTags.id, input.id)))
            .returning({ id: blogTags.id });
          if (updated.length === 0) return ownedResourceNotFound("タグ");
        }
        return ok(true);
      } catch (cause) {
        return storageFailure("タグの保存", cause);
      }
    },

    async deleteTag(workspaceId, tagId): PortResult<true> {
      try {
        const deleted = await db
          .delete(blogTags)
          .where(and(eq(blogTags.workspaceId, workspaceId), eq(blogTags.id, tagId)))
          .returning({ id: blogTags.id });
        if (deleted.length === 0) return ownedResourceNotFound("タグ");
        return ok(true);
      } catch (cause) {
        return storageFailure("タグの削除", cause);
      }
    },

    /*
     * 固定ページは `workspace_id` を持ち、そのうえで `site_slug` の帰属も確かめる。
     *
     * 列だけでは足りない。`site_slug` は `site_blueprints` の索引 1 本が一意性を
     * 支えているだけで、作業場所ごとに slug を再利用したくなった日に崩れる。
     * 逆に slug の確認だけでも足りない。**1 本のクエリが単体で作業場所に絞れること**を
     * 表の側でも持たせる（`tests/architecture/tenant-scoped-schema.test.ts`）。
     * 同名のブログが複数 workspace にあるときは、帰属先を決められないので見せない。
     */
    async listFixedPages(workspaceId, siteSlug): PortResult<readonly FixedPageRecord[]> {
      try {
        // 親サイトがこの workspace のものでなければ、子の存在も漏らさない。
        if (!(await ownsUniqueSiteSlug(db, workspaceId, siteSlug))) return ok([]);
        const rows = await db
          .select()
          .from(legalPages)
          .where(
            and(
              eq(legalPages.workspaceId, workspaceId),
              eq(legalPages.siteSlug, siteSlug),
              inArray(legalPages.kind, [...FIXED_PAGE_KINDS]),
              isNull(legalPages.deletedAt),
            ),
          );
        return ok(rows.map(toPage));
      } catch (cause) {
        return storageFailure("固定ページの読み取り", cause);
      }
    },

    async listDeletedFixedPages(workspaceId, siteSlug): PortResult<readonly FixedPageRecord[]> {
      try {
        if (!(await ownsUniqueSiteSlug(db, workspaceId, siteSlug))) return ok([]);
        const rows = await db
          .select()
          .from(legalPages)
          .where(
            and(
              eq(legalPages.workspaceId, workspaceId),
              eq(legalPages.siteSlug, siteSlug),
              inArray(legalPages.kind, [...FIXED_PAGE_KINDS]),
              isNotNull(legalPages.deletedAt),
            ),
          );
        return ok(rows.map(toPage));
      } catch (cause) {
        return storageFailure("削除済み固定ページの読み取り", cause);
      }
    },

    async saveFixedPage(workspaceId, input): PortResult<true> {
      try {
        if (!(await ownsUniqueSiteSlug(db, workspaceId, input.siteSlug))) {
          return ownedResourceNotFound("固定ページ");
        }
        // id が既に別サイトの行を指すなら、upsert でその本文を書き換えない。
        const existing = await db
          .select({ siteSlug: legalPages.siteSlug, workspaceId: legalPages.workspaceId })
          .from(legalPages)
          .where(eq(legalPages.id, input.id))
          .limit(1);
        if (
          existing[0] !== undefined &&
          (existing[0].siteSlug !== input.siteSlug || existing[0].workspaceId !== workspaceId)
        ) {
          return ownedResourceNotFound("固定ページ");
        }
        const sameKind = await db
          .select({ deletedAt: legalPages.deletedAt })
          .from(legalPages)
          .where(
            and(
              eq(legalPages.workspaceId, workspaceId),
              eq(legalPages.siteSlug, input.siteSlug),
              eq(legalPages.kind, input.kind),
            ),
          )
          .limit(1);
        if (sameKind[0]?.deletedAt !== null && sameKind[0]?.deletedAt !== undefined) {
          return err(
            domainError(
              "CONFLICT",
              "削除済みの固定ページは保存では戻せません。削除済み一覧から復元してください。",
              { field: "kind" },
            ),
          );
        }
        await db
          .insert(legalPages)
          .values({
            id: input.id,
            workspaceId,
            siteSlug: input.siteSlug,
            kind: input.kind,
            title: input.title,
            body: input.body,
            status: input.status,
            deletedAt: null,
            updatedAt: input.updatedAt,
          })
          .onConflictDoUpdate({
            target: [legalPages.siteSlug, legalPages.kind],
            set: {
              title: input.title,
              body: input.body,
              status: input.status,
              updatedAt: input.updatedAt,
            },
          });
        return ok(true);
      } catch (cause) {
        return storageFailure("固定ページの保存", cause);
      }
    },

    async deleteFixedPage(workspaceId, pageId): PortResult<true> {
      try {
        const pages = await db
          .select({ siteSlug: legalPages.siteSlug })
          .from(legalPages)
          .where(and(eq(legalPages.workspaceId, workspaceId), eq(legalPages.id, pageId)))
          .limit(1);
        const page = pages[0];
        if (page === undefined || !(await ownsUniqueSiteSlug(db, workspaceId, page.siteSlug))) {
          return ownedResourceNotFound("固定ページ");
        }
        const deleted = await db
          .update(legalPages)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(legalPages.workspaceId, workspaceId),
              eq(legalPages.id, pageId),
              eq(legalPages.siteSlug, page.siteSlug),
              isNull(legalPages.deletedAt),
            ),
          )
          .returning({ id: legalPages.id });
        if (deleted.length === 0) return ownedResourceNotFound("固定ページ");
        return ok(true);
      } catch (cause) {
        return storageFailure("固定ページの削除", cause);
      }
    },

    async restoreFixedPage(workspaceId, pageId, restoredAt): PortResult<true> {
      try {
        const pages = await db
          .select({ siteSlug: legalPages.siteSlug })
          .from(legalPages)
          .where(
            and(
              eq(legalPages.workspaceId, workspaceId),
              eq(legalPages.id, pageId),
              isNotNull(legalPages.deletedAt),
            ),
          )
          .limit(1);
        const page = pages[0];
        if (page === undefined || !(await ownsUniqueSiteSlug(db, workspaceId, page.siteSlug))) {
          return ownedResourceNotFound("削除済み固定ページ");
        }
        const restored = await db
          .update(legalPages)
          .set({ deletedAt: null, updatedAt: restoredAt })
          .where(
            and(
              eq(legalPages.workspaceId, workspaceId),
              eq(legalPages.id, pageId),
              eq(legalPages.siteSlug, page.siteSlug),
              isNotNull(legalPages.deletedAt),
            ),
          )
          .returning({ id: legalPages.id });
        if (restored.length === 0) return ownedResourceNotFound("削除済み固定ページ");
        return ok(true);
      } catch (cause) {
        return storageFailure("固定ページの復元", cause);
      }
    },

    async summarizeRatings(
      workspaceId,
      articleIds,
    ): PortResult<Readonly<Record<string, RatingSummary>>> {
      try {
        if (articleIds.length === 0) return ok({});
        const ownedArticles = await db
          .select({ id: blogArticles.id })
          .from(blogArticles)
          .where(
            and(
              eq(blogArticles.workspaceId, workspaceId),
              inArray(blogArticles.id, [...articleIds]),
              isNull(blogArticles.deletedAt),
            ),
          );
        const ownedIds = ownedArticles.map((article) => article.id);
        const rows = await db
          .select()
          .from(blogArticleRatings)
          .where(
            ownedIds.length === 0
              ? eq(blogArticleRatings.articleId, "")
              : and(
                  eq(blogArticleRatings.workspaceId, workspaceId),
                  inArray(blogArticleRatings.articleId, ownedIds),
                ),
          );
        // 伏せた票をここで落とさない。**落とすのは集計の側の仕事**にしてある
        // (`summarizeRatings` の説明を見ること)。ここで落とすと、同じ判断が
        // 読者側の `summarize` にも写り、片方の書き忘れが起きる。
        const byArticle = new Map<string, { score: number; hidden: boolean }[]>();
        for (const row of rows) {
          const list = byArticle.get(row.articleId) ?? [];
          list.push({ score: row.score, hidden: row.hidden });
          byArticle.set(row.articleId, list);
        }
        const out: Record<string, RatingSummary> = {};
        for (const id of articleIds) {
          out[id] = ownedIds.includes(id)
            ? summarizeRatings(byArticle.get(id) ?? [])
            : { count: 0, average: null };
        }
        return ok(out);
      } catch (cause) {
        return storageFailure("評価の集計", cause);
      }
    },

    async listRatings(workspaceId, articleId) {
      try {
        const articles = await db
          .select({ id: blogArticles.id })
          .from(blogArticles)
          .where(
            and(
              eq(blogArticles.workspaceId, workspaceId),
              eq(blogArticles.id, articleId),
              isNull(blogArticles.deletedAt),
            ),
          )
          .limit(1);
        if (articles.length === 0) return ok([]);
        const rows = await db
          .select()
          .from(blogArticleRatings)
          .where(
            and(
              eq(blogArticleRatings.workspaceId, workspaceId),
              eq(blogArticleRatings.articleId, articleId),
            ),
          )
          .orderBy(desc(blogArticleRatings.createdAt));
        // **伏せたものも返す。**運営者が「何を伏せたか」を確かめる口なので。
        return ok(
          rows.map((r) => ({
            id: r.id,
            articleId: r.articleId,
            readerKey: r.readerKey,
            score: r.score,
            comment: r.comment,
            hidden: r.hidden,
            createdAt: r.createdAt,
          })),
        );
      } catch (cause) {
        return storageFailure("評価の一覧", cause);
      }
    },

    async setRatingHidden(workspaceId, ratingId, hidden): PortResult<true> {
      try {
        const owned = await db
          .select({ articleId: blogArticleRatings.articleId })
          .from(blogArticleRatings)
          .innerJoin(
            blogArticles,
            and(
              eq(blogArticles.id, blogArticleRatings.articleId),
              eq(blogArticles.workspaceId, workspaceId),
              isNull(blogArticles.deletedAt),
            ),
          )
          .where(
            and(
              eq(blogArticleRatings.workspaceId, workspaceId),
              eq(blogArticleRatings.id, ratingId),
            ),
          )
          .limit(1);
        const target = owned[0];
        if (target === undefined) return ownedResourceNotFound("評価");
        // **行を消さない。**印を付け替えるだけ。
        const updated = await db
          .update(blogArticleRatings)
          .set({ hidden })
          .where(
            and(
              eq(blogArticleRatings.workspaceId, workspaceId),
              eq(blogArticleRatings.id, ratingId),
              eq(blogArticleRatings.articleId, target.articleId),
            ),
          )
          .returning({ id: blogArticleRatings.id });
        if (updated.length === 0) return ownedResourceNotFound("評価");
        return ok(true);
      } catch (cause) {
        return storageFailure("評価の非表示", cause);
      }
    },
  };
}

/**
 * 読者の評価の保存先。
 *
 * `put` が上書きなのは、押し直しで票が増えないようにするため。
 * 表側の一意制約（`article_id` + `reader_key`）と合わせて 2 重に止めている。
 */
export function createD1ArticleRatingPort(db: DrizzleD1): ArticleRatingPort {
  return {
    async put(input): PortResult<true> {
      try {
        const active = await db
          .select({ id: blogArticles.id, workspaceId: blogArticles.workspaceId })
          .from(blogArticles)
          .where(
            and(
              eq(blogArticles.id, input.articleId),
              eq(blogArticles.status, "published"),
              isNull(blogArticles.deletedAt),
            ),
          )
          .limit(1);
        const target = active[0];
        if (target === undefined) return ownedResourceNotFound("公開中の記事");
        // 読者に作業場所は無い。**票が属する記事の作業場所**をここで写す。
        // 写さないと、運営者が自分の票を数えるたび `articles` を join する形になり、
        // join を 1 度忘れた日に他所の票が混ざる。
        await db
          .insert(blogArticleRatings)
          .values({ ...input, workspaceId: target.workspaceId ?? "" })
          .onConflictDoUpdate({
            target: [blogArticleRatings.articleId, blogArticleRatings.readerKey],
            /*
             * **`hidden` をここで戻さない。**
             * 伏せた票の主が押し直したら伏せ字が解ける、という形にすると、
             * 運営者の判断を読者側の操作で覆せることになる。
             */
            set: { score: input.score, comment: input.comment, createdAt: input.createdAt },
          });
        return ok(true);
      } catch (cause) {
        return storageFailure("評価の保存", cause);
      }
    },

    async summarize(articleId): PortResult<RatingSummary> {
      try {
        const active = await db
          .select({ id: blogArticles.id })
          .from(blogArticles)
          .where(
            and(
              eq(blogArticles.id, articleId),
              eq(blogArticles.status, "published"),
              isNull(blogArticles.deletedAt),
            ),
          )
          .limit(1);
        if (active.length === 0) return ok({ count: 0, average: null });
        const rows = await db
          .select()
          .from(blogArticleRatings)
          .where(eq(blogArticleRatings.articleId, articleId));
        return ok(summarizeRatings(rows.map((r) => ({ score: r.score, hidden: r.hidden }))));
      } catch (cause) {
        return storageFailure("評価の集計", cause);
      }
    },
  };
}

/**
 * 読者に見える面の読み取り。
 *
 * **公開済みしか返さない口**を作成者向けと分けてある。
 * 同じ口にすると、絞り忘れ 1 か所で下書きが読者側の一覧に出る。
 */
export function createD1PublicBlogPort(
  db: DrizzleD1,
  sites: EditorialSiteRepositoryPort,
  publishedContent: EditorialPublishedContentPort = createD1ContentRepository(db),
): PublicBlogPort {
  return {
    async openSite(siteSlug): PortResult<PublicSiteReader | null> {
      const resolved = await resolvePublicSiteIdentity(db, sites, siteSlug);
      if (!resolved.ok) return err(resolved.error);
      const identity = resolved.value;
      if (identity === null) return ok(null);

      const readLayoutSlots = async (
        enabledOnly: boolean,
      ): PortResult<readonly BlogLayoutSlotRecord[]> => {
        try {
          const ownership = and(
            eq(blogLayoutSlots.workspaceId, identity.workspaceId),
            eq(blogLayoutSlots.siteSlug, identity.siteSlug),
          );
          const rows = await db
            .select()
            .from(blogLayoutSlots)
            .where(
              enabledOnly
                ? and(ownership, eq(blogLayoutSlots.enabled, true))
                : ownership,
            )
            .orderBy(asc(blogLayoutSlots.position));
          return ok(rows.map(toSlot));
        } catch (cause) {
          return storageFailure("枠の設定の読み取り", cause);
        }
      };
      const readLayoutBands = async (
        enabledOnly: boolean,
      ): PortResult<readonly BlogLayoutBandRecord[]> => {
        try {
          const ownership = and(
            eq(blogLayoutBands.workspaceId, identity.workspaceId),
            eq(blogLayoutBands.siteSlug, identity.siteSlug),
          );
          const rows = await db
            .select()
            .from(blogLayoutBands)
            .where(
              enabledOnly
                ? and(ownership, eq(blogLayoutBands.enabled, true))
                : ownership,
            )
            .orderBy(asc(blogLayoutBands.position));
          return ok(rows.map(toBand));
        } catch (cause) {
          return storageFailure("帯の設定の読み取り", cause);
        }
      };

      return ok({
        blueprint: identity.blueprint,
        async findArticleBySlug(slug) {
          return publishedContent.findArticle(identity.siteSlug, slug);
        },
        async listPublished(limit) {
          return publishedContent.listRecent(identity.siteSlug, limit);
        },
        async findSourceArticleId(slug) {
          try {
            const rows = await db
              .select({ sourceArticleId: publishedArticles.sourceArticleId })
              .from(publishedArticles)
              .where(
                and(
                  eq(publishedArticles.workspaceId, identity.workspaceId),
                  eq(publishedArticles.siteSlug, identity.siteSlug),
                  eq(publishedArticles.slug, slug),
                  isNull(publishedArticles.archivedAt),
                ),
              )
              .limit(1);
            return ok(rows[0]?.sourceArticleId ?? null);
          } catch (cause) {
            return storageFailure("公開記事の由来の読み取り", cause);
          }
        },
        async listLayoutSlots() {
          return readLayoutSlots(true);
        },
        async listProvisionedLayoutSlots() {
          return readLayoutSlots(false);
        },
        async listLayoutBands() {
          return readLayoutBands(true);
        },
        async listProvisionedLayoutBands() {
          return readLayoutBands(false);
        },
        async listDeliveryParts() {
          try {
            const rows = await db
              .select()
              .from(blogDeliveryParts)
              .where(
                and(
                  eq(blogDeliveryParts.workspaceId, identity.workspaceId),
                  eq(blogDeliveryParts.siteSlug, identity.siteSlug),
                ),
              )
              .orderBy(asc(blogDeliveryParts.position));
            return ok(rows.map(toPart));
          } catch (cause) {
            return storageFailure("配信部品の読み取り", cause);
          }
        },
        async listNetwork() {
          try {
            const rows = await db
              .select()
              .from(siteNetworkNodes)
              .where(
                and(
                  eq(siteNetworkNodes.workspaceId, identity.workspaceId),
                  eq(siteNetworkNodes.status, "active"),
                  isNull(siteNetworkNodes.deletedAt),
                ),
              )
              .orderBy(asc(siteNetworkNodes.position));
            return ok(
              rows
                .filter(
                  (row) =>
                    row.siteSlug === identity.siteSlug || row.parentSlug === identity.siteSlug,
                )
                .map(toNetwork),
            );
          } catch (cause) {
            return storageFailure("サイト網の読み取り", cause);
          }
        },
        async listTags() {
          try {
            const rows = await db
              .select()
              .from(blogTags)
              .where(
                and(
                  eq(blogTags.workspaceId, identity.workspaceId),
                  eq(blogTags.siteSlug, identity.siteSlug),
                ),
              )
              .orderBy(asc(blogTags.slug));
            return ok(rows.map(toTag));
          } catch (cause) {
            return storageFailure("タグの読み取り", cause);
          }
        },
        async listFixedPages() {
          try {
            const rows = await db
              .select()
              .from(legalPages)
              .where(
                and(
                  eq(legalPages.workspaceId, identity.workspaceId),
                  eq(legalPages.siteSlug, identity.siteSlug),
                  inArray(legalPages.kind, [...FIXED_PAGE_KINDS]),
                  eq(legalPages.status, "published"),
                  isNull(legalPages.deletedAt),
                ),
              )
              .orderBy(asc(legalPages.kind));
            return ok(rows.map(toPage));
          } catch (cause) {
            return storageFailure("固定ページの公開読み取り", cause);
          }
        },
        async listProvisionedFixedPages() {
          try {
            const rows = await db
              .select()
              .from(legalPages)
              .where(
                and(
                  eq(legalPages.workspaceId, identity.workspaceId),
                  eq(legalPages.siteSlug, identity.siteSlug),
                  inArray(legalPages.kind, [...FIXED_PAGE_KINDS]),
                  isNull(legalPages.deletedAt),
                ),
              )
              .orderBy(asc(legalPages.kind));
            return ok(rows.map(toPage));
          } catch (cause) {
            return storageFailure("固定ページの作成状態の読み取り", cause);
          }
        },
      });
    },
  };
}
