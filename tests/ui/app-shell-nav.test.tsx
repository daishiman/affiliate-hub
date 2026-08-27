/** @tier 2 @req REQ-S09, REQ-SEC08 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV,
  ADMIN_NAV_GROUPS,
  ADMIN_ROUTE_METADATA,
  resolveAdminRoute,
} from "@/presentation/ui";
import { AppShell } from "@/presentation/ui/templates/app-shell";

/**
 * 分類が読み上げにも届いていること。
 *
 * 見た目の隙間と小さい見出しだけで分けると、目で見る人にしか分類は伝わらない。
 * 読み上げでは 19 項目が切れ目なく続けて読まれ、分類を入れた意味が消える。
 * だから型ではなく、実際に出た印を見る。
 */

function markup(capabilities?: readonly string[]): string {
  return renderToStaticMarkup(
    <AppShell
      actualRoutePath="/admin"
      navContextPath="/admin"
      breadcrumbs={[{ label: "ホーム" }]}
      capabilities={capabilities}
    >
      <p>本文</p>
    </AppShell>,
  );
}

describe("案内の分類の読み上げ", () => {
  it("分類ごとに、まとまりの印と、それが指す見出しが出る", () => {
    const html = markup();
    for (const group of ADMIN_NAV_GROUPS) {
      expect(html, `${group.label} のまとまりの印が出ていません`).toContain(
        `aria-labelledby="nav-group-${group.id}"`,
      );
      expect(html, `${group.label} の見出しが出ていません`).toContain(`id="nav-group-${group.id}"`);
      expect(html).toContain(group.label);
    }
    expect((html.match(/role="group"/g) ?? []).length).toBe(ADMIN_NAV_GROUPS.length);
  });

  it("見出しは、押せるものではなく見出しとして出る", () => {
    // 分類名がリンクに見えると、行き先の無いものを押そうとしてしまう。
    const html = markup();
    for (const group of ADMIN_NAV_GROUPS) {
      expect(html).toContain(`<h2 id="nav-group-${group.id}"`);
    }
  });

  it("何も見えない人には、分類の見出しも 1 つも出ない", () => {
    // 見出しだけが残ると「ここに何かあるが自分には見えない」と伝わってしまう。
    const html = markup([]);
    expect(html).not.toContain("nav-group-");
    expect(html).not.toContain('role="group"');
  });
});

describe("管理画面route metadataの正本", () => {
  it("66画面・ナビ・分類は同じmetadataから派生する", () => {
    // 2026-08-27: 51 → 66。**両側が別々に画面を足していた。**dev が 50 → 51 へ、
    // こちらが blog 運用の 15 枚を足しており、どちらの枝も単独では自分の数を
    // 書いていた。片側の数をそのまま採ると、数え上げが実物とずれたまま緑になる。
    // 合流させた実物は `find src/app/admin -name page.tsx | wc -l` = 66 枚である。
    expect(ADMIN_ROUTE_METADATA).toHaveLength(66);

    const navRoutes = ADMIN_ROUTE_METADATA.filter((route) => route.nav !== null);
    expect(ADMIN_NAV.map((item) => item.href)).toEqual(navRoutes.map((route) => route.pattern));

    const groupedHrefs = ADMIN_NAV_GROUPS.flatMap((group) => group.hrefs);
    expect(groupedHrefs).toEqual(
      navRoutes.filter((route) => route.nav?.group !== null).map((route) => route.pattern),
    );
    expect(new Set(groupedHrefs).size).toBe(groupedHrefs.length);
  });

  it("動的routeの実URL、選択中ナビ、パンくずを別々に解決する", () => {
    const resolved = resolveAdminRoute("products/[product]/edit", {
      product: "p_alpha_15",
    });

    expect(resolved.actualRoutePath).toBe("/admin/products/p_alpha_15/edit");
    expect(resolved.navContextPath).toBe("/admin/products");
    expect(
      resolved.breadcrumbs("商品を編集", {
        "products/[product]": "Alpha Studio 15",
      }),
    ).toEqual([
      { label: "ホーム", href: "/admin" },
      { label: "商品", href: "/admin/products" },
      { label: "Alpha Studio 15", href: "/admin/products/p_alpha_15" },
      { label: "編集" },
    ]);
  });
});

/**
 * 分類の境目（2026-08-19、利用者の「各分類ごとに横線を引いて区切りが分かるように」）。
 *
 * **線は罫線で描き、要素を足さない。** 足すと読み上げに「区切り」が 5 回挟まり、
 * まとまりを伝えている見出しと二重になる。見えるものを増やすために
 * 聞こえるものまで増やさない、という分け方をここで固定する。
 */
describe("分類の境目", () => {
  it("分類は 6 つ、境目は 5 つ（外側には付かない）", () => {
    // 線の本数そのものは CSS の `+` が決めるので数えられない。
    // 数えられるのは**間の数**で、それが 5 であることは分類の数で決まる。
    // 分類が増減したらここが赤くなり、線の本数の話に戻れる。
    expect(ADMIN_NAV_GROUPS).toHaveLength(6);
    expect(ADMIN_NAV_GROUPS.length - 1).toBe(5);
  });

  it("見出しは分類の数だけ出る（線だけで済ませていない）", () => {
    // 線だけを引くと、まとまりはあるのに**それが何のまとまりかが言葉にならない**。
    const html = markup();
    expect((html.match(/<h2 id="nav-group-/g) ?? []).length).toBe(ADMIN_NAV_GROUPS.length);
  });

  it("境目のために要素を足していない（読み上げに区切りが増えない）", () => {
    const html = markup();
    const sidebar = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
    expect(sidebar).not.toContain("<hr");
    expect(sidebar).not.toContain('role="separator"');
    // **`aria-hidden` そのものは禁じない。**
    //
    // 以前はここで `aria-hidden` を 1 つも許さなかった。境目を罫線で描いていれば
    // 飾りの要素を足す必要が無く、足していないなら隠す必要も無いからである。
    // その後 A9 で項目に目印の絵が付き、絵は意味を持たない（意味は隣の文字が持つ）
    // ので `aria-hidden` で隠すのが正しくなった。**禁じたままだと、正しい書き方が
    // 赤くなる。**
    //
    // 見たいのは「境目のために要素を足していないか」なので、数えるのは
    // **中身が空の隠し要素**だけにする。罫線の代わりに置いた飾りは中身が空になり、
    // 絵や文字を持つ隠し要素は空にならない。
    const emptyDecoration = sidebar.match(/<[a-z]+ [^>]*aria-hidden="true"[^>]*>\s*<\//g) ?? [];
    expect(
      emptyDecoration,
      `境目のための飾りが足されています: ${emptyDecoration.join(", ")}`,
    ).toEqual([]);
  });
});
