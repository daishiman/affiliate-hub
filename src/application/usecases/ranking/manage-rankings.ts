import type {
  EditorialEvidenceRepositoryPort,
  EditorialProductRepositoryPort,
  EditorialRankingModelRepositoryPort,
  EditorialScoreCardRepositoryPort,
} from "@/application/ports";
import { ensureOwnedReference } from "@/application/owned-reference";
import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import { requireCapability, requireWorkspaceWideCapability } from "@/domain/identity";
import {
  type AllowedCriterionKey,
  ALLOWED_RANKING_CRITERIA,
  type RankingModel,
  createRankingModel,
} from "@/domain/ranking";
import {
  type CategoryId,
  type DomainError,
  type EvidenceId,
  type ProductId,
  type RankingModelId,
  type Result,
  type WorkspaceId,
  domainError,
  err,
  ok,
  taggedString,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 順位づけの基準と採点表の管理（ブログ層 §17.4・§20.3）。
 *
 * **順位は「決めた測り方」と「測った点」の 2 つが揃って初めて出る。**
 * どちらかが欠けると、画面は正常に見えるのに中身が無い順位が出る。
 * 測り方だけあれば「どの商品も測っていない」、点だけあれば
 * 「何点なら上位かを誰も決めていない」状態になる。
 *
 * この文脈は Editorial 区分。報酬のつなぎ目は受け取らない。
 * 受け取れないことは型（`affiliateLinks?: never`）でも守る。
 */
export type ManageRankingsDeps = {
  readonly rankingModels: EditorialRankingModelRepositoryPort;
  readonly scoreCards: EditorialScoreCardRepositoryPort;
  readonly products: EditorialProductRepositoryPort;
  readonly evidence: EditorialEvidenceRepositoryPort;
  /** ID の作り方。**登録のときだけ要る。** 参照だけの経路には持たせない。 */
  readonly ids?: IdGeneratorPort;
  readonly affiliateLinks?: never;
};

export type SaveRankingModelDeps = ManageRankingsDeps & {
  /** 基準を変えた理由を、保存結果と同じ対象 ID で残す。 */
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
};

/** 登録の口が ID の作り方を持たずに組まれたとき（`manage-personas.ts` と同じ理由）。 */
function idsMissing() {
  return err(
    domainError("NOT_IMPLEMENTED", "評価基準の登録は、この画面からは行えません。", {
      suggestedAction: "公開した環境（pnpm run preview か本番）で開いてください。",
    }),
  );
}

/**
 * 指標の名前を、人が読める言葉にする。
 *
 * `measured_performance` のまま画面へ出すと、重みを決める人が
 * 「これは何を測る欄なのか」を推測することになる。
 */
export const CRITERION_LABELS: Readonly<Record<AllowedCriterionKey, string>> = {
  measured_performance: "実際に測った性能",
  specification: "仕様（カタログの値）",
  usability: "使いやすさ",
  durability: "壊れにくさ",
  support: "困ったときの窓口",
  price_value: "値段に見合うか",
  repairability: "直しやすさ",
};

export type RankingModelSummary = {
  readonly modelId: string;
  readonly categoryId: string;
  readonly version: string;
  readonly audience: string;
  readonly effectiveFrom: string;
  /**
   * 指標と重みを読める形で。重みは割合として出す（0.4 ではなく 40%）。
   *
   * `key` も返すのは、点を入れる画面が**この基準が使う指標だけ**を欄に出すため。
   * 名前だけ返すと、画面が名前から指標を逆引きすることになり、
   * 名前を変えた日に欄が消える。
   */
  readonly criteria: readonly {
    readonly key: AllowedCriterionKey;
    readonly label: string;
    readonly weightPercent: number;
  }[];
};

export type ListRankingModelsOutput = {
  readonly items: readonly RankingModelSummary[];
  readonly emptyReason: string | null;
};

/** 日付を画面の言葉にする。時刻は出さない——測り方の有効開始に分は要らない。 */
function formatDate(value: Date): string {
  return `${value.getFullYear()}年${value.getMonth() + 1}月${value.getDate()}日`;
}

/**
 * 0.0〜1.0 を割合へ。**画面へ出すためだけの変換で、計算ではない。**
 *
 * 掛け算をこの 1 か所に閉じているのは、順位の式（重み付き合計）を
 * domain の外で書き直していないことを、読む側と検査の両方が
 * 一目で確かめられるようにするため。
 */
function toPercent(fraction: number): number {
  return Math.round(fraction * 100);
}

function toSummary(model: RankingModel): RankingModelSummary {
  return {
    modelId: String(model.id),
    categoryId: String(model.categoryId),
    version: model.version,
    audience: model.audience,
    effectiveFrom: formatDate(model.effectiveFrom),
    criteria: model.criteria.map((c) => ({
      key: c.key,
      label: CRITERION_LABELS[c.key],
      // 0.4 を「40%」に。小数を並べると、合計が 1.0 かを読む人が暗算することになる。
      weightPercent: toPercent(c.weight),
    })),
  };
}

/** 順位づけの基準の一覧。 */
export function createListRankingModelsUseCase(
  deps: ManageRankingsDeps,
): UseCase<Record<string, never>, ListRankingModelsOutput> {
  return {
    async execute(actor): Promise<Result<ListRankingModelsOutput, DomainError>> {
      const allowed = requireWorkspaceWideCapability(actor, "content.read", "評価基準の参照");
      if (!allowed.ok) return allowed;

      const listed = await deps.rankingModels.list(actor.workspaceId, { limit: 100, cursor: null });
      if (!listed.ok) return listed;

      const items = listed.value.items.map(toSummary);
      return ok({
        items,
        emptyReason:
          items.length === 0 ? "まだ評価基準がありません。1 つ作ってください。" : null,
      });
    },
  };
}

export type SaveRankingModelInput = {
  readonly categoryId: string;
  readonly version: string;
  readonly audience: string;
  readonly effectiveFrom: string;
  /** 順位が変わった理由をあとから説明するため、登録時点で必須にする。 */
  readonly reason: string;
  readonly criteria: readonly {
    readonly key: string;
    readonly weightPercent: number;
    readonly measurement: string;
    readonly passThresholdPercent: number;
  }[];
};

export type SavedRankingModel = {
  readonly modelId: string;
  readonly version: string;
};

/**
 * 順位づけの基準を 1 つ登録する。
 *
 * **重みは割合（%）で受け取る。** 画面で 0.4 と打たせると、
 * 合計 1.0 に合わせる暗算を人にさせることになり、0.05 のずれが
 * 「なぜか保存できない」として返る。%で受けて中で割る。
 *
 * 禁止された指標（報酬・広告主予算など）を断るのは domain
 * （`createRankingModel`）。ここへ写すと写した側だけが古くなる。
 */
export function createSaveRankingModelUseCase(
  deps: SaveRankingModelDeps,
): UseCase<SaveRankingModelInput, SavedRankingModel> {
  return {
    async execute(actor, input): Promise<Result<SavedRankingModel, DomainError>> {
      const allowed = requireCapability(actor, "ranking_model.manage", "評価基準の登録");
      if (!allowed.ok) return allowed;
      if (deps.ids === undefined) return idsMissing();

      const effectiveFrom = new Date(input.effectiveFrom);
      if (Number.isNaN(effectiveFrom.getTime())) {
        return err(validationError("いつからの評価かを選んでください。", "effectiveFrom"));
      }

      const categoryId = taggedString<"CategoryId">(input.categoryId.trim()) as CategoryId;
      const categoryProducts = await deps.products.search(
        actor.workspaceId,
        { categoryId: String(categoryId) },
        { limit: 1, cursor: null },
      );
      if (!categoryProducts.ok) return categoryProducts;
      const categoryBasis = categoryProducts.value.items.find(
        (product) => product.categoryId === categoryId,
      );
      const category = ensureOwnedReference(
        ok(categoryBasis ?? null),
        actor.workspaceId,
        "categoryId",
        "そのカテゴリーはこの作業場所に見つかりません。商品に登録済みのカテゴリーから選び直してください。",
      );
      if (!category.ok) return category;

      const built = createRankingModel({
        id: taggedString<"RankingModelId">(`rm_${deps.ids.newId()}`) as RankingModelId,
        workspaceId: actor.workspaceId,
        categoryId,
        version: input.version.trim(),
        audience: input.audience.trim(),
        criteria: input.criteria
          // 重み 0 の指標は「使わない」ということ。残すと、順位に
          // 影響しない項目のために測る作業だけが毎回発生する。
          .filter((c) => c.weightPercent > 0)
          .map((c) => ({
            key: c.key,
            weight: c.weightPercent / 100,
            measurement: c.measurement.trim(),
            passThreshold: c.passThresholdPercent / 100,
          })),
        effectiveFrom,
      });
      if (!built.ok) return built;

      /*
       * 理由の必須検査を保存より前に通す。保存後に初めて理由不足を見つけると、
       * 画面は失敗を返したのに基準だけ増え、記録の無い順位変更が残る。
       */
      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "ranking_model.changed",
        targetType: "ranking_model",
        targetId: String(built.value.id),
        before: null,
        after: {
          categoryId: String(built.value.categoryId),
          version: built.value.version,
          audience: built.value.audience,
          effectiveFrom: built.value.effectiveFrom.toISOString(),
          criteria: built.value.criteria.map((criterion) => ({
            key: criterion.key,
            weight: criterion.weight,
          })),
        },
        reason: input.reason,
      });
      if (!entry.ok) return entry;

      const saved = await deps.rankingModels.save(built.value);
      if (!saved.ok) return saved;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("評価基準は登録されています", appended.error.details));
      }
      return ok({ modelId: String(saved.value.id), version: saved.value.version });
    },
  };
}

export type SaveScoreCardInput = {
  readonly modelId: string;
  readonly productId: string;
  /** 指標ごとの点。0〜100 で受け取り、中で 0.0〜1.0 へ直す。 */
  readonly scorePercents: Readonly<Record<string, number>>;
  /** どの検証記録に基づく点か。根拠を示せない点数は使わない（§20.3）。 */
  readonly evidenceRefs: readonly string[];
  /** 最後に測った日。空なら「いつ測ったか分からない」として null。 */
  readonly testedAt: string;
};

export type SavedScoreCard = {
  readonly productId: string;
  readonly scoredCount: number;
};

/**
 * 商品 1 つの点を登録する。
 *
 * **根拠が空の点は受け取らない。** 根拠を示せない点数は使わない決まりで、
 * ここを通すと「誰かがそう思った」だけの点が順位を動かす。
 * それは読者から見て検証できない順位になる。
 *
 * 評価方法が違えば同じ商品でも点は変わるので、保存先へ `modelId` を渡す。
 * 渡さないと、版を上げて測り直した点が前の版を上書きする。
 */
export function createSaveScoreCardUseCase(
  deps: ManageRankingsDeps,
): UseCase<SaveScoreCardInput, SavedScoreCard> {
  return {
    async execute(actor, input): Promise<Result<SavedScoreCard, DomainError>> {
      // 点は「測った結果」なので、記事を書く権限ではなく根拠を扱う権限で見る。
      const allowed = requireCapability(actor, "evidence.write", "商品の評価の登録");
      if (!allowed.ok) return allowed;

      const refs = input.evidenceRefs.map((r) => r.trim()).filter((r) => r !== "");
      if (refs.length === 0) {
        return err(
          validationError(
            "何をもとに付けた点かを 1 つ以上書いてください（検証記録の番号など）。",
            "evidenceRefs",
          ),
        );
      }

      const modelId = taggedString<"RankingModelId">(input.modelId) as RankingModelId;
      const model = await deps.rankingModels.findById(actor.workspaceId, modelId);
      if (!model.ok) return model;
      if (model.value === null) {
        return err(
          domainError("NOT_FOUND", "その評価基準は見つかりませんでした。", {
            suggestedAction: "評価基準の一覧から選び直してください。",
          }),
        );
      }

      const productId = taggedString<"ProductId">(input.productId.trim()) as ProductId;
      const product = ensureOwnedReference(
        await deps.products.findById(actor.workspaceId, productId),
        actor.workspaceId,
        "productId",
        "その商品はこの作業場所に見つかりません。商品の一覧から選び直してください。",
      );
      if (!product.ok) return product;

      for (const ref of refs) {
        const evidence = ensureOwnedReference(
          await deps.evidence.findById(
            actor.workspaceId,
            taggedString<"EvidenceId">(ref) as EvidenceId,
          ),
          actor.workspaceId,
          "evidenceRefs",
          "選んだ根拠がこの作業場所に見つかりません。根拠の一覧から選び直してください。",
        );
        if (!evidence.ok) return evidence;
      }

      /*
       * 評価基準にある指標だけを取る。
       * 画面から来た余分な欄を黙って落とさず、**基準の側を正**にする。
       * 落とさずに保存すると、基準に無い項目が付いた点が貯まり、
       * 版を戻したときにどれが有効な点なのか決められなくなる。
       */
      const scores: Partial<Record<AllowedCriterionKey, number>> = {};
      for (const criterion of model.value.criteria) {
        const percent = input.scorePercents[criterion.key];
        if (percent === undefined) continue;
        if (Number.isNaN(percent) || percent < 0 || percent > 100) {
          return err(
            validationError(
              `「${CRITERION_LABELS[criterion.key]}」の点は 0〜100 で入れてください。`,
              criterion.key,
            ),
          );
        }
        scores[criterion.key] = percent / 100;
      }

      if (Object.keys(scores).length === 0) {
        return err(
          validationError("点を 1 つも入れていません。少なくとも 1 項目は必要です。", "scorePercents"),
        );
      }

      const testedAt = input.testedAt.trim() === "" ? null : new Date(input.testedAt);
      if (testedAt !== null && Number.isNaN(testedAt.getTime())) {
        return err(validationError("測った日の形が読めません。", "testedAt"));
      }

      const saved = await deps.scoreCards.save(actor.workspaceId, modelId, {
        productId,
        scores,
        evidenceRefs: refs,
        testedAt,
      });
      if (!saved.ok) return saved;

      return ok({
        productId: String(saved.value.productId),
        scoredCount: Object.keys(saved.value.scores).length,
      });
    },
  };
}

/** 画面が指標の欄を並べるための一覧。domain の定義から作る（画面に書き写さない）。 */
export function allowedCriteriaForForm(): readonly {
  readonly key: AllowedCriterionKey;
  readonly label: string;
}[] {
  return ALLOWED_RANKING_CRITERIA.map((key) => ({ key, label: CRITERION_LABELS[key] }));
}

/** 作業場所の型をこのファイルの外へ漏らさないための別名（保存先の引数に使う）。 */
export type RankingWorkspaceId = WorkspaceId;
