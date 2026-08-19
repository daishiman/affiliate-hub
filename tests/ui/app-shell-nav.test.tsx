/** @tier 2 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV_GROUPS } from "@/presentation/ui";
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
    <AppShell currentPath="/admin" breadcrumbs={[{ label: "ホーム" }]} capabilities={capabilities}>
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
