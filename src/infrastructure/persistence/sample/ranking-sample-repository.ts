import type {
  EditorialRankingModelRepositoryPort,
  EditorialScoreCardRepositoryPort,
} from "@/application/ports";
import type { PageRequest, Paged } from "@/application/ports/common";
import { type EditorialScoreCard, type RankingModel, createRankingModel } from "@/domain/ranking";
import {
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
import {
  SAMPLE_CATEGORY_ID,
  SAMPLE_MODEL_ID,
  SAMPLE_WORKSPACE_ID,
} from "./sample-identity";

export {
  SAMPLE_MODEL_ID,
  SAMPLE_PRODUCTS,
  SAMPLE_WORKSPACE_ID,
  sampleProductName,
} from "./sample-identity";

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
  // 2026-08-26 に解消。入口（/admin/rankings/models/new と
  // /admin/rankings/scores）を用意したうえで表をつないだ。
  // この見本は消さない。1 件も作っていない状態で順位の画面が空になると、
  // 「まだ作っていない」のか「壊れている」のかを画面から見分けられない。
  blockedBy: "済み（保存先は D1 の ranking_models / score_cards）",
});

function productId(value: string): ProductId {
  return taggedString<"ProductId">(value);
}

function buildSampleModel(): RankingModel {
  const built = createRankingModel({
    id: SAMPLE_MODEL_ID,
    workspaceId: SAMPLE_WORKSPACE_ID,
    categoryId: SAMPLE_CATEGORY_ID,
    version: "2026.08-2",
    audience: "1 日 8 時間、机に向かう人",
    criteria: [
      {
        key: "measured_performance",
        weight: 0.4,
        measurement: "8 時間連続着座後の腰部圧力を 10 分ごとに記録し、平均で比較",
        passThreshold: 0.3,
      },
      {
        key: "usability",
        weight: 0.2,
        measurement: "座面高・座面奥行き・肘掛け・背もたれ角の可動域を実測",
        passThreshold: 0.3,
      },
      {
        key: "durability",
        weight: 0.15,
        measurement: "座面へ 80kg を 5 万回加えたあとの沈み込み量の変化を計測",
        passThreshold: 0.2,
      },
      {
        key: "support",
        weight: 0.1,
        measurement: "保証期間と、部品単位で交換できるかを確認",
        passThreshold: 0.0,
      },
      {
        key: "price_value",
        weight: 0.1,
        measurement: "計測した性能を実売価格で割った値を正規化",
        passThreshold: 0.2,
      },
      {
        // 変更容易性シナリオ⑤の実測で足した軸。コードの分岐は 1 つも増えていない。
        key: "repairability",
        weight: 0.05,
        measurement: "交換部品の入手可否と、工具なしで分解できるかを確認",
        passThreshold: 0.0,
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

/** 保存先（D1）が見本を消さずに重ねるために読む。 */
export const SAMPLE_RANKING_MODELS: readonly RankingModel[] = [buildSampleModel()];

const SAMPLE_MODEL = SAMPLE_RANKING_MODELS[0];

/** 同上。評価方法は 1 つしか無いので、どの見本の点数もその 1 つに属する。 */
export const SAMPLE_SCORE_CARDS: readonly EditorialScoreCard[] = [
  {
    productId: productId("p_alpha_15"),
    scores: {
      repairability: 0.35,
      measured_performance: 0.92,
      usability: 0.78,
      durability: 0.7,
      support: 0.6,
      price_value: 0.55,
    },
    evidenceRefs: ["testrun_2026-07-12_ergoone"],
    testedAt: new Date("2026-07-12T00:00:00Z"),
  },
  {
    productId: productId("p_beta_14"),
    scores: {
      repairability: 0.72,
      measured_performance: 0.71,
      usability: 0.86,
      durability: 0.64,
      support: 0.8,
      price_value: 0.82,
    },
    evidenceRefs: ["testrun_2026-07-15_flexseat"],
    testedAt: new Date("2026-07-15T00:00:00Z"),
  },
  {
    productId: productId("p_gamma_16"),
    scores: {
      repairability: 0.48,
      measured_performance: 0.88,
      usability: 0.62,
      durability: 0.81,
      support: 0.4,
      price_value: 0.41,
    },
    evidenceRefs: ["testrun_2026-07-20_deskchair"],
    testedAt: new Date("2026-07-20T00:00:00Z"),
  },
  {
    // 合格ラインを下回る項目があるため、選外として理由付きで返る見本。
    productId: productId("p_delta_13"),
    scores: {
      repairability: 0.66,
      measured_performance: 0.22,
      usability: 0.74,
      durability: 0.55,
      support: 0.5,
      price_value: 0.9,
    },
    evidenceRefs: ["testrun_2026-07-22_woodstool"],
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
    async list(workspaceId: WorkspaceId, page: PageRequest): Promise<Result<Paged<RankingModel>, DomainError>> {
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
      return ok(SAMPLE_SCORE_CARDS.filter((c) => wanted.has(c.productId)));
    },
    save() {
      return notPersisted<EditorialScoreCard>("商品の評価");
    },
  });
}
