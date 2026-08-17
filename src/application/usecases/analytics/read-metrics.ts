import type { MetricsRepositoryPort } from "@/application/ports/analytics";
import {
  type FeedbackTarget,
  type MetricCategory,
  type MetricKey,
  type MetricSample,
  METRIC_DEFINITIONS,
  allowedMetricsFor,
  assertFeedbackAllowed,
  metricDefinition,
} from "@/domain/analytics";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  domainError,
  err,
  ok,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 数字を読むユースケース。
 *
 * この層の役目は 2 つ。
 *   1. 数字を「どう数えたか」と一緒に出す。数え方の分からない数字は判断に使えない。
 *   2. **その数字を何に使ってよいか**を出す。
 *      売れた数を順位に戻すのは、誰も悪意なくやってしまう形の混入なので、
 *      画面で選べないようにする（選べても domain が断る）。
 */
export type ReadMetricsDeps = {
  readonly metrics: MetricsRepositoryPort;
};

export const METRIC_CATEGORY_LABEL: Readonly<Record<MetricCategory, string>> = {
  reader: "読者の動き",
  ai: "AI の利用",
  quality: "品質",
  commercial: "収益",
};

export const FEEDBACK_TARGET_LABEL: Readonly<Record<FeedbackTarget, string>> = {
  article_revision: "記事の書き直し",
  topic_selection: "次に書く題材の選定",
  ranking_score: "順位の点数",
  product_recommendation: "おすすめ商品の決定",
  quality_threshold: "品質の合格ライン",
};

// --- 指標の一覧 -------------------------------------------------------------

export type MetricRow = {
  readonly key: MetricKey;
  readonly label: string;
  readonly category: MetricCategory;
  readonly categoryLabel: string;
  readonly howCounted: string;
  /** 実測値。取れていなければ null。 */
  readonly value: number | null;
  readonly valueLabel: string;
  /** 母数。割合の指標で「何件中か」が分からないと読み違える。 */
  readonly denominator: number | null;
  readonly usableForEditorialJudgement: boolean;
  readonly notUsableReason: string | null;
};

export type ListMetricsInput = { readonly days?: number };
export type ListMetricsOutput = {
  readonly from: Date;
  readonly to: Date;
  readonly rows: readonly MetricRow[];
  readonly measuredCount: number;
  readonly missingCount: number;
  readonly emptyReason: string | null;
};

function formatValue(key: MetricKey, value: number | null): string {
  if (value === null) return "未計測";
  if (key.endsWith("_rate") || key.endsWith("_ratio")) {
    return `${Math.round(value * 100)}%`;
  }
  return value.toLocaleString("ja-JP");
}

export function createListMetricsUseCase(deps: ReadMetricsDeps): UseCase<ListMetricsInput, ListMetricsOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ListMetricsInput,
    ): Promise<Result<ListMetricsOutput, DomainError>> {
      const allowed = requireCapability(actor, "analytics.read", "数字の参照");
      if (!allowed.ok) return allowed;

      const days = input.days ?? 30;
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

      const keys = METRIC_DEFINITIONS.map((d) => d.key);
      const queried = await deps.metrics.query(actor.workspaceId, { keys, from, to });
      if (!queried.ok) return queried;

      const byKey = new Map<MetricKey, MetricSample>();
      for (const s of queried.value) byKey.set(s.key, s);

      const rows = METRIC_DEFINITIONS.map((d): MetricRow => {
        const sample = byKey.get(d.key) ?? null;
        return {
          key: d.key,
          label: d.label,
          category: d.category,
          categoryLabel: METRIC_CATEGORY_LABEL[d.category],
          howCounted: d.howCounted,
          value: sample?.value ?? null,
          valueLabel: formatValue(d.key, sample?.value ?? null),
          denominator: sample?.denominator ?? null,
          usableForEditorialJudgement: d.usableForEditorialJudgement,
          // 使えない理由は domain の判定から取る。ここで文言を作り直さない。
          notUsableReason: d.usableForEditorialJudgement
            ? null
            : (assertFeedbackAllowed(d.key, "ranking_score").ok
                ? null
                : "収益の指標なので、順位やおすすめの決定には使えません。記事の書き直しや題材選びには使えます。"),
        };
      });

      const measuredCount = rows.filter((r) => r.value !== null).length;
      return ok({
        from,
        to,
        rows,
        measuredCount,
        missingCount: rows.length - measuredCount,
        emptyReason:
          measuredCount === 0
            ? "まだ何も計測されていません。公開して読まれ始めると数字が入ります。"
            : null,
      });
    },
  };
}

// --- 用途ごとに使ってよい指標 ------------------------------------------------

export type ListUsableMetricsInput = { readonly target: FeedbackTarget };
export type UsableMetricRow = {
  readonly key: MetricKey;
  readonly label: string;
  readonly howCounted: string;
};
export type ListUsableMetricsOutput = {
  readonly target: FeedbackTarget;
  readonly targetLabel: string;
  readonly usable: readonly UsableMetricRow[];
  readonly rejected: readonly { readonly label: string; readonly reason: string }[];
};

/**
 * 「この用途に、どの数字を使ってよいか」を返す。
 *
 * 画面の選択肢はここから作る。画面側で一覧を作り直すと、
 * 片方にだけ収益の指標が残る。
 */
export function createListUsableMetricsUseCase(
  _deps: ReadMetricsDeps,
): UseCase<ListUsableMetricsInput, ListUsableMetricsOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ListUsableMetricsInput,
    ): Promise<Result<ListUsableMetricsOutput, DomainError>> {
      const allowed = requireCapability(actor, "analytics.read", "数字の参照");
      if (!allowed.ok) return allowed;

      const candidates = METRIC_DEFINITIONS.map((d) => d.key);
      const usableKeys = new Set(allowedMetricsFor(input.target, candidates));

      const usable: UsableMetricRow[] = [];
      const rejected: { label: string; reason: string }[] = [];
      for (const key of candidates) {
        const def = metricDefinition(key);
        if (usableKeys.has(key)) {
          usable.push({ key, label: def.label, howCounted: def.howCounted });
          continue;
        }
        const judged = assertFeedbackAllowed(key, input.target);
        rejected.push({
          label: def.label,
          reason: judged.ok ? "使えます" : judged.error.message,
        });
      }

      return ok({
        target: input.target,
        targetLabel: FEEDBACK_TARGET_LABEL[input.target],
        usable,
        rejected,
      });
    },
  };
}

// --- 使ってよいかの単発判定 --------------------------------------------------

export type CheckFeedbackInput = {
  readonly metricKey: MetricKey;
  readonly target: FeedbackTarget;
};
export type CheckFeedbackOutput = {
  readonly allowed: boolean;
  readonly metricLabel: string;
  readonly targetLabel: string;
  readonly reason: string;
};

/**
 * 「この数字をこの用途に使ってよいか」を 1 件だけ判定する。
 *
 * 判定そのものは domain が行う。ここは言葉に直すだけ。
 * 画面と AI で違う答えが返らないよう、判定を写し取らない。
 */
export function createCheckFeedbackUseCase(
  _deps: ReadMetricsDeps,
): UseCase<CheckFeedbackInput, CheckFeedbackOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: CheckFeedbackInput,
    ): Promise<Result<CheckFeedbackOutput, DomainError>> {
      const allowed = requireCapability(actor, "analytics.read", "数字の参照");
      if (!allowed.ok) return allowed;

      const def = METRIC_DEFINITIONS.find((d) => d.key === input.metricKey);
      if (!def) {
        return err(
          domainError("NOT_FOUND", "その指標は登録されていません。", {
            field: "metricKey",
          }),
        );
      }

      const judged = assertFeedbackAllowed(input.metricKey, input.target);
      return ok({
        allowed: judged.ok,
        metricLabel: def.label,
        targetLabel: FEEDBACK_TARGET_LABEL[input.target],
        reason: judged.ok
          ? `${def.label}は${FEEDBACK_TARGET_LABEL[input.target]}に使えます。数え方: ${def.howCounted}`
          : judged.error.message,
      });
    },
  };
}
