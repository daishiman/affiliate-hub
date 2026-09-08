import { and, asc, eq, exists, inArray, isNull, lt, lte, ne, notExists, or, sql } from "drizzle-orm";
import { articleImages, articleImageReferenceTexts, articleImageSweepState, articles, publishedArticles, siteBlueprints, siteNetworkNodes, type ArticleImageRow } from "@/db/schema";
import { articleImageHref, ARTICLE_IMAGE_UPLOAD_GRACE_MS, ARTICLE_IMAGE_UNREFERENCED_GRACE_MS } from "@/domain/blogops/article-image-policy";
import type { ArticleId, WorkspaceId } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";

/**
 * 記事に貼られた画像の台帳（D1）。
 *
 * この層が持つのは**引き当てと出入りの記録だけ**で、
 * 「使ってよい画像か」の判断は `domain/blogops/article-image-policy.ts` にある。
 *
 * 予約→R2 put→ready の順で保存し、ready だけが公開URLから読める。
 * 回収はD1で不可逆にdeletingへ移した後だけ。本文/公開JSONのtriggerが参照の
 * 再追加を拒むため、遅延deleteや二重cronでも保存済みの画像を壊さない。
 */

export type ArticleImageRecord = {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly articleId: ArticleId;
  readonly objectKey: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly lifecycle: ArticleImageRow["lifecycle"];
  readonly referenced: boolean;
  readonly lastReferencedAt: Date | null;
  readonly createdAt: Date;
};

function toRecord(row: ArticleImageRow): ArticleImageRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId as WorkspaceId,
    articleId: row.articleId as ArticleId,
    objectKey: row.objectKey,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    lifecycle: row.lifecycle,
    referenced: row.referenced,
    lastReferencedAt: row.lastReferencedAt,
    createdAt: row.createdAt,
  };
}

export type NewArticleImage = Omit<ArticleImageRecord, "referenced" | "lastReferencedAt" | "createdAt" | "lifecycle">;

/** R2へ書く前にIDとobjectKeyを予約。pendingは取得/本文保存とも許さない。 */
export async function reserveArticleImage(
  db: DrizzleD1,
  record: NewArticleImage,
): Promise<void> {
  await db.insert(articleImages).values({
    id: record.id,
    workspaceId: String(record.workspaceId),
    articleId: String(record.articleId),
    objectKey: record.objectKey,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    lifecycle: "pending",
  });
}

/** 完了通知が遅れても、回収claim済みの予約をreadyへ戻さない。 */
export async function finalizeArticleImage(db: DrizzleD1, workspaceId: WorkspaceId, id: string): Promise<boolean> {
  const changed = await db.update(articleImages).set({ lifecycle: "ready" }).where(and(
    eq(articleImages.workspaceId, workspaceId), eq(articleImages.id, id), eq(articleImages.lifecycle, "pending"),
  )).returning({ id: articleImages.id });
  return changed.length === 1;
}

/** URLから台帳を引く。取得しただけでは公開許可にならず、呼出元で認可する。 */
export async function findArticleImage(
  db: DrizzleD1,
  id: string,
): Promise<ArticleImageRecord | null> {
  const rows = await db.select().from(articleImages).where(and(eq(articleImages.id, id), eq(articleImages.lifecycle, "ready"))).limit(1);
  const row = rows.at(0);
  return row === undefined ? null : toRecord(row);
}

/** 画像を追加・下書き表示してよい現存記事か。 */
export async function ownsImageArticle(db: DrizzleD1, workspaceId: WorkspaceId, articleId: string): Promise<boolean> {
  const rows = await db.select({ id: articles.id }).from(articles).where(and(
    eq(articles.workspaceId, workspaceId), eq(articles.id, articleId), isNull(articles.deletedAt),
  )).limit(1);
  return rows.length > 0;
}

/** 読者へ配信される同workspaceの公開projectionに、画像URLが現に含まれるか。 */
export async function isArticleImagePublic(db: DrizzleD1, image: ArticleImageRecord): Promise<boolean> {
  const rows = await db.select({ slug: publishedArticles.slug }).from(publishedArticles).where(and(
    eq(publishedArticles.workspaceId, image.workspaceId),
    isNull(publishedArticles.archivedAt),
    sql`json_valid(${publishedArticles.articleJson})`,
    sql`instr(${publishedArticles.articleJson}, ${articleImageHref(image.id)}) > 0`,
    exists(db.select({ id: siteNetworkNodes.id }).from(siteNetworkNodes).where(and(
      eq(siteNetworkNodes.workspaceId, image.workspaceId),
      eq(siteNetworkNodes.siteSlug, publishedArticles.siteSlug), eq(siteNetworkNodes.status, "active"), isNull(siteNetworkNodes.deletedAt),
    ))),
    notExists(db.select({ id: siteNetworkNodes.id }).from(siteNetworkNodes).where(and(
      ne(siteNetworkNodes.workspaceId, image.workspaceId),
      eq(siteNetworkNodes.siteSlug, publishedArticles.siteSlug),
    ))),
    exists(db.select({ id: siteBlueprints.id }).from(siteBlueprints).where(and(
      eq(siteBlueprints.workspaceId, image.workspaceId), eq(siteBlueprints.slug, publishedArticles.siteSlug),
    ))),
    or(isNull(publishedArticles.sourceArticleId), exists(db.select({ id: articles.id }).from(articles).where(and(
      eq(articles.workspaceId, image.workspaceId), eq(articles.id, publishedArticles.sourceArticleId),
      eq(articles.status, "published"), isNull(articles.deletedAt),
    )))),
  )).limit(1);
  return rows.length > 0;
}

/** 回収時は公開・下書き・復元対象も含め、他の記事へのコピーも参照として保護する。 */
export async function isArticleImageReferenced(db: DrizzleD1, image: ArticleImageRecord): Promise<boolean> {
  return (await referencedArticleImageIds(db, image.workspaceId, [image.id])).has(image.id);
}

/** 本文をJSへ全件ロードせず、D1内で参照のある候補だけを数える。 */
export async function referencedArticleImageIds(db: DrizzleD1, workspaceId: WorkspaceId, ids: readonly string[]): Promise<ReadonlySet<string>> {
  const referenced = new Set<string>();
  for (const group of imageIdGroups(ids)) {
    const rows = await db.select({ id: articleImages.id }).from(articleImages).where(and(
      eq(articleImages.workspaceId, workspaceId), inArray(articleImages.id, group),
      imageReferenceExists(db, workspaceId),
    ));
    for (const row of rows) referenced.add(row.id);
  }
  return referenced;
}

/** D1のバインド数上限内に収める。 */
function* imageIdGroups(ids: readonly string[]): Generator<string[]> {
  for (let offset = 0; offset < ids.length; offset += 50) yield ids.slice(offset, offset + 50);
}

/** 点検で「使われていた」と分かった分。時刻を今へ進める。 */
export async function markArticleImagesReferenced(
  db: DrizzleD1,
  workspaceId: WorkspaceId,
  ids: readonly string[],
  at: Date,
): Promise<void> {
  for (const group of imageIdGroups(ids)) {
    await db
      .update(articleImages)
      .set({ referenced: true, lastReferencedAt: sql`max(coalesce(${articleImages.lastReferencedAt}, 0), ${Math.floor(at.getTime() / 1000)})` })
      .where(and(eq(articleImages.workspaceId, workspaceId), inArray(articleImages.id, group)));
  }
}

/**
 * 点検で「もう使われていない」と分かった分。
 *
 * **`last_referenced_at` は消さない。** 消すと「一度も使われなかった画像」と
 * 見分けが付かなくなり、外されてから 30 日待つはずの画像が
 * 24 時間の側の猶予で判定される（`shouldReclaimArticleImage`）。
 * この欄は「いま使われているか」ではなく「最後にそう見えたのはいつか」である。
 */
export async function markArticleImagesUnreferenced(
  db: DrizzleD1,
  workspaceId: WorkspaceId,
  ids: readonly string[],
): Promise<void> {
  for (const group of imageIdGroups(ids)) {
    await db.update(articleImages).set({ referenced: false }).where(and(eq(articleImages.workspaceId, workspaceId), inArray(articleImages.id, group)));
  }
}

/**
 * 点検候補を最終点検時刻の古い順（未点検が先）で拾う。
 *
 * ここで `referenced = false` に絞らないのは意図的。台帳の `referenced` は
 * 前回の点検結果であって、いまの真実ではない。絞ってしまうと
 * 「一度は貼られたが、あとで記事から外された画像」を二度と見なくなる。
 *
 * 絞るのは古さだけ。**送った直後の画像を候補に入れない**ためで、
 * 入れると、まだ保存していない下書きの絵が数分後に穴になる。
 * 猶予の判断は domain 側が持つ。物理削除には記事保存との排他が別途必要。
 */
export async function listArticleImagesForSweep(
  db: DrizzleD1,
  createdBefore: Date,
  limit: number,
): Promise<readonly ArticleImageRecord[]> {
  const rows = await db
    .select()
    .from(articleImages)
    .where(and(lt(articleImages.createdAt, createdBefore), ne(articleImages.lifecycle, "deleted")))
    .orderBy(asc(articleImages.lastCheckedAt), asc(articleImages.createdAt), asc(articleImages.id))
    .limit(limit);
  return rows.map(toRecord);
}

/** 成功・失敗のどちらも末尾へ送る。障害のある画像が残り全件の点検を止めない。 */
export async function markArticleImagesChecked(db: DrizzleD1, workspaceId: WorkspaceId, ids: readonly string[], at: Date): Promise<void> {
  for (const group of imageIdGroups(ids)) {
    await db.update(articleImages).set({ lastCheckedAt: at }).where(and(eq(articleImages.workspaceId, workspaceId), inArray(articleImages.id, group)));
  }
}

function imageReferenceExists(db: DrizzleD1, workspaceId: WorkspaceId) {
  return exists(db.select({ body: articleImageReferenceTexts.body }).from(articleImageReferenceTexts).where(and(
    eq(articleImageReferenceTexts.workspaceId, workspaceId),
    sql`instr(${articleImageReferenceTexts.body}, ${articleImages.id}) > 0`,
  )));
}

/** 猶予と現参照を同一UPDATEで判定。deletingは期限で解除しない永久claim。 */
export async function claimArticleImageDeletion(db: DrizzleD1, image: ArticleImageRecord, now: Date): Promise<boolean> {
  const changed = await db.update(articleImages).set({ lifecycle: "deleting" }).where(and(
    eq(articleImages.workspaceId, image.workspaceId), eq(articleImages.id, image.id),
    eq(articleImages.objectKey, image.objectKey),
    or(eq(articleImages.lifecycle, "deleting"), and(
      inArray(articleImages.lifecycle, ["ready", "pending"]),
      lte(articleImages.createdAt, new Date(now.getTime() - ARTICLE_IMAGE_UPLOAD_GRACE_MS)),
      or(isNull(articleImages.lastReferencedAt), lte(articleImages.lastReferencedAt, new Date(now.getTime() - ARTICLE_IMAGE_UNREFERENCED_GRACE_MS))),
      sql`NOT ${imageReferenceExists(db, image.workspaceId)}`,
    )),
  )).returning({ id: articleImages.id });
  return changed.length === 1;
}

/** 台帳は消さず墓標として残す。ID/キーは二度と再利用しない。 */
export async function completeArticleImageDeletion(db: DrizzleD1, workspaceId: WorkspaceId, id: string, now: Date): Promise<boolean> {
  const changed = await db.update(articleImages).set({ lifecycle: "deleted", deletedAt: now }).where(and(
    eq(articleImages.workspaceId, workspaceId), eq(articleImages.id, id), eq(articleImages.lifecycle, "deleting"),
  )).returning({ id: articleImages.id });
  return changed.length === 1;
}

export async function findArticleImageForCleanup(db: DrizzleD1, workspaceId: WorkspaceId, objectKey: string): Promise<ArticleImageRecord | null> {
  const rows = await db.select().from(articleImages).where(and(
    eq(articleImages.workspaceId, workspaceId), eq(articleImages.objectKey, objectKey),
  )).limit(1);
  return rows[0] === undefined ? null : toRecord(rows[0]);
}

/** 旧R2孤児も予約として取り込む。既存予約/墓標との競合では一切上書きしない。 */
export async function adoptOrphanArticleImage(db: DrizzleD1, record: NewArticleImage, uploadedAt: Date): Promise<void> {
  await db.insert(articleImages).values({ ...record, lifecycle: "pending", createdAt: uploadedAt }).onConflictDoNothing();
}

const R2_SWEEP_ID = "article-images/";
export async function readArticleImageSweepState(db: DrizzleD1): Promise<{ cursor: string | null; version: number }> {
  await db.insert(articleImageSweepState).values({ id: R2_SWEEP_ID }).onConflictDoNothing();
  const rows = await db.select().from(articleImageSweepState).where(eq(articleImageSweepState.id, R2_SWEEP_ID)).limit(1);
  return rows[0]!;
}

/** 二重cronの古い結果がcursorを巻き戻さないようversionでCASする。 */
export async function advanceArticleImageSweepState(db: DrizzleD1, version: number, cursor: string | null): Promise<void> {
  await db.update(articleImageSweepState).set({ cursor, version: version + 1 }).where(and(
    eq(articleImageSweepState.id, R2_SWEEP_ID), eq(articleImageSweepState.version, version),
  ));
}
