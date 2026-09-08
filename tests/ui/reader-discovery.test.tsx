/** @tier 2 @req REQ-TM06, REQ-TM11 */
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ArticleList, ArticleTableOfContents, type ArticleCardView } from "@/presentation/ui";
import { SearchBox } from "@/presentation/site/search-box";

const article: ArticleCardView = {
  slug: "guide", href: "/s/demo/guides/guide", title: "選び方", summary: "説明",
  publishedAt: "2026-08-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", authorName: "編集部",
  thumbnailUrl: "/cover.png", thumbnailAlt: "", thumbnailIsGenerated: false,
  categoryHref: "/s/demo/categories/tools", categoryLabel: "道具",
};

describe("読みたい記事へ進む共通UI", () => {
  it("同じ記事の画像と題名は同じ行き先・配置として計測でき、公開日と更新日を区別できる", () => {
    const doc = new JSDOM(renderToStaticMarkup(<ArticleList articles={[article]} emptyTitle="" emptyBody="" showAuthor={false} telemetryPlacement="おすすめ" />)).window.document;
    for (const link of doc.querySelectorAll(`a[href="${article.href}"]`)) {
      expect(link.getAttribute("data-tel-kind")).toBe("internal_link");
      expect(link.getAttribute("data-tel-id")).toBe(article.href);
      expect(link.getAttribute("data-tel-placement")).toBe("おすすめ");
    }
    expect(doc.body.textContent).toContain("公開 2026/8/1");
    expect(doc.body.textContent).toContain("更新 2026/9/1");
    expect(doc.body.textContent).not.toContain("書き手:");
    expect(doc.querySelectorAll('a[href="/s/demo/categories/tools"]')).toHaveLength(1);
  });

  it("目次操作はクリックできる見出しの安定IDを持つ", () => {
    const sections = ["a", "b", "c"].map((id) => ({ id, heading: id, paragraphs: [] }));
    const doc = new JSDOM(renderToStaticMarkup(<ArticleTableOfContents sections={sections} />)).window.document;
    expect(doc.querySelector('a[href="#a"]')?.getAttribute("data-tel-kind")).toBe("toc_item");
  });

  it("検索結果の入力はGET検索とタグ条件を維持し、検索語を計測属性へ入れない", () => {
    const doc = new JSDOM(renderToStaticMarkup(<SearchBox action="/s/demo/search" initialQuery="静音" tag="work" />)).window.document;
    expect(doc.querySelector('form[role="search"]')?.getAttribute("method")).toBe("get");
    expect(doc.querySelector('input[name="q"]')?.getAttribute("value")).toBe("静音");
    expect(doc.querySelector('input[name="tag"]')?.getAttribute("value")).toBe("work");
    expect(doc.querySelectorAll("[data-tel-id]")).toHaveLength(0);
  });
});

it("フッターのカテゴリーは専用索引に1回だけ現れ、方針リンクと混ざらない", async () => {
  const { sampleSites } = await import("@/infrastructure/persistence/sample/site-sample-repository");
  const { toChrome } = await import("@/presentation/site/view-model");
  const { SiteShell } = await import("@/presentation/ui");
  const site = sampleSites()[0]!;
  const { aLayoutSlot, aPublicSiteProjection } = await import("../support/factories");
  /*
    見たいのはフッターに置かれた枠 2 つの `slotKey` だけ。だが型を外して
    `{ slotKey }` だけの別物を渡していたのを雛形へ寄せた途端、
    **`BlogLayoutSlotRecord` の 7 項目が足りない**と型検査が言った。
    実際 `toChrome` はこれらの枠を `region` で振り分けている。
  */
  const projection = aPublicSiteProjection({
    chrome: {
      headerSlots: [],
      footerSlots: [
        aLayoutSlot({ region: "footer", slotKey: "footer-logo-nav" }),
        aLayoutSlot({ region: "footer", slotKey: "footer-category-tree" }),
      ],
    },
  });
  const chrome = toChrome(site.slug, site.blueprint, projection);
  const doc = new JSDOM(renderToStaticMarkup(<SiteShell chrome={chrome} currentPath="/"><p>本文</p></SiteShell>)).window.document;
  const footer = doc.querySelector("footer")!;
  for (const category of chrome.categoryNav) {
    expect(footer.querySelectorAll(`a[href="${category.href}"]`)).toHaveLength(1);
    expect(footer.querySelector(`nav[aria-label="方針と問い合わせ"] a[href="${category.href}"]`)).toBeNull();
  }
  expect(footer.querySelector('nav[aria-label="方針と問い合わせ"] a')?.getAttribute("data-tel-placement")).toBe("フッターの方針と問い合わせ");
});
