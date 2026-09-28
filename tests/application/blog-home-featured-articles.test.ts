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
import {
  type ManageBlogHomeFeaturedArticlesDeps,
  createReadBlogHomeFeaturedArticlesUseCase,
  createReplaceBlogHomeFeaturedArticlesUseCase,
} from "@/application/usecases/blog-ops";
import { createSampleContentRepository } from "@/infrastructure/persistence/sample/content-sample-repository";
import { isErr, isOk, markEditorial, ok } from "@/domain/shared";
import { anOwner, aWriter, WORKSPACE } from "../support/actors";
import { NOW } from "../support/clock";
import { fakeRepository } from "../support/blog-ops-fake";
import { recordingAuditLog } from "../support/doubles";

type FeaturedConfig = {
  readonly siteSlug: string;
  readonly articleSlugs: readonly string[];
};

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

/**
 * 保存先と読み口を、どちらも正本の口をそのまま満たす形で用意する。
 *
 * 以前はここで `findBlogHomeFeaturedArticles` と `replaceBlogHomeFeaturedArticles`
 * の 2 口だけ、しかも `workspaceId: string` という痩せた引数で組み、
 * 使う側は namespace を `as unknown as` で覗いて関数を取り出していた。
 * その形だと、ユースケースが受け取る `deps` の型は**どこにも現れない**——
 * 正本のポートに口が増えても、引数の別名型が変わっても、この検査は黙る。
 *
 * いまは保管庫は `fakeRepository`、読み口は見本の実装を土台にする。
 * 展開すると Editorial の印が落ちるので `markEditorial` で付け直す。
 */
function world(input: {
  readonly config?: FeaturedConfig | null;
  readonly published?: readonly ArticleSummary[];
} = {}) {
  const publicArticles = input.published ?? [];
  const audit = recordingAuditLog();
  const writes: Array<{
    readonly workspaceId: string;
    readonly siteSlug: string;
    readonly articleSlugs: readonly string[];
  }> = [];

  const fake = fakeRepository({
    featured: input.config === null || input.config === undefined ? [] : [{ ...input.config }],
  });

  const deps: ManageBlogHomeFeaturedArticlesDeps = {
    repository: {
      ...fake.port,
      replaceBlogHomeFeaturedArticles: async (workspaceId, replacement) => {
        writes.push({ workspaceId: String(workspaceId), ...replacement });
        return fake.port.replaceBlogHomeFeaturedArticles(workspaceId, replacement);
      },
    },
    publishedContent: markEditorial({
      ...createSampleContentRepository(),
      listRecent: async (siteSlug: string, limit: number) =>
        ok(publicArticles.filter((article) => article.siteSlug === siteSlug).slice(0, limit)),
      findArticle: async (siteSlug: string, slug: string) => {
        const found = publicArticles.find(
          (article) => article.siteSlug === siteSlug && article.slug === slug,
        );
        return ok(found === undefined ? null : published(found));
      },
    }),
    auditLog: audit.port,
    ids: { newId: () => "featured-audit-1" },
    now: () => NOW,
  };

  return {
    deps,
    writes,
    audit,
    config: () => fake.store.featured.find((row) => row.siteSlug === "hub") ?? null,
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

    const result = await createReadBlogHomeFeaturedArticlesUseCase(state.deps).execute(anOwner(), { siteSlug: "hub" });

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
    const replace = createReplaceBlogHomeFeaturedArticlesUseCase(state.deps);

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
    const replace = createReplaceBlogHomeFeaturedArticlesUseCase(state.deps);

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
    const replace = createReplaceBlogHomeFeaturedArticlesUseCase(state.deps);

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
    const result = await createReplaceBlogHomeFeaturedArticlesUseCase(state.deps).execute(aWriter(), {
      siteSlug: "hub",
      articleSlugs: ["a"],
    });

    expect(isErr(result)).toBe(true);
    expect(state.writes).toHaveLength(0);
  });
});
