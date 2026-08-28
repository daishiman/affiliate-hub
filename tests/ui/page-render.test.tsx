/**
 * @tier 2
 * @req REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-P05
 * @req REQ-P06, REQ-P07, REQ-P08, REQ-P09, REQ-P10
 * @req REQ-TH01, REQ-SEC08, REQ-TS05
 * @req REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06
 * @req REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B12
 * @req REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18
 * @req REQ-S01, REQ-S02, REQ-S03, REQ-S04, REQ-S05
 * @req REQ-S06, REQ-S07, REQ-S08, REQ-S09, REQ-S10
 * @req REQ-FB07
 * @req REQ-IM09
 * @req REQ-TM02, REQ-TM03, REQ-TM05, REQ-TM06, REQ-TM10
 * @types screen-states, a11y
 */
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleList } from "@/presentation/ui/templates/article-view";
import {
  CategoryArticleGroups,
  PublicShell,
  SiteSection,
} from "@/presentation/ui/templates/site-shell";
import { ROUTE_CASES, ROUTE_STATE_CASES, importPathOf, propsOf } from "./route-table";
import { headingLevels, intoDom, renderRoute } from "../support/render";
import { describeViolations, findA11yViolations } from "../support/a11y";

/**
 * 画面を全部描く。
 *
 * これを 1 枚ずつ手で書かないのは、書いた瞬間から
 * 「画面を足す作業」と「テストを足す作業」が別々になり、後者だけが忘れられるため。
 * 経路の表から総当たりにすると、**画面を足した時点で自動的に検査対象に入る**。
 *
 * 確かめるのは 3 つだけにしてある。
 * 文言そのものをここで固定すると、言い回しを直すたびに落ちるテストが 50 本増え、
 * やがて「文言を直したくないからテストを消す」に行き着く。
 *
 * --- 要件名が多い理由 ---
 * `route-table.ts` の表から総当たりにしているので、**読者側 20 本と運営側 33 本が
 * 全部ここで描かれている**。REQ-B01〜B18（読者側の各ページ）と REQ-S01〜S10
 * （§22 の画面仕様）は、その表の行として実際に描かれているぶんだけ名乗っている。
 * 画面を表から外せば、ここも一緒に落ちる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-4 / docs/product/coverage.md §2-3
 */

const APP_DIR = join(process.cwd(), "src/app");

function pageFilesOnDisk(): readonly string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx") found.push(relative(APP_DIR, full));
    }
  };
  walk(APP_DIR);
  return found.sort();
}

/**
 * 見出しの作りを見る。
 *
 * h1 は「この画面は何か」を表す唯一の宣言で、目で見る人には
 * 大きい文字としてしか映らないが、読み上げでは現在地そのものになる。
 * 飛び級（h2 の次が h4）も同じで、**目では絶対に気づけない**。
 */
function expectHeadingStructure(html: string): void {
  const { document, cleanup } = intoDom(html);
  try {
    const levels = headingLevels(document);
    expect(
      levels.filter((l) => l === 1),
      "h1 はこの画面が何の画面かを表す。0 個でも 2 個でも読み上げが迷子になる",
    ).toHaveLength(1);
    let previous = 0;
    for (const level of levels) {
      if (previous !== 0) {
        expect(level, `見出しの階層が飛んでいます: ${levels.join(" → ")}`).toBeLessThanOrEqual(
          previous + 1,
        );
      }
      previous = level;
    }
  } finally {
    cleanup();
  }
}

describe("公開画面へ共通で波及する読み順", () => {
  it("ブログ一覧とログインはヘッダー・案内・本文・フッターを同じ順で持つ", () => {
    const html = renderToStaticMarkup(
      <PublicShell title="affiliate-hub">
        <h1>ブログ一覧</h1>
      </PublicShell>,
    );

    const positions = ["<header", "サイトの案内", 'id="public-main-content"', "<footer"].map(
      (text) => html.indexOf(text),
    );
    expect(positions.every((position) => position >= 0)).toBe(true);
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index - 1]).toBeLessThan(positions[index]);
    }
    expect(html).toContain('href="#public-main-content"');
  });

  it("ホームは新着のあとにカテゴリー別の実記事と全件導線を並べる", () => {
    const html = renderToStaticMarkup(
      <>
        <SiteSection
          id="recent-articles"
          eyebrow="新着"
          title="新着記事"
          lead="更新順に紹介します。"
        >
          <ArticleList
            articles={[
              {
                slug: "recent-pc",
                href: "/s/demo/guides/recent-pc",
                title: "最近のパソコン記事",
                summary: "新しい記事です。",
                updatedAt: "2026-08-28",
                authorName: "山田",
              },
            ]}
            emptyTitle=""
            emptyBody=""
            headingLevel="h3"
          />
        </SiteSection>
        <SiteSection
          id="category-articles"
          eyebrow="カテゴリー"
          title="テーマから探す"
          lead="テーマごとの代表記事です。"
        >
          <CategoryArticleGroups
            groups={[
              {
                href: "/s/demo/categories/pc",
                label: "パソコン",
                description: "選び方と使い方",
                articles: [
                  {
                    slug: "quiet-pc",
                    href: "/s/demo/guides/quiet-pc",
                    title: "静かなパソコンの選び方",
                    summary: "音の見方を紹介します。",
                    updatedAt: "2026-08-20",
                    authorName: "山田",
                  },
                ],
              },
            ]}
          />
        </SiteSection>
      </>,
    );

    expect(html.indexOf("新着記事")).toBeLessThan(html.indexOf("テーマから探す"));
    expect(html.indexOf("パソコン")).toBeLessThan(html.indexOf("静かなパソコンの選び方"));
    expect(html).toContain("このカテゴリーをすべて見る");
    expect(html).toContain('<h2 id="recent-articles"');
    expect(html).toMatch(/<h3[^>]*><a[^>]*>最近のパソコン記事<\/a><\/h3>/);
    expect(html).toMatch(/<h4[^>]*><a[^>]*>静かなパソコンの選び方<\/a><\/h4>/);
  });

  it("代表記事が無いカテゴリーも索引から消さない", () => {
    const html = renderToStaticMarkup(
      <CategoryArticleGroups
        groups={[
          {
            href: "/s/demo/categories/audio",
            label: "オーディオ",
            description: "音を楽しむ道具",
            articles: [],
          },
        ]}
      />,
    );

    expect(html).toContain("オーディオ");
    expect(html).toContain("カテゴリーの案内を見る");
    expect(html).toContain('href="/s/demo/categories/audio"');
  });
});

describe("画面の一覧", () => {
  it("経路の表と実在するファイルが 1 対 1 で対応する", () => {
    // **母集団の床**（残課題 78 ㉗）。両側とも空なら「1 対 1」は自明に成り立つ。
    expect(pageFilesOnDisk().length, "画面のファイルを歩けていません").toBeGreaterThan(20);
    expect(ROUTE_CASES.length, "経路の表が空です").toBeGreaterThan(20);
    // 片方向（表 → ファイル）だけだと、新しい画面を足しても気づけない。
    // **足りない側と余っている側の両方**を出す。
    const onDisk = pageFilesOnDisk();
    const inTable = ROUTE_CASES.map((r) => r.file).sort();

    const missing = onDisk.filter((f) => !inTable.includes(f));
    const extra = inTable.filter((f) => !onDisk.includes(f));

    expect(
      missing,
      `画面はあるのに表に無いものがあります。tests/ui/route-table.ts に追加してください:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
    expect(
      extra,
      `表にあるのに画面が無いものがあります（消したか、経路を変えたはず）:\n  ${extra.join("\n  ")}`,
    ).toEqual([]);
  });

  it("同じ画面を二重に登録していない", () => {
    const files = ROUTE_CASES.map((r) => r.file);
    expect([...new Set(files)]).toHaveLength(files.length);
  });
});

describe.each(ROUTE_CASES.map((r) => [r.file, r] as const))("%s", (_file, route) => {
  it("描ける", async () => {
    const html = await renderRoute(importPathOf(route.file), propsOf(route));
    // 「例外にならない」だけでは、中身が空でも通る。
    // 画面として成立する最低限の分量が出ていることまで見る。
    expect(html.length).toBeGreaterThan(200);
  });

  it("見出しが 1 つの h1 から始まり、階層を飛ばさない", async () => {
    expectHeadingStructure(await renderRoute(importPathOf(route.file), propsOf(route)));
  });

  it("読み上げと操作の自動検査に違反がない", async () => {
    const html = await renderRoute(importPathOf(route.file), propsOf(route));
    const violations = await findA11yViolations(html);
    expect(violations, describeViolations(violations)).toEqual([]);
  });
});

describe.each(ROUTE_STATE_CASES.map((r) => [`${r.file} — ${r.state}`, r] as const))(
  "%s",
  (_label, route) => {
    it("落ちずに何かを表示する", async () => {
      // 空・見つからない・絞り込み後といった状態は、実際に最も多く見られる状態でありながら
      // 手で開かれる回数が最も少ない。ここが白紙のまま公開される事故を止める。
      const html = await renderRoute(importPathOf(route.file), propsOf(route));
      expect(html.length).toBeGreaterThan(200);
      // 例外の状態でも見出しは要る。見出しの無い画面は行き止まりになりやすい。
      expectHeadingStructure(html);
    });

    it("読み上げと操作の自動検査に違反がない", async () => {
      const html = await renderRoute(importPathOf(route.file), propsOf(route));
      const violations = await findA11yViolations(html);
      expect(violations, describeViolations(violations)).toEqual([]);
    });
  },
);
