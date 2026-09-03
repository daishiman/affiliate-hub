import type { ContactRateLimitKeyPort } from "@/application/ports/reader-interaction";
import { domainError, err, ok } from "@/domain/shared";

const MIN_SECRET_BYTES = 32;

/**
 * 問い合わせの回数制限用キーを作る。
 *
 * SHA-256(value)だけではIPv4などを辞書照合できるため、Workerだけが持つ
 * app secretをHMAC鍵にする。用途名を署名対象へ含め、認証cookie等の署名とは
 * 同じ出力空間を共有しない。秘密が無い環境では弱いhashへ落とさずfail-closedする。
 */
export function createContactRateLimitKeyDeriver(secret: string): ContactRateLimitKeyPort {
  return {
    async derive(scope, value) {
      if (new TextEncoder().encode(secret).byteLength < MIN_SECRET_BYTES) {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "問い合わせの送信元保護が設定されていません。", {
            suggestedAction: "運営者がアプリの署名用secretを設定してください。",
          }),
        );
      }
      try {
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const signature = await crypto.subtle.sign(
          "HMAC",
          key,
          new TextEncoder().encode(`affiliate-hub:contact-rate:v1:${scope}:${value}`),
        );
        const digest = [...new Uint8Array(signature)]
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
        return ok(digest);
      } catch {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "送信元を安全に確認できませんでした。", {
            retryable: true,
            suggestedAction: "時間をおいてから、もう一度送ってください。",
          }),
        );
      }
    },
  };
}
