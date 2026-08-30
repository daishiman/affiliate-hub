/**
 * @tier 2
 * @req REQ-TH03, REQ-TH04
 *
 * 入口ページ（`PublicShell`）に**ブランド配色を当てないのが意図である**ことを、
 * 機械で読める形にしておく。
 *
 * --- なぜこれが要るのか ---
 * `SiteShell` は根に `data-brand-theme` を置くが、`PublicShell` は置かない。
 * コードだけを見ると、この差は「意図」なのか「付け忘れ」なのか判別できない。
 * 判別できないと、次に誰かが「揃っていないから揃えよう」と思って
 * `PublicShell` にも配色を当ててしまう。ログイン前は「どのブログでもない」ので、
 * 特定のブログの配色が出るのは誤りである。
 * ここは、その差が**意図的に保たれていること**を見る。
 *
 * --- 明暗（`data-color-mode`）について ---
 * 配色を当てないからといって、**明暗まで落ちてはいけない。**
 * 暗い場所で読む人に、ログイン前だけ眩しい画面を出すことになる。
 * 明暗は枠ではなく `src/app/layout.tsx` が `<html>` に当てており、
 * 属性セレクタで宣言されたトークンは子孫へ継承されるので、
 * `PublicShell` の中にもそのまま効く。**枠が明暗を持たないのが正しい姿**であり、
 * ここではその「持たない」ことと、代わりに当てている場所が生きていることを見る。
 *
 * --- 見ていないもの ---
 * 実際に色が変わることは見ていない（jsdom は CSS ファイルを読まない）。
 * 見ているのは属性の有無と、当てている 1 箇所の存在まで。
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APPEARANCE_ATTR, appearanceAttributes } from "@/presentation/ui/appearance";
import { PublicShell, SiteShell, type SiteChrome } from "@/presentation/ui/templates/site-shell";

const ROOT = resolve(import.meta.dirname, "../..");

const chrome: SiteChrome = {
  siteName: "静かな家電の話",
  tagline: "音の小さい家電だけを比べる",
  brandTheme: "teal-clay",
  nav: [{ href: "/s/quiet", label: "記事" }],
  categoryNav: [{ href: "/s/quiet/categories/kitchen", label: "台所" }],
  homeHref: "/s/quiet",
  searchHref: "/s/quiet/search",
  aboutHref: "/s/quiet/editorial-policy",
  footer: [{ href: "/s/quiet/policy", label: "方針" }],
};

/** 描画結果の**根の開始タグ**だけを取り出す。中身のリンクに惑わされないため。 */
function rootTag(html: string): string {
  const m = /^<[^>]*>/.exec(html);
  expect(m, "描画結果の根を読めていません").not.toBeNull();
  return m?.[0] ?? "";
}

describe("入口ページの見た目（UX-05）", () => {
  it("読み取り側が、本当に属性を見分けている（対照）", () => {
    // 根のタグだけを見ていること。`SiteShell` の中身にも属性は現れうる。
    expect(rootTag('<div class="a" data-x="1"><span data-y="2"></span></div>')).toBe(
      '<div class="a" data-x="1">',
    );
    // 属性名の正本が、いま見ている名前と同じであること。
    expect(APPEARANCE_ATTR.scheme).toBe("data-brand-theme");
    expect(APPEARANCE_ATTR.mode).toBe("data-color-mode");
  });

  it("ブログの枠は、ブログの配色を当てる", () => {
    // **空振り防止。**下の「入口には無い」だけだと、
    // 属性の付け方そのものが壊れても（＝どこにも付かなくても）緑になる。
    const tag = rootTag(
      renderToStaticMarkup(
        <SiteShell chrome={chrome} currentPath="/s/quiet">
          <p>本文</p>
        </SiteShell>,
      ),
    );
    expect(tag).toContain(`${APPEARANCE_ATTR.scheme}="teal-clay"`);
  });

  it("入口ページの枠は、ブランド配色を当てない（意図であって付け忘れではない）", () => {
    const tag = rootTag(renderToStaticMarkup(<PublicShell title="affiliate-hub">中身</PublicShell>));
    expect(
      tag.includes(APPEARANCE_ATTR.scheme),
      `入口ページにブランド配色が当たっています: ${tag}\n` +
        "ログイン前は「どのブログでもない」ので、特定のブログの配色を当てないのが意図です。" +
        "揃えたくなったら、まず site-shell.tsx の PublicShell の説明を読んでください。",
    ).toBe(false);
  });

  it("入口ページの枠は、ブランド配色を受け取る口も持たない", () => {
    // 属性を出さないだけだと、`chrome` を受け取る形に戻したときに気づけない。
    // 「渡せない」ことまでを形で保つ。
    // @ts-expect-error PublicShell は chrome を受け取らない
    const el = <PublicShell title="x" chrome={chrome}>中身</PublicShell>;
    expect(el).toBeTruthy();
  });

  it("どちらの枠も明暗を持たない。明暗は一番外側（layout）が当てる", () => {
    const publicTag = rootTag(
      renderToStaticMarkup(<PublicShell title="affiliate-hub">中身</PublicShell>),
    );
    const siteTag = rootTag(
      renderToStaticMarkup(
        <SiteShell chrome={chrome} currentPath="/s/quiet">
          <p>本文</p>
        </SiteShell>,
      ),
    );
    // 枠が明暗を持ち始めたら、持っていない側の画面だけ選択が効かなくなる。
    expect(publicTag).not.toContain(APPEARANCE_ATTR.mode);
    expect(siteTag).not.toContain(APPEARANCE_ATTR.mode);

    // 代わりに当てている 1 箇所が生きていること。ここが消えると、
    // 枠が持たない作りのままなので、**明暗がどこにも当たらなくなる**。
    const layout = readFileSync(join(ROOT, "src/app/layout.tsx"), "utf8");
    expect(layout.length, "layout.tsx を読めていません").toBeGreaterThan(500);
    expect(layout).toMatch(/<html[\s\S]*?\{\.\.\.appearanceAttributes\(/);

    // 当てる中身に明暗が入ること（`auto` は「端末に従う」ので出さないのが正しい）。
    expect(appearanceAttributes({ brandTheme: "blue", colorMode: "dark" })).toHaveProperty(
      APPEARANCE_ATTR.mode,
      "dark",
    );
    expect(appearanceAttributes({ brandTheme: "blue", colorMode: "auto" })).not.toHaveProperty(
      APPEARANCE_ATTR.mode,
    );
  });
});
