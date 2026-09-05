import { scheduleMaintenanceJobs } from "@/infrastructure/platform/scheduled-maintenance";
import { tryGetWorkerEnv } from "@/infrastructure/platform/worker-env";

export const dynamic = "force-dynamic";

/**
 * 定期メンテナンスの内部入口。**外からは届かない。**
 *
 * --- なぜ画面と同じ束の中に置くのか ---
 * Worker には束が 2 つある。OpenNext が作る画面・API の束（`handler.mjs`）と、
 * 入口（`worker-entry.js`）が cron のために別途束ねる分である。
 * 入口が `src/` を直に読むと、同じ TypeScript が **1 つの Worker に 2 部**入る。
 * 2026-09-05 の実測で、その 2 部目は 82 ファイル 791 KiB あった。
 * Cloudflare の無料枠は gzip 3072 KiB で、そこが公開の可否を決めている。
 *
 * だから cron の中身は画面側の束に一本化し、入口は「叩くだけ」に痩せさせる。
 * 呼ぶ仕事も、守り方も、記録の出し方も変えていない。変えたのは**呼ばれる道**だけである。
 *
 * --- なぜ外から届かないのか ---
 * Cloudflare へ来た要求は、必ず入口（`worker-entry.js`）の `fetch` を通る。
 * その `fetch` がこの道筋を 404 で落とすので、**外の世界にこの道は存在しない**。
 * 合言葉で守っていないのは、合言葉は漏れうるが、通らない道は漏れようがないため。
 * 入口が呼ぶときだけ、生成物の `fetch` へ直に要求を渡すので、この関数へ届く。
 *
 * 二重に、ここでも入口が付ける印を確かめる。入口の 404 が先に効くので
 * この検査が単独で守っているわけではないが、入口を書き換えた人に
 * 「ここは外向きの道ではない」と知らせる印になる。
 */
export async function POST(request: Request): Promise<Response> {
  if (request.headers.get("x-internal-cron") !== "1") {
    return new Response("Not Found", { status: 404 });
  }

  const at = new URL(request.url).searchParams.get("at");
  const parsed = at === null ? Number.NaN : Number(at);
  const now = Number.isFinite(parsed) ? new Date(parsed) : new Date();

  const env = await tryGetWorkerEnv();

  /**
   * 仕事ごとに独立した待ち行列へ載せる、という配線をここでも保つ。
   *
   * `scheduleMaintenanceJobs` は `waitUntil` へ 1 つずつ載せることで
   * 「1 つの失敗が他の定期処理を巻き込まない」ようにしている。
   * ここで実行文脈をそのまま渡さず自前の受け皿にするのは、
   * この関数が返ったあとに仕事が消えないことを、束ね方に依らず確かめられるため。
   * 各仕事は自分で例外を捕まえているので、`allSettled` で待ち切ってよい。
   */
  const pending: Promise<unknown>[] = [];
  scheduleMaintenanceJobs(env, { waitUntil: (task) => void pending.push(task) }, now);
  await Promise.allSettled(pending);

  return new Response(null, { status: 204 });
}
