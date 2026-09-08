/** @tier 1 @req REQ-BLOG01, REQ-BLOG05, REQ-SEO01 @types boundary, state-transition */
import { describe, expect, it } from "vitest";
import {
  composeExpressionArticleBlocks,
  expressionBlockOfArticleBlock,
  isExpressionArticleBlock,
  toExpressionArticleBlock,
} from "@/application/adapters/expression-article-block";
import { EXPRESSION_BLOCK_KINDS, type ExpressionBlock } from "@/domain/authoring/blog-template";
import {
  createGetBlogArticleUseCase,
  createUpdateBlogArticleUseCase,
} from "@/application/usecases/blog-ops";
import { anOwner, aWriter } from "../support/actors";
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
    expect(shown.ok && shown.value.structuredBlocks?.map((block) => block.expression)).toEqual(EXPRESSIONS);
    expect(JSON.stringify(shown)).not.toContain("expression-block:v1:");

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

  it("専用編集のread→write→readで10種の変更・見出し・順序を保ち、再保存しても重複しない", async () => {
    const edited: readonly ExpressionBlock[] = [
      { kind: "answer", text: "編集した結論です。\n補足も残します。" },
      { kind: "key_points", items: ["静か", "省電力", "取り付けやすい"] },
      { kind: "faq", items: [{ question: "交換できますか？", answer: "購入後30日以内です。\n条件があります。" }] },
      { kind: "sources", items: [{ label: "更新された公式仕様", url: "https://example.com/new-spec", checkedAt: "2026-09-06" }] },
      { kind: "freshness", asOf: "2026-09-06", note: "仕様を再確認しました。" },
      { kind: "figure", caption: "更新した比較図", alt: "2製品の違い" },
      { kind: "comparison", caption: "更新した用途別比較" },
      { kind: "cta", label: "新しい案内を見る", href: "/go/offer-2" },
      { kind: "summary", text: "改訂後のまとめです。" },
      { kind: "spec_table", rows: [{ label: "重さ", value: "850g" }, { label: "幅", value: "30cm" }] },
    ];
    expect(edited.map((expression) => expression.kind).sort()).toEqual([...EXPRESSION_BLOCK_KINDS].sort());

    const carriers = EXPRESSIONS.map((expression, index) => ({
      ...toExpressionArticleBlock(expression, `expression_${index}`, index + 1),
      heading: `独自見出し ${index + 1}`,
    }));
    const repository = fakeRepository({ articles: [{
      article: article({ id: "article_1", template: "T4" }),
      blocks: [{ id: "normal", kind: "intro-box", heading: "導入", body: "通常本文", position: 0 }, ...carriers],
      tagIds: [],
    }] });
    const deps = {
      repository: repository.port,
      ids: sequentialIds(),
      auditLog: recordingAuditLog().port,
      now: () => NOW,
    };
    const read = createGetBlogArticleUseCase(deps);
    const update = createUpdateBlogArticleUseCase(deps);
    const shown = await read.execute(anOwner(), { articleId: "article_1" });
    expect(shown.ok).toBe(true);
    if (!shown.ok) throw new Error("編集対象を読み込めませんでした");
    expect(shown.value.structuredBlocks?.map((block) => block.expression)).toEqual(EXPRESSIONS);
    expect(JSON.stringify(shown.value)).not.toContain("expression-block:v1:");

    // 管理画面と同じadapterで専用入力へ戻し、各種の値を直して並びも入れ替える。
    const editorRows = (shown.value.structuredBlocks ?? []).map((block) => ({
      ...toExpressionArticleBlock(edited.find((expression) => expression.kind === block.expression.kind)!, block.id, block.position),
      heading: `編集後 ${block.heading}`,
    })).reverse();
    const saved = await update.execute(anOwner(), {
      articleId: "article_1",
      expectedRevision: shown.value.revision,
      blocks: [...shown.value.blocks, ...editorRows],
    });
    expect(saved.ok).toBe(true);

    const reloaded = await read.execute(anOwner(), { articleId: "article_1" });
    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) throw new Error("保存後の記事を読み込めませんでした");
    const expectedStructured = editorRows.map((row, index) => ({
      id: row.id,
      heading: row.heading,
      position: index + 1,
      expression: edited[edited.length - 1 - index],
    }));
    expect(reloaded.value.structuredBlocks).toEqual(expectedStructured);
    expect(reloaded.value.blocks).toEqual(shown.value.blocks);
    expect(repository.store.articles[0]?.blocks).toHaveLength(11);
    expect(new Set(repository.store.articles[0]?.blocks.map((block) => block.id)).size).toBe(11);
    expect(JSON.stringify(reloaded.value)).not.toContain("expression-block:v1:");

    // もう一度通常の編集フォームから保存しても、旧carrierが後ろへ追加されない。
    const savedAgain = await update.execute(anOwner(), {
      articleId: "article_1",
      expectedRevision: reloaded.value.revision,
      blocks: [...reloaded.value.blocks, ...(reloaded.value.structuredBlocks ?? []).map((block) => ({
        ...toExpressionArticleBlock(block.expression, block.id, block.position),
        heading: block.heading,
      }))],
    });
    expect(savedAgain.ok).toBe(true);
    const readAgain = await read.execute(anOwner(), { articleId: "article_1" });
    expect(readAgain.ok && readAgain.value.structuredBlocks).toEqual(expectedStructured);
    expect(repository.store.articles[0]?.blocks).toHaveLength(11);
    expect(repository.store.articles[0]?.blocks.filter(isExpressionArticleBlock)).toHaveLength(10);
  });

  it("表現ブロックの専用appendでも、公開権限のない編集者は公開記事を変えられない", async () => {
    const repository = fakeRepository({
      articles: [{
        article: article({ id: "article_1", template: "T4", status: "published" }),
        blocks: [],
        tagIds: [],
      }],
    });
    const audit = recordingAuditLog();
    const carrier = toExpressionArticleBlock({ kind: "answer", text: "追記" }, "", 0);
    const result = await createUpdateBlogArticleUseCase({
      repository: repository.port,
      ids: sequentialIds(),
      auditLog: audit.port,
      now: () => NOW,
    }).execute(aWriter(), {
      articleId: "article_1",
      appendBlocks: [{ kind: carrier.kind, heading: carrier.heading, body: carrier.body }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(repository.store.articles[0]?.blocks).toEqual([]);
    expect(audit.entries()).toEqual([]);
  });
});
