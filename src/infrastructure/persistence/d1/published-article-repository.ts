import { and, desc, eq, like, or } from "drizzle-orm";
import type {
  EditorialPublishedArticleWriterPort,
  EditorialPublishedContentPort,
} from "@/application/ports/site";
import {
  type ArticleSummary,
  type PublishedArticle,
  type PublishedPerson,
  toSummary,
} from "@/application/read-models/published-article";
import { publishedArticles, publishedArticleTombstones } from "@/db/schema";
import { domainError, err, markEditorial, ok, type WorkspaceId } from "@/domain/shared";
import { createSampleContentRepository } from "../sample/content-sample-repository";
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
 * --- 見本を消さない ---
 * 保存された記事と見本を重ねて返す。まだ 1 本も出していない状態で読者ページが
 * 空になると、「出していない」のか「壊れている」のかを画面から見分けられない。
 * **同じ URL 名なら、出したほうが勝つ**（`storage-failure.ts` の
 * `mergeWithSamples` と同じ考え方。こちらは鍵が URL 名なので個別に書く）。
 */

const samples = createSampleContentRepository();

/** 記事の URL 名を鍵にして重ねる。保存された分を先に置き、見本で埋める。 */
function mergeBySlug<T extends { readonly slug: string }>(
  stored: readonly T[],
  sample: readonly T[],
  hidden: ReadonlySet<string> = new Set(),
): readonly T[] {
  const visibleStored = stored.filter((article) => !hidden.has(article.slug));
  const taken = new Set([...visibleStored.map((article) => article.slug), ...hidden]);
  return [...visibleStored, ...sample.filter((article) => !taken.has(article.slug))];
}

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
        const row = {
          siteSlug: article.siteSlug,
          slug: article.slug,
          workspaceId: String(workspaceId),
          type: article.type,
          title: article.title,
          summary: article.summary,
          categorySlug: article.categorySlug,
          authorSlug: article.author.slug,
          authorName: article.author.name,
          publishedAt: article.publishedAt,
          updatedAt: article.updatedAt,
          articleJson: JSON.stringify(article),
        };
        // 出し直しは**上書き**。断ると、直した記事を出せない状態が永久に続く。
        // 墓標を外してから公開行を置く。この2文はD1 batchの同一transactionで動き、
        // migrationの相互排他triggerが別workspaceの割り込みをDB境界で拒否する。
        const [, saved] = await db.batch([
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
              setWhere: eq(publishedArticles.workspaceId, String(workspaceId)),
            })
            .returning({ workspaceId: publishedArticles.workspaceId }),
        ] as const);
        if (saved.length === 0) {
          return articleUrlConflict();
        }
        return ok(true as const);
      } catch (cause) {
        if (isUrlStateConflict(cause)) return articleUrlConflict();
        return storageFailure("記事の公開", cause);
      }
    },

    async unpublish(workspaceId: WorkspaceId, siteSlug: string, slug: string) {
      try {
        const [articles, tombstones] = await Promise.all([
          db
            .select({ workspaceId: publishedArticles.workspaceId })
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

export function createD1ContentRepository(db: DrizzleD1): EditorialPublishedContentPort {
  async function hiddenSlugs(siteSlug: string): Promise<ReadonlySet<string>> {
    const rows = await db
      .select({ slug: publishedArticleTombstones.slug })
      .from(publishedArticleTombstones)
      .where(eq(publishedArticleTombstones.siteSlug, siteSlug));
    return new Set(rows.map((row) => row.slug));
  }

  /** そのブログで出した記事を、更新日の新しい順で読む。 */
  async function storedSummaries(siteSlug: string): Promise<readonly ArticleSummary[]> {
    const rows = await db
      .select({ articleJson: publishedArticles.articleJson })
      .from(publishedArticles)
      .where(eq(publishedArticles.siteSlug, siteSlug))
      .orderBy(desc(publishedArticles.updatedAt));
    return rows.map((r) => toSummary(parse(r.articleJson)));
  }

  return markEditorial({
    async listRecent(siteSlug: string, limit: number) {
      try {
        const sample = await samples.listRecent(siteSlug, limit);
        if (!sample.ok) return sample;
        const merged = [
          ...mergeBySlug(await storedSummaries(siteSlug), sample.value, await hiddenSlugs(siteSlug)),
        ].sort(
          byUpdatedDesc,
        );
        return ok(merged.slice(0, limit));
      } catch (cause) {
        return storageFailure("新着記事の読み込み", cause);
      }
    },

    async listByCategory(siteSlug: string, categorySlug: string) {
      try {
        const sample = await samples.listByCategory(siteSlug, categorySlug);
        if (!sample.ok) return sample;
        const rows = await db
          .select({ articleJson: publishedArticles.articleJson })
          .from(publishedArticles)
          .where(
            and(
              eq(publishedArticles.siteSlug, siteSlug),
              eq(publishedArticles.categorySlug, categorySlug),
            ),
          )
          .orderBy(desc(publishedArticles.updatedAt));
        const stored = rows.map((r) => toSummary(parse(r.articleJson)));
        return ok([
          ...mergeBySlug(stored, sample.value, await hiddenSlugs(siteSlug)),
        ].sort(byUpdatedDesc));
      } catch (cause) {
        return storageFailure("カテゴリー内の記事の読み込み", cause);
      }
    },

    async findArticle(siteSlug: string, slug: string) {
      try {
        const hidden = await hiddenSlugs(siteSlug);
        if (hidden.has(slug)) return ok(null);
        const rows = await db
          .select({ articleJson: publishedArticles.articleJson })
          .from(publishedArticles)
          .where(and(eq(publishedArticles.siteSlug, siteSlug), eq(publishedArticles.slug, slug)))
          .limit(1);
        const row = rows[0];
        // 出したものが先。見本と同じ URL 名で出した人が、自分の記事を開けないのはおかしい。
        if (row !== undefined) return ok(parse(row.articleJson));
        return samples.findArticle(siteSlug, slug);
      } catch (cause) {
        return storageFailure("記事の読み込み", cause);
      }
    },

    async search(siteSlug: string, query: string, limit: number) {
      try {
        const sample = await samples.search(siteSlug, query, limit);
        if (!sample.ok) return sample;
        const trimmed = query.trim();
        // 空の検索語で全件を返さない（一覧と区別がつかなくなる）。
        const stored =
          trimmed === ""
            ? []
            : (
                await db
                  .select({ articleJson: publishedArticles.articleJson })
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
              ).map((r) => toSummary(parse(r.articleJson)));
        return ok([
          ...mergeBySlug(stored, sample.value, await hiddenSlugs(siteSlug)),
        ].sort(byUpdatedDesc).slice(0, limit));
      } catch (cause) {
        return storageFailure("記事の検索", cause);
      }
    },

    async findPerson(siteSlug: string, kind: "author" | "expert", slug: string) {
      try {
        // 出した記事に付いている書き手は、その記事の写しから返す。
        // ここを見本だけに任せると、出した記事の署名が行き止まりのリンクになる。
        const hidden = await hiddenSlugs(siteSlug);
        const rows = await db
          .select({ articleJson: publishedArticles.articleJson })
          .from(publishedArticles)
          .where(
            and(eq(publishedArticles.siteSlug, siteSlug), eq(publishedArticles.authorSlug, slug)),
          )
          .orderBy(desc(publishedArticles.updatedAt))
          .limit(1);
        const row = rows.find((candidate) => !hidden.has(parse(candidate.articleJson).slug));
        if (kind === "author" && row !== undefined) {
          const person: PublishedPerson = parse(row.articleJson).author;
          return ok(person);
        }
        return samples.findPerson(siteSlug, kind, slug);
      } catch (cause) {
        return storageFailure("書き手の読み込み", cause);
      }
    },

    async listByPerson(siteSlug: string, personSlug: string) {
      try {
        const sample = await samples.listByPerson(siteSlug, personSlug);
        if (!sample.ok) return sample;
        const rows = await db
          .select({ articleJson: publishedArticles.articleJson })
          .from(publishedArticles)
          .where(
            and(
              eq(publishedArticles.siteSlug, siteSlug),
              eq(publishedArticles.authorSlug, personSlug),
            ),
          )
          .orderBy(desc(publishedArticles.updatedAt));
        const stored = rows.map((r) => toSummary(parse(r.articleJson)));
        return ok([
          ...mergeBySlug(stored, sample.value, await hiddenSlugs(siteSlug)),
        ].sort(byUpdatedDesc));
      } catch (cause) {
        return storageFailure("書き手の記事の読み込み", cause);
      }
    },

    // 訂正は、まだ入れる口が無いので見本のまま返す。
    // ここで空配列を返すと「訂正が 1 件も無いブログ」に見えてしまう。
    listCorrections(siteSlug: string) {
      return samples.listCorrections(siteSlug);
    },

    /*
      固定文書（運営者情報・各方針・規約・特商法表記）は本物を読む。
      入れる口（/admin/sites/{site}/documents）ができたので見本から外した。

      **見本へ落とさない。** 落とすと、まだ書いていない運営者情報の位置に
      見本の運営者情報（「編集部が運営しています」）が出て、読者にはそれが
      本物として読まれる。未整備は未整備のまま返し（null → 404）、
      どれが未整備かは管理画面の一覧で見えるようにしてある。
    */
    findPolicyDocument: findSiteDocument({ db }),
  });
}
