import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { blogArticleThumbnails } from "@/db/schema";
import {
  THUMBNAIL_KEY_PREFIX,
  thumbnailGenerationPrefixOfKey,
} from "@/domain/blogops/thumbnail-asset";
import type { ThumbnailBucket } from "./blog-thumbnail-r2";

/**
 * 参照が外れた古い表紙を、置き場から消す定期実行。
 *
 * ==========================================================================
 * なぜ「消す操作」ではなく「掃除」なのか
 * ==========================================================================
 *
 * 表紙を差し替えると、台帳（`blog_article_thumbnail`）の `object_key` は
 * 新しい世代を指すよう書き換わる。**そのとき古い世代は R2 に残る。**
 * 差し替えの中で消しに行くこともできるが、そうすると
 *
 *   1. 消してから台帳を書く → 途中で落ちると、台帳の指す絵が既に無い
 *   2. 台帳を書いてから消す → 途中で落ちると、古い世代が残る
 *
 * のどちらかになる。2 を選び、**残ったものをここが拾う**。1 は
 * 「記事を開くと絵が出ない」という読者に見える壊れ方になるので選べない。
 *
 * ==========================================================================
 * 台帳を読めなかったら、1 枚も消さない
 * ==========================================================================
 *
 * ここは「台帳に無い鍵」を消す。**台帳が空に見えた瞬間、全部が消える。**
 * D1 が一度応答しないだけで置き場が空になるのは、取り返しがつかない
 * （原本は運営者の手元にしか残らない）。だから台帳の読み取りが失敗したら
 * 掃除そのものを見送り、次の回へ回す。消し残りは害が小さい。
 *
 * ==========================================================================
 * 置いた直後の世代を消さない
 * ==========================================================================
 *
 * 順番は「R2 に置く → 台帳に書く」である。その隙間でここが走ると、
 * **いま上げたばかりの絵が「台帳に無い」に見える。** 隙間は数百 ms だが、
 * 掃除は毎晩走るので、いつか必ず当たる。`uploaded` が新しいものは
 * 猶予のうちに入れて手を付けない。
 */

/** 置いた直後を消さないための猶予。差し替えの途中に割り込まない長さがあればよい。 */
const SWEEP_GRACE_MS = 24 * 60 * 60 * 1000;

/** 1 回に見る件数の上限。途中で終わっても消し残るだけで、消しすぎることはない。 */
const SWEEP_LIMIT = 5_000;

export type ThumbnailSweepResult = {
  /** 実際に消した「枚数」（世代の数ではない）。 */
  readonly deleted: number;
  /** 台帳が参照している世代の数。0 なら掃除を見送る（下の判断を参照）。 */
  readonly referenced: number;
  /** 上限に達せず、置き場を端まで見終えたか。 */
  readonly finished: boolean;
};

/** 掃除を見送った理由。`null` は見送っていない。 */
export type ThumbnailSweepSkip = "台帳を読めませんでした" | "台帳に表紙が 1 件もありません";

/**
 * 台帳が指している世代の頭（`blog-thumbnails/<サイト>/<記事>/<指紋>/`）を集める。
 *
 * **鍵から頭を取る。材料から組み直さない。** 記事の URL 名は後から変えられるので、
 * 組み直すと置いたときと違う頭になり、生きている世代を「参照が外れた」と
 * 読み違えて消してしまう（`domain/blogops/thumbnail-asset.ts` の説明）。
 */
async function referencedPrefixes(db: D1Database): Promise<ReadonlySet<string> | null> {
  try {
    const rows = await drizzle(db, { schema })
      .select({ objectKey: blogArticleThumbnails.objectKey })
      .from(blogArticleThumbnails);
    const prefixes = new Set<string>();
    for (const row of rows) {
      const prefix = thumbnailGenerationPrefixOfKey(row.objectKey);
      // 読めない形の鍵は**消す側に倒さない**。台帳に在る以上、誰かが参照している。
      if (prefix !== null) prefixes.add(prefix);
    }
    return prefixes;
  } catch {
    return null;
  }
}

export async function sweepUnreferencedThumbnails(
  bucket: ThumbnailBucket,
  db: D1Database,
  now: Date,
): Promise<
  | { readonly skipped: ThumbnailSweepSkip }
  | ({ readonly skipped: null } & ThumbnailSweepResult)
> {
  const referenced = await referencedPrefixes(db);
  if (referenced === null) return { skipped: "台帳を読めませんでした" };
  /*
    **1 件も無いときは掃除しない。** 本当に 1 枚も表紙が無い状態はあり得るが、
    そのときは消すものも無い。逆に「表が空に見えているだけ」だったときの
    被害は置き場の全消しなので、区別が付かない以上、何もしない側へ倒す。
  */
  if (referenced.size === 0) return { skipped: "台帳に表紙が 1 件もありません" };

  const graceLine = new Date(now.getTime() - SWEEP_GRACE_MS);
  let deleted = 0;
  let seen = 0;
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: THUMBNAIL_KEY_PREFIX, cursor });
    for (const object of page.objects) {
      seen += 1;
      // `uploaded` を返さない置き場では、猶予を判定できない。**消さない側へ倒す。**
      if (object.uploaded === undefined || object.uploaded > graceLine) continue;
      const prefix = thumbnailGenerationPrefixOfKey(object.key);
      if (prefix === null || referenced.has(prefix)) continue;
      await bucket.delete(object.key);
      deleted += 1;
    }
    cursor = page.truncated ? page.cursor : undefined;
    if (seen >= SWEEP_LIMIT) {
      return { skipped: null, deleted, referenced: referenced.size, finished: false };
    }
  } while (cursor !== undefined);
  return { skipped: null, deleted, referenced: referenced.size, finished: true };
}
