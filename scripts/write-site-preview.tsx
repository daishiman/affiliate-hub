/**
 * 見本データのブログを、**枠組みごと** 1 枚の HTML に焼く。
 *
 * ```
 * pnpm run preview:site
 * ```
 *
 * ## `write-blog-preview.tsx` と何が違うか
 *
 * あちらは記事の本体だけを 11 本並べる。**軸の見比べ**が目的で、
 * ヘッダーも脇の枠もフッターも出ない。
 *
 * こちらは逆で、記事は各ブログ 1 本だけにして、**その 1 本を包んでいる枠組み**
 * （ヘッダー・パンくず・脇の枠・追従枠・フッター）を出す。開発機の D1 に
 * 版面を 4 領域 18 枠ぶん入れたのは、この枠が描けているかを見るためで、
 * 枠が出ない写しだけを見ていると「入れた枠が描けていない」に気づけない。
 *
 * ## どうやって cookie 無しで枠を描いているのか
 *
 * `SiteFrame` は request の cookie（明るさ・計測の同意）を読むので Node の外では動かない。
 * だが **`SiteFrame` が cookie を要るだけで、その下は全部要らない**。
 * `toChrome` も `blogSidebar` も `SiteShell` も、渡された値を描くだけの純関数である。
 * だからここは `SiteFrame` を飛ばし、その中身と同じ順で
 * `readPublicSiteProjection` → `toChrome` → `blogSidebar` → `SiteShell` を呼ぶ。
 *
 * `appearance` / `consent` / `telemetry` は渡さない（どれも optional）。
 * **手で作った偽の値を渡さない**のは、明るさの切り替えと同意の帯が
 * 「実物と同じ見た目で、実物と違う挙動」になるのを避けるため。
 * 出ないものは出ないままにして、その旨を写しの中に書く。
 *
 * ## データの出どころ
 *
 * 版面・記事・タグ・固定ページ・サイト網はすべて `scripts/seed/local-seed-data.ts` の
 * **records を返す関数**から取る。`pnpm seed:local` が D1 へ入れる SQL も同じ関数から
 * 組み立てている。**この写しのために別の見本を書かない。**書くと、写しには枠があるのに
 * D1 には無い状態が作れてしまい、写しのほうだけ正しく見える。
 *
 * 設計図（`blueprint`）だけは見本のブログが持っている（`sampleSites()`）。
 * シードの URL 名を見本に合わせてあるのは、まさにここで噛み合わせるためである。
 */

import { renderToStaticMarkup } from "react-dom/server";
import type { PublicBlogPort, PublicSiteReader } from "@/application/ports/blog-ops";
import { toPublicBlueprint } from "@/application/usecases/site/read-site";
import { DEFAULT_APPEARANCE } from "@/domain/authoring/appearance";
import { ok } from "@/domain/shared";
import { BlogArticleView } from "@/presentation/site/blog-article-view";
import { blogSidebar } from "@/presentation/site/blog-sidebar";
import { readPublicSiteProjection } from "@/presentation/site/public-site-projection";
import { breadcrumbsFor, siteHref, toChrome } from "@/presentation/site/view-model";
import { appearanceAttributes } from "@/presentation/ui/appearance";
import { Callout, Section, SitePage, SiteShell } from "@/presentation/ui";
import { sampleSites } from "@/infrastructure/persistence/sample/site-sample-repository";
import {
  SEED_ARTICLES,
  SEED_SITE_KEYS,
  seedArticleBlocks,
  seedArticleRecord,
  seedDeliveryParts,
  seedLayoutBands,
  seedLayoutSlots,
  seedNetwork,
  seedSiteSlug,
  seedTags,
  type SeedSiteKey,
} from "./seed/local-seed-data";
import { writeStaticPreview } from "./lib/static-preview.mjs";

const OUT = "docs/product/preview/blog-site.html";

/** 焼いた日を決め打ちにする理由は `write-blog-preview.tsx` の同じ定数と同じ。 */
const NOW = new Date("2026-08-28T00:00:00Z");

/**
 * シードの値だけで動く読み口。
 *
 * 保存先へは行かない。**行かないのに本物の投影を通せる**のがここの狙いで、
 * `readPublicSiteProjection` から先は本番と同じコードが走る。
 * 投影の組み立て（どの枠をヘッダーに回すか等）を写し側で書き直すと、
 * そこだけ本番と違う並びになっても見た目からは分からない。
 */
function seedPublicBlogPort(): PublicBlogPort {
  return {
    async openSite(siteSlug: string) {
      const site = sampleSites().find((candidate) => candidate.slug === siteSlug);
      if (site === undefined) return ok(null);
      const siteKey: SeedSiteKey =
        siteSlug === seedSiteSlug("sub") ? "sub" : "hub";
      // 作業場所の識別子を落とすのは application 側の 1 か所に任せる。
      // ここで自分で消すと、消し方が 2 通りになる。
      const blueprint = toPublicBlueprint(site.blueprint);

      const articles = SEED_ARTICLES.filter(
        (article) => seedArticleRecord(article, NOW).siteSlug === siteSlug,
      );
      const published = articles.filter((article) => article.status === "published");

      const reader: PublicSiteReader = {
        blueprint,
        async findArticleBySlug(slug: string) {
          const found = articles.find((article) => article.slug === slug);
          if (found === undefined) return ok(null);
          return ok({
            article: seedArticleRecord(found, NOW),
            blocks: seedArticleBlocks(found),
            tagIds: [],
          });
        },
        async listPublished(limit: number) {
          return ok(published.slice(0, limit).map((article) => seedArticleRecord(article, NOW)));
        },
        async listLayoutSlots() {
          return ok(seedLayoutSlots(siteKey));
        },
        async listLayoutBands() {
          return ok(seedLayoutBands(siteKey));
        },
        async listDeliveryParts() {
          return ok(seedDeliveryParts(siteKey));
        },
        async listNetwork() {
          return ok(seedNetwork());
        },
        async listTags() {
          return ok(seedTags().filter((tag) => tag.siteSlug === siteSlug));
        },
      };
      return ok(reader);
    },
  };
}

/** ブログ 1 本ぶんの、枠組み込みの画面。 */
async function framedSite(siteKey: SeedSiteKey): Promise<React.ReactNode> {
  const siteSlug = seedSiteSlug(siteKey);
  const projected = await readPublicSiteProjection(siteSlug, {
    source: "sample",
    port: seedPublicBlogPort(),
  });
  if (!projected.ok || projected.value === null) {
    throw new Error(`${siteSlug} の投影を作れませんでした。`);
  }
  const projection = projected.value;
  const blueprint = projection.reader.blueprint;

  const article = SEED_ARTICLES.find(
    (candidate) =>
      candidate.status === "published" &&
      seedArticleRecord(candidate, NOW).siteSlug === siteSlug,
  );
  if (article === undefined) {
    throw new Error(`${siteSlug} に公開中の記事がありません。`);
  }
  const record = seedArticleRecord(article, NOW);
  const path = siteHref(siteSlug, `/blog/${article.slug}`);

  // 脇の枠は**先に呼んで、null かどうかを見てから渡す**（`SiteFrame` と同じ順）。
  // JSX で置くと、中身が空でも段組みが出て本文が狭くなる。
  const asideNormal = blogSidebar({
    siteSlug,
    region: "sidebar",
    categories: blueprint.categories,
    projection,
  });
  const asideSticky = blogSidebar({
    siteSlug,
    region: "sidebar_sticky",
    categories: blueprint.categories,
    projection,
  });

  return (
    <SiteShell
      key={siteSlug}
      chrome={toChrome(siteSlug, blueprint, projection)}
      sidebar={asideNormal ?? undefined}
      sidebarSticky={asideSticky ?? undefined}
      currentPath={path}
      breadcrumbs={breadcrumbsFor(siteSlug, blueprint, [
        { label: "記事一覧", path: "/blog" },
        { label: "記事" },
      ])}
    >
      <SitePage title={record.title}>
        <BlogArticleView
          template={record.template}
          lead={record.lead}
          authorName={record.authorName}
          updatedAt={record.updatedAt}
          now={NOW}
          blocks={seedArticleBlocks(article)}
        />
      </SitePage>
    </SiteShell>
  );
}

async function body(): Promise<string> {
  const frames: React.ReactNode[] = [];
  for (const siteKey of SEED_SITE_KEYS) {
    frames.push(await framedSite(siteKey));
  }

  return renderToStaticMarkup(
    <SitePage
      title="見本データのブログを、枠組みごと写したもの"
      lead="開発機の D1 に入っているのと同じ版面・記事です。ブログ 2 本を、それぞれヘッダー・パンくず・脇の枠・追従枠・フッターごと描いています。"
    >
      <Callout
        tone="info"
        title="この写しに出ないもの"
        reason="明るさの切り替え・計測の同意の帯・ページ内 AI の道具は出ません。どれも読者の端末の設定を読んでから描くもので、サーバーの外では読めないためです。それらしい値を手で作って渡すと、実物と同じ見た目で実物と違う挙動のものが残るので、渡さずに空けてあります。押しても動かないのは写し全体の決まりです。"
      />
      {SEED_SITE_KEYS.map((siteKey, index) => (
        <Section
          key={siteKey}
          title={seedSiteSlug(siteKey)}
          lead={
            siteKey === "hub"
              ? "中心のブログ。タグと帯を持つ側です。"
              : "子のブログ。中心と同じ版面を敷いてあるので、欠けている枠があればそれは実装の話になります。"
          }
        >
          {frames[index]}
        </Section>
      ))}
    </SitePage>,
  );
}

async function main(): Promise<void> {
  await writeStaticPreview({
    out: OUT,
    bodyHtml: await body(),
    htmlAttributes: { lang: "ja", ...appearanceAttributes(DEFAULT_APPEARANCE) },
    generatedAt: NOW.toISOString().slice(0, 10),
    title: "静止した写し — 枠組みごとのブログ",
    source: "scripts/write-site-preview.tsx",
    writtenLabel: `ブログ ${SEED_SITE_KEYS.length} 本`,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
