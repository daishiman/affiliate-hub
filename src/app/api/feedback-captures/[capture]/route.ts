import { asFeedbackCaptureId } from "@/domain/shared";
import { can } from "@/domain/identity/permissions";
import { readFeedbackCapture } from "@/infrastructure/platform/feedback-capture-r2";
import { tryGetBucket } from "@/infrastructure/platform/bucket-connection";
import { signedInActor } from "@/presentation/composition";
import { ALLOWED_CAPTURE_MIME } from "@/domain/feedback";

export const dynamic = "force-dynamic";

/**
 * 改善要望に添えられた画面の写しを 1 枚渡す口。
 *
 * 5 つを守る。
 *   1. **ログインしていない人には渡さない。** 画面の写しには、撮った人の画面が
 *      そのまま入っている。他の担当者の氏名・顧客名・下書きが写り込む。
 *      判定は `signedInActor()` で、**見本の身元へ落ちない**（`currentActor()` は落ちる）。
 *   2. **どの作業場所のものかは、URL ではなく呼び出し元の身元から決める。**
 *      URL に作業場所を書くと、書き換えて他所の写しを指せる。
 *   3. **無いものと、他所のものは、同じ 404 にする。** 「権限がありません」と
 *      返すと、その写しが存在することだけを教えることになる。
 *   4. **保存期間を過ぎたものは渡さない。** 判定は置き場側
 *      （`readFeedbackCapture`）にあり、この口は結果を運ぶだけ。
 *   5. **保存も検索もさせない。** `no-store` と `noindex` を必ず付ける。
 *
 * ## 401 と 404 を使い分ける理由
 *
 * ログインしていない  → **401**。この URL に何があるかは何も漏れない
 *                        （ログインしていない人には、どの URL でも同じ 401 が返る）。
 *                        ここを 404 にすると、利用者は「消えた」と思って
 *                        ログインし直さない。存在を隠す効果はゼロなのに、案内だけ失う。
 * ログイン済みだが権限が無い / 他所のもの / そもそも無い
 *                      → **すべて 404**。ここで言い分けると、
 *                        識別子を総当たりして「存在するもの」を数え上げられる。
 *
 * **推測しにくい識別子は、閉じたことにならない。** URL は履歴・共有・
 * 参照元ヘッダーから漏れる。閉じているのは上の 1 だけである。
 *
 * @req REQ-FB13
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ capture: string }> },
) {
  // 何よりも先に身元を見る。置き場の有無より前に置くのは、
  // 置き場が落ちているときだけ認証が飛ぶ、という順番の穴を作らないため。
  const actor = await signedInActor();
  if (actor === null) {
    return new Response(null, {
      status: 401,
      headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
    });
  }
  if (!can(actor, "feedback.read")) return notFound();

  const { capture } = await params;
  const bucket = await tryGetBucket();
  if (bucket === null) return notFound();

  const bytes = await readFeedbackCapture(
    bucket,
    actor.workspaceId,
    asFeedbackCaptureId(capture),
    new Date(),
  );
  if (bytes === null) return notFound();

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

/**
 * 「無い」「他所のもの」「権限が無い」を 1 つの応答にまとめる。
 *
 * 関数にしてあるのは、**書き分けられる余地を残さない**ため。
 * 3 か所で別々に組み立てると、いつか片方だけ本文が付いて区別が付く。
 */
function notFound(): Response {
  return new Response(null, {
    status: 404,
    headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });
}
