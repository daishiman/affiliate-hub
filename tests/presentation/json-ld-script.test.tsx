/**
 * @tier 1
 * @req REQ-SEO01
 * @types contract, injection
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JsonLdScript } from "@/presentation/site/json-ld-script";

describe("JSON-LD native script", () => {
  it("実行用Scriptではなくapplication/ld+jsonのnative scriptを描く", () => {
    const html = renderToStaticMarkup(<JsonLdScript value={{ "@type": "Article" }} />);

    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type":"Article"');
  });

  it("script終端を含む値をHTMLとして実行できない形へ逃がす", () => {
    const html = renderToStaticMarkup(
      <JsonLdScript value={{ headline: "</script><script>alert(1)</script>" }} />,
    );

    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>");
  });
});
