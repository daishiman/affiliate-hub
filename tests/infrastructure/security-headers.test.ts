/**
 * @tier 1
 * @req REQ-SEC11
 * @types infra-config, regression
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildSecurityHeaders,
  securityHeaderRouteRules,
  surfaceOf,
} from "@/infrastructure/http/security-headers";

function headersFor(surface: "public" | "admin" | "auth"): Headers {
  // タプルとして書かないと `string[][]` に推論され、`HeadersInit` が要求する
  // `[string, string][]` に代入できない（要素数 2 を型が保証しないため）。
  return new Headers(
    buildSecurityHeaders(surface).map(({ key, value }): [string, string] => [key, value]),
  );
}

describe("配信面ごとの security headers", () => {
  it.each(["public", "admin", "auth"] as const)("%s 面に必須ヘッダーを揃える", (surface) => {
    const headers = headersFor(surface);
    expect(headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(headers.get("content-security-policy")).toContain("object-src 'none'");
    expect(headers.get("content-security-policy")).toContain("base-uri 'self'");
    expect(headers.get("strict-transport-security")).toContain("max-age=");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("permissions-policy")).toContain("camera=()");
    expect(headers.get("x-frame-options")).toBeTruthy();
  });

  it("管理面と認証面は外部frameを明示的に拒否する", () => {
    for (const surface of ["admin", "auth"] as const) {
      expect(headersFor(surface).get("x-frame-options")).toBe("DENY");
      expect(headersFor(surface).get("content-security-policy")).toContain(
        "frame-ancestors 'none'",
      );
    }
  });

  it("route分類とnext.config向け規則が同じ3面を網羅する", () => {
    expect(surfaceOf("/s/gadget")).toBe("public");
    expect(surfaceOf("/admin/sites")).toBe("admin");
    expect(surfaceOf("/api/auth/callback/google")).toBe("auth");
    expect(new Set(securityHeaderRouteRules().map((rule) => rule.surface))).toEqual(
      new Set(["public", "admin", "auth"]),
    );
  });

  it("next.configが正本をresponseへ配線し、x-powered-byを抑止する", () => {
    const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
    expect(config).toContain("securityHeaderRouteRules()");
    expect(config).toMatch(/poweredByHeader:\s*false/);
  });
});
