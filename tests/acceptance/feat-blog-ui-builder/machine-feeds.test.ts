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
 * 応答の形（status・content-type・XML の骨組み）だけを見る検査は、
 * **中身が空でも全部緑になる**。だからこの 1 本は行の中身を見る。
 *
 * ## 2026-09-02 に、見るものが変わった
 *
 * 当時この穴は「公開面の記事に入口が 2 つある」ことが原因で、配信物の
 * 組み立ては編集済みの読み取りモデルしか見ていなかった。手当ては
 * ブログ運用側（`/blog/<slug>`）を別の口から読んで合流させることだった。
 *
 * **いま合流は存在しない。**`published_articles` が唯一の公開 projection に
 * なり（`drizzle/0043_canonical_public_articles.sql`）、ブログ運用で書いた
 * 記事もここに載る。道も `articleHref` が記事の種別から決めるので、
 * 配信物に `/blog/<slug>` は現れない（旧 URL は 308 で正規 URL へ移る）。
 *
 * よってこの 1 本が守るのは「2 系統を合流させたか」ではなく、
 * **公開 projection にある記事が 1 本残らず、1 度だけ載るか**である。
 * 別の口を足して足し算に戻したら、二重掲載の検査で赤くなる。
 *
 * `feeds.test.ts` が見るのは文字列の組み立て（純関数）で、
 * ここが見るのは**どの記事を渡したか**——選ぶ側の判断である。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "@/domain/shared";

const listRecent = vi.fn();

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
  };
});

const { RSS_ARTICLE_LIMIT, SEO_ARTICLE_POLICY, loadSeoSite, sitemapEntries } = await import(
  "@/presentation/site/seo-routes"
);

/** 公開 projection の 1 行。`type` が道を決める（`articleHref` が正本）。 */
function published(input: {
  readonly slug: string;
  readonly type: "ranking" | "review";
  readonly title: string;
  readonly summary: string;
  readonly updatedAt: string;
}) {
  return {
    slug: input.slug,
    siteSlug: "gadget",
    type: input.type,
    title: input.title,
    summary: input.summary,
    categorySlug: "laptop",
    updatedAt: input.updatedAt,
    authorName: "編集部",
  };
}

/** 編集画面から公開した記事。道は `/best/<slug>`。 */
const EDITED = published({
  slug: "laptops",
  type: "ranking",
  title: "ノート PC の結論",
  summary: "実測で比べた。",
  updatedAt: "2026-08-10",
});

/**
 * ブログ運用の画面から公開した記事。**同じ表に載る。**
 * 道は `/blog/quiet-desk` ではなく、種別が決める `/reviews/quiet-desk`。
 */
const FROM_BLOG_OPS = published({
  slug: "quiet-desk",
  type: "review",
  title: "静かな机の作り方",
  summary: "騒音を測って選んだ。",
  updatedAt: "2026-08-20",
});

const request = new Request("https://example.com/s/gadget/sitemap.xml");

beforeEach(() => {
  listRecent.mockReset();
  listRecent.mockResolvedValue(ok([FROM_BLOG_OPS, EDITED]));
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
   * 公開 projection にある記事を落とす実装に戻したら、ここで赤くなる。
   */
  it("公開 projection の記事は、出どころの画面を問わず全部載る", async () => {
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    // ブログ運用で書いた記事も、旧 `/blog/<slug>` ではなく種別が決める正規 URL で載る。
    expect(loaded.value.items.map((item) => item.path)).toEqual([
      "/reviews/quiet-desk",
      "/best/laptops",
    ]);
  });

  /**
   * **同じ記事を 2 度並べない。**別の口をもう 1 つ足して足し算に戻すと、
   * 同じ記事が 2 行ずつ並ぶ sitemap になる（2026-09-02 まで実際そうなりえた）。
   */
  it("同じ記事を 2 度並べない", async () => {
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    if (!loaded.ok) throw new Error("読めるはず");
    const paths = loaded.value.items.map((item) => item.path);
    expect(paths).toHaveLength(new Set(paths).size);
  });

  it("公開 projection が返した新しい順のまま並べ替えない", async () => {
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    if (!loaded.ok) throw new Error("読めるはず");
    expect(loaded.value.items.map((item) => item.updatedAt)).toEqual(["2026-08-20", "2026-08-10"]);
  });

  /**
   * 空文字を出すと、llms.txt が「説明の無い記事」を並べたものになり、
   * AI から見て中身の無いサイトに読める。
   */
  it("説明は記事の要約を使う（空文字を出さない）", async () => {
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    if (!loaded.ok) throw new Error("読めるはず");
    const fromBlogOps = loaded.value.items.find((item) => item.path === "/reviews/quiet-desk");
    expect(fromBlogOps?.summary).toBe("騒音を測って選んだ。");
  });

  it("配信物の日付は YYYY-MM-DD（時刻を持ち込まない）", async () => {
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    if (!loaded.ok) throw new Error("読めるはず");
    for (const item of loaded.value.items) expect(item.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  /**
   * 新着配信の上限は**読み口へ渡して切らせる**。
   * 読んでから配信側で切ると、上限を超えた分を無駄に読むうえ、
   * 「20 件読んだのに 20 件に切る」ような重ねた切り方が生まれる。
   */
  it("RSS は上限を読み口へ渡す", async () => {
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.feed);
    if (!loaded.ok) throw new Error("読めるはず");
    expect(listRecent).toHaveBeenCalledWith(expect.anything(), {
      siteSlug: "gadget",
      limit: RSS_ARTICLE_LIMIT,
    });
  });

  /**
   * 網羅が目的の sitemap / llms.txt では切らない。
   * ここで切ると、落ちた記事が「公開されていない」と読まれる。
   */
  it("網羅が目的の配信物では件数を切らない", async () => {
    listRecent.mockResolvedValue(
      ok(
        Array.from({ length: 30 }, (_, index) =>
          published({
            slug: `a${index}`,
            type: "review",
            title: `記事 ${index}`,
            summary: "本文。",
            updatedAt: "2026-08-25",
          }),
        ),
      ),
    );
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    if (!loaded.ok) throw new Error("読めるはず");
    expect(loaded.value.items).toHaveLength(30);
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
  });

  /**
   * 欠けた sitemap を 200 で配ると、検索エンジンには
   * 「載っていない記事は消えた」と読める。だから配信を止める。
   */
  it("記事が読めなければ、欠けた配信物を 200 で配らない", async () => {
    listRecent.mockResolvedValue({
      ok: false,
      error: { code: "UPSTREAM_UNAVAILABLE", message: "保存先を読めませんでした。" },
    });
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.response.status).toBe(503);
  });

  /**
   * sitemap の行は `FeedItem.path` をそのまま使う。
   * ここで道を組み立て直すと、記事の種類が増えた日に
   * この関数だけ古い写し方のまま残る。
   */
  it("sitemap の行は、読み取りが決めた道をそのまま使う", async () => {
    const loaded = await loadSeoSite(request, "gadget", SEO_ARTICLE_POLICY.completeIndex);
    if (!loaded.ok) throw new Error("読めるはず");
    expect(sitemapEntries(loaded.value.items)).toEqual([
      { path: "/reviews/quiet-desk", updatedAt: "2026-08-20" },
      { path: "/best/laptops", updatedAt: "2026-08-10" },
    ]);
  });
});
