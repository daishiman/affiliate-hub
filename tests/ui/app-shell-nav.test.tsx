/** @tier 2 @req REQ-S09, REQ-SEC08 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV,
  ADMIN_NAV_GROUPS,
  ADMIN_ROUTE_METADATA,
  resolveAdminRoute,
} from "@/presentation/ui";
import { AppShell, Page } from "@/presentation/ui/templates/app-shell";

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

describe("全管理画面の共通骨格", () => {
  it("ブランドから運営ホームへ戻れ、本文へ直接移動できる", () => {
    const html = markup();

    expect(html).toContain('href="/admin"');
    expect(html).toContain("ブログ運営メニュー");
    expect(html).toContain('href="#admin-main-content"');
    expect(html).toContain('id="admin-main-content"');
  });

  it("一覧・作成・編集が同じ運営画面の見出し順を使う", () => {
    const html = renderToStaticMarkup(
      <Page title="記事を編集" lead="内容を確かめ、公開中の記事を更新します。">
        <p>編集フォーム</p>
      </Page>,
    );

    expect(html.indexOf("運営画面")).toBeLessThan(html.indexOf("記事を編集"));
    expect(html.indexOf("記事を編集")).toBeLessThan(
      html.indexOf("内容を確かめ、公開中の記事を更新します。"),
    );
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
  });
});

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
  it("全管理画面・ナビ・分類は同じmetadataから派生する", () => {
    // 2026-08-27: 51 → 84。**両側が別々に画面を足していた。**dev が blog 運用の
    // 15 枚を、こちらが書き手・企画・順位・根拠・設定の 18 枚を足しており、
    // どちらの枝も単独では自分の数（66 と 69）を書いていた。
    // **片側の数をそのまま採ると、数え上げが実物とずれたまま緑になる。**
    // 2026-08-30: 84 → 86。統合で `content/published` と、その
    // `[site]/[slug]/edit` の 2 枚が加わった。数は手で決めず、
    // `find src/app/admin -name page.tsx | wc -l` で数え直すこと。
    // 2026-08-30: 86 → 88。ブログの「見せ方と配色」と「成果リンクの掲載」を足した。
    // 2026-09-04: 88 → 93。ブログ運営コンソールの 5 枚（住所・読者の行動・
    // 記事ごとの成果・SEO 診断・AEO）を足した。いずれもブログ詳細の子で、
    // ナビには出さない（入口はブログ詳細の中に置く）。
    // 2026-09-08: 93 → 99。書き手・読者像・書き方の決めごとを site 配下へ移し
    // （5 枚）、全ブログ共通の雛形（`writing/template`）を 1 枚足した。
    // 旧 5 枚は転送の殻として残っているので、差は +6 になる。
    // 2026-09-09: 99 → 100。dev との合流。**また両側が別々に足していた。**
    // dev が上の +6、こちらが「検索とAIからの見え方」の +1。片側の数を採ると
    // 実物とずれたまま緑になるので、`ADMIN_ROUTE_METADATA.length` を実測して
    // 100 と確かめた（93 + 6 + 1 と一致する）。
    expect(ADMIN_ROUTE_METADATA).toHaveLength(100);

    const navRoutes = ADMIN_ROUTE_METADATA.filter((route) => route.nav !== null);
    expect(ADMIN_NAV.map((item) => item.href)).toEqual(navRoutes.map((route) => route.pattern));

    const groupedHrefs = ADMIN_NAV_GROUPS.flatMap((group) => group.hrefs);
    /*
      **並び順ではなく顔ぶれを見る。**
      2026-09-08 に一段目を作業の対象物 5 つへ畳んだ (A5)。分類は表の順ではなく
      業務の順で並ぶので、表の並びと畳んだ後の並びは一致しない。
      ここで見たいのは「分類を持つ入口が、過不足なく分類のどれかに入っている」
      ことなので、集合として比べる。順序は分類表が別に決めている事実である。
    */
    expect([...groupedHrefs].sort()).toEqual(
      navRoutes
        .filter((route) => route.nav?.group !== null)
        .map((route) => route.pattern)
        .sort(),
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
  it("分類は 5 つ、境目は 4 つ（外側には付かない）", () => {
    // 線の本数そのものは CSS の `+` が決めるので数えられない。
    // 数えられるのは**間の数**で、それが 5 であることは分類の数で決まる。
    // 分類が増減したらここが赤くなり、線の本数の話に戻れる。
    // 2026-09-08: 6 → 5。一段目を「作業の対象物」まで畳んだ（A5）。
    // ブログ・記事・読者・商品・配信の 5 つで、設定などの補助口は分類の外に置く。
    expect(ADMIN_NAV_GROUPS).toHaveLength(5);
    expect(ADMIN_NAV_GROUPS.length - 1).toBe(4);
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
