/** @tier 1 @req REQ-BLOG02 @types boundary, equivalence */
import { describe, expect, it } from "vitest";
import { normalizePagePath } from "@/domain/authoring/page-path";

describe("ページ単位設定の公開パス", () => {
  it.each([
    ["", "/"],
    [" operator ", "/operator"],
    ["/operator/", "/operator"],
    ["////", "/"],
    ["/blog/article-slug///", "/blog/article-slug"],
  ])("%j を %j に正規化する", (raw, expected) => {
    expect(normalizePagePath(raw)).toBe(expected);
  });
});
