import { requireWorkspaceWideCapability } from "@/domain/identity/permissions";
import { articleImageHref } from "@/domain/blogops/article-image-policy";
import { findArticleImage, isArticleImagePublic, ownsImageArticle } from "@/infrastructure/persistence/d1/article-image-repository";
import { tryGetDb } from "@/infrastructure/persistence/d1/connection";
import { readArticleImageObject } from "@/infrastructure/platform/article-image-r2";
import { tryGetArticleImageBucket } from "@/infrastructure/platform/bucket-connection";
import { signedInActor } from "@/presentation/composition";

export const dynamic = "force-dynamic";

/** 公開記事から参照される画像と、権限のある書き手の下書きプレビューを返す。 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ image: string }> },
) {
  try {
    const { image } = await params;
    // percent-encoded別名で、本文参照の照合と実際の取得先を食い違わせない。
    if (new URL(request.url).pathname !== articleImageHref(image)) return notFound();
    const [db, bucket] = await Promise.all([tryGetDb(), tryGetArticleImageBucket()]);
    if (db === null || bucket === null) return notFound();
    const record = await findArticleImage(db, image);
    if (record === null) return notFound();
    if (!(await isArticleImagePublic(db, record))) {
      const actor = await signedInActor();
      if (actor === null || actor.workspaceId !== record.workspaceId
        || !requireWorkspaceWideCapability(actor, "content.read", "記事画像の確認").ok
        || !(await ownsImageArticle(db, actor.workspaceId, record.articleId))) return notFound();
    }
    const bytes = await readArticleImageObject(bucket, record.objectKey);
    if (bytes === null) return notFound();
    return new Response(bytes, {
      headers: {
        "content-type": record.mimeType,
        // 公開停止と下書きの認可変更を次のリクエストに反映する。
        "cache-control": "private, no-store",
        "content-security-policy": "default-src 'none'; sandbox",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    // 存在や公開可否を確かめられないときにも画像を開示しない。
    return notFound();
  }
}

function notFound(): Response {
  return new Response(null, {
    status: 404,
    headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" },
  });
}
