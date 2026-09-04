/**
 * Worker の入口。**配線だけを書く場所で、業務の判断はここに置かない。**
 *
 * --- なぜ自前の入口が要るのか ---
 * OpenNext が作る `.open-next/worker.js` は `fetch`（画面と API）しか持たない。
 * 定期実行（cron）は `scheduled` という別の入口から呼ばれるので、
 * 生成物をそのまま `main` にしていると、定期実行の受け口がどこにも無い。
 *
 * そこで生成物を包み、`fetch` はそのまま渡し、`scheduled` だけを足す。
 * 中身（何を掃除するか）は `src/` の TypeScript にあり、そちらにテストがある。
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
import { scheduleMaintenanceJobs } from "./src/infrastructure/platform/scheduled-maintenance.ts";

// キャッシュの仕組みが使う入れ物。生成物が公開しているものをそのまま通す。
// ここで落とすと、公開時に「宣言された入れ物が見つからない」で失敗する。
// @ts-expect-error: ビルド後にだけ存在する
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

const handlers = {
  fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  },

  /**
   * 定期実行。**失敗しても画面には影響しない**ので、ここでは投げ返さず記録に残す。
   * 投げると Cloudflare 側で再実行が積まれるが、掃除は次の回で拾えるので必要ない。
   */
  async scheduled(controller, env, ctx) {
    const now = new Date(controller.scheduledTime);
    scheduleMaintenanceJobs(env, ctx, now);
  },
};

export default handlers;
