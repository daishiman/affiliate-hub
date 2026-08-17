import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createCompareArticleProductsUseCase,
  createExplainArticleRankingUseCase,
  createFilterArticleProductsUseCase,
  createFindArticleAlternativesUseCase,
  createGetArticleDisclosureUseCase,
  createGetArticleEvidenceUseCase,
  createGetArticleProductUseCase,
  createReadArticleRankingUseCase,
} from "@/application/usecases/site/read-article-facets";
import { defineTool } from "./define-tool";
import type { AnyToolDefinition } from "./tool-definition";

/**
 * 読者ページに載せる AI 向けの道具。
 *
 * --- なぜ `product-tools.ts` と別に置くのか ---
 * あちらは `read-product.ts`（`product.read` が要る運営側の読み取り）を呼ぶ。
 * 読者ページの画面は `read-site.ts`（権限の要らない公開の道）を通るので、
 * 同じページの中で画面と道具が別の道を向いていた。
 * これまで気づけなかったのは、同一サイトからの呼び出しが見本の管理権限へ
 * 落ちていて**たまたま通っていた**からで、`ah-2ro` でそれを止めた結果、
 * 読者の身元では 1 つも動かないことが表に出た。
 *
 * ここに置く道具は、読者ページの画面と**同じ記事**を読む。
 * だから「画面に出していない項目が道具から出る」ことが起こらない。
 *
 * --- 名前について ---
 * `reader_` を付けるのは、目録の中で運営側の同名の道具と区別するため。
 * 読者に見えるのはこちらだけで（`PAGE_TOOLS` が読者ページへ載せるのはこの名前）、
 * 運営側の `get_product` などは引き続き権限を要求する。
 *
 * --- `list_test_runs` を載せていない理由 ---
 * 検証の記録は読者ページの画面に出ていない（`PublishedArticle` にその欄が無い）。
 * 道具からだけ出せるようにすると、そこが**画面より広い出口**になる。
 * 出すのなら先に画面へ出す。残課題として記録する。
 */

const article = {
  siteSlug: z.string().min(1),
  slug: z.string().min(1),
};

const articleInput = z.object(article);
const productId = z.string().min(1);

export function readerTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const site = { sites: deps.sites, content: deps.publishedContent };

  return [
    defineTool({
      name: "reader_list_ranking",
      description:
        "いま読んでいる記事が載せている順位を返します。順位の無い記事では、空の結果と理由を返します。",
      schema: articleInput,
      readOnly: true,
      useCase: createReadArticleRankingUseCase(site),
    }),
    defineTool({
      name: "reader_explain_ranking",
      description:
        "その順位になった理由を返します。評価基準（重みと測り方）と、順位から外した商品の理由を含みます。" +
        "報酬額は評価に含みません（仕様上、含めることができません）。",
      schema: z.object({ ...article, productId: productId.optional() }),
      readOnly: true,
      useCase: createExplainArticleRankingUseCase(site),
    }),
    defineTool({
      name: "reader_get_product",
      description:
        "この記事が出している商品カード 1 枚を返します。値が無い項目も省略せずに返します。",
      schema: z.object({ ...article, productId }),
      readOnly: true,
      useCase: createGetArticleProductUseCase(site),
    }),
    defineTool({
      name: "reader_filter_products",
      description:
        "この記事の商品を言葉で絞り込みます。0 件のときは、絞り込む前の件数と理由を返します。",
      schema: z.object({
        ...article,
        text: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      readOnly: true,
      useCase: createFilterArticleProductsUseCase(site),
    }),
    defineTool({
      name: "reader_find_alternatives",
      description:
        "この記事の中の、ほかの選択肢を返します。記事の外から商品を持って来ることはしません。",
      schema: z.object({ ...article, productId }),
      readOnly: true,
      useCase: createFindArticleAlternativesUseCase(site),
    }),
    defineTool({
      name: "reader_compare_products",
      description:
        "この記事が出している比較表をそのまま返します。比較表の無い記事では、空の結果と理由を返します。",
      schema: articleInput,
      readOnly: true,
      useCase: createCompareArticleProductsUseCase(site),
    }),
    defineTool({
      name: "reader_get_evidence",
      description:
        "この記事の言い切りと、その根拠を返します。事実・推測・意見の区別つき。" +
        "根拠の無い言い切りも隠さずに返します。",
      schema: z.object({ ...article, claimId: z.string().min(1).optional() }),
      readOnly: true,
      useCase: createGetArticleEvidenceUseCase(site),
    }),
    defineTool({
      name: "reader_get_disclosure",
      description:
        "この記事が広告であることの表示を出しているかと、このブログの広告方針を返します。",
      schema: articleInput,
      readOnly: true,
      useCase: createGetArticleDisclosureUseCase(site),
    }),
  ];
}
