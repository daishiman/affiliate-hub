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
import { sweepExpiredCaptures } from "./src/infrastructure/platform/feedback-capture-r2.ts";
import { runFeedbackDiagnosticsPurge } from "./src/infrastructure/platform/feedback-diagnostics-purge.ts";
import {
  runPublicationDeliveryAuditFlush,
  runScheduledDistribution,
} from "./src/infrastructure/platform/distribution-scheduler.ts";
import { runSeoMeasurementCollection } from "./src/infrastructure/platform/seo-measurement-scheduler.ts";
import { sweepUnreferencedThumbnails } from "./src/infrastructure/platform/blog-thumbnail-sweeper.ts";

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
    ctx.waitUntil(
      (async () => {
        if (env.BUCKET === undefined) {
          console.warn("[sweep] 置き場がつながっていないので、掃除を行いませんでした");
          return;
        }
        try {
          const result = await sweepExpiredCaptures(env.BUCKET, now);
          console.log(
            `[sweep] 期限切れの画面の写しを ${result.deleted} 件消しました` +
              (result.finished ? "" : "（上限に達したため、続きは次の回で消します）"),
          );
        } catch (error) {
          // 掃除できなくても、読み出し側が期限切れを渡さないので外へは出ない。
          console.error("[sweep] 掃除に失敗しました", error);
        }
      })(),
    );

    /*
     * 配信監査outbox。外部投稿とは別の待ち行列に置く。
     * 監査保存の障害で投稿側を再実行すると外部二重送信になるため、監査だけを再試行する。
     */
    ctx.waitUntil(
      (async () => {
        if (env.DB === undefined) {
          console.warn("[distribution-audit] 保存先がつながっていないので、監査を再送できませんでした");
          return;
        }
        try {
          const result = await runPublicationDeliveryAuditFlush(env.DB);
          console.log("[distribution-audit] 配信監査を処理しました", result);
        } catch {
          // outboxには完全payloadが残る。秘密やDB応答は出さず、次のcronで同じIDを再試行する。
          console.error("[distribution-audit] 配信監査の処理に失敗しました");
        }
      })(),
    );

    /*
     * 外部媒体の予約配信。保持期限の2処理とは独立した待ち行列に置く。
     * provider障害で配信が失敗しても、写し・技術診断の削除を止めない。
     */
    ctx.waitUntil(
      (async () => {
        if (env.DB === undefined) {
          console.warn("[distribution] 保存先がつながっていないので、予約配信を行いませんでした");
          return;
        }
        try {
          const result = await runScheduledDistribution(env.DB, env, now);
          console.log("[distribution] 予約配信を処理しました", {
            scanned: result.scanned,
            claimed: result.claimed,
            published: result.published,
            retryScheduled: result.retryScheduled,
            failed: result.failed,
            skipped: result.skipped,
          });
        } catch {
          // 秘密やprovider応答を出さない。詳細はPublicationの安全化済みlastErrorへ残る。
          console.error("[distribution] 予約配信の処理に失敗しました");
        }
      })(),
    );

    /*
     * 技術診断の保持期限（REQ-FB08 / REQ-TM09）。
     *
     * **写しの掃除とは別の待ち行列にする。** 一つにまとめると、
     * 置き場がつながっていない環境（上の early return）で、こちらまで
     * 一緒に止まる。消えないまま「消えます」と画面に書き続けることになる。
     */
    ctx.waitUntil(
      (async () => {
        if (env.DB === undefined) {
          console.warn("[retention] 保存先がつながっていないので、技術情報を消せませんでした");
          return;
        }
        try {
          const result = await runFeedbackDiagnosticsPurge(env.DB, now);
          console.log(
            `[retention] 技術情報を ${result.purged} 件消しました` +
              `（作業場所 ${result.workspaces} 件）` +
              (result.unfinished.length === 0
                ? ""
                : `（上限に達したため、続きは次の回で消します：${result.unfinished.join(", ")}）`),
          );
          // 失敗した作業場所は、消えずに残っている。次の回が同じ行を拾い直す。
          // 黙っていると「消えたはず」のまま何年も残るので、必ず出す。
          for (const failure of result.failures) {
            console.error(`[retention] ${failure.workspaceId}: ${failure.message}`);
          }
        } catch (error) {
          console.error("[retention] 技術情報の削除に失敗しました", error);
        }
      })(),
    );

    /*
     * SEO / AEO の計測（受入 A1）。
     *
     * **掃除や配信とは別の待ち行列にする。** 外向きの読み取りを含むので
     * 一番落ちやすく、まとめると外部の不調が保持期限の削除を巻き添えにする。
     * 収集は自動反映を止めていても続ける。止めるのは書き換えだけで、
     * 何が起きているかを見せるのは止めない。
     */
    ctx.waitUntil(
      (async () => {
        if (env.DB === undefined) {
          console.warn("[seo] 保存先がつながっていないので、計測を行いませんでした");
          return;
        }
        try {
          const result = await runSeoMeasurementCollection(env.DB, env, now);
          console.log(`[seo] ${result.sites} 件のブログを計測しました`, {
            collected: result.outcomes.length,
          });
          // 見送った回は、所見が増えないだけで失敗には見えない。
          // 理由を出さないと「動いているのに何も出ない」に見える。
          for (const outcome of result.outcomes) {
            if (outcome.skippedReason !== null) {
              console.warn(`[seo] ${outcome.siteSlug}/${outcome.source}: ${outcome.skippedReason}`);
            }
          }
          for (const failure of result.failures) {
            console.error(`[seo] ${failure.siteSlug}: ${failure.message}`);
          }
        } catch (error) {
          console.error("[seo] 計測に失敗しました", error);
        }
      })(),
    );

    /*
     * 参照が外れた古い表紙（サムネイル）の掃除。
     *
     * **置き場と台帳の両方が要る**（消してよいかは台帳が決める）ので、
     * 上のどれとも条件が違う。片方だけ欠けている環境で黙って止まると
     * 「毎晩動いているのに減らない」に見えるため、理由を出す。
     */
    ctx.waitUntil(
      (async () => {
        if (env.BUCKET === undefined || env.DB === undefined) {
          console.warn("[thumbnail-sweep] 置き場か台帳がつながっていないので、掃除を行いませんでした");
          return;
        }
        try {
          const result = await sweepUnreferencedThumbnails(env.BUCKET, env.DB, now);
          // 見送りは失敗ではないが、黙ると「動いているのに何も消えない」に見える。
          if (result.skipped !== null) {
            console.warn(`[thumbnail-sweep] 掃除を見送りました: ${result.skipped}`);
            return;
          }
          console.log(
            `[thumbnail-sweep] 参照の外れた表紙を ${result.deleted} 枚消しました` +
              `（台帳が参照している世代 ${result.referenced} 件）` +
              (result.finished ? "" : "（上限に達したため、続きは次の回で消します）"),
          );
        } catch (error) {
          console.error("[thumbnail-sweep] 掃除に失敗しました", error);
        }
      })(),
    );
  },
};

export default handlers;
