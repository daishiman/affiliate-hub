/**
 * 機械向けの配信ファイル（sitemap / RSS / llms.txt / robots.txt）の組み立て。
 *
 * すべて純関数で、文字列を返すだけ。どの URL で配るかはルート側の仕事。
 *
 * ## なぜ記事の型ではなく `FeedItem` を受けるのか
 *
 * 2026-08-30 まで、ここは `ArticleSummary` を受けて `articleHref` で
 * 道を引いていた。公開面の記事が 1 種類だった頃はそれで正しかった。
 *
 * いまは 2 種類ある。編集済みの読み取りモデル（`/best` `/guides` …）と、
 * ブログ運用で書いた記事（`/blog/<slug>`）で、**道の作り方が違う**。
 * `articleHref` は前者しか写せないので、後者は
 * **sitemap にも llms.txt にも RSS にも 1 本も載っていなかった**
 * （実測: 公開記事 7 本に対し sitemap の該当 URL 0 件）。
 *
 * 型を 1 つ増やして片方だけ足す、では 3 種類目が来た日に同じ穴が空く。
 * だから**この器は道を引かない**。引くのは呼ぶ側で、ここへは
 * 「引き終わった道」だけが来る。どの記事種でも同じ 1 本を通る。
 */

/**
 * 配信物 1 行分。記事の種類に依らない最小の形。
 *
 * `path` はブログ内の道（例 `/best/laptops`、`/blog/quiet-desk`）。
 * ホストとブログ基底パスは `canonicalSiteUrl` が付ける。
 */
export type FeedItem = {
  readonly path: string;
  readonly title: string;
  readonly summary: string;
  /** `YYYY-MM-DD`。読めない値は pubDate を出さないことで表す。 */
  readonly updatedAt: string;
};

/** XML の本文・属性に入れる文字列の逃がし。5 文字とも逃がす。 */
function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export type CanonicalSiteUrl = {
  readonly origin: string;
  readonly basePath: string;
};

/**
 * ブログ内の道を公開 URL へ写す唯一の口。
 *
 * sitemap / RSS / llms.txt が個別に連結すると、いずれかだけ
 * `/s/<site>` を落としても気づけない。記事の道は `articleHref`、
 * ホストとブログ基底パスの投影はこの関数が正本となる。
 */
export function canonicalSiteUrl(site: CanonicalSiteUrl, path = ""): string {
  return `${site.origin}${site.basePath}${path}`;
}

/** サイトマップ 1 本。entries の path はサイト内の道（例: /best/laptops）。 */
export function buildSitemapXml(
  origin: string,
  basePath: string,
  entries: readonly { readonly path: string; readonly updatedAt: string }[],
): string {
  const urls = entries
    .map((entry) => {
      const loc = escapeXml(canonicalSiteUrl({ origin, basePath }, entry.path));
      const lastmod = escapeXml(entry.updatedAt);
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    })
    .join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

export type RssSiteInput = {
  readonly siteName: string;
  readonly origin: string;
  readonly basePath: string;
  readonly description: string;
};

/**
 * RSS 2.0。
 *
 * pubDate は RFC 822 形式が決まりなので、YYYY-MM-DD を UTC 0 時として読み替える。
 * 読めない日付の item は pubDate を**出さない**（壊れた日付を配るより無い方がよい）。
 */
export function buildRssXml(site: RssSiteInput, items: readonly FeedItem[]): string {
  const channelLink = canonicalSiteUrl(site);
  const itemXml = items
    .map((item) => {
      const link = escapeXml(canonicalSiteUrl(site, item.path));
      const updated = new Date(`${item.updatedAt}T00:00:00Z`);
      const pubDate = Number.isNaN(updated.getTime())
        ? ""
        : `\n      <pubDate>${escapeXml(updated.toUTCString())}</pubDate>`;
      return [
        `    <item>`,
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${link}</link>`,
        `      <guid isPermaLink="true">${link}</guid>`,
        `      <description>${escapeXml(item.summary)}</description>${pubDate}`,
        `    </item>`,
      ].join("\n");
    })
    .join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0">`,
    `  <channel>`,
    `    <title>${escapeXml(site.siteName)}</title>`,
    `    <link>${escapeXml(channelLink)}</link>`,
    `    <description>${escapeXml(site.description)}</description>`,
    itemXml,
    `  </channel>`,
    `</rss>`,
    ``,
  ].join("\n");
}

/**
 * llms.txt（https://llmstxt.org/ の提案形式）。
 *
 * AI がサイトの要点を 1 ファイルで読めるようにする Markdown。
 * 形式は「# サイト名」「> 1 行の説明」「## 節」とリンクの列。
 * 出すかどうかはブログの設計図（`SiteBlueprint.emitLlmsTxt`）が決める。
 */
export function buildLlmsTxt(
  site: {
    readonly siteName: string;
    readonly purpose: string;
    readonly origin: string;
    readonly basePath: string;
  },
  items: readonly FeedItem[],
): string {
  const links = items
    .map((item) => `- [${item.title}](${canonicalSiteUrl(site, item.path)}): ${item.summary}`)
    .join("\n");
  return [`# ${site.siteName}`, ``, `> ${site.purpose}`, ``, `## 記事一覧`, ``, links, ``].join(
    "\n",
  );
}

/**
 * AI 検索・AI 学習のクローラー。**明示的に許可する**側の一覧。
 *
 * 既定（User-agent: *）で全許可なので技術的には書かなくても同じだが、
 * 「AI に読まれることを選んでいる」ことを robots.txt を読む人にも機械にも残す。
 * 遮断の行はこの関数からは出さない（遮断はこのプロダクトの方針の外）。
 */
export const AI_CRAWLERS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"] as const;

export function buildRobotsTxt(
  origin: string,
  basePath: string,
  options: { readonly emitLlmsTxt: boolean },
): string {
  const lines: string[] = [`User-agent: *`, `Allow: /`, ``];
  for (const crawler of AI_CRAWLERS) {
    lines.push(`User-agent: ${crawler}`, `Allow: /`, ``);
  }
  if (options.emitLlmsTxt) {
    // robots.txt に llms.txt の公式な項目は無いので、人と AI の両方が読める注記で置く。
    lines.push(`# llms.txt: ${origin}${basePath}/llms.txt`, ``);
  }
  lines.push(`Sitemap: ${origin}${basePath}/sitemap.xml`, ``);
  return lines.join("\n");
}
