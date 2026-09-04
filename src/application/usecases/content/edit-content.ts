import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type {
  EditorialContentPackageRepositoryPort,
  EditorialContentVariantRepositoryPort,
} from "@/application/ports/authoring";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import {
  type ContentAngle,
  type ContentVariant,
  type CtaType,
  createContentVariant,
} from "@/domain/authoring";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type AudiencePersonaId,
  type AuthorPersonaId,
  type ContentPackageId,
  type ContentVariantId,
  type DomainError,
  type Result,
  containsCommercial,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";
import type { UseCase } from "../usecase";
import {
  assertContentPackageBrandScope,
  assertContentVariantBrandScope,
} from "./content-brand-access";

/**
 * 記事 1 本を、人の手で作る・直す・消す。
 *
 * **AI に書かせる口（`draft_content_variant`）とは別に置いている。**
 * 生成は「材料を渡して文章を受け取る」操作で、失敗しても枠は残らない。
 * こちらは枠そのものを増やし・減らす操作で、後から
 * 「この記事はいつ誰が作ったか」を問われる。同じ口にすると、
 * AI が返さなかったときに枠だけが残ったのか、そもそも作っていないのかが
 * 履歴から読めなくなる。
 *
 * 進行の位置（`ContentState`）はここでは動かさない。動かすのは
 * `manage-content.ts` の `transition` だけで、承認の抜け道を作らないため。
 */
export type EditContentDeps = {
  readonly variants: EditorialContentVariantRepositoryPort;
  /**
   * 記事のまとまり（どの商品の・どの企画か）。
   *
   * **作る前に実在を確かめるためだけに要る。** 無いまとまりに属する記事を
   * 作れてしまうと、盤面のどの列にも出てこない記事が生まれる。
   */
  readonly packages: EditorialContentPackageRepositoryPort;
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
};

function guardEditorial(deps: EditContentDeps): void {
  const commercial = containsCommercial(deps as unknown as Record<string, unknown>);
  if (commercial.length > 0) {
    throw new Error(
      `記事の編集に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬額を文章の作成・削除の判断に入れることはできません。",
    );
  }
}

/**
 * 自分の会社の記事を 1 本引く。
 *
 * 他社の記事は「無い」と同じ応答にする（`edit-sites.ts` と同じ判断）。
 * 保管庫が会社 ID を受け取るので、絞り込み自体は保管庫側で済んでいる。
 */
async function loadOwned(
  deps: EditContentDeps,
  actor: ActorContext,
  variantId: string,
): Promise<Result<ContentVariant, DomainError>> {
  const id = taggedString<"ContentVariantId">(variantId) as ContentVariantId;
  const found = await deps.variants.findById(actor.workspaceId, id);
  if (!found.ok) return found;
  if (found.value === null) {
    return err(
      domainError("NOT_FOUND", "この記事が見つかりません。", {
        suggestedAction: "記事の一覧から選び直してください。",
      }),
    );
  }
  const scoped = await assertContentVariantBrandScope(
    deps.packages,
    actor,
    found.value,
    "記事",
  );
  if (!scoped.ok) return err(scoped.error);
  return ok(found.value);
}

/**
 * 公開中の記事は、この口では触らせない。
 *
 * 公開中の本文を直接書き換えると、読者が読んだ文章と、今ある文章が
 * 別物になる。何がどう変わったかは訂正（`content.corrected`）でしか残らないので、
 * 先に取り下げるか訂正の口を使わせる。
 */
function refuseIfPublished(variant: ContentVariant, what: string): DomainError | null {
  if (variant.status !== "published") return null;
  return domainError("CONFLICT", `公開中の記事は${what}できません。`, {
    suggestedAction:
      "先に取り下げてください。誤りを直したいだけなら、訂正として記録が残る口を使ってください。",
    details: { status: variant.status },
  });
}

// --- 作る -------------------------------------------------------------------

/**
 * 新しい記事の枠を作る。
 *
 * **本文を空では作らせない。** 業務側の決まり（`createContentVariant`）が
 * 空の本文を断るからで、ここで空の既定値を差し込むとその決まりを迂回できる。
 * 画面には「書き出し」を 1 行書いてもらう。後から全部書き換えてよい。
 *
 * 3 つの点数は 0 で入れる。**まだ何も測っていないため。**
 * 満点で入れると、確認を一度も通していない記事が、
 * 確認済みの記事と同じ見た目で盤面に並ぶ。
 */
export type CreateContentVariantInput = {
  /**
   * 再試行しても同じ記事を指す必要がある業務フローだけが渡す安定 ID。
   * 画面入力からは受け取らず、ユースケース同士の境界で決める。
   */
  readonly variantId?: string;
  readonly contentPackageId: string;
  readonly channel: string;
  readonly format: string;
  readonly authorPersonaId: string;
  readonly audiencePersonaId: string;
  readonly angle: ContentAngle;
  readonly cta: CtaType;
  readonly disclosure: string;
  readonly title?: string;
  readonly body: string;
  readonly summary: string;
};

export type EditContentOutput = {
  readonly variantId: string;
  readonly title: string | null;
  readonly status: ContentVariant["status"];
};

export function createCreateContentVariantUseCase(
  deps: EditContentDeps,
): UseCase<CreateContentVariantInput, EditContentOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.write", "記事の作成");
      if (!allowed.ok) return allowed;

      const packageId = taggedString<"ContentPackageId">(
        input.contentPackageId,
      ) as ContentPackageId;
      const pkg = await deps.packages.findById(actor.workspaceId, packageId);
      if (!pkg.ok) return pkg;
      if (pkg.value === null) {
        return err(
          domainError("NOT_FOUND", "この記事のまとまりが見つかりません。", {
            field: "contentPackageId",
            suggestedAction: "先に記事のまとまり（どの商品の・どの企画か）を選んでください。",
          }),
        );
      }
      const scoped = assertContentPackageBrandScope(actor, pkg.value, "記事のまとまり");
      if (!scoped.ok) return err(scoped.error);

      const built = createContentVariant({
        id: taggedString<"ContentVariantId">(
          input.variantId ?? `cv_${deps.ids.newId()}`,
        ) as ContentVariantId,
        workspaceId: actor.workspaceId,
        contentPackageId: packageId,
        channel: input.channel,
        format: input.format,
        authorPersonaId: taggedString<"AuthorPersonaId">(input.authorPersonaId) as AuthorPersonaId,
        audiencePersonaId: taggedString<"AudiencePersonaId">(
          input.audiencePersonaId,
        ) as AudiencePersonaId,
        angle: input.angle,
        title: input.title ?? null,
        body: input.body,
        summary: input.summary,
        cta: input.cta,
        disclosure: input.disclosure,
        factualityScore: 0,
        personaFitScore: 0,
        channelFitScore: 0,
        /*
         * 自動確認をまだ通していない状態を `warning` で表す。
         *
         * `pass` にしないのは、通っていない確認を通ったことにするため。
         * `fail` にもしない——不適合と判定されたわけではなく、
         * まだ見ていないだけで、`fail` は承認を止める重い印である。
         */
        complianceStatus: "warning",
        /* 人が手で作った枠であることを、後から追える形で残す。 */
        generationPromptVersion: "manual",
        modelId: "manual",
      });
      if (!built.ok) return built;

      const saved = await deps.variants.save(built.value);
      if (!saved.ok) return saved;

      const entry = buildAuditEntry({ ids: deps.ids, now: () => new Date() }, actor, {
        action: "content.created",
        targetType: "content_variant",
        targetId: String(saved.value.id),
        // 本文は記録に写さない。画面で読めるものを複製しても情報が増えない。
        after: { title: saved.value.title, channel: saved.value.channel },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("記事の枠は作りました", appended.error.details));
      }

      return ok({
        variantId: String(saved.value.id),
        title: saved.value.title,
        status: saved.value.status,
      });
    },
  };
}

// --- 直す -------------------------------------------------------------------

export type UpdateContentVariantInput = {
  readonly variantId: string;
  readonly title?: string;
  readonly body?: string;
  readonly summary?: string;
};

export type UpdateContentVariantOutput = EditContentOutput & {
  /** 承認が外れたか。画面はこれを見て、承認をやり直す案内を出す。 */
  readonly approvalCleared: boolean;
};

export function createUpdateContentVariantUseCase(
  deps: EditContentDeps,
): UseCase<UpdateContentVariantInput, UpdateContentVariantOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.write", "記事の修正");
      if (!allowed.ok) return allowed;

      const current = await loadOwned(deps, actor, input.variantId);
      if (!current.ok) return current;
      const before = current.value;

      const blocked = refuseIfPublished(before, "直すこと");
      if (blocked !== null) return err(blocked);

      /*
       * 承認済みの文章を直したら、承認は外す。
       *
       * **人が読んで良いと言ったのは、そのときの文章である。**
       * 承認の印を残したまま本文だけ差し替えられると、
       * 誰も読んでいない文章が「承認済み」として公開まで進む。
       */
      const approvalCleared = before.status === "approved";
      const next: ContentVariant = {
        ...before,
        title: input.title ?? before.title,
        body: input.body ?? before.body,
        summary: input.summary ?? before.summary,
        status: approvalCleared ? "generated" : before.status,
      };
      if (next.body.trim() === "") {
        return err(
          domainError("VALIDATION_FAILED", "本文を空にはできません。", {
            field: "body",
            suggestedAction: "記事ごと不要なら、消す操作を使ってください。",
          }),
        );
      }

      const saved = await deps.variants.save(next);
      if (!saved.ok) return saved;

      const entry = buildAuditEntry({ ids: deps.ids, now: () => new Date() }, actor, {
        action: "content.changed",
        targetType: "content_variant",
        targetId: String(before.id),
        // 残すのは「どこが変わったか」まで。本文そのものは写さない。
        before: { title: before.title, status: before.status },
        after: { title: saved.value.title, status: saved.value.status },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("記事は保存しました", appended.error.details));
      }

      return ok({
        variantId: String(saved.value.id),
        title: saved.value.title,
        status: saved.value.status,
        approvalCleared,
      });
    },
  };
}

// --- 消す -------------------------------------------------------------------

export type DeleteContentVariantInput = {
  readonly variantId: string;
  /** なぜ消すか。`after` が無いので、差分からは読めない。 */
  readonly reason: string;
};

export function createDeleteContentVariantUseCase(
  deps: EditContentDeps,
): UseCase<DeleteContentVariantInput, EditContentOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.write", "記事の削除");
      if (!allowed.ok) return allowed;

      if (input.reason.trim() === "") {
        return err(
          domainError("VALIDATION_FAILED", "消す理由を書いてください。", {
            field: "reason",
            suggestedAction:
              "消した本文は戻せません。後から「なぜ消したか」を説明できるようにしておいてください。",
          }),
        );
      }

      const current = await loadOwned(deps, actor, input.variantId);
      if (!current.ok) return current;
      const before = current.value;

      const blocked = refuseIfPublished(before, "消すこと");
      if (blocked !== null) return err(blocked);

      const removed = await deps.variants.remove(
        actor.workspaceId,
        taggedString<"ContentVariantId">(input.variantId) as ContentVariantId,
      );
      if (!removed.ok) return removed;

      const entry = buildAuditEntry({ ids: deps.ids, now: () => new Date() }, actor, {
        action: "content.deleted",
        targetType: "content_variant",
        targetId: String(before.id),
        /*
         * ここだけは題名と要約を残す。
         *
         * 他の記録で本文を写さないのは「画面で読めるから」だが、
         * 消した後にその画面は無い。何が消えたかを一言も残さないと、
         * 履歴に ID だけが並ぶ。
         */
        before: { title: before.title, summary: before.summary, channel: before.channel },
        after: null,
        reason: input.reason,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("記事は消しました", appended.error.details));
      }

      return ok({ variantId: String(before.id), title: before.title, status: before.status });
    },
  };
}
