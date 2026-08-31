/**
 * @tier 1
 * @req REQ-SEO02, A11
 * @types equivalence, regression, boundary
 *
 * 受入 **A11**「公開ブログが sitemap.xml / robots.txt / feed.xml / llms.txt を配る」の
 * **中身**の確認。
 *
 * ## なぜ「200 が返る」では足りないのか
 *
 * P07 の実測で、4 種とも 200 を返し、AI クローラー 4 種の Allow も正しく、
 * それでいて**公開記事 7 本が 1 本も載っていなかった**。
 *
 * 原因は公開面の記事に入口が 2 つあることである。
 *   - 編集済みの読み取りモデル … `/best` `/guides` `/reviews` `/compare` `/tools`
 *   - ブログ運用で書いた記事 … `/blog/<slug>`
 * 配信物の組み立ては前者しか見ていなかった。
 * 応答の形（status・content-type・XML の骨組み）だけを見る検査は、
 * **中身が空でも全部緑になる**。だからこの 1 本は行の中身を見る。
 *
 * `feeds.test.ts` が見るのは文字列の組み立て（純関数）で、
 * ここが見るのは**どの記事を渡したか**——合流させる側の判断である。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogArticle } from "@/domain/blogops/blog-article";
import { ok } from "@/domain/shared";

const listRecent = vi.fn();
const listPublished = vi.fn();
const openSite = vi.fn();

vi.mock("@/presentation/composition", async () => {
  const { requestOriginFromRequest } = await import("@/infrastructure/http/request-origin");
  return {
    requestOriginFromWebRequest: requestOriginFromRequest,
    readerActor: () => ({ kind: "reader" }),
    siteUseCases: async () => ({
    getSite: {
      execute: async () =>
        ok({
          blueprint: { slug: "gadget", name: "ガジェット研究室", purpose: "実測で比べる。" },
          routes: [],
        }),
    },
    listRecent: { execute: listRecent },
    }),
    publicBlogEntry: async () => ({ port: { openSite } }),
  };
});

const { SEO_ARTICLE_POLICY, loadSeoSite, sitemapEntries } = await import(
  "@/presentation/site/seo-routes"
);

function blogArticle(input: {
  readonly slug: string;
  readonly title: string;
  readonly lead: string;
  readonly updatedAt: string;
}): BlogArticle {
  return {
    id: `art_${input.slug}`,
    siteSlug: "gadget",
    slug: input.slug,
    template: "T1",
    title: input.title,
    lead: input.lead,
    status: "published",
    authorName: "編集部",
    publishedAt: new Date(`${input.updatedAt}T00:00:00Z`),
    updatedAt: new Date(`${input.updatedAt}T00:00:00Z`),
  } as BlogArticle;
}

/** 編集済み読み取りモデルの 1 件。道は `/best/<slug>` になる。 */
const EDITED = {
  slug: "laptops",
  siteSlug: "gadget",
  type: "ranking",
  title: "ノート PC の結論",
  summary: "実測で比べた。",
  categorySlug: "laptop",
  updatedAt: "2026-08-10",
  authorName: "編集部",
};

const request = new Request("https://example.com/s/gadget/sitemap.xml");

beforeEach(() => {
  listRecent.mockReset();
  listPublished.mockReset();
  openSite.mockReset();
  listRecent.mockResolvedValue(ok([EDITED]));
  listPublished.mockResolvedValue(
    ok([
      blogArticle({
        slug: "quiet-desk",
        title: "静かな机の作り方",
        lead: "騒音を測って選んだ。",
        updatedAt: "2026-08-20",
      }),
    ]),
  );
  openSite.mockResolvedValue(ok({ listPublished }));
});

describe("A11 配信物に載る記事", () => {
  it("forwarded hostをmetadataと同じ規則で機械向けURLのoriginにする", async () => {
    const forwarded = new Request("https://internal.example/s/gadget/sitemap.xml", {
      headers: {
        "x-forwarded-host": "blog.example.jp",
        "x-forwarded-proto": "https",
      },
    });

    const loaded = await loadSeoSite(forwarded, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    if (!loaded.ok) throw new Error("読めるはず");
    expect(loaded.value.origin).toBe("https://blog.example.jp");
  });

  it("不正なforwarded hostなら攻撃者のURLを配らず400で止める", async () => {
    const poisoned = new Request("https://internal.example/s/gadget/sitemap.xml", {
      headers: {
        "x-forwarded-host": "blog.example.jp, attacker.example",
        "x-forwarded-proto": "https",
      },
    });

    const loaded = await loadSeoSite(poisoned, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.response.status).toBe(400);
    await expect(loaded.response.text()).resolves.not.toContain("attacker.example");
  });

  /**
   * この 1 本が P07 で見つけた穴そのものである。
   * 片方だけを載せる実装に戻したら、ここで赤くなる。
   */
  it("2 系統の記事がどちらも載る", async () => {
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.items.map((item) => item.path)).toEqual([
      "/blog/quiet-desk",
      "/best/laptops",
    ]);
  });

  it("新しい順に並ぶ（どちらの系統から来たかで順が決まらない）", async () => {
    listPublished.mockResolvedValue(
      ok([
        blogArticle({
          slug: "old",
          title: "古い方",
          lead: "先に書いた。",
          updatedAt: "2026-08-01",
        }),
      ]),
    );
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    if (!loaded.ok) throw new Error("読めるはず");
    expect(loaded.value.items.map((item) => item.updatedAt)).toEqual(["2026-08-10", "2026-08-01"]);
  });

  /**
   * ブログ運用の記事は `summary` を持たないので、導入文を使う。
   * 空文字を出すと、llms.txt が「説明の無い記事」を並べたものになり、
   * AI から見て中身の無いサイトに読める。
   */
  it("ブログ運用の記事は導入文を説明にする（空文字を出さない）", async () => {
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    if (!loaded.ok) throw new Error("読めるはず");
    const blog = loaded.value.items.find((item) => item.path === "/blog/quiet-desk");
    expect(blog?.summary).toBe("騒音を測って選んだ。");
  });

  it("配信物の日付は YYYY-MM-DD（時刻を持ち込まない）", async () => {
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    if (!loaded.ok) throw new Error("読めるはず");
    for (const item of loaded.value.items) expect(item.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  /**
   * 新着配信は**合流後にもう一度**上限で切る。
   * 切らないと、片方 20 本ずつで 40 本の「新着 20 件」ができる。
   */
  it("RSS は合流したあとの件数で上限を守る", async () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      blogArticle({
        slug: `a${index}`,
        title: `記事 ${index}`,
        lead: "本文。",
        updatedAt: "2026-08-25",
      }),
    );
    listPublished.mockResolvedValue(ok(many));
    listRecent.mockResolvedValue(ok(Array.from({ length: 20 }, () => EDITED)));
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.feed);
    if (!loaded.ok) throw new Error("読めるはず");
    expect(loaded.value.items).toHaveLength(20);
  });

  /**
   * 網羅が目的の sitemap / llms.txt では切らない。
   * ここで切ると、落ちた記事が「公開されていない」と読まれる。
   */
  it("網羅が目的の配信物では件数を切らない", async () => {
    listPublished.mockResolvedValue(
      ok(
        Array.from({ length: 30 }, (_, index) =>
          blogArticle({
            slug: `a${index}`,
            title: `記事 ${index}`,
            lead: "本文。",
            updatedAt: "2026-08-25",
          }),
        ),
      ),
    );
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    if (!loaded.ok) throw new Error("読めるはず");
    expect(loaded.value.items).toHaveLength(31);
  });

  /**
   * robots.txt は記事を読まない。読むと、記事の保存先が落ちている間
   * 「クローラーへの案内」まで配れなくなる。
   */
  it("記事を要らない配信物（robots.txt）では、記事を 1 度も読みに行かない", async () => {
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.none);
    if (!loaded.ok) throw new Error("読めるはず");
    expect(loaded.value.items).toEqual([]);
    expect(listRecent).not.toHaveBeenCalled();
    expect(openSite).not.toHaveBeenCalled();
  });

  /**
   * 片方だけ載った sitemap を 200 で配ると、検索エンジンには
   * 「載っていない記事は消えた」と読める。だから配信を止める。
   */
  it("ブログ運用側が読めなければ、欠けた配信物を 200 で配らない", async () => {
    openSite.mockResolvedValue({
      ok: false,
      error: { code: "UPSTREAM_UNAVAILABLE", message: "保存先を読めませんでした。" },
    });
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.response.status).toBe(503);
  });

  it("公開サイトの記事が 1 本も無くても、編集済みの記事は配る", async () => {
    openSite.mockResolvedValue(ok(null));
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    if (!loaded.ok) throw new Error("読めるはず");
    expect(loaded.value.items.map((item) => item.path)).toEqual(["/best/laptops"]);
  });

  /**
   * sitemap の行は `FeedItem.path` をそのまま使う。
   * ここで道を組み立て直すと、記事の種類が増えた日に
   * この関数だけ古い写し方のまま残る。
   */
  it("sitemap の行は、合流した道をそのまま使う", async () => {
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    if (!loaded.ok) throw new Error("読めるはず");
    expect(sitemapEntries(loaded.value.items)).toEqual([
      { path: "/blog/quiet-desk", updatedAt: "2026-08-20" },
      { path: "/best/laptops", updatedAt: "2026-08-10" },
    ]);
  });
});
