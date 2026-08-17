import type { FeedbackCaptureStoragePort } from "@/application/ports/feedback";
import {
  ALLOWED_CAPTURE_MIME,
  assertCaptureIsStorable,
  isCaptureExpired,
} from "@/domain/feedback";
import { domainError, err, ok } from "@/domain/shared";
import type { FeedbackCaptureId, WorkspaceId } from "@/domain/shared";

/**
 * 画面の写しの置き場（Cloudflare R2）。
 *
 * --- 署名付き URL を使わない理由 ---
 *
 * R2 のバインディングからは S3 形式の署名付き URL を作れない。作るには
 * アクセスキーの発行と登録（利用者本人の作業）が要り、そこで止まる。
 * それに署名付き URL は**知っている人なら誰でも開ける鍵**なので、
 * 画面の写しのように「そのとき映っていたもの全部」が入る画像には向かない。
 *
 * ここでは**取り出す口をこちら側に 1 本置く**（`/api/feedback-captures/<id>`）。
 * 置き場の住所は外に出ず、どの作業場所のものかは口の側で決める。
 * ログインが入ったら、その口に権限の判定を足すだけで閉じられる。
 * URL を配る形にしていたら、配った先を後から閉じることはできない。
 */

/** R2 バケットのうち、ここで使うところだけ。 */
export type CaptureBucket = {
  put(
    key: string,
    body: ArrayBuffer,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  get(key: string): Promise<CaptureObject | null>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    objects: readonly { key: string; uploaded: Date }[];
    truncated: boolean;
    cursor?: string;
  }>;
};

type CaptureObject = {
  arrayBuffer(): Promise<ArrayBuffer>;
  uploaded: Date;
};

/**
 * 置き場所の決め方。**ここ 1 か所だけが知っている。**
 * 取り出す口も同じ関数を使う。2 か所で組み立てると、
 * 片方だけ直したときに「保存はできるのに出てこない」が起きる。
 */
export function feedbackCaptureKey(workspaceId: WorkspaceId, id: FeedbackCaptureId): string {
  return `feedback-captures/${String(workspaceId)}/${String(id)}.png`;
}

/** 取り出す口の住所。画面はこの文字列だけを受け取る。 */
export function feedbackCaptureHref(id: FeedbackCaptureId): string {
  return `/api/feedback-captures/${encodeURIComponent(String(id))}`;
}

/**
 * 写しを 1 枚読み出す。**保存期間を過ぎたものは無かったことにする。**
 *
 * 消す仕事（`deleteExpired`）がまだ定期実行されていないので、
 * ここで期限を見ないと「180 日で消えます」という説明だけが嘘になる。
 * 掃除が動くようになっても、この判定は残してよい（二重に守る）。
 */
export async function readFeedbackCapture(
  bucket: CaptureBucket,
  workspaceId: WorkspaceId,
  id: FeedbackCaptureId,
  now: Date,
): Promise<ArrayBuffer | null> {
  const object = await bucket.get(feedbackCaptureKey(workspaceId, id));
  if (object === null) return null;
  if (isCaptureExpired(object.uploaded, now)) return null;
  return await object.arrayBuffer();
}

export function createR2FeedbackCaptureStore(bucket: CaptureBucket): FeedbackCaptureStoragePort {
  return {
    async put(workspaceId, id, image, submission) {
      // 焼き込みの判定は domain が持つ。置き場は判断しない。
      const allowed = assertCaptureIsStorable(submission);
      if (!allowed.ok) return allowed;

      const key = feedbackCaptureKey(workspaceId, id);
      try {
        await bucket.put(key, image, {
          httpMetadata: { contentType: ALLOWED_CAPTURE_MIME },
        });
      } catch {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "画面の写しを保存できませんでした。", {
            suggestedAction: "文章だけで送ることもできます。もう一度お試しください。",
            retryable: true,
          }),
        );
      }
      return ok({ key });
    },

    async signedUrl(_workspaceId, id) {
      // 期限は URL に持たせない（持たせると、配った先を後から閉じられない）。
      // どの作業場所のものかは、取り出す口が呼び出し元の身元から決める。
      return ok(feedbackCaptureHref(id));
    },

    async deleteExpired(workspaceId, now) {
      const prefix = `feedback-captures/${String(workspaceId)}/`;
      let deleted = 0;
      let cursor: string | undefined;
      try {
        do {
          const page = await bucket.list({ prefix, cursor });
          for (const object of page.objects) {
            // 保存した時刻は置き場が持つ日付を使う。
            // 送り手の申告を信じると、期限を伸ばせてしまう。
            if (!isCaptureExpired(object.uploaded, now)) continue;
            await bucket.delete(object.key);
            deleted += 1;
          }
          cursor = page.truncated ? page.cursor : undefined;
        } while (cursor !== undefined);
      } catch {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "期限切れの写しを消せませんでした。", {
            retryable: true,
          }),
        );
      }
      return ok({ deleted });
    },
  };
}
