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
 *
 * **例外メッセージは信用しない（2026-08-25 に直した）。** 以前ここは
 * 「fetch の失敗理由は行き先と網の話しか含まない」と決めてかかり、
 * 捕まえた例外の文をそのまま戻り値へ入れていた。それは fetch の実装への
 * 期待であって、このファイルが守れる約束ではない。要求本文を理由文へ写す
 * 実装（差し替えた fetch、実行環境の入れ子の Error）が 1 つ挟まれば、
 * 鍵は呼び出し元がログへ書く値の中へ自分で歩いていく。
 *
 * 期待ではなく**手当て**にする——外へ出す前に鍵を伏せ字へ置き換える。
 * 「たぶん入らない」を根拠に置く秘密は、入った日に誰も気づけない。
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
    return { status: "failed", error: `送信できませんでした: ${redactKey(message, key)}` };
  }
}

/**
 * 理由文から鍵を伏せる。
 *
 * 置き換えるのは鍵そのものだけで、文の残りは触らない。理由文は人が読んで
 * 原因へ辿るためのものなので、丸ごと捨てると今度は原因が分からなくなる。
 */
function redactKey(message: string, key: string): string {
  return key.length === 0 ? message : message.split(key).join("***");
}
