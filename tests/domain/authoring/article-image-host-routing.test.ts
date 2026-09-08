/** @tier 1 @req REQ-BOPS11, REQ-BOPS14, FRONT-REQ-005 @types boundary, tenant-isolation */
import { describe, expect, it } from "vitest";
import { decideHostRouting, routeResolvedSite } from "@/domain/authoring/site-host-routing";

describe("ブログ独自住所からの画像表示", () => {
  const image = "/api/article-images/8e490853-9921-4f5c-8a51-7f6baa81e327";
  it("サブドメインと独自ドメインで画像の公開GETへ到達する", () => {
    expect(decideHostRouting({ host: "blog.example.com", baseDomain: "example.com", pathname: image })).toEqual({ kind: "pass" });
    expect(routeResolvedSite("blog", image)).toEqual({ kind: "pass" });
  });
  it.each(["/api/article-images", "/api/article-images/not-a-uuid", `${image}/extra`, "/api/article-products", "/api/auth", "/admin"])("他の管理経路は拒否する: %s", (path) => {
    expect(routeResolvedSite("blog", path)).toEqual({ kind: "not-found" });
  });
});
