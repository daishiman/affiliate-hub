/** @tier 2 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV_GROUPS } from "@/presentation/ui";
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
    <AppShell currentPath="/admin" breadcrumbs={[{ label: "ホーム" }]} capabilities={capabilities}>
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
    // 飾りを `aria-hidden` で隠すのは、そもそも飾りの要素を足したときの後始末である。
    // 罫線で描いていれば足す必要が無い。
    expect(sidebar).not.toContain("aria-hidden");
  });
});
