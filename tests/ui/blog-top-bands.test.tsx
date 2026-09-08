/**
 * @tier 2
 * @req REQ-BLOG02, REQ-BOPS03
 * @types decision-table, screen-states
 *
 * トップの補助帯。
 *
 * canonical な記事とカテゴリーは `SiteHomeContent` が持つ。
 * 旧設定の `latest_posts` / `category_hub` も重ねると、
 * 読者に同じ入口が 2 回届くため、この部品からは出さない。
 *
 * 別の価値を持つ `sister_sites` / `navigator` だけは後方互換で残す。
 * その並び順と件数は、引き続き管理画面の保存値に従う。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  BlogLayoutBandRecord,
  BlogTagRecord,
  SiteNetworkRecord,
} from "@/application/ports/blog-ops";
import type { ArticleSummary } from "@/application/read-models/published-article";
import { BlogTopBands } from "@/presentation/site/blog-top-bands";
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

function networkNode(slug: string, name: string): SiteNetworkRecord {
  return {
    id: `snn_${slug}`,
    siteSlug: slug,
    role: "sub",
    parentSlug: "test",
    name,
    oneLine: `${name} の説明`,
    position: 1,
    status: "active",
  };
}

function tag(over: Partial<BlogTagRecord>): BlogTagRecord {
  return {
    id: `btg_${over.slug}`,
    siteSlug: "test",
    slug: "x",
    name: "X",
    description: "",
    kind: "brand",
    ...over,
  };
}

function render(
  bands: readonly BlogLayoutBandRecord[],
  over: {
    readonly articles?: readonly ArticleSummary[];
    readonly network?: readonly SiteNetworkRecord[];
    readonly tags?: readonly BlogTagRecord[];
  } = {},
): string | null {
  const node = BlogTopBands({
    siteSlug: "test",
    projection: {
      bands,
      articles: over.articles ?? [],
      network: over.network ?? [],
      tags: over.tags ?? [],
    } as unknown as PublicSiteProjection,
  });
  return node === null ? null : renderToStaticMarkup(node);
}

describe("補助帯そのものの出し方", () => {
  it("補助帯の設定が 1 件も無ければ何も描かない", () => {
    // 「まだ設定していない」は読者に見せる情報ではない。
    expect(render([])).toBeNull();
  });

  it("保存された位置の順に並べる", () => {
    const html = render(
      [
        band({ id: "second", band: "navigator", title: "作り手から探す", position: 2 }),
        band({ id: "first", band: "sister_sites", title: "姉妹サイト", position: 1 }),
      ],
      {
        network: [networkNode("sister", "姉妹")],
        tags: [tag({ slug: "acme", name: "アクメ" })],
      },
    );

    expect(html?.indexOf("姉妹サイト")).toBeLessThan(html?.indexOf("作り手から探す") ?? -1);
  });

  it("見出しを付けていない帯には、種類の名前を当てる", () => {
    // 見出しが空欄のまま無題の箱を並べると、読者は何の一覧か分からない。
    expect(
      render([band({ band: "sister_sites", title: "  " })], {
        network: [networkNode("sister", "姉妹")],
      }),
    ).toContain("姉妹サイトの帯");
  });

  it("見出しを付けた帯は、その言葉をそのまま出す", () => {
    expect(
      render([band({ band: "navigator", title: "編集部の作り手案内" })], {
        tags: [tag({ slug: "acme", name: "アクメ" })],
      }),
    ).toContain("編集部の作り手案内");
  });

  it("中身がまだ無い帯は、見出しを残して「これから出る」と言う", () => {
    /*
      ここで帯ごと消さないのは、**運営者が出すと決めた枠**だからである。
      黙って消えると、設定した側は保存が効いていないと受け取る。
    */
    const html = render([band({ band: "sister_sites" })], { network: [] });

    expect(html).toContain("姉妹サイトの帯");
    expect(html).toContain("まだ出せるものがありません");
  });
});

describe("正本と重複する旧帯は補助帯から外す", () => {
  it("latest_posts は canonical な記事区画が所有するため描かない", () => {
    const html = render([band({ band: "latest_posts" })], {
      articles: [
        article({ slug: "a", title: "要約あり" }),
        article({ slug: "b", title: "要約なし", summary: "" }),
      ],
    });

    expect(html).toBeNull();
  });

  it("category_hub は canonical なカテゴリー索引が所有するため描かない", () => {
    const html = render([band({ band: "category_hub" })]);

    expect(html).toBeNull();
  });
});

describe("後方互換で残す補助帯", () => {
  it("姉妹サイトの帯に、自分自身を並べない", () => {
    /*
      網の読み取りは「自分と自分の子」を返す。落とさないと、
      自分のトップに自分へのリンクが並ぶ。
    */
    const html = render([band({ band: "sister_sites" })], {
      network: [networkNode("test", "自分"), networkNode("sister", "姉妹")],
    });

    expect(html).toContain("姉妹");
    expect(html).not.toContain("自分");
  });

  it("ナビゲータの帯には、作り手のタグだけを出す", () => {
    /*
      この帯は読者に「これは商品の作り手だ」と言っている。
      話題のタグが混じると枠そのものが嘘になる。
    */
    const html = render([band({ band: "navigator" })], {
      tags: [
        tag({ slug: "acme", name: "アクメ" }),
        tag({ slug: "saving", name: "節約", kind: "topic" }),
      ],
    });

    expect(html).toContain("アクメ");
    expect(html).not.toContain("節約");
    expect(html).toContain("tag=acme");
  });

  it("件数の上限は保存された設定に従う", () => {
    // 画面に既定件数を書くと、管理画面で変えたのに変わらない帯になる。
    const html = render([band({ band: "sister_sites", itemLimit: 1 })], {
      network: [networkNode("first", "1件目"), networkNode("second", "2件目")],
    });

    expect(html).toContain("1件目");
    expect(html).not.toContain("2件目");
  });

  it("上限 0 は「置くが空」ではなく「1 件も出さない」", () => {
    const html = render([band({ band: "sister_sites", itemLimit: 0 })], {
      network: [networkNode("sister", "姉妹")],
    });

    expect(html).toContain("まだ出せるものがありません");
    expect(html).not.toContain('href="/s/sister"');
  });
});
