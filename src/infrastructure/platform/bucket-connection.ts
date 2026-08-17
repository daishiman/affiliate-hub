import { getBucket } from "@/db";
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
