import type { AeoProfilePort, AnswerUnitPort } from "@/application/ports/blog-improvement";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { IdGeneratorPort } from "@/application/ports/common";
import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import { type AeoGapKind, type AnswerUnit, type SiteAeoProfile, detectGaps } from "@/domain/aeo";
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

/**
 * AEO（回答エンジン最適化）— ブログの構えと、記事から取り出した引用単位。
 *
 * --- なぜ「構え」と「単位」を 1 つのユースケースに置くか ---
 * 記事から取り出した Q&A は、単体では良し悪しが決まらない。同じ答えでも
 * 「このブログは何に答える場所か」(`SiteAeoProfile`) と噛み合っていなければ
 * 引かれない。片方だけを見せる画面は必ずもう片方を欲しがるので、
 * 読み口をここで 1 つにしておく。
 *
 * --- 抽出は置き換えである ---
 * `extract` は記事 1 本ぶんの単位を作り直す。前にあった問いは黙って消える
 * ので、**消えたことが行の差分に残らない**。だから件数を監査に残す。
 * 回答エンジンへ出していた Q&A が消えた日を、あとから辿れるようにする。
 *
 * --- 隙間 (gap) はここで数える ---
 * `detectGaps` を画面で呼ぶと、一覧と詳細で数え方がずれうる (AD-2)。
 * 判定はこの層で済ませ、画面は出すだけにする。
 *
 * --- 権限 ---
 * 見る = `content.read`、抽出 = `content.write`（記事を直す作業の一部）、
 * 構えの保存 = `site.manage`（ブログ全体に効く宣言なので運用側）。
 */

export type ManageAeoAnswersDeps = {
  readonly profiles: AeoProfilePort;
  readonly units: AnswerUnitPort;
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
  readonly now: () => Date;
};

export type ManageAeoAnswersInput =
  /** `articleSlug` を省くとブログ全体の単位を返す。 */
  | { readonly action: "read"; readonly siteSlug: string; readonly articleSlug?: string }
  | {
      readonly action: "save_profile";
      readonly siteSlug: string;
      readonly topicScope: string;
      readonly audience: string;
      readonly publisherName: string;
      readonly structuredDataEnabled: boolean;
    }
  | { readonly action: "extract"; readonly siteSlug: string; readonly articleSlug: string };

/** 引用単位と、その単位が抱えている隙間。 */
export type AnswerUnitWithGaps = {
  readonly unit: AnswerUnit;
  readonly gaps: readonly AeoGapKind[];
};

export type AeoAnswersView = {
  readonly siteSlug: string;
  readonly articleSlug: string | null;
  /** まだ構えを決めていないブログは `null`。画面はここで入力を促す。 */
  readonly profile: SiteAeoProfile | null;
  readonly units: readonly AnswerUnitWithGaps[];
  /** 直前の抽出で作られた単位の数。`null` は「この操作では抽出していない」。 */
  readonly extractedCount: number | null;
};

export function createManageAeoAnswersUseCase(
  deps: ManageAeoAnswersDeps,
): UseCase<ManageAeoAnswersInput, AeoAnswersView> {
  const { profiles, units } = deps;

  async function record(
    actor: ActorContext,
    entryInput: {
      readonly action: "aeo_profile.changed" | "aeo_answer_units.extracted";
      readonly targetType: string;
      readonly targetId: string;
      readonly after: Readonly<Record<string, unknown>>;
      readonly doneAlready: string;
    },
  ): Promise<Result<null, DomainError>> {
    const entry = buildAuditEntry(deps, actor, {
      action: entryInput.action,
      targetType: entryInput.targetType,
      targetId: entryInput.targetId,
      after: entryInput.after,
    });
    if (!entry.ok) return entry;
    const appended = await deps.auditLog.append(entry.value);
    if (!appended.ok) {
      return err(auditWriteFailure(entryInput.doneAlready, { targetId: entryInput.targetId }));
    }
    return ok(null);
  }

  /** 変更のあとは必ず読み直す。 */
  async function view(
    actor: ActorContext,
    siteSlug: string,
    articleSlug: string | null,
    extra: { readonly extractedCount?: number } = {},
  ): Promise<Result<AeoAnswersView, DomainError>> {
    const profile = await profiles.get(actor.workspaceId, siteSlug);
    if (!profile.ok) return profile;

    const listed =
      articleSlug === null
        ? await units.listForSite(actor.workspaceId, siteSlug)
        : await units.listForArticle(actor.workspaceId, siteSlug, articleSlug);
    if (!listed.ok) return listed;

    return ok({
      siteSlug,
      articleSlug,
      profile: profile.value,
      units: listed.value.map((unit) => ({ unit, gaps: detectGaps(unit) })),
      extractedCount: extra.extractedCount ?? null,
    });
  }

  return {
    async execute(
      actor: ActorContext,
      input: ManageAeoAnswersInput,
    ): Promise<Result<AeoAnswersView, DomainError>> {
      const capability =
        input.action === "read"
          ? ("content.read" as const)
          : input.action === "save_profile"
            ? ("site.manage" as const)
            : ("content.write" as const);
      const allowed = requireCapability(actor, capability, "AEO（回答エンジン最適化）の管理");
      if (!allowed.ok) return allowed;

      if (input.action === "save_profile") {
        /*
         * 3 つとも空を許さない。空のまま保存できると、構造化データの
         * 発行元が空文字で出ていく。回答エンジン側では「壊れている」
         * ではなく「名乗っていない」として扱われ、気づく手がかりが
         * 画面のどこにも残らない。
         */
        const topicScope = input.topicScope.trim();
        if (topicScope === "") {
          return err(
            validationError("このブログが何に答える場所かを書いてください。", "topicScope"),
          );
        }
        const audience = input.audience.trim();
        if (audience === "") {
          return err(validationError("誰の問いに答えるかを書いてください。", "audience"));
        }
        const publisherName = input.publisherName.trim();
        if (publisherName === "") {
          return err(
            validationError(
              "出典として名乗る主体を書いてください。構造化データの発行元になります。",
              "publisherName",
            ),
          );
        }

        const saved = await profiles.save(actor.workspaceId, {
          siteSlug: input.siteSlug,
          topicScope,
          audience,
          publisherName,
          structuredDataEnabled: input.structuredDataEnabled,
          updatedAt: deps.now(),
        });
        if (!saved.ok) return saved;

        const recorded = await record(actor, {
          action: "aeo_profile.changed",
          targetType: "aeo_profile",
          targetId: input.siteSlug,
          after: {
            topicScope: saved.value.topicScope,
            audience: saved.value.audience,
            publisherName: saved.value.publisherName,
            structuredDataEnabled: saved.value.structuredDataEnabled,
          },
          doneAlready: "AEO の構えを保存しました",
        });
        if (!recorded.ok) return recorded;
        return view(actor, input.siteSlug, null);
      }

      if (input.action === "extract") {
        const extracted = await units.extract(
          actor.workspaceId,
          input.siteSlug,
          input.articleSlug,
        );
        if (!extracted.ok) return extracted;

        const recorded = await record(actor, {
          action: "aeo_answer_units.extracted",
          targetType: "aeo_answer_unit",
          targetId: input.articleSlug,
          // 件数を残すのは、置き換えで消えた問いが差分に出ないため。
          // 0 件は失敗ではなく「引用できる形になっていない」という結果。
          after: { siteSlug: input.siteSlug, count: extracted.value.length },
          doneAlready: "記事から引用単位を取り直しました",
        });
        if (!recorded.ok) return recorded;
        return view(actor, input.siteSlug, input.articleSlug, {
          extractedCount: extracted.value.length,
        });
      }

      return view(actor, input.siteSlug, input.articleSlug ?? null);
    },
  };
}
