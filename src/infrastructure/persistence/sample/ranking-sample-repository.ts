import type {
  EditorialRankingModelRepositoryPort,
  EditorialScoreCardRepositoryPort,
} from "@/application/ports";
import type { Page, Paged } from "@/application/ports/common";
import { type EditorialScoreCard, type RankingModel, createRankingModel } from "@/domain/ranking";
import {
  type CategoryId,
  type DomainError,
  type ProductId,
  type RankingModelId,
  type Result,
  type WorkspaceId,
  domainError,
  err,
  markEditorial,
  ok,
  taggedString,
} from "@/domain/shared";
import { registerStub } from "../../stub-registry";

/**
 * ★ これは仮置きの見本データです（スタブ）。★
 *
 * D1 のテーブルがまだ無いため、画面と AI 入口の経路を通すための見本を返す。
 * 保存 (`save`) は成功したふりをせず、必ず失敗を返す。
 * 「保存できたのに消えている」という一番わかりにくい壊れ方を避けるため。
 *
 * 本実装への差し替えは合成の 1 行だけ (`src/infrastructure/composition.ts`)。
 * 呼び出し側は 1 行も変わらない。
 */
const stub = registerStub({
  id: "persistence:ranking-sample",
  port: "EditorialRankingModelRepositoryPort / EditorialScoreCardRepositoryPort",
  label: "ランキングの保存先（見本データ）",
  blockedBy: "ranking_models / score_cards テーブルの追加とマイグレーション",
});

export const SAMPLE_WORKSPACE_ID = taggedString<"WorkspaceId">("ws_sample");
export const SAMPLE_MODEL_ID = taggedString<"RankingModelId">("rm_video_editing_laptop");

const SAMPLE_CATEGORY_ID = taggedString<"CategoryId">("cat_laptop");

function productId(value: string): ProductId {
  return taggedString<"ProductId">(value);
}

/** 見本の商品。名前は画面で使うため一緒に持つ。 */
export const SAMPLE_PRODUCTS: readonly { readonly id: ProductId; readonly name: string }[] = [
  { id: productId("p_alpha_15"), name: "Alpha Studio 15" },
  { id: productId("p_beta_14"), name: "Beta Creator 14" },
  { id: productId("p_gamma_16"), name: "Gamma Pro 16" },
  { id: productId("p_delta_13"), name: "Delta Light 13" },
];

export function sampleProductName(id: ProductId): string {
  return SAMPLE_PRODUCTS.find((p) => p.id === id)?.name ?? String(id);
}

function buildSampleModel(): RankingModel {
  const built = createRankingModel({
    id: SAMPLE_MODEL_ID,
    workspaceId: SAMPLE_WORKSPACE_ID as WorkspaceId,
    categoryId: SAMPLE_CATEGORY_ID as CategoryId,
    version: "2026.08-1",
    audience: "動画編集をする人",
    criteria: [
      {
        key: "measured_performance",
        weight: 0.4,
        measurement: "同一素材の 4K 書き出し時間を 3 回計測し、中央値で比較",
        passThreshold: 0.3,
      },
      {
        key: "usability",
        weight: 0.2,
        measurement: "実機での画面の明るさ・色域・キーボード操作を評価",
        passThreshold: 0.3,
      },
      {
        key: "durability",
        weight: 0.15,
        measurement: "連続 60 分書き出し時の温度と動作音を計測",
        passThreshold: 0.2,
      },
      {
        key: "support",
        weight: 0.1,
        measurement: "保証期間と修理受付の窓口の有無を確認",
        passThreshold: 0.0,
      },
      {
        key: "price_value",
        weight: 0.15,
        measurement: "計測した性能を実売価格で割った値を正規化",
        passThreshold: 0.2,
      },
    ],
    effectiveFrom: new Date("2026-08-01T00:00:00Z"),
  });

  if (!built.ok) {
    // 見本データが不変条件を満たしていないのは、直すべき欠陥。黙って動かさない。
    throw new Error(`見本のランキングモデルが不正です: ${built.error.message}`);
  }
  return built.value;
}

const SAMPLE_MODEL = buildSampleModel();

const SAMPLE_CARDS: readonly EditorialScoreCard[] = [
  {
    productId: productId("p_alpha_15"),
    scores: {
      measured_performance: 0.92,
      usability: 0.78,
      durability: 0.7,
      support: 0.6,
      price_value: 0.55,
    },
    evidenceRefs: ["testrun_2026-07-12_alpha15"],
    testedAt: new Date("2026-07-12T00:00:00Z"),
  },
  {
    productId: productId("p_beta_14"),
    scores: {
      measured_performance: 0.71,
      usability: 0.86,
      durability: 0.64,
      support: 0.8,
      price_value: 0.82,
    },
    evidenceRefs: ["testrun_2026-07-15_beta14"],
    testedAt: new Date("2026-07-15T00:00:00Z"),
  },
  {
    productId: productId("p_gamma_16"),
    scores: {
      measured_performance: 0.88,
      usability: 0.62,
      durability: 0.81,
      support: 0.4,
      price_value: 0.41,
    },
    evidenceRefs: ["testrun_2026-07-20_gamma16"],
    testedAt: new Date("2026-07-20T00:00:00Z"),
  },
  {
    // 合格ラインを下回る項目があるため、選外として理由付きで返る見本。
    productId: productId("p_delta_13"),
    scores: {
      measured_performance: 0.22,
      usability: 0.74,
      durability: 0.55,
      support: 0.5,
      price_value: 0.9,
    },
    evidenceRefs: ["testrun_2026-07-22_delta13"],
    testedAt: new Date("2026-07-22T00:00:00Z"),
  },
];

function notPersisted<T>(what: string): Promise<Result<T, DomainError>> {
  return Promise.resolve(
    err(
      domainError("NOT_IMPLEMENTED", `${what}はまだ保存できません（見本データのため）。`, {
        suggestedAction: "保存先の用意ができるまでお待ちください。",
        details: { stubId: stub.id, blockedBy: stub.blockedBy },
      }),
    ),
  );
}

export function createSampleRankingModelRepository(): EditorialRankingModelRepositoryPort {
  return markEditorial({
    async findById(workspaceId: WorkspaceId, id: RankingModelId) {
      if (workspaceId !== SAMPLE_MODEL.workspaceId) return ok(null);
      return ok(id === SAMPLE_MODEL.id ? SAMPLE_MODEL : null);
    },
    async list(workspaceId: WorkspaceId, page: Page): Promise<Result<Paged<RankingModel>, DomainError>> {
      const items = workspaceId === SAMPLE_MODEL.workspaceId ? [SAMPLE_MODEL] : [];
      return ok({ items: items.slice(0, page.limit), nextCursor: null });
    },
    save() {
      return notPersisted<RankingModel>("評価基準");
    },
  });
}

export function createSampleScoreCardRepository(): EditorialScoreCardRepositoryPort {
  return markEditorial({
    async listByModel(
      workspaceId: WorkspaceId,
      modelId: RankingModelId,
      productIds: readonly ProductId[],
    ) {
      if (workspaceId !== SAMPLE_MODEL.workspaceId || modelId !== SAMPLE_MODEL.id) return ok([]);
      const wanted = new Set(productIds);
      return ok(SAMPLE_CARDS.filter((c) => wanted.has(c.productId)));
    },
    save() {
      return notPersisted<EditorialScoreCard>("商品の評価");
    },
  });
}
