/** @tier 2 @req REQ-BOPS11, REQ-BOPS14, FRONT-REQ-005-A3, SEC-REQ-XSS @types tenant-isolation, regression */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { projectBlogArticle } from "@/application/read-models/published-article";
import { serializeProse } from "@/domain/blogops";
import type { WorkspaceId } from "@/domain/shared";
import { createD1ContentRepository, createD1PublishedArticleWriter } from "@/infrastructure/persistence/d1/published-article-repository";
import { createD1SiteRepository } from "@/infrastructure/persistence/d1/site-repository";
import { migrationStatements } from "../support/migrations";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1Database }>>>;
beforeAll(async () => {
  proxy = await getPlatformProxy({ configPath: "wrangler.jsonc", environment: "dev", persist: false });
  for (const statement of migrationStatements()) await proxy.env.DB.prepare(statement).run();
}, 60_000);
afterAll(async () => { await proxy?.dispose(); });

describe("公開本文の商品参照", () => {
  it("公開記事と同じworkspaceの実商品だけを解決し、商品名の更新を再読込で反映する", async () => {
    const db = drizzle(proxy.env.DB, { schema });
    const workspaceId = "ws_inline_product_review" as WorkspaceId;
    await proxy.env.DB.prepare(
      "INSERT INTO site_blueprints (id,workspace_id,slug,name,pattern,published_at,blueprint_json) VALUES ('sb_inline',?,'inline-products','道具ブログ','specialist_review',unixepoch(),'{}')",
    ).bind(workspaceId).run();
    const article = projectBlogArticle({
      id: "inline-article", siteSlug: "inline-products", slug: "guide", type: "guide",
      title: "道具を選ぶ", lead: "使い方を比べます。", authorName: "編集部",
      categorySlug: "tools", publishedAt: new Date(), updatedAt: new Date(),
      blocks: [{ id: "body", kind: "intro-box", heading: "道具", body: serializeProse([
        { kind: "product-card", productId: "inline-owned" },
        { kind: "product-card", productId: "inline-outsider" },
        { kind: "product-card", productId: "missing-product" },
      ]) }],
    });
    const addProduct = async (id: string, owner: string, name: string) => {
      await proxy.env.DB.prepare(
        "INSERT INTO catalog_products (id,workspace_id,brand,name,description,identity_keys,specifications,image_asset_ids,official_source_ids,provenance_source_type,provenance_source_name,provenance_retrieved_at,provenance_confidence,provenance_permitted_usage) VALUES (?,?,'道具屋',?,'商品説明','[]','{}','[]','[]','official','メーカー',1,1,'public')",
      ).bind(id, owner, name).run();
    };
    await addProduct("inline-owned", workspaceId, "使いやすい机");
    await addProduct("inline-outsider", "ws_another", "別テナントの非公開商品");
    const saved = await createD1PublishedArticleWriter(db).save(workspaceId, article);
    expect(saved).toMatchObject({ ok: true });
    const reader = createD1ContentRepository(db, createD1SiteRepository(db));
    const first = await reader.findArticle("inline-products", "guide");
    expect(first.ok).toBe(true);
    if (!first.ok || !first.value) throw new Error("記事を読めません");
    expect(first.value.inlineProductCards?.map((card) => card.name)).toEqual(["使いやすい机"]);
    expect(JSON.stringify(first.value)).not.toContain("別テナントの非公開商品");
    await proxy.env.DB.prepare("UPDATE catalog_products SET name = '更新された机' WHERE id = 'inline-owned'").run();
    const updated = await reader.findArticle("inline-products", "guide");
    expect(updated.ok && updated.value?.inlineProductCards?.[0]?.name).toBe("更新された机");
  });
});
