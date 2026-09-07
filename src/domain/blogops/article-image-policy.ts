import { type DomainError, type Result, domainError, err, ok } from "../shared";
import type { ArticleId, WorkspaceId } from "../shared";

/**
 * 記事に貼る画像の決まり。
 *
 * --- 一番大事な 1 行 ---
 *
 * **書き手に置き場の住所を触らせない。** 画像の URL を手で入れる欄を作ると、
 * その欄には何でも書ける。他所のサーバーの画像を指せば、読者がページを開くたびに
 * その相手へ読者の IP と参照元が渡る。消えた画像は記事の中で穴になり、
 * 差し替えられた画像は記事の中で別のものに変わる。**書き手に悪意が無くても起きる。**
 *
 * だから画像は「送る」しかできない。送られたものだけが記事に入り、
 * どこに置くかはここ（＝送られた側）が決める。
 *
 * 転送方式の採否はこの domain の責務ではない。Worker が認可・容量・形式を検査して
 * R2 へ保存する現行方式は 2026-09-06 に本人承認済みで、判断履歴は
 * docs/spec/feat-article-block-editor/image-upload-decisions.md に集約する。
 * 本ファイルは形式・容量・キー・猶予の規則だけを持つ。
 */

/**
 * 受け取ってよい画像の種類と、その拡張子。
 *
 * **SVG は入っていない。** SVG は画像の顔をした文書で、中に script を書ける。
 * `<img>` から読む限りは動かないが、置き場の住所を直接開かれた場合に
 * 同じ出どころの文書として動く余地が残る。
 * 「たぶん大丈夫な経路しか無い」で通すと、経路が 1 本増えた日に破れる。
 */
export const ARTICLE_IMAGE_EXTENSION = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
} as const satisfies Readonly<Record<string, string>>;

export type ArticleImageMimeType = keyof typeof ARTICLE_IMAGE_EXTENSION;

export const ALLOWED_ARTICLE_IMAGE_MIME = Object.keys(ARTICLE_IMAGE_EXTENSION);

/**
 * 1 枚の上限。
 *
 * 記事の挿絵として現実的な大きさより少し広く取る。狭くすると、
 * 書き手はカメラの写真をそのまま貼れず、縮める道具を探しに行くことになる。
 * 広げすぎないのは、送る側の回線と Worker の実行時間の両方を守るため。
 */
export const MAX_ARTICLE_IMAGE_BYTES = 8 * 1024 * 1024;
export const ARTICLE_IMAGE_OBJECT_PREFIX = "article-images/";

/**
 * 置き場所の決め方。**ここ 1 か所だけが知っている。**
 *
 * 作業場所と記事で階層を分けるのは、記事を消したときに
 * その記事の分だけを前置き 1 つで数え上げられるようにするため。
 * 2 か所で組み立てると、片方だけ直したときに
 * 「保存はできるのに出てこない」が起きる（先例: `feedbackCaptureKey`）。
 */
export function articleImageKey(
  workspaceId: WorkspaceId,
  articleId: ArticleId,
  imageId: string,
  extension: string,
): string {
  return `${ARTICLE_IMAGE_OBJECT_PREFIX}${String(workspaceId)}/${String(articleId)}/${imageId}.${extension}`;
}

/** 旧孤児の採用は実際のuploadが生成するキーだけ。他用途・不正階層は掃除しない。 */
export function parseArticleImageKey(key: string): {
  workspaceId: WorkspaceId; articleId: ArticleId; imageId: string; mimeType: ArticleImageMimeType;
} | null {
  const match = /^article-images\/([\w-]{1,128})\/([\w-]{1,128})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(png|jpg|webp|gif)$/.exec(key);
  if (match === null) return null;
  const mimeType = (Object.entries(ARTICLE_IMAGE_EXTENSION).find(([, extension]) => extension === match[4])?.[0]) as ArticleImageMimeType | undefined;
  return mimeType === undefined ? null : { workspaceId: match[1] as WorkspaceId, articleId: match[2] as ArticleId, imageId: match[3], mimeType };
}

/** 台帳が壊れて別用途のキーを指していても、物理削除を許可しない。 */
export function isOwnedArticleImageKey(image: {
  workspaceId: WorkspaceId; articleId: ArticleId; id: string; mimeType: string; objectKey: string;
}): boolean {
  const extension = ARTICLE_IMAGE_EXTENSION[image.mimeType as ArticleImageMimeType];
  return extension !== undefined && /^[\w-]{1,128}$/.test(image.workspaceId)
    && /^[\w-]{1,128}$/.test(image.articleId) && /^[\w-]{1,128}$/.test(image.id)
    && image.objectKey === articleImageKey(image.workspaceId, image.articleId, image.id, extension);
}

/**
 * 取り出す口の住所。記事の本文にはこの文字列だけが入る。
 *
 * **置き場の鍵をそのまま URL にしない。** 鍵には作業場所の id が入っており、
 * URL に出すと、公開ページの HTML を読むだけで他社の作業場所 id が拾える。
 * ここが返すのは覚えのない 1 語だけで、どの鍵を指すかは口の側が表から引く。
 * 引く先が 1 つしかないので、鍵の付け替え（画像の差し替え）も口の側だけで済む。
 */
export function articleImageHref(imageId: string): string {
  return `/api/article-images/${encodeURIComponent(imageId)}`;
}

/**
 * 先頭のバイト列から、記事に保存できる画像形式を見分ける。
 *
 * MIME の申告やファイル名は使わない。どちらも送る側が自由に書けるため。
 * 判定に足りない短いデータも、知らない形式と同じく null に倒す。
 */
export function detectArticleImageMimeType(
  signatureBytes: Uint8Array,
): ArticleImageMimeType | null {
  if (hasBytesAt(signatureBytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (hasBytesAt(signatureBytes, 0, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (
    hasBytesAt(signatureBytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytesAt(signatureBytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }
  if (
    hasBytesAt(signatureBytes, 0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    hasBytesAt(signatureBytes, 0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return "image/gif";
  }
  return null;
}

function hasBytesAt(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

/** 送られてきた画像の申告と、受け取った側が測った値。 */
export type ArticleImageSubmission = {
  readonly declaredMimeType: string;
  readonly byteSize: number;
  readonly signatureBytes: Uint8Array;
};

/**
 * 置き場へ渡してよい画像かを確かめる。
 *
 * ここを通らないものは置き場へ渡さない。**「あとで消す」ではなく「入れない」。**
 * 入れてしまうと、消すまでの間その URL は生きており、
 * 消したかどうかを確かめる仕事がもう 1 つ増える。
 */
export function assertArticleImageIsStorable(
  submission: ArticleImageSubmission,
): Result<
  { readonly extension: string; readonly mimeType: ArticleImageMimeType },
  DomainError
> {
  if (submission.byteSize <= 0) {
    return err(
      domainError("VALIDATION_FAILED", "中身のない画像は保存できません。", {
        field: "file",
      }),
    );
  }
  if (submission.byteSize > MAX_ARTICLE_IMAGE_BYTES) {
    return err(
      domainError("VALIDATION_FAILED", "画像が大きすぎます（8MB まで）。", {
        field: "file",
        suggestedAction: "画像を小さくしてから、もう一度お試しください。",
      }),
    );
  }

  const mimeType = detectArticleImageMimeType(submission.signatureBytes);
  if (mimeType === null) {
    return err(
      domainError(
        "VALIDATION_FAILED",
        "この形式の画像は使えません（png・jpeg・webp・gif のみ）。",
        { field: "file" },
      ),
    );
  }
  if (submission.declaredMimeType !== mimeType) {
    return err(
      domainError("VALIDATION_FAILED", "画像の申告形式と中身が一致しません。", {
        field: "mimeType",
      }),
    );
  }

  return ok({ extension: ARTICLE_IMAGE_EXTENSION[mimeType], mimeType });
}

// --- 使われなくなった画像の回収 ---------------------------------------------

/**
 * 送られてから、掃除が見始めるまでの猶予。
 *
 * **書き手が画像を貼ってから記事を保存するまでの時間**を吸収する。
 * この猶予の中にある画像は、まだ記事のどこからも参照されていなくて当たり前で、
 * 「参照が無い」を理由に消すと、下書き中の絵が目の前で穴になる。
 */
export const ARTICLE_IMAGE_UPLOAD_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * 一度は参照されていた画像を、外されてから消すまでの猶予。
 *
 * 書き手は画像を消してから「やっぱり戻す」ことがある。
 * 外れた瞬間に消すと、戻す道が無くなる（同じ URL は二度と作れない）。
 */
export const ARTICLE_IMAGE_UNREFERENCED_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

/** 掃除が 1 枚について知っていること。 */
export type ArticleImageReclaimCandidate = {
  /** いま記事の本文から参照されているか（点検で数え直した結果）。 */
  readonly referencedNow: boolean;
  /** 置き場へ入った時刻。 */
  readonly createdAt: Date;
  /** 参照されていると最後に確かめられた時刻。一度も無ければ null。 */
  readonly lastReferencedAt: Date | null;
};

/**
 * 未参照画像の回収猶予が経過したか。
 *
 * **消すのは取り返しがつかない。** 同じ URL は二度と作れないので、
 * 迷ったら残す側に倒す。残った画像は置き場の容量を食うだけで、
 * 次の回にもう一度判断できる。trueでも、この後D1で現参照と猶予を再評価して
 * 不可逆なdeletingへ移すまでは物理削除しない。
 */
export function shouldReclaimArticleImage(
  candidate: ArticleImageReclaimCandidate,
  now: Date,
): boolean {
  // いま使われているものは、どれだけ古くても消さない。
  if (candidate.referencedNow) return false;

  /*
    ここから先は「使われていない」画像だが、**2 種類ある**。猶予を分ける。

    ① 一度も貼られなかった（`lastReferencedAt === null`）
       送ったが結局使わなかった、下書きごと捨てた、送り直した、のいずれか。
       戻したい対象が記事の中に一度も存在しないので、待っても誰も得をしない。
       短い猶予（送信から 24 時間）で回収する。
       ここを 30 日にすると、送り直すたびに 1 枚ずつ置き場に沈む。

    ② 貼られていたが外された（`lastReferencedAt` あり）
       書き手が「やっぱり戻す」と言う余地がある。同じ URL は二度と作れないので、
       外れてから 30 日は残す。記事の中に一度は存在した、という差が猶予の差になる。
  */
  const since =
    candidate.lastReferencedAt === null
      ? { at: candidate.createdAt, grace: ARTICLE_IMAGE_UPLOAD_GRACE_MS }
      : { at: candidate.lastReferencedAt, grace: ARTICLE_IMAGE_UNREFERENCED_GRACE_MS };

  return now.getTime() - since.at.getTime() >= since.grace;
}
