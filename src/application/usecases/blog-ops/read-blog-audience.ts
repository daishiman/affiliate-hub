import type {
  AudienceBreakdown,
  AudienceDaily,
  BlogAudiencePort,
  EngagementProfile,
} from "@/application/ports/blog-observability";
import { validateMetricsRange } from "@/domain/analytics/reader-interaction";
import type { ViewportBand } from "@/domain/analytics/reader-interaction";
import { requireCapability } from "@/domain/identity";
import { type ActorContext, type DomainError, type Result, ok } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 読者の見え方を読む。**売上は返さない。**
 *
 * --- なぜ売上の読み口と別のファイルなのか ---
 * 同じファイルに置けば `deps` に両方が並び、どちらを使うかは書く人の
 * 注意に委ねられる。§12.3 が禁じているのは「報酬データを編集判断へ
 * 渡すこと」で、それを守るのに注意を当てにしない。
 *
 * ここは `BlogAudiencePort`（`Editorial` 印、売上の列を持たない型）
 * しか受け取らない。記事の並べ替えや改善提案がこのユースケースを
 * 呼ぶ限り、売上で並べる実装は**書こうとしても型が通らない**。
 *
 * --- 権限 ---
 * `analytics.read`。数字を見る人と、見せ方を変えて試す人
 * (`improvement.run`) は同じとは限らないので、そちらは要求しない。
 */

export type ReadBlogAudienceDeps = {
  readonly audience: BlogAudiencePort;
};

export type ReadBlogAudienceInput = {
  readonly siteSlug: string;
  /** 省くとブログ全体。指定すると記事 1 本の内訳まで返す。 */
  readonly articleSlug?: string;
  /**
   * 画面幅で絞る。省くと全部の幅をまとめた分布。
   *
   * 絞るのは記事の中の読まれ方 (`engagement`) だけで、内訳
   * (`breakdown`) は絞らない。内訳は「どの幅の人がどれだけ居るか」を
   * 数える表なので、幅で絞ると選んだ 1 行しか残らず、切り替えの
   * 手がかりが画面から消える。
   */
  readonly viewportBand?: ViewportBand;
  readonly from: string;
  readonly to: string;
};

export type BlogAudienceView = {
  readonly siteSlug: string;
  readonly articleSlug: string | null;
  /** 絞った画面幅。絞っていなければ null（画面が「全部」と描き分けるため）。 */
  readonly viewportBand: ViewportBand | null;
  readonly range: { readonly from: string; readonly to: string };
  /** 日ごとの推移。記事を指定したときはその記事ぶん。 */
  readonly daily: readonly AudienceDaily[];
  /** どんな読者が来ているか。ブログ全体でしか出さない。 */
  readonly breakdown: AudienceBreakdown;
  /** どこに時間をかけ、どこを押しているか。記事を指定したときだけ。 */
  readonly engagement: EngagementProfile | null;
};

export function createReadBlogAudienceUseCase(
  deps: ReadBlogAudienceDeps,
): UseCase<ReadBlogAudienceInput, BlogAudienceView> {
  const { audience } = deps;

  return {
    async execute(
      actor: ActorContext,
      input: ReadBlogAudienceInput,
    ): Promise<Result<BlogAudienceView, DomainError>> {
      const allowed = requireCapability(actor, "analytics.read", "ブログの読者分析の閲覧");
      if (!allowed.ok) return allowed;

      const range = validateMetricsRange(input.from, input.to);
      if (!range.ok) return range;

      const workspaceId = actor.workspaceId;
      const article = input.articleSlug ?? null;

      const daily =
        article === null
          ? await audience.siteDaily(workspaceId, input.siteSlug, range.value)
          : await audience.articleDaily(workspaceId, input.siteSlug, article, range.value);
      if (!daily.ok) return daily;

      /*
       * 内訳はブログ全体で引く。記事を見ているときも、その記事だけの
       * 内訳へ絞らないのは、1 本あたりの母数が小さすぎて「検索から 1 人」
       * のような分布が出てしまい、判断の材料にならないためである。
       */
      const breakdown = await audience.breakdown(workspaceId, input.siteSlug, range.value);
      if (!breakdown.ok) return breakdown;

      if (article === null) {
        return ok({
          siteSlug: input.siteSlug,
          articleSlug: null,
          viewportBand: input.viewportBand ?? null,
          range: range.value,
          daily: daily.value,
          breakdown: breakdown.value,
          // ブログ全体の「どこを見ているか」は意味を持たない。
          // 記事ごとに版面が違うので、位置の比率を足し合わせられない。
          engagement: null,
        });
      }

      const engagement = await audience.engagement(
        workspaceId,
        input.siteSlug,
        article,
        range.value,
        input.viewportBand,
      );
      if (!engagement.ok) return engagement;

      return ok({
        siteSlug: input.siteSlug,
        articleSlug: article,
        viewportBand: input.viewportBand ?? null,
        range: range.value,
        daily: daily.value,
        breakdown: breakdown.value,
        engagement: engagement.value,
      });
    },
  };
}
