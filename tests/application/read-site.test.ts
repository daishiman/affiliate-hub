/** @tier 1 @req REQ-B01, REQ-B02, REQ-B08, REQ-B10, REQ-B11, REQ-B16, REQ-B17 */
import { describe, expect, it } from "vitest";
import type {
  EditorialPublishedContentPort,
  EditorialSiteRepositoryPort,
} from "@/application/ports/site";
import {
  DEFAULT_LIST_LIMIT,
  type ReadSiteDeps,
  createGetArticleUseCase,
  createGetPersonUseCase,
  createGetPolicyDocumentUseCase,
  createGetSiteUseCase,
  createListArticleBrandsUseCase,
  createListByCategoryUseCase,
  createListCorrectionsUseCase,
  createListRecentArticlesUseCase,
  createListSitesUseCase,
  createSearchArticlesUseCase,
} from "@/application/usecases/site/read-site";
import { domainError, err, markCommercial, markEditorial, ok } from "@/domain/shared";
import { createSampleContentRepository } from "@/infrastructure/persistence/sample/content-sample-repository";
import {
  SAMPLE_SITE_SLUG,
  SECOND_SITE_SLUG,
  createSampleSiteRepository,
} from "@/infrastructure/persistence/sample/site-sample-repository";
import { anOutsider } from "../support/actors";

/**
 * 読者向けブログの読み取り。
 *
 * --- ここで固定したいこと ---
 * 1. **読むのに権限が要らないこと。** 何の役割も持たない人（＝ふつうの読者）で全部通す。
 *    ここが権限判定入りに変わると、公開ページがログイン画面になる。
 * 2. **運営側の識別子を読者向けの答えに混ぜないこと。**
 *    ブログの設計図をそのまま返すと、公開ページ 1 枚で運営者の内部 ID が分かる。
 * 3. **「無い」と「取れない」を混ぜないこと。**
 *    無い → 404 で探し直してもらう。取れない → そのまま失敗を上げる。
 *    ここを同じ顔にすると、壊れているのに「URL が違います」と案内してしまう。
 * 4. **0 件を失敗にしないこと。** 空の一覧は「そういう結果」。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-2
 */

/** 役割を 1 つも持たない人。読者はこれで足りる、が確かめたいこと。 */
const reader = anOutsider();

function realDeps(over: Partial<ReadSiteDeps> = {}): ReadSiteDeps {
  return {
    sites: createSampleSiteRepository(),
    content: createSampleContentRepository(),
    ...over,
  };
}

/** どの呼び出しでも同じ失敗を返す保存先。「取れない」側の道を通すために使う。 */
function brokenSites(): EditorialSiteRepositoryPort {
  const boom = async () => err(domainError("UPSTREAM_UNAVAILABLE", "保存先に接続できません。"));
  return markEditorial({ findBySlug: boom, list: boom }) as unknown as EditorialSiteRepositoryPort;
}

function brokenContent(): EditorialPublishedContentPort {
  const boom = async () => err(domainError("UPSTREAM_UNAVAILABLE", "記事を読み出せません。"));
  return markEditorial({
    listRecent: boom,
    listByCategory: boom,
    findArticle: boom,
    search: boom,
    findPerson: boom,
    listByPerson: boom,
    listCorrections: boom,
    findPolicyDocument: boom,
    listBrands: boom,
  }) as unknown as EditorialPublishedContentPort;
}

describe("読者向けの読み取りに渡してよい保存先", () => {
  it.each([
    ["ブログ 1 本", createGetSiteUseCase],
    ["ブログ一覧", createListSitesUseCase],
    ["新着", createListRecentArticlesUseCase],
    ["ブランド", createListArticleBrandsUseCase],
    ["カテゴリー", createListByCategoryUseCase],
    ["記事 1 本", createGetArticleUseCase],
    ["探す", createSearchArticlesUseCase],
    ["書き手", createGetPersonUseCase],
    ["訂正", createListCorrectionsUseCase],
    ["方針の文書", createGetPolicyDocumentUseCase],
  ])("%s: 報酬に関わる保存先が混ざっていたら、組み立てた時点で止まる", (_name, create) => {
    const deps = realDeps({
      content: markCommercial({}) as unknown as EditorialPublishedContentPort,
    });
    expect(() => (create as (d: ReadSiteDeps) => unknown)(deps)).toThrow(/報酬/);
  });
});

describe("ブログ 1 本", () => {
  it("設計図と、そのブログで出す画面の一覧を返す", async () => {
    const result = await createGetSiteUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.blueprint.name.length).toBeGreaterThan(0);
    expect(result.value.routes.length).toBeGreaterThan(0);
  });

  it("運営側の識別子を読者向けの答えに含めない", async () => {
    const result = await createGetSiteUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value.blueprint)).not.toContain("workspaceId");
    // 文字列にしたときにも出てこない（入れ子に残っていないことの確認）。
    expect(JSON.stringify(result.value.blueprint)).not.toContain("workspaceId");
  });

  it("無い名前を指したときは、探し直す道を添えて「無い」と返す", async () => {
    const result = await createGetSiteUseCase(realDeps()).execute(reader, {
      siteSlug: "no-such-site",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain("ブログ");
    expect(result.error.suggestedAction).toContain("トップ");
  });

  it("保存先が読めないときは、無いと言い換えない", async () => {
    const result = await createGetSiteUseCase(realDeps({ sites: brokenSites() })).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("ブログ一覧", () => {
  it("運用中のブログを、読者向けの形にして返す", async () => {
    const result = await createListSitesUseCase(realDeps()).execute(reader, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((s) => s.slug)).toContain(SAMPLE_SITE_SLUG);
    for (const site of result.value) {
      expect(Object.keys(site.blueprint)).not.toContain("workspaceId");
    }
  });

  it("読めないときは、空の一覧に見せない", async () => {
    const result = await createListSitesUseCase(realDeps({ sites: brokenSites() })).execute(
      reader,
      {},
    );
    expect(result.ok).toBe(false);
  });
});

describe("記事の一覧", () => {
  it("新着は、件数を指定しなければ既定の上限で引く", async () => {
    let askedLimit = -1;
    const content = markEditorial({
      async listRecent(_slug: string, limit: number) {
        askedLimit = limit;
        return ok([]);
      },
    }) as unknown as EditorialPublishedContentPort;

    await createListRecentArticlesUseCase(realDeps({ content })).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
    });
    expect(askedLimit).toBe(DEFAULT_LIST_LIMIT);
  });

  it.each([0, 1, 5])("件数を指定したときは、その数をそのまま渡す (%i)", async (limit) => {
    let askedLimit = -1;
    const content = markEditorial({
      async listRecent(_slug: string, l: number) {
        askedLimit = l;
        return ok([]);
      },
    }) as unknown as EditorialPublishedContentPort;

    await createListRecentArticlesUseCase(realDeps({ content })).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      limit,
    });
    expect(askedLimit).toBe(limit);
  });

  it("新着が 0 件でも失敗にしない", async () => {
    const result = await createListRecentArticlesUseCase(realDeps()).execute(reader, {
      siteSlug: "no-such-site",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it("ブランドは、記事の多い順に並んで返る", async () => {
    const result = await createListArticleBrandsUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const counts = result.value.map((b) => b.articleCount);
    // 並び順を画面側に任せない。任せると、一覧の画面ごとに順番が変わる。
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    // 同じ記事の中に同じブランドの商品が何個あっても、1 件と数える。
    expect(counts.every((c) => c >= 1)).toBe(true);
  });

  it("商品を扱っていないブログでは、ブランドが 0 件でも失敗にしない", async () => {
    const result = await createListArticleBrandsUseCase(realDeps()).execute(reader, {
      siteSlug: "no-such-site",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it("カテゴリーの一覧は、カテゴリー名と 1 文説明も一緒に返す", async () => {
    const result = await createListByCategoryUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      categorySlug: "chairs",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 画面側に設計図を引き直させない（引き直させると名前の出どころがばらける）。
    expect(result.value.category.name.length).toBeGreaterThan(0);
    expect(result.value.category.oneLine.length).toBeGreaterThan(0);
    expect(result.value.category.slug).toBe("chairs");
  });

  it("そのブログに無いカテゴリーを指したときは「無い」と返す", async () => {
    const result = await createListByCategoryUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      categorySlug: "rice-cookers",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("カテゴリー");
  });

  it("ブログ自体が無いときは、カテゴリーではなくブログが無いと返す", async () => {
    const result = await createListByCategoryUseCase(realDeps()).execute(reader, {
      siteSlug: "no-such-site",
      categorySlug: "chairs",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("ブログ");
  });

  it("設計図は引けたが記事が読めないときは、失敗をそのまま上げる", async () => {
    const result = await createListByCategoryUseCase(
      realDeps({ content: brokenContent() }),
    ).execute(reader, { siteSlug: SAMPLE_SITE_SLUG, categorySlug: "chairs" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("設計図が読めないときは、カテゴリーを探しにいかない", async () => {
    const result = await createListByCategoryUseCase(realDeps({ sites: brokenSites() })).execute(
      reader,
      { siteSlug: SAMPLE_SITE_SLUG, categorySlug: "chairs" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("記事 1 本", () => {
  it("ある記事は、そのまま返す", async () => {
    const result = await createGetArticleUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      slug: "chairs-for-long-hours",
    });
    expect(result.ok && result.value.slug).toBe("chairs-for-long-hours");
  });

  it("別のブログの記事は、そのブログからは引けない", async () => {
    const result = await createGetArticleUseCase(realDeps()).execute(reader, {
      siteSlug: SECOND_SITE_SLUG,
      slug: "chairs-for-long-hours",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("読み出しに失敗したときは、無いと言い換えない", async () => {
    const result = await createGetArticleUseCase(realDeps({ content: brokenContent() })).execute(
      reader,
      { siteSlug: SAMPLE_SITE_SLUG, slug: "chairs-for-long-hours" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("探す", () => {
  it("見つかった記事と、探した言葉を一緒に返す", async () => {
    const result = await createSearchArticlesUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      query: "編集",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 何で探した結果なのかが分からないと、結果の見出しが書けない。
    expect(result.value.query).toBe("編集");
  });

  it("前後の空白は落として探す", async () => {
    const result = await createSearchArticlesUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      query: "  編集  ",
    });
    expect(result.ok && result.value.query).toBe("編集");
  });

  it.each(["", "   ", "\t\n"])("言葉が空 (%j) のときは、全件を返さず入力を促す", async (query) => {
    const result = await createSearchArticlesUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      query,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION_FAILED");
    expect(result.error.field).toBe("query");
  });

  it("1 件も当たらなくても、失敗にしない", async () => {
    const result = await createSearchArticlesUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      query: "この言葉はどの記事にも入っていない",
    });
    // 0 件を失敗で返すと、画面が「読み込めませんでした」と嘘をつく。
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.hits).toEqual([]);
  });

  it("件数を指定しなければ、既定の上限で探す", async () => {
    let askedLimit = -1;
    const content = markEditorial({
      async search(_slug: string, _q: string, limit: number) {
        askedLimit = limit;
        return ok([]);
      },
    }) as unknown as EditorialPublishedContentPort;

    await createSearchArticlesUseCase(realDeps({ content })).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      query: "編集",
      limit: undefined,
    });
    expect(askedLimit).toBe(DEFAULT_LIST_LIMIT);
  });

  it("探せなかったときは、0 件に見せない", async () => {
    const result = await createSearchArticlesUseCase(realDeps({ content: brokenContent() })).execute(
      reader,
      { siteSlug: SAMPLE_SITE_SLUG, query: "編集" },
    );
    expect(result.ok).toBe(false);
  });
});

describe("書き手・監修者", () => {
  it("その人の紹介と、書いた記事を一緒に返す", async () => {
    const result = await createGetPersonUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      kind: "author",
      slug: "mochizuki",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 名前だけ出しても、読者はその人を信じてよいか決められない。
    expect(result.value.person.credentials.length).toBeGreaterThan(0);
    expect(result.value.articles.length).toBeGreaterThan(0);
    expect(result.value.kind).toBe("author");
  });

  it("監修者も同じ形で引ける", async () => {
    const result = await createGetPersonUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      kind: "expert",
      slug: "sakuma",
    });
    expect(result.ok && result.value.kind).toBe("expert");
  });

  it("書き手を監修者として引くことはできない（肩書きを取り違えない）", async () => {
    const result = await createGetPersonUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      kind: "expert",
      slug: "mochizuki",
    });
    expect(result.ok).toBe(false);
  });

  it.each([
    ["author", "書き手"],
    ["expert", "監修者"],
  ] as const)("無い人を指したときは、%s として無いと言う", async (kind, word) => {
    const result = await createGetPersonUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      kind,
      slug: "no-such-person",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain(word);
  });

  it("人は引けたが記事が読めないときは、失敗をそのまま上げる", async () => {
    const content = markEditorial({
      async findPerson() {
        return ok({ slug: "mochizuki", name: "三輪 さとし", bio: "紹介文", credentials: ["経歴"] });
      },
      async listByPerson() {
        return err(domainError("UPSTREAM_UNAVAILABLE", "記事を読み出せません。"));
      },
    }) as unknown as EditorialPublishedContentPort;

    const result = await createGetPersonUseCase(realDeps({ content })).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      kind: "author",
      slug: "mochizuki",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("人の読み出しに失敗したときは、無いと言い換えない", async () => {
    const result = await createGetPersonUseCase(realDeps({ content: brokenContent() })).execute(
      reader,
      { siteSlug: SAMPLE_SITE_SLUG, kind: "author", slug: "mochizuki" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("訂正と方針", () => {
  it("訂正が 0 件でも、失敗にしない（画面は「まだありません」を出す）", async () => {
    const result = await createListCorrectionsUseCase(realDeps()).execute(reader, {
      siteSlug: "no-such-site",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it("訂正には、記事へ戻れるだけの手がかりが付いている", async () => {
    const result = await createListCorrectionsUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const c of result.value) {
      // 訂正だけを見た人が、元の記事へ行けること。
      expect(c.articleSlug.length).toBeGreaterThan(0);
      expect(c.articleType.length).toBeGreaterThan(0);
      expect(c.what.length).toBeGreaterThan(0);
      expect(c.why.length).toBeGreaterThan(0);
    }
  });

  it("方針の文書は、題名と本文を返す", async () => {
    const result = await createGetPolicyDocumentUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      key: "methodology",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title.length).toBeGreaterThan(0);
    expect(result.value.body.length).toBeGreaterThan(0);
  });

  it("無い文書を指したときは「無い」と返す", async () => {
    const result = await createGetPolicyDocumentUseCase(realDeps()).execute(reader, {
      siteSlug: SAMPLE_SITE_SLUG,
      key: "no-such-policy",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("文書が読めないときは、無いと言い換えない", async () => {
    const result = await createGetPolicyDocumentUseCase(
      realDeps({ content: brokenContent() }),
    ).execute(reader, { siteSlug: SAMPLE_SITE_SLUG, key: "methodology" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});
