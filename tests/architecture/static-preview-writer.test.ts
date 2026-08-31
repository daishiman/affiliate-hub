/**
 * @tier 1
 * @req REQ-TS12
 * @types equivalence, boundary
 *
 * ログイン不要の「静止した写し」を、生成された冊子のふるまいで固定する。
 * 実装ファイルの文字列や内部関数名ではなく、利用者が開く HTML・URL・目次を測る。
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type PublishedArticle,
  articleHref,
} from "@/application/read-models/published-article";
import { createSampleContentRepository } from "@/infrastructure/persistence/sample/content-sample-repository";
import { sampleSites } from "@/infrastructure/persistence/sample/site-sample-repository";
import { SiteHomeContent, toSiteHomeView } from "@/presentation/site/home-content";
import { siteHref } from "@/presentation/site/view-model";
import {
  KNOWN_DIFFERENCES,
  STATIC_NOTE,
  buildDocument,
  findModuleCss,
  writeStaticPreview,
} from "../../scripts/lib/static-preview.mjs";

const ROOT = process.cwd();
const PREVIEW_DIR = join(ROOT, "docs/product/preview");
const INDEX_FILE = join(PREVIEW_DIR, "index.html");
const RUNNER = "scripts/lib/static-preview.mjs";
const WRITERS = readdirSync(join(ROOT, "scripts"))
  .filter((name) => name.startsWith("write-") && name.endsWith("-preview.tsx"))
  .sort()
  .map((name) => `scripts/${name}`);

/** そろっている入力。ここから 1 つずつ欠けさせて「止まる例」を作る。 */
const COMPLETE = {
  tailwindCss: ":root{--color-surface-default:#fff}",
  moduleCss: [{ path: "src/x.module.css", text: ".navLink{padding:8px}" }],
  bodyHtml: '<div class="navLink">商品</div>',
  htmlAttributes: { lang: "ja" },
  generatedAt: "2026-08-19",
} as const;

type Input = Parameters<typeof buildDocument>[0];

describe("静止した写しの組み立て", () => {
  it("そろった入力なら CSS・中身・静止中の説明を 1 枚に焼ける", () => {
    const html = buildDocument(COMPLETE as unknown as Input);

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain(COMPLETE.tailwindCss);
    expect(html).toContain(COMPLETE.moduleCss[0].text);
    expect(html).toContain(COMPLETE.bodyHtml);
    expect(html).toContain(STATIC_NOTE);
    for (const line of KNOWN_DIFFERENCES) expect(html).toContain(line);
    expect(html).toContain("<div inert>");
  });

  it("冊子の案内だけは押せる場所に残す", () => {
    const html = buildDocument({
      ...(COMPLETE as unknown as Input),
      title: "ある記事",
      navHtml: '<a href="index.html">目次</a>',
    });

    expect(html).toContain("<title>ある記事</title>");
    expect(html.indexOf('<a href="index.html">目次</a>')).toBeLessThan(
      html.indexOf("<div inert>"),
    );
  });

  it("題も案内も渡さない 1 枚ものは、従来の題だけを使う", () => {
    const html = buildDocument(COMPLETE as unknown as Input);

    expect(html).toContain("<title>静止した写し");
    expect(html).not.toContain('<nav class="static-nav">');
  });

  const missing: readonly (readonly [string, Partial<Input>])[] = [
    ["トークンの CSS が空", { tailwindCss: "" }],
    ["トークンの CSS が空白だけ", { tailwindCss: "  \n " }],
    ["部品の CSS が 1 つも無い", { moduleCss: [] }],
    ["部品の CSS の中身が空", { moduleCss: [{ path: "src/x.module.css", text: "" }] }],
    ["中身が空", { bodyHtml: "" }],
  ];

  for (const [name, hole] of missing) {
    it(`${name}なら焼かずに投げる`, () => {
      expect(() => buildDocument({ ...(COMPLETE as unknown as Input), ...hole })).toThrow();
    });
  }

  it("部品 CSS は src 全体から拾い、空のファイルを混ぜない", () => {
    const found = findModuleCss(ROOT);

    expect(found).toContain("src/app/admin/admin.module.css");
    expect(found).toContain("src/presentation/ui/primitives/ui.module.css");
    for (const path of found) {
      expect(path.startsWith("src/")).toBe(true);
      expect(path.endsWith(".module.css")).toBe(true);
      expect(readFileSync(join(ROOT, path), "utf8").trim()).not.toBe("");
    }
  });

  it("docs の外へは書き出さない", async () => {
    for (const out of ["public/preview.html", "src/preview.html", "docs/../public/preview.html"]) {
      await expect(
        writeStaticPreview({
          out,
          bodyHtml: COMPLETE.bodyHtml,
          htmlAttributes: COMPLETE.htmlAttributes,
          generatedAt: COMPLETE.generatedAt,
        }),
      ).rejects.toThrow("docs/");
    }
  });

  it("すべての writer が共通 runner を通り、出力先を重複させない", () => {
    expect(WRITERS).toEqual(
      expect.arrayContaining([
        "scripts/write-static-preview.tsx",
        "scripts/write-blog-preview.tsx",
        "scripts/write-site-preview.tsx",
      ]),
    );

    const outputs: string[] = [];
    for (const path of WRITERS) {
      const writer = readFileSync(join(ROOT, path), "utf8");
      expect(writer, path).toContain("writeStaticPreview");
      expect(writer, path).not.toContain('import tailwind from "@tailwindcss/postcss"');
      expect(writer, path).not.toContain('from "postcss"');
      expect(writer, path).not.toContain("buildDocument");
      expect(writer, path).not.toContain("findModuleCss");
      expect(writer, path).not.toContain("writeFileSync");
      const matches = [...writer.matchAll(/const (?:OUT|INDEX_OUT|NAV_OUT) = "([^"]+)"/g)];
      for (const match of matches) {
        expect(match[1], path).toMatch(/^docs\//);
        outputs.push(match[1] ?? "");
      }
    }
    expect(new Set(outputs).size).toBe(outputs.length);

    const runner = readFileSync(join(ROOT, RUNNER), "utf8");
    expect(runner).toContain('const ENTRY_CSS = "src/app/globals.css"');
    expect(runner).toContain('out.startsWith("docs/")');
    expect(runner).toContain("postcss([tailwind()])");
  });
});

type ExpectedArticle = {
  readonly article: PublishedArticle;
  readonly appHref: string;
  readonly previewFile: string;
};

let expectedArticles: readonly ExpectedArticle[] = [];
let indexDocument: Document;

beforeAll(async () => {
  execFileSync("pnpm", ["run", "preview:static"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "pipe",
    timeout: 60_000,
  });

  const content = createSampleContentRepository();
  const found: ExpectedArticle[] = [];
  for (const { slug } of sampleSites()) {
    const recent = await content.listRecent(slug, 200);
    if (!recent.ok) throw new Error(`記事一覧を検査用に読めませんでした: ${slug}`);
    for (const summary of recent.value) {
      const article = await content.findArticle(slug, summary.slug);
      if (!article.ok || article.value === null) {
        throw new Error(`記事を検査用に読めませんでした: ${slug}/${summary.slug}`);
      }
      found.push({
        article: article.value,
        appHref: siteHref(slug, articleHref(article.value)),
        previewFile: join(PREVIEW_DIR, "articles", `${slug}__${summary.slug}.html`),
      });
    }
  }
  expectedArticles = found;
  indexDocument = new JSDOM(readFileSync(INDEX_FILE, "utf8")).window.document;
}, 60_000);

describe("実際に書き出した静止冊子", () => {
  it("見本の全ブログ・全記事と、実画面の URL を目次から確認できる", () => {
    expect(existsSync(INDEX_FILE)).toBe(true);
    expect(existsSync(join(PREVIEW_DIR, "nav-and-density.html"))).toBe(true);

    for (const { slug, blueprint } of sampleSites()) {
      expect(existsSync(join(PREVIEW_DIR, "sites", `${slug}.html`))).toBe(true);
      expect(indexDocument.body.textContent).toContain(blueprint.name);
      expect(indexDocument.body.textContent).toContain(siteHref(slug, "/"));
    }
    for (const expected of expectedArticles) {
      expect(existsSync(expected.previewFile)).toBe(true);
      expect(indexDocument.body.textContent).toContain(expected.appHref);
    }
  });

  it("ブログトップの本文は、本画面と共通の表示結果をそのまま含む", async () => {
    const content = createSampleContentRepository();

    for (const { slug, blueprint } of sampleSites()) {
      const recent = await content.listRecent(slug, 200);
      if (!recent.ok) throw new Error(`記事一覧を検査用に読めませんでした: ${slug}`);
      const sharedBody = renderToStaticMarkup(
        createElement(SiteHomeContent, {
          view: toSiteHomeView(slug, blueprint, recent.value),
        }),
      );
      const generated = readFileSync(join(PREVIEW_DIR, "sites", `${slug}.html`), "utf8");
      const expectedContent = new JSDOM(sharedBody).window.document.body.firstElementChild;
      const generatedContent = new JSDOM(generated).window.document.querySelector(
        "main.siteMain > div",
      );

      expect(generatedContent?.textContent).toBe(expectedContent?.textContent);
      expect(hrefsOf(generatedContent)).toEqual(hrefsOf(expectedContent));
      expect(formActionsOf(generatedContent)).toEqual(formActionsOf(expectedContent));
      for (const summary of recent.value) {
        expect(generated).toContain(`href="${siteHref(slug, articleHref(summary))}"`);
      }
    }
  });

  it("目次と全ページの冊子内リンクは、実在する HTML へ届く", () => {
    const files = [
      INDEX_FILE,
      join(PREVIEW_DIR, "nav-and-density.html"),
      ...sampleSites().map(({ slug }) => join(PREVIEW_DIR, "sites", `${slug}.html`)),
      ...expectedArticles.map((article) => article.previewFile),
    ];

    for (const file of files) {
      const document = new JSDOM(readFileSync(file, "utf8")).window.document;
      const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href$=".html"]')];
      for (const link of links) {
        const target = resolve(dirname(file), link.getAttribute("href") ?? "");
        expect(existsSync(target), `${file} から ${target} へ届かない`).toBe(true);
      }
    }
  });

  it("分岐 manifest は記事データに出ている分岐と件数を正しく示す", () => {
    const expected = new Map<string, number>();
    for (const article of expectedArticles.map((item) => item.article)) {
      for (const branch of branchesVisibleIn(article)) {
        expected.set(branch, (expected.get(branch) ?? 0) + 1);
      }
    }

    const rows = [...indexDocument.querySelectorAll(".catalog-table tbody tr")];
    const actual = new Map(
      rows.map((row) => {
        const cells = row.querySelectorAll("th, td");
        return [cells[0]?.textContent?.trim() ?? "", Number(cells[1]?.textContent ?? "NaN")] as const;
      }),
    );

    for (const [branch, count] of expected) expect(actual.get(branch)).toBe(count);
    expect(actual.has("訂正履歴")).toBe(false);

    for (const expectedArticle of expectedArticles) {
      const relativeHref = expectedArticle.previewFile.slice(PREVIEW_DIR.length + 1);
      const pageLink = [
        ...indexDocument.querySelectorAll<HTMLAnchorElement>(`a[href="${relativeHref}"]`),
      ].find((link) => link.closest("li") !== null);
      expect(pageLink, `${relativeHref} がページ一覧に無い`).not.toBeNull();
      const listedBranches = pageLink?.closest("li")?.querySelector("small")?.textContent ?? "";
      for (const branch of branchesVisibleIn(expectedArticle.article)) {
        expect(listedBranches).toContain(branch);
      }
    }
  });

  it("生成結果には本物のトークン CSS と部品 CSS が入り、本文にも適用先がある", () => {
    const adminHtml = readFileSync(join(PREVIEW_DIR, "nav-and-density.html"), "utf8");

    expect(adminHtml).toContain("--color-surface-default");
    expect(adminHtml).toContain(".sectionTitle");
    // 本文側の適用先は `subTitle` で見る（2026-08-31 に `sectionTitle` から変更）。
    // `Card` が `claim` / `main` を受け取る形になり、器の中へ生の見出しを
    // 置かなくなったため、この写しに `sectionTitle` の付く要素はもう出ない。
    // **見たいのは「部品の CSS に、本文の側の当たり先があるか」**なので、
    // 同じ `screen-parts.module.css` から出て実際に描かれる名前へ移す。
    expect(adminHtml).toContain('class="subTitle"');
  });
});

function branchesVisibleIn(article: PublishedArticle): readonly string[] {
  const branches = [`記事の型: ${article.type}`];
  if (article.ranking !== undefined) branches.push("順位表");
  if (article.comparison !== undefined) branches.push("比較表");
  if (article.conversation !== undefined) branches.push("会話");

  const cards = article.productCards ?? [];
  if (cards.length > 0) branches.push("商品カード");
  if (cards.some((card) => card.affiliateUrl === undefined && card.trackingCode === undefined)) {
    branches.push("提携が無いときの断り");
  }
  if (cards.some((card) => card.specs.some((spec) => spec.value === null))) {
    branches.push("未計測の欄");
  }

  const claimKinds = new Set(
    article.sections.flatMap((section) => section.claims?.map((claim) => claim.kind) ?? []),
  );
  for (const kind of ["fact", "inference", "opinion"] as const) {
    if (claimKinds.has(kind)) branches.push(`主張の印: ${kind}`);
  }
  return branches;
}

function hrefsOf(root: Element | null): readonly string[] {
  return [...(root?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])].map(
    (link) => link.getAttribute("href") ?? "",
  );
}

function formActionsOf(root: Element | null): readonly string[] {
  return [...(root?.querySelectorAll<HTMLFormElement>("form[action]") ?? [])].map(
    (form) => form.getAttribute("action") ?? "",
  );
}
