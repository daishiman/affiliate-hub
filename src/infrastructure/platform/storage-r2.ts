import type { PortResult, StoragePort } from "@/application/ports";
import { domainError, err, ok } from "@/domain/shared";
import { registerStub, stubCall } from "../stub-registry";

/**
 * ファイル保管 (Cloudflare R2)。画像と書き出しファイル。
 */
export type R2Like = {
  put(key: string, body: ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
};

/**
 * --- 配り方はもう決まっている（2026-08-17） ---
 *
 * 署名付き URL は使わない。理由は 2 つで、
 *   1. R2 のバインディングからは作れず、アクセスキーの発行（外部資格）が要る
 *   2. 署名付き URL は**知っている人なら誰でも開ける鍵**で、配った後に閉じられない
 * 代わりに、画面の写しと同じく**取り出す口をこちら側に 1 本置く**形にする
 * （先例: `src/infrastructure/platform/feedback-capture-r2.ts` と
 *   `src/app/api/feedback-captures/[capture]/route.ts`）。
 *
 * 判断の全文は `docs/product/design-decisions.md` の §5。
 *
 * それでもここが仮のままなのは、**この置き場をまだ誰も使っていない**ため。
 * `createR2Storage` の呼び出しは 0 件で、画像も書き出しファイルも見本のままなので、
 * 取り出す口だけ先に作っても、そこから出てくるものが無い。
 */
const signedUrlStub = registerStub({
  id: "storage:signed-url",
  port: "StoragePort.getSignedUrl",
  label: "ファイルの一時公開URL発行",
  blockedBy:
    "画像・書き出しファイルの保存が本物になること（この置き場は現在どこからも使われていない）。配り方は写しと同じ Worker 経由に決定済み",
});

export function createR2Storage(bucket: R2Like, publicBaseUrl: string | null): StoragePort {
  return {
    async put(key, body, contentType): PortResult<{ key: string }> {
      try {
        await bucket.put(key, body, { httpMetadata: { contentType } });
        return ok({ key });
      } catch {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "ファイルの保存に失敗しました。", {
            retryable: true,
          }),
        );
      }
    },

    async getSignedUrl(key, _expiresInSeconds): PortResult<string> {
      // 公開バケットを設定している間は、固定URLで足りる。
      if (publicBaseUrl !== null) {
        return ok(`${publicBaseUrl.replace(/\/$/, "")}/${key}`);
      }
      return stubCall<string>(signedUrlStub, "getSignedUrl");
    },

    async delete(key): PortResult<true> {
      await bucket.delete(key);
      return ok(true);
    },
  };
}
