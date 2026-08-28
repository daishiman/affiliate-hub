/** @tier 1 @req REQ-R11, REQ-SEC01, REQ-SEC09 @types tenant-isolation, audit-log, permission-matrix */
import { describe, expect, it } from "vitest";
import type { PublishedArticleAdminPort } from "@/application/ports/site";
import type { PublishedArticle } from "@/application/read-models/published-article";
import {
  createArchivePublishedArticleUseCase,
  createGetPublishedArticleUseCase,
  createListPublishedArticlesUseCase,
  createUpdatePublishedArticleUseCase,
  type UpdatePublishedArticleInput,
} from "@/application/usecases/site/manage-published-articles";
import { domainError, err, markEditorial, ok } from "@/domain/shared";
import {
  anAiAccount,
  anOwner,
  aNobody,
  aPublisher,
  aWriter,
  OTHER_WORKSPACE,
  WORKSPACE,
} from "../support/actors";
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

const NOW = new Date("2026-08-28T09:00:00.000Z");

function repositoryWith(overrides: Partial<PublishedArticleAdminPort>) {
  return markEditorial({ ...repository(), ...overrides } as PublishedArticleAdminPort);
}

function updateInput(overrides: Partial<UpdatePublishedArticleInput> = {}): UpdatePublishedArticleInput {
  return {
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
    reason: "内容を正確にするため",
    ...overrides,
  };
}

function writeDeps(
  articles = repository(),
  auditLog = recordingAuditLog().port,
) {
  return {
    articles,
    auditLog,
    ids: { newId: () => "published-admin" },
    now: () => NOW,
  };
}

const storageFailure = () =>
  err(domainError("UPSTREAM_UNAVAILABLE", "公開済み記事の保存先に接続できません。"));

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

  it("公開状態と検索語を組み合わせて一覧を絞り込む", async () => {
    const articles = repository();
    const useCase = createListPublishedArticlesUseCase({ articles });

    const publicBefore = await useCase.execute(anOwner(), { query: "", visibility: "public" });
    const archivedBefore = await useCase.execute(anOwner(), { query: "", visibility: "archived" });
    await articles.archive(WORKSPACE, article.siteSlug, article.slug, NOW.toISOString());
    const publicAfter = await useCase.execute(anOwner(), { query: "", visibility: "public" });
    const archivedAfter = await useCase.execute(anOwner(), { query: "", visibility: "archived" });
    const caseInsensitive = await useCase.execute(anOwner(), {
      query: "  CREATOR-TOOLS  ",
      visibility: "all",
    });
    const noMatch = await useCase.execute(anOwner(), {
      query: "存在しない記事",
      visibility: "all",
    });

    expect(publicBefore.ok && publicBefore.value.map(({ article: item }) => item.slug)).toEqual([
      article.slug,
    ]);
    expect(archivedBefore.ok && archivedBefore.value).toEqual([]);
    expect(publicAfter.ok && publicAfter.value).toEqual([]);
    expect(archivedAfter.ok && archivedAfter.value.map(({ article: item }) => item.slug)).toEqual([
      article.slug,
    ]);
    expect(caseInsensitive.ok && caseInsensitive.value).toHaveLength(1);
    expect(noMatch.ok && noMatch.value).toEqual([]);
  });

  it("一覧は権限が無ければ保存先を読まず、保存先の失敗も隠さない", async () => {
    let calls = 0;
    const articles = repositoryWith({
      async list() {
        calls += 1;
        return storageFailure();
      },
    });
    const useCase = createListPublishedArticlesUseCase({ articles });

    const denied = await useCase.execute(aNobody(), { query: "", visibility: "all" });
    expect(denied).toMatchObject({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "公開済み記事の参照 を行う権限がありません。",
        suggestedAction: "必要な権限: content.read。ワークスペース管理者に依頼してください。",
      },
    });
    expect(calls).toBe(0);

    const failed = await useCase.execute(anOwner(), { query: "", visibility: "all" });
    expect(failed).toMatchObject({
      ok: false,
      error: { code: "UPSTREAM_UNAVAILABLE", message: "公開済み記事の保存先に接続できません。" },
    });
    expect(calls).toBe(1);
  });

  it("1件取得は権限を先に確認し、許可後は作業場所とURLをそのまま渡す", async () => {
    const calls: unknown[][] = [];
    const articles = repositoryWith({
      async find(...args) {
        calls.push(args);
        return ok({ article, archivedAt: null });
      },
    });
    const useCase = createGetPublishedArticleUseCase({ articles });

    const denied = await useCase.execute(aNobody(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
    });
    expect(denied).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN", message: "公開済み記事の参照 を行う権限がありません。" },
    });
    expect(calls).toEqual([]);

    const found = await useCase.execute(anOwner(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
    });
    expect(found.ok && found.value?.article.slug).toBe(article.slug);
    expect(calls).toEqual([[WORKSPACE, article.siteSlug, article.slug]]);
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

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "訂正理由を入力してください。",
        field: "reason",
      },
    });
  });

  it("訂正に必要な項目と元の記事の節構成を、項目名つきで検査する", async () => {
    const cases: readonly {
      readonly name: string;
      readonly input: UpdatePublishedArticleInput;
      readonly message: string;
      readonly field: string;
    }[] = [
      {
        name: "タイトル",
        input: updateInput({ title: "  " }),
        message: "記事タイトルを入力してください。",
        field: "title",
      },
      {
        name: "結論",
        input: updateInput({ summary: "\n" }),
        message: "一覧に出す結論を入力してください。",
        field: "summary",
      },
      {
        name: "書き手",
        input: updateInput({ authorName: " " }),
        message: "書き手の名前を入力してください。",
        field: "authorName",
      },
      {
        name: "訂正理由",
        input: updateInput({ reason: " " }),
        message: "訂正理由を入力してください。",
        field: "reason",
      },
      {
        name: "節構成",
        input: updateInput({ sections: updateInput().sections.slice(0, 1) }),
        message: "記事の節構成が変わっています。開き直してから訂正してください。",
        field: "sections",
      },
      {
        name: "節の見出し",
        input: updateInput({
          sections: updateInput().sections.map((section, index) =>
            index === 0 ? { ...section, heading: " " } : section,
          ),
        }),
        message: "節の見出しを入力してください。",
        field: "sections.conclusion.heading",
      },
      {
        name: "節の本文",
        input: updateInput({
          sections: updateInput().sections.map((section, index) =>
            index === 0 ? { ...section, body: "\n  \n" } : section,
          ),
        }),
        message: "節の本文を入力してください。",
        field: "sections.conclusion.body",
      },
    ];

    for (const testCase of cases) {
      const result = await createUpdatePublishedArticleUseCase(writeDeps()).execute(
        aWriter(),
        testCase.input,
      );
      expect(result, testCase.name).toMatchObject({
        ok: false,
        error: { code: "VALIDATION_FAILED", message: testCase.message, field: testCase.field },
      });
    }
  });

  it("訂正時に空白を整え、段落と監査差分を保存する", async () => {
    const articles = repository();
    const audit = recordingAuditLog();
    const result = await createUpdatePublishedArticleUseCase(writeDeps(articles, audit.port)).execute(
      aWriter(),
      updateInput({
        title: "  静音ノートパソコンの選び方  ",
        summary: "  騒音と作業時間で選びます。  ",
        authorName: "  制作道具編集部  ",
        authorBio: "  実機を検証します。  ",
        authorCredentials: ["  編集実務 5 年  ", " ", "  実機検証 100 台  "],
        sections: updateInput().sections.map((section, index) =>
          index === 0
            ? {
                ...section,
                heading: "  先に結論  ",
                body: "  静音性を確認します。  \n \n  持続時間も確認します。  ",
              }
            : section,
        ),
        reason: "  判断条件を明確にするため  ",
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        title: "静音ノートパソコンの選び方",
        summary: "騒音と作業時間で選びます。",
        updatedAt: "2026-08-28",
        author: {
          name: "制作道具編集部",
          bio: "実機を検証します。",
          credentials: ["編集実務 5 年", "実機検証 100 台"],
        },
        sections: [
          {
            id: "conclusion",
            heading: "先に結論",
            paragraphs: ["静音性を確認します。", "持続時間も確認します。"],
          },
          article.sections[1],
        ],
      },
    });
    expect(audit.entries()[0]).toMatchObject({
      action: "content.corrected",
      targetType: "published_article",
      targetId: `${article.siteSlug}/${article.slug}`,
      before: { title: article.title, summary: article.summary, updatedAt: article.updatedAt },
      after: {
        title: "静音ノートパソコンの選び方",
        summary: "騒音と作業時間で選びます。",
        updatedAt: "2026-08-28",
      },
      reason: "判断条件を明確にするため",
      occurredAt: NOW,
    });
  });

  it("訂正は権限なし・未検出・保存失敗・監査失敗を区別する", async () => {
    const denied = await createUpdatePublishedArticleUseCase(writeDeps()).execute(
      aPublisher(),
      updateInput(),
    );
    expect(denied).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN", message: "公開済み記事の訂正 を行う権限がありません。" },
    });

    const missing = await createUpdatePublishedArticleUseCase(
      writeDeps(repositoryWith({ find: async () => ok(null) })),
    ).execute(aWriter(), updateInput());
    expect(missing).toMatchObject({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "この公開済み記事が見つかりません。",
        suggestedAction: "公開済み記事の一覧から選び直してください。",
      },
    });

    const readFailed = await createUpdatePublishedArticleUseCase(
      writeDeps(repositoryWith({ find: async () => storageFailure() })),
    ).execute(aWriter(), updateInput());
    expect(readFailed).toMatchObject({ ok: false, error: { code: "UPSTREAM_UNAVAILABLE" } });

    const replaceFailed = await createUpdatePublishedArticleUseCase(
      writeDeps(repositoryWith({ replace: async () => storageFailure() })),
    ).execute(aWriter(), updateInput());
    expect(replaceFailed).toMatchObject({ ok: false, error: { code: "UPSTREAM_UNAVAILABLE" } });

    const disappeared = await createUpdatePublishedArticleUseCase(
      writeDeps(repositoryWith({ replace: async () => ok(false as const) })),
    ).execute(aWriter(), updateInput());
    expect(disappeared).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });

    const baseAudit = recordingAuditLog().port;
    const auditFailed = await createUpdatePublishedArticleUseCase(
      writeDeps(repository(), { ...baseAudit, append: async () => storageFailure() }),
    ).execute(aWriter(), updateInput());
    expect(auditFailed).toMatchObject({
      ok: false,
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message:
          "記事の訂正は保存されています。ただし、この操作を誰が行ったかの記録を残せませんでした。記録が無いままだと、後から「人が確認した」ことを示せません。",
        retryable: true,
      },
    });
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
    expect(audit.entries()[0]).toMatchObject({
      action: "content.unpublished",
      targetType: "published_article",
      targetId: `${article.siteSlug}/${article.slug}`,
      before: { archivedAt: null, title: article.title },
      after: { archivedAt: NOW.toISOString() },
      reason: "推奨条件を再検証するため",
      occurredAt: NOW,
    });
    const found = await createGetPublishedArticleUseCase({ articles }).execute(anOwner(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
    });
    expect(found.ok && found.value?.archivedAt).toBe("2026-08-28T09:00:00.000Z");
  });

  it("非表示化は人の公開権限と理由を必須にする", async () => {
    const useCase = createArchivePublishedArticleUseCase(writeDeps());
    const denied = await useCase.execute(aWriter(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
      reason: "公開を止めるため",
    });
    expect(denied).toMatchObject({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "公開済み記事の非表示化 を行う権限がありません。",
        suggestedAction: "必要な権限: content.publish。ワークスペース管理者に依頼してください。",
      },
    });

    const aiDenied = await useCase.execute(anAiAccount({ roles: ["owner"] }), {
      siteSlug: article.siteSlug,
      slug: article.slug,
      reason: "公開を止めるため",
    });
    expect(aiDenied).toMatchObject({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "公開済み記事の非表示化 は人が行う必要があります。",
        suggestedAction: "担当者が内容を確認してから操作してください。",
      },
    });

    const noReason = await useCase.execute(aPublisher(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
      reason: "  ",
    });
    expect(noReason).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "非表示化の理由を入力してください。",
        field: "reason",
      },
    });
  });

  it("非表示化は未検出・保存失敗・監査失敗を区別する", async () => {
    const missing = await createArchivePublishedArticleUseCase(
      writeDeps(repositoryWith({ find: async () => ok(null) })),
    ).execute(aPublisher(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
      reason: "公開を止めるため",
    });
    expect(missing).toMatchObject({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "この公開済み記事が見つかりません。",
        suggestedAction: "公開済み記事の一覧から選び直してください。",
      },
    });

    const readFailed = await createArchivePublishedArticleUseCase(
      writeDeps(repositoryWith({ find: async () => storageFailure() })),
    ).execute(aPublisher(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
      reason: "公開を止めるため",
    });
    expect(readFailed).toMatchObject({ ok: false, error: { code: "UPSTREAM_UNAVAILABLE" } });

    const archiveFailed = await createArchivePublishedArticleUseCase(
      writeDeps(repositoryWith({ archive: async () => storageFailure() })),
    ).execute(aPublisher(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
      reason: "公開を止めるため",
    });
    expect(archiveFailed).toMatchObject({ ok: false, error: { code: "UPSTREAM_UNAVAILABLE" } });

    const disappeared = await createArchivePublishedArticleUseCase(
      writeDeps(repositoryWith({ archive: async () => ok(false as const) })),
    ).execute(aPublisher(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
      reason: "公開を止めるため",
    });
    expect(disappeared).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });

    const baseAudit = recordingAuditLog().port;
    const auditFailed = await createArchivePublishedArticleUseCase(
      writeDeps(repository(), { ...baseAudit, append: async () => storageFailure() }),
    ).execute(aPublisher(), {
      siteSlug: article.siteSlug,
      slug: article.slug,
      reason: "公開を止めるため",
    });
    expect(auditFailed).toMatchObject({
      ok: false,
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message:
          "記事は非表示になっています。ただし、この操作を誰が行ったかの記録を残せませんでした。記録が無いままだと、後から「人が確認した」ことを示せません。",
        retryable: true,
      },
    });
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
