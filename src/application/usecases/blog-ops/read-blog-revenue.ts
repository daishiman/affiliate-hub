import type {
  ArticleRevenueSummary,
  BlogRevenuePort,
} from "@/application/ports/blog-observability";
import { type DailyMetrics, clickThroughRate, validateMetricsRange } from "@/domain/analytics";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  ok,
  validationError,
  err,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * ブログの成果（売上・成約）を読む。運営者の画面だけが呼ぶ。
 *
 * --- この読み口を渡してよい相手 ---
 * `BlogRevenuePort` は `Commercial` 印が付いている。編集判断の側
 * （記事の並べ替え、改善提案、生成）がこのユースケースを受け取ると、
 * 型の上で `Commercial` が編集側の依存へ流れ込み、境界の検査が落ちる。
 * **運営者の管理画面から直接呼ぶ以外の使い道は無い。**
 *
 * --- 「どの記事が稼いでいるか」に期間を必須にした理由 ---
 * ポートの doc にあるとおり、全期間の合計だけを見ると古い記事が
 * 常に上位に居座る。ここでも既定期間を用意せず、呼び出し側に
 * 必ず選ばせる。既定を置くと、画面はたいてい既定のまま使われる。
 *
 * --- 権限 ---
 * `affiliate.read_revenue`。`analytics.read`（読者の数を見る）とは
 * 別の権限で、分析担当に PV を見せながら報酬額は伏せる、という
 * 配り方ができるようにしてある。
 */

export type ReadBlogRevenueDeps = {
  readonly revenue: BlogRevenuePort;
};

export type ReadBlogRevenueInput = {
  readonly siteSlug: string;
  readonly from: string;
  readonly to: string;
  /** 「どの記事が稼いでいるか」の表示件数。 */
  readonly limit?: number;
};

/** 期間ぜんぶを足した姿。画面が日ごとの行を自分で足さないため。 */
export type RevenueTotals = {
  readonly views: number;
  readonly clicks: number;
  readonly conversions: number;
  readonly revenueMinor: number;
  /** 表示に対するクリックの割合 (0..1)。表示 0 なら 0。 */
  readonly clickThroughRate: number;
};

export type BlogRevenueView = {
  readonly siteSlug: string;
  readonly range: { readonly from: string; readonly to: string };
  readonly daily: readonly DailyMetrics[];
  readonly totals: RevenueTotals;
  readonly articleRanking: readonly ArticleRevenueSummary[];
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

export function createReadBlogRevenueUseCase(
  deps: ReadBlogRevenueDeps,
): UseCase<ReadBlogRevenueInput, BlogRevenueView> {
  const { revenue } = deps;

  /**
   * 期間の合計。
   *
   * 合計をここで作るのは、画面ごとに足し方が変わらないようにするため
   * (AD-2)。同じ「今月の売上」が、記事一覧とダッシュボードで
   * 別の数になる事故は、たいてい足す場所が 2 か所あることで起きる。
   */
  function totalsOf(daily: readonly DailyMetrics[]): RevenueTotals {
    const sum = daily.reduce(
      (acc, d) => ({
        views: acc.views + d.views,
        clicks: acc.clicks + d.clicks,
        conversions: acc.conversions + d.conversions,
        revenueMinor: acc.revenueMinor + d.revenueMinor,
      }),
      { views: 0, clicks: 0, conversions: 0, revenueMinor: 0 },
    );
    return { ...sum, clickThroughRate: clickThroughRate(sum) };
  }

  return {
    async execute(
      actor: ActorContext,
      input: ReadBlogRevenueInput,
    ): Promise<Result<BlogRevenueView, DomainError>> {
      const allowed = requireCapability(
        actor,
        "affiliate.read_revenue",
        "ブログの成果（売上・成約）の閲覧",
      );
      if (!allowed.ok) return allowed;

      const range = validateMetricsRange(input.from, input.to);
      if (!range.ok) return range;

      const limit = input.limit ?? DEFAULT_LIMIT;
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        // 欄の名前を付けない。表示件数は画面の入力欄ではなく URL の
        // クエリから来るので、直せる欄が画面に無い。名前を付けると
        // `FormResult` が出さない断りになり、誰にも届かない。
        return err(validationError(`表示件数は 1 以上 ${MAX_LIMIT} 以下で指定してください。`));
      }

      const workspaceId = actor.workspaceId;

      const daily = await revenue.siteDaily(workspaceId, input.siteSlug, range.value);
      if (!daily.ok) return daily;

      const ranking = await revenue.articleRanking(
        workspaceId,
        input.siteSlug,
        range.value,
        limit,
      );
      if (!ranking.ok) return ranking;

      return ok({
        siteSlug: input.siteSlug,
        range: range.value,
        daily: daily.value,
        totals: totalsOf(daily.value),
        articleRanking: ranking.value,
      });
    },
  };
}
