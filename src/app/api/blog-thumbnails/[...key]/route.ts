import { isDeliverableThumbnailKey } from "@/domain/blogops";
import { tryGetBucket } from "@/infrastructure/platform/bucket-connection";
import {
  THUMBNAIL_CACHE_CONTROL,
  readBlogThumbnail,
} from "@/infrastructure/platform/blog-thumbnail-r2";

/**
 * 記事サムネイルを 1 枚渡す口。
 *
 * ==========================================================================
 * なぜここには認証が無いのか（写しの口とは逆にしてある）
 * ==========================================================================
 *
 * 隣の `/api/feedback-captures/<id>` は 401 と 404 を厳密に使い分けている。
 * あちらが渡すのは運営者の画面の写しで、他人に見えてはいけないため。
 *
 * **サムネイルは読者に配る絵である。**記事そのものが公開されている以上、
 * その表紙を閉じる意味は無い。ここで認証を挟むと、ログインしていない読者
 * ＝ほぼ全員の一覧が絵の無い箱で埋まる。
 *
 * 代わりにこの口が負っているのは 2 つ:
 *
 *   1. **同じバケットの別用途へ手を伸ばさせない。**`isDeliverableThumbnailKey`
 *      が鍵の形だけを見る門で、R2 を引く**前**に通す。引いてから 404 を
 *      返しても見た目は同じだが、それだと `feedback-captures/...` の名前を
 *      総当たりで試せる口になる。
 *   2. **絵として以外に解釈させない。**運営者が上げた任意のバイト列を返すので、
 *      `nosniff` と `sandbox` は写しの口と同じだけ要る。
 *
 * ==========================================================================
 * 保存期間を 1 年と言い切れる理由
 * ==========================================================================
 *
 * 鍵が原本の中身の指紋を含み、絵を差し替えると鍵ごと変わるため
 * （`domain/blogops/thumbnail-asset.ts`）。指紋を鍵に入れないままこの値を
 * 返すと、差し替えても読者のブラウザには 1 年間古い絵が出続ける。
 * そこにはこちらから手が届かない。
 *
 * @req REQ-VIS01
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  // 段は `blogThumbnailHref` が段ごとに符号化しているので、段ごとに戻す。
  // 全体を 1 度に戻すと `%2F` が段の区切りに化け、門を通り抜ける形が作れる。
  const objectKey = key.map(decodeURIComponent).join("/");
  if (!isDeliverableThumbnailKey(objectKey)) return notFound();

  const bucket = await tryGetBucket();
  if (bucket === null) return notFound();

  // 門はここでも通る（`readBlogThumbnail` の中）。二重に見えるが、
  // 置き場を触る関数が単体で安全である状態を、口の側の順番に頼らせない。
  const found = await readBlogThumbnail(bucket, objectKey);
  if (found === null) return notFound();

  return new Response(found.bytes, {
    headers: {
      "content-type": found.contentType,
      "cache-control": THUMBNAIL_CACHE_CONTROL,
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}

/**
 * 「無い」「門を通らない」を 1 つの応答にまとめる。
 *
 * ここは公開の口なので存在を隠す必要は薄いが、**書き分けられる余地を残さない**
 * ために 1 つにしてある（隣の写しの口と同じ理由）。
 * `no-store` を付けるのは、404 が 1 年キャッシュされると
 * **絵を上げ直しても読者には出ない**ため。
 */
function notFound(): Response {
  return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
}
