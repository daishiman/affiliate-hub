/**
 * 見本データで作ったブログ記事を、読者側の見た目のまま 1 枚の HTML に焼く。
 *
 * ```
 * pnpm run preview:blog
 * ```
 *
 * 共通の CSS 取得・安全判定・書き出しは `scripts/lib/static-preview.mjs` が担う。
 * この writer が決めるのは、記事の本体と写し固有のメタデータだけである。
 *
 * **本物**: 記事の本体の描き方、目次の段、商品カードを再掲する場所、
 * 鮮度の一言、広告表記。どれもアプリが描いているのと同じ部品を、
 * **同じ引数**で呼んでいる。
 *
 * **本物でない**: 枠組み（ヘッダー・脇の枠・フッター）はここに出ない。
 * `SiteFrame` は request の cookie（明るさ・同意）と保存先の読み口を要るので、
 * サーバーの外では描けない。**それらしく手で描くこともしない。**
 * 手で描くと、実物と違う枠が「これが実物です」という顔で残る。
 *
 * ## データの出どころ
 *
 * 記事も部品も `scripts/seed/local-seed-data.ts` から取る。**この写しのために
 * 別の見本を書かない。**書くと、写しに出ている記事が D1 に無い状態が作れてしまい、
 * 写しのほうだけ正しく見える。部品の並びは `seedArticleBlocks` が 1 か所で決めており、
 * `pnpm seed:local` が D1 へ入れるものと同じ関数から来ている。
 */

import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_APPEARANCE } from "@/domain/authoring/appearance";
import { appearanceAttributes } from "@/presentation/ui/appearance";
import { ARTICLE_TEMPLATE_LABEL } from "@/domain/blogops";
import { BlogArticleView } from "@/presentation/site/blog-article-view";
import { Callout, Section, SitePage } from "@/presentation/ui";
import {
  SEED_ARTICLES,
  SEED_HUB_SLUG,
  SEED_SUB_SLUG,
  seedArticleBlocks,
  type SeedArticle,
} from "./seed/local-seed-data";
import { writeStaticPreview } from "./lib/static-preview.mjs";

const OUT = "docs/product/preview/blog-articles.html";

/**
 * 焼いた日を決め打ちにする。
 *
 * **`new Date()` を使わない。**使うと、同じ見本データから焼いても
 * 焼くたびに「1 年以上更新されていません」の出る記事が入れ替わり、
 * 差分が毎回出る。ここを固定すると、差分が出たときは中身が変わったとき
 * だけになる。鮮度の見え方（3 日前・400 日前）はこの日を基準に決まる。
 */
const NOW = new Date("2026-08-28T00:00:00Z");

/** 記事がどの軸の見本なのかを、読む人に 1 文で渡す。 */
function axisNote(article: SeedArticle): string {
  const blocks = seedArticleBlocks(article);
  const parts = [
    `記事型 ${article.template}（${ARTICLE_TEMPLATE_LABEL[article.template]}）`,
    `状態 ${article.status}`,
    `部品 ${blocks.length} 個`,
    `票 ${article.ratings.length} 件`,
    `更新 ${article.daysAgo} 日前`,
    `ブログ ${article.site === "sub" ? SEED_SUB_SLUG : SEED_HUB_SLUG}`,
  ];
  if (article.missing.length > 0) parts.push(`必須を欠く: ${article.missing.join("・")}`);
  if (article.tagIds?.length === 0) parts.push("タグ無し");
  return parts.join(" / ");
}

function body(): string {
  return renderToStaticMarkup(
    <SitePage
      title="見本データで作ったブログ記事"
      lead="ここに出ているのは、開発機の D1 に入っているのと同じ記事です。記事の本体だけを、読者側の部品でそのまま描いています。枠組み（ヘッダー・脇の枠・フッター）は出ません。"
    >
      <Callout
        tone="info"
        title="この写しに出ないもの"
        reason="ヘッダー・脇の枠・フッターは出ません。読者の端末の設定と保存先の読み口が要るので、サーバーの外では描けないためです。それらしく手で描くと、実物と違う枠が実物の顔で残るので、描かずに空けてあります。枠の中身そのものは開発機の D1 に入っているので、pnpm dev で開けば出ます。"
      />
      {SEED_ARTICLES.map((article) => {
        const updatedAt = new Date(NOW.getTime() - article.daysAgo * 24 * 60 * 60 * 1000);
        return (
          <Section key={article.id} title={article.title} lead={axisNote(article)}>
            <BlogArticleView
              template={article.template}
              lead={article.lead}
              authorName="ローカル検証用の担当者"
              updatedAt={updatedAt}
              now={NOW}
              blocks={seedArticleBlocks(article)}
            />
          </Section>
        );
      })}
    </SitePage>,
  );
}

async function main(): Promise<void> {
  await writeStaticPreview({
    out: OUT,
    bodyHtml: body(),
    htmlAttributes: { lang: "ja", ...appearanceAttributes(DEFAULT_APPEARANCE) },
    generatedAt: NOW.toISOString().slice(0, 10),
    title: "静止した写し — 見本データで作ったブログ記事",
    source: "scripts/write-blog-preview.tsx",
    writtenLabel: `記事 ${SEED_ARTICLES.length} 本`,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
