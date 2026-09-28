import type { ArticleThumbnailStoragePort } from "@/application/ports/blog-ops";
import {
  MAX_DERIVED_THUMBNAIL_BYTES,
  assertThumbnailIsStorable,
  isAllowedThumbnailMime,
  isThumbnailWidth,
  isDeliverableThumbnailKey,
  thumbnailContentHash,
  thumbnailGenerationPrefixOfKey,
  thumbnailObjectKey,
  type AllowedThumbnailMime,
  type ThumbnailWidth,
} from "@/domain/blogops";
import { domainError, err, ok, type DomainError, type Result } from "@/domain/shared";

/**
 * 記事サムネイルの置き場（Cloudflare R2）。
 *
 * ==========================================================================
 * 改善要望の写し（`feedback-capture-r2.ts`）と何が違うのか
 * ==========================================================================
 *
 * 同じバケットを使い、同じく「取り出す口をこちら側に 1 本置く」形だが、
 * **配る相手が違う。**写しは運営者だけに見せるもので、口には権限の判定が要る。
 * サムネイルは**読者に配る絵**なので、口は誰にでも開いている。
 *
 * その代わり写しには無い制約が付く:
 *
 *   - **同じ URL が別の絵を返してはいけない。**一覧・OGP・SNS のキャッシュに
 *     同時に載るので、途中で中身が変わると「どこかだけ古い」が残り消せない。
 *     鍵が中身の指紋を含む（`thumbnail-asset.ts`）のはこのためで、
 *     ここでは**同じ鍵への上書きを試みない**。
 *   - 1 画面に 20 枚以上並ぶ。口の中で D1 を引かない
 *     （`isDeliverableThumbnailKey` が鍵の形だけを見る門になっている）。
 *
 * 判断の全文は `docs/product/design-decisions.md` の §5。
 */

/** R2 バケットのうち、ここで使うところだけ。 */
export type ThumbnailBucket = {
  put(
    key: string,
    body: ArrayBuffer,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  get(key: string): Promise<ThumbnailObject | null>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    /*
      `uploaded` は掃除（`blog-thumbnail-sweeper.ts`）だけが見る。**必須にしない。**
      差し替えのときの削除は「この頭を丸ごと」で、置いた時刻を要らない。
      必須にすると、時刻を持たない置き場の作り物を差し替えのテストで
      毎回埋めることになり、そちらの意図（頭で消す）が読みにくくなる。
      掃除の側は、時刻が無いものを**消さない側へ倒して**扱う。
    */
    objects: readonly { key: string; uploaded?: Date }[];
    truncated: boolean;
    cursor?: string;
  }>;
};

export type ThumbnailObject = {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
  size?: number;
};

/**
 * 読者のブラウザと CDN に伝える保存期間。**1 年、かつ書き換えない宣言。**
 *
 * 言い切れるのは鍵が中身の指紋を含むからで、絵を差し替えると鍵ごと変わる。
 * 指紋を鍵に入れずにこの値を返すと、差し替えても 1 年間古い絵が出続ける
 * （読者のブラウザのキャッシュには、こちらから手が届かない）。
 */
export const THUMBNAIL_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** 取り出す口の住所。画面と `srcset` はこの文字列だけを受け取る。 */
export function blogThumbnailHref(key: string): string {
  // 鍵は `a/b/c/640.jpg` の形で、段の区切りは URL の段としてそのまま出す。
  // 段ごとに符号化するのは、鍵に使えない文字が来たときに `%2F` にせず
  // **口の門（`isDeliverableThumbnailKey`）へ同じ文字列で届ける**ため。
  return `/api/blog-thumbnails/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export type ThumbnailUpload = {
  readonly siteSlug: string;
  readonly articleSlug: string;
  readonly mimeType: AllowedThumbnailMime;
  readonly original: ArrayBuffer;
  /** 投稿する側のブラウザ（Canvas）が作った派生。作れなかった幅は入らない。 */
  readonly derived: readonly { readonly width: ThumbnailWidth; readonly bytes: ArrayBuffer }[];
};

export type StoredThumbnail = {
  /** 原本の鍵。**これを持ち回る。**材料から組み直さない。 */
  readonly objectKey: string;
  readonly mimeType: AllowedThumbnailMime;
  readonly byteLength: number;
  /** 実際に置けた派生の幅。`srcset` に並べてよいのはこれだけ。 */
  readonly derivedWidths: readonly ThumbnailWidth[];
};

/**
 * 1 世代（原本と派生）を置く。
 *
 * ==========================================================================
 * 派生が 1 枚落ちても原本を巻き戻さない理由
 * ==========================================================================
 *
 * 巻き戻すと、**原本まで置けなかったことになり運営者は何も得られない。**
 * 派生が欠けたときに起きるのは「小さい画面でも大きい絵を落とす」で、
 * 遅くはなるが絵は出る。置けた幅だけを返し、呼び出し元がそれを記録する。
 *
 * 逆に**原本が置けなかったら派生には進まない**。原本の無い世代は
 * `srcset` の親が居ない状態で、参照する側が組み立てられない。
 */
export async function putThumbnailGeneration(
  bucket: ThumbnailBucket,
  upload: ThumbnailUpload,
): Promise<Result<StoredThumbnail, DomainError>> {
  const contentHash = thumbnailContentHash(upload.original);
  const allowed = assertThumbnailIsStorable({
    mimeType: upload.mimeType,
    byteLength: upload.original.byteLength,
    width: null,
  });
  if (!allowed.ok) return allowed;

  const parts = {
    siteSlug: upload.siteSlug,
    articleSlug: upload.articleSlug,
    contentHash,
    mimeType: upload.mimeType,
  };
  const objectKey = thumbnailObjectKey({ ...parts, width: null });
  try {
    await bucket.put(objectKey, upload.original, {
      httpMetadata: { contentType: upload.mimeType, cacheControl: THUMBNAIL_CACHE_CONTROL },
    });
  } catch {
    return err(
      domainError("UPSTREAM_UNAVAILABLE", "サムネイルを保存できませんでした。", {
        suggestedAction: "少し待ってからもう一度お試しください。",
        retryable: true,
      }),
    );
  }

  const derivedWidths: ThumbnailWidth[] = [];
  for (const variant of upload.derived) {
    const storable = assertThumbnailIsStorable({
      mimeType: upload.mimeType,
      byteLength: variant.bytes.byteLength,
      width: variant.width,
    });
    // 断られた派生は黙って落とす。ここで全体を失敗にすると、
    // 原本まで無かったことになる（上の説明）。
    if (!storable.ok) continue;
    if (variant.bytes.byteLength > MAX_DERIVED_THUMBNAIL_BYTES) continue;
    try {
      await bucket.put(thumbnailObjectKey({ ...parts, width: variant.width }), variant.bytes, {
        httpMetadata: { contentType: upload.mimeType, cacheControl: THUMBNAIL_CACHE_CONTROL },
      });
      derivedWidths.push(variant.width);
    } catch {
      // 同上。置けた幅だけを返す。
    }
  }

  return ok({
    objectKey,
    mimeType: upload.mimeType,
    byteLength: upload.original.byteLength,
    // 同じ幅が 2 度来ても 1 度しか並べない。`srcset` に重複が出ると
    // ブラウザによっては後勝ちになり、どちらが使われたか説明できなくなる。
    derivedWidths: [...new Set(derivedWidths)].sort((a, b) => a - b),
  });
}

/**
 * 絵を 1 枚読み出す。**門を通らない鍵には R2 を引きに行かない。**
 *
 * 引きに行ってから 404 を返しても結果は同じに見えるが、それだと
 * バケット内の別用途（改善要望の写し・書き出しファイル）の名前を
 * 総当たりで試せる口になる。門は R2 の手前に置く。
 */
export async function readBlogThumbnail(
  bucket: ThumbnailBucket,
  key: string,
): Promise<{ readonly bytes: ArrayBuffer; readonly contentType: string } | null> {
  if (!isDeliverableThumbnailKey(key)) return null;
  const object = await bucket.get(key);
  if (object === null) return null;
  return {
    bytes: await object.arrayBuffer(),
    // 置いたときの形式を使う。鍵の拡張子から言い直すと、
    // 置き違えたときに「拡張子は jpg だが中身は png」を口が追認する。
    contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
  };
}

/**
 * 1 世代ぶんを消す。差し替えたあとの古い絵を片付けるときに使う。
 *
 * 消す対象は**呼び出し元が持っている鍵から導く**（材料から組み直さない）。
 * 記事の URL 名を変えたあとに組み直すと、置いたときと違う鍵になり空振りする。
 */
export async function deleteThumbnailGeneration(
  bucket: ThumbnailBucket,
  objectKey: string,
): Promise<Result<{ readonly deleted: number }, DomainError>> {
  const prefix = thumbnailGenerationPrefixOfKey(objectKey);
  if (prefix === null) {
    return err(
      domainError("VALIDATION_FAILED", "消せる形の鍵ではありません。", { field: "objectKey" }),
    );
  }
  let deleted = 0;
  let cursor: string | undefined;
  try {
    do {
      const page = await bucket.list({ prefix, cursor });
      for (const object of page.objects) {
        await bucket.delete(object.key);
        deleted += 1;
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor !== undefined);
  } catch {
    return err(
      domainError("UPSTREAM_UNAVAILABLE", "古いサムネイルを消せませんでした。", {
        retryable: true,
      }),
    );
  }
  return ok({ deleted });
}

/**
 * ユースケースから見た置き場。
 *
 * 上の関数群をそのまま束ねるだけで、ここで判断を足さない。
 * 判断（原本が落ちたら進まない・派生が落ちても原本は残す）は関数側にあり、
 * 束ね直すときに片方だけ変わることを避ける。
 */
export function createR2ArticleThumbnailStore(
  bucket: ThumbnailBucket,
): ArticleThumbnailStoragePort {
  return {
    async putGeneration(input) {
      // 幅の絞り込みは呼ぶ側（ユースケース）で済んでいるが、
      // 型の上でも `ThumbnailWidth` へ落としてから渡す。
      const derived = input.derived.filter(
        (d): d is { readonly width: ThumbnailWidth; readonly bytes: ArrayBuffer } =>
          isThumbnailWidth(d.width),
      );
      if (!isAllowedThumbnailMime(input.mimeType)) {
        return err(
          domainError("VALIDATION_FAILED", `この形式の画像は置けません: ${input.mimeType}`, {
            field: "mimeType",
          }),
        );
      }
      const stored = await putThumbnailGeneration(bucket, {
        siteSlug: input.siteSlug,
        articleSlug: input.articleSlug,
        mimeType: input.mimeType,
        original: input.original,
        derived,
      });
      if (!stored.ok) return stored;
      return ok({
        objectKey: stored.value.objectKey,
        derivedWidths: stored.value.derivedWidths,
      });
    },

    async deleteGeneration(objectKey) {
      return await deleteThumbnailGeneration(bucket, objectKey);
    },
  };
}
