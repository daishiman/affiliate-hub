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

const signedUrlStub = registerStub({
  id: "storage:signed-url",
  port: "StoragePort.getSignedUrl",
  label: "ファイルの一時公開URL発行",
  blockedBy:
    "R2 の署名付きURLは公開バケットまたは Worker 経由の配信方針を決めてから実装する。現状は公開バケットの固定URLで代替できる",
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
