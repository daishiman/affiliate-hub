import { buildIndexNowSubmission } from "@/domain/seo/indexnow";
import { tryGetWorkerEnv } from "@/infrastructure/platform/worker-env";

/**
 * IndexNow への送信（feat-blog-ui-builder）。
 *
 * 更新した URL を検索エンジンへ即時に知らせる。本文の形はドメイン
 * （`buildIndexNowSubmission`）が持ち、ここは鍵の取得と送信だけを行う。
 *
 * **失敗しても throw しない。** IndexNow は通知であって公開の条件ではない。
 * ここで例外を投げると、通知先の障害で記事の公開そのものが道連れになる。
 *
 * --- 鍵の扱い ---
 * 鍵（INDEXNOW_KEY）は戻り値にもログにも入れない。入るのは送信本文だけ。
 * 例外メッセージにも鍵は現れない（鍵は本文にしか居らず、fetch の失敗理由は
 * 行き先とネットワークの話しか含まない）。
 */

/** 行き先は固定。外から渡された URL を取りに行く形ではない。 */
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export type IndexNowResult =
  | { readonly status: "skipped"; readonly reason: string }
  | { readonly status: "sent"; readonly count: number }
  | { readonly status: "failed"; readonly error: string };

export async function submitToIndexNow(
  origin: string,
  urls: readonly string[],
): Promise<IndexNowResult> {
  const env = await tryGetWorkerEnv();
  const key = env["INDEXNOW_KEY"];
  if (typeof key !== "string" || key.trim() === "") {
    // 鍵が無いのは設定の状態であって故障ではない。黙って何もしないのではなく、理由を返す。
    return { status: "skipped", reason: "INDEXNOW_KEY が設定されていません。" };
  }

  const submission = buildIndexNowSubmission(origin, key, urls);
  if (submission === null) {
    return { status: "skipped", reason: "通知する URL がありません。" };
  }

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(submission),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { status: "failed", error: `IndexNow が ${response.status} を返しました。` };
    }
    return { status: "sent", count: submission.urlList.length };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return { status: "failed", error: `送信できませんでした: ${message}` };
  }
}
