/** @tier 1 @req REQ-BLOG01 */
import { describe, expect, it } from "vitest";
import {
  RESERVED_SITE_HOSTNAME_LABELS,
  decideHostRouting,
  isUsableSiteLabel,
  siteHostname,
  siteSlugFromHost,
} from "@/domain/authoring";

/**
 * 住所の組み立てと読み取りを、同じ表の両側として固定する。
 *
 * ここで見たいのは「作れたのに開けない」を作れないことである。
 * つまり `siteHostname` が返した住所は、必ず `siteSlugFromHost` で
 * 元の URL 名に戻らなければならない。
 */

const BASE = "example.com";

describe("siteHostname", () => {
  it("URL 名を基底ドメインの下へ置く", () => {
    expect(siteHostname("first-lens", BASE)).toBe("first-lens.example.com");
  });

  it("基底ドメインが無い環境では住所を割り当てない", () => {
    expect(siteHostname("first-lens", null)).toBeNull();
  });

  it("ドメインになっていない値を住所にしない", () => {
    expect(siteHostname("first-lens", "localhost")).toBeNull();
    expect(siteHostname("first-lens", "   ")).toBeNull();
  });

  it("予約語は住所にしない", () => {
    for (const label of RESERVED_SITE_HOSTNAME_LABELS) {
      expect(siteHostname(label, BASE)).toBeNull();
      expect(isUsableSiteLabel(label)).toBe(false);
    }
  });

  it("住所に使えない形の URL 名を断る", () => {
    for (const bad of ["", "-lead", "trail-", "日本語", "a_b", "a".repeat(64)]) {
      expect(isUsableSiteLabel(bad)).toBe(false);
    }
  });
});

describe("siteSlugFromHost", () => {
  it("割り当てた住所は必ず元の URL 名へ戻る", () => {
    for (const slug of ["first-lens", "camera", "b2b-tools", "a1"]) {
      const host = siteHostname(slug, BASE);
      expect(host).not.toBeNull();
      expect(siteSlugFromHost(host as string, BASE)).toBe(slug);
    }
  });

  it("大文字・末尾のドット・ポート番号を同じ住所として扱う", () => {
    expect(siteSlugFromHost("First-Lens.Example.com", BASE)).toBe("first-lens");
    expect(siteSlugFromHost("first-lens.example.com.", BASE)).toBe("first-lens");
    expect(siteSlugFromHost("first-lens.example.com:8787", BASE)).toBe("first-lens");
  });

  it("本体の画面はブログとして解決しない", () => {
    expect(siteSlugFromHost("example.com", BASE)).toBeNull();
    expect(siteSlugFromHost("www.example.com", BASE)).toBeNull();
    expect(siteSlugFromHost("admin.example.com", BASE)).toBeNull();
  });

  it("基底ドメインの外と多段のラベルは受けない", () => {
    expect(siteSlugFromHost("first-lens.evil.com", BASE)).toBeNull();
    expect(siteSlugFromHost("a.b.example.com", BASE)).toBeNull();
    expect(siteSlugFromHost("notexample.com", BASE)).toBeNull();
    // 末尾一致だけで判定していると通ってしまう形。
    expect(siteSlugFromHost("evil-example.com", BASE)).toBeNull();
  });

  it("基底ドメイン未設定なら何も解決しない", () => {
    expect(siteSlugFromHost("first-lens.example.com", null)).toBeNull();
  });
});

describe("decideHostRouting", () => {
  it("住所未設定の環境は今までどおり素通しする", () => {
    expect(
      decideHostRouting({ host: "localhost:3000", pathname: "/admin", baseDomain: null }),
    ).toEqual({ kind: "pass" });
  });

  it("ブログの住所は読者向けの画面へ差し替える", () => {
    expect(
      decideHostRouting({ host: "first-lens.example.com", pathname: "/", baseDomain: BASE }),
    ).toEqual({ kind: "rewrite", slug: "first-lens", pathname: "/s/first-lens" });

    expect(
      decideHostRouting({
        host: "first-lens.example.com",
        pathname: "/blog/hello",
        baseDomain: BASE,
      }),
    ).toEqual({ kind: "rewrite", slug: "first-lens", pathname: "/s/first-lens/blog/hello" });
  });

  it("ブログの住所から管理画面と API を開かせない", () => {
    for (const pathname of ["/admin", "/admin/sites", "/api/auth/session", "/signin", "/mcp"]) {
      expect(
        decideHostRouting({ host: "first-lens.example.com", pathname, baseDomain: BASE }),
      ).toEqual({ kind: "not-found" });
    }
  });

  it("同じ画面に 2 通りの住所を作らせない", () => {
    expect(
      decideHostRouting({
        host: "first-lens.example.com",
        pathname: "/s/first-lens",
        baseDomain: BASE,
      }),
    ).toEqual({ kind: "not-found" });
  });

  it("画面の部品は住所に関係なく素通しする", () => {
    expect(
      decideHostRouting({
        host: "first-lens.example.com",
        pathname: "/_next/static/chunk.js",
        baseDomain: BASE,
      }),
    ).toEqual({ kind: "pass" });
  });

  it("本体のホストは管理画面をそのまま開ける", () => {
    expect(
      decideHostRouting({ host: "example.com", pathname: "/admin", baseDomain: BASE }),
    ).toEqual({ kind: "pass" });
  });
});
