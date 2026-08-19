/** @tier 1 */
import { describe, expect, it } from "vitest";
import { capabilitiesOf } from "@/domain/identity";
import {
  ADMIN_NAV,
  ADMIN_NAV_GROUPS,
  UNGROUPED_NAV_HREFS,
  groupedNav,
} from "@/presentation/ui";

/**
 * 案内の分類を固定する。
 *
 * **分類表は `ADMIN_NAV` から作っていない。** だからこの検査が意味を持つ。
 * 分類表を `ADMIN_NAV` から導いていたら、項目が 1 つ消えたときに分類表も
 * 一緒に消え、検査は緑のまま「消えたこと」を言えない。
 * 2 つを別々に書いて突き合わせるから、片方だけが動いたときに赤くなる。
 */

function capsOfRole(role: Parameters<typeof capabilitiesOf>[0][number]): string[] {
  return [...capabilitiesOf([role])].map(String);
}

const groupedHrefs = ADMIN_NAV_GROUPS.flatMap((g) => [...g.hrefs]);

describe("案内の分類", () => {
  it("分類表と案内の項目が過不足なく一致する", () => {
    const inNav = [...ADMIN_NAV.map((i) => i.href)].sort();
    const inTable = [...groupedHrefs, ...UNGROUPED_NAV_HREFS].sort();
    // 案内から項目を 1 つ消すと、ここで分類表側にだけ残って赤くなる。
    expect(inTable).toStrictEqual(inNav);
  });

  it("1 項目は 1 分類にだけ属する", () => {
    const seen = new Set<string>();
    const twice: string[] = [];
    for (const href of [...groupedHrefs, ...UNGROUPED_NAV_HREFS]) {
      if (seen.has(href)) twice.push(href);
      seen.add(href);
    }
    expect(twice, `${twice.join(", ")} が 2 つ以上の分類に入っています`).toStrictEqual([]);
  });

  it("分類の名前と id が重複しない", () => {
    expect(new Set(ADMIN_NAV_GROUPS.map((g) => g.id)).size).toBe(ADMIN_NAV_GROUPS.length);
    expect(new Set(ADMIN_NAV_GROUPS.map((g) => g.label)).size).toBe(ADMIN_NAV_GROUPS.length);
  });

  it("分類の外に置く項目は 1 つだけ（例外を増やさない）", () => {
    // 例外が増えるほど「分類を見れば見当がつく」が崩れる。
    // 増やすときは、なぜ分類に入れられないかを書いてからここを直す。
    expect(UNGROUPED_NAV_HREFS).toStrictEqual(["/admin"]);
  });

  it("持ち主には全分類が出て、項目の総数が案内と一致する", () => {
    const nav = groupedNav(ADMIN_NAV, ADMIN_NAV_GROUPS, capsOfRole("owner"));
    expect(nav.groups).toHaveLength(ADMIN_NAV_GROUPS.length);
    const shown = nav.ungrouped.length + nav.groups.reduce((n, g) => n + g.items.length, 0);
    expect(shown).toBe(ADMIN_NAV.length);
  });

  it("分類を入れても、見える項目の集合は権限で絞る前と変わらない", () => {
    // 分類は並べ替えであって、行ける画面を増やしも減らしもしない。
    for (const role of ["owner", "writer", "analyst"] as const) {
      const caps = capsOfRole(role);
      const nav = groupedNav(ADMIN_NAV, ADMIN_NAV_GROUPS, caps);
      const shown = [
        ...nav.ungrouped.map((i) => i.href),
        ...nav.groups.flatMap((g) => g.items.map((i) => i.href)),
      ].sort();
      const held = new Set(caps);
      const expected = ADMIN_NAV.filter(
        (i) => i.requires === null || held.has(i.requires),
      )
        .map((i) => i.href)
        .sort();
      expect(shown, `${role} で見える項目が分類の前後で変わっています`).toStrictEqual(expected);
    }
  });

  it("項目が 1 つも残らない分類は、見出しごと消える", () => {
    // 見出しだけが残ると「ここに何かあるが自分には見えない」と伝わる。
    // 権限で隠すというのは存在を伏せることなので、空の見出しはそれを裏切る。
    const nav = groupedNav(ADMIN_NAV, ADMIN_NAV_GROUPS, []);
    expect(nav.groups).toStrictEqual([]);
    expect(nav.ungrouped.map((i) => i.href)).toStrictEqual(["/admin"]);
  });

  it("一部だけ見える分類は、見える項目だけを連れて残る", () => {
    const nav = groupedNav(
      ADMIN_NAV,
      [{ id: "mixed", label: "混在", hrefs: ["/admin/products", "/admin/analytics"] }],
      ["product.read"],
    );
    expect(nav.groups).toHaveLength(1);
    expect(nav.groups[0]?.items.map((i) => i.href)).toStrictEqual(["/admin/products"]);
  });

  it("分類表に無い項目は落とさず、分類の外へ回す", () => {
    // 黙って落とすと、案内から消えた画面が孤立ページになる。
    const nav = groupedNav(
      ADMIN_NAV,
      [{ id: "material", label: "素材", hrefs: ["/admin/products"] }],
      undefined,
    );
    const placed = [
      ...nav.ungrouped.map((i) => i.href),
      ...nav.groups.flatMap((g) => g.items.map((i) => i.href)),
    ];
    expect(placed).toHaveLength(ADMIN_NAV.length);
  });
});
