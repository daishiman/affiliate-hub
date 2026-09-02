/**
 * @tier 2
 * @req REQ-BLOG02, REQ-BOPS03
 * @types decision-table, screen-states
 *
 * 本文の脇に出る枠（§3.4）。
 *
 * この部品の要点は**既定の並びを持たないこと**である。管理画面
 * （`/admin/blog/layout`）が正本で、ここは保存された通りに描くだけ。
 * 既定を持たせると「管理画面で消したのに消えない枠」が生まれ、
 * 運営者は自分の操作が効いていないと受け取る。
 *
 * もう 1 つは**空の枠を作らないこと**。見出しだけの箱が残ると、
 * 読者には「壊れている」ように見え、運営者には「入れたのに出ない」に見える。
 * 判断は 2 段（枠ごとの `null` と、全部 `null` のときの段組みそのもの）ある。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BlogLayoutSlotRecord, BlogTagRecord } from "@/application/ports/blog-ops";
import { blogSidebar } from "@/presentation/site/blog-sidebar";
import type { PublicSiteProjection } from "@/presentation/site/public-site-projection";

function slot(over: Partial<BlogLayoutSlotRecord> = {}): BlogLayoutSlotRecord {
  return {
    id: `bls_${over.slotKey ?? "free"}`,
    siteSlug: "test",
    region: "sidebar",
    slotKey: "free-text",
    title: "おしらせ",
    body: "こんにちは。",
    position: 1,
    enabled: true,
    ...over,
  };
}

function tag(over: Partial<BlogTagRecord> = {}): BlogTagRecord {
  return {
    id: `btg_${over.slug ?? "x"}`,
    siteSlug: "test",
    slug: "x",
    name: "X",
    description: "",
    kind: "brand",
    ...over,
  };
}

/*
  この部品が読むのは `slots` と `tags` だけである。読み口や記事まで
  本物を組み立てると、検査しているのが「脇の枠」ではなく「模造の出来」になる。
*/
function projection(
  slots: readonly BlogLayoutSlotRecord[],
  tags: readonly BlogTagRecord[] = [],
): PublicSiteProjection {
  return { slots, tags } as unknown as PublicSiteProjection;
}

function render(
  slots: readonly BlogLayoutSlotRecord[],
  over: {
    readonly tags?: readonly BlogTagRecord[];
    readonly categories?: readonly { readonly slug: string; readonly name: string }[];
    readonly region?: "sidebar" | "sidebar_sticky";
  } = {},
): string | null {
  const node = blogSidebar({
    siteSlug: "test",
    region: over.region ?? "sidebar",
    projection: projection(slots, over.tags),
    categories: over.categories,
  });
  return node === null ? null : renderToStaticMarkup(node);
}

describe("どの枠をどの順で出すか", () => {
  it("保存された順に描き、既定の並びを持ち込まない", () => {
    const html = render([
      slot({ id: "b", slotKey: "free-text", title: "あとの枠", body: "後", position: 2 }),
      slot({ id: "a", slotKey: "free-text", title: "さきの枠", body: "先", position: 1 }),
    ]);

    expect(html).not.toBeNull();
    expect(html?.indexOf("さきの枠")).toBeLessThan(html?.indexOf("あとの枠") ?? -1);
  });

  it("管理画面で消した枠は出さない", () => {
    // ここを見落とすと、運営者は「消したのに消えない」を自分の操作ミスと受け取る。
    expect(render([slot({ enabled: false })])).toBeNull();
  });

  it("呼ぶ側が求めた側の枠だけを描く", () => {
    // 追従する枠とそうでない枠を混ぜると、本文の脇に同じ枠が二度出る。
    const slots = [
      slot({ id: "fixed", region: "sidebar", title: "ふつうの枠" }),
      slot({ id: "sticky", region: "sidebar_sticky", title: "追従する枠" }),
    ];

    expect(render(slots, { region: "sidebar" })).toContain("ふつうの枠");
    expect(render(slots, { region: "sidebar" })).not.toContain("追従する枠");
    expect(render(slots, { region: "sidebar_sticky" })).toContain("追従する枠");
  });
});

describe("出すものが無い枠は、見出しだけの箱にしない", () => {
  it("本文が空の枠は丸ごと出さない", () => {
    // 空なのは未実装ではなく未記入である。運営者が入れれば出る。
    expect(render([slot({ body: "   " })])).toBeNull();
  });

  it("カテゴリーが 1 つも無ければ、その枠を出さない", () => {
    expect(render([slot({ slotKey: "nested-category-list", body: "" })])).toBeNull();
  });

  it("ブランドが 1 つも無ければ、その枠を出さない", () => {
    const slots = [slot({ slotKey: "brand-tag-cloud", body: "" })];

    expect(render(slots, { tags: [] })).toBeNull();
    // 話題のタグしか無いときも同じ。枠の名前が「ブランド」と言っている以上、
    // 話題が混じると枠そのものが嘘になる。
    expect(render(slots, { tags: [tag({ kind: "topic", name: "節約" })] })).toBeNull();
  });

  it("中身が空の HTML の枠は出さない", () => {
    const slots = [slot({ slotKey: "custom-html-slot-upper", body: "  " })];

    expect(render(slots)).toBeNull();
  });

  it("出る枠が 1 つでもあれば、そこだけ描く", () => {
    /*
      全部 null のときに段組みを出さないのがこの部品の主題だが、
      **1 つでも中身があれば描く**ことも同時に要る。ここを取り違えると、
      枠を 1 つ空にしただけで脇が丸ごと消える。
    */
    const html = render([
      slot({ id: "empty", slotKey: "free-text", title: "空の枠", body: "" }),
      slot({ id: "filled", slotKey: "free-text", title: "中身のある枠", body: "本文", position: 2 }),
    ]);

    expect(html).toContain("中身のある枠");
    expect(html).not.toContain("空の枠");
  });
});

describe("いまのデータから作る枠", () => {
  it("探す枠は、いつでもサイトの検索へ導く", () => {
    // これだけは保存された本文を持たない。運営者が何も書かなくても出る。
    const html = render([slot({ slotKey: "site-search", body: "" })]);

    expect(html).toContain("言葉を入れて探す");
    expect(html).toContain("/search");
  });

  it("カテゴリーはそれぞれの一覧へ導く", () => {
    const html = render([slot({ slotKey: "nested-category-list", body: "" })], {
      categories: [{ slug: "chairs", name: "椅子" }],
    });

    expect(html).toContain("椅子");
    expect(html).toContain("/categories/chairs");
  });

  it("ブランドは、そのタグで絞った検索へ導く", () => {
    const html = render([slot({ slotKey: "brand-tag-cloud", body: "" })], {
      tags: [tag({ slug: "acme", name: "アクメ" }), tag({ slug: "topic", kind: "topic" })],
    });

    expect(html).toContain("アクメ");
    expect(html).toContain("tag=acme");
  });

  it("保存された HTML はそのまま描く", () => {
    /*
      削るのは**保存の直前**で済んでいる（`sanitizeSlotHtml`）。
      描く場所でもう一度削らないのは、描く場所が増えるたびに
      削り忘れが 1 か所ずつ増えるためである。
    */
    const html = render([
      slot({ slotKey: "custom-html-slot-lower", body: "<p>お知らせ</p>", region: "sidebar" }),
    ]);

    expect(html).toContain("<p>お知らせ</p>");
  });
});
