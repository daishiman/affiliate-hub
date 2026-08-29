/**
 * @tier 2
 * @req REQ-TM06
 * @types boundary
 *
 * 本文の脇の欄（§3.4）が、**置くものがあるときだけ出る**ことを見る。
 *
 * --- なぜこれが要るのか ---
 * 段組みは「枠組みの既定」ではなく「置くものがある」ことの結果である。
 * 空の脇を出すと、**画面は壊れて見えないまま本文だけが狭くなる。**
 * 誰も故障として報告しないので、気づかれずに残る種類の崩れになる。
 *
 * もう 1 つ、`<aside>` を**本文より後ろに書く**ことも見る。
 * 読み上げと Tab の順は書いた順で、見た目の左右は CSS が決める。
 * 前に書くと、記事へ着くまでに枠を全部通ることになる。
 * これはコードを見ても「意図」か「たまたま」か分からないので、ここで固定する。
 *
 * --- 見ていないもの ---
 * 枠の中身が何かは見ていない（それは `blogSidebar` と管理画面の担当）。
 * 実際の左右の並びも見ていない（jsdom は CSS を読まない）。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteShell, type SiteChrome } from "@/presentation/ui/templates/site-shell";

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

function shell(props: { sidebar?: React.ReactNode; sidebarSticky?: React.ReactNode }): string {
  return renderToStaticMarkup(
    <SiteShell chrome={chrome} currentPath="/s/quiet" {...props}>
      <p>本文</p>
    </SiteShell>,
  );
}

describe("本文の脇の欄は、置くものがあるときだけ出る", () => {
  it("読み取り側が、本当に `aside` を見分けている（対照）", () => {
    // 中身に「aside」という語が出ても、タグとしては数えないこと。
    const html = shell({ sidebar: <span>asideという語</span> });
    expect(html.match(/<aside\b/g)).toHaveLength(1);
  });

  it("何も渡さなければ、脇の欄は出ない", () => {
    const html = shell({});
    expect(html).not.toContain("<aside");
  });

  it("通常の枠を渡すと、名前の付いた脇の欄が出る", () => {
    const html = shell({ sidebar: <span>カテゴリー</span> });
    expect(html).toContain("<aside");
    // 名前の無い `aside` は読み上げの目印一覧に「補足」としか出ず、本文と行き来できない。
    expect(/<aside[^>]*aria-label="[^"]+"/.test(html)).toBe(true);
    expect(html).toContain("カテゴリー");
  });

  it("追従する枠だけでも、脇の欄は出る", () => {
    // 追従は「位置」の話なので、通常の枠が無くても単独で成り立つ。
    const html = shell({ sidebarSticky: <span>この記事の目次</span> });
    expect(html).toContain("<aside");
    expect(html).toContain("この記事の目次");
  });

  it("脇の欄は、本文より後ろに書かれている", () => {
    const html = shell({ sidebar: <span>カテゴリー</span> });
    const main = html.indexOf("<main");
    const aside = html.indexOf("<aside");
    expect(main).toBeGreaterThan(-1);
    expect(aside).toBeGreaterThan(main);
  });
});
