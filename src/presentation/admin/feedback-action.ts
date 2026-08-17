"use server";

import { currentActor, feedbackUseCases } from "@/presentation/composition";
import type { FeedbackSubmission } from "@/presentation/ui";

/**
 * 改善したいことを受け取る。
 *
 * 画面から呼ぶのはこの関数だけで、中身は
 * **REST / バックエンド MCP と同じユースケース**（`submit_feedback`）を呼ぶ。
 * 画面用の受け口を別に作らない。作った時点で、
 * 「画面から送ったものだけ形式が違う」が静かに生まれる。
 *
 * 権限（`feedback.submit` を持っているか）はユースケース側が見る。
 * ここで見ると、入口ごとに判定が分かれて片方が緩くなる。
 */
export async function submitFeedbackAction(
  submission: FeedbackSubmission,
): Promise<{ readonly message: string }> {
  const capture = submission.capture;
  const image = capture === null ? null : base64ToBytes(capture.imageBase64);
  const result = await feedbackUseCases().submit.execute(await currentActor(), {
    kind: submission.kind,
    body: submission.body,
    wish: submission.wish,
    origin: submission.origin,
    technical: submission.technical,
    capture:
      capture === null || image === null
        ? null
        : {
            image,
            submission: {
              redactionsBurnedIn: capture.redactionsBurnedIn,
              retainsOriginal: capture.retainsOriginal,
              redactionCount: capture.redactionCount,
              maskedElementCount: capture.maskedElementCount,
              byteLength: image.byteLength,
              mimeType: capture.mimeType,
            },
          },
  });

  if (!result.ok) {
    // 「送れません」だけで終わらせない。次にどうすればよいかまで返す。
    return { message: result.error.suggestedAction ?? result.error.message };
  }
  // 画像だけ落ちたことを黙らない。黙ると「隠したはずの箇所」の扱いが分からなくなる。
  const issue = result.value.captureIssue;
  return {
    message:
      issue === null
        ? "送りました。ありがとうございます。"
        : `要望は受け取りました。画面の写しだけは付けられませんでした（${issue}）。`,
  };
}

/** 画面から来た文字列を、そのまま保存できる形に戻す。判断はここでしない。 */
function base64ToBytes(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
