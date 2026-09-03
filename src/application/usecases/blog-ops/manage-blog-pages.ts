import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { BlogOpsRepositoryPort } from "@/application/ports/blog-ops";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import {
  type BlogTagKind,
  isBlogTagKind,
  validateShortSlug,
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
 * ブランドタグの管理。
 * 固定文書は `SiteDocumentKey` を正本とする別の usecase へ移した。
 */
export type ManageBlogPagesDeps = {
  readonly repository: BlogOpsRepositoryPort;
  readonly ids: IdGeneratorPort;
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
  readonly affiliateLinks?: never;
};

function guardEditorial(deps: ManageBlogPagesDeps): void {
  const commercial = containsCommercial(deps as unknown as Record<string, unknown>);
  if (commercial.length > 0) {
    throw new Error(
      `固定ページの管理に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "報酬額を方針ページの内容の入力にすることはできません。",
    );
  }
}

export type BlogTagView = {
  readonly tagId: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  /** ブランドか話題か。`brand-tag-cloud` に出るのは `brand` だけ。 */
  readonly kind: BlogTagKind;
};

export type ListBlogTagsInput = { readonly siteSlug: string };

export type ListBlogTagsOutput = {
  readonly tags: readonly BlogTagView[];
  readonly total: number;
  /**
   * そのうち `brand-tag-cloud` に出る数。
   *
   * **総数と別に返す。**総数だけだと、タグを 20 件作ったのに枠が空という状態を、
   * 運営者は枠を実際に開くまで気づけない。
   */
  readonly brandCount: number;
  readonly emptyReason: string | null;
};

export function createListBlogTagsUseCase(
  deps: ManageBlogPagesDeps,
): UseCase<ListBlogTagsInput, ListBlogTagsOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: ListBlogTagsInput,
    ): Promise<Result<ListBlogTagsOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "タグの一覧");
      if (!allowed.ok) return allowed;

      const found = await deps.repository.listTags(actor.workspaceId, input.siteSlug);
      if (!found.ok) return found;

      const tags = found.value.map((t) => ({
        tagId: t.id,
        slug: t.slug,
        name: t.name,
        description: t.description,
        kind: t.kind,
      }));
      const brandCount = tags.filter((t) => t.kind === "brand").length;
      return ok({
        tags,
        total: tags.length,
        brandCount,
        emptyReason:
          tags.length === 0
            ? "タグはまだ 1 件もありません。サイドバーのタグ一覧はタグを足すまで空のままです。"
            : brandCount === 0
              ? "ブランドのタグが 1 件もありません。サイドバーのブランド一覧は空のままです。話題のタグはそこには出ません。"
              : null,
      });
    },
  };
}

export type SaveBlogTagInput = {
  readonly tagId?: string | null;
  readonly siteSlug: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  /**
   * ブランドか話題か。
   *
   * **省略を許していない。**既定を勝手に決めると、画面が種類を送り忘れた日に
   * 保存は通り、枠の中身だけが静かに変わる。送り忘れは断って気づかせる。
   */
  readonly kind: string;
};

export type SaveBlogTagOutput = { readonly tagId: string };

export function createSaveBlogTagUseCase(
  deps: ManageBlogPagesDeps,
): UseCase<SaveBlogTagInput, SaveBlogTagOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: SaveBlogTagInput,
    ): Promise<Result<SaveBlogTagOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.write", "タグの保存");
      if (!allowed.ok) return allowed;

      const slug = validateShortSlug(input.slug);
      if (!slug.ok) return slug;
      const name = input.name.trim();
      if (name === "") {
        return err(validationError("タグの表示名を入れてください。", "name"));
      }
      if (!isBlogTagKind(input.kind)) {
        return err(
          validationError(
            "タグの種類を選んでください。ブランドだけがサイドバーのブランド一覧に出ます。",
            "kind",
          ),
        );
      }
      const kind: BlogTagKind = input.kind;

      const saved = await deps.repository.listTags(actor.workspaceId, input.siteSlug);
      if (!saved.ok) return saved;
      const clash = saved.value.find((t) => t.slug === slug.value && t.id !== input.tagId);
      if (clash !== undefined) {
        return err(
          validationError(
            `URL の名前「${slug.value}」のタグは既にあります（${clash.name}）。`,
            "slug",
          ),
        );
      }

      const tagId = input.tagId ?? `btg_${deps.ids.newId()}`;
      const put = await deps.repository.saveTag(actor.workspaceId, {
        id: tagId,
        siteSlug: input.siteSlug,
        slug: slug.value,
        name,
        description: input.description.trim(),
        kind,
      });
      if (!put.ok) return put;

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_tag.changed",
        targetType: "blog_tag",
        targetId: tagId,
        // 種類も残す。枠の中身が変わる操作なので、差分から読めないと
        // 「いつからブランド扱いになったのか」を後から辿れない。
        after: { siteSlug: input.siteSlug, slug: slug.value, name, kind },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure(`タグ「${name}」を保存しました`, { tagId }));
      }

      return ok({ tagId });
    },
  };
}

export type DeleteBlogTagInput = {
  readonly siteSlug: string;
  readonly tagId: string;
  readonly reason: string;
};

export type DeleteBlogTagOutput = { readonly name: string };

export function createDeleteBlogTagUseCase(
  deps: ManageBlogPagesDeps,
): UseCase<DeleteBlogTagInput, DeleteBlogTagOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: DeleteBlogTagInput,
    ): Promise<Result<DeleteBlogTagOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.write", "タグの削除");
      if (!allowed.ok) return allowed;

      const reason = input.reason.trim();
      if (reason === "") {
        return err(
          validationError("消す理由を書いてください。付いていた記事からタグが外れます。", "reason"),
        );
      }

      const saved = await deps.repository.listTags(actor.workspaceId, input.siteSlug);
      if (!saved.ok) return saved;
      const target = saved.value.find((t) => t.id === input.tagId);
      if (target === undefined) return err(notFound("タグ", input.tagId));

      const deleted = await deps.repository.deleteTag(actor.workspaceId, input.tagId);
      if (!deleted.ok) return deleted;

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_tag.deleted",
        targetType: "blog_tag",
        targetId: input.tagId,
        before: { slug: target.slug, name: target.name, kind: target.kind },
        reason,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure(`タグ「${target.name}」を消しました`, { tagId: input.tagId }));
      }

      return ok({ name: target.name });
    },
  };
}
