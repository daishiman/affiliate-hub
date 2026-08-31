import type {
  AffiliatePlacement,
  ArticlePlacements,
  BlogAffiliatePlacementPort,
} from "@/application/ports/blog-affiliate-placement";
import type { BlogOpsRepositoryPort } from "@/application/ports/blog-ops";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  err,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";
import {
  affiliatePlacementArticleBlockId,
  toAffiliatePlacementArticleBlock,
} from "@/application/adapters/expression-article-block";
import type { BlogArticleStatus } from "@/domain/blogops";

/**
 * ブログ×成果リンクの掲載状況を見る／直す（受入 A6・A7）。
 *
 * --- 掲載漏れを数えるのは、ここでしかできない ---
 * 台帳（`blog_affiliate_placement`）は「載っているもの」しか知らない。
 * 「載っていない記事」を数えるには**記事の全体集合**が要り、それを持つのは
 * `BlogOpsRepositoryPort` である。2 つの口を突き合わせる場所が要るので、
 * この層が引き受ける。台帳側に記事表を読ませると、台帳が記事の生死に
 * 依存し始め、記事を消した日に幽霊の行が残る。
 *
 * --- 記事を「読める人」なら見てよい ---
 * 掲載漏れは編集の判断材料であって、報酬の数字ではない（不変条件 I4 のとおり
 * この台帳に金額は 1 つも無い）。読み取りを `monetization` 側の権限に
 * すると、記事を直す人が自分の記事の抜けを確認できなくなる。
 * 一方、台帳を**書き換える**のはサイトの見せ方を決める操作なので `site.manage`。
 */

export type ReviewBlogPlacementsDeps = {
  readonly placements: BlogAffiliatePlacementPort;
  /** 記事の全体集合を知っている唯一の口。掲載漏れの分母になる。 */
  readonly blogOps: Pick<BlogOpsRepositoryPort, "listArticles">;
};

export type ReviewBlogPlacementsInput =
  | { readonly action: "by_site"; readonly siteSlug: string }
  | {
      readonly action: "by_affiliate";
      readonly trackingCode?: string;
      readonly placement?: string;
    }
  | {
      readonly action: "save";
      readonly siteSlug: string;
      readonly articleSlug: string;
      readonly placement: string;
      readonly trackingCode?: string;
      readonly position?: number;
    }
  | {
      readonly action: "remove";
      readonly siteSlug: string;
      readonly articleSlug: string;
      readonly placement: string;
      readonly trackingCode?: string;
    };

export type BlogPlacementsView =
  | {
      readonly kind: "by_site";
      readonly siteSlug: string;
      readonly articles: readonly ArticlePlacements[];
      /**
       * 掲載 0 件の記事の数。**この一覧の主役**。
       * 画面で数え直させない——数え方が 2 つに割れると、
       * 「一覧では 3 件なのに見出しは 2 件」が起きる。
       */
      readonly missingCount: number;
    }
  | {
      readonly kind: "by_affiliate";
      readonly placements: readonly (AffiliatePlacement & {
        readonly articleStatus: BlogArticleStatus | "missing";
      })[];
    };

/** 位置の語彙。台帳は自由文字列を持てるが、画面から入るのはこの 3 つ。 */
const PLACEMENT_SLOTS = ["intro", "comparison", "conclusion"] as const;

function parseSlot(raw: string): Result<string, DomainError> {
  return (PLACEMENT_SLOTS as readonly string[]).includes(raw)
    ? ok(raw)
    : err(validationError("掲載位置は導入・比較・まとめから選んでください。", "placement"));
}

/**
 * 追跡コードの空文字は「コード無し」に寄せる。
 *
 * フォームの未入力は空文字で届く。空文字のまま保存すると、
 * `''` の行と `NULL` の行が別物として並び、片方だけ消える。
 */
function normalizeCode(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

export function createReviewBlogPlacementsUseCase(
  deps: ReviewBlogPlacementsDeps,
): UseCase<ReviewBlogPlacementsInput, BlogPlacementsView> {
  const { placements, blogOps } = deps;

  async function bySite(
    actor: ActorContext,
    siteSlug: string,
  ): Promise<Result<BlogPlacementsView, DomainError>> {
    const articles = await blogOps.listArticles(actor.workspaceId, siteSlug);
    if (!articles.ok) return articles;

    const listed = await placements.listBySite({
      workspaceId: actor.workspaceId,
      siteSlug,
      // 分母を渡すことで、載っていない記事が空の行として返る。
      knownArticleSlugs: articles.value.map((a) => a.slug),
    });
    if (!listed.ok) return listed;

    return ok({
      kind: "by_site",
      siteSlug,
      articles: listed.value,
      missingCount: listed.value.filter((entry) => entry.placements.length === 0).length,
    });
  }

  return {
    async execute(
      actor: ActorContext,
      input: ReviewBlogPlacementsInput,
    ): Promise<Result<BlogPlacementsView, DomainError>> {
      const reading = input.action === "by_site" || input.action === "by_affiliate";
      const allowed = requireCapability(
        actor,
        reading ? "content.read" : "site.manage",
        "ブログの成果リンク掲載",
      );
      if (!allowed.ok) return allowed;

      if (input.action === "by_site") return bySite(actor, input.siteSlug);

      if (input.action === "by_affiliate") {
        /*
          絞り込みは「未指定なら条件を足さない」。ここだけ `undefined` の意味が
          保存・削除と逆になる（あちらは「コード無しの掲載」を指す）。
          検索の未指定は全件、削除の未指定は NULL 一致——混ぜると
          「コード無しを消したつもりで全部消える」になる。
        */
        const code = normalizeCode(input.trackingCode);
        const found = await placements.listByAffiliate({
          workspaceId: actor.workspaceId,
          ...(code === undefined ? {} : { trackingCode: code }),
          ...(input.placement === undefined ? {} : { placement: input.placement }),
        });
        if (!found.ok) return found;
        const articles = await blogOps.listArticles(actor.workspaceId, null);
        if (!articles.ok) return articles;
        const statusByArticle = new Map(
          articles.value.map((article) => [
            `${article.siteSlug}\u001f${article.slug}`,
            article.status,
          ] as const),
        );
        return ok({
          kind: "by_affiliate",
          placements: found.value.map((placement) => ({
            ...placement,
            articleStatus:
              statusByArticle.get(`${placement.siteSlug}\u001f${placement.articleSlug}`) ??
              "missing",
          })),
        });
      }

      const slot = parseSlot(input.placement);
      if (!slot.ok) return slot;
      const trackingCode = normalizeCode(input.trackingCode);

      if (input.action === "save") {
        /*
          記事が実在することを、保存の前に確かめる。
          台帳は article_slug に外部キーを持たない（記事は別の表で、
          slug は書き換わりうる）。ここで見ないと、打ち間違えた slug の
          掲載が台帳に残り、どの記事の一覧にも出ないまま数だけ増える。
        */
        const articles = await blogOps.listArticles(actor.workspaceId, input.siteSlug);
        if (!articles.ok) return articles;
        const article = articles.value.find((candidate) => candidate.slug === input.articleSlug);
        if (article === undefined) {
          return err(
            validationError("その記事はこのブログに見つかりません。", "articleSlug"),
          );
        }

        const saved = await placements.save({
          workspaceId: actor.workspaceId,
          placement: {
            siteSlug: input.siteSlug,
            articleSlug: input.articleSlug,
            placement: slot.value,
            position: input.position ?? 0,
            ...(trackingCode === undefined ? {} : { trackingCode }),
          },
          publicArticleBlock: {
            articleId: article.id,
            block: toAffiliatePlacementArticleBlock({
              workspaceId: actor.workspaceId,
              siteSlug: input.siteSlug,
              articleSlug: input.articleSlug,
              placement: slot.value,
              ...(trackingCode === undefined ? {} : { trackingCode }),
              position: input.position ?? 0,
            }),
          },
        });
        if (!saved.ok) return saved;
        return bySite(actor, input.siteSlug);
      }

      const removed = await placements.remove({
        workspaceId: actor.workspaceId,
        siteSlug: input.siteSlug,
        articleSlug: input.articleSlug,
        placement: slot.value,
        ...(trackingCode === undefined ? {} : { trackingCode }),
        publicArticleBlockId: affiliatePlacementArticleBlockId({
          workspaceId: actor.workspaceId,
          siteSlug: input.siteSlug,
          articleSlug: input.articleSlug,
          placement: slot.value,
          ...(trackingCode === undefined ? {} : { trackingCode }),
        }),
      });
      if (!removed.ok) return removed;
      return bySite(actor, input.siteSlug);
    },
  };
}
