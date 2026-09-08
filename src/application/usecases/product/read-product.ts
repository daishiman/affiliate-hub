import type {
  EditorialClaimRepositoryPort,
  EditorialEvidenceRepositoryPort,
  EditorialTestRunRepositoryPort,
} from "@/application/ports/evidence";
import type { EditorialProductRepositoryPort } from "@/application/ports/product";
import type {
  EditorialRankingModelRepositoryPort,
  EditorialScoreCardRepositoryPort,
} from "@/application/ports/ranking";
import { requireCapability, requireWorkspaceWideCapability } from "@/domain/identity";
import type { Claim, Evidence, TestRun } from "@/domain/evidence";
import type { Product } from "@/domain/product";
import { type RankingResult, rankProducts } from "@/domain/ranking";
import {
  type ActorContext,
  type DomainError,
  type ProductId,
  type RankingModelId,
  type Result,
  assertSameTenant,
  containsCommercial,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 読者へ商品と根拠を見せるユースケース。
 *
 * ここにある 9 つは**そのまま読者側 WebMCP の道具になる**
 * （仕様 ブログ層 §14.2 の読み取り 9 種）。
 * 画面・REST・WebMCP・MCP のどこから来ても同じ関数を通るため、
 * 「画面には出ないが AI にだけ見える情報」が構造的に作れない。
 *
 * 依存はすべて Editorial 印のポート。報酬に触れるポートは型で入らない。
 * 型を外して渡された場合に備え、組み立て時に実行時の印も確認する。
 */
export type ReadProductDeps = {
  readonly products: EditorialProductRepositoryPort;
  readonly claims: EditorialClaimRepositoryPort;
  readonly evidence: EditorialEvidenceRepositoryPort;
  readonly testRuns: EditorialTestRunRepositoryPort;
  readonly rankingModels: EditorialRankingModelRepositoryPort;
  readonly scoreCards: EditorialScoreCardRepositoryPort;
};

/**
 * 商業データの混入を組み立て時に止める。
 *
 * 読者向けの読み取りに報酬が混ざると、
 * 「報酬の高い順に見せる」が事故として成立してしまう。
 */
function guardEditorial(deps: Record<string, unknown>, where: string): void {
  const commercial = containsCommercial(deps);
  if (commercial.length > 0) {
    throw new Error(
      `${where}に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬・広告主予算・販売実績を読者向けの並び順の入力にすることはできません。",
    );
  }
}

// --- 商品 1 件 -------------------------------------------------------------

export type GetProductInput = { readonly productId: string };

export type ProductDetail = {
  readonly product: Product;
  /** 仕様を「項目名 → 値」の並びにしたもの。画面はこの順で表に出す。 */
  readonly specifications: readonly { readonly key: string; readonly value: string }[];
  /** この商品について言えること。事実と推測の区別つき。 */
  readonly claims: readonly Claim[];
  /** 情報の古さを読者が判断できるようにする。 */
  readonly retrievedAt: Date;
  readonly validUntil: Date | null;
};

async function loadProduct(
  deps: ReadProductDeps,
  actor: ActorContext,
  productId: string,
): Promise<Result<Product, DomainError>> {
  const found = await deps.products.findById(actor.workspaceId, taggedString<"ProductId">(productId));
  if (!found.ok) return found;
  if (found.value === null) {
    return err(
      domainError("NOT_FOUND", "その商品は見つかりませんでした。", {
        suggestedAction: "商品の一覧から選び直してください。",
      }),
    );
  }
  return assertSameTenant(actor, found.value, "商品");
}

export function createGetProductUseCase(
  deps: ReadProductDeps,
): UseCase<GetProductInput, ProductDetail> {
  guardEditorial(deps, "商品の参照");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "product.read", "商品の参照");
      if (!allowed.ok) return allowed;

      const product = await loadProduct(deps, actor, input.productId);
      if (!product.ok) return product;

      const claims = await deps.claims.listByProduct(actor.workspaceId, product.value.id);
      if (!claims.ok) return claims;

      return ok({
        product: product.value,
        specifications: Object.entries(product.value.specifications).map(([key, value]) => ({
          key,
          value: String(value),
        })),
        claims: claims.value,
        retrievedAt: product.value.provenance.retrievedAt,
        validUntil: product.value.provenance.validUntil,
      });
    },
  };
}

// --- 絞り込み --------------------------------------------------------------

export type FilterProductsInput = {
  readonly text?: string;
  readonly categoryId?: string;
  readonly limit?: number;
};

export type ProductSummary = {
  readonly productId: string;
  readonly brand: string;
  readonly name: string;
  readonly oneLine: string;
};

export type FilterProductsOutput = {
  readonly items: readonly ProductSummary[];
  /** 0 件のときに読者へ出す理由。無言の空表を作らないため。 */
  readonly emptyReason: string | null;
};

function toSummary(p: Product): ProductSummary {
  return {
    productId: String(p.id),
    brand: p.brand,
    name: p.name,
    oneLine: p.description ?? "",
  };
}

export function createFilterProductsUseCase(
  deps: ReadProductDeps,
): UseCase<FilterProductsInput, FilterProductsOutput> {
  guardEditorial(deps, "商品の絞り込み");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "product.read", "商品の絞り込み");
      if (!allowed.ok) return allowed;

      const found = await deps.products.search(
        actor.workspaceId,
        { text: input.text, categoryId: input.categoryId },
        { limit: Math.min(input.limit ?? 20, 50), cursor: null },
      );
      if (!found.ok) return found;

      const items = found.value.items.map(toSummary);
      return ok({
        items,
        emptyReason:
          items.length > 0
            ? null
            : "条件に合う商品がまだ登録されていません。条件をゆるめるか、時間をおいてお試しください。",
      });
    },
  };
}

// --- 比較 ------------------------------------------------------------------

export type CompareProductsInput = { readonly productIds: readonly string[] };

export type CompareProductsOutput = {
  readonly products: readonly ProductSummary[];
  /** 全商品で値が揃っている項目だけを列にする。 */
  readonly columns: readonly string[];
  /** `rows[商品の並び順][列の並び順]`。値が無い欄は null（空文字で埋めない）。 */
  readonly rows: readonly (readonly (string | null)[])[];
  /** 揃っていないため列にできなかった項目。読者に隠さず出す。 */
  readonly missingColumns: readonly string[];
};

export function createCompareProductsUseCase(
  deps: ReadProductDeps,
): UseCase<CompareProductsInput, CompareProductsOutput> {
  guardEditorial(deps, "商品の比較");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "product.read", "商品の比較");
      if (!allowed.ok) return allowed;

      if (input.productIds.length < 2) {
        return err(
          domainError("VALIDATION_FAILED", "比較するには商品を 2 つ以上選んでください。", {
            field: "productIds",
          }),
        );
      }

      const products: Product[] = [];
      for (const id of input.productIds) {
        const loaded = await loadProduct(deps, actor, id);
        if (!loaded.ok) return loaded;
        products.push(loaded.value);
      }

      // 列は「全商品にある項目」だけ。1 つでも欠けたら列にしない。
      // 欠けた欄を空白で出すと、読者は「その機能が無い」と読んでしまう。
      const keySets = products.map((p) => new Set(Object.keys(p.specifications)));
      const allKeys = [...new Set(products.flatMap((p) => Object.keys(p.specifications)))].sort();
      const columns = allKeys.filter((k) => keySets.every((s) => s.has(k)));
      const missingColumns = allKeys.filter((k) => !columns.includes(k));

      return ok({
        products: products.map(toSummary),
        columns,
        rows: products.map((p) =>
          columns.map((k) => {
            const v = p.specifications[k];
            return v === undefined ? null : String(v);
          }),
        ),
        missingColumns,
      });
    },
  };
}

// --- 代わりになるもの ------------------------------------------------------

export type FindAlternativesInput = { readonly productId: string; readonly limit?: number };

export type FindAlternativesOutput = {
  readonly basis: ProductSummary;
  readonly alternatives: readonly ProductSummary[];
  readonly emptyReason: string | null;
};

export function createFindAlternativesUseCase(
  deps: ReadProductDeps,
): UseCase<FindAlternativesInput, FindAlternativesOutput> {
  guardEditorial(deps, "代わりになる商品の提示");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "product.read", "代わりになる商品の提示");
      if (!allowed.ok) return allowed;

      const basis = await loadProduct(deps, actor, input.productId);
      if (!basis.ok) return basis;

      const sameCategory = await deps.products.search(
        actor.workspaceId,
        { categoryId: basis.value.categoryId === null ? undefined : String(basis.value.categoryId) },
        { limit: Math.min((input.limit ?? 5) + 1, 50), cursor: null },
      );
      if (!sameCategory.ok) return sameCategory;

      const alternatives = sameCategory.value.items
        .filter((p) => p.id !== basis.value.id)
        .slice(0, input.limit ?? 5)
        .map(toSummary);

      return ok({
        basis: toSummary(basis.value),
        alternatives,
        emptyReason:
          alternatives.length > 0
            ? null
            : "同じ用途の商品がまだ登録されていません。登録が進むと候補が出ます。",
      });
    },
  };
}

// --- 根拠 ------------------------------------------------------------------

export type GetEvidenceInput = { readonly productId: string };

export type ClaimWithEvidence = {
  readonly claim: Claim;
  readonly evidence: readonly Evidence[];
  /** 「事実」か「推測」か。読者へそのまま出す言葉。 */
  readonly factOrInference: "事実" | "推測";
  /** 根拠が期限切れなら、その旨を読者へ出す。 */
  readonly expiredNote: string | null;
};

export type GetEvidenceOutput = {
  readonly productId: string;
  readonly items: readonly ClaimWithEvidence[];
  readonly emptyReason: string | null;
};

export function createGetEvidenceUseCase(
  deps: ReadProductDeps,
): UseCase<GetEvidenceInput, GetEvidenceOutput> {
  guardEditorial(deps, "根拠の参照");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "product.read", "根拠の参照");
      if (!allowed.ok) return allowed;

      const product = await loadProduct(deps, actor, input.productId);
      if (!product.ok) return product;

      const claims = await deps.claims.listByProduct(actor.workspaceId, product.value.id);
      if (!claims.ok) return claims;

      const items: ClaimWithEvidence[] = [];
      for (const claim of claims.value) {
        const evidence = await deps.evidence.listByIds(actor.workspaceId, claim.evidenceIds);
        if (!evidence.ok) return evidence;
        items.push({
          claim,
          evidence: evidence.value,
          // 表示語彙の正本は用語辞書。ここで新しい言い方を作らない。
          factOrInference: claim.type === "inference" ? "推測" : "事実",
          expiredNote:
            claim.verificationStatus === "expired"
              ? "この根拠は有効期限を過ぎています。最新の情報をご確認ください。"
              : null,
        });
      }

      return ok({
        productId: input.productId,
        items,
        emptyReason:
          items.length > 0 ? null : "この商品について記録された根拠がまだありません。",
      });
    },
  };
}

// --- 検証記録 --------------------------------------------------------------

export type ListTestRunsInput = { readonly productId: string };

export type ListTestRunsOutput = {
  readonly productId: string;
  readonly runs: readonly TestRun[];
  readonly emptyReason: string | null;
};

export function createListTestRunsUseCase(
  deps: ReadProductDeps,
): UseCase<ListTestRunsInput, ListTestRunsOutput> {
  guardEditorial(deps, "検証記録の参照");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "product.read", "検証記録の参照");
      if (!allowed.ok) return allowed;

      const product = await loadProduct(deps, actor, input.productId);
      if (!product.ok) return product;

      const runs = await deps.testRuns.listByProduct(actor.workspaceId, product.value.id);
      if (!runs.ok) return runs;

      return ok({
        productId: input.productId,
        runs: runs.value,
        emptyReason:
          runs.value.length > 0
            ? null
            : "この商品はまだ編集部で実測していません。実測していない項目は「実際に使ってみた」と書きません。",
      });
    },
  };
}

// --- 順位と、その理由 ------------------------------------------------------

export type ListRankingInput = {
  readonly modelId: string;
  readonly productIds: readonly string[];
};

export type RankingView = {
  readonly result: RankingResult;
  /** 評価基準を読者へ表示する（ブログ層 §20.3）。 */
  readonly criteria: readonly {
    readonly key: string;
    readonly weight: number;
    readonly measurement: string;
  }[];
  readonly modelVersion: string;
  /**
   * 読者へ必ず出す一文。
   *
   * 文言は 1 箇所（用語辞書）に置き、ここでは組み立てない。
   * `affiliateCompensationIsInput` が `false` 固定であることが根拠。
   */
  readonly compensationIsInput: false;
};

async function loadRanking(
  deps: ReadProductDeps,
  actor: ActorContext,
  input: ListRankingInput,
): Promise<Result<RankingView, DomainError>> {
  if (input.productIds.length === 0) {
    return err(
      domainError("VALIDATION_FAILED", "並べ替える商品が指定されていません。", {
        field: "productIds",
      }),
    );
  }

  const modelId = taggedString<"RankingModelId">(input.modelId) as RankingModelId;
  const model = await deps.rankingModels.findById(actor.workspaceId, modelId);
  if (!model.ok) return model;
  if (model.value === null) {
    return err(
      domainError("NOT_FOUND", "評価基準が見つかりません。", {
        suggestedAction: "評価基準を選び直してください。",
      }),
    );
  }
  const checked = assertSameTenant(actor, model.value, "評価基準");
  if (!checked.ok) return checked;

  const cards = await deps.scoreCards.listByModel(
    actor.workspaceId,
    modelId,
    input.productIds.map((id) => taggedString<"ProductId">(id) as ProductId),
  );
  if (!cards.ok) return cards;
  if (cards.value.length === 0) {
    return err(
      domainError("EVIDENCE_REQUIRED", "評価の記録がある商品がありません。", {
        suggestedAction: "商品ごとの評価を先に登録してください。",
      }),
    );
  }

  const ranked = rankProducts(checked.value, cards.value);
  if (!ranked.ok) return ranked;

  return ok({
    result: ranked.value,
    criteria: checked.value.criteria.map((c) => ({
      key: c.key,
      weight: c.weight,
      measurement: c.measurement,
    })),
    modelVersion: checked.value.version,
    compensationIsInput: false,
  });
}

export function createListRankingUseCase(
  deps: ReadProductDeps,
): UseCase<ListRankingInput, RankingView> {
  guardEditorial(deps, "順位の参照");
  return {
    async execute(actor, input) {
      const allowed = requireWorkspaceWideCapability(actor, "content.read", "順位の参照");
      if (!allowed.ok) return allowed;
      return loadRanking(deps, actor, input);
    },
  };
}

export type ExplainRankingInput = ListRankingInput & { readonly productId: string };

export type ExplainRankingOutput = {
  readonly productId: string;
  readonly rank: number;
  readonly totalScore: number;
  /** 何がどれだけ順位に効いたか。重み × 点数の内訳。 */
  readonly contributions: readonly {
    readonly key: string;
    readonly measurement: string;
    readonly weight: number;
    readonly score: number;
    readonly contribution: number;
  }[];
  readonly excludedReason: string | null;
  readonly modelVersion: string;
};

export function createExplainRankingUseCase(
  deps: ReadProductDeps,
): UseCase<ExplainRankingInput, ExplainRankingOutput> {
  guardEditorial(deps, "順位の説明");
  return {
    async execute(actor, input) {
      const allowed = requireWorkspaceWideCapability(actor, "content.read", "順位の説明");
      if (!allowed.ok) return allowed;

      const view = await loadRanking(deps, actor, input);
      if (!view.ok) return view;

      const entry = view.value.result.ranked.find((e) => String(e.productId) === input.productId);
      if (entry === undefined) {
        // 選外は「見つからない」ではない。理由がある状態なので、理由を返す。
        const excluded = view.value.result.excluded.find(
          (e) => String(e.productId) === input.productId,
        );
        if (excluded !== undefined) {
          return ok({
            productId: input.productId,
            rank: 0,
            totalScore: 0,
            contributions: [],
            excludedReason: excluded.reason,
            modelVersion: view.value.modelVersion,
          });
        }
        return err(
          domainError("NOT_FOUND", "その商品はこの順位表に含まれていません。", {
            suggestedAction: "順位表に出ている商品名から選び直してください。",
          }),
        );
      }

      return ok({
        productId: input.productId,
        rank: entry.rank,
        totalScore: entry.totalScore,
        contributions: entry.breakdown.map((b) => ({
          key: b.key,
          measurement: b.measurement,
          weight: b.weight,
          score: b.rawScore,
          contribution: b.weightedScore,
        })),
        excludedReason: null,
        modelVersion: view.value.modelVersion,
      });
    },
  };
}
