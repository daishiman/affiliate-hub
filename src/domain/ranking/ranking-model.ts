import {
  type CategoryId,
  type DomainError,
  type RankingModelId,
  type Result,
  type WorkspaceId,
  domainError,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Ranking コンテキスト。
 *
 * 責務: 「どの商品をどの順で薦めるか」を、編集判断のデータだけから決める。
 *
 * ここに書いてはいけないもの:
 *   - 報酬額・成果件数・広告主予約・キャンペーン優先度 (Commercial の言葉)
 *   - 記事の文章 (Content Authoring の言葉)
 *   - 販売店リンク (Affiliate & Monetization の言葉)
 *
 * 商業データを参照できないことは 3 重に守る。
 *   1. 型     : RankingDeps は Editorial 印のポートしか受け取らない
 *   2. 実行時 : 依存に commercial 印があれば組み立て時に失敗する
 *   3. 入力値 : 許可された指標キーの許可リストを通らない指標は拒否する
 */

/** ランキングの入力に使ってよい指標 (ブログ層 §17.4 allowed)。 */
export const ALLOWED_RANKING_CRITERIA = [
  "measured_performance", // 実測性能
  "specification", // 仕様
  "usability", // 使いやすさ
  "durability", // 耐久性
  "support", // サポート
  "price_value", // 価格妥当性 (価格そのものではなく「価格に対する価値」)
] as const;

export type AllowedCriterionKey = (typeof ALLOWED_RANKING_CRITERIA)[number];

/**
 * ランキングの入力に使ってはならない指標 (ブログ層 §17.4 prohibited)。
 *
 * 一覧にしておく理由: 拒否したときに「なぜ拒否されたか」を利用者へ返せる。
 * 単に「不明な指標」と返すと、設定担当者が原因を推測することになる。
 */
export const PROHIBITED_RANKING_CRITERIA = [
  "affiliate_commission", // アフィリエイト報酬
  "advertiser_budget", // 広告主予算
  "campaign_priority", // キャンペーン優先度
  "sales_quota", // 販売ノルマ
  "conversion_revenue", // 成果報酬額
  "merchant_margin", // 販売店マージン
] as const;

export type ProhibitedCriterionKey = (typeof PROHIBITED_RANKING_CRITERIA)[number];

export type RankingCriterion = {
  readonly key: AllowedCriterionKey;
  /** 0.0 - 1.0。合計 1.0 になること。 */
  readonly weight: number;
  /** どう測ったか。読者へ表示する (§20.3「評価基準を表示」)。 */
  readonly measurement: string;
  /** これを下回ると順位に関わらず「選外」にする閾値。0.0 - 1.0。 */
  readonly passThreshold: number;
};

export type RankingModel = {
  readonly id: RankingModelId;
  readonly workspaceId: WorkspaceId;
  readonly categoryId: CategoryId;
  /** 評価方法を変えたら必ず上げる。過去の順位を再現できなくなるため。 */
  readonly version: string;
  /** 誰向けのランキングか。同一カテゴリーで読者別に複数持てる。 */
  readonly audience: string;
  readonly criteria: readonly RankingCriterion[];
  readonly effectiveFrom: Date;
  /**
   * 仕様の宣言そのもの。常に false。
   * 型を `false` に固定してあるため true を書くとコンパイルエラーになる。
   */
  readonly affiliateCompensationIsInput: false;
};

const WEIGHT_SUM_TOLERANCE = 1e-6;

/**
 * ランキングモデルを組み立てる。不変条件を満たさない値はここで止める。
 *
 * 不変条件:
 *   I1. 指標が 1 つ以上ある
 *   I2. すべての指標が許可リストに含まれる (禁止指標は理由付きで拒否)
 *   I3. 重みの合計が 1.0
 *   I4. 各重み・閾値が 0.0〜1.0
 *   I5. 同じ指標キーが重複しない
 *   I6. affiliate_compensation_is_input が false
 */
export function createRankingModel(input: {
  id: RankingModelId;
  workspaceId: WorkspaceId;
  categoryId: CategoryId;
  version: string;
  audience: string;
  criteria: readonly { key: string; weight: number; measurement: string; passThreshold: number }[];
  effectiveFrom: Date;
}): Result<RankingModel, DomainError> {
  if (input.criteria.length === 0) {
    return err(validationError("評価基準が 1 つもありません。", "criteria"));
  }

  const seen = new Set<string>();
  const criteria: RankingCriterion[] = [];

  for (const c of input.criteria) {
    if ((PROHIBITED_RANKING_CRITERIA as readonly string[]).includes(c.key)) {
      return err(
        domainError(
          "COMMERCIAL_INPUT_REJECTED",
          `「${c.key}」はランキングの評価基準に使えません。報酬や販売事情を順位へ反映しない決まりです。`,
          {
            field: "criteria",
            suggestedAction: `使える評価基準: ${ALLOWED_RANKING_CRITERIA.join(" / ")}`,
          },
        ),
      );
    }
    if (!(ALLOWED_RANKING_CRITERIA as readonly string[]).includes(c.key)) {
      return err(
        validationError(
          `「${c.key}」は未知の評価基準です。使えるのは ${ALLOWED_RANKING_CRITERIA.join(" / ")} です。`,
          "criteria",
        ),
      );
    }
    if (seen.has(c.key)) {
      return err(validationError(`評価基準「${c.key}」が重複しています。`, "criteria"));
    }
    seen.add(c.key);

    if (c.weight < 0 || c.weight > 1) {
      return err(validationError(`「${c.key}」の重みは 0.0〜1.0 で指定してください。`, "criteria"));
    }
    if (c.passThreshold < 0 || c.passThreshold > 1) {
      return err(
        validationError(`「${c.key}」の合格ラインは 0.0〜1.0 で指定してください。`, "criteria"),
      );
    }
    if (c.measurement.trim() === "") {
      return err(
        validationError(
          `「${c.key}」の測定方法が空です。読者へ評価基準を表示できません。`,
          "criteria",
        ),
      );
    }

    criteria.push({
      key: c.key as AllowedCriterionKey,
      weight: c.weight,
      measurement: c.measurement,
      passThreshold: c.passThreshold,
    });
  }

  const weightSum = criteria.reduce((s, c) => s + c.weight, 0);
  if (Math.abs(weightSum - 1) > WEIGHT_SUM_TOLERANCE) {
    return err(
      validationError(
        `重みの合計が 1.0 になっていません (現在 ${weightSum.toFixed(3)})。`,
        "criteria",
      ),
    );
  }

  if (input.version.trim() === "") {
    return err(validationError("評価方法のバージョンが空です。", "version"));
  }

  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    categoryId: input.categoryId,
    version: input.version,
    audience: input.audience,
    criteria,
    effectiveFrom: input.effectiveFrom,
    affiliateCompensationIsInput: false,
  });
}
