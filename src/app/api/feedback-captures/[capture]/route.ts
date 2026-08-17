import { asFeedbackCaptureId } from "@/domain/shared";
import { readFeedbackCapture } from "@/infrastructure/platform/feedback-capture-r2";
import { tryGetBucket } from "@/infrastructure/platform/bucket-connection";
import { currentActor } from "@/presentation/composition";
import { ALLOWED_CAPTURE_MIME } from "@/domain/feedback";

export const dynamic = "force-dynamic";

/**
 * 改善要望に添えられた画面の写しを 1 枚渡す口。
 *
 * 4 つを守る。
 *   1. **どの作業場所のものかは、URL ではなく呼び出し元の身元から決める。**
 *      URL に作業場所を書くと、書き換えて他所の写しを指せる。
 *   2. **無いものと、他所のものは、同じ 404 にする。** 「権限がありません」と
 *      返すと、その写しが存在することだけを教えることになる。
 *   3. **保存期間を過ぎたものは渡さない。** 判定は置き場側
 *      （`readFeedbackCapture`）にあり、この口は結果を運ぶだけ。
 *   4. **保存も検索もさせない。** `no-store` と `noindex` を必ず付ける。
 *      画面の写しには、そのとき映っていたものが全部入っている。
 *
 * ログインはまだ入っていない（`identity:sample-actor`）。いまは
 * **推測できない識別子を知っている人だけが開ける**状態で、
 * ログインが入ったらこの関数の先頭に権限の判定を 1 つ足せば閉じられる。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ capture: string }> },
) {
  const { capture } = await params;
  const bucket = await tryGetBucket();
  if (bucket === null) return new Response(null, { status: 404 });

  const actor = await currentActor();
  const bytes = await readFeedbackCapture(
    bucket,
    actor.workspaceId,
    asFeedbackCaptureId(capture),
    new Date(),
  );
  if (bytes === null) return new Response(null, { status: 404 });

  return new Response(bytes, {
    headers: {
      "content-type": ALLOWED_CAPTURE_MIME,
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      // 画像として以外に解釈させない。
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}
