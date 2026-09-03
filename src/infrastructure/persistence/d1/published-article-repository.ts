import { and, desc, eq, isNotNull, isNull, like, ne, or, sql } from "drizzle-orm";
import type {
  EditorialPublishedArticleAdminPort,
  EditorialPublishedArticleWriterPort,
  EditorialPublishedContentPort,
  EditorialSiteRepositoryPort,
} from "@/application/ports/site";
import {
  type ArticleSummary,
  type PublishedArticle,
  type PublishedPerson,
  tallyBrands,
  toSummary,
} from "@/application/read-models/published-article";
import { publishedArticles, publishedArticleTombstones } from "@/db/schema";
import { domainError, err, markEditorial, ok, type WorkspaceId } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { findSiteDocument } from "./site-document-repository";
import { storageFailure } from "./storage-failure";

/**
 * 読者ページへ出した記事の保存先（D1）。
 *
 * --- 書く口と読む口を分けている理由 ---
 * 出す操作は `createD1PublishedArticleWriter`、読む操作は
 * `createD1ContentRepository` と、別の関数で返す。読者向けの経路が受け取るのは
 * 読む口だけなので、**読者からの要求で記事を書き換える経路が型の上で作れない**。
 *
 * --- 保存しているもの ---
 * 記事の中身は `article_json` にまとめて入れ、列に出しているのは
 * 絞り込みと並べ替えに使う項目だけ。**画面へ返す内容は必ず JSON 側から作る**
 * （`toSummary`）。列と JSON の両方から作ると、片方だけ古い行ができたときに
 * 一覧と本文で違うことが書かれる。
 *
 * --- live と sample を混ぜない ---
 * D1 を使う実行では `published_articles` に実在する記事だけを返す。
 * 一覧へ見本を混ぜると、そのURLを別の公開readerで開いたとき404になり、
 * 「一覧にある記事」と「本文を読める記事」が一致しないためである。
 */

function parse(json: string): PublishedArticle {
  return JSON.parse(json) as PublishedArticle;
}

/** 更新日の新しい順。同日は URL 名で決める（並びが実行ごとに変わらないように）。 */
function byUpdatedDesc(a: ArticleSummary, b: ArticleSummary): number {
  return b.updatedAt.localeCompare(a.updatedAt) || a.slug.localeCompare(b.slug);
}

const URL_STATE_CONFLICT = "published_article_url_state_conflict";

function isUrlStateConflict(cause: unknown): boolean {
  return String(cause).includes(URL_STATE_CONFLICT);
}

function isPublicationIdentityConflict(cause: unknown): boolean {
  const reason = String(cause);
  return (
    isUrlStateConflict(cause) ||
    reason.includes("published_article_source_conflict") ||
    reason.includes("UNIQUE constraint failed: published_articles.site_slug, published_articles.slug")
  );
}

function articleUrlConflict() {
  return err(
    domainError("CONFLICT", "この URL の名前は使えません。", {
      suggestedAction: "別の URL の名前を付けて、もう一度公開してください。",
    }),
  );
}

function unpublishNotFound() {
  return err(
    domainError("NOT_FOUND", "取り下げる記事が見つかりませんでした。", {
      suggestedAction: "記事の一覧を開き直して、公開状態を確認してください。",
    }),
  );
}

/**
 * canonical public projection の保存文。AI 公開と BlogOps 公開が共有する。
 *
 * source が違う同 URL は上書きしない。事前 read だけでなく UPDATE の
 * 条件にも由来を入れ、競合しても勝者を推測しない。
 */
export function publishedArticleSaveStatements(
  db: DrizzleD1,
  workspaceId: WorkspaceId,
  article: PublishedArticle,
  sourceArticleId: string | null,
) {
  const row = {
    siteSlug: article.siteSlug,
    slug: article.slug,
    workspaceId: String(workspaceId),
    sourceArticleId,
    type: article.type,
    title: article.title,
    summary: article.summary,
    categorySlug: article.categorySlug,
    authorSlug: article.author.slug,
    authorName: article.author.name,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    archivedAt: null,
    articleJson: JSON.stringify(article),
  };
  return [
    db
      .delete(publishedArticleTombstones)
      .where(
        and(
          eq(publishedArticleTombstones.workspaceId, String(workspaceId)),
          eq(publishedArticleTombstones.siteSlug, article.siteSlug),
          eq(publishedArticleTombstones.slug, article.slug),
        ),
      ),
    db
      .insert(publishedArticles)
      .values(row)
      .onConflictDoUpdate({
        target: [publishedArticles.siteSlug, publishedArticles.slug],
        set: row,
        setWhere: and(
          eq(publishedArticles.workspaceId, String(workspaceId)),
          sourceArticleId === null
            ? isNull(publishedArticles.sourceArticleId)
            : eq(publishedArticles.sourceArticleId, sourceArticleId),
        ),
      })
      .returning({ workspaceId: publishedArticles.workspaceId }),
    /*
     * ON CONFLICT の setWhere が false でも D1 は batch を失敗にしない。
     * 同URLを別sourceが先に取った場合は既存行を同じPKへINSERTして意図的に
     * 制約違反にし、同じbatch内の編集aggregateまでrollbackする。
     */
    db.insert(publishedArticles).select(
      db
        .select({
          siteSlug: publishedArticles.siteSlug,
          slug: publishedArticles.slug,
          workspaceId: publishedArticles.workspaceId,
          sourceArticleId: publishedArticles.sourceArticleId,
          type: publishedArticles.type,
          title: publishedArticles.title,
          summary: publishedArticles.summary,
          categorySlug: publishedArticles.categorySlug,
          authorSlug: publishedArticles.authorSlug,
          authorName: publishedArticles.authorName,
          publishedAt: publishedArticles.publishedAt,
          updatedAt: publishedArticles.updatedAt,
          archivedAt: publishedArticles.archivedAt,
          articleJson: publishedArticles.articleJson,
        })
        .from(publishedArticles)
        .where(
          and(
            eq(publishedArticles.siteSlug, article.siteSlug),
            eq(publishedArticles.slug, article.slug),
            or(
              ne(publishedArticles.workspaceId, String(workspaceId)),
              sourceArticleId === null
                ? isNotNull(publishedArticles.sourceArticleId)
                : or(
                    isNull(publishedArticles.sourceArticleId),
                    ne(publishedArticles.sourceArticleId, sourceArticleId),
                  ),
            ),
          ),
        ),
    ),
  ] as const;
}

/** BlogOps 由来の projection だけを取り下げ、同 URL の意図しない復活を防ぐ。 */
export function sourcedPublishedArticleUnpublishStatements(
  db: DrizzleD1,
  workspaceId: WorkspaceId,
  siteSlug: string,
  slug: string,
  sourceArticleId: string,
  unpublishedAt: Date,
) {
  return [
    db
      .delete(publishedArticles)
      .where(
        and(
          eq(publishedArticles.workspaceId, String(workspaceId)),
          eq(publishedArticles.siteSlug, siteSlug),
          eq(publishedArticles.slug, slug),
          eq(publishedArticles.sourceArticleId, sourceArticleId),
        ),
      ),
    db
      .insert(publishedArticleTombstones)
      .values({ siteSlug, slug, workspaceId: String(workspaceId), unpublishedAt })
      .onConflictDoUpdate({
        target: [publishedArticleTombstones.siteSlug, publishedArticleTombstones.slug],
        set: { unpublishedAt },
        setWhere: eq(publishedArticleTombstones.workspaceId, String(workspaceId)),
      })
      .returning({ slug: publishedArticleTombstones.slug }),
  ] as const;
}

export function createD1PublishedArticleWriter(db: DrizzleD1): EditorialPublishedArticleWriterPort {
  return markEditorial({
    async save(workspaceId: WorkspaceId, article: PublishedArticle) {
      try {
        const tombstone = await db
          .select({ workspaceId: publishedArticleTombstones.workspaceId })
          .from(publishedArticleTombstones)
          .where(
            and(
              eq(publishedArticleTombstones.siteSlug, article.siteSlug),
              eq(publishedArticleTombstones.slug, article.slug),
            ),
          )
          .limit(1);
        if (
          tombstone[0] !== undefined &&
          tombstone[0].workspaceId !== String(workspaceId)
        ) {
          return articleUrlConflict();
        }
        // 出し直しは**上書き**。断ると、直した記事を出せない状態が永久に続く。
        // 墓標を外してから公開行を置く。この2文はD1 batchの同一transactionで動き、
        // migrationの相互排他triggerが別workspaceの割り込みをDB境界で拒否する。
        const [, saved] = await db.batch(
          publishedArticleSaveStatements(db, workspaceId, article, null),
        );
        if (saved.length === 0) {
          return articleUrlConflict();
        }
        return ok(true as const);
      } catch (cause) {
        if (isPublicationIdentityConflict(cause)) return articleUrlConflict();
        return storageFailure("記事の公開", cause);
      }
    },

    async unpublish(workspaceId: WorkspaceId, siteSlug: string, slug: string) {
      try {
        const [articles, tombstones] = await Promise.all([
          db
            .select({
              workspaceId: publishedArticles.workspaceId,
              sourceArticleId: publishedArticles.sourceArticleId,
            })
            .from(publishedArticles)
            .where(
              and(eq(publishedArticles.siteSlug, siteSlug), eq(publishedArticles.slug, slug)),
            )
            .limit(1),
          db
            .select({ workspaceId: publishedArticleTombstones.workspaceId })
            .from(publishedArticleTombstones)
            .where(
              and(
                eq(publishedArticleTombstones.siteSlug, siteSlug),
                eq(publishedArticleTombstones.slug, slug),
              ),
            )
            .limit(1),
        ]);
        const owner = articles[0]?.workspaceId ?? tombstones[0]?.workspaceId;
        if (owner === undefined) {
          return unpublishNotFound();
        }
        if (owner !== String(workspaceId)) {
          return unpublishNotFound();
        }
        // AI 公開の取り下げ口から BlogOps 由来の projection を消さない。
        if (articles[0]?.sourceArticleId !== null && articles[0]?.sourceArticleId !== undefined) {
          return unpublishNotFound();
        }

        // 公開行を外してから墓標を置く。batch外へ中間状態は公開されず、
        // 相互排他triggerにより別workspaceの公開行との共存も成立しない。
        const [, hidden] = await db.batch([
          db
            .delete(publishedArticles)
            .where(
              and(
                eq(publishedArticles.workspaceId, String(workspaceId)),
                eq(publishedArticles.siteSlug, siteSlug),
                eq(publishedArticles.slug, slug),
                isNull(publishedArticles.sourceArticleId),
              ),
            ),
          db
            .insert(publishedArticleTombstones)
            .values({
              siteSlug,
              slug,
              workspaceId: String(workspaceId),
              unpublishedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [publishedArticleTombstones.siteSlug, publishedArticleTombstones.slug],
              set: { unpublishedAt: new Date() },
              setWhere: eq(publishedArticleTombstones.workspaceId, String(workspaceId)),
            })
            .returning({ slug: publishedArticleTombstones.slug }),
        ] as const);
        if (hidden.length === 0) {
          return unpublishNotFound();
        }
        return ok(true as const);
      } catch (cause) {
        if (isUrlStateConflict(cause)) return unpublishNotFound();
        return storageFailure("記事の取り下げ", cause);
      }
    },
  });
}

export function createD1ContentRepository(
  db: DrizzleD1,
  sites: EditorialSiteRepositoryPort,
): EditorialPublishedContentPort {
  /** そのブログで出した記事を、更新日の新しい順で読む。 */
  async function storedSummaries(siteSlug: string): Promise<readonly ArticleSummary[]> {
    const rows = await db
      .select({
        slug: publishedArticles.slug,
        archivedAt: publishedArticles.archivedAt,
        articleJson: publishedArticles.articleJson,
      })
      .from(publishedArticles)
      .where(eq(publishedArticles.siteSlug, siteSlug))
      .orderBy(desc(publishedArticles.updatedAt));
    return rows
      .filter((row) => row.archivedAt === null)
      .map((row) => toSummary(parse(row.articleJson)))
      .sort(byUpdatedDesc);
  }

  return markEditorial({
    async listRecent(siteSlug: string, limit: number) {
      try {
        return ok((await storedSummaries(siteSlug)).slice(0, limit));
      } catch (cause) {
        return storageFailure("新着記事の読み込み", cause);
      }
    },

    /*
      ブランドは記事の中身から数えるので、要約ではなく本体を読む。
      要約には商品カードが入らないため（`toSummary` が落とす）、
      ここだけ `storedSummaries` を使えない。
    */
    async listBrands(siteSlug: string) {
      try {
        const rows = await db
          .select({
            archivedAt: publishedArticles.archivedAt,
            articleJson: publishedArticles.articleJson,
          })
          .from(publishedArticles)
          .where(eq(publishedArticles.siteSlug, siteSlug));
        return ok(
          tallyBrands(rows.filter((row) => row.archivedAt === null).map((row) => parse(row.articleJson))),
        );
      } catch (cause) {
        return storageFailure("ブランド一覧の読み込み", cause);
      }
    },

    async listByCategory(siteSlug: string, categorySlug: string) {
      try {
        const rows = await db
          .select({
            slug: publishedArticles.slug,
            archivedAt: publishedArticles.archivedAt,
            articleJson: publishedArticles.articleJson,
          })
          .from(publishedArticles)
          .where(
            and(
              eq(publishedArticles.siteSlug, siteSlug),
              eq(publishedArticles.categorySlug, categorySlug),
            ),
          )
          .orderBy(desc(publishedArticles.updatedAt));
        return ok(rows
          .filter((row) => row.archivedAt === null)
          .map((row) => toSummary(parse(row.articleJson)))
          .sort(byUpdatedDesc));
      } catch (cause) {
        return storageFailure("カテゴリー内の記事の読み込み", cause);
      }
    },

    async findArticle(siteSlug: string, slug: string) {
      try {
        const rows = await db
          .select({
            archivedAt: publishedArticles.archivedAt,
            articleJson: publishedArticles.articleJson,
          })
          .from(publishedArticles)
          .where(and(eq(publishedArticles.siteSlug, siteSlug), eq(publishedArticles.slug, slug)))
          .limit(1);
        const row = rows[0];
        return ok(row !== undefined && row.archivedAt === null ? parse(row.articleJson) : null);
      } catch (cause) {
        return storageFailure("記事の読み込み", cause);
      }
    },

    async search(siteSlug: string, query: string, limit: number) {
      try {
        const trimmed = query.trim();
        // 空の検索語で全件を返さない（一覧と区別がつかなくなる）。
        const stored =
          trimmed === ""
            ? []
            : (
                await db
                  .select({
                    archivedAt: publishedArticles.archivedAt,
                    articleJson: publishedArticles.articleJson,
                  })
                  .from(publishedArticles)
                  .where(
                    and(
                      eq(publishedArticles.siteSlug, siteSlug),
                      or(
                        like(publishedArticles.title, `%${trimmed}%`),
                        like(publishedArticles.summary, `%${trimmed}%`),
                      ),
                    ),
                  )
                  .orderBy(desc(publishedArticles.updatedAt))
              )
                .filter((row) => row.archivedAt === null)
                .map((row) => toSummary(parse(row.articleJson)));
        return ok(stored.sort(byUpdatedDesc).slice(0, limit));
      } catch (cause) {
        return storageFailure("記事の検索", cause);
      }
    },

    async findPerson(siteSlug: string, kind: "author" | "expert", slug: string) {
      try {
        // 出した記事に付いている書き手は、その記事の写しから返す。
        // ここを見本だけに任せると、出した記事の署名が行き止まりのリンクになる。
        const rows = await db
          .select({
            archivedAt: publishedArticles.archivedAt,
            articleJson: publishedArticles.articleJson,
          })
          .from(publishedArticles)
          .where(
            and(
              eq(publishedArticles.siteSlug, siteSlug),
              kind === "author"
                ? eq(publishedArticles.authorSlug, slug)
                : sql`json_extract(${publishedArticles.articleJson}, '$.reviewedBy.slug') = ${slug}`,
              isNull(publishedArticles.archivedAt),
            ),
          )
          .orderBy(desc(publishedArticles.updatedAt))
          .limit(1);
        const row = rows[0];
        if (row !== undefined) {
          const article = parse(row.articleJson);
          const person: PublishedPerson | undefined =
            kind === "author" ? article.author : article.reviewedBy;
          return ok(person ?? null);
        }
        return ok(null);
      } catch (cause) {
        return storageFailure("書き手の読み込み", cause);
      }
    },

    async listByPerson(
      siteSlug: string,
      kind: "author" | "expert",
      personSlug: string,
    ) {
      try {
        const rows = await db
          .select({
            slug: publishedArticles.slug,
            archivedAt: publishedArticles.archivedAt,
            articleJson: publishedArticles.articleJson,
          })
          .from(publishedArticles)
          .where(
            and(
              eq(publishedArticles.siteSlug, siteSlug),
              kind === "author"
                ? eq(publishedArticles.authorSlug, personSlug)
                : sql`json_extract(${publishedArticles.articleJson}, '$.reviewedBy.slug') = ${personSlug}`,
            ),
          )
          .orderBy(desc(publishedArticles.updatedAt));
        return ok(rows
          .filter((row) => row.archivedAt === null)
          .map((row) => toSummary(parse(row.articleJson)))
          .sort(byUpdatedDesc));
      } catch (cause) {
        return storageFailure("書き手の記事の読み込み", cause);
      }
    },

    // live の訂正保存先は未実装。見本を実データとして出さず、空で閉じる。
    async listCorrections(_siteSlug: string) {
      return ok([]);
    },

    /*
      固定文書（運営者情報・各方針・規約・特商法表記）は本物を読む。
      入れる口（/admin/sites/{site}/documents）ができたので見本から外した。

      **見本へ落とさない。** 落とすと、まだ書いていない運営者情報の位置に
      見本の運営者情報（「編集部が運営しています」）が出て、読者にはそれが
      本物として読まれる。未整備は未整備のまま返し（null → 404）、
      どれが未整備かは管理画面の一覧で見えるようにしてある。
    */
    findPolicyDocument: findSiteDocument({ db, sites }),
  });
}

/** 管理画面だけが受け取る、workspace 境界付きの更新口。 */
export function createD1PublishedArticleAdminRepository(
  db: DrizzleD1,
): EditorialPublishedArticleAdminPort {
  return markEditorial({
    async list(workspaceId) {
      try {
        const rows = await db
          .select({
            articleJson: publishedArticles.articleJson,
            archivedAt: publishedArticles.archivedAt,
          })
          .from(publishedArticles)
          .where(
            and(
              eq(publishedArticles.workspaceId, String(workspaceId)),
              isNull(publishedArticles.sourceArticleId),
            ),
          )
          .orderBy(desc(publishedArticles.updatedAt))
          .limit(100);
        return ok(rows.map((row) => ({ article: parse(row.articleJson), archivedAt: row.archivedAt })));
      } catch (cause) {
        return storageFailure("公開済み記事の一覧", cause);
      }
    },
    async find(workspaceId, siteSlug, slug) {
      try {
        const rows = await db
          .select({
            articleJson: publishedArticles.articleJson,
            archivedAt: publishedArticles.archivedAt,
          })
          .from(publishedArticles)
          .where(
            and(
              eq(publishedArticles.workspaceId, String(workspaceId)),
              eq(publishedArticles.siteSlug, siteSlug),
              eq(publishedArticles.slug, slug),
              isNull(publishedArticles.sourceArticleId),
            ),
          )
          .limit(1);
        const row = rows[0];
        return ok(row === undefined ? null : { article: parse(row.articleJson), archivedAt: row.archivedAt });
      } catch (cause) {
        return storageFailure("公開済み記事の読み込み", cause);
      }
    },
    async replace(workspaceId, article) {
      try {
        const changed = await db
          .update(publishedArticles)
          .set({
            title: article.title,
            summary: article.summary,
            categorySlug: article.categorySlug,
            authorSlug: article.author.slug,
            authorName: article.author.name,
            updatedAt: article.updatedAt,
            articleJson: JSON.stringify(article),
          })
          .where(
            and(
              eq(publishedArticles.workspaceId, String(workspaceId)),
              eq(publishedArticles.siteSlug, article.siteSlug),
              eq(publishedArticles.slug, article.slug),
              isNull(publishedArticles.sourceArticleId),
            ),
          );
        return ok(changed.meta.changes > 0);
      } catch (cause) {
        return storageFailure("公開済み記事の訂正", cause);
      }
    },
    async archive(workspaceId, siteSlug, slug, archivedAt) {
      try {
        const changed = await db
          .update(publishedArticles)
          .set({ archivedAt })
          .where(
            and(
              eq(publishedArticles.workspaceId, String(workspaceId)),
              eq(publishedArticles.siteSlug, siteSlug),
              eq(publishedArticles.slug, slug),
              isNull(publishedArticles.sourceArticleId),
            ),
          );
        return ok(changed.meta.changes > 0);
      } catch (cause) {
        return storageFailure("公開済み記事の非表示化", cause);
      }
    },
  });
}
