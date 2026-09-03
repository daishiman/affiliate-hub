import { and, eq } from "drizzle-orm";
import type { EditorialProductRepositoryPort } from "@/application/ports/product";
import type { PageRequest, PortResult } from "@/application/ports/common";
import { catalogProducts, type CatalogProductRow } from "@/db/schema";
import type { IdentityKeyKind, Product } from "@/domain/product";
import {
  type AssetId,
  type CategoryId,
  type ProductId,
  type Provenance,
  type SourceArtifactId,
  type SourceType,
  type WorkspaceId,
  domainError,
  err,
  markEditorial,
  ok,
  taggedString,
} from "@/domain/shared";
import { sampleProducts } from "../sample/product-sample-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { mergeWithSamples, storageFailure } from "./storage-failure";

/**
 * 商品の保存先（D1）。
 *
 * **これはスタブではない。** 見本データ版と同じ契約を満たす、実際に保存する実装。
 *
 * ここを本物にしたのは、**入れる口が先にできたから**（`create_product` /
 * `update_product` / `delete_product`）。入口の無い表を先に用意すると、
 * 一生埋まらない空の一覧が画面に増える、という順序をここでも守っている。
 *
 * **見本の 4 商品は消さずに重ねる。** 見本は順位表・比較表と同じ商品なので、
 * 消すと「順位表には出るのに商品ページが無い」というちぐはぐが起きる。
 * 同じ ID を保存し直したときは、保存したほうが勝つ（`mergeWithSamples`）。
 */

/** 行 → 業務の形。ID の作り方を知っているのはこの層だけ。 */
function toProduct(row: CatalogProductRow): Product {
  const provenance: Provenance = {
    sourceType: row.provenanceSourceType as SourceType,
    sourceName: row.provenanceSourceName,
    sourceUrl: row.provenanceSourceUrl,
    retrievedAt: row.provenanceRetrievedAt,
    validUntil: row.provenanceValidUntil,
    confidence: row.provenanceConfidence,
    permittedUsage: row.provenancePermittedUsage,
  };
  return {
    id: taggedString<"ProductId">(row.id) as ProductId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    brand: row.brand,
    name: row.name,
    manufacturer: row.manufacturer,
    categoryId:
      row.categoryId === null ? null : (taggedString<"CategoryId">(row.categoryId) as CategoryId),
    identityKeys: row.identityKeys.map((key) => ({
      kind: key.kind as IdentityKeyKind,
      value: key.value,
    })),
    description: row.description,
    specifications: row.specifications,
    imageAssetIds: row.imageAssetIds.map((id) => taggedString<"AssetId">(id) as AssetId),
    releaseDate: row.releaseDate,
    discontinuedAt: row.discontinuedAt,
    officialUrl: row.officialUrl,
    officialSourceIds: row.officialSourceIds.map(
      (id) => taggedString<"SourceArtifactId">(id) as SourceArtifactId,
    ),
    provenance,
  };
}

function toRow(product: Product): CatalogProductRow {
  return {
    id: String(product.id),
    workspaceId: String(product.workspaceId),
    brand: product.brand,
    name: product.name,
    manufacturer: product.manufacturer,
    categoryId: product.categoryId === null ? null : String(product.categoryId),
    identityKeys: product.identityKeys.map((key) => ({ kind: key.kind, value: key.value })),
    description: product.description,
    specifications: { ...product.specifications },
    imageAssetIds: product.imageAssetIds.map(String),
    releaseDate: product.releaseDate,
    discontinuedAt: product.discontinuedAt,
    officialUrl: product.officialUrl,
    officialSourceIds: product.officialSourceIds.map(String),
    provenanceSourceType: product.provenance.sourceType,
    provenanceSourceName: product.provenance.sourceName,
    provenanceSourceUrl: product.provenance.sourceUrl,
    provenanceRetrievedAt: product.provenance.retrievedAt,
    provenanceValidUntil: product.provenance.validUntil,
    provenanceConfidence: product.provenance.confidence,
    provenancePermittedUsage: product.provenance.permittedUsage,
  };
}

function notFound() {
  return err(
    domainError("NOT_FOUND", "この商品が見つかりません。", {
      suggestedAction: "商品の一覧から選び直してください。",
    }),
  );
}

export function createD1ProductRepository(db: DrizzleD1): EditorialProductRepositoryPort {
  /** 保存された分と見本を重ねた、その作業場所の全商品。 */
  async function all(workspaceId: WorkspaceId): Promise<readonly Product[]> {
    const rows = await db
      .select()
      .from(catalogProducts)
      .where(eq(catalogProducts.workspaceId, String(workspaceId)));
    return mergeWithSamples(rows.map(toProduct), sampleProducts());
  }

  return markEditorial({
    async findById(workspaceId: WorkspaceId, id: ProductId) {
      try {
        return ok((await all(workspaceId)).find((p) => p.id === id) ?? null);
      } catch (cause) {
        return storageFailure("商品の読み出し", cause);
      }
    },

    async findByIdentityKey(workspaceId: WorkspaceId, keyType: string, value: string) {
      try {
        const found = (await all(workspaceId)).find((p) =>
          p.identityKeys.some((k) => k.kind === keyType && k.value === value),
        );
        return ok(found ?? null);
      } catch (cause) {
        return storageFailure("商品の読み出し", cause);
      }
    },

    /**
     * 絞り込み。**問い合わせではなく、読み出してから絞る。**
     *
     * 見本と保存分を重ねてから絞る必要があるためで、片方だけ SQL で絞ると
     * 「保存した商品は名前で引けるのに、見本は引けない」が生まれる。
     * 商品は 1 つの作業場所で数百のけたを想定しているので、この読み方で足りる。
     * けたが変わったら、見本を落として SQL 側へ移す（そのときは見本が
     * 不要になっているはずで、順序としても同じ向きになる）。
     */
    async search(
      workspaceId: WorkspaceId,
      query: { text?: string; categoryId?: string },
      page: PageRequest,
    ) {
      try {
        const text = query.text?.trim().toLowerCase() ?? "";
        const items = (await all(workspaceId))
          .filter((p) => {
            if (query.categoryId !== undefined && String(p.categoryId) !== query.categoryId) {
              return false;
            }
            if (text === "") return true;
            return `${p.brand} ${p.name} ${p.description ?? ""}`.toLowerCase().includes(text);
          })
          .slice(0, page.limit);
        return ok({ items, nextCursor: null });
      } catch (cause) {
        return storageFailure("商品の絞り込み", cause);
      }
    },

    async save(product: Product): PortResult<Product> {
      try {
        const row = toRow(product);
        await db
          .insert(catalogProducts)
          .values(row)
          .onConflictDoUpdate({ target: catalogProducts.id, set: row });
        return ok(product);
      } catch (cause) {
        return storageFailure("商品の保存", cause);
      }
    },

    /**
     * 商品を消す。
     *
     * **見本の商品は消せない。** 見本はコードの中にあるので行を消しても次の
     * 読み出しでまた現れる。「消えた」と返して次に開いたら居る、が
     * いちばん質の悪い壊れ方なので、行が無ければ断る。
     *
     * 作業場所を条件に入れているのは、他社の商品を ID の取り違えで
     * 消せてしまわないようにするため（ポートの取り決めどおり `NOT_FOUND`）。
     */
    async remove(workspaceId: WorkspaceId, id: ProductId): PortResult<true> {
      try {
        const deleted = await db
          .delete(catalogProducts)
          .where(
            and(
              eq(catalogProducts.id, String(id)),
              eq(catalogProducts.workspaceId, String(workspaceId)),
            ),
          )
          .returning({ id: catalogProducts.id });
        if (deleted.length === 0) return notFound();
        return ok(true);
      } catch (cause) {
        return storageFailure("商品の削除", cause);
      }
    },
  });
}
