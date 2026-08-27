import type { EditorialHumanCheckPort } from "@/application/ports/reader-interaction";
import { domainError, err, markEditorial, ok } from "@/domain/shared";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SiteverifyResponse = {
  readonly success?: unknown;
  readonly action?: unknown;
  readonly hostname?: unknown;
};

/**
 * Turnstile の server-side 検証。鍵・許可hostnameが無い環境は安全側に停止する。
 * 実 token の検証完了を装う fallback は持たない。
 */
export function createTurnstileHumanCheck(
  env: Readonly<Record<string, unknown>>,
  fetcher: typeof fetch = fetch,
): EditorialHumanCheckPort {
  const secret = typeof env.TURNSTILE_SECRET === "string" ? env.TURNSTILE_SECRET : "";
  const hostnames = new Set(
    (typeof env.TURNSTILE_HOSTNAMES === "string" ? env.TURNSTILE_HOSTNAMES : "")
      .split(",")
      .map((hostname) => hostname.trim())
      .filter(Boolean),
  );

  return markEditorial({
    async verify({ token, action, remoteIp }) {
      if (secret === "" || hostnames.size === 0) {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "自動送信よけの設定が完了していません。", {
            suggestedAction: "設定が完了するまで、運営者の別の連絡先をご利用ください。",
          }),
        );
      }
      try {
        const response = await fetcher(SITEVERIFY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: AbortSignal.timeout(10_000),
          body: new URLSearchParams({
            secret,
            response: token,
            ...(remoteIp === undefined ? {} : { remoteip: remoteIp }),
          }),
        });
        if (!response.ok) throw new Error("siteverify failed");
        const verified = (await response.json()) as SiteverifyResponse;
        if (
          verified.success !== true ||
          verified.action !== action ||
          typeof verified.hostname !== "string" ||
          !hostnames.has(verified.hostname)
        ) {
          return err(
            domainError("FORBIDDEN", "自動送信よけの確認に失敗しました。", {
              field: "humanCheckToken",
              suggestedAction: "確認欄をやり直してから、もう一度送ってください。",
            }),
          );
        }
        return ok(true as const);
      } catch {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "自動送信よけを確認できませんでした。", {
            retryable: true,
            suggestedAction: "時間をおいて、もう一度送ってください。",
          }),
        );
      }
    },
  });
}
