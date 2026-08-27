/** @tier 1 @req REQ-B18 */
import { describe, expect, it } from "vitest";
import { createTurnstileHumanCheck } from "@/infrastructure/platform/turnstile";

const INPUT = {
  token: "reader-token",
  action: "turnstile-spin-v2",
  remoteIp: "203.0.113.10",
} as const;

describe("Turnstile server-side verifier", () => {
  it("secretまたは許可hostnameが無ければ外部へ送らず安全側に止める", async () => {
    let calls = 0;
    const verifier = createTurnstileHumanCheck({}, async () => {
      calls += 1;
      return new Response();
    });

    const result = await verifier.verify(INPUT);

    expect(result.ok).toBe(false);
    expect(calls).toBe(0);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("tokenをsiteverifyへ送り、actionとhostnameまで一致した時だけ通す", async () => {
    let body = "";
    const verifier = createTurnstileHumanCheck(
      { TURNSTILE_SECRET: "server-secret", TURNSTILE_HOSTNAMES: "example.com, www.example.com" },
      async (input, init) => {
        expect(String(input)).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
        body = String(init?.body);
        return Response.json({ success: true, action: "turnstile-spin-v2", hostname: "example.com" });
      },
    );

    const result = await verifier.verify(INPUT);

    expect(result).toEqual({ ok: true, value: true });
    expect(new URLSearchParams(body).get("secret")).toBe("server-secret");
    expect(new URLSearchParams(body).get("response")).toBe("reader-token");
    expect(new URLSearchParams(body).get("remoteip")).toBe("203.0.113.10");
  });

  it("成功応答でもactionまたはhostnameが違えば拒否する", async () => {
    const verifier = createTurnstileHumanCheck(
      { TURNSTILE_SECRET: "server-secret", TURNSTILE_HOSTNAMES: "example.com" },
      async () => Response.json({ success: true, action: "login", hostname: "evil.example" }),
    );

    const result = await verifier.verify(INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});
