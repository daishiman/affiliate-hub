import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { BlogOpsRepositoryPort } from "@/application/ports/blog-ops";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import {
  type BlogTagKind,
  FIXED_PAGE_KINDS,
  FIXED_PAGE_LABEL,
  type FixedPageKind,
  type FixedPageStatus,
  isBlogTagKind,
  validateShortSlug,
} from "@/domain/blogops";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  containsCommercial,
  domainError,
  err,
  notFound,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 固定ページ（8 種）とブランドタグの管理。
 *
 * 固定ページは記事と違って **1 ブログにつき各 1 枚**しか無い。
 * 無いことを既定文で埋めない。埋めると、書いていない方針が
 * 書いてあるように読者へ出てしまう。無いものは「未整備」と出す。
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

export type FixedPageView = {
  readonly pageId: string | null;
  readonly kind: FixedPageKind;
  readonly label: string;
  readonly title: string;
  readonly body: string;
  readonly status: FixedPageStatus;
  readonly updatedAt: string | null;
  /** まだ 1 枚も書いていない。既定文で埋めず、ここに印を立てる。 */
  readonly missing: boolean;
};

export type ListFixedPagesInput = { readonly siteSlug: string };

export type ListFixedPagesOutput = {
  readonly siteSlug: string;
  readonly pages: readonly FixedPageView[];
  readonly missingCount: number;
  readonly launchBlockedReason: string | null;
};

export function createListFixedPagesUseCase(
  deps: ManageBlogPagesDeps,
): UseCase<ListFixedPagesInput, ListFixedPagesOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: ListFixedPagesInput,
    ): Promise<Result<ListFixedPagesOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "固定ページの一覧");
      if (!allowed.ok) return allowed;

      const found = await deps.repository.listFixedPages(actor.workspaceId, input.siteSlug);
      if (!found.ok) return found;

      const pages = FIXED_PAGE_KINDS.map((kind): FixedPageView => {
        const hit = found.value.find((p) => p.kind === kind);
        return {
          pageId: hit?.id ?? null,
          kind,
          label: FIXED_PAGE_LABEL[kind],
          title: hit?.title ?? "",
          body: hit?.body ?? "",
          status: hit?.status ?? "draft",
          updatedAt: hit?.updatedAt.toISOString() ?? null,
          missing: hit === undefined,
        };
      });

      const missing = pages.filter((p) => p.missing || p.status !== "published");
      return ok({
        siteSlug: input.siteSlug,
        pages,
        missingCount: missing.length,
        launchBlockedReason:
          missing.length === 0
            ? null
            : `信頼のための固定ページが揃っていません（${missing.map((p) => p.label).join(" / ")}）。` +
              "広告表記や免責の説明先が無い記事を公開させないため、ここが埋まるまで公開できません。",
      });
    },
  };
}

export type DeletedFixedPageView = {
  readonly pageId: string;
  readonly siteSlug: string;
  readonly kind: FixedPageKind;
  readonly label: string;
  readonly title: string;
  readonly body: string;
  readonly status: FixedPageStatus;
  readonly deletedAt: string;
};

export type ListDeletedFixedPagesOutput = {
  readonly siteSlug: string;
  readonly pages: readonly DeletedFixedPageView[];
  readonly emptyReason: string | null;
};

export function createListDeletedFixedPagesUseCase(
  deps: ManageBlogPagesDeps,
): UseCase<ListFixedPagesInput, ListDeletedFixedPagesOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "削除済み固定ページの一覧");
      if (!allowed.ok) return allowed;
      const found = await deps.repository.listDeletedFixedPages(actor.workspaceId, input.siteSlug);
      if (!found.ok) return found;
      const pages = found.value.map((page) => ({
        pageId: page.id,
        siteSlug: page.siteSlug,
        kind: page.kind,
        label: FIXED_PAGE_LABEL[page.kind],
        title: page.title,
        body: page.body,
        status: page.status,
        deletedAt: page.deletedAt?.toISOString() ?? "",
      }));
      return ok({
        siteSlug: input.siteSlug,
        pages,
        emptyReason: pages.length === 0 ? "削除済みの固定ページはありません。" : null,
      });
    },
  };
}

export type SaveFixedPageInput = {
  readonly siteSlug: string;
  readonly kind: FixedPageKind;
  readonly title: string;
  readonly body: string;
  readonly status: FixedPageStatus;
};

export type SaveFixedPageOutput = { readonly kind: FixedPageKind };

export function createSaveFixedPageUseCase(
  deps: ManageBlogPagesDeps,
): UseCase<SaveFixedPageInput, SaveFixedPageOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: SaveFixedPageInput,
    ): Promise<Result<SaveFixedPageOutput, DomainError>> {
      const allowed = requireCapability(actor, "site.manage", "固定ページの保存");
      if (!allowed.ok) return allowed;

      const title = input.title.trim();
      const body = input.body.trim();
      if (title === "" || body === "") {
        return err(
          validationError(
            "固定ページは題名と本文の両方が要ります。空のまま置くと、読者には『あるのに何も書いていないページ』が見えます。",
            title === "" ? "title" : "body",
          ),
        );
      }

      const saved = await deps.repository.listFixedPages(actor.workspaceId, input.siteSlug);
      if (!saved.ok) return saved;
      const existing = saved.value.find((p) => p.kind === input.kind);
      const deleted = await deps.repository.listDeletedFixedPages(actor.workspaceId, input.siteSlug);
      if (!deleted.ok) return deleted;
      if (deleted.value.some((page) => page.kind === input.kind)) {
        return err(
          domainError(
            "CONFLICT",
            `「${FIXED_PAGE_LABEL[input.kind]}」は削除済みです。保存で上書きせず、削除済み一覧から戻してください。`,
            { field: "kind" },
          ),
        );
      }

      const put = await deps.repository.saveFixedPage(actor.workspaceId, {
        id: existing?.id ?? `lgp_${deps.ids.newId()}`,
        siteSlug: input.siteSlug,
        kind: input.kind,
        title,
        body,
        status: input.status,
        deletedAt: null,
        updatedAt: deps.now(),
      });
      if (!put.ok) return put;

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_page.changed",
        targetType: "legal_page",
        targetId: `${input.siteSlug}:${input.kind}`,
        before: existing ? { title: existing.title } : null,
        after: { title },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure(`「${FIXED_PAGE_LABEL[input.kind]}」を保存しました`, {
            kind: input.kind,
          }),
        );
      }

      return ok({ kind: input.kind });
    },
  };
}

export type DeleteFixedPageInput = {
  readonly siteSlug: string;
  readonly kind: FixedPageKind;
  readonly reason: string;
};

export type DeleteFixedPageOutput = { readonly kind: FixedPageKind };

export function createDeleteFixedPageUseCase(
  deps: ManageBlogPagesDeps,
): UseCase<DeleteFixedPageInput, DeleteFixedPageOutput> {
  guardEditorial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: DeleteFixedPageInput,
    ): Promise<Result<DeleteFixedPageOutput, DomainError>> {
      const allowed = requireCapability(actor, "site.manage", "固定ページの削除");
      if (!allowed.ok) return allowed;

      const reason = input.reason.trim();
      if (reason === "") {
        return err(
          validationError(
            "消す理由を書いてください。記事側の広告表記が説明先を失うので、後から必ず問われます。",
            "reason",
          ),
        );
      }

      const saved = await deps.repository.listFixedPages(actor.workspaceId, input.siteSlug);
      if (!saved.ok) return saved;
      const existing = saved.value.find((p) => p.kind === input.kind);
      if (existing === undefined) {
        return err(notFound("固定ページ", `${input.siteSlug}:${input.kind}`));
      }

      const deleted = await deps.repository.deleteFixedPage(actor.workspaceId, existing.id);
      if (!deleted.ok) return deleted;

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_page.deleted",
        targetType: "legal_page",
        targetId: `${input.siteSlug}:${input.kind}`,
        before: { title: existing.title },
        reason,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure(`「${FIXED_PAGE_LABEL[input.kind]}」を消しました`, { kind: input.kind }),
        );
      }

      return ok({ kind: input.kind });
    },
  };
}

export type RestoreFixedPageInput = { readonly siteSlug: string; readonly pageId: string };
export type RestoreFixedPageOutput = {
  readonly pageId: string;
  readonly siteSlug: string;
  readonly kind: FixedPageKind;
};

export function createRestoreFixedPageUseCase(
  deps: ManageBlogPagesDeps,
): UseCase<RestoreFixedPageInput, RestoreFixedPageOutput> {
  guardEditorial(deps);
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "site.manage", "固定ページの復元");
      if (!allowed.ok) return allowed;
      const deleted = await deps.repository.listDeletedFixedPages(
        actor.workspaceId,
        input.siteSlug,
      );
      if (!deleted.ok) return deleted;
      const target = deleted.value.find((page) => page.id === input.pageId);
      if (target === undefined) return err(notFound("削除済み固定ページ", input.pageId));
      const restored = await deps.repository.restoreFixedPage(
        actor.workspaceId,
        input.pageId,
        deps.now(),
      );
      if (!restored.ok) return restored;

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_page.restored",
        targetType: "legal_page",
        targetId: input.pageId,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("固定ページを元の内容で戻しました", { pageId: input.pageId }));
      }
      return ok({ pageId: input.pageId, siteSlug: target.siteSlug, kind: target.kind });
    },
  };
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
