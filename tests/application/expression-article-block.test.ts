/** @tier 1 @req REQ-BLOG01, REQ-BLOG05, REQ-SEO01 @types boundary, state-transition */
import { describe, expect, it } from "vitest";
import {
  composeExpressionArticleBlocks,
  expressionBlockOfArticleBlock,
  isExpressionArticleBlock,
  toExpressionArticleBlock,
} from "@/application/adapters/expression-article-block";
import type { ExpressionBlock } from "@/domain/authoring/blog-template";
import {
  createGetBlogArticleUseCase,
  createUpdateBlogArticleUseCase,
} from "@/application/usecases/blog-ops";
import { anOwner } from "../support/actors";
import { NOW } from "../support/clock";
import { recordingAuditLog } from "../support/doubles";
import { article, fakeRepository, sequentialIds } from "../support/blog-ops-fake";

const EXPRESSIONS: readonly ExpressionBlock[] = [
  { kind: "answer", text: "先に答えます。" },
  { kind: "key_points", items: ["速い", "軽い"] },
  { kind: "faq", items: [{ question: "保証は？", answer: "1 年です。" }] },
  {
    kind: "sources",
    items: [{ label: "公式仕様", url: "https://example.com/spec", checkedAt: "2026-08-31" }],
  },
  { kind: "freshness", asOf: "2026-08-31", note: "確認済み" },
  { kind: "figure", caption: "比較図", alt: "3 製品の比較" },
  { kind: "comparison", caption: "用途別の比較" },
  { kind: "cta", label: "公式サイトを見る", href: "/go/offer-1" },
  { kind: "summary", text: "用途に合うものを選びます。" },
  { kind: "spec_table", rows: [{ label: "重さ", value: "900g" }] },
];

describe("表現ブロックと公開記事ブロックの composition 境界 (A5/A12)", () => {
  it("10 種すべてを永続 carrier にし、意味を失わず読み戻す", () => {
    for (const [position, expression] of EXPRESSIONS.entries()) {
      const carrier = toExpressionArticleBlock(expression, `expression_${position}`, position);

      expect(expressionBlockOfArticleBlock(carrier)).toEqual(expression);
      expect(carrier.position).toBe(position);
    }
  });

  it("スロットは差し替え値を優先し、無いときも fallback を公開用 block に残す", () => {
    const slotted: ExpressionBlock = {
      kind: "spec_table",
      rows: [{ label: "重さ", value: "未設定" }],
      slot: { name: "gadget_spec", fallback: "仕様は確認中です。" },
    };

    const replaced = composeExpressionArticleBlocks(
      [toExpressionArticleBlock(slotted, "expression_1", 1)],
      { gadget_spec: { kind: "summary", text: "重さは 900g です。" } },
    );
    expect(expressionBlockOfArticleBlock(replaced[0])).toEqual({
      kind: "summary",
      text: "重さは 900g です。",
    });

    const fallback = composeExpressionArticleBlocks(
      [toExpressionArticleBlock(slotted, "expression_1", 1)],
      {},
    );
    expect(expressionBlockOfArticleBlock(fallback[0])).toEqual({
      kind: "summary",
      text: "仕様は確認中です。",
    });
  });

  it("通常の記事ブロックを誤って表現ブロックとして解釈しない", () => {
    expect(
      expressionBlockOfArticleBlock({
        id: "normal",
        kind: "summary-section",
        heading: "まとめ",
        body: '{"kind":"cta","href":"/go/x","label":"見る"}',
        position: 0,
      }),
    ).toBeNull();
  });

  it("prefixを持つ壊れたcarrierは通常本文へ戻さず、不正carrierとして閉じる", () => {
    const malformed = {
      id: "malformed",
      kind: "summary-section" as const,
      heading: "まとめ",
      body: "expression-block:v1:not-json",
      position: 0,
    };

    expect(isExpressionArticleBlock(malformed)).toBe(true);
    expect(expressionBlockOfArticleBlock(malformed)).toBeNull();
  });

  it("production read→writeの通常編集で、画面から隠した10種のcarrierをすべて保持する", async () => {
    const carriers = EXPRESSIONS.map((expression, index) =>
      toExpressionArticleBlock(expression, `expression_${index}`, index + 10),
    );
    const repository = fakeRepository({
      articles: [{
        article: article({ id: "article_1", template: "T4" }),
        blocks: [
          { id: "normal", kind: "intro-box", heading: "導入", body: "変更前", position: 0 },
          ...carriers,
        ],
        tagIds: [],
      }],
    });
    const deps = {
      repository: repository.port,
      ids: sequentialIds(),
      auditLog: recordingAuditLog().port,
      now: () => NOW,
    };
    const shown = await createGetBlogArticleUseCase(deps).execute(anOwner(), { articleId: "article_1" });
    expect(shown.ok && shown.value.blocks.map((block) => block.id)).toEqual(["normal"]);

    const saved = await createUpdateBlogArticleUseCase(deps).execute(anOwner(), {
      articleId: "article_1",
      blocks: [{ id: "normal", kind: "intro-box", heading: "導入", body: "変更後" }],
    });
    expect(saved.ok).toBe(true);
    expect(repository.store.articles[0]?.blocks).toEqual([
      { id: "normal", kind: "intro-box", heading: "導入", body: "変更後", position: 0 },
      ...carriers,
    ]);
  });

  it("専用appendを2回行っても、2個目の追加で1個目のcarrierを失わない", async () => {
    const repository = fakeRepository({
      articles: [{
        article: article({ id: "article_1", template: "T4" }),
        blocks: [{ id: "normal", kind: "intro-box", heading: "導入", body: "本文", position: 0 }],
        tagIds: [],
      }],
    });
    const deps = {
      repository: repository.port,
      ids: sequentialIds(),
      auditLog: recordingAuditLog().port,
      now: () => NOW,
    };
    const update = createUpdateBlogArticleUseCase(deps);
    const first = toExpressionArticleBlock(
      { kind: "answer", text: "先に答えます。" },
      "",
      0,
    );
    const second = toExpressionArticleBlock(
      { kind: "faq", items: [{ question: "保証は？", answer: "1年です。" }] },
      "",
      0,
    );

    const firstSaved = await update.execute(anOwner(), {
      articleId: "article_1",
      appendBlocks: [{ kind: first.kind, heading: first.heading, body: first.body }],
    });
    expect(firstSaved.ok).toBe(true);
    const secondSaved = await update.execute(anOwner(), {
      articleId: "article_1",
      appendBlocks: [{ kind: second.kind, heading: second.heading, body: second.body }],
    });
    expect(secondSaved.ok).toBe(true);

    const expressions = repository.store.articles[0]?.blocks
      .map(expressionBlockOfArticleBlock)
      .filter((block) => block !== null);
    expect(expressions).toEqual([
      { kind: "answer", text: "先に答えます。" },
      { kind: "faq", items: [{ question: "保証は？", answer: "1年です。" }] },
    ]);
  });
});
