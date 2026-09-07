import { getBucket } from "@/db";
import type { ArticleImageBucket } from "./article-image-r2";
import type { CaptureBucket } from "./feedback-capture-r2";

/**
 * ファイルの置き場 (R2) への接続を取る。**無ければ null を返す。**
 *
 * `tryGetDb` と同じ考え方。Workers の外（`pnpm dev`・自動テスト）では
 * 置き場が供給されないので、例外で画面を止めない。
 * ただし**黙って仮置きに落ちない**。何で動いているかは画面に文字で出す
 * （`feedbackCaptureNotice`）。
 */
export async function tryGetBucket(): Promise<CaptureBucket | null> {
  try {
    return (await getBucket()) as unknown as CaptureBucket;
  } catch {
    return null;
  }
}

/**
 * 同じ置き場を、記事の画像として使う口から取る。
 *
 * **バケットは 1 つで、見えている面だけが違う。** 別の型で取り直すのは、
 * 写しの側が使う `list()` を記事の画像側から呼べないようにするため。
 * 呼べてしまうと、前置きを間違えた 1 行が他の用途の物まで数え上げる。
 */
export async function tryGetArticleImageBucket(): Promise<ArticleImageBucket | null> {
  try {
    return (await getBucket()) as unknown as ArticleImageBucket;
  } catch {
    return null;
  }
}
