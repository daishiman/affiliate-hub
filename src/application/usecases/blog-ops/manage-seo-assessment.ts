import type {
  AssessmentTarget,
  SeoAssessmentPort,
} from "@/application/ports/blog-improvement";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { IdGeneratorPort } from "@/application/ports/common";
import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import { requireCapability } from "@/domain/identity";
import type { SeoFinding } from "@/domain/seo";
import {
  type ActorContext,
  type DomainError,
  type Result,
  err,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * SEO の診断を回し、その結果をブログへ反映する（下書きまで）。
 *
 * --- 反映は下書きで止まる (AD-3) ---
 * `draft_fix` が作るのは改訂の下書きだけで、公開はしない。ここを
 * 自動公開にすると、診断器が壊れた日に読者へ出ているものが黙って
 * 変わる。**読者に見えるものを機械の判断だけで変えない**という線は
 * ポートの形（`draftFix` が改訂 id しか返さない）で引かれており、
 * この層はその線を跨がない。
 *
 * --- 権限を 3 つに分けた理由 ---
 * - 見る (`content.read`): 指摘の一覧は、記事を書く人が読む物である。
 * - 回す・下書きを作る (`content.write`): 記事を直す作業の一部。
 * - 「直さない」と決める (`site.manage`): これは診断より強い判断で、
 *   次の診断でも復活しない。記事 1 本を直す権限とは重さが違うので、
 *   ブログの運用を預かる人の側へ置く。
 *
 * --- 記録 ---
 * 診断を回したこと自体を残す。指摘が消えた理由（記事を直したのか、
 * 診断器を差し替えて観点ごと無くなったのか）は、指摘の行だけを見ても
 * 区別できない。`deps.auditLog.append()` はこのファイルの中に置く
 * (`src/application/audit.ts` の doc を参照)。
 */

export type ManageSeoAssessmentDeps = {
  readonly seo: SeoAssessmentPort;
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
  readonly now: () => Date;
};

export type ManageSeoAssessmentInput =
  | { readonly action: "read"; readonly siteSlug: string }
  /** `articleSlug` を省くとブログ全体を診断する。 */
  | { readonly action: "assess"; readonly siteSlug: string; readonly articleSlug?: string }
  | { readonly action: "draft_fix"; readonly siteSlug: string; readonly findingId: string }
  | {
      readonly action: "dismiss";
      readonly siteSlug: string;
      readonly findingId: string;
      readonly reason: string;
    };

export type SeoAssessmentView = {
  readonly siteSlug: string;
  /** 未対応の指摘。出す順（重さ × 件数）は保存側が決めている。 */
  readonly openFindings: readonly SeoFinding[];
  /** 直前の診断で見た記事の本数。`null` は「この操作では診断していない」。 */
  readonly assessedArticles: number | null;
  /** `draft_fix` で作った改訂の id。画面はこれを編集画面へ渡す。 */
  readonly draftRevisionId: string | null;
};

export function createManageSeoAssessmentUseCase(
  deps: ManageSeoAssessmentDeps,
): UseCase<ManageSeoAssessmentInput, SeoAssessmentView> {
  const { seo } = deps;

  async function record(
    actor: ActorContext,
    entryInput: {
      readonly action: "seo_assessment.ran" | "seo_finding.drafted" | "seo_finding.dismissed";
      readonly targetType: string;
      readonly targetId: string;
      readonly after: Readonly<Record<string, unknown>>;
      readonly reason?: string;
      readonly doneAlready: string;
    },
  ): Promise<Result<null, DomainError>> {
    const entry = buildAuditEntry(deps, actor, {
      action: entryInput.action,
      targetType: entryInput.targetType,
      targetId: entryInput.targetId,
      after: entryInput.after,
      reason: entryInput.reason ?? null,
    });
    if (!entry.ok) return entry;
    const appended = await deps.auditLog.append(entry.value);
    if (!appended.ok) {
      return err(auditWriteFailure(entryInput.doneAlready, { targetId: entryInput.targetId }));
    }
    return ok(null);
  }

  /** 操作のあとは必ず読み直す。画面が自前で一覧を継ぎ足さない。 */
  async function view(
    actor: ActorContext,
    siteSlug: string,
    extra: {
      readonly assessedArticles?: number;
      readonly draftRevisionId?: string;
    } = {},
  ): Promise<Result<SeoAssessmentView, DomainError>> {
    const open = await seo.listOpen(actor.workspaceId, siteSlug);
    if (!open.ok) return open;
    return ok({
      siteSlug,
      openFindings: open.value,
      assessedArticles: extra.assessedArticles ?? null,
      draftRevisionId: extra.draftRevisionId ?? null,
    });
  }

  function capabilityFor(action: ManageSeoAssessmentInput["action"]) {
    if (action === "read") return "content.read" as const;
    if (action === "dismiss") return "site.manage" as const;
    return "content.write" as const;
  }

  return {
    async execute(
      actor: ActorContext,
      input: ManageSeoAssessmentInput,
    ): Promise<Result<SeoAssessmentView, DomainError>> {
      const allowed = requireCapability(
        actor,
        capabilityFor(input.action),
        "SEO 診断と反映",
      );
      if (!allowed.ok) return allowed;

      if (input.action === "assess") {
        const target: AssessmentTarget =
          input.articleSlug === undefined
            ? { kind: "site", siteSlug: input.siteSlug }
            : { kind: "article", siteSlug: input.siteSlug, articleSlug: input.articleSlug };

        const run = await seo.assess(actor.workspaceId, target);
        if (!run.ok) return run;

        const recorded = await record(actor, {
          action: "seo_assessment.ran",
          targetType: "seo_assessment",
          targetId: input.articleSlug ?? input.siteSlug,
          after: {
            scope: target.kind,
            assessedArticles: run.value.assessedArticles,
            findings: run.value.findings.length,
          },
          doneAlready: "SEO 診断を回しました",
        });
        if (!recorded.ok) return recorded;
        return view(actor, input.siteSlug, { assessedArticles: run.value.assessedArticles });
      }

      if (input.action === "draft_fix") {
        const drafted = await seo.draftFix(actor.workspaceId, input.findingId);
        if (!drafted.ok) return drafted;

        const recorded = await record(actor, {
          action: "seo_finding.drafted",
          targetType: "seo_finding",
          targetId: input.findingId,
          // 公開していないことを行に明示する。あとで一覧を読む人が
          // 「反映した」と読み違えないため。
          after: {
            draftRevisionId: drafted.value.draftRevisionId,
            published: false,
          },
          doneAlready: "指摘から下書きを作りました",
        });
        if (!recorded.ok) return recorded;
        return view(actor, input.siteSlug, { draftRevisionId: drafted.value.draftRevisionId });
      }

      if (input.action === "dismiss") {
        const reason = input.reason.trim();
        if (reason === "") {
          return err(
            validationError(
              "「直さない」と決めた理由を書いてください。次の診断でも復活しなくなります。",
              "reason",
            ),
          );
        }
        const dismissed = await seo.dismiss(actor.workspaceId, input.findingId, reason);
        if (!dismissed.ok) return dismissed;

        const recorded = await record(actor, {
          action: "seo_finding.dismissed",
          targetType: "seo_finding",
          targetId: input.findingId,
          after: { state: "dismissed" },
          reason,
          doneAlready: "この指摘を「直さない」として記録しました",
        });
        if (!recorded.ok) return recorded;
        return view(actor, input.siteSlug);
      }

      return view(actor, input.siteSlug);
    },
  };
}
