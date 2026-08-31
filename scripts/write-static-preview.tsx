/**
 * ログインの要らない「静止した写し」を焼く。1 枚ではなく**冊子**にする。
 *
 * ```
 * pnpm run preview:static
 * ```
 *
 * ## これは何ではないか
 *
 * **動いているアプリを認証なしで見せる仕掛けではない。**入口の門
 * （`src/middleware.ts`）にも `matcher` にも触っていない。ここがしているのは、
 * 画面の部品を Node の上で静かに描いて、本物の CSS と一緒に焼くことだけである。
 * 焼いた HTML はサーバーに繋がっておらず、押しても何も起きない。
 * 門を緩めずに見た目だけを渡すための、**別のもの**である。
 *
 * ## なぜ 1 枚ではなく冊子なのか
 *
 * 見てもらいたいのは「1 つの記事の見た目」ではなく、**表示の分かれ方が
 * 全部出ているか**である。順位表・比較表・商品カード・提携が無いときの断り・
 * 未計測の欄・会話は、どれも別々の記事にしか出ない。1 枚に焼くと、
 * 焼いた 1 本に出る分岐しか確かめられず、出ていない分岐は
 * 「無い」のか「壊れている」のか区別がつかない。
 *
 * だから見本のブログ 5 本と、その全記事を 1 ページずつ焼き、
 * `index.html` に**どの分岐がどのページで見られるか**の対応表を置く。
 *
 * ## 本物であることをどう保つか
 *
 * 1. **部品は本物を描く。** 記事は `ArticleView`、ブログのトップは
 *    `SiteHomeContent`、管理画面は
 *    `AppShell`。どれもアプリが描いているのと同じものを、同じ引数で描いている。
 * 2. **中身も本物を読む。** 記事も設計図も、アプリが読むのと同じ
 *    見本リポジトリから取る。ここに文言を書き写さない。
 * 3. **CSS は本物を通す。** トークンは `src/app/globals.css` を
 *    `@tailwindcss/postcss`（アプリが使っている道具そのもの）に通した結果、
 *    部品の見た目は `.module.css` の本文そのまま。**どこにも書き写しが無い。**
 * 4. **空なら止まる。** 読めていないまま焼くと、見た目の無い写しが
 *    「これが実物です」という顔で残る。判定は `scripts/lib/static-preview.mjs`。
 *
 * 名前の扱いだけ本番と違う。本番の束ね役は `.module.css` の名前を隠して衝突を防ぐが、
 * ここでは `scripts/lib/css-module-hook.cjs` が名前をそのまま通す。
 * そうすると CSS の本文をそのまま貼れば当たるので、貼る側に書き換えが要らない。
 */

import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_APPEARANCE } from "@/domain/authoring/appearance";
import { appearanceAttributes } from "@/presentation/ui/appearance";
import { Card, Page } from "@/presentation/ui";
import { ArticleView, SiteShell } from "@/presentation/ui";
import { AppShell } from "@/presentation/ui/templates/app-shell";
import { DensitySamples } from "@/app/admin/ui-catalog/density-samples";
import { createSampleContentRepository } from "@/infrastructure/persistence/sample/content-sample-repository";
import {
  createSampleSiteRepository,
  SAMPLE_SITE_SLUG,
  sampleSites,
} from "@/infrastructure/persistence/sample/site-sample-repository";
import { SiteHomeContent, toSiteHomeView } from "@/presentation/site/home-content";
import { siteHref, toArticleView, toChrome } from "@/presentation/site/view-model";
import type { PublicSiteBlueprint } from "@/application/usecases/site/read-site";
import {
  articleHref,
  type ArticleSummary,
  type PublishedArticle,
} from "@/application/read-models/published-article";
import { writeStaticPreview } from "./lib/static-preview.mjs";

/**
 * 焼いた冊子の置き場所。
 *
 * `public/` へ置くと、門を通さずにアプリ自身が配ってしまう。それは
 * 「別に作った静止画」ではなく、入口に開けた穴になる。だから `docs/` の下だけ。
 * （検査は `tests/architecture/static-preview-writer.test.ts`。）
 */
const INDEX_OUT = "docs/product/preview/index.html";
const NAV_OUT = "docs/product/preview/nav-and-density.html";
const SITES_DIR_OUT = "docs/product/preview/sites";
const ARTICLES_DIR_OUT = "docs/product/preview/articles";

/* --- 管理画面の見本 ------------------------------------------------------ */

function adminBody(): string {
  return renderToStaticMarkup(
    <AppShell
      actualRoutePath="/admin/ui-catalog"
      navContextPath="/admin/ui-catalog"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "画面部品の見本" }]}
    >
      <Page
        title="画面部品の見本"
        lead="実物の部品を、実物の見た目のまま並べています。ここで見えている間隔と行の長さが、アプリでもそのまま出ます。"
      >
        <Card
          claim="22. 詰まり具合の見比べ"
          main={<DensitySamples />}
        />
      </Page>
    </AppShell>,
  );
}

/* --- ブログのトップ ------------------------------------------------------ */

/**
 * ブログのトップ。`src/app/s/[site]/page.tsx` と同じ部品・同じ引数で描く。
 *
 * 描き方をここで作り直すと、実物が変わった日に写しだけ古いまま残り、
 * しかも見た目からは分からない。だから並べる順も節の見出しも実物に合わせる。
 */
function siteBody(
  siteSlug: string,
  blueprint: PublicSiteBlueprint,
  recent: readonly ArticleSummary[],
): string {
  const chrome = toChrome(siteSlug, blueprint);
  return renderToStaticMarkup(
    <SiteShell chrome={chrome} currentPath={siteHref(siteSlug, "/")}>
      <SiteHomeContent view={toSiteHomeView(siteSlug, blueprint, recent)} />
    </SiteShell>,
  );
}

/* --- 冊子の組み立て ------------------------------------------------------ */

/** 取得境界から描画境界へ渡す、ブログ 1 本ぶんの読み取り結果。 */
type PreviewSiteData = {
  readonly slug: string;
  readonly blueprint: PublicSiteBlueprint;
  readonly summaries: readonly ArticleSummary[];
  readonly articles: readonly PublishedArticle[];
};

/** 焼く 1 ページぶん。どの分岐がここで見られるかも一緒に持たせる。 */
type Sheet = {
  readonly out: string;
  readonly title: string;
  readonly bodyHtml: string;
  /** 実アプリで同じ内容を開く URL。目次に文字として載せる。 */
  readonly appHref: string;
  readonly kind: "site" | "article" | "admin";
  /** 冊子の目次に出す肩書き（ブログ名など）。 */
  readonly group: string;
  /** この記事に出ている表示の分かれ方。目次の対応表がこれで作られる。 */
  readonly branches: readonly string[];
};

/**
 * 記事に出ている表示の分かれ方を、記事そのものから読む。
 *
 * 手で「この記事には順位表がある」と書かない。書くと、記事を差し替えた日に
 * 対応表だけ古いまま残り、**出ていない分岐を「出ている」と読ませる**。
 * 記事を見て言えることだけを言う。
 */
function branchesOf(article: PublishedArticle): readonly string[] {
  const found: string[] = [`記事の型: ${article.type}`];
  if (article.ranking !== undefined) found.push("順位表");
  if (article.comparison !== undefined) found.push("比較表");
  if (article.conversation !== undefined) found.push("会話");

  const cards = article.productCards ?? [];
  if (cards.length > 0) found.push("商品カード");
  // 提携が無いことの断りは、行き先と計測符号を**両方**省いたときだけ出る。
  // 片方でも残っていると理由は黙って消えるので、両方を見る。
  if (cards.some((c) => c.affiliateUrl === undefined && c.trackingCode === undefined)) {
    found.push("提携が無いときの断り");
  }
  if (cards.some((c) => (c.specs ?? []).some((s) => s.value === null))) {
    found.push("未計測の欄");
  }

  const kinds = new Set(
    article.sections.flatMap((s) => (s.claims ?? []).map((c) => c.kind)),
  );
  for (const kind of ["fact", "inference", "opinion"] as const) {
    if (kinds.has(kind)) found.push(`主張の印: ${kind}`);
  }
  return found;
}

/** 冊子の中を移る案内。書き出すページから実在する 2 ページへの道を作る。 */
function navHtml(from: string): string {
  return [
    "<strong>静止した写しの冊子</strong>",
    `<a href="${hrefFrom(from, INDEX_OUT)}">目次</a>`,
    `<a href="${hrefFrom(from, NAV_OUT)}">管理画面の見本</a>`,
  ].join("");
}

/** 目次。どの分岐がどのページで見られるかを、焼いた実物から作る。 */
function indexBody(sheets: readonly Sheet[]): string {
  const groups = new Map<string, Sheet[]>();
  for (const sheet of sheets) {
    const list = groups.get(sheet.group) ?? [];
    list.push(sheet);
    groups.set(sheet.group, list);
  }

  const allBranches = [...new Set(sheets.flatMap((s) => s.branches))].sort();
  const rows = allBranches.map((branch) => {
    const where = sheets.filter((s) => s.branches.includes(branch));
    return [
      "<tr>",
      `<th scope="row">${escapeText(branch)}</th>`,
      `<td>${where.length}</td>`,
      `<td>${where
        .slice(0, 4)
        .map((s) => `<a href="${hrefFrom(INDEX_OUT, s.out)}">${escapeText(s.title)}</a>`)
        .join("、")}${where.length > 4 ? " ほか" : ""}</td>`,
      "</tr>",
    ].join("");
  });

  return [
    '<main class="catalog">',
    "<h1>静止した写しの冊子</h1>",
    `<p>見本のブログ ${sheets.filter((sheet) => sheet.kind === "site").length} 本と、その全記事 ${
      sheets.filter((sheet) => sheet.kind === "article").length
    } 本を 1 ページずつ焼いています。押しても動きませんが、見た目と中身は実物です。</p>`,
    "<h2>表示の分かれ方が、どこで見られるか</h2>",
    "<p>この表は焼いた記事そのものから作っています。手で書いていないので、記事を差し替えれば表も変わります。件数が 0 の行はここに出ません（出ていない分岐は、そもそも記事に無いということです）。</p>",
    '<table class="catalog-table">',
    "<thead><tr><th>表示の分かれ方</th><th>出ている記事の数</th><th>見られるページ</th></tr></thead>",
    `<tbody>${rows.join("")}</tbody>`,
    "</table>",
    "<h2>ページの一覧</h2>",
    ...[...groups.entries()].map(([group, list]) =>
      [
        `<h3>${escapeText(group)}</h3>`,
        "<ul>",
        ...list.map(
          (s) =>
            `<li><a href="${hrefFrom(INDEX_OUT, s.out)}">${escapeText(s.title)}</a>` +
            `<br><code>${escapeText(s.appHref)}</code>` +
            `<br><small>${escapeText(s.branches.join(" / "))}</small></li>`,
        ),
        "</ul>",
      ].join(""),
    ),
    "</main>",
    CATALOG_STYLE,
  ].join("\n");
}

/** 目次だけの見た目。実物の部品を使わないので、ここだけ素の値で書く。 */
const CATALOG_STYLE = `<style>
.catalog { max-width: 60rem; margin: 0 auto; padding: 24px 16px 64px; font-family: system-ui, sans-serif; line-height: 1.8; }
.catalog h1 { font-size: 1.6rem; margin: 0 0 8px; }
.catalog h2 { font-size: 1.2rem; margin: 32px 0 8px; border-bottom: 1px solid #d4d9e0; padding-bottom: 4px; }
.catalog h3 { font-size: 1rem; margin: 20px 0 4px; }
.catalog ul { margin: 0; padding-left: 1.2em; }
.catalog li { margin-bottom: 6px; }
.catalog small { color: #5b6472; }
.catalog-table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
.catalog-table th, .catalog-table td { border: 1px solid #d4d9e0; padding: 6px 10px; text-align: left; vertical-align: top; }
.catalog-table thead th { background: #eef2f7; }
</style>`;

/** `from` のページから `to` のページへ届く相対の道。 */
function hrefFrom(from: string, to: string): string {
  const fromParts = from.split("/").slice(0, -1);
  const toParts = to.split("/");
  let shared = 0;
  while (shared < fromParts.length && fromParts[shared] === toParts[shared]) shared += 1;
  const up = "../".repeat(fromParts.length - shared);
  return `${up}${toParts.slice(shared).join("/")}`;
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* --- 書き出し ------------------------------------------------------------ */

/** 1 ページを文書へ組み立てて書く。データ取得や React 描画はここへ持ち込まない。 */
async function writeSheet(sheet: Sheet, generatedAt: string): Promise<void> {
  await writeStaticPreview({
    out: sheet.out,
    bodyHtml: sheet.bodyHtml,
    htmlAttributes: { lang: "ja", ...appearanceAttributes(DEFAULT_APPEARANCE) },
    generatedAt,
    title: sheet.title,
    source: "scripts/write-static-preview.tsx",
    navHtml: navHtml(sheet.out),
  });
}

/** 見本リポジトリを読む境界。ここでは HTML を描かない。 */
async function collectPreviewSites(): Promise<readonly PreviewSiteData[]> {
  const content = createSampleContentRepository();
  const siteRepo = createSampleSiteRepository();
  const sites: PreviewSiteData[] = [];

  for (const { slug } of sampleSites()) {
    const found = await siteRepo.findBySlug(slug);
    if (!found.ok || found.value === null) {
      throw new Error(`ブログの設計図を読み込めませんでした: ${slug}`);
    }
    const blueprint = found.value;

    // 存在する記事は全件読む。記事がまだ無いサイトもトップの空状態を描く。
    // 1 本だけに絞ると、その 1 本に出る分岐しか確かめられない。
    const recent = await content.listRecent(slug, 200);
    if (!recent.ok) throw new Error(`記事の一覧を読み込めませんでした: ${slug}`);

    const articles: PublishedArticle[] = [];
    for (const summary of recent.value) {
      const article = await content.findArticle(slug, summary.slug);
      if (!article.ok || article.value === null) {
        throw new Error(`記事を読み込めませんでした: ${slug}/${summary.slug}`);
      }
      articles.push(article.value);
    }
    sites.push({ slug, blueprint, summaries: recent.value, articles });
  }
  return sites;
}

/** 取得済みのデータを描画する純粋境界。CSS とファイル出力は扱わない。 */
function renderSheets(sites: readonly PreviewSiteData[]): readonly Sheet[] {
  const sheets: Sheet[] = [];

  for (const { slug, blueprint, summaries, articles } of sites) {
    sheets.push({
      out: `${SITES_DIR_OUT}/${slug}.html`,
      title: `${blueprint.name}（トップ）`,
      bodyHtml: siteBody(slug, blueprint, summaries),
      appHref: siteHref(slug, "/"),
      kind: "site",
      group: blueprint.name,
      branches: ["ブログのトップ"],
    });

    const chrome = toChrome(slug, blueprint);
    for (const current of articles) {
      const view = toArticleView(slug, current);
      const appHref = siteHref(slug, articleHref(current));
      sheets.push({
        out: `${ARTICLES_DIR_OUT}/${slug}__${current.slug}.html`,
        title: `${blueprint.name} — ${view.title}`,
        bodyHtml: renderToStaticMarkup(
          <SiteShell
            chrome={chrome}
            currentPath={appHref}
            breadcrumbs={[
              { label: blueprint.name, href: siteHref(slug, "/") },
              { label: view.title },
            ]}
          >
            <ArticleView article={view} />
          </SiteShell>,
        ),
        appHref,
        kind: "article",
        group: blueprint.name,
        branches: branchesOf(current),
      });
    }
  }

  sheets.push({
    out: NAV_OUT,
    title: "管理画面 — 案内の分類と、詰まり具合の見比べ",
    bodyHtml: adminBody(),
    appHref: "/admin/ui-catalog",
    kind: "admin",
    group: "管理画面",
    branches: ["管理画面の案内", "詰まり具合"],
  });

  return sheets;
}

async function main(): Promise<void> {
  const sites = await collectPreviewSites();
  const sheets = renderSheets(sites);
  const generatedAt = new Date().toISOString().slice(0, 10);

  for (const sheet of sheets) await writeSheet(sheet, generatedAt);
  await writeSheet(
    {
      out: INDEX_OUT,
      title: "静止した写しの冊子 — 目次",
      bodyHtml: indexBody(sheets),
      appHref: "/",
      kind: "admin",
      group: "目次",
      branches: [],
    },
    generatedAt,
  );

  console.log(`書き出しました: ${INDEX_OUT}（ほか ${sheets.length} ページ）`);
  console.log(`  ブログ ${sheets.filter((sheet) => sheet.kind === "site").length} 本 / 記事 ${
    sheets.filter((sheet) => sheet.kind === "article").length
  } 本`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

/** 1 本だけを見たいときの入口。冊子の中で最初に開く記事を決めている。 */
export const FIRST_SITE = SAMPLE_SITE_SLUG;
