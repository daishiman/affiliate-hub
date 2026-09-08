import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { ARTICLE_IMAGE_OBJECT_PREFIX, ARTICLE_IMAGE_UPLOAD_GRACE_MS, isOwnedArticleImageKey, parseArticleImageKey } from "@/domain/blogops/article-image-policy";
import type { WorkspaceId } from "@/domain/shared";
import {
  type ArticleImageRecord,
  adoptOrphanArticleImage,
  advanceArticleImageSweepState,
  claimArticleImageDeletion,
  completeArticleImageDeletion,
  findArticleImageForCleanup,
  listArticleImagesForSweep,
  markArticleImagesChecked,
  markArticleImagesReferenced,
  markArticleImagesUnreferenced,
  referencedArticleImageIds,
  readArticleImageSweepState,
} from "../persistence/d1/article-image-repository";
import type { DrizzleD1 } from "../persistence/d1/link-inbox-repository";
import { deleteArticleImageObject, type ArticleImageBucket } from "./article-image-r2";

/** 最終点検時刻の古い順で循環する。使用中の500枚が後続を塞がない。 */
export const ARTICLE_IMAGE_SWEEP_LIMIT = 500;
export const ARTICLE_IMAGE_ORPHAN_PAGE_LIMIT = 100;

export type ArticleImageReclaimResult = {
  readonly scanned: number;
  readonly reclaimed: number;
  readonly kept: number;
  readonly failed: number;
  /** 台帳のキーが正規の保存先と一致せず、安全のため保留した枚数。 */
  readonly deferred: number;
  readonly orphanScanned: number;
  readonly orphanReclaimed: number;
  readonly orphanFailed: number;
};

/**
 * 画像の参照を点検する。本文・公開JSON・別記事へのコピー・復元対象を保護する。
 *
 * D1の原子的claimと本文書込triggerを共有し、未参照確認とR2削除の競合を閉じる。
 * 期限付きleaseではないため、遅延した削除が新しい参照を壊すこともない。
 * Worker scheduledの軽い依存経路を維持し、createDepsを呼ばない。
 */
export async function runArticleImageReclaim(
  binding: D1Database,
  bucket: ArticleImageBucket,
  now: Date,
): Promise<ArticleImageReclaimResult> {
  const db = drizzle(binding, { schema });
  const cutoff = new Date(now.getTime() - ARTICLE_IMAGE_UPLOAD_GRACE_MS);
  const candidates = await listArticleImagesForSweep(db, cutoff, ARTICLE_IMAGE_SWEEP_LIMIT);
  const groups = new Map<WorkspaceId, ArticleImageRecord[]>();
  for (const image of candidates) {
    const group = groups.get(image.workspaceId);
    if (group === undefined) groups.set(image.workspaceId, [image]);
    else group.push(image);
  }
  let kept = 0;
  let failed = 0;
  let deferred = 0;
  let reclaimed = 0;
  for (const [workspaceId, images] of groups) {
    const ids = images.map((image) => image.id);
    try {
      const referenced = await referencedArticleImageIds(db, workspaceId, ids);
      const unused = images.filter((image) => !referenced.has(image.id));
      await markArticleImagesReferenced(db, workspaceId, [...referenced], now);
      await markArticleImagesUnreferenced(db, workspaceId, unused.map((image) => image.id));
      await markArticleImagesChecked(db, workspaceId, ids, now);
      kept += referenced.size;
      for (const image of unused) {
        try {
          const outcome = await reclaimImage(db, bucket, image, now);
          if (outcome === "reclaimed") reclaimed++;
          else if (outcome === "deferred") deferred++;
          else kept++;
        } catch {
          // deletingを残す。特定のR2障害で同workspaceの残りを止めない。
          failed++;
        }
      }
    } catch {
      failed += images.length;
      // 特定workspaceの障害で他workspaceの画像を永久に順番待ちにしない。
      await markArticleImagesChecked(db, workspaceId, ids, now).catch(() => undefined);
    }
  }
  const orphans = await scanOrphanImages(db, bucket, now);
  return { scanned: candidates.length, reclaimed, kept, failed, deferred, ...orphans };
}

async function reclaimImage(db: DrizzleD1, bucket: ArticleImageBucket, image: ArticleImageRecord, now: Date): Promise<"reclaimed" | "kept" | "deferred"> {
  if (!isOwnedArticleImageKey(image)) return "deferred";
  if (image.lifecycle !== "deleted" && !(await claimArticleImageDeletion(db, image, now))) return "kept";
  await deleteArticleImageObject(bucket, image.objectKey);
  if (image.lifecycle !== "deleted") await completeArticleImageDeletion(db, image.workspaceId, image.id, now);
  return "reclaimed";
}

/**
 * 1回1ページを永続cursorで循環。DB不在の旧孤児と、削除後に遅延putが残した
 * deleting/deletedの実体も拾う。失敗した1件もcursorを止めず、次の周回で再試行。
 */
async function scanOrphanImages(db: DrizzleD1, bucket: ArticleImageBucket, now: Date) {
  let orphanScanned = 0;
  let orphanReclaimed = 0;
  let orphanFailed = 0;
  try {
    const state = await readArticleImageSweepState(db);
    let page;
    try {
      page = await bucket.list({ prefix: ARTICLE_IMAGE_OBJECT_PREFIX, limit: ARTICLE_IMAGE_ORPHAN_PAGE_LIMIT, ...(state.cursor === null ? {} : { cursor: state.cursor }) });
      if (page.truncated && !page.cursor) throw new Error("article_image_scan_cursor_missing");
    } catch {
      // 古いcursorが無効になった場合も永久停止させない。削除は一切せず次回先頭へ。
      await advanceArticleImageSweepState(db, state.version, null);
      return { orphanScanned, orphanReclaimed, orphanFailed: 1 };
    }
    for (const object of page.objects) {
      orphanScanned++;
      try {
        const key = parseArticleImageKey(object.key);
        if (key === null || !Number.isFinite(object.uploaded.getTime())) continue;
        let image = await findArticleImageForCleanup(db, key.workspaceId, object.key);
        if (image === null) {
          if (now.getTime() - object.uploaded.getTime() < ARTICLE_IMAGE_UPLOAD_GRACE_MS
            || !Number.isSafeInteger(object.size) || object.size <= 0) continue;
          await adoptOrphanArticleImage(db, {
            id: key.imageId, workspaceId: key.workspaceId, articleId: key.articleId,
            objectKey: object.key, mimeType: key.mimeType, byteSize: object.size,
          }, object.uploaded);
          image = await findArticleImageForCleanup(db, key.workspaceId, object.key);
        }
        if (image !== null && image.lifecycle !== "ready") {
          if (await reclaimImage(db, bucket, image, now) === "reclaimed") orphanReclaimed++;
        }
      } catch {
        orphanFailed++;
      }
    }
    await advanceArticleImageSweepState(db, state.version, page.truncated ? page.cursor! : null);
  } catch {
    orphanFailed++;
  }
  return { orphanScanned, orphanReclaimed, orphanFailed };
}
