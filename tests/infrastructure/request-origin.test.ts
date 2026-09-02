/**
 * @tier 1
 * @req REQ-SEO01, REQ-SEO02, REQ-SEO04
 * @types equivalence, boundary, injection
 */
import { describe, expect, it } from "vitest";
import {
  requestOriginFromRequest,
  resolveRequestOrigin,
} from "@/infrastructure/http/request-origin";

describe("公開 URL の request origin", () => {
  it.each([
    ["https", "blog.example.jp", "https://blog.example.jp"],
    ["http", "localhost:8787", "http://localhost:8787"],
    ["https", "[2001:db8::1]:8443", "https://[2001:db8::1]:8443"],
  ])("許可した scheme・host・port だけを origin にする", (protocol, host, expected) => {
    expect(
      resolveRequestOrigin({
        host,
        forwardedProtocol: protocol,
        defaultProtocol: "https",
      }),
    ).toBe(expected);
  });

  it.each([
    { forwardedHost: "safe.example, attacker.example" },
    { forwardedHost: "attacker.example/path" },
    { forwardedHost: "user@attacker.example" },
    { forwardedHost: "attacker.example:0" },
    { forwardedProtocol: "https,http" },
    { forwardedProtocol: "javascript" },
  ])("曖昧または不正な forwarded header は安全側に失敗する: %o", (overrides) => {
    expect(
      resolveRequestOrigin({
        host: "internal.example",
        forwardedHost: null,
        forwardedProtocol: "https",
        defaultProtocol: "https",
        ...overrides,
      }),
    ).toBeNull();
  });

  it("Request adapter も forwarded host を同じ規則で解決する", () => {
    const request = new Request("https://internal.example/s/gadget/feed.xml", {
      headers: {
        "x-forwarded-host": "blog.example.jp",
        "x-forwarded-proto": "https",
      },
    });

    expect(requestOriginFromRequest(request)).toBe("https://blog.example.jp");
  });

  it("forwarded host が壊れていれば Request URL へ黙ってfallbackしない", () => {
    const request = new Request("https://internal.example/s/gadget/feed.xml", {
      headers: { "x-forwarded-host": "blog.example.jp, attacker.example" },
    });

    expect(requestOriginFromRequest(request)).toBeNull();
  });
});
