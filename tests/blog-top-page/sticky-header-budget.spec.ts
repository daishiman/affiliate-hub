/** @tier 2 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE } from "../ui/route-cases";
import { renderCase } from "../ui/route-table";
import { intoDom } from "../support/render";

/**
 * 追従ヘッダーの「予算」を見る。
 *
 * ==========================================================================
 * なぜ 3 機能に絞るのか
 * ==========================================================================
 *
 * 常に画面へ留まる部品は、**留まることで隠している面積の対価**を払う必要がある。
 * 参考にした外部サイトはヘッダーへ 6 つ（ロゴ・キャッチコピー・ナビ・検索・
 * メニュー・SNS 列）を並べているが、観測した事実をそのまま実装契約に読み替えない。
 * ここが持つのは **ブログ名 / 検索の起動 / カテゴリーへの移動** の 3 つだけで、
 * キャッチコピーと SNS 列はフッターと本文の流れへ置く。
 *
 * ==========================================================================
 * 小画面で畳むとき、高さで畳まないこと
 * ==========================================================================
 *
 * `site.module.css` には「`max-block-size: 12dvh` + `overflow: hidden` は
 * 潰れたことを隠しただけで、E2E の重なり検査 77 件で初めて露見した」という記録がある。
 * 高さの上限で畳むと、**畳めていないのに畳めたように見える**。
 * だからここは `details` の開閉で畳み、高さの上限を持たないことを検査する。
 */

const CSS_PATH = "src/presentation/ui/templates/site.module.css";
const CSS = readFileSync(join(process.cwd(), CSS_PATH), "utf8");

/** ある class 名の規則の中身を、`@media` の中も含めて全部つなげて返す。 */
function declarationsOf(css: string, className: string): string {
  let body = "";
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = rule[1].split(",").map((s) => s.trim());
    if (selectors.some((s) => new RegExp(`\\.${className}(?![a-zA-Z0-9_-])`).test(s))) {
      body += rule[2];
    }
  }
  return body;
}

async function homeDom() {
  return intoDom(await renderCase({ file: "s/[site]/page.tsx", params: { site: SITE } }));
}

describe("追従ヘッダーの予算", () => {
  it("ヘッダーは、留まるための宣言を実際に持っている", () => {
    const header = declarationsOf(CSS, "siteHeader");
    expect(header, "ヘッダーの規則が読めていません").not.toBe("");
    expect(header, "スクロールしても留まる宣言がありません").toMatch(/position:\s*sticky/);
    expect(header, "留まる位置の指定がありません").toMatch(/inset-block-start:\s*0/);
  });

  it("留まるヘッダーが、飛んだ先の見出しを自分で隠さない", () => {
    // `#home-articles` へ飛ぶと、着地点がヘッダーの下へ潜る。
    // その分だけ手前で止める宣言が無いと、押した人は「何も起きなかった」と読む。
    expect(CSS, "アンカーの着地点がヘッダーに隠れます").toMatch(/scroll-margin-top:\s*var\(/);
  });

  it("小画面の畳みを、高さの上限で作っていない", () => {
    const header = declarationsOf(CSS, "siteHeader");
    const nav = declarationsOf(CSS, "siteNav");
    // 高さで畳むと「潰れた」を「畳んだ」と見誤る。過去に実際そうなった。
    for (const [name, body] of [
      ["siteHeader", header],
      ["siteNav", nav],
    ] as const) {
      expect(body, `${name} が高さの上限で畳んでいます`).not.toMatch(
        /max-(?:height|block-size):\s*\d/,
      );
    }
  });

  it("ヘッダーが持つのは、ブログ名・検索・カテゴリーへの移動の 3 つだけである", async () => {
    const { document, cleanup } = await homeDom();
    const header = document.querySelector("header");
    const texts = [...(header?.querySelectorAll("a[href], button, summary") ?? [])].map((el) =>
      (el.textContent ?? "").trim(),
    );
    const hasSearch = header?.querySelector('input[type="search"], input[name="q"]') !== null;
    cleanup();

    expect(header, "ヘッダーがありません").not.toBeNull();
    expect(hasSearch, "ヘッダーから検索を起こせません").toBe(true);
    // キャッチコピーと SNS 列はヘッダーに置かない。留まる価値が面積に見合わない。
    const banned = texts.filter((t) => /X\b|Twitter|Instagram|YouTube|note/.test(t));
    expect(banned, `ヘッダーに SNS 列が入っています: ${banned.join(", ")}`).toEqual([]);
  });

  it("ヘッダーにブログ名とカテゴリーへの入口が在り、説明文は入っていない", async () => {
    const { document, cleanup } = await homeDom();
    const header = document.querySelector("header");
    const headerText = (header?.textContent ?? "").trim();
    const home = header?.querySelector(`a[href="/s/${SITE}"], a[href="/s/${SITE}/"]`) ?? null;
    const categories = header?.querySelector("nav a[href], summary") ?? null;
    cleanup();

    expect(home, "ヘッダーからブログの入口へ戻れません").not.toBeNull();
    expect(categories, "ヘッダーからカテゴリーへ移動できません").not.toBeNull();
    // ヘッダーの文字は「ブログ名 + 操作の名前」に収まる。
    // 説明文（キャッチコピー）が入ると、留まり続ける面積の対価に見合わなくなる。
    expect(
      headerText.length,
      `ヘッダーの文字が多すぎます（${headerText.length} 字）: ${headerText.slice(0, 80)}`,
    ).toBeLessThan(120);
  });
});
