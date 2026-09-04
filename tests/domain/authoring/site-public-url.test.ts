/** @tier 1 @req REQ-SEO01 @types equivalence, boundary */
import { describe, expect, it } from "vitest";
import { siteCanonicalUrl } from "@/domain/authoring";

/**
 * 同じ記事に付く 3 通りの住所のうち、どれを正本と宣言するか。
 *
 * ここが揺れると検索エンジンから見て同じ記事が複数ページに割れる。
 * 「住所の付け方が変わっても同じ 1 本を指す」ことを固定する。
 */

const BASE = "example.com";
const ORIGIN = "https://example.com";

describe("siteCanonicalUrl", () => {
  it("生きた独自ドメインがあればそれが正本", () => {
    expect(
      siteCanonicalUrl({
        slug: "gadget",
        path: "/guides/x",
        canonicalHostname: "blog.example.jp",
        baseDomain: BASE,
        requestOrigin: ORIGIN,
      }),
    ).toBe("https://blog.example.jp/guides/x");
  });

  it("独自ドメインが無ければ既定のサブドメインが正本", () => {
    expect(
      siteCanonicalUrl({
        slug: "gadget",
        path: "/guides/x",
        canonicalHostname: null,
        baseDomain: BASE,
        requestOrigin: ORIGIN,
      }),
    ).toBe("https://gadget.example.com/guides/x");
  });

  it("基底ドメインが未設定の環境だけ path 形が正本", () => {
    expect(
      siteCanonicalUrl({
        slug: "gadget",
        path: "/guides/x",
        canonicalHostname: null,
        baseDomain: null,
        requestOrigin: ORIGIN,
      }),
    ).toBe("https://example.com/s/gadget/guides/x");
  });

  it("どの住所で来ても同じ 1 本を指す", () => {
    const from = (requestOrigin: string) =>
      siteCanonicalUrl({
        slug: "gadget",
        path: "/guides/x",
        canonicalHostname: "blog.example.jp",
        baseDomain: BASE,
        requestOrigin,
      });

    expect(from("https://blog.example.jp")).toBe(from("https://gadget.example.com"));
    expect(from("https://example.com")).toBe("https://blog.example.jp/guides/x");
  });

  it("住所を組み立てる材料が何も無ければ配らない", () => {
    expect(
      siteCanonicalUrl({
        slug: "gadget",
        path: "/guides/x",
        canonicalHostname: null,
        baseDomain: null,
        requestOrigin: null,
      }),
    ).toBeNull();
  });

  it("住所になっていない基底ドメインは使わない（推測した canonical を配らない）", () => {
    // `localhost` は住所として成り立たないので、サブドメイン形へ倒さない。
    expect(
      siteCanonicalUrl({
        slug: "gadget",
        path: "",
        canonicalHostname: null,
        baseDomain: "localhost",
        requestOrigin: ORIGIN,
      }),
    ).toBe("https://example.com/s/gadget");
  });

  it("表紙は余分な `/` を付けない", () => {
    expect(
      siteCanonicalUrl({
        slug: "gadget",
        path: "",
        canonicalHostname: "blog.example.jp",
        baseDomain: BASE,
        requestOrigin: ORIGIN,
      }),
    ).toBe("https://blog.example.jp");
  });
});
