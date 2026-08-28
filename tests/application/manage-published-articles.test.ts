import { describe, expect, it } from "vitest";
import type { PublishedArticleAdminPort } from "@/application/ports/site";
import type { PublishedArticle } from "@/application/read-models/published-article";
import {
  createArchivePublishedArticleUseCase,
  createGetPublishedArticleUseCase,
  createListPublishedArticlesUseCase,
  createUpdatePublishedArticleUseCase,
} from "@/application/usecases/site/manage-published-articles";
import { markEditorial, ok } from "@/domain/shared";
import { anOwner, aPublisher, aWriter, OTHER_WORKSPACE, WORKSPACE } from "../support/actors";
import { recordingAuditLog } from "../support/doubles";

const article: PublishedArticle = {
  siteSlug: "creator-tools",
  slug: "quiet-laptop",
  type: "guide",
  title: "静かなノートパソコンの選び方",
  summary: "作業時間と騒音のバランスで選びます。",
  categorySlug: "laptops",
  publishedAt: "2026-08-01",
  updatedAt: "2026-08-01",
  author: {
    slug: "editorial-team",
    name: "編集部",
    bio: "制作道具を検証するチームです。",
    credentials: ["編集実務 5 年"],
  },
  disclosureRequired: false,
  sections: [
    { id: "conclusion", heading: "結論", paragraphs: ["場所に合わせて選びます。"] },
    { id: "how-to-choose", heading: "選び方", paragraphs: ["騒音の実測値を見ます。"] },
  ],
};

function repository() {
  let current: PublishedArticle | null = article;
  let archivedAt: string | null = null;
  const port: PublishedArticleAdminPort = {
    async list(workspaceId) {
      return ok(
        workspaceId === WORKSPACE && current !== null ? [{ article: current, archivedAt }] : [],
      );
    },
    async find(workspaceId, siteSlug, slug) {
      return ok(
        workspaceId === WORKSPACE &&
          current !== null &&
          current.siteSlug === siteSlug &&
          current.slug === slug
          ? { article: current, archivedAt }
          : null,
      );
    },
    async replace(workspaceId, next) {
      if (workspaceId !== WORKSPACE || current === null) return ok(false as const);
      current = next;
      return ok(true as const);
    },
    async archive(workspaceId, siteSlug, slug, at) {
      if (
        workspaceId !== WORKSPACE ||
        current === null ||
        current.siteSlug !== siteSlug ||
        current.slug !== slug
      ) {
        return ok(false as const);
      }
      archivedAt = at;
      return ok(true as const);
    },
  };
  return markEditorial(port);
}

describe("公開済み記事の管理", () => {
  it("自分の作業場所の記事だけを一覧で読む", async () => {
    const articles = repository();
    const own = await createListPublishedArticlesUseCase({ articles }).execute(anOwner(), {
      query: "ノート",
      visibility: "all",
    });
    const outside = await createListPublishedArticlesUseCase({ articles }).execute(
      anOwner({ workspaceId: OTHER_WORKSPACE }),
      { query: "", visibility: "all" },
    );

    expect(own.ok && own.value).toHaveLength(1);
    expect(outside.ok && outside.value).toHaveLength(0);
  });

  it("書き手は公開済み記事を訂正でき、理由が記録される", async () => {
    const articles = repository();
    const audit = recordingAuditLog();
    const useCase = createUpdatePublishedArticleUseCase({
      articles,
      auditLog: audit.port,
      ids: { newId: () => "published-admin-update" },
      now: () => new Date("2026-08-28T09:00:00.000Z"),
    });
    const result = await useCase.execute(aWriter(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
      title: "静かさを重視したノートパソコンの選び方",
      summary: article.summary,
      authorName: article.author.name,
      authorBio: article.author.bio,
      authorCredentials: article.author.credentials,
      sections: article.sections.map((section) => ({
        id: section.id,
        heading: section.heading,
        body: section.paragraphs.join("\n\n"),
      })),
      reason: "見出しの対象を明確にするため",
    });

    expect(result.ok && result.value.title).toContain("静かさ");
    expect(result.ok && result.value.updatedAt).toBe("2026-08-28");
    expect(audit.actions()).toContain("content.corrected");
    expect(audit.entries()[0]?.reason).toBe("見出しの対象を明確にするため");
  });

  it("理由が空の訂正は保存しない", async () => {
    const articles = repository();
    const useCase = createUpdatePublishedArticleUseCase({
      articles,
      auditLog: recordingAuditLog().port,
      ids: { newId: () => "published-admin-no-reason" },
      now: () => new Date("2026-08-28T09:00:00.000Z"),
    });
    const result = await useCase.execute(aWriter(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      authorName: article.author.name,
      authorBio: article.author.bio,
      authorCredentials: article.author.credentials,
      sections: article.sections.map((section) => ({
        id: section.id,
        heading: section.heading,
        body: section.paragraphs.join("\n\n"),
      })),
      reason: " ",
    });

    expect(result.ok).toBe(false);
  });

  it("公開権限を持つ人は物理削除せず非表示化し、理由を記録する", async () => {
    const articles = repository();
    const audit = recordingAuditLog();
    const useCase = createArchivePublishedArticleUseCase({
      articles,
      auditLog: audit.port,
      ids: { newId: () => "published-admin-archive" },
      now: () => new Date("2026-08-28T09:00:00.000Z"),
    });
    const result = await useCase.execute(aPublisher(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
      reason: "推奨条件を再検証するため",
    });

    expect(result.ok).toBe(true);
    expect(audit.actions()).toContain("content.unpublished");
    const found = await createGetPublishedArticleUseCase({ articles }).execute(anOwner(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
    });
    expect(found.ok && found.value?.archivedAt).toBe("2026-08-28T09:00:00.000Z");
  });

  it("非表示の記事を訂正しても非表示のままにする", async () => {
    const articles = repository();
    const common = {
      articles,
      auditLog: recordingAuditLog().port,
      ids: { newId: () => "published-admin-hidden-edit" },
      now: () => new Date("2026-08-28T09:00:00.000Z"),
    };
    await createArchivePublishedArticleUseCase(common).execute(aPublisher(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
      reason: "再検証のため",
    });
    await createUpdatePublishedArticleUseCase(common).execute(aWriter(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
      title: `${article.title}（再検証中）`,
      summary: article.summary,
      authorName: article.author.name,
      authorBio: article.author.bio,
      authorCredentials: article.author.credentials,
      sections: article.sections.map((section) => ({
        id: section.id,
        heading: section.heading,
        body: section.paragraphs.join("\n\n"),
      })),
      reason: "非表示中に表現を正すため",
    });

    const found = await createGetPublishedArticleUseCase({ articles }).execute(anOwner(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
    });
    expect(found.ok && found.value?.archivedAt).toBe("2026-08-28T09:00:00.000Z");
  });
});
