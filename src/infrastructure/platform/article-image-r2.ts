/**
 * 記事に貼る画像の置き場（Cloudflare R2）。
 *
 * ここが受け持つのは**物の出し入れだけ**。
 *   - 使ってよい画像かの判断 → `domain/blogops/article-image-policy.ts`
 *   - 公開 URL から鍵を引く   → `persistence/d1/article-image-repository.ts`
 *   - 誰が送ってよいかの判断 → `app/api/article-images/route.ts`
 *
 * 3 つを別々に置いているのは、置き場が判断を持ち始めると
 * 「保存できたかどうか」と「送ってよかったかどうか」が同じ関数の中で混ざり、
 * 片方を直すともう片方が黙って緩む、という壊れ方をするため。
 *
 * 署名付き URL を作らない理由は `docs/product/design-decisions.md` §5。
 */

/** R2 バケットのうち、ここで使うところだけ。 */
export type ArticleImageBucket = {
  put(
    key: string,
    body: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string; limit: number }): Promise<{
    objects: readonly { key: string; size: number; uploaded: Date }[];
    truncated: boolean;
    cursor?: string;
  }>;
};

export async function putArticleImageObject(
  bucket: ArticleImageBucket,
  key: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  await bucket.put(key, bytes, { httpMetadata: { contentType } });
}

export async function readArticleImageObject(
  bucket: ArticleImageBucket,
  key: string,
): Promise<ArrayBuffer | null> {
  const object = await bucket.get(key);
  return object === null ? null : await object.arrayBuffer();
}

export async function deleteArticleImageObject(
  bucket: ArticleImageBucket,
  key: string,
): Promise<void> {
  await bucket.delete(key);
}
