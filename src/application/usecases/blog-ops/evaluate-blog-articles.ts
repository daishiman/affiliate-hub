import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type {
  ArticleRatingPort,
  BlogOpsRepositoryPort,
  PublicBlogPort,
} from "@/application/ports/blog-ops";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import {
  ARTICLE_TEMPLATE_LABEL,
  type ArticleTemplate,
  FRESHNESS_LABEL,
  type Freshness,
  MAX_SCORE,
  type RatingSummary,
  freshnessOf,
  validateScore,
} from "@/domain/blogops";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  containsCommercial,
  err,
  notFound,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 記事の評価。
 *
 * 2 つの向きがある。
 *   1. 運営者が読む「評価の一覧」— 平均・件数・鮮度をまとめて見る
 *   2. 読者が押す「星の送信」— 1 記事 1 人 1 票
 *
 * **依存を分けている。** 読者側は `ArticleRatingPort` しか受け取らない。
 * 記事を保存する口をここに置かないことが、
 * 「読者の操作で記事本文が書き換わる」経路を型の上で作れなくしている。
 */

export type EvaluateBlogArticlesDeps = {
  readonly repository: BlogOpsRepositoryPort;
  readonly now: () => Date;
  readonly affiliateLinks?: never;
};

function guardEditorial(deps: Record<string, unknown>, what: string): void {
  const commercial = containsCommercial(deps);
  if (commercial.length > 0) {
    throw new Error(
      `${what}に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬額を評価の並び順の入力にすることはできません。",
    );
  }
}

export type ArticleEvaluationRow = {
  readonly articleId: string;
  readonly siteSlug: string;
  readonly slug: string;
  readonly title: string;
  readonly template: ArticleTemplate;
  readonly templateLabel: string;
  readonly ratingCount: number;
  /** 平均。1 票も無いときは 0 ではなく null。0 は「最低評価が付いた」の意味になる。 */
  readonly ratingAverage: number | null;
  readonly freshness: Freshness;
  readonly freshnessLabel: string;
  /** 手を入れる目安。理由が無ければ null。 */
  readonly attentionReason: string | null;
};

export type EvaluateBlogArticlesInput = { readonly siteSlug?: string | null };

export type EvaluateBlogArticlesOutput = {
  readonly rows: readonly ArticleEvaluationRow[];
  readonly total: number;
  readonly attentionCount: number;
  readonly emptyReason: string | null;
};

/**
 * 手を入れる目安。
 *
 * **平均だけで決めない。** 票が 2 つしか無い記事の平均は、
 * 次の 1 票で大きく動く。少ない票で「低評価だから直せ」と出すと、
 * 書き手は数字を動かすために内容と関係のない手直しをする。
 * だから票が少ないうちは鮮度だけを見て、票が集まってから平均を見る。
 */
function attentionReasonOf(summary: RatingSummary, freshness: Freshness): string | null {
  if (summary.count >= 5 && summary.average !== null && summary.average < 3) {
    return `${summary.count} 件の評価で平均 ${summary.average}／${MAX_SCORE}。読者が期待した内容と中身がずれている可能性があります。`;
  }
  if (freshness === "stale") {
    return "1 年以上更新されていません。価格や仕様の記述が古くなっていないか確認してください。";
  }
  if (freshness === "aging" && summary.count === 0) {
    return "半年以上更新が無く、評価も 1 件もありません。読者に届いているか確認してください。";
  }
  return null;
}

export function createEvaluateBlogArticlesUseCase(
  deps: EvaluateBlogArticlesDeps,
): UseCase<EvaluateBlogArticlesInput, EvaluateBlogArticlesOutput> {
  guardEditorial(deps as unknown as Record<string, unknown>, "記事の評価一覧");
  return {
    async execute(
      actor: ActorContext,
      input: EvaluateBlogArticlesInput,
    ): Promise<Result<EvaluateBlogArticlesOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "記事の評価の閲覧");
      if (!allowed.ok) return allowed;

      const found = await deps.repository.listArticles(actor.workspaceId, input.siteSlug ?? null);
      if (!found.ok) return found;

      const summaries = await deps.repository.summarizeRatings(
        actor.workspaceId,
        found.value.map((a) => a.id),
      );
      if (!summaries.ok) return summaries;

      const now = deps.now();
      const rows = found.value.map((a): ArticleEvaluationRow => {
        const summary = summaries.value[a.id] ?? { count: 0, average: null };
        const freshness = freshnessOf(a.updatedAt, now);
        return {
          articleId: a.id,
          siteSlug: a.siteSlug,
          slug: a.slug,
          title: a.title,
          template: a.template,
          templateLabel: ARTICLE_TEMPLATE_LABEL[a.template],
          ratingCount: summary.count,
          ratingAverage: summary.average,
          freshness,
          freshnessLabel: FRESHNESS_LABEL[freshness],
          attentionReason: attentionReasonOf(summary, freshness),
        };
      });

      return ok({
        rows,
        total: rows.length,
        attentionCount: rows.filter((r) => r.attentionReason !== null).length,
        emptyReason: rows.length === 0 ? "評価の対象になる記事がまだありません。" : null,
      });
    },
  };
}

export type SubmitArticleRatingDeps = {
  readonly ratings: ArticleRatingPort;
  readonly publicBlog: PublicBlogPort;
  readonly ids: IdGeneratorPort;
  readonly now: () => Date;
  readonly affiliateLinks?: never;
};

export type SubmitArticleRatingInput = {
  readonly siteSlug: string;
  readonly articleSlug: string;
  readonly readerKey: string;
  readonly score: number;
  readonly comment: string | null;
};

export type SubmitArticleRatingOutput = {
  readonly count: number;
  readonly average: number | null;
};

export function createSubmitArticleRatingUseCase(
  deps: SubmitArticleRatingDeps,
): UseCase<SubmitArticleRatingInput, SubmitArticleRatingOutput> {
  guardEditorial(deps as unknown as Record<string, unknown>, "読者の評価の受け取り");
  return {
    async execute(
      _actor: ActorContext,
      input: SubmitArticleRatingInput,
    ): Promise<Result<SubmitArticleRatingOutput, DomainError>> {
      /*
       * 権限は要らない。読者は誰でも押せる。
       * 代わりに読者の鍵（cookie 由来）で 1 記事 1 票に抑える。
       * ここで `requireCapability` を呼ぶと、記事を読める全員に
       * 管理面の権限を配ることになる。
       */
      const score = validateScore(input.score);
      if (!score.ok) return score;

      const readerKey = input.readerKey.trim();
      if (readerKey === "") {
        /*
         * **欄の名前を付けない。**
         *
         * `readerKey` は端末の目印で、読者が触れる欄ではない。画面に無い欄の名前を
         * 付けると `FormResult` は「欄の側が出すはず」と判断して黙り、欄は存在しないので
         * 誰も出さない。断りが正しく作られたまま、読者には
         * 「押しても何も起きない画面」として届く (2026-08-26 に実測)。
         *
         * ここが空なのは読者の落ち度ではなくこちら側の事情なので、
         * フォーム全体の断りとして出すのが正しい。
         */
        return err(
          validationError(
            "評価を受け取れませんでした。ブラウザの設定で cookie が切れていると、二重投票を止められません。",
          ),
        );
      }

      const opened = await deps.publicBlog.openSite(input.siteSlug);
      if (!opened.ok) return opened;
      if (opened.value === null) {
        return err(notFound("記事", `${input.siteSlug}/${input.articleSlug}`));
      }
      const article = await opened.value.findArticleBySlug(input.articleSlug);
      if (!article.ok) return article;
      if (article.value === null) {
        return err(notFound("記事", `${input.siteSlug}/${input.articleSlug}`));
      }
      const sourceArticleId = await opened.value.findSourceArticleId(input.articleSlug);
      if (!sourceArticleId.ok) return sourceArticleId;
      if (sourceArticleId.value === null) {
        return err(notFound("評価できる記事", `${input.siteSlug}/${input.articleSlug}`));
      }

      const comment = input.comment?.trim() ?? "";
      const put = await deps.ratings.put({
        id: `brt_${deps.ids.newId()}`,
        articleId: sourceArticleId.value,
        readerKey,
        score: score.value,
        comment: comment === "" ? null : comment,
        createdAt: deps.now(),
      });
      if (!put.ok) return put;

      const summary = await deps.ratings.summarize(sourceArticleId.value);
      if (!summary.ok) return summary;

      return ok({ count: summary.value.count, average: summary.value.average });
    },
  };
}

/* ==========================================================================
 * 票を 1 件ずつ見る／伏せる（受入条件 A11）
 *
 * **消さずに伏せる。** 消すと「伏せた」と「最初から無かった」が同じ形になり、
 * 伏せた判断そのものを後から確かめられなくなる。行は残し、集計から外す。
 *
 * 伏せる判断は運営者の裁量なので、**必ず理由を書かせる。** 理由の無い削除を
 * 断るのと同じ考えで、あとから「なぜこれを伏せたのか」を辿れるようにする。
 * ========================================================================== */

export type ManageArticleRatingsDeps = {
  readonly repository: BlogOpsRepositoryPort;
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
  readonly now: () => Date;
  readonly affiliateLinks?: never;
};

export type ListArticleRatingsInput = { readonly articleId: string };

export type ArticleRatingRow = {
  readonly id: string;
  readonly score: number;
  readonly comment: string | null;
  readonly hidden: boolean;
  readonly createdAt: Date;
};

export type ListArticleRatingsOutput = {
  readonly rows: readonly ArticleRatingRow[];
  readonly shownCount: number;
  readonly hiddenCount: number;
  readonly emptyReason: string | null;
};

export function createListArticleRatingsUseCase(
  deps: ManageArticleRatingsDeps,
): UseCase<ListArticleRatingsInput, ListArticleRatingsOutput> {
  guardEditorial(deps as unknown as Record<string, unknown>, "評価の一覧");
  return {
    async execute(
      actor: ActorContext,
      input: ListArticleRatingsInput,
    ): Promise<Result<ListArticleRatingsOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "評価の一覧");
      if (!allowed.ok) return allowed;

      const found = await deps.repository.listRatings(actor.workspaceId, input.articleId);
      if (!found.ok) return found;

      const rows = found.value.map(
        (r): ArticleRatingRow => ({
          id: r.id,
          score: r.score,
          comment: r.comment,
          hidden: r.hidden,
          createdAt: r.createdAt,
        }),
      );
      const hiddenCount = rows.filter((r) => r.hidden).length;
      return ok({
        rows,
        shownCount: rows.length - hiddenCount,
        hiddenCount,
        emptyReason: rows.length === 0 ? "この記事にはまだ評価が付いていません。" : null,
      });
    },
  };
}

export type SetArticleRatingHiddenInput = {
  readonly articleId: string;
  readonly ratingId: string;
  readonly hidden: boolean;
  /** なぜ伏せる（戻す）のか。**空は断る。** */
  readonly reason: string;
};

export type SetArticleRatingHiddenOutput = {
  readonly ratingId: string;
  readonly hidden: boolean;
};

export function createSetArticleRatingHiddenUseCase(
  deps: ManageArticleRatingsDeps,
): UseCase<SetArticleRatingHiddenInput, SetArticleRatingHiddenOutput> {
  guardEditorial(deps as unknown as Record<string, unknown>, "評価の非表示");
  return {
    async execute(
      actor: ActorContext,
      input: SetArticleRatingHiddenInput,
    ): Promise<Result<SetArticleRatingHiddenOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.write", "評価の非表示");
      if (!allowed.ok) return allowed;

      const reason = input.reason.trim();
      if (reason === "") {
        return err(
          validationError(
            "なぜ伏せる（戻す）のかを書いてください。読者が書いたものを見えなくする操作なので、後からその判断を辿れる形にします。",
            "reason",
          ),
        );
      }

      /*
       * **一覧を経由して在ることを確かめる。**
       * `setRatingHidden` に直接 id を渡すと、別の作業場所の票の id を
       * 当てられた場合に、当たったかどうかが応答の速さから漏れる。
       */
      const found = await deps.repository.listRatings(actor.workspaceId, input.articleId);
      if (!found.ok) return found;
      const target = found.value.find((r) => r.id === input.ratingId);
      if (target === undefined) return err(notFound("評価", input.ratingId));

      const put = await deps.repository.setRatingHidden(
        actor.workspaceId,
        input.ratingId,
        input.hidden,
      );
      if (!put.ok) return put;

      const entry = buildAuditEntry(deps, actor, {
        action: input.hidden ? "blog_rating.hidden" : "blog_rating.shown",
        targetType: "blog_article_rating",
        targetId: input.ratingId,
        before: { hidden: target.hidden },
        after: { hidden: input.hidden },
        // **理由は `after` ではなく理由の欄に置く。**`after` に混ぜると
        // 「操作の後の状態」に理由が紛れ込み、理由が必須かどうかを
        // 機械 (`REASON_REQUIRED`) が見られなくなる。
        reason,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure(
            input.hidden ? "評価を伏せました" : "評価を戻しました",
            { ratingId: input.ratingId },
          ),
        );
      }

      return ok({ ratingId: input.ratingId, hidden: input.hidden });
    },
  };
}
