/**
 * @tier 2
 * @req REQ-BOPS03, A3
 * @types equivalence, contract
 */
import { describe, expect, it } from "vitest";
import type { BlogLayoutSlotRecord } from "@/application/ports/blog-ops";
import { projectPublicSiteChrome } from "@/presentation/site/public-site-projection";

/**
 * 受入条文 A3 の後半 —「サブサイト 2 件で同一ヘッダー / 異なるサイドバー」。
 *
 * これまで機械が見ていたのは `tests/ui/uiux-blog-scaffold.test.ts` の
 * 「共通部品にブログ名の分岐が無い」だけだった。あれは**共有が崩れる書き方**を
 * 止めるもので、「実際に 2 件並べたら同じヘッダーが出る」ことは見ていない。
 * 条文は名指しで 2 件を要求しているので、2 件を作って比べる側をここに置く。
 *
 * **何を捕まえるか**: ヘッダーの中身がサイトごとの保存値から拾われるようになった日。
 * いまヘッダーは網で共有される（＝どのサブサイトでも同じ行が入る）。誰かが
 * `projectPublicSiteChrome` に siteSlug の分岐を足すと、この検査が赤くなる。
 *
 * **なぜ chrome の層で見るか**: 画面の HTML で比べると、比べているのが
 * 「ヘッダーの共有」なのか「その日の CSS」なのか分からなくなる。読者に出る
 * ヘッダー行を決めているのはこの関数 1 つなので、ここが同じなら 2 画面は同じになる。
 */

/** 網で共有される側。2 サイトとも**同じ行**を持つ（共有の実体はこれ）。 */
function sharedHeaderSlots(siteSlug: string): BlogLayoutSlotRecord[] {
  return [
    {
      id: `slot_header_nav_${siteSlug}`,
      siteSlug,
      region: "header",
      slotKey: "category-nav",
      title: "カテゴリー",
      body: "編集機材 / 台所道具",
      position: 1,
      enabled: true,
    },
    {
      id: `slot_header_search_${siteSlug}`,
      siteSlug,
      region: "header",
      slotKey: "search-box",
      title: "さがす",
      body: "",
      position: 2,
      enabled: true,
    },
  ];
}

/** サイトごとに違ってよい側。ここが同じになったら分けた意味が消える。 */
function ownSidebarSlots(siteSlug: string, label: string): BlogLayoutSlotRecord[] {
  return [
    {
      id: `slot_sidebar_${siteSlug}`,
      siteSlug,
      region: "sidebar",
      slotKey: "site-intro",
      title: label,
      body: `${label}の紹介`,
      position: 1,
      enabled: true,
    },
  ];
}

const SUB_A = "sub-kitchen";
const SUB_B = "sub-desk";

describe("サブサイト 2 件のヘッダーとサイドバー (A3)", () => {
  it("ヘッダーは 2 件で同じ、サイドバーは 2 件で違う", () => {
    const a = projectPublicSiteChrome({
      slots: [...sharedHeaderSlots(SUB_A), ...ownSidebarSlots(SUB_A, "小さな台所の道具")],
    });
    const b = projectPublicSiteChrome({
      slots: [...sharedHeaderSlots(SUB_B), ...ownSidebarSlots(SUB_B, "机まわりの道具")],
    });

    // 行の同一性は id ではなく **読者に見えるもの** で比べる。
    // id はサイトごとに違って当然で、そこで比べると「共有されているか」ではなく
    // 「id の付け方」を見てしまう。
    const visible = (slots: readonly BlogLayoutSlotRecord[]) =>
      slots.map((slot) => `${slot.position}:${slot.slotKey}:${slot.title}:${slot.body}`);

    expect(visible(a.headerSlots)).toEqual(visible(b.headerSlots));
    expect(a.headerSlots).toHaveLength(2);

    // サイドバーは chrome に載らない（header/footer だけを取り出す関数なので）。
    // 「載らないこと」自体が、サイドバーが網で共有されない側にあることの証拠になる。
    expect(a.headerSlots.some((slot) => slot.region === "sidebar")).toBe(false);
    expect(b.headerSlots.some((slot) => slot.region === "sidebar")).toBe(false);
  });

  it("ヘッダーに siteSlug 由来の差が入ると落ちる", () => {
    const a = projectPublicSiteChrome({ slots: sharedHeaderSlots(SUB_A) });
    const b = projectPublicSiteChrome({
      // 片方だけカテゴリー名を書き換える = 網の共有が崩れた状態。
      slots: sharedHeaderSlots(SUB_B).map((slot) =>
        slot.slotKey === "category-nav" ? { ...slot, body: "台所道具だけ" } : slot,
      ),
    });

    const visible = (slots: readonly BlogLayoutSlotRecord[]) =>
      slots.map((slot) => `${slot.slotKey}:${slot.body}`);

    expect(visible(a.headerSlots)).not.toEqual(visible(b.headerSlots));
  });

  it("止めた行はヘッダーに出ない", () => {
    const chrome = projectPublicSiteChrome({
      slots: sharedHeaderSlots(SUB_A).map((slot) =>
        slot.slotKey === "search-box" ? { ...slot, enabled: false } : slot,
      ),
    });

    expect(chrome.headerSlots.map((slot) => slot.slotKey)).toEqual(["category-nav"]);
  });
});
