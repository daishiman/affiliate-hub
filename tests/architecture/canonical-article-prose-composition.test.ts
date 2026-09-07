/**
 * @tier 1
 * @req REQ-BOPS04, REQ-BOPS05
 * @types code-boundary, contract
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ARTICLE_PAGE = readFileSync(
  new URL("../../src/presentation/site/article-page.tsx", import.meta.url),
  "utf8",
);
const CANONICAL_SECTION_BODY = readFileSync(
  new URL("../../src/presentation/site/canonical-section-body.tsx", import.meta.url),
  "utf8",
);
const ARTICLE_VIEW = readFileSync(
  new URL("../../src/presentation/ui/templates/article-view.tsx", import.meta.url),
  "utf8",
);
const STATIC_PREVIEW_WRITER = readFileSync(
  new URL("../../scripts/write-static-preview.tsx", import.meta.url),
  "utf8",
);

describe("canonical記事本文の依存方向", () => {
  it("副作用のない合成境界だけがProseBodyを知り、本画面と静的冊子で共有する", () => {
    expect(CANONICAL_SECTION_BODY).toContain('from "@/presentation/prose/prose-body"');
    expect(ARTICLE_PAGE).toContain('from "./canonical-section-body"');
    expect(STATIC_PREVIEW_WRITER).toContain(
      'from "@/presentation/site/canonical-section-body"',
    );
    expect(ARTICLE_PAGE).toContain("renderSectionBody={renderCanonicalSectionBody}");
    expect(STATIC_PREVIEW_WRITER).toContain(
      "renderSectionBody={renderCanonicalSectionBody}",
    );
    expect(ARTICLE_PAGE).not.toContain("presentation/prose");
    expect(STATIC_PREVIEW_WRITER).not.toContain("presentation/prose");
    expect(ARTICLE_VIEW).not.toContain("presentation/prose");
    expect(ARTICLE_VIEW).not.toContain("ProseBody");
  });
});
