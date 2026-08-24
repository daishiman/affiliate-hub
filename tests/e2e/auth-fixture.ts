import type { BrowserContext } from "@playwright/test";
import { SESSION_COOKIE_NAME } from "../../src/infrastructure/identity/session-actor";

/** ローカルD1だけで使う、推測耐性を目的にしないE2E専用値。 */
export const E2E_LOCAL_SESSION = "affiliate-hub-playwright-local-session";

export async function authenticateE2E(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: E2E_LOCAL_SESSION,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      expires: Math.floor(Date.now() / 1_000) + 60 * 60,
    },
  ]);
}
