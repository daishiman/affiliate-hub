/** @tier 2 @req REQ-A07 @types scenario, state-transition, db-constraint */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  AffiliatePlacement,
  BlogAffiliatePlacementPort,
} from "@/application/ports/blog-affiliate-placement";
import { expressionBlockOfArticleBlock } from "@/application/adapters/expression-article-block";
import { createReviewBlogPlacementsUseCase } from "@/application/usecases/authoring/review-blog-placements";
import { ok } from "@/domain/shared";
import { AffiliatePlacementLookup } from "@/presentation/admin/affiliate-placement-lookup";
import { BlogArticleView } from "@/presentation/site/blog-article-view";
import { anOwner } from "../support/actors";
import { NOW } from "../support/clock";
import { article, fakeRepository } from "../support/blog-ops-fake";

describe("成果リンク起点の管理 journey と 3 面一致 (A7)", () => {
  it("保存した CTA が再読込・逆引き・公開記事で同じ集合になる", async () => {
    const repository = fakeRepository({
      articles: [
        {
          article: article({
            id: "article_1",
            siteSlug: "desk-tools",
            slug: "best-stand",
            status: "published",
            publishedAt: NOW,
          }),
          blocks: [],
          tagIds: [],
        },
      ],
    });
    let rows: AffiliatePlacement[] = [];
    const placements: BlogAffiliatePlacementPort = {
      listBySite: async ({ siteSlug, knownArticleSlugs = [] }) =>
        ok(
          knownArticleSlugs.map((articleSlug) => ({
            articleSlug,
            placements: rows.filter(
              (row) => row.siteSlug === siteSlug && row.articleSlug === articleSlug,
            ),
          })),
        ),
      listByAffiliate: async ({ trackingCode }) =>
        ok(rows.filter((row) => trackingCode === undefined || row.trackingCode === trackingCode)),
      save: async (input) => {
        const linked = input as typeof input & {
          readonly publicArticleBlock?: {
            readonly articleId: string;
            readonly block: (typeof repository.store.articles)[number]["blocks"][number];
          };
        };
        if (linked.publicArticleBlock === undefined) {
          throw new Error("公開 CTA が台帳保存と同じ操作に含まれていません");
        }
        const publicArticleBlock = linked.publicArticleBlock;
        const detail = repository.store.articles.find(
          (candidate) => candidate.article.id === publicArticleBlock.articleId,
        );
        if (detail === undefined) throw new Error("記事が見つかりません");
        repository.store.articles = repository.store.articles.map((candidate) =>
          candidate.article.id !== detail.article.id
            ? candidate
            : {
                ...candidate,
                blocks: [
                  ...candidate.blocks.filter(
                    (block) => block.id !== publicArticleBlock.block.id,
                  ),
                  publicArticleBlock.block,
                ],
              },
        );
        rows = [
          ...rows.filter(
            (row) =>
              !(
                row.siteSlug === input.placement.siteSlug &&
                row.articleSlug === input.placement.articleSlug &&
                row.placement === input.placement.placement &&
                row.trackingCode === input.placement.trackingCode
              ),
          ),
          input.placement,
        ];
        return ok(input.placement);
      },
      remove: async () => ok(undefined),
    };
    const useCase = createReviewBlogPlacementsUseCase({
      placements,
      blogOps: repository.port,
    });

    const saved = await useCase.execute(anOwner(), {
      action: "save",
      siteSlug: "desk-tools",
      articleSlug: "best-stand",
      placement: "conclusion",
      trackingCode: "offer-1",
      position: 0,
    });
    expect(saved.ok).toBe(true);

    const reverse = await useCase.execute(anOwner(), {
      action: "by_affiliate",
      trackingCode: "offer-1",
    });
    expect(reverse).toMatchObject({
      ok: true,
      value: {
        kind: "by_affiliate",
        placements: [{ articleStatus: "published", trackingCode: "offer-1" }],
      },
    });

    const detail = repository.store.articles[0];
    const publicCodes = detail.blocks
      .map(expressionBlockOfArticleBlock)
      .filter((block) => block?.kind === "cta")
      .map((block) => block?.kind === "cta" ? block.href.replace("/go/", "") : "");
    const ledgerCodes = rows.map((row) => row.trackingCode ?? "");
    expect(publicCodes).toEqual(ledgerCodes);

    const html = renderToStaticMarkup(
      <BlogArticleView
        template={detail.article.template}
        lead={detail.article.lead}
        authorName={detail.article.authorName}
        updatedAt={detail.article.updatedAt}
        now={NOW}
        blocks={detail.blocks}
      />,
    );
    expect(html).toContain('href="/go/offer-1"');

    if (!reverse.ok || reverse.value.kind !== "by_affiliate") throw new Error("逆引き失敗");
    const lookup = renderToStaticMarkup(
      <AffiliatePlacementLookup
        trackingCode="offer-1"
        placements={reverse.value.placements}
      />,
    );
    expect(lookup).toContain("desk-tools");
    expect(lookup).toContain("best-stand");
    expect(lookup).toContain("公開中");
  });
});
