/**
 * @tier 1
 * @req REQ-P08, REQ-R11
 * @types audit-log, permission-matrix, equivalence
 */
import { beforeEach, describe, expect, it } from "vitest";
import type {
  EditorialArticleOfferPort,
  EditorialPublishedArticleWriterPort,
  EditorialSiteRepositoryPort,
} from "@/application/ports/site";
import type { ArticleOffer } from "@/application/read-models/article-offer";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { PublicationRepositoryPort } from "@/application/ports/distribution";
import type {
  EditorialContentPackageRepositoryPort,
  EditorialContentVariantRepositoryPort,
} from "@/application/ports/authoring";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { auditArticleForAiSearch } from "@/application/seo/ai-search-audit";
import {
  type AuditArticleDraftOutput,
  type PreparePublishArticleInput,
  type PublishArticleFormOptions,
  type PublishArticleInput,
  type PublishArticleOutput,
  articleDraftWarnings,
  createAuditArticleDraftUseCase,
  createPreparePublishArticleUseCase,
  createPublishArticleUseCase,
} from "@/application/usecases/site/publish-article";
import { ARTICLE_TYPES, authoredSectionsFor, createSiteBlueprint } from "@/domain/authoring";
import type { ContentPackage, ContentVariant, SiteBlueprint } from "@/domain/authoring";
import type { Publication } from "@/domain/distribution";
import {
  type BrandId,
  type ContentVariantId,
  type Result,
  type WorkspaceId,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";
import type { AuditLogEntry } from "@/domain/compliance";
import { OTHER_WORKSPACE, WORKSPACE, anOwner, aWriter } from "../support/actors";
import { aPublication } from "../support/factories";
import { failing, recordingAuditLog, testDeps } from "../support/doubles";

/**
 * 記事を読者ページへ出す操作。
 *
 * ここで守りたいのは 2 つ。
 *   1. 公開できていないのに「公開しました」と言わない
 *   2. 公開できない理由を、直せる言葉で返す（「invalid」では直せない）
 *
 * 見ているのは返り値の形ではなく、**保存先へ何が渡ったか**と
 * **配信の記録がどう変わったか**。
 */

const SITE_SLUG = "video-editing-gear";
const VARIANT_ID = taggedString<"ContentVariantId">("cv_publish_me") as ContentVariantId;
const PACKAGE_ID = taggedString<"ContentPackageId">("cp_publish_me");
const BRAND_ID = taggedString<"BrandId">("brand-publish") as BrandId;

function aPackage(over: Partial<ContentPackage> = {}): ContentPackage {
  return {
    id: PACKAGE_ID,
    workspaceId: WORKSPACE,
    brandId: String(BRAND_ID),
    campaignId: null,
    primarySubjectId: taggedString<"ProductId">("product-publish"),
    domainScope: "general",
    comparisonSetId: null,
    claimIds: [],
    evidenceIds: [],
    authorPersonaId: taggedString<"AuthorPersonaId">("author_yamada"),
    audiencePersonaIds: [taggedString<"AudiencePersonaId">("aud_1")],
    objective: "読者が商品を選べるようにする",
    funnelStage: "decision",
    contentAngles: ["conclusion_first"],
    masterBriefId: null,
    variantIds: [VARIANT_ID],
    status: "approved",
    ...over,
  } as ContentPackage;
}

function aBlueprint(over: Partial<SiteBlueprint> = {}): SiteBlueprint {
  const built = createSiteBlueprint({
    id: taggedString<"SiteBlueprintId">("sb_test"),
    workspaceId: WORKSPACE,
    name: "動画編集の道具",
    pattern: "specialist_review",
    purpose: "動画編集をする人が道具を選べるようにする",
    genre: "動画編集",
    revenueModel: "affiliate",
    categories: [
      { slug: "laptop", name: "ノートパソコン", oneLine: "書き出しの速さで選ぶ", initialArticleTypes: ["ranking"] },
    ],
    differentiation: {
      targetReader: "動画編集をする人",
      searchIntent: "買う前に比べたい",
      articlePurpose: "選べるようにする",
      evaluationAxis: "書き出し時間",
      usageScene: "自宅の作業机",
      uniqueExperience: "同一素材での実測",
      comparisonScope: "15 万円以下",
      conclusionStance: "1 つを名指しで薦める",
      internalLinkStrategy: "順位から個別レビューへ",
      ctaStrategy: "販売店を複数出す",
    },
  });
  if (!built.ok) throw new Error(built.error.message);
  return { ...built.value, ...over };
}

function aVariant(over: Partial<ContentVariant> = {}): ContentVariant {
  return {
    id: VARIANT_ID,
    workspaceId: WORKSPACE,
    contentPackageId: PACKAGE_ID,
    channel: "own_site",
    format: "article",
    authorPersonaId: taggedString<"AuthorPersonaId">("author_yamada"),
    audiencePersonaId: taggedString<"AudiencePersonaId">("aud_1"),
    angle: "conclusion_first",
    title: "静かなノートパソコンの選び方",
    body: "結論から書く。\n\n書き出しの速さで選ぶ。",
    summary: "書き出しの速さで選ぶ。",
    cta: "check_official",
    disclosure: "この記事には広告が含まれます。",
    affiliateLinkIds: [],
    claimIds: [],
    evidenceIds: [],
    assumptions: [],
    platformWarnings: [],
    factualityScore: 0.9,
    personaFitScore: 0.8,
    channelFitScore: 0.8,
    complianceStatus: "pass",
    generationPromptVersion: "v1",
    modelId: "test",
    status: "approved",
    ...over,
  } as ContentVariant;
}

/** 必須の節を全部埋めた入力。個々のテストは、ここから 1 つだけ崩す。 */
function fullInput(over: Partial<PublishArticleInput> = {}): PublishArticleInput {
  const bodies: Record<string, string> = {};
  for (const s of authoredSectionsFor("guide")) {
    bodies[s.id] = `${s.label}の中身。`;
  }
  return {
    publicationId: "pub_own",
    siteSlug: SITE_SLUG,
    categorySlug: "laptop",
    articleType: "guide",
    slug: "quiet-laptop",
    title: "静かなノートパソコンの選び方",
    conclusion: "寝室で使うなら動作音 30dB 以下を選ぶ。",
    authorName: "山田",
    authorBio: "動画編集を 10 年やっている。",
    authorCredentials: ["映像編集技能検定 1 級"],
    relationshipType: "affiliate",
    disclosureMessage: "この記事には広告が含まれます。",
    nextReviewOn: "2027-01-31",
    claims: [
      {
        statement: "動作音 30dB 以下なら寝室でも気にならない。",
        sourceLabel: "自宅での実測",
        sourceUrl: null,
        checkedOn: "2026-08-01",
      },
    ],
    sectionBodies: bodies,
    ...over,
  };
}

type Harness = {
  readonly saved: PublishedArticle[];
  readonly publications: Publication[];
  /** 操作の記録に何が積まれたか。公開は取り返しがつかないので、ここを必ず見る。 */
  readonly audit: () => readonly AuditLogEntry[];
  readonly run: (
    input?: Partial<PublishArticleInput>,
    actor?: ReturnType<typeof anOwner>,
    // 出力の形は本物の型をそのまま使う。ここで書き写すと、
    // 「返しているのに読めない」欄が生まれ、検査がすり抜ける。
  ) => Promise<Result<PublishArticleOutput, ReturnType<typeof domainError>>>;
  readonly prepare: (
    input?: Partial<PreparePublishArticleInput>,
    actor?: ReturnType<typeof anOwner>,
  ) => Promise<Result<PublishArticleFormOptions, ReturnType<typeof domainError>>>;
  /** 出す前の点検（REQ-SEO03）。何も保存しない道。 */
  readonly check: (
    input?: Partial<PublishArticleInput>,
    actor?: ReturnType<typeof anOwner>,
  ) => Promise<Result<AuditArticleDraftOutput, ReturnType<typeof domainError>>>;
};

function harness(options: {
  readonly publication?: Publication;
  readonly variant?: ContentVariant | null;
  readonly contentPackage?: ContentPackage | null;
  readonly sites?: readonly { readonly slug: string; readonly blueprint: SiteBlueprint }[];
  readonly writerFails?: boolean;
  /** 記録だけが落ちる状況。記事は出ているのに記録が無い、を作って確かめる。 */
  readonly auditFails?: boolean;
  /** 成果リンクの引き当てが返すもの。ID → 写し。 */
  readonly offers?: Readonly<Record<string, ArticleOffer>>;
  /** 成果リンクの保存先が落ちている状況。 */
  readonly offersFail?: boolean;
} = {}): Harness {
  const saved: PublishedArticle[] = [];
  const publications: Publication[] = [];
  const publication =
    options.publication ??
    aPublication({
      id: taggedString<"PublicationId">("pub_own"),
      variantId: VARIANT_ID,
      channelKind: "own_site",
      state: "QUEUED",
      attempts: 0,
      publishedAt: null,
    });

  const siteRows = options.sites ?? [{ slug: SITE_SLUG, blueprint: aBlueprint() }];
  const sites = {
    async findBySlug(slug: string) {
      return ok(siteRows.find((entry) => entry.slug === slug)?.blueprint ?? null);
    },
    async list() {
      return ok(siteRows);
    },
  } as unknown as EditorialSiteRepositoryPort;

  const variants = {
    async findById() {
      return ok(options.variant === undefined ? aVariant() : options.variant);
    },
  } as unknown as EditorialContentVariantRepositoryPort;

  const contentPackage = options.contentPackage === undefined ? aPackage() : options.contentPackage;
  const packages = {
    async findById(workspaceId: WorkspaceId, id: string) {
      const hit =
        contentPackage !== null &&
        workspaceId === contentPackage.workspaceId &&
        String(id) === String(contentPackage.id);
      return ok(hit ? contentPackage : null);
    },
  } as unknown as EditorialContentPackageRepositoryPort;

  const pubs = {
    async findById(workspaceId: WorkspaceId, id: string) {
      // 作業場所と ID の両方で引く。ID を見ないと「無い配信」を試せない。
      const hit = workspaceId === publication.workspaceId && String(id) === String(publication.id);
      return ok(hit ? publication : null);
    },
    async save(p: Publication) {
      publications.push(p);
      return ok(p);
    },
  } as unknown as PublicationRepositoryPort;

  const articles = {
    async save(_workspaceId: WorkspaceId, article: PublishedArticle) {
      if (options.writerFails) {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "記事の保存先につながりませんでした。", {
            suggestedAction: "少し時間をおいて、もう一度お試しください。",
          }),
        );
      }
      saved.push(article);
      return ok(true as const);
    },
  } as unknown as EditorialPublishedArticleWriterPort;

  const offers = {
    async listByIds(_workspaceId: WorkspaceId, ids: readonly string[]) {
      if (options.offersFail) {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "成果リンクの保存先につながりませんでした。", {
            suggestedAction: "少し時間をおいて、もう一度お試しください。",
          }),
        );
      }
      const table = options.offers ?? {};
      // 見つからない ID は返さない（本物の実装と同じ約束）。
      return ok(ids.map((id) => table[id]).filter((o): o is ArticleOffer => o !== undefined));
    },
  } as unknown as EditorialArticleOfferPort;

  const auditLog = recordingAuditLog();
  const base = testDeps();
  // 記録の口だけ差し替えた偽物を三項で作ると、型が「本物 | 差し替え」の
  // 和に広がって、同じ組み立てを 2 つのユースケースへ渡せなくなる。
  // 先に `AuditLogPort` として畳んでおく。
  const auditPort: AuditLogPort = options.auditFails
    ? { ...auditLog.port, append: async () => failing("記録の保存先に繋がりません。") }
    : auditLog.port;
  const publishDeps = {
    sites,
    packages,
    variants,
    publications: pubs,
    articles,
    offers,
    ids: base.ids,
    auditLog: auditPort,
  };
  const uc = createPublishArticleUseCase(publishDeps);
  // 出す前の点検。**公開と同じ依存**を渡す。別の組み立てを渡すと、
  // 点検が見ている記事と実際に出る記事が違っていても気づけない。
  const checkUc = createAuditArticleDraftUseCase(publishDeps);
  const prepareUc = createPreparePublishArticleUseCase({
    sites,
    packages,
    variants,
    publications: pubs,
    ids: base.ids,
    auditLog: auditLog.port,
  });
  return {
    saved,
    publications,
    audit: auditLog.entries,
    run: (input = {}, actor = anOwner()) => uc.execute(actor, fullInput(input)) as never,
    check: (input = {}, actor = anOwner()) => checkUc.execute(actor, fullInput(input)) as never,
    prepare: (input = {}, actor = anOwner()) =>
      prepareUc.execute(actor, { publicationId: "pub_own", ...input }),
  };
}

let h: Harness;
beforeEach(() => {
  h = harness();
});

describe("そろっているときの公開", () => {
  it("担当外ブランドの記事はIDを知っていても公開準備も公開もできない", async () => {
    const actor = anOwner({
      scopedBrandIds: [taggedString<"BrandId">("brand-outside") as BrandId],
    });
    const prepared = await h.prepare({}, actor);
    const published = await h.run({}, actor);
    expect(prepared.ok).toBe(false);
    expect(published.ok).toBe(false);
    if (!prepared.ok) expect(prepared.error.code).toBe("TENANT_MISMATCH");
    if (!published.ok) expect(published.error.code).toBe("TENANT_MISMATCH");
    expect(h.saved).toEqual([]);
  });

  it("担当ブランドの記事でもブランド対応の無いブログ先は限定担当者に返さない", async () => {
    const actor = anOwner({ scopedBrandIds: [BRAND_ID] });
    const prepared = await h.prepare({}, actor);
    const published = await h.run({}, actor);
    expect(prepared.ok).toBe(false);
    expect(published.ok).toBe(false);
    if (!prepared.ok) expect(prepared.error.code).toBe("TENANT_MISMATCH");
    if (!published.ok) expect(published.error.code).toBe("TENANT_MISMATCH");
    expect(h.saved).toEqual([]);
  });

  it("読者が開く URL を返す", async () => {
    const result = await h.run();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.url).toBe("/s/video-editing-gear/guides/quiet-laptop");
  });

  it("読者に見せる形で保存先へ渡る（タイトル・結論・広告表記・書き手）", async () => {
    await h.run();
    expect(h.saved).toHaveLength(1);
    const article = h.saved[0];
    expect(article.title).toBe("静かなノートパソコンの選び方");
    expect(article.summary).toBe("寝室で使うなら動作音 30dB 以下を選ぶ。");
    expect(article.disclosureRequired).toBe(true);
    expect(article.author.name).toBe("山田");
    expect(article.author.credentials).toEqual(["映像編集技能検定 1 級"]);
  });

  it("書いた節がそのまま記事の節になる", async () => {
    await h.run();
    const ids = h.saved[0].sections.map((s) => s.id);
    for (const s of authoredSectionsFor("guide")) {
      expect(ids).toContain(s.id);
    }
  });

  it("言い切りには根拠が付く（根拠の無い言い切りを作らない）", async () => {
    await h.run();
    const claims = h.saved[0].sections.flatMap((s) => s.claims ?? []);
    expect(claims).toHaveLength(1);
    expect(claims[0].evidence[0].sourceLabel).toBe("自宅での実測");
    expect(claims[0].evidence[0].checkedAt).toBe("2026-08-01");
  });

  it("出典の URL を書いた根拠は、リンク先ごと記事に残る", async () => {
    // 出典名だけ残して URL を落とすと、読者は確かめに行けない。
    await h.run({
      claims: [
        {
          statement: "書き出し時間は 4 分 12 秒でした。",
          sourceLabel: "メーカーの仕様表",
          sourceUrl: "https://example.invalid/spec",
          checkedOn: "2026-08-01",
        },
      ],
    });
    const evidence = h.saved[0].sections.flatMap((s) => s.claims ?? [])[0].evidence[0];
    expect(evidence.url).toBe("https://example.invalid/spec");
  });

  /**
   * よくある質問。片方だけの行を落とすのは**ここ**の仕事。
   * 画面で落とすと、AI 経由の公開（同じ入力の型を使う）だけが素通りする。
   */
  it("問いと答えが揃った行だけが記事に残る", async () => {
    await h.run({
      faq: [
        { question: "  予算はいくら?  ", answer: "  10 万円台から。  " },
        { question: "保証は?", answer: "   " },
        { question: "", answer: "答えだけの行。" },
      ],
    });
    expect(h.saved[0].faq).toEqual([{ question: "予算はいくら?", answer: "10 万円台から。" }]);
  });

  it("よくある質問が 1 件も無ければ、欄そのものを作らない", async () => {
    // 空配列で入れると、画面の「あるか」の判定が真になり、
    // 見出しだけの空欄が読者に出る。
    await h.run({ faq: [] });
    expect(h.saved[0].faq).toBeUndefined();
    await h.run({ faq: [{ question: "問いだけ", answer: "" }] });
    expect(h.saved.at(-1)?.faq).toBeUndefined();
  });

  it("見本の印を付けない（本物と見本を取り違えない）", async () => {
    await h.run();
    expect(h.saved[0].stub).toBeUndefined();
  });

  it("配信の記録が公開済みになり、読者の URL が残る", async () => {
    await h.run();
    const last = h.publications.at(-1);
    expect(last?.state).toBe("PUBLISHED");
    expect(last?.externalUrl).toBe("/s/video-editing-gear/guides/quiet-laptop");
    expect(last?.publishedAt).not.toBeNull();
  });

  it("検査できなかった項目を隠さず返す", async () => {
    const result = await h.run();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.skipped.length).toBeGreaterThan(0);
  });
});

/*
 * 公開は取り消しても「出た」事実が消せない。
 * だから「誰が出したか」は、出した記事そのものと同じだけ大事になる。
 */
describe("公開したことの記録", () => {
  it("誰が・どの記事を出したかが残る", async () => {
    await h.run();
    const entries = h.audit();
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("content.published");
    expect(entries[0].targetType).toBe("published_article");
    expect(entries[0].targetId).toBe("quiet-laptop");
    // 読者が開く URL を残す。後から「どれのことか」を人が確かめられる形にする。
    expect(entries[0].after).toMatchObject({
      url: "/s/video-editing-gear/guides/quiet-laptop",
    });
  });

  it("本文は記録に入れない（正本を 2 つ作らない）", async () => {
    await h.run();
    const after = JSON.stringify(h.audit()[0].after);
    expect(after).not.toContain("寝室で使うなら");
  });

  it("記録を残せなかったときは、公開を成功として返さない", async () => {
    const failingAudit = harness({ auditFails: true });
    const result = await failingAudit.run();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 記事はもう出ている。それを隠すと、押した人はもう一度押す。
    expect(result.error.message).toContain("読者ページへ出ています");
    expect(result.error.message).toContain("記録");
    expect(failingAudit.saved).toHaveLength(1);
  });

  it("公開に失敗したときは、記録も残さない", async () => {
    const brokenWriter = harness({ writerFails: true });
    const result = await brokenWriter.run();

    expect(result.ok).toBe(false);
    // 出ていない記事を「出した」と書いた記録が残るのがいちばん困る。
    expect(brokenWriter.audit()).toHaveLength(0);
  });
});

describe("公開できないとき", () => {
  it("公開の権限が無い人は実行できない", async () => {
    const result = await h.run({}, aWriter());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(h.saved).toHaveLength(0);
  });

  it("必須の節が空だと、足りない項目の名前が理由に出る", async () => {
    const bodies = { ...fullInput().sectionBodies, steps: "" };
    const result = await h.run({ sectionBodies: bodies });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("全手順");
    expect(h.saved).toHaveLength(0);
  });

  it("広告との関係があるのに表示文が無いと公開できない", async () => {
    const result = await h.run({ disclosureMessage: "  " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("広告");
  });

  it("言い切りが 1 つも無いと公開できない", async () => {
    const result = await h.run({ claims: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("主張");
  });

  it("次回確認日が無いと公開できない", async () => {
    const result = await h.run({ nextReviewOn: null });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("次回確認日");
  });

  it("無いブログを指定したら公開できない", async () => {
    const result = await h.run({ siteSlug: "no-such-site" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("ブログ");
  });

  it("別の作業場所が持つブログには公開できない", async () => {
    const other = harness({
      sites: [
        {
          slug: SITE_SLUG,
          blueprint: aBlueprint({ workspaceId: OTHER_WORKSPACE }),
        },
      ],
    });

    const result = await other.run();

    expect(result.ok).toBe(false);
    expect(other.saved).toHaveLength(0);
  });

  it("そのブログに無いカテゴリーは選べない", async () => {
    const result = await h.run({ categorySlug: "no-such-category" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("カテゴリー");
  });

  it("URL の名前に使えない文字は断る", async () => {
    const result = await h.run({ slug: "静かな パソコン" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("URL");
  });

  it("自社サイト以外の配信からは実行できない", async () => {
    const other = harness({
      publication: aPublication({
        id: taggedString<"PublicationId">("pub_own"),
        variantId: VARIANT_ID,
        channelKind: "x",
        state: "QUEUED",
        attempts: 0,
        publishedAt: null,
      }),
    });
    const result = await other.run();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(other.saved).toHaveLength(0);
  });

  it("もとの記事が見つからないときは公開しない", async () => {
    const other = harness({ variant: null });
    const result = await other.run();
    expect(result.ok).toBe(false);
    expect(other.saved).toHaveLength(0);
  });

  it("保存先が落ちているときは「公開しました」と言わない", async () => {
    const other = harness({ writerFails: true });
    const result = await other.run();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).not.toMatch(/^[A-Z_]+$/);
    // 配信の記録も公開済みにしない。読者ページに無いものを「出した」と残さない。
    expect(other.publications.some((p) => p.state === "PUBLISHED")).toBe(false);
  });

  it("結論が空だと公開できない", async () => {
    // 結論の無い記事は、読者が最後まで読んでも何も決められない。
    const result = await h.run({ conclusion: "   " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).not.toMatch(/^[A-Z_]+$/);
    expect(h.saved).toHaveLength(0);
  });

  it("次に見直す日が日付として読めない形なら公開できない", async () => {
    // 「来年ごろ」のような書き方を通すと、見直しの期限が誰にも分からなくなる。
    const result = await h.run({ nextReviewOn: "来年ごろ" });
    expect(result.ok).toBe(false);
    expect(h.saved).toHaveLength(0);
  });

  it("すでに公開済みの配信は、もう一度は出せない", async () => {
    const other = harness({
      publication: aPublication({
        id: taggedString<"PublicationId">("pub_own"),
        variantId: VARIANT_ID,
        channelKind: "own_site",
        state: "PUBLISHED",
      }),
    });
    const result = await other.run();
    expect(result.ok).toBe(false);
    expect(other.saved).toHaveLength(0);
  });
});

/**
 * 出す前の画面に出すもの。
 *
 * ここを見ている理由は、**入力欄を種類ごとに手で並べないため**。
 * 手で並べると、記事の構成を 1 つ直した日に、直った種類と直っていない種類が
 * 同じ画面に混ざる。欄の一覧が構成表から出ていることをここで固定する。
 */
describe("出す前の画面に出すもの", () => {
  it("原稿の欄は記事の構成表から作られる", async () => {
    const result = await h.prepare();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const guide = result.value.articleTypes.find((t) => t.value === "guide");
    expect(guide?.sections.map((s) => s.id)).toEqual(
      authoredSectionsFor("guide").map((s) => s.id),
    );
  });

  it("欄は種類ごとに違い、全種類ぶんが一度に渡る", async () => {
    // 一度に渡す理由: 種類を選び直すたびに読み直すと、書きかけの原稿が消える。
    const result = await h.prepare();
    if (!result.ok) throw new Error("準備に失敗しました");
    const byType = new Map(result.value.articleTypes.map((t) => [t.value, t]));
    expect([...byType.keys()]).toEqual([...ARTICLE_TYPES]);
    expect(byType.get("guide")?.sections.map((s) => s.id)).toContain("steps");
    expect(byType.get("review")?.sections.map((s) => s.id)).not.toContain("steps");
  });

  it("欄には「何を書くか」の説明が付く（見出しだけでは書けない）", async () => {
    const result = await h.prepare();
    if (!result.ok) throw new Error("準備に失敗しました");
    for (const type of result.value.articleTypes) {
      expect(type.label.trim()).not.toBe("");
      expect(type.sections.length).toBeGreaterThan(0);
      for (const section of type.sections) {
        expect(section.label.trim()).not.toBe("");
        expect(section.purpose.trim()).not.toBe("");
      }
    }
  });

  it("出し先のブログとカテゴリーを選べる", async () => {
    const result = await h.prepare();
    if (!result.ok) throw new Error("準備に失敗しました");
    expect(result.value.siteOptions.map((s) => s.slug)).toEqual([SITE_SLUG]);
    expect(result.value.siteOptions[0].categories.map((c) => c.slug)).toEqual(["laptop"]);
  });

  it("出し先には、自分の作業場所が持つブログだけを並べる", async () => {
    const other = harness({
      sites: [
        { slug: SITE_SLUG, blueprint: aBlueprint() },
        {
          slug: "other-company-site",
          blueprint: aBlueprint({
            workspaceId: OTHER_WORKSPACE,
            name: "別の会社のブログ",
          }),
        },
      ],
    });

    const result = await other.prepare();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.siteOptions.map((site) => site.slug)).toEqual([SITE_SLUG]);
  });

  it("広告との関係は、読者へ出す文そのものを選ばせる", async () => {
    const result = await h.prepare();
    if (!result.ok) throw new Error("準備に失敗しました");
    const affiliate = result.value.relationshipOptions.find((o) => o.value === "affiliate");
    expect(affiliate?.label).toBe("アフィリエイト広告を利用しています");
    // 自費購入も選べる（広告表記が要らない場合を「未設定」と区別する）。
    expect(result.value.relationshipOptions.map((o) => o.value)).toContain("purchased");
  });

  it("もとの記事から初期値を写す（同じことを 2 回打たせない）", async () => {
    const result = await h.prepare();
    if (!result.ok) throw new Error("準備に失敗しました");
    expect(result.value.prefill.title).toBe("静かなノートパソコンの選び方");
    expect(result.value.prefill.conclusion).toBe("書き出しの速さで選ぶ。");
    expect(result.value.prefill.disclosureMessage).toBe("この記事には広告が含まれます。");
    expect(result.value.prefill.body).toContain("結論から書く。");
  });

  it("公開の権限が無い人には出さない", async () => {
    const result = await h.prepare({}, aWriter() as never);
    expect(result.ok).toBe(false);
  });

  it("もとの記事が無いときは、初期値を作らずに断る", async () => {
    // 空の欄を並べて「書けます」と見せると、どの記事の話か分からないまま出せてしまう。
    const other = harness({ variant: null });
    const result = await other.prepare();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).not.toMatch(/^[A-Z_]+$/);
  });

  it("もとの記事にタイトルが無ければ、初期値は空にする", async () => {
    // 「無題」などを勝手に入れない。入れると、直さずにそのまま出される。
    const other = harness({ variant: aVariant({ title: null }) });
    const result = await other.prepare();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.prefill.title).toBe("");
  });

  it("配信が無いときは、直せる言葉で断る", async () => {
    const result = await h.prepare({ publicationId: "pub_missing" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).not.toMatch(/^[A-Z_]+$/);
    expect(result.error.suggestedAction ?? "").not.toBe("");
  });
});

/*
 * 版が持つ成果リンクが、読者の見る記事まで届いているか。
 *
 * ここが 0 件だと、計測の下流（合言葉の発行・`/go/` の転送・突合）が
 * すべて 0 のままになる。**記事としては成立して見える**ので、
 * 画面を見て気づくことはできない（残課題 58）。
 */
describe("版の成果リンクが読者の記事に出る", () => {
  const LINK_ID = "lnk_amazon_pc";

  function anOffer(over: Partial<ArticleOffer> = {}): ArticleOffer {
    return {
      affiliateLinkId: LINK_ID,
      productId: "p_alpha_15",
      productName: "Alpha Studio 15",
      brand: "Alpha",
      oneLine: "書き出しが速い。",
      destinationUrl: "https://example.invalid/asp/amazon/p_alpha_15",
      ...over,
    };
  }

  function withLinks(
    ids: readonly string[],
    table: Readonly<Record<string, ArticleOffer>>,
    extra: Parameters<typeof harness>[0] = {},
  ): Harness {
    return harness({ variant: aVariant({ affiliateLinkIds: ids as never }), offers: table, ...extra });
  }

  it("成果リンクを持つ版から、商品カードができる", async () => {
    const h2 = withLinks([LINK_ID], { [LINK_ID]: anOffer() });
    const result = await h2.run();
    expect(result.ok).toBe(true);

    const cards = h2.saved[0].productCards ?? [];
    expect(cards).toHaveLength(1);
    expect(cards[0].name).toBe("Alpha Studio 15");
    expect(cards[0].productId).toBe("p_alpha_15");
  });

  it("ASP が発行した URL を 1 文字も変えずに載せる", async () => {
    // 印を足すと多くの ASP で規約違反になり、成果そのものが計上されない。
    const url = "https://example.invalid/asp/amazon/p_alpha_15?x=1";
    const h2 = withLinks([LINK_ID], { [LINK_ID]: anOffer({ destinationUrl: url }) });
    await h2.run();
    expect(h2.saved[0].productCards?.[0].affiliateUrl).toBe(url);
  });

  it("版が並べた順のまま出す", async () => {
    const second = anOffer({
      affiliateLinkId: "lnk_direct_soft",
      productId: "p_delta_13",
      productName: "Delta Light 13",
    });
    const h2 = withLinks([LINK_ID, "lnk_direct_soft"], {
      [LINK_ID]: anOffer(),
      lnk_direct_soft: second,
    });
    await h2.run();
    expect(h2.saved[0].productCards?.map((c) => c.productId)).toEqual(["p_alpha_15", "p_delta_13"]);
  });

  it("出せないリンクは URL を載せず、理由を載せる", async () => {
    // 黙って消すと、読者には「貼り忘れ」と区別が付かない。
    const blocked = anOffer({ destinationUrl: undefined, blockedReason: "提携が終了しています。" });
    const h2 = withLinks([LINK_ID], { [LINK_ID]: blocked });
    await h2.run();
    const card = h2.saved[0].productCards?.[0];
    expect(card?.affiliateUrl).toBeUndefined();
    expect(card?.blockedReason).toBe("提携が終了しています。");
  });

  it("成果リンクを持たない版では、商品カードの欄そのものを出さない", async () => {
    // 空配列を入れると、画面側は「カードがある」と判断して空の見出しを出す。
    const result = await h.run();
    expect(result.ok).toBe(true);
    expect(h.saved[0].productCards).toBeUndefined();
  });

  it("引き当てられなかった成果リンクは、記事に出さず公開した人へ返す", async () => {
    const h2 = withLinks([LINK_ID, "lnk_missing"], { [LINK_ID]: anOffer() });
    const result = await h2.run();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(h2.saved[0].productCards).toHaveLength(1);
    const reported = result.value.skipped.map((s) => s.reason).join("\n");
    expect(reported).toContain("lnk_missing");
  });

  it("成果リンクを読めないときは、記事を出さない", async () => {
    // 広告表記だけ付いて買う導線が 1 件も無い記事を読者に出さない。
    // まだ何も保存していないので、保存先が戻れば同じ URL で出し直せる。
    const h2 = withLinks([LINK_ID], { [LINK_ID]: anOffer() }, { offersFail: true });
    const result = await h2.run();

    expect(result.ok).toBe(false);
    expect(h2.saved).toHaveLength(0);
    expect(h2.audit()).toHaveLength(0);
  });

  it("順位表は作らない（点数を持たないものから順位を作らない）", async () => {
    // 成果リンクからは総合点も評価軸の点も分からない。
    // 作るには捏造するしかなく、報酬側のデータから順位を作ることになる。
    const h2 = withLinks([LINK_ID], { [LINK_ID]: anOffer() }, {});
    await h2.run({ articleType: "guide" });
    expect(h2.saved[0].ranking).toBeUndefined();
  });
});

/**
 * 公開前の点検（REQ-SEO03）。
 *
 * 要件は「公開前に不足を利用者へ**示す**」であって、止めることではない。
 * だからここで確かめるのは 2 つ。
 *   1. 押しても**何も起きない**（記事も配信の記録も操作の記録も動かない）
 *   2. 点検の中身が、公開したときの点検と**同じ結果**になる
 *
 * 2 が崩れると「点検では緑だったのに出したら赤」が起き、点検が信用を失う。
 */
describe("出す前の点検", () => {
  it("公開と点検が共有する警告射影は、ゲート未実施と未登録リンクを同じ順で返す", () => {
    expect(
      articleDraftWarnings(
        [{ requirement: "structured_data", reason: "構造化データの検証が未実施です。" }],
        ["lnk_missing"],
      ),
    ).toEqual([
      { label: "構造化データの検証", reason: "構造化データの検証が未実施です。" },
      {
        label: "成果リンク",
        reason: "lnk_missing の登録が見つからないため、記事に出していません。",
      },
    ]);
  });

  it("点検しても記事は保存されず、配信も記録も動かない", async () => {
    const h2 = harness();
    const result = await h2.check();

    expect(result.ok).toBe(true);
    expect(h2.saved).toHaveLength(0);
    expect(h2.publications).toHaveLength(0);
    expect(h2.audit()).toHaveLength(0);
  });

  it("点検の結果は、同じ入力で公開したときの点検と一致する", async () => {
    // 別々に組み立てていたら、ここが最初にずれる。
    const checked = await harness().check();
    const h2 = harness();
    await h2.run();

    if (!checked.ok) throw new Error(checked.error.message);
    expect(checked.value.aiSearch).toEqual(auditArticleForAiSearch(h2.saved[0]));
  });

  it("公開と点検は、ゲート未実施と未登録リンクを同じ警告として返す", async () => {
    const variant = aVariant({ affiliateLinkIds: ["lnk_missing"] as never });
    const checked = await harness({ variant, offers: {} }).check();
    const published = await harness({ variant, offers: {} }).run();

    if (!checked.ok) throw new Error(checked.error.message);
    if (!published.ok) throw new Error(published.error.message);
    expect(checked.value.skipped).toEqual(published.value.skipped);
  });

  it("要点を書けば「要点がある」が通り、書かなければ落ちる", async () => {
    const okOf = (r: Awaited<ReturnType<Harness["check"]>>) => {
      if (!r.ok) throw new Error(r.error.message);
      return r.value.aiSearch.find((c) => c.check.includes("要点"))?.ok;
    };
    expect(okOf(await harness().check({ keyPoints: ["静音性は 30dB 以下"] }))).toBe(true);
    expect(okOf(await harness().check())).toBe(false);
  });

  it("引き当てられなかった成果リンクを、点検の時点で名指しで出す", async () => {
    // 出してから知らせても遅い。読者にはもう買う導線の無い記事が見えている。
    const h2 = harness({ variant: aVariant({ affiliateLinkIds: ["lnk_missing"] as never }), offers: {} });
    const result = await h2.check();
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.skipped.some((s) => s.reason.includes("lnk_missing"))).toBe(true);
  });

  it("公開できない入力は、点検でも同じ理由で断られる", async () => {
    // 断り方が違うと「点検は通ったのに出せない」が起きる。
    const result = await harness().check({ title: "  " });
    expect(result.ok).toBe(false);
  });
});
