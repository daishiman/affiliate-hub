import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { EditorialContentPackageRepositoryPort } from "@/application/ports/authoring";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { EditorialProductRepositoryPort } from "@/application/ports/product";
import { requireCapability } from "@/domain/identity";
import { type Product, type ProductIdentityKey, createProduct } from "@/domain/product";
import {
  type ActorContext,
  type CategoryId,
  type DomainError,
  type ProductId,
  type Provenance,
  type Result,
  containsCommercial,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 商品を、人の手で登録する・直す・消す。
 *
 * 商品は順位表と比較表の入力である。ここが変わると、
 * すでに公開した記事の中の順位や表の中身がその場で変わる。
 * だから「いつ何が変わったか」を必ず残し、根拠を落とす変更は
 * 参照している記事の件数を添えて断る。
 */
export type EditProductDeps = {
  readonly products: EditorialProductRepositoryPort;
  /**
   * 記事のまとまり。商品を参照しているのはここ（`primarySubjectId`）。
   *
   * **記事本文（`ContentVariant`）を見ないのは、本文が商品を直接指さないから。**
   * 本文はまとまりに属し、まとまりが商品を指す。1 段挟むのは、
   * 同じ商品の記事を複数の媒体向けに増やしても、参照の数え方が変わらないため。
   */
  readonly packages: EditorialContentPackageRepositoryPort;
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
};

/**
 * 参照を数えるときに見る、記事のまとまりの上限。
 *
 * **上限に達したら「これ以上」と言えるようにする。** 件数を返す目的は
 * 「何本片付ければ消せるか」を伝えることなので、正確な総数が出せないときに
 * 黙って少なめの数を出すと、片付けても消せない状態になる。
 */
const REFERENCE_SCAN_LIMIT = 200;

function guardEditorial(deps: EditProductDeps): void {
  const commercial = containsCommercial(deps as unknown as Record<string, unknown>);
  if (commercial.length > 0) {
    throw new Error(
      `商品の編集に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬額を商品の登録・削除の判断に入れることはできません。",
    );
  }
}

async function loadOwned(
  deps: EditProductDeps,
  actor: ActorContext,
  productId: string,
): Promise<Result<Product, DomainError>> {
  const id = taggedString<"ProductId">(productId) as ProductId;
  const found = await deps.products.findById(actor.workspaceId, id);
  if (!found.ok) return found;
  if (found.value === null) {
    return err(
      domainError("NOT_FOUND", "この商品が見つかりません。", {
        suggestedAction: "商品の一覧から選び直してください。",
      }),
    );
  }
  return ok(found.value);
}

/** この商品を主題にしている記事のまとまりの件数と、数えきれたかどうか。 */
async function countReferences(
  deps: EditProductDeps,
  actor: ActorContext,
  id: ProductId,
): Promise<Result<{ count: number; truncated: boolean }, DomainError>> {
  const page = await deps.packages.list(actor.workspaceId, {
    limit: REFERENCE_SCAN_LIMIT,
    cursor: null,
  });
  if (!page.ok) return page;
  const count = page.value.items.filter((p) => String(p.primarySubjectId) === String(id)).length;
  return ok({ count, truncated: page.value.nextCursor !== null });
}

function referenceMessage(what: string, count: number, truncated: boolean): string {
  const amount = truncated ? `${count} 本以上` : `${count} 本`;
  return `この商品は ${amount}の記事で使われています。${what}`;
}

// --- 登録 -------------------------------------------------------------------

/**
 * 商品を登録する。
 *
 * **仕様と出どころの両方を必須にしている。** 仕様が無い商品は比較表の列を
 * 1 つも作れず、出どころが無い仕様は「どこに書いてあったか」を後から示せない。
 * どちらも後から足せばよいように見えるが、足されないまま記事が出る。
 */
export type CreateProductInput = {
  readonly brand: string;
  readonly name: string;
  readonly manufacturer?: string;
  readonly categoryId?: string;
  readonly identityKeys: readonly ProductIdentityKey[];
  readonly description?: string;
  /** 比較表の列になる項目。同じ分野の商品どうしでキーを揃える。 */
  readonly specifications: Readonly<Record<string, string | number>>;
  /** どこに書いてあったか。公式のページを想定している。 */
  readonly officialUrl: string;
};

export type EditProductOutput = {
  readonly productId: string;
  readonly name: string;
};

/**
 * 人が手で入れた値の出どころ。
 *
 * `confidence` を 0.5 にしているのは、**写し間違いが起きうるため**。
 * 公式ページの内容そのものは確かでも、ここに入っているのは人が読んで
 * 打ち直した写しで、自動取得（`api`）と同じ確からしさでは扱えない。
 */
function manualProvenance(officialUrl: string, now: Date): Provenance {
  return {
    sourceType: "manual",
    sourceName: "管理画面から人が入力",
    sourceUrl: officialUrl,
    retrievedAt: now,
    validUntil: null,
    confidence: 0.5,
    permittedUsage: "自社ブログでの比較・紹介に利用可",
  };
}

export function createCreateProductUseCase(
  deps: EditProductDeps,
): UseCase<CreateProductInput, EditProductOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "product.write", "商品の登録");
      if (!allowed.ok) return allowed;

      if (Object.keys(input.specifications).length === 0) {
        return err(
          domainError("VALIDATION_FAILED", "仕様を 1 つ以上入れてください。", {
            field: "specifications",
            suggestedAction:
              "比較表の列になる項目（重さ・画面の大きさなど）です。同じ分野の商品と項目名を揃えてください。",
          }),
        );
      }
      if (input.officialUrl.trim() === "") {
        return err(
          domainError("VALIDATION_FAILED", "仕様の出どころ（公式ページ）を入れてください。", {
            field: "officialUrl",
            suggestedAction:
              "どこに書いてあった値かを示せないと、記事の中でその仕様を根拠として使えません。",
          }),
        );
      }

      const now = new Date();
      const built = createProduct({
        id: taggedString<"ProductId">(`p_${deps.ids.newId()}`) as ProductId,
        workspaceId: actor.workspaceId,
        brand: input.brand,
        name: input.name,
        manufacturer: input.manufacturer ?? null,
        categoryId:
          input.categoryId === undefined
            ? null
            : (taggedString<"CategoryId">(input.categoryId) as CategoryId),
        identityKeys: input.identityKeys,
        description: input.description ?? null,
        specifications: input.specifications,
        officialUrl: input.officialUrl,
        provenance: manualProvenance(input.officialUrl, now),
      });
      if (!built.ok) return built;

      const saved = await deps.products.save(built.value);
      if (!saved.ok) return saved;

      const entry = buildAuditEntry({ ids: deps.ids, now: () => now }, actor, {
        action: "product.created",
        targetType: "product",
        targetId: String(saved.value.id),
        after: { brand: saved.value.brand, name: saved.value.name, officialUrl: input.officialUrl },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("商品は登録しました", appended.error.details));
      }

      return ok({ productId: String(saved.value.id), name: saved.value.name });
    },
  };
}

// --- 修正 -------------------------------------------------------------------

export type UpdateProductInput = {
  readonly productId: string;
  readonly brand?: string;
  readonly name?: string;
  readonly manufacturer?: string | null;
  readonly description?: string | null;
  readonly specifications?: Readonly<Record<string, string | number>>;
  readonly officialUrl?: string | null;
};

export type UpdateProductOutput = EditProductOutput & {
  /** この商品を主題にしている記事の本数。画面はこれを添えて保存の確認を出す。 */
  readonly referencingArticles: number;
};

export function createUpdateProductUseCase(
  deps: EditProductDeps,
): UseCase<UpdateProductInput, UpdateProductOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "product.write", "商品の修正");
      if (!allowed.ok) return allowed;

      const current = await loadOwned(deps, actor, input.productId);
      if (!current.ok) return current;
      const before = current.value;

      const references = await countReferences(deps, actor, before.id);
      if (!references.ok) return references;

      /*
       * 根拠を消す変更だけを、参照の有無で断る。
       *
       * **値を直すことは断らない。** 仕様は実際に変わる（改訂される）ので、
       * 直せないほうが困る。困るのは「どこに書いてあったか」が消えることで、
       * これは記事の中の主張から根拠への線が切れることを意味する。
       */
      const clearsSource = input.officialUrl !== undefined && (input.officialUrl ?? "").trim() === "";
      const clearsSpecs =
        input.specifications !== undefined && Object.keys(input.specifications).length === 0;
      if ((clearsSource || clearsSpecs) && references.value.count > 0) {
        return err(
          domainError(
            "CONFLICT",
            referenceMessage(
              "根拠（出どころ・仕様）を消すと、その記事の主張を裏づけるものが無くなります。",
              references.value.count,
              references.value.truncated,
            ),
            {
              suggestedAction:
                "先に記事の側の主張を直すか、別の出どころを入れてから消してください。",
              details: {
                referencingArticles: references.value.count,
                truncated: references.value.truncated,
              },
            },
          ),
        );
      }

      const officialUrl =
        input.officialUrl === undefined ? before.officialUrl : (input.officialUrl ?? null) || null;
      const next: Product = {
        ...before,
        brand: input.brand ?? before.brand,
        name: input.name ?? before.name,
        manufacturer: input.manufacturer === undefined ? before.manufacturer : input.manufacturer,
        description: input.description === undefined ? before.description : input.description,
        specifications: input.specifications ?? before.specifications,
        officialUrl,
        /*
         * 出どころを差し替えたときだけ、取得日時も置き換える。
         *
         * 置き換えないと、新しい出どころに古い取得日時が付き、
         * 「いつ確かめた値か」が実際より古く（または新しく）見える。
         */
        provenance:
          officialUrl !== null && officialUrl !== before.officialUrl
            ? manualProvenance(officialUrl, new Date())
            : before.provenance,
      };

      const saved = await deps.products.save(next);
      if (!saved.ok) return saved;

      const entry = buildAuditEntry({ ids: deps.ids, now: () => new Date() }, actor, {
        action: "product.changed",
        targetType: "product",
        targetId: String(before.id),
        before: {
          name: before.name,
          officialUrl: before.officialUrl,
          specificationKeys: Object.keys(before.specifications).join(" / "),
        },
        after: {
          name: saved.value.name,
          officialUrl: saved.value.officialUrl,
          specificationKeys: Object.keys(saved.value.specifications).join(" / "),
        },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("商品は保存しました", appended.error.details));
      }

      return ok({
        productId: String(saved.value.id),
        name: saved.value.name,
        referencingArticles: references.value.count,
      });
    },
  };
}

// --- 削除 -------------------------------------------------------------------

export type DeleteProductInput = {
  readonly productId: string;
  /** なぜ消すか。`after` が無いので、差分からは読めない。 */
  readonly reason: string;
};

export function createDeleteProductUseCase(
  deps: EditProductDeps,
): UseCase<DeleteProductInput, EditProductOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "product.write", "商品の削除");
      if (!allowed.ok) return allowed;

      if (input.reason.trim() === "") {
        return err(
          domainError("VALIDATION_FAILED", "消す理由を書いてください。", {
            field: "reason",
            suggestedAction:
              "消した商品は戻せません。後から「なぜ消したか」を説明できるようにしておいてください。",
          }),
        );
      }

      const current = await loadOwned(deps, actor, input.productId);
      if (!current.ok) return current;
      const before = current.value;

      const references = await countReferences(deps, actor, before.id);
      if (!references.ok) return references;
      if (references.value.count > 0) {
        return err(
          domainError(
            "CONFLICT",
            referenceMessage(
              "先に記事の側を片付けてください。",
              references.value.count,
              references.value.truncated,
            ),
            {
              suggestedAction:
                "記事の一覧からこの商品の記事を開き、別の商品に差し替えるか記事ごと取り下げてください。",
              details: {
                referencingArticles: references.value.count,
                truncated: references.value.truncated,
              },
            },
          ),
        );
      }

      const removed = await deps.products.remove(actor.workspaceId, before.id);
      if (!removed.ok) return removed;

      const entry = buildAuditEntry({ ids: deps.ids, now: () => new Date() }, actor, {
        action: "product.deleted",
        targetType: "product",
        targetId: String(before.id),
        // 消した後にこの商品の画面は無い。何が消えたかを一言だけ残す。
        before: { brand: before.brand, name: before.name, officialUrl: before.officialUrl },
        after: null,
        reason: input.reason,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("商品は消しました", appended.error.details));
      }

      return ok({ productId: String(before.id), name: before.name });
    },
  };
}
