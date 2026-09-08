import { requireWorkspaceWideCapability } from "@/domain/identity/permissions";
import {
  articleImageHref,
  articleImageKey,
  assertArticleImageIsStorable,
  MAX_ARTICLE_IMAGE_BYTES,
} from "@/domain/blogops/article-image-policy";
import { asArticleId } from "@/domain/shared";
import { ownsImageArticle, reserveArticleImage, finalizeArticleImage } from "@/infrastructure/persistence/d1/article-image-repository";
import { boundedFormData } from "@/infrastructure/http/bounded-form-data";
import { tryGetDb } from "@/infrastructure/persistence/d1/connection";
import {
  putArticleImageObject,
} from "@/infrastructure/platform/article-image-r2";
import { tryGetArticleImageBucket } from "@/infrastructure/platform/bucket-connection";
import { requestOriginFromWebRequest, signedInActor } from "@/presentation/composition";

export const dynamic = "force-dynamic";

/**
 * 記事に貼る画像を 1 枚受け取る口。
 *
 * Worker が認可・容量・形式を検査してから R2 へ保存する現行方式は、
 * 2026-09-06 に本人承認済み。旧 direct PUT 案を含む判断履歴は
 * docs/spec/feat-article-block-editor/image-upload-decisions.md に集約する。
 *
 * --- ここが守る 4 つ ---
 *
 * 1. **ログインしていない人からは受け取らない。** 置き場に物を置ける口は、
 *    開いているだけで置き場そのものを差し出しているのと同じ。
 * 2. **どの作業場所に置くかは、送られてきた値ではなく呼び出し元の身元で決める。**
 *    書き手が指定できると、他社の記事の下に物を置ける。
 * 3. **置き場所（鍵）はこちらが組み立てる。** 送り手はファイルと記事 id しか渡せない。
 *    鍵を渡せると `../` を混ぜて前置きの外へ出られる。
 * 4. **形式と大きさは受け取った側で測る。** `File.type` も送り手の
 *    申告なので、本体先頭のバイト列から見分け、申告と一致するときだけ通す。
 */
export async function POST(request: Request) {
  const actor = await signedInActor();
  if (actor === null) return problem(401, "ログインしてから、もう一度お試しください。");
  if (!requireWorkspaceWideCapability(actor, "content.write", "記事画像の追加").ok) {
    return problem(403, "画像を足す権限がありません。");
  }
  const origin = request.headers.get("origin");
  if (!origin || origin === "null" || origin !== requestOriginFromWebRequest(request)) {
    return problem(403, "管理画面から画像を送ってください。");
  }
  const received = await boundedFormData(request, MAX_ARTICLE_IMAGE_BYTES + 64 * 1024);
  if (!received.ok) return problem(received.status, received.status === 413
    ? "送信内容が大きすぎます（画像は8MBまで）。" : "画像を受け取れませんでした。");
  const form = received.form;

  const file = form.get("file");
  const articleId = form.get("articleId");
  if (!(file instanceof File) || typeof articleId !== "string" || !/^[\w-]{1,128}$/.test(articleId)
    || form.getAll("file").length !== 1 || form.getAll("articleId").length !== 1
    || [...form.keys()].some((key) => key !== "file" && key !== "articleId")) {
    return problem(400, "画像と記事の指定の両方が要ります。");
  }

  const signatureBytes = await file
    .slice(0, 12)
    .arrayBuffer()
    .then((bytes) => new Uint8Array(bytes))
    .catch(() => null);
  if (signatureBytes === null) return problem(400, "画像を受け取れませんでした。");

  const storable = assertArticleImageIsStorable({
    declaredMimeType: file.type,
    byteSize: file.size,
    signatureBytes,
  });
  if (!storable.ok) return problem(400, storable.error.message);

  const bucket = await tryGetArticleImageBucket();
  const db = await tryGetDb();
  if (bucket === null || db === null) {
    // 置き場か台帳のどちらかが無い環境（`pnpm dev` など）。
    // **仮の URL を返して成功に見せない。** 貼れたつもりで書き進めた記事が、
    // 保存したあとに全部穴になる方がずっと痛い。
    return problem(503, "この環境では画像を保存できません（置き場が未接続です）。");
  }

  try {
    if (!(await ownsImageArticle(db, actor.workspaceId, articleId))) {
      return problem(404, "画像を追加する記事が見つかりません。");
    }
  } catch {
    return problem(503, "記事を確認できませんでした。もう一度お試しください。");
  }

  const imageId = crypto.randomUUID();
  const key = articleImageKey(
    actor.workspaceId,
    asArticleId(articleId),
    imageId,
    storable.value.extension,
  );

  try {
    // 予約が先。R2だけ成功した場合も、未完了予約として後日回収できる。
    await reserveArticleImage(db, {
      id: imageId,
      workspaceId: actor.workspaceId,
      articleId: asArticleId(articleId),
      objectKey: key,
      mimeType: storable.value.mimeType,
      byteSize: file.size,
    });
    await putArticleImageObject(bucket, key, await file.arrayBuffer(), storable.value.mimeType);
    if (!(await finalizeArticleImage(db, actor.workspaceId, imageId))) {
      return problem(502, "画像を保存できませんでした。もう一度お試しください。");
    }
  } catch {
    // finalizeの応答不明で既にreadyになっている可能性もある。ここでR2を消さない。
    // pending/未参照readyの回収と、遅延putの残存確認は永続台帳を持つ日次処理へ。
    return problem(502, "画像を保存できませんでした。もう一度お試しください。");
  }

  return Response.json(
    { url: articleImageHref(imageId) },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * 断り方を 1 か所にまとめる。
 *
 * 書き分けられる余地を残すと、いつか片方だけ理由が詳しくなり、
 * 「権限が無い」と「そもそも無い」の差が外から読めてしまう。
 */
function problem(status: number, message: string): Response {
  return Response.json(
    { message },
    { status, headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } },
  );
}
