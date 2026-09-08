/**
 * @tier 2
 * @req REQ-BLOG02, REQ-BOPS03
 * @types decision-table, screen-states
 *
 * トップの帯。
 *
 * **並び順と件数を画面に持たせない**のがこの部品の主題である。
 * 正本は管理画面（`/admin/blog/layout`）が保存した設定で、ここは
 * 保存された通りに描くだけ。画面側に既定値を書くと、
 * 管理画面で変えたのに変わらない帯が生まれ、運営者は
 * **自分の操作が効いていない**と受け取る。
 *
 * 帯は 4 種あり、種ごとに引く先が違う（記事・姉妹サイト・カテゴリー・タグ）。
 * 引く先を 1 つ取り違えても画面はもっともらしく見えるので、
 * 4 種すべてを別々に固定する。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  BlogLayoutBandRecord,
  BlogTagRecord,
  SiteNetworkRecord,
} from "@/application/ports/blog-ops";
import type { ArticleSummary } from "@/application/read-models/published-article";
import { BlogTopBands, type TopBandCategory } from "@/presentation/site/blog-top-bands";
import type { PublicSiteProjection } from "@/presentation/site/public-site-projection";

function band(over: Partial<BlogLayoutBandRecord> = {}): BlogLayoutBandRecord {
  return {
    id: `blb_${over.band ?? "latest"}`,
    siteSlug: "test",
    band: "latest_posts",
    title: "",
    enabled: true,
    position: 1,
    itemLimit: 5,
    ...over,
  };
}

function article(over: Partial<ArticleSummary> = {}): ArticleSummary {
  return {
    slug: "chair",
    siteSlug: "test",
    type: "review",
    title: "椅子の話",
    summary: "座り心地の話。",
    categorySlug: "chairs",
    updatedAt: "2026-09-01T09:00:00.000Z",
    authorName: "編集部",
    ...over,
  };
}

function render(
  bands: readonly BlogLayoutBandRecord[],
  over: {
    readonly articles?: readonly ArticleSummary[];
    readonly network?: readonly SiteNetworkRecord[];
    readonly tags?: readonly BlogTagRecord[];
    readonly categories?: readonly TopBandCategory[];
  } = {},
): string | null {
  const node = BlogTopBands({
    siteSlug: "test",
    categories: over.categories ?? [],
    projection: {
      bands,
      articles: over.articles ?? [],
      network: over.network ?? [],
      tags: over.tags ?? [],
    } as unknown as PublicSiteProjection,
  });
  return node === null ? null : renderToStaticMarkup(node);
}

describe("帯そのものの出し方", () => {
  it("設定が 1 件も無ければ何も描かない", () => {
    // 「まだ設定していない」は読者に見せる情報ではない。
    expect(render([])).toBeNull();
  });

  it("保存された位置の順に並べる", () => {
    const html = render(
      [
        band({ id: "second", band: "category_hub", position: 2 }),
        band({ id: "first", band: "latest_posts", position: 1 }),
      ],
      { articles: [article()], categories: [{ slug: "c", name: "椅子", oneLine: "座るもの" }] },
    );

    expect(html?.indexOf("新着記事の帯")).toBeLessThan(html?.indexOf("カテゴリー別のタイル") ?? -1);
  });

  it("見出しを付けていない帯には、種類の名前を当てる", () => {
    // 見出しが空欄のまま無題の箱を並べると、読者は何の一覧か分からない。
    expect(render([band({ title: "  " })], { articles: [article()] })).toContain("新着記事の帯");
  });

  it("見出しを付けた帯は、その言葉をそのまま出す", () => {
    expect(render([band({ title: "編集部の新着" })], { articles: [article()] })).toContain(
      "編集部の新着",
    );
  });

  it("中身がまだ無い帯は、見出しを残して「これから出る」と言う", () => {
    /*
      ここで帯ごと消さないのは、**運営者が出すと決めた枠**だからである。
      黙って消えると、設定した側は保存が効いていないと受け取る。
    */
    const html = render([band({ band: "latest_posts" })], { articles: [] });

    expect(html).toContain("新着記事の帯");
    expect(html).toContain("まだ出せるものがありません");
  });
});

describe("帯ごとに、引く先が違う", () => {
  it("新着記事は記事の正規URLへ導き、要約が空なら日付を添える", () => {
    /*
      要約が空のときに何も添えないと、題名だけが並んで
      どれが新しいのか分からない一覧になる。
    */
    const html = render([band({ band: "latest_posts" })], {
      articles: [article({ slug: "a", title: "要約あり" }), article({ slug: "b", title: "要約なし", summary: "" })],
    });

    expect(html).toContain("/reviews/a");
    expect(html).toContain("座り心地の話。");
    expect(html).toContain("2026-09-01");
  });

  it("姉妹サイトの帯に、自分自身を並べない", () => {
    /*
      網の読み取りは「自分と自分の子」を返す。落とさないと、
      自分のトップに自分へのリンクが並ぶ。
    */
    const node = (slug: string, name: string): SiteNetworkRecord => ({
      id: `snn_${slug}`,
      siteSlug: slug,
      role: "sub",
      parentSlug: "test",
      name,
      oneLine: `${name} の説明`,
      position: 1,
      status: "active",
    });
    const html = render([band({ band: "sister_sites" })], {
      network: [node("test", "自分"), node("sister", "姉妹")],
    });

    expect(html).toContain("姉妹");
    expect(html).not.toContain("自分");
  });

  it("カテゴリーの帯は、それぞれの一覧へ導く", () => {
    const html = render([band({ band: "category_hub" })], {
      categories: [{ slug: "chairs", name: "椅子", oneLine: "座るもの" }],
    });

    expect(html).toContain("/categories/chairs");
    expect(html).toContain("座るもの");
  });

  it("ナビゲータの帯には、作り手のタグだけを出す", () => {
    /*
      この帯は読者に「これは商品の作り手だ」と言っている。
      話題のタグが混じると枠そのものが嘘になる。
    */
    const tag = (over: Partial<BlogTagRecord>): BlogTagRecord => ({
      id: `btg_${over.slug}`,
      siteSlug: "test",
      slug: "x",
      name: "X",
      description: "",
      kind: "brand",
      ...over,
    });
    const html = render([band({ band: "navigator" })], {
      tags: [tag({ slug: "acme", name: "アクメ" }), tag({ slug: "saving", name: "節約", kind: "topic" })],
    });

    expect(html).toContain("アクメ");
    expect(html).not.toContain("節約");
    expect(html).toContain("tag=acme");
  });

  it("件数の上限は保存された設定に従う", () => {
    // 画面に既定件数を書くと、管理画面で変えたのに変わらない帯になる。
    const html = render([band({ band: "latest_posts", itemLimit: 1 })], {
      articles: [article({ slug: "a", title: "1本目" }), article({ slug: "b", title: "2本目" })],
    });

    expect(html).toContain("1本目");
    expect(html).not.toContain("2本目");
  });

  it("上限 0 は「置くが空」ではなく「1 件も出さない」", () => {
    const html = render([band({ band: "latest_posts", itemLimit: 0 })], {
      articles: [article()],
    });

    expect(html).toContain("まだ出せるものがありません");
    expect(html).not.toContain("椅子の話");
  });
});
