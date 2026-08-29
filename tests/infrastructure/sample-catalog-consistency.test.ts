/**
 * @tier 1
 * @req REQ-P03, REQ-P07, REQ-B07
 */
import { describe, expect, it } from "vitest";
import { createSampleContentRepository } from "@/infrastructure/persistence/sample/content-sample-repository";
import { createSampleProductRepository } from "@/infrastructure/persistence/sample/product-sample-repository";
import { createSampleReaderToolRepository } from "@/infrastructure/persistence/sample/reader-interaction-sample";
import { SAMPLE_PRODUCTS } from "@/infrastructure/persistence/sample/sample-identity";
import {
  SAMPLE_SITE_SLUG,
  sampleSites,
} from "@/infrastructure/persistence/sample/site-sample-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";

describe("画面をまたいだ見本データ", () => {
  it("同じ商品IDは商品ページと記事で同じ椅子を指す", async () => {
    const products = createSampleProductRepository();
    const content = createSampleContentRepository();

    const product = await products.findById(SAMPLE_WORKSPACE_ID, SAMPLE_PRODUCTS[0].id);
    const article = await content.findArticle(SAMPLE_SITE_SLUG, "chairs-for-long-hours");

    expect(product.ok && product.value).not.toBeNull();
    expect(article.ok && article.value).not.toBeNull();
    if (!product.ok || product.value === null || !article.ok || article.value === null) return;

    const card = article.value.productCards?.find(
      (candidate) => candidate.productId === product.value?.id,
    );
    expect(card?.name).toBe(product.value.name);
    expect(Object.keys(product.value.specifications)).toContain("座面の高さ");
    expect(Object.keys(product.value.specifications)).not.toContain("メモリ");
  });

  it("desk-fit は保存容量ではなく机と椅子の高さを案内する", async () => {
    const found = await createSampleReaderToolRepository().find(SAMPLE_SITE_SLUG, "desk-fit");

    expect(found.ok && found.value).not.toBeNull();
    if (!found.ok || found.value === null) return;
    expect(found.value.name).toContain("机と椅子");
    expect(found.value.purpose).toContain("椅子の座面");
    expect(found.value.inputs.map((input) => input.key)).toEqual([
      "height",
      "desk_height",
      "shoe",
    ]);
  });

  it("各カテゴリーの最初の記事タイプは実在する見本記事と一致する", async () => {
    const content = createSampleContentRepository();

    for (const site of sampleSites()) {
      for (const category of site.blueprint.categories) {
        const articles = await content.listByCategory(site.slug, category.slug);
        expect(articles.ok).toBe(true);
        if (!articles.ok) continue;

        const actualTypes = [...new Set(articles.value.map((article) => article.type))].sort();
        const plannedTypes = [...category.initialArticleTypes].sort();
        expect(plannedTypes, `${site.slug}/${category.slug}`).toEqual(actualTypes);
      }
    }
  });
});
