/**
 * @tier 2
 * @req REQ-BOPC04
 * @req feat-seo-assessment-reflection, feat-aeo-answer-optimization
 * @types idempotency, state-transition, boundary, tenant-isolation, db-migration
 *
 * 改善層 (SEO 診断 / AEO 引用単位) を本物の D1 で確かめる。
 *
 * ## この層で壊れると痛いところ
 *
 * 診断は繰り返し回る。繰り返して困るのは数字ではなく**人の判断**で、
 * 運用者が「これは直さない」と決めた指摘が翌日の診断で `open` に戻ると、
 * 同じ判断を毎日やり直すことになり、やがて誰も一覧を見なくなる。
 * それを守っているのは `ON CONFLICT ... SET` に `state` を**書いていない**
 * ことだけなので、確かめられるのは本物の `ON CONFLICT` を持つ D1 だけである。
 */
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import type { AnswerUnit } from "@/domain/aeo";
import type { SeoFinding } from "@/domain/seo";
import { ok, type WorkspaceId } from "@/domain/shared";
import {
  createD1AeoProfileRepository,
  createD1AnswerUnitRepository,
  createD1SeoAssessmentRepository,
  type AnswerUnitExtractor,
  type SeoAnalyzer,
} from "@/infrastructure/persistence/d1/seo-assessment-repository";
import {
  createD1ScheduledSeoAssessmentDeps,
  executeScheduledSeoAssessment,
  runScheduledSeoAssessment,
  SCHEDULED_SEO_ASSESSMENT_LIMIT,
} from "@/infrastructure/platform/seo-assessment-scheduler";
import { migrationStatements } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

const WS = "ws_seo_owner" as WorkspaceId;
const OTHER = "ws_seo_outsider" as WorkspaceId;
const SITE = "seo-blog";
const ARTICLE = "article-a";

let proxy: Proxy;
let seq = 0;

function db() {
  return drizzle(proxy.env.DB, { schema });
}

type RawFinding = Omit<SeoFinding, "id" | "state" | "assessedAt">;

/** 診断 1 件ぶんの素。既定は「タイトルが長すぎる」。 */
function finding(over: Partial<RawFinding> = {}): RawFinding {
  return {
    siteSlug: SITE,
    articleSlug: ARTICLE,
    checkKind: "title",
    severity: "warning",
    detail: "タイトルが 78 文字あります。",
    evidence: "<title> の実測長 = 78",
    suggestion: "60 文字までに縮めてください。",
    ...over,
  };
}

/** 指定した指摘だけを返す診断器。分析そのものはこの試験の対象外。 */
function analyzerOf(...findings: readonly RawFinding[]): SeoAnalyzer {
  return async () => ({ findings, assessedArticles: 1 });
}

function seoRepo(analyze: SeoAnalyzer) {
  return createD1SeoAssessmentRepository({
    db: db(),
    newId: () => `sf_${++seq}`,
    analyze,
    draft: async () => ({ draftRevisionId: `rev_${++seq}` }),
  });
}

type RawUnit = Omit<AnswerUnit, "id" | "extractedAt">;

function unit(over: Partial<RawUnit> = {}): RawUnit {
  return {
    siteSlug: SITE,
    articleSlug: ARTICLE,
    kind: "direct-answer",
    question: "初期費用はいくらですか？",
    answer: "無料で始められます。",
    positionRatio: 0.1,
    sourceRef: null,
    ...over,
  };
}

function unitRepo(extract: AnswerUnitExtractor) {
  return createD1AnswerUnitRepository({ db: db(), newId: () => `au_${++seq}`, extract });
}

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  for (const table of [
    "article_seo_assessment",
    "site_aeo_profile",
    "article_answer_unit",
    "site_seo_assessment_progress",
    "audit_logs",
    "published_articles",
    "published_article_tombstones",
    "site_blueprints",
  ]) {
    await proxy.env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

async function seedPublishedArticle(input: {
  readonly workspaceId?: string;
  readonly siteSlug?: string;
  readonly articleSlug?: string;
  readonly archived?: boolean;
}) {
  const workspaceId = input.workspaceId ?? String(WS);
  const siteSlug = input.siteSlug ?? SITE;
  const articleSlug = input.articleSlug ?? ARTICLE;
  const article = {
    slug: articleSlug,
    siteSlug,
    type: "guide",
    title: "月次診断用の記事",
    summary: "診断対象になる公開済み記事です。",
    categorySlug: "guides",
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-01",
    author: { slug: "editor", name: "編集部", bio: "検証担当", credentials: [] },
    disclosureRequired: false,
    sections: [{ id: "body", heading: "結論", paragraphs: ["本文です。"] }],
  };
  await proxy.env.DB.prepare(
    `INSERT OR IGNORE INTO site_blueprints
      (id, workspace_id, slug, name, pattern, published_at, blueprint_json)
     VALUES (?, ?, ?, '月次診断用', 'specialist_review', unixepoch(), '{}')`,
  )
    .bind(`sb_${siteSlug}`, workspaceId, siteSlug)
    .run();
  await proxy.env.DB.prepare(
    `INSERT INTO published_articles
      (site_slug, slug, workspace_id, source_article_id, type, title, summary,
       category_slug, author_slug, author_name, published_at, updated_at, archived_at, article_json)
     VALUES (?, ?, ?, NULL, 'guide', ?, ?, 'guides', 'editor', '編集部',
             '2026-09-01', '2026-09-01', ?, ?)`,
  )
    .bind(
      siteSlug,
      articleSlug,
      workspaceId,
      article.title,
      article.summary,
      input.archived ? "2026-09-02" : null,
      JSON.stringify(article),
    )
    .run();
}

describe("診断の保存", () => {
  it("同じ観点を 2 度診断しても行は 1 つで、中身は新しいほうになる", async () => {
    const first = await seoRepo(analyzerOf(finding())).assess(WS, {
      kind: "site",
      siteSlug: SITE,
    });
    await seoRepo(analyzerOf(finding({ detail: "タイトルが 92 文字あります。" }))).assess(WS, {
      kind: "site",
      siteSlug: SITE,
    });

    const open = await seoRepo(analyzerOf()).listOpen(WS, SITE);
    if (!open.ok) throw new Error("読み出しに失敗");
    expect(open.value).toHaveLength(1);
    expect(open.value[0]?.id).toBe(first.ok ? first.value.findings[0]?.id : undefined);
    expect(open.value[0]?.detail).toBe("タイトルが 92 文字あります。");
  });

  it("根拠の無い指摘が 1 件混ざると、その回はまるごと保存されない", async () => {
    const assessed = await seoRepo(
      analyzerOf(finding(), finding({ checkKind: "canonical", evidence: "  " })),
    ).assess(WS, { kind: "site", siteSlug: SITE });
    expect(assessed.ok).toBe(false);

    const open = await seoRepo(analyzerOf()).listOpen(WS, SITE);
    // 半分だけ保存されると、壊れた診断器が「一部は効いている」ように見える。
    expect(open.ok && open.value).toHaveLength(0);
  });

  it("出す順は重さ × 件数で決まる（重さだけで並べない）", async () => {
    await seoRepo(
      analyzerOf(
        finding({ checkKind: "canonical", severity: "critical" }),
        finding({ checkKind: "image-alt", severity: "warning" }),
        finding({ checkKind: "image-alt", severity: "warning", articleSlug: "article-b" }),
      ),
    ).assess(WS, { kind: "site", siteSlug: SITE });

    const open = await seoRepo(analyzerOf()).listOpen(WS, SITE);
    if (!open.ok) throw new Error("読み出しに失敗");
    // warning(2) × 2 件 = 4 が critical(3) × 1 件 = 3 を上回る。
    expect(open.value[0]?.checkKind).toBe("image-alt");
  });

  it("再診断で消えた open の指摘を、同じ診断範囲からも消す", async () => {
    await seoRepo(
      analyzerOf(finding(), finding({ checkKind: "canonical" })),
    ).assess(WS, { kind: "site", siteSlug: SITE });

    await seoRepo(analyzerOf(finding())).assess(WS, { kind: "site", siteSlug: SITE });

    const rows = await proxy.env.DB.prepare(
      "SELECT check_kind AS checkKind FROM article_seo_assessment ORDER BY check_kind",
    ).all<{ checkKind: string }>();
    expect(rows.results.map((row) => row.checkKind)).toEqual(["title"]);
  });

  it("サイト診断が 0 件なら、そのサイトの open をすべて消す", async () => {
    await seoRepo(
      analyzerOf(finding(), finding({ articleSlug: "article-b", checkKind: "canonical" })),
    ).assess(WS, { kind: "site", siteSlug: SITE });

    const reassessed = await seoRepo(analyzerOf()).assess(WS, {
      kind: "site",
      siteSlug: SITE,
    });

    expect(reassessed.ok && reassessed.value.findings).toEqual([]);
    const rows = await proxy.env.DB.prepare(
      "SELECT id FROM article_seo_assessment WHERE workspace_id = ? AND site_slug = ?",
    )
      .bind(String(WS), SITE)
      .all();
    expect(rows.results).toHaveLength(0);
  });

  it("再診断で消えた open だけを消し、3 種の運用判断は残す", async () => {
    await seoRepo(
      analyzerOf(
        finding({ checkKind: "title" }),
        finding({ checkKind: "canonical" }),
        finding({ checkKind: "image-alt" }),
        finding({ checkKind: "description" }),
      ),
    ).assess(WS, { kind: "site", siteSlug: SITE });
    for (const [checkKind, state] of [
      ["canonical", "drafted"],
      ["image-alt", "applied"],
      ["description", "dismissed"],
    ] as const) {
      await proxy.env.DB.prepare(
        "UPDATE article_seo_assessment SET state = ? WHERE check_kind = ?",
      )
        .bind(state, checkKind)
        .run();
    }

    const reassessed = await seoRepo(analyzerOf()).assess(WS, {
      kind: "site",
      siteSlug: SITE,
    });

    expect(reassessed.ok && reassessed.value.findings).toEqual([]);
    const rows = await proxy.env.DB.prepare(
      `SELECT check_kind AS checkKind, state
         FROM article_seo_assessment
        WHERE workspace_id = ? AND site_slug = ?
        ORDER BY check_kind`,
    )
      .bind(String(WS), SITE)
      .all<{ checkKind: string; state: string }>();
    expect(rows.results).toEqual([
      { checkKind: "canonical", state: "drafted" },
      { checkKind: "description", state: "dismissed" },
      { checkKind: "image-alt", state: "applied" },
    ]);
  });

  it("同期は workspace・site・article の診断範囲から外へ出ない", async () => {
    await seoRepo(
      analyzerOf(
        finding(),
        finding({ articleSlug: "article-b", checkKind: "canonical" }),
      ),
    ).assess(WS, { kind: "site", siteSlug: SITE });
    await seoRepo(
      analyzerOf(
        finding({ siteSlug: "other-site", articleSlug: "article-c", checkKind: "image-alt" }),
      ),
    ).assess(WS, { kind: "site", siteSlug: "other-site" });
    await seoRepo(analyzerOf(finding({ siteSlug: "outsider-site" }))).assess(OTHER, {
      kind: "site",
      siteSlug: "outsider-site",
    });

    await seoRepo(analyzerOf()).assess(WS, {
      kind: "article",
      siteSlug: SITE,
      articleSlug: ARTICLE,
    });

    const rows = await proxy.env.DB.prepare(
      `SELECT workspace_id AS workspaceId, site_slug AS siteSlug, article_slug AS articleSlug
         FROM article_seo_assessment ORDER BY workspace_id, site_slug, article_slug`,
    ).all<{ workspaceId: string; siteSlug: string; articleSlug: string }>();
    expect(rows.results).toEqual(
      [
        { workspaceId: String(WS), siteSlug: "other-site", articleSlug: "article-c" },
        { workspaceId: String(WS), siteSlug: SITE, articleSlug: "article-b" },
        { workspaceId: String(OTHER), siteSlug: "outsider-site", articleSlug: ARTICLE },
      ].sort((a, b) =>
        `${a.workspaceId}/${a.siteSlug}/${a.articleSlug}`.localeCompare(
          `${b.workspaceId}/${b.siteSlug}/${b.articleSlug}`,
        ),
      ),
    );
  });

  it("新しい診断結果の検証に失敗したら stale open も消さない", async () => {
    await seoRepo(analyzerOf(finding())).assess(WS, { kind: "site", siteSlug: SITE });

    const failed = await seoRepo(
      analyzerOf(finding({ checkKind: "canonical", evidence: "  " })),
    ).assess(WS, { kind: "site", siteSlug: SITE });

    expect(failed.ok).toBe(false);
    const rows = await proxy.env.DB.prepare(
      "SELECT check_kind AS checkKind FROM article_seo_assessment",
    ).all<{ checkKind: string }>();
    expect(rows.results).toEqual([{ checkKind: "title" }]);
  });
});

describe("運用者の判断は診断より強い", () => {
  it("「直さない」と決めた指摘は、次の診断で復活しない", async () => {
    const first = await seoRepo(analyzerOf(finding())).assess(WS, {
      kind: "site",
      siteSlug: SITE,
    });
    if (!first.ok) throw new Error("前提が崩れた");
    const id = first.value.findings[0]!.id;
    await seoRepo(analyzerOf()).dismiss(WS, id, "意図してこの長さにしている");

    await seoRepo(analyzerOf(finding({ detail: "タイトルが 92 文字あります。" }))).assess(WS, {
      kind: "site",
      siteSlug: SITE,
    });

    const open = await seoRepo(analyzerOf()).listOpen(WS, SITE);
    expect(open.ok && open.value).toHaveLength(0);

    // 判断は残るが、指摘の中身は最新に追従していること。
    // 古い本文のまま凍ると、あとで見直すときに現物と合わない。
    const row = await proxy.env.DB.prepare(
      "SELECT state, detail FROM article_seo_assessment",
    ).all<{ state: string; detail: string }>();
    expect(row.results[0]?.state).toBe("dismissed");
    expect(row.results[0]?.detail).toBe("タイトルが 92 文字あります。");
  });

  it("理由の無い「直さない」は受け付けない", async () => {
    const first = await seoRepo(analyzerOf(finding())).assess(WS, {
      kind: "site",
      siteSlug: SITE,
    });
    if (!first.ok) throw new Error("前提が崩れた");
    const dismissed = await seoRepo(analyzerOf()).dismiss(WS, first.value.findings[0]!.id, "   ");
    expect(dismissed.ok).toBe(false);
  });
});

describe("下書きより先へは進まない (AD-3)", () => {
  it("下書きを作ると drafted になり、公開状態にはならない", async () => {
    const first = await seoRepo(analyzerOf(finding())).assess(WS, {
      kind: "site",
      siteSlug: SITE,
    });
    if (!first.ok) throw new Error("前提が崩れた");

    const drafted = await seoRepo(analyzerOf()).draftFix(WS, first.value.findings[0]!.id);
    expect(drafted.ok).toBe(true);

    const row = await proxy.env.DB.prepare(
      "SELECT state, draft_revision_id FROM article_seo_assessment",
    ).all<{ state: string; draft_revision_id: string | null }>();
    expect(row.results[0]?.state).toBe("drafted");
    expect(row.results[0]?.draft_revision_id).not.toBeNull();
  });

  it("「直さない」と決めた指摘からは下書きを作れない", async () => {
    const first = await seoRepo(analyzerOf(finding())).assess(WS, {
      kind: "site",
      siteSlug: SITE,
    });
    if (!first.ok) throw new Error("前提が崩れた");
    const id = first.value.findings[0]!.id;
    await seoRepo(analyzerOf()).dismiss(WS, id, "意図している");

    const drafted = await seoRepo(analyzerOf()).draftFix(WS, id);
    expect(drafted.ok).toBe(false);
  });

  it("他の workspace の指摘には触れない", async () => {
    const first = await seoRepo(analyzerOf(finding())).assess(WS, {
      kind: "site",
      siteSlug: SITE,
    });
    if (!first.ok) throw new Error("前提が崩れた");
    const drafted = await seoRepo(analyzerOf()).draftFix(OTHER, first.value.findings[0]!.id);
    expect(drafted.ok).toBe(false);
  });
});

describe("AEO の構えと引用単位", () => {
  it("構えが未設定のブログは null を返す（既定値をでっち上げない）", async () => {
    const got = await createD1AeoProfileRepository(db()).get(WS, SITE);
    expect(got.ok && got.value).toBeNull();
  });

  it("構えは上書き保存できる", async () => {
    const repo = createD1AeoProfileRepository(db());
    const base = {
      siteSlug: SITE,
      topicScope: "副業の始め方",
      audience: "会社員",
      publisherName: "編集部",
      structuredDataEnabled: false,
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    };
    await repo.save(WS, base);
    await repo.save(WS, { ...base, structuredDataEnabled: true });

    const got = await repo.get(WS, SITE);
    expect(got.ok && got.value?.structuredDataEnabled).toBe(true);
  });

  it("抽出し直すと、記事から消えた問いは表からも消える", async () => {
    await unitRepo(async () => [unit(), unit({ question: "解約はできますか？" })]).extract(
      WS,
      SITE,
      ARTICLE,
    );
    await unitRepo(async () => [unit()]).extract(WS, SITE, ARTICLE);

    const listed = await unitRepo(async () => []).listForArticle(WS, SITE, ARTICLE);
    if (!listed.ok) throw new Error("読み出しに失敗");
    // 置き換えではなく積み増しにすると、記事から消した Q&A が
    // 構造化データに残り、回答エンジンへ嘘を出し続けることになる。
    expect(listed.value.map((u) => u.question)).toEqual(["初期費用はいくらですか？"]);
  });

  it("抽出 0 件は失敗ではない（引用できる形になっていない、という結果）", async () => {
    const extracted = await unitRepo(async () => []).extract(WS, SITE, ARTICLE);
    expect(extracted.ok && extracted.value).toEqual([]);
  });

  it("問いか答えが空の単位は保存しない", async () => {
    const extracted = await unitRepo(async () => [unit({ answer: "  " })]).extract(
      WS,
      SITE,
      ARTICLE,
    );
    expect(extracted.ok).toBe(false);
  });

  it("他の記事の単位は、抽出し直しても巻き添えにならない", async () => {
    await unitRepo(async () => [unit({ articleSlug: "article-b" })]).extract(
      WS,
      SITE,
      "article-b",
    );
    await unitRepo(async () => [unit()]).extract(WS, SITE, ARTICLE);

    const listed = await unitRepo(async () => []).listForSite(WS, SITE);
    expect(listed.ok && listed.value).toHaveLength(2);
  });
});

describe("定期 SEO 診断の D1 接続", () => {
  it("公開記事が無い場合と archived-only のサイトは対象にしない", async () => {
    const empty = await runScheduledSeoAssessment(proxy.env.DB, new Date("2026-09-04T00:00:00Z"));
    await seedPublishedArticle({ archived: true });

    const archivedOnly = await runScheduledSeoAssessment(
      proxy.env.DB,
      new Date("2026-09-04T00:00:00Z"),
    );

    expect(empty).toMatchObject({ scanned: 0, completed: 0, failed: 0, truncated: false });
    expect(archivedOnly).toMatchObject({ scanned: 0, completed: 0, failed: 0 });
  });

  it("公開中のサイトだけを月 1 回診断し、翌月に再び対象にする", async () => {
    await seedPublishedArticle({});
    await seedPublishedArticle({
      workspaceId: String(OTHER),
      siteSlug: "archived-site",
      articleSlug: "archived-article",
      archived: true,
    });

    const first = await runScheduledSeoAssessment(proxy.env.DB, new Date("2026-09-04T00:00:00Z"));
    const sameMonth = await runScheduledSeoAssessment(
      proxy.env.DB,
      new Date("2026-09-30T23:59:59Z"),
    );
    const nextMonth = await runScheduledSeoAssessment(
      proxy.env.DB,
      new Date("2026-10-01T00:00:00Z"),
    );

    expect(first).toMatchObject({ period: "2026-09", scanned: 1, completed: 1, failed: 0 });
    expect(sameMonth.scanned).toBe(0);
    expect(nextMonth).toMatchObject({ period: "2026-10", scanned: 1, completed: 1 });

    const audits = await proxy.env.DB.prepare(
      `SELECT actor_user_id AS actorUserId, actor_identified AS actorIdentified
         FROM audit_logs WHERE action = 'seo_assessment.ran' ORDER BY occurred_at`,
    ).all<{ actorUserId: string; actorIdentified: number }>();
    expect(audits.results).toEqual([
      { actorUserId: "system:seo-assessment", actorIdentified: 0 },
      { actorUserId: "system:seo-assessment", actorIdentified: 0 },
    ]);
  });

  it("候補を安定順の 20 件に限り、21 件目を truncated の根拠にする", async () => {
    for (let index = SCHEDULED_SEO_ASSESSMENT_LIMIT; index >= 0; index -= 1) {
      const suffix = String(index).padStart(2, "0");
      await seedPublishedArticle({
        workspaceId: `ws_${suffix}`,
        siteSlug: `site-${suffix}`,
        articleSlug: `article-${suffix}`,
      });
    }

    const result = await runScheduledSeoAssessment(proxy.env.DB, new Date("2026-09-04T00:00:00Z"));

    expect(result).toMatchObject({ scanned: 20, completed: 20, failed: 0, truncated: true });
    const pending = await proxy.env.DB.prepare(
      `SELECT p.workspace_id AS workspaceId, p.site_slug AS siteSlug
         FROM published_articles p
        WHERE p.archived_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM site_seo_assessment_progress c
             WHERE c.workspace_id = p.workspace_id
               AND c.site_slug = p.site_slug
               AND c.period = '2026-09'
          )
        ORDER BY p.workspace_id, p.site_slug`,
    ).all<{ workspaceId: string; siteSlug: string }>();
    expect(pending.results).toEqual([{ workspaceId: "ws_20", siteSlug: "site-20" }]);
  });

  it("同じ記事 slug でも workspace/site が違えば別の候補として処理する", async () => {
    await seedPublishedArticle({ workspaceId: "ws_a", siteSlug: "site-a", articleSlug: "shared" });
    await seedPublishedArticle({ workspaceId: "ws_b", siteSlug: "site-b", articleSlug: "shared" });

    const result = await runScheduledSeoAssessment(proxy.env.DB, new Date("2026-09-04T00:00:00Z"));

    expect(result).toMatchObject({ scanned: 2, completed: 2, failed: 0 });
    const rows = await proxy.env.DB.prepare(
      `SELECT workspace_id AS workspaceId, site_slug AS siteSlug
         FROM site_seo_assessment_progress ORDER BY workspace_id, site_slug`,
    ).all<{ workspaceId: string; siteSlug: string }>();
    expect(rows.results).toEqual([
      { workspaceId: "ws_a", siteSlug: "site-a" },
      { workspaceId: "ws_b", siteSlug: "site-b" },
    ]);
  });

  it("完了印を二重に付けても進捗行は 1 件のまま", async () => {
    const deps = createD1ScheduledSeoAssessmentDeps(db());
    const at = new Date("2026-09-04T00:00:00Z");
    await deps.markAttempted(WS, SITE, "2026-09", at);

    const first = await deps.markCompleted(WS, SITE, "2026-09", at);
    const second = await deps.markCompleted(WS, SITE, "2026-09", at);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    const count = await proxy.env.DB.prepare(
      "SELECT count(*) AS count FROM site_seo_assessment_progress",
    ).first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it("D1 の候補順でも、失敗した先頭 20 件が 21 件目を永久に塞がない", async () => {
    for (let index = 0; index <= SCHEDULED_SEO_ASSESSMENT_LIMIT; index += 1) {
      const suffix = String(index).padStart(2, "0");
      await seedPublishedArticle({
        workspaceId: `ws_${suffix}`,
        siteSlug: `site-${suffix}`,
        articleSlug: `article-${suffix}`,
      });
    }
    const base = createD1ScheduledSeoAssessmentDeps(db());
    const firstTwenty = new Set(
      Array.from({ length: SCHEDULED_SEO_ASSESSMENT_LIMIT }, (_, index) =>
        `site-${String(index).padStart(2, "0")}`,
      ),
    );
    const assessed: string[] = [];
    const deps = {
      ...base,
      async assess(_workspaceId: WorkspaceId, siteSlug: string) {
        assessed.push(siteSlug);
        return firstTwenty.has(siteSlug)
          ? ({
              ok: false as const,
              error: {
                code: "UPSTREAM_UNAVAILABLE" as const,
                message: "診断失敗",
                retryable: true,
              },
            })
          : ok({ assessedArticles: 1, findings: 0 });
      },
    };

    const first = await executeScheduledSeoAssessment(deps, new Date("2026-09-04T00:00:00Z"));
    const second = await executeScheduledSeoAssessment(deps, new Date("2026-09-05T00:00:00Z"));

    expect(first).toMatchObject({ scanned: 20, completed: 0, failed: 20, truncated: true });
    expect(second.completed).toBe(1);
    expect(assessed[20]).toBe("site-20");
  });
});
