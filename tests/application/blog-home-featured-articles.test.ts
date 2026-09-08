/**
 * @tier 1
 * @req REQ-BOPS02, REQ-BOPS06
 * @types boundary, state-transition, tenant-isolation, audit-log
 *
 * ブログトップの「おすすめ記事」を選ぶ業務規則。
 *
 * 表示用の記事配列ではなく、運営者が選んだ slug の順序を
 * Blog Ops が保存する。そのため、公開後に記事が一時的に非公開に
 * なっても選択 intent は消さない。一方で、新しく足せるのはその
 * ブログで現在公開中の記事だけである。
 */
import { describe, expect, it } from "vitest";
import type {
  ArticleSummary,
  PublishedArticle,
} from "@/application/read-models/published-article";
import * as blogOpsUseCases from "@/application/usecases/blog-ops";
import { isErr, isOk, ok } from "@/domain/shared";
import { anOwner, aWriter, WORKSPACE } from "../support/actors";
import { NOW } from "../support/clock";
import { recordingAuditLog } from "../support/doubles";

type FeaturedConfig = {
  readonly siteSlug: string;
  readonly articleSlugs: readonly string[];
};

type SelectedArticle = {
  readonly articleSlug: string;
  readonly article: ArticleSummary | null;
};

type ReadOutput = {
  readonly siteSlug: string;
  readonly selectedArticles: readonly SelectedArticle[];
  readonly candidateArticles: readonly ArticleSummary[];
  readonly selectedCount: number;
};

type ReadFactory = (deps: unknown) => {
  execute(
    actor: ReturnType<typeof anOwner>,
    input: { readonly siteSlug: string },
  ): Promise<ReturnType<typeof ok<ReadOutput>>>;
};

type ReplaceFactory = (deps: unknown) => {
  execute(
    actor: ReturnType<typeof anOwner>,
    input: {
      readonly siteSlug: string;
      readonly articleSlugs: readonly string[];
    },
  ): Promise<
    | ReturnType<typeof ok<{ readonly articleSlugs: readonly string[] }>>
    | { readonly ok: false; readonly error: { readonly code: string; readonly field?: string } }
  >;
};

/**
 * RED の間も suite 全体を収集し、欠けた入り口を名指しする。
 * named import にすると module の読み込み自体が落ち、下の業務契約が
 * 1 件もテスト名として報告されないため、namespace から確認する。
 */
function readFactory(): ReadFactory {
  const found = (
    blogOpsUseCases as unknown as {
      readonly createReadBlogHomeFeaturedArticlesUseCase?: ReadFactory;
    }
  ).createReadBlogHomeFeaturedArticlesUseCase;
  expect(
    found,
    "Blog Ops におすすめ記事の読み口がまだありません",
  ).toBeTypeOf("function");
  return found as ReadFactory;
}

function replaceFactory(): ReplaceFactory {
  const found = (
    blogOpsUseCases as unknown as {
      readonly createReplaceBlogHomeFeaturedArticlesUseCase?: ReplaceFactory;
    }
  ).createReplaceBlogHomeFeaturedArticlesUseCase;
  expect(
    found,
    "Blog Ops におすすめ記事の一括置換の口がまだありません",
  ).toBeTypeOf("function");
  return found as ReplaceFactory;
}

function summary(slug: string, over: Partial<ArticleSummary> = {}): ArticleSummary {
  return {
    slug,
    siteSlug: "hub",
    type: "guide",
    title: `${slug} の題名`,
    summary: `${slug} の要約`,
    categorySlug: "guide",
    publishedAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
    authorName: "編集部",
    ...over,
  };
}

function published(row: ArticleSummary): PublishedArticle {
  return {
    ...row,
    publishedAt: row.updatedAt,
    author: { slug: "editor", name: row.authorName, bio: "", credentials: [] },
    disclosureRequired: false,
    sections: [],
  };
}

function world(input: {
  readonly config?: FeaturedConfig | null;
  readonly published?: readonly ArticleSummary[];
} = {}) {
  let config = input.config ?? null;
  const publicArticles = input.published ?? [];
  const audit = recordingAuditLog();
  const writes: Array<{
    readonly workspaceId: string;
    readonly siteSlug: string;
    readonly articleSlugs: readonly string[];
  }> = [];

  const repository = {
    findBlogHomeFeaturedArticles: async (workspaceId: string, siteSlug: string) =>
      ok(workspaceId === WORKSPACE && config?.siteSlug === siteSlug ? config : null),
    replaceBlogHomeFeaturedArticles: async (
      workspaceId: string,
      replacement: {
        readonly siteSlug: string;
        readonly articleSlugs: readonly string[];
      },
    ) => {
      writes.push({ workspaceId, ...replacement });
      config = {
        siteSlug: replacement.siteSlug,
        articleSlugs: [...replacement.articleSlugs],
      };
      return ok(true as const);
    },
  };

  return {
    deps: {
      repository,
      publishedContent: {
        listRecent: async (siteSlug: string, limit: number) =>
          ok(publicArticles.filter((article) => article.siteSlug === siteSlug).slice(0, limit)),
        findArticle: async (siteSlug: string, slug: string) => {
          const found = publicArticles.find(
            (article) => article.siteSlug === siteSlug && article.slug === slug,
          );
          return ok(found === undefined ? null : published(found));
        },
      },
      auditLog: audit.port,
      ids: { newId: () => "featured-audit-1" },
      now: () => NOW,
    },
    writes,
    audit,
    config: () => config,
  };
}

describe("ブログトップのおすすめ記事", () => {
  it("公開記事だけを候補にし、保存した順と一時非公開の選択intentを失わない", async () => {
    const liveA = summary("live-a");
    const liveB = summary("live-b");
    const state = world({
      config: { siteSlug: "hub", articleSlugs: ["stale", "live-a"] },
      published: [liveA, liveB],
    });

    const result = await readFactory()(state.deps).execute(anOwner(), { siteSlug: "hub" });

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.selectedCount).toBe(2);
    expect(result.value.selectedArticles).toEqual([
      { articleSlug: "stale", article: null },
      { articleSlug: "live-a", article: liveA },
    ]);
    expect(result.value.candidateArticles.map((article) => article.slug)).toEqual(["live-b"]);
  });

  it("保存済みの一時非公開slugは残し、新規選択だけを現在の公開候補で検査する", async () => {
    const state = world({
      config: { siteSlug: "hub", articleSlugs: ["stale", "live-a"] },
      published: [summary("live-a"), summary("live-b")],
    });
    const replace = replaceFactory()(state.deps);

    const kept = await replace.execute(anOwner(), {
      siteSlug: "hub",
      articleSlugs: ["stale", "live-b"],
    });
    expect(isOk(kept)).toBe(true);
    expect(state.config()?.articleSlugs).toEqual(["stale", "live-b"]);

    const rejected = await replace.execute(anOwner(), {
      siteSlug: "hub",
      articleSlugs: ["stale", "draft-or-foreign"],
    });
    expect(isErr(rejected)).toBe(true);
    if (isErr(rejected)) expect(rejected.error.field).toBe("articleSlugs");
    expect(state.config()?.articleSlugs).toEqual(["stale", "live-b"]);
  });

  it("最大3件と重複のない順序を守り、違反時は一部も置き換えない", async () => {
    const state = world({
      config: { siteSlug: "hub", articleSlugs: ["a"] },
      published: [summary("a"), summary("b"), summary("c"), summary("d")],
    });
    const replace = replaceFactory()(state.deps);

    for (const articleSlugs of [
      ["a", "b", "c", "d"],
      ["a", "a"],
    ]) {
      const result = await replace.execute(anOwner(), {
        siteSlug: "hub",
        articleSlugs,
      });
      expect(isErr(result), `${articleSlugs.join(", ")} を受け入れました`).toBe(true);
      if (isErr(result)) expect(result.error.field).toBe("articleSlugs");
    }

    expect(state.config()?.articleSlugs).toEqual(["a"]);
    expect(state.writes).toHaveLength(0);
  });

  it("順序付きrelation全体を1回で置換し、空配列で全解除できる", async () => {
    const state = world({
      config: { siteSlug: "hub", articleSlugs: ["a"] },
      published: [summary("a"), summary("b")],
    });
    const replace = replaceFactory()(state.deps);

    const reordered = await replace.execute(anOwner(), {
      siteSlug: "hub",
      articleSlugs: ["b", "a"],
    });
    expect(isOk(reordered)).toBe(true);
    expect(state.config()?.articleSlugs).toEqual(["b", "a"]);
    expect(state.writes).toEqual([
      { workspaceId: WORKSPACE, siteSlug: "hub", articleSlugs: ["b", "a"] },
    ]);

    const cleared = await replace.execute(anOwner(), {
      siteSlug: "hub",
      articleSlugs: [],
    });
    expect(isOk(cleared)).toBe(true);
    expect(state.config()?.articleSlugs).toEqual([]);
    expect(state.writes[1]).toEqual({
      workspaceId: WORKSPACE,
      siteSlug: "hub",
      articleSlugs: [],
    });
    expect(state.audit.actions()).toContain("blog_layout.changed");
  });

  it("記事を書けてもサイト設定を触れない人には保存させない", async () => {
    const state = world({ published: [summary("a")] });
    const result = await replaceFactory()(state.deps).execute(aWriter(), {
      siteSlug: "hub",
      articleSlugs: ["a"],
    });

    expect(isErr(result)).toBe(true);
    expect(state.writes).toHaveLength(0);
  });
});
