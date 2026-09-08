import type {
  AiSearchAuditCoverage,
  AiSearchAuditHistoryPort,
} from "@/application/ports/seo";
import type { ArticleType } from "@/domain/authoring";
import { requireCapability } from "@/domain/identity";
import type { AuditTrigger } from "@/domain/seo/ai-search-audit-trigger";
import { domainError, err, ok } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 最新の点検で落ちている公開記事の一覧（REQ-SEO07 / 受入 A5）。
 *
 * --- HTTP の口を作らない ---
 * 管理画面のサーバ部品が直接呼ぶ。読むだけの一覧に REST を 1 本足すと、
 * 権限判定が「usecase の中」と「route handler の中」の 2 か所に増える。
 *
 * --- workspace を入力に持たない ---
 * `actor.workspaceId` から解く。入力で受け取れる形にすると、
 * 呼び出し側が他人の workspace を指定できる型が存在してしまう。
 */

export type ListFailingAuditsInput = {
  readonly siteSlug?: string;
  /** 既定 50。画面が一度に読める量を超えたら `truncated` で知らせる。 */
  readonly limit?: number;
};

export type FailingAuditRow = {
  readonly siteSlug: string;
  readonly slug: string;
  readonly title: string;
  readonly type: ArticleType;
  readonly checkedAt: string;
  readonly trigger: AuditTrigger;
  readonly passedCount: number;
  readonly totalCount: number;
  /** 落ちた項目だけ。通った項目は入れない（直す手がかりにならない）。 */
  readonly failed: readonly { readonly check: string; readonly hint: string }[];
};

export type ListFailingAuditsOutput = {
  readonly rows: readonly FailingAuditRow[];
  /** 上限で切ったか。切ったことを黙っていると「これで全部」と読まれる。 */
  readonly truncated: boolean;
  readonly coverage: {
    readonly publishedCount: number;
    readonly auditedCount: number;
    readonly uncheckedCount: number;
  };
};

const DEFAULT_LIMIT = 50;

function isCoverage(value: unknown): value is AiSearchAuditCoverage {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<AiSearchAuditCoverage>;
  return (
    Number.isInteger(candidate.publishedCount) &&
    Number.isInteger(candidate.auditedCount) &&
    (candidate.publishedCount ?? -1) >= 0 &&
    (candidate.auditedCount ?? -1) >= 0 &&
    (candidate.auditedCount ?? 0) <= (candidate.publishedCount ?? -1)
  );
}

export function createListFailingAuditsUseCase(deps: {
  readonly history: AiSearchAuditHistoryPort;
}): UseCase<ListFailingAuditsInput, ListFailingAuditsOutput> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "AI 検索点検の結果の参照");
      if (!allowed.ok) return allowed;
      const limit = input.limit ?? DEFAULT_LIMIT;
      /*
        1 件多く取る。上限ちょうどの件数が返ったとき、それが
        「ちょうど上限」なのか「まだ続きがある」のかは、
        上限だけ取ったのでは区別が付かない。
      */
      const [listed, coverage] = await Promise.all([
        deps.history.listLatestFailing({
          workspaceId: actor.workspaceId,
          siteSlug: input.siteSlug,
          limit: limit + 1,
        }),
        deps.history.getCoverage({
          workspaceId: actor.workspaceId,
          siteSlug: input.siteSlug,
        }),
      ]);
      if (!listed.ok) return listed;
      if (!coverage.ok) return coverage;
      if (!isCoverage(coverage.value)) {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "AI 検索点検の範囲を読み取れませんでした。", {
            suggestedAction: "時間をおいて、公開済み記事の画面を開き直してください。",
          }),
        );
      }
      const truncated = listed.value.length > limit;
      return ok({
        rows: listed.value.slice(0, limit).map(
          (row): FailingAuditRow => ({
            siteSlug: row.siteSlug,
            slug: row.slug,
            title: row.title,
            type: row.type,
            checkedAt: row.checkedAt,
            trigger: row.trigger,
            passedCount: row.passedCount,
            totalCount: row.totalCount,
            /*
              hint は保存された当時の文言をそのまま返す。ここで今の
              `auditArticleForAiSearch` の文言に差し替えると、点検した時点で
              出ていた指示と、画面に出る指示が食い違う。
            */
            failed: row.checks
              .filter((check) => !check.ok)
              .map((check) => ({ check: check.check, hint: check.hint })),
          }),
        ),
        truncated,
        coverage: {
          ...coverage.value,
          uncheckedCount: Math.max(
            0,
            coverage.value.publishedCount - coverage.value.auditedCount,
          ),
        },
      });
    },
  };
}
