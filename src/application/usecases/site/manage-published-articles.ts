import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { EditorialPublishedArticleAdminPort } from "@/application/ports/site";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { parseNonEmptyParagraphs } from "@/domain/authoring/non-empty-paragraphs";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  domainError,
  err,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

export type ManagedPublishedArticle = {
  readonly article: PublishedArticle;
  readonly archivedAt: string | null;
};

type ReadDeps = { readonly articles: EditorialPublishedArticleAdminPort };
type WriteDeps = ReadDeps & {
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
  readonly now: () => Date;
};

export function createListPublishedArticlesUseCase(
  deps: ReadDeps,
): UseCase<
  { readonly query: string; readonly visibility: "all" | "public" | "archived" },
  readonly ManagedPublishedArticle[]
> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "公開済み記事の参照");
      if (!allowed.ok) return allowed;
      const listed = await deps.articles.list(actor.workspaceId);
      if (!listed.ok) return listed;
      const query = input.query.trim().toLocaleLowerCase("ja");
      return ok(
        listed.value.filter(({ article, archivedAt }) => {
          if (input.visibility === "public" && archivedAt !== null) return false;
          if (input.visibility === "archived" && archivedAt === null) return false;
          if (query === "") return true;
          return [article.title, article.summary, article.siteSlug, article.author.name].some((value) =>
            value.toLocaleLowerCase("ja").includes(query),
          );
        }),
      );
    },
  };
}

export function createGetPublishedArticleUseCase(
  deps: ReadDeps,
): UseCase<
  { readonly siteSlug: string; readonly slug: string },
  ManagedPublishedArticle | null
> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "公開済み記事の参照");
      if (!allowed.ok) return allowed;
      return deps.articles.find(actor.workspaceId, input.siteSlug, input.slug);
    },
  };
}

export type UpdatePublishedArticleInput = {
  readonly siteSlug: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly authorName: string;
  readonly authorBio: string;
  readonly authorCredentials: readonly string[];
  readonly sections: readonly {
    readonly id: string;
    readonly heading: string;
    readonly body: string;
  }[];
  readonly reason: string;
};

function required(value: string, label: string, field: string): Result<string, DomainError> {
  const trimmed = value.trim();
  return trimmed === ""
    ? err(validationError(`${label}を入力してください。`, field))
    : ok(trimmed);
}

function notFound(): Result<never, DomainError> {
  return err(
    domainError("NOT_FOUND", "この公開済み記事が見つかりません。", {
      suggestedAction: "公開済み記事の一覧から選び直してください。",
    }),
  );
}

export function createUpdatePublishedArticleUseCase(
  deps: WriteDeps,
): UseCase<UpdatePublishedArticleInput, PublishedArticle> {
  return {
    async execute(actor: ActorContext, input) {
      const allowed = requireCapability(actor, "content.write", "公開済み記事の訂正");
      if (!allowed.ok) return allowed;

      const title = required(input.title, "記事タイトル", "title");
      if (!title.ok) return title;
      const summary = required(input.summary, "一覧に出す結論", "summary");
      if (!summary.ok) return summary;
      const authorName = required(input.authorName, "書き手の名前", "authorName");
      if (!authorName.ok) return authorName;
      const reason = required(input.reason, "訂正理由", "reason");
      if (!reason.ok) return reason;

      const found = await deps.articles.find(actor.workspaceId, input.siteSlug, input.slug);
      if (!found.ok) return found;
      if (found.value === null) return notFound();
      const before = found.value.article;
      const byId = new Map(input.sections.map((section) => [section.id, section]));
      if (byId.size !== before.sections.length || before.sections.some((section) => !byId.has(section.id))) {
        /*
          **欄の名前を付けない。**この断りは 1 つの欄の話ではなく、
          開いている画面と保存されている記事の**形そのものがずれている**という
          報せである。`"sections"` という欄は画面に存在せず（在るのは節ごとの
          `sectionHeading` / `sectionBody`）、名前を付けても指す先が無い。
          名前の無い断りは画面上部の状態欄にそのまま出る
          （`tests/architecture/refusal-field-wiring.test.ts`）。
        */
        return err(validationError("記事の節構成が変わっています。開き直してから訂正してください。"));
      }

      const nextSections = [];
      for (const section of before.sections) {
        const edited = byId.get(section.id);
        if (edited === undefined) continue;
        const heading = required(edited.heading, "節の見出し", `sections.${section.id}.heading`);
        if (!heading.ok) return heading;
        const paragraphs = parseNonEmptyParagraphs(edited.body);
        if (paragraphs.length === 0) {
          return err(validationError("節の本文を入力してください。", `sections.${section.id}.body`));
        }
        nextSections.push({ ...section, heading: heading.value, paragraphs });
      }

      const now = deps.now();
      const next: PublishedArticle = {
        ...before,
        title: title.value,
        summary: summary.value,
        updatedAt: now.toISOString().slice(0, 10),
        author: {
          ...before.author,
          name: authorName.value,
          bio: input.authorBio.trim(),
          credentials: input.authorCredentials.map((item) => item.trim()).filter(Boolean),
        },
        sections: nextSections,
      };
      const entry = buildAuditEntry({ ids: deps.ids, now: () => now }, actor, {
        action: "content.corrected",
        targetType: "published_article",
        targetId: `${input.siteSlug}/${input.slug}`,
        before: { title: before.title, summary: before.summary, updatedAt: before.updatedAt },
        after: { title: next.title, summary: next.summary, updatedAt: next.updatedAt },
        reason: reason.value,
      });
      if (!entry.ok) return entry;

      const saved = await deps.articles.replace(actor.workspaceId, next);
      if (!saved.ok) return saved;
      if (!saved.value) return notFound();
      const audited = await deps.auditLog.append(entry.value);
      if (!audited.ok) {
        return err(auditWriteFailure("記事の訂正は保存されています", audited.error.details));
      }
      return ok(next);
    },
  };
}

export function createArchivePublishedArticleUseCase(
  deps: WriteDeps,
): UseCase<{ readonly siteSlug: string; readonly slug: string; readonly reason: string }, true> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.publish", "公開済み記事の非表示化");
      if (!allowed.ok) return allowed;
      const reason = required(input.reason, "非表示化の理由", "reason");
      if (!reason.ok) return reason;
      const found = await deps.articles.find(actor.workspaceId, input.siteSlug, input.slug);
      if (!found.ok) return found;
      if (found.value === null) return notFound();
      const now = deps.now();
      const entry = buildAuditEntry({ ids: deps.ids, now: () => now }, actor, {
        action: "content.unpublished",
        targetType: "published_article",
        targetId: `${input.siteSlug}/${input.slug}`,
        before: { archivedAt: found.value.archivedAt, title: found.value.article.title },
        after: { archivedAt: now.toISOString() },
        reason: reason.value,
      });
      if (!entry.ok) return entry;
      const archived = await deps.articles.archive(
        actor.workspaceId,
        input.siteSlug,
        input.slug,
        now.toISOString(),
      );
      if (!archived.ok) return archived;
      if (!archived.value) return notFound();
      const audited = await deps.auditLog.append(entry.value);
      if (!audited.ok) {
        return err(auditWriteFailure("記事は非表示になっています", audited.error.details));
      }
      return ok(true as const);
    },
  };
}
