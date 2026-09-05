import type { MetricsRepositoryPort } from "@/application/ports/analytics";
import { ANALYTICS_AXES, commercialAxesInUse, isAnalyticsAxisKey, type AnalyticsAxisKey } from "@/domain/analytics/dimensions";
import { DEFAULT_METRICS_WINDOW_DAYS, METRIC_DEFINITIONS, type MetricKey, type MetricSample } from "@/domain/analytics/metrics";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type ArticleId,
  type DomainError,
  type Result,
  type SiteId,
  ok,
  taggedString,
} from "@/domain/shared";
import type { UseCase } from "../usecase";
import { METRIC_CATEGORY_LABEL } from "./read-metrics";

/**
 * 数字を切り口で絞り込む (§9.10 / §22.8 の 11 軸)。
 *
 * この操作でいちばん危ないのは **数字が減ったのか、分けられないのか、が混ざること**。
 *   「この商品の読了率 0%」と出れば、記事を書き直す判断につながる。
 *   でも実際は「読了率は商品ごとに分けて数えていない」だけかもしれない。
 * そこで、絞り込んだときに分けて数えられない指標は
 * **値ではなく理由**を返す。0 とは書かない。
 *
 * もう 1 つ守るのは、お金に近い軸（CTA・販売店・ASP）で絞ったときに
 * その数字を順位づけへ戻さないという注意を必ず添えること。
 * 「よく売れる販売店の商品を上に出す」は、悪意なく起きる。
 */
export type FilterMetricsDeps = {
  readonly metrics: MetricsRepositoryPort;
};

export type AxisOptionView = {
  readonly key: AnalyticsAxisKey;
  readonly label: string;
  readonly whatItTells: string;
  readonly commercial: boolean;
  readonly temporal: boolean;
  /** 選べる値。分けられない軸では空。 */
  readonly options: readonly { readonly value: string; readonly label: string }[];
  /** 選べない理由。null 以外なら、その軸は選択肢を出さず理由を出す。 */
  readonly unavailableReason: string | null;
  /** いま選ばれている値。 */
  readonly selected: string | null;
};

export type FilteredMetricRow = {
  readonly key: MetricKey;
  readonly label: string;
  readonly categoryLabel: string;
  readonly howCounted: string;
  readonly value: number | null;
  readonly valueLabel: string;
  /** 値を出せない理由。「0 件」と「分けられない」を混ぜないための欄。 */
  readonly unavailableReason: string | null;
  readonly usableForEditorialJudgement: boolean;
};

export type FilterMetricsInput = {
  /** 軸ごとの選択値。空文字は「絞らない」。 */
  readonly axes?: Partial<Record<AnalyticsAxisKey, string>>;
  readonly days?: number;
};

export type FilterMetricsView = {
  readonly from: Date;
  readonly to: Date;
  readonly axes: readonly AxisOptionView[];
  readonly rows: readonly FilteredMetricRow[];
  /** いま何で絞っているかの一文。絞っていなければ null。 */
  readonly filterSummary: string | null;
  readonly appliedAxisCount: number;
  /** 分けられない指標の数。 */
  readonly unsplittableCount: number;
  /** お金に近い軸で絞ったときの注意。絞っていなければ null。 */
  readonly commercialWarning: string | null;
  readonly emptyReason: string | null;
};

const NOT_SPLITTABLE =
  "この指標は、いまの切り口では分けて数えていません。絞り込みを外すと全体の値が見られます。";

function formatValue(key: MetricKey, value: number): string {
  if (key.endsWith("_rate") || key.endsWith("_ratio")) return `${Math.round(value * 100)}%`;
  if (key === "revenue_amount") return `${value.toLocaleString("ja-JP")}円`;
  return value.toLocaleString("ja-JP");
}

/** 画面から来た軸の指定を、保存先が受け取る形へ直す。 */
function toDimensions(axes: Partial<Record<AnalyticsAxisKey, string>>) {
  const pick = (key: AnalyticsAxisKey): string | null => {
    const value = axes[key];
    return value === undefined || value.trim() === "" ? null : value;
  };
  const site = pick("site");
  const article = pick("content");
  return {
    siteId: site === null ? null : (taggedString<"SiteId">(site) as SiteId),
    articleId: article === null ? null : (taggedString<"ArticleId">(article) as ArticleId),
    channel: pick("channel"),
    productId: pick("product"),
    authorId: pick("author"),
    personaId: pick("persona"),
    angle: pick("angle"),
    cta: pick("cta"),
    merchant: pick("merchant"),
    asp: pick("asp"),
    // 投稿日時は「この日以降」の 1 点で絞る。範囲の両端を作らない。
    // **指定が無いときは絞らない**（期間の窓は from / to 側の仕事であり、
    // ここで既定値を入れると「絞っていないのに古い記事が消える」が起きる）。
    publishedAt: axes.publishedAt ? new Date(axes.publishedAt) : null,
  };
}

export function createFilterMetricsUseCase(
  deps: FilterMetricsDeps,
): UseCase<FilterMetricsInput, FilterMetricsView> {
  return {
    async execute(
      actor: ActorContext,
      input: FilterMetricsInput,
    ): Promise<Result<FilterMetricsView, DomainError>> {
      const allowed = requireCapability(actor, "analytics.read", "数字の参照");
      if (!allowed.ok) return allowed;

      // 知らない軸の指定は黙って捨てる（存在しない軸で絞ったことにしない）。
      const requested = input.axes ?? {};
      const axes: Partial<Record<AnalyticsAxisKey, string>> = {};
      for (const [key, value] of Object.entries(requested)) {
        if (isAnalyticsAxisKey(key) && typeof value === "string" && value.trim() !== "") {
          axes[key] = value;
        }
      }

      const days = input.days ?? DEFAULT_METRICS_WINDOW_DAYS;
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

      const keys = METRIC_DEFINITIONS.map((d) => d.key);
      const applied = Object.keys(axes).length > 0;

      const [queried, splittable, ...optionResults] = await Promise.all([
        deps.metrics.query(actor.workspaceId, {
          keys,
          from,
          to,
          dimensions: applied ? toDimensions(axes) : undefined,
        }),
        deps.metrics.listSplittableKeys(actor.workspaceId),
        ...ANALYTICS_AXES.map((a) => deps.metrics.listAxisOptions(actor.workspaceId, a.key)),
      ]);
      if (!queried.ok) return queried;

      const splittableKeys = new Set<MetricKey>(splittable.ok ? splittable.value : keys);

      const axisViews = ANALYTICS_AXES.map((a, i): AxisOptionView => {
        const result = optionResults[i];
        const values = result?.ok ? result.value.values : null;
        return {
          key: a.key,
          label: a.label,
          whatItTells: a.whatItTells,
          commercial: a.commercial,
          temporal: a.temporal,
          options: values ?? [],
          unavailableReason:
            values !== null
              ? null
              : ((result?.ok ? result.value.unavailableReason : null) ??
                "この切り口では、いま分けられません。"),
          selected: axes[a.key] ?? null,
        };
      });

      const byKey = new Map<MetricKey, MetricSample>();
      for (const s of queried.value) byKey.set(s.key, s);

      const rows = METRIC_DEFINITIONS.map((d): FilteredMetricRow => {
        const sample = byKey.get(d.key) ?? null;
        // 絞っているのに分けられない指標は、値ではなく理由を出す。
        const unsplittable = applied && !splittableKeys.has(d.key);
        const value = unsplittable ? null : (sample?.value ?? null);
        return {
          key: d.key,
          label: d.label,
          categoryLabel: METRIC_CATEGORY_LABEL[d.category],
          howCounted: d.howCounted,
          value,
          valueLabel: value === null ? "—" : formatValue(d.key, value),
          unavailableReason: unsplittable
            ? NOT_SPLITTABLE
            : value === null
              ? "まだ計測されていません。公開して読まれ始めると数字が入ります。"
              : null,
          usableForEditorialJudgement: d.usableForEditorialJudgement,
        };
      });

      const summaryParts = axisViews
        .filter((a) => a.selected !== null)
        .map((a) => {
          const label = a.options.find((o) => o.value === a.selected)?.label ?? a.selected;
          return `${a.label}「${label}」`;
        });

      const commercial = commercialAxesInUse(axes);

      return ok({
        from,
        to,
        axes: axisViews,
        rows,
        filterSummary: summaryParts.length === 0 ? null : `${summaryParts.join(" / ")}で絞り込み中`,
        appliedAxisCount: summaryParts.length,
        unsplittableCount: rows.filter((r) => r.unavailableReason === NOT_SPLITTABLE).length,
        commercialWarning:
          commercial.length === 0
            ? null
            : `${commercial
                .map((a) => a.label)
                .join(
                  "・",
                )}は報酬の出どころに直結する切り口です。ここで出た数字を順位やおすすめの決定に戻さないでください。記事の書き直しや次の題材選びには使えます。`,
        emptyReason:
          rows.every((r) => r.value === null)
            ? applied
              ? "この絞り込みに当てはまる数字がありません。条件を 1 つ外すと結果が出ることがあります。"
              : "まだ何も計測されていません。公開して読まれ始めると数字が入ります。"
            : null,
      });
    },
  };
}
