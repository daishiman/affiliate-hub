/** @tier 1 @req REQ-SEO08 @types equivalence, boundary */
import { pageKeyOf } from "@/domain/seo/aeo-measurement";
import { describe, expect, it } from "vitest";

describe("公開一覧paginationのページ識別", () => {
  it("2ページ目以降だけを独立させる", () => {
    expect(pageKeyOf("https://example.com/s/tools/blog?page=1")).toEqual({
      ok: true, key: "example.com/s/tools/blog",
    });
    expect(pageKeyOf("https://example.com/s/tools/blog?page=2")).toEqual({
      ok: true, key: "example.com/s/tools/blog?page=2",
    });
  });

  it("追跡queryとfragmentは従来どおり同じページへ畳む", () => {
    expect(pageKeyOf("https://example.com/s/tools/blog?page=2&utm_source=mail#next")).toEqual({
      ok: true, key: "example.com/s/tools/blog?page=2",
    });
    expect(pageKeyOf("https://example.com/s/tools/guides/desk?page=2&utm_source=mail")).toEqual({
      ok: true, key: "example.com/s/tools/guides/desk",
    });
  });

  it("一覧名と同じ記事slugのpage queryは保持しない", () => {
    expect(pageKeyOf("https://example.com/s/tools/guides/blog?page=2")).toEqual({
      ok: true, key: "example.com/s/tools/guides/blog",
    });
    expect(pageKeyOf("https://example.com/s/tools/reviews/guides?page=3&utm_source=mail")).toEqual({
      ok: true, key: "example.com/s/tools/reviews/guides",
    });
  });
});
