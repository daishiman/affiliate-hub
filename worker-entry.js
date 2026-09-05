/**
 * Worker の入口。**配線だけを書く場所で、業務の判断はここに置かない。**
 *
 * --- なぜ自前の入口が要るのか ---
 * OpenNext が作る `.open-next/worker.js` は `fetch`（画面と API）しか持たない。
 * 定期実行（cron）は `scheduled` という別の入口から呼ばれるので、
 * 生成物をそのまま `main` にしていると、定期実行の受け口がどこにも無い。
 *
 * そこで生成物を包み、`fetch` はそのまま渡し、`scheduled` だけを足す。
 *
 * --- なぜここから src/ を読まないのか ---
 * ここで `src/` の TypeScript を読むと、束ねる側はそれを画面側の束とは別に
 * もう一度束ねる。同じ処理が **1 つの Worker に 2 部**入ることになり、
 * 2026-09-05 の実測でその 2 部目は 82 ファイル 791 KiB あった。
 * Cloudflare の無料枠は gzip 3072 KiB で、そこが公開の可否を決めている。
 *
 * だから定期実行の中身は画面側の束（`src/app/internal-cron/route.ts`）に置き、
 * ここは**それを叩くだけ**にする。中身にはそちらにテストがある。
 * ここに処理を書き写すと、**テストの無い場所に業務の判断が生まれる**。
 *
 * --- なぜ .js なのか ---
 * `.open-next/` はビルドで作られる場所で、リポジトリには入っていない。
 * この入口を .ts にすると、まだビルドしていない状態（CI の取得直後）で
 * 型検査が「読み込み先が無い」で必ず落ちる。tsconfig が見るのは
 * .ts / .tsx / .mts だけなので、.js のここは型検査の外側にある。
 * その代わり、ここには型で守るべき判断を置かない。
 */

// @ts-expect-error: ビルド後にだけ存在する
import openNextWorker from "./.open-next/worker.js";

// キャッシュの仕組みが使う入れ物。生成物が公開しているものをそのまま通す。
// ここで落とすと、公開時に「宣言された入れ物が見つからない」で失敗する。
// @ts-expect-error: ビルド後にだけ存在する
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

/**
 * 定期メンテナンスの内部の道筋。
 *
 * Cloudflare へ来た要求は必ず下の `fetch` を通るので、そこで 404 に落とせば
 * **外の世界にこの道は存在しない**。`scheduled` だけが生成物の `fetch` へ
 * 直に要求を渡すので、そのときだけ届く。
 */
const INTERNAL_CRON_PATH = "/internal-cron";

const handlers = {
  fetch(request, env, ctx) {
    // 外から来たものは、この道を知らないものとして返す。
    // 合言葉で守らないのは、合言葉は漏れうるが通らない道は漏れようがないため。
    if (new URL(request.url).pathname === INTERNAL_CRON_PATH) {
      return new Response("Not Found", { status: 404 });
    }
    return openNextWorker.fetch(request, env, ctx);
  },

  /**
   * 定期実行。**失敗しても画面には影響しない**ので、ここでは投げ返さず記録に残す。
   * 投げると Cloudflare 側で再実行が積まれるが、掃除は次の回で拾えるので必要ない。
   *
   * 上の `fetch` を経由せず生成物の `fetch` を直に呼ぶ。上を通すと自分で置いた
   * 404 に当たる。cron の起動時刻は問い合わせ文字列で渡す（受け側が New Date で
   * 取り直すと、実行が遅れた分だけ集計の区切りがずれる）。
   */
  async scheduled(controller, env, ctx) {
    const request = new Request(
      `https://cron.invalid${INTERNAL_CRON_PATH}?at=${controller.scheduledTime}`,
      { method: "POST", headers: { "x-internal-cron": "1" } },
    );
    ctx.waitUntil(
      openNextWorker.fetch(request, env, ctx).catch((error) => {
        console.error("[cron] 定期メンテナンスの呼び出しに失敗しました", error);
      }),
    );
  },
};

export default handlers;
