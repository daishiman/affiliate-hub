import { tryGetWorkerEnv } from "@/infrastructure/platform/worker-env";

export const dynamic = "force-dynamic";

/**
 * IndexNow の鍵ファイル配信（feat-blog-ui-builder §SEO/AI 検索）。
 *
 * IndexNow は「鍵ファイルを自分のホストで公開配信できること」を
 * サイト所有の証明にする。つまり**公開すること自体が仕組み**であり、
 * ここで返さないと通知（`submitToIndexNow`）は検証で全部捨てられる。
 * keyLocation の決まり（`https://<origin>/indexnow.txt`）はドメイン
 * （`@/domain/seo/indexnow.ts`）が持ち、ここはその置き場所の実体。
 *
 * 鍵はサーバー環境変数 INDEXNOW_KEY からだけ読む。未設定なら 404
 * （設定の状態であって故障ではない。空文字を 200 で返すと
 * 「空の鍵で検証させる」壊れた状態を配ることになる）。
 */
export async function GET(): Promise<Response> {
  const env = await tryGetWorkerEnv();
  const key = env["INDEXNOW_KEY"];
  if (typeof key !== "string" || key.trim() === "") {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(key, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
