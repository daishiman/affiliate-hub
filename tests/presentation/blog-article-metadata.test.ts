/**
 * @tier 1
 * @req REQ-P07
 * @types decision-table, equivalence, boundary
 *
 * ブログ運用で書いた記事（`/blog/<slug>`）の metadata（受入 A10）。
 *
 * --- なぜここを別に見るのか ---
 *
 * `articleMetadata` を使い回せない経路である。あちらは編集済みの読み取り
 * モデルを `getArticle` から引くが、この経路の記事は運用側の保管庫にしか
 * ない。**2026-08-30 まで、この経路には canonical も OGP も出ていなかった。**
 * 片方へ寄せると、片方の記事だけ静かに空の metadata になる。
 * 静かに空になるものは、誰も赤で気づけない。
 *
 * ここで見るのは 3 つ:
 *
 * 1. **読めなかったら空を返す。**推測した canonical を配るより、無い方がよい。
 *    間違った canonical は「別のページの写し」として検索側に登録される。
 * 2. **host が取れないときも空を配らない。**canonical だけを落とし、
 *    題や説明は出す。全部落とすと、読めている情報まで配れなくなる。
 * 3. **下書きに公開日を出さない。**まだ無い記事が「公開済み」に見える。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "@/domain/shared";

let origin: string | null = "https://blog.example.test";
vi.mock("@/presentation/http/request-origin", () => ({
  requestOriginFromNextHeaders: async () => origin,
}));

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, publicBlogEntry: async () => ({ ready: true }) };
});

/** 投影の読み取りと記事の取り出し。どちらも 3 通りの返り方がある。 */
let projection: unknown = null;
let article: unknown = null;
vi.mock("@/presentation/site/public-site-projection", () => ({
  readPublicSiteProjection: async () => projection,
  findProjectedArticle: async () => article,
}));

const { blogArticleMetadata, siteCanonicalPath } = await import(
  "@/presentation/site/site-metadata"
);

const READER = { blueprint: { name: "見本ブログ", purpose: "試す" } };

function published(overrides: Record<string, unknown> = {}) {
  return {
    slug: "note",
    title: "はじめての記事",
    lead: "読むと分かること",
    publishedAt: new Date("2026-08-30T00:00:00.000Z"),
    updatedAt: new Date("2026-08-31T00:00:00.000Z"),
    authorName: "書いた人",
    ...overrides,
  };
}

beforeEach(() => {
  origin = "https://blog.example.test";
  projection = ok({ reader: READER });
  article = ok({ article: published() });
});

describe("canonical の道の組み立て", () => {
  it.each([
    ["owned-blog", "", "/s/owned-blog"],
    ["owned-blog", "/blog/note", "/s/owned-blog/blog/note"],
  ])("%o + %o → %o", (siteSlug, path, expected) => {
    expect(siteCanonicalPath(siteSlug, path)).toBe(expected);
  });

  it("道を省くと、サイト直下になる", () => {
    expect(siteCanonicalPath("owned-blog")).toBe("/s/owned-blog");
  });
});

describe("読めなかったときは空を返す", () => {
  it("投影そのものが読めない", async () => {
    projection = err({ code: "UPSTREAM_UNAVAILABLE", message: "落ちています" });
    expect(await blogArticleMetadata("owned-blog", "note")).toEqual({});
  });

  it("そのブログが無い", async () => {
    projection = ok(null);
    expect(await blogArticleMetadata("owned-blog", "note")).toEqual({});
  });

  it("記事の取り出しが失敗した", async () => {
    article = err({ code: "UPSTREAM_UNAVAILABLE", message: "落ちています" });
    expect(await blogArticleMetadata("owned-blog", "note")).toEqual({});
  });

  it("その記事が無い", async () => {
    article = ok(null);
    expect(await blogArticleMetadata("owned-blog", "note")).toEqual({});
  });
});

describe("読めたときに配るもの", () => {
  it("題・説明・canonical・OGP を、同じ読み取りモデルから作る", async () => {
    const meta = await blogArticleMetadata("owned-blog", "note");
    expect(meta.title).toBe("はじめての記事");
    expect(meta.description).toBe("読むと分かること");
    expect(meta.alternates?.canonical).toBe("https://blog.example.test/s/owned-blog/blog/note");
    expect(meta.openGraph).toMatchObject({
      type: "article",
      url: "https://blog.example.test/s/owned-blog/blog/note",
      siteName: "見本ブログ",
      locale: "ja_JP",
      authors: ["書いた人"],
    });
    expect(meta.twitter).toMatchObject({ card: "summary", title: "はじめての記事" });
  });

  /**
   * canonical は **記事が名乗る slug** で組み立てる。
   * 引数の slug で組むと、旧 slug で開いた読者に「その旧 slug が正本だ」と
   * 名乗る canonical が配られ、検索側に重複として登録される。
   */
  it("道は、記事が名乗る slug で組む", async () => {
    article = ok({ article: published({ slug: "renamed" }) });
    const meta = await blogArticleMetadata("owned-blog", "old-slug");
    expect(meta.alternates?.canonical).toBe("https://blog.example.test/s/owned-blog/blog/renamed");
  });

  it("切り詰めない意思を、検索側へ明示する", async () => {
    const meta = await blogArticleMetadata("owned-blog", "note");
    expect(meta.robots).toMatchObject({ index: true, follow: true });
  });
});

describe("host が取れないとき", () => {
  /**
   * 推測した canonical を配らない。無い方がよい。
   * ただし題や説明まで落とすと、読めている情報が配れなくなる。
   */
  it("canonical と og:url だけを落とし、残りは配る", async () => {
    origin = null;
    const meta = await blogArticleMetadata("owned-blog", "note");
    expect(meta.alternates).toBeUndefined();
    expect(meta.openGraph).not.toHaveProperty("url");
    expect(meta.title).toBe("はじめての記事");
    expect(meta.openGraph).toMatchObject({ siteName: "見本ブログ" });
  });
});

describe("下書きに公開日を出さない", () => {
  /** まだ無い日付を 0 埋めや「今」で作ると、下書きが公開済みに見える。 */
  it("公開日が無ければ、その鍵ごと出さない", async () => {
    article = ok({ article: published({ publishedAt: null }) });
    const meta = await blogArticleMetadata("owned-blog", "note");
    expect(meta.openGraph).not.toHaveProperty("publishedTime");
    expect(meta.openGraph).toMatchObject({ modifiedTime: "2026-08-31T00:00:00.000Z" });
  });

  it("公開日があれば、機械が読める形で出す", async () => {
    const meta = await blogArticleMetadata("owned-blog", "note");
    expect(meta.openGraph).toMatchObject({ publishedTime: "2026-08-30T00:00:00.000Z" });
  });
});
