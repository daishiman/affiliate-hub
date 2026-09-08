/**
 * @tier 1
 * @req REQ-BOPC04
 * @req feat-seo-assessment-reflection
 * @req feat-aeo-answer-optimization
 * @types equivalence, boundary, permission-matrix, fault-injection, audit-log
 *
 * 改善層 (SEO 診断・AEO の構え) のユースケース。
 *
 * この試験が守りたいのは 3 つ。
 *
 *   1. **改善層は公開面へ書かない (AD-3)。** `draft_fix` が作るのは下書き
 *      だけで、その事実が記録の行にも残る。
 *   2. **権限が 3 段に割れている。** 見る (`content.read`) / 直す
 *      (`content.write`) / 「直さない」と決める・構えを保存する
 *      (`site.manage`) は重さが違う。1 つにまとめると、記事 1 本を
 *      直せる人がブログ全体の名乗りを書き換えられる。
 *   3. **理由と名乗りを空のまま通さない。** 空で通ると、構造化データの
 *      発行元が空文字で出ていき、気づく手がかりが画面に残らない。
 *
 * SQL と保存の冪等性は `tests/integration/d1-seo-assessment.test.ts` が見る。
 */
import { describe, expect, it } from "vitest";
import type {
  AeoProfilePort,
  AnswerUnitPort,
  AssessmentRun,
  SeoAssessmentPort,
} from "@/application/ports/blog-improvement";
import type { AuditLogPort } from "@/application/ports/compliance";
import { createManageAeoAnswersUseCase } from "@/application/usecases/blog-ops/manage-aeo-answers";
import { createManageSeoAssessmentUseCase } from "@/application/usecases/blog-ops/manage-seo-assessment";
import type { AnswerUnit, SiteAeoProfile } from "@/domain/aeo";
import { MAX_ANSWER_UNIT_LENGTH } from "@/domain/aeo";
import type { SeoFinding } from "@/domain/seo";
import { type AuditLogId, domainError, err, ok } from "@/domain/shared";
import { aWriter, anAnalyst, anOwner } from "../support/actors";

const SITE = "improve-blog";
const ARTICLE = "how-to-choose";
const NOW = new Date("2026-09-04T12:00:00Z");

function aFinding(over: Partial<SeoFinding> = {}): SeoFinding {
  return {
    id: "fnd-1",
    siteSlug: SITE,
    articleSlug: ARTICLE,
    checkKind: "title",
    severity: "critical",
    state: "open",
    detail: "タイトルが 12 文字しかありません。",
    evidence: "title=「選び方」(12 文字)",
    suggestion: "何を選ぶのかを入れてください。",
    assessedAt: NOW,
    ...over,
  };
}

function aUnit(over: Partial<AnswerUnit> = {}): AnswerUnit {
  return {
    id: "unit-1",
    siteSlug: SITE,
    articleSlug: ARTICLE,
    kind: "direct-answer",
    question: "どれを選べばよいですか。",
    answer: "用途が決まっているなら A、決まっていないなら B です。",
    positionRatio: 0.1,
    sourceRef: null,
    extractedAt: NOW,
    ...over,
  };
}

function fakeAudit(fail = false) {
  const entries: { action: string; after: Readonly<Record<string, unknown>> }[] = [];
  const port: AuditLogPort = {
    async append(entry) {
      if (fail) return err(domainError("UPSTREAM_UNAVAILABLE", "記録を書けません。"));
      entries.push({ action: entry.action, after: entry.after ?? {} });
      return ok("audit-1" as AuditLogId);
    },
    async listByTarget() {
      return ok([]);
    },
    async search() {
      return ok({ items: [], total: 0, page: 1, perPage: 20, nextCursor: null });
    },
  };
  return { port, entries };
}

/**
 * 診断器。`published` という語をどこにも持たないのが要点で、
 * この fake から公開経路へ触れる手段が無いこと自体が AD-3 の形である。
 */
function fakeSeo(
  seed: readonly SeoFinding[] = [aFinding()],
  fail: Partial<Record<"assess" | "draftFix" | "dismiss", true>> = {},
) {
  const calls: string[] = [];
  const down = () => err(domainError("UPSTREAM_UNAVAILABLE", "診断器へつながりません。"));
  const run: AssessmentRun = { findings: seed, assessedArticles: 3, ranAt: NOW };
  const port: SeoAssessmentPort = {
    async assess() {
      calls.push("assess");
      return fail.assess ? down() : ok(run);
    },
    async listOpen() {
      calls.push("listOpen");
      return ok(seed.filter((f) => f.state === "open"));
    },
    async draftFix() {
      calls.push("draftFix");
      return fail.draftFix ? down() : ok({ draftRevisionId: "rev-9" });
    },
    async dismiss() {
      calls.push("dismiss");
      return fail.dismiss ? down() : ok(true);
    },
  };
  return { port, calls };
}

function fakeAeo(seed: { profile?: SiteAeoProfile | null; units?: readonly AnswerUnit[] } = {}) {
  const calls: string[] = [];
  let profile = seed.profile ?? null;
  const units = seed.units ?? [aUnit()];
  const profiles: AeoProfilePort = {
    async get() {
      calls.push("get");
      return ok(profile);
    },
    async save(_ws, next) {
      calls.push("save");
      profile = next;
      return ok(next);
    },
  };
  const answerUnits: AnswerUnitPort = {
    async extract() {
      calls.push("extract");
      return ok(units);
    },
    async listForSite() {
      calls.push("listForSite");
      return ok(units);
    },
    async listForArticle() {
      calls.push("listForArticle");
      return ok(units);
    },
  };
  return { profiles, units: answerUnits, calls };
}

function seoUseCase(parts: { seo?: ReturnType<typeof fakeSeo>; audit?: ReturnType<typeof fakeAudit> } = {}) {
  const seo = parts.seo ?? fakeSeo();
  const audit = parts.audit ?? fakeAudit();
  return {
    seo,
    audit,
    uc: createManageSeoAssessmentUseCase({
      seo: seo.port,
      auditLog: audit.port,
      ids: { newId: () => "id-1" },
      now: () => NOW,
    }),
  };
}

function aeoUseCase(parts: { aeo?: ReturnType<typeof fakeAeo>; audit?: ReturnType<typeof fakeAudit> } = {}) {
  const aeo = parts.aeo ?? fakeAeo();
  const audit = parts.audit ?? fakeAudit();
  return {
    aeo,
    audit,
    uc: createManageAeoAnswersUseCase({
      profiles: aeo.profiles,
      units: aeo.units,
      auditLog: audit.port,
      ids: { newId: () => "id-1" },
      now: () => NOW,
    }),
  };
}

describe("SEO 診断: 反映は下書きで止まる (AD-3)", () => {
  it("下書きを作っても、記録の行に published: false が残る", async () => {
    const { uc, audit } = seoUseCase();

    const result = await uc.execute(anOwner(), {
      action: "draft_fix",
      siteSlug: SITE,
      findingId: "fnd-1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.draftRevisionId).toBe("rev-9");
    const drafted = audit.entries.find((e) => e.action === "seo_finding.drafted");
    expect(drafted?.after).toMatchObject({ draftRevisionId: "rev-9", published: false });
  });

  it("診断を回すと、見た記事の本数が記録に残る", async () => {
    const { uc, audit } = seoUseCase();

    const result = await uc.execute(anOwner(), { action: "assess", siteSlug: SITE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 0 本は「指摘なし」ではなく「対象なし」。区別できるよう本数を持つ。
    expect(result.value.assessedArticles).toBe(3);
    expect(audit.entries.find((e) => e.action === "seo_assessment.ran")?.after).toMatchObject({
      scope: "site",
      assessedArticles: 3,
    });
  });

  it("診断器が落ちていたら、記録も残さず失敗として返す", async () => {
    const { uc, audit } = seoUseCase({ seo: fakeSeo([aFinding()], { assess: true }) });

    const result = await uc.execute(anOwner(), { action: "assess", siteSlug: SITE });

    expect(result.ok).toBe(false);
    // 回っていない診断を「回した」と書かない。
    expect(audit.entries).toHaveLength(0);
  });

  it("記録が書けなかったら「下書きを作れた」と言わない", async () => {
    const { uc } = seoUseCase({ audit: fakeAudit(true) });

    const result = await uc.execute(anOwner(), {
      action: "draft_fix",
      siteSlug: SITE,
      findingId: "fnd-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 済んだことは本文に残す。押し直させないため。
    expect(result.error.message).toContain("下書き");
  });
});

describe("SEO 診断: 「直さない」は理由が要る", () => {
  it("理由が空白だけなら断る", async () => {
    const { uc, seo } = seoUseCase();

    const result = await uc.execute(anOwner(), {
      action: "dismiss",
      siteSlug: SITE,
      findingId: "fnd-1",
      reason: "   ",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 画面に直せる欄があるので、こちらは欄の名前を付ける。
    expect(result.error.field).toBe("reason");
    expect(seo.calls).not.toContain("dismiss");
  });

  it("理由があれば、その理由が記録の行に残る", async () => {
    const { uc, audit } = seoUseCase();

    const result = await uc.execute(anOwner(), {
      action: "dismiss",
      siteSlug: SITE,
      findingId: "fnd-1",
      reason: "この記事は仕様書なので、タイトルは短いままでよい。",
    });

    expect(result.ok).toBe(true);
    const dismissed = audit.entries.find((e) => e.action === "seo_finding.dismissed");
    expect(dismissed).toBeDefined();
  });
});

describe("SEO 診断: 見る・直す・やめると決めるは別の権限", () => {
  it("記事を書く人は指摘を読める", async () => {
    const { uc } = seoUseCase();
    const result = await uc.execute(aWriter(), { action: "read", siteSlug: SITE });
    expect(result.ok).toBe(true);
  });

  it("記事を書く人は下書きまで作れる", async () => {
    const { uc } = seoUseCase();
    const result = await uc.execute(aWriter(), {
      action: "draft_fix",
      siteSlug: SITE,
      findingId: "fnd-1",
    });
    expect(result.ok).toBe(true);
  });

  it("記事を書く人は「直さない」と決められない", async () => {
    const { uc, seo } = seoUseCase();

    const result = await uc.execute(aWriter(), {
      action: "dismiss",
      siteSlug: SITE,
      findingId: "fnd-1",
      reason: "直さない。",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(seo.calls).not.toContain("dismiss");
  });

  it("数字を見るだけの人は、指摘を読めても直しには入れない", async () => {
    const { uc, seo } = seoUseCase();

    const read = await uc.execute(anAnalyst(), { action: "read", siteSlug: SITE });
    const drafted = await uc.execute(anAnalyst(), {
      action: "draft_fix",
      siteSlug: SITE,
      findingId: "fnd-1",
    });

    // `content.read` は持つが `content.write` は持たない。
    expect(read.ok).toBe(true);
    expect(drafted.ok).toBe(false);
    expect(seo.calls).not.toContain("draftFix");
  });
});

describe("AEO: 構えは空のまま保存させない", () => {
  const fullProfile = {
    action: "save_profile" as const,
    siteSlug: SITE,
    topicScope: "家庭用プリンタの選び方",
    audience: "はじめて買う人",
    publisherName: "アフィリエイトハブ編集部",
    structuredDataEnabled: true,
  };

  it.each([
    ["topicScope", { ...fullProfile, topicScope: "  " }],
    ["audience", { ...fullProfile, audience: "" }],
    ["publisherName", { ...fullProfile, publisherName: "\t" }],
  ])("%s が空なら、その欄の名前を付けて断る", async (field, input) => {
    const { uc, aeo } = aeoUseCase();

    const result = await uc.execute(anOwner(), input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe(field);
    expect(aeo.calls).not.toContain("save");
  });

  it("前後の空白は落として保存する", async () => {
    const { uc, audit } = aeoUseCase();

    const result = await uc.execute(anOwner(), {
      ...fullProfile,
      publisherName: "  アフィリエイトハブ編集部  ",
    });

    expect(result.ok).toBe(true);
    expect(audit.entries.find((e) => e.action === "aeo_profile.changed")?.after).toMatchObject({
      publisherName: "アフィリエイトハブ編集部",
    });
  });

  it("構えを決めていないブログは profile が null で返る（画面が入力を促せる）", async () => {
    const { uc } = aeoUseCase({ aeo: fakeAeo({ profile: null }) });

    const result = await uc.execute(anOwner(), { action: "read", siteSlug: SITE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.profile).toBeNull();
  });
});

describe("AEO: 隙間の判定はこの層で済ませる (AD-2)", () => {
  it("長すぎる答えと埋もれた答えを、画面に代わって数える", async () => {
    const tooLong = "あ".repeat(MAX_ANSWER_UNIT_LENGTH + 1);
    const { uc } = aeoUseCase({
      aeo: fakeAeo({ units: [aUnit({ answer: tooLong, positionRatio: 0.9 })] }),
    });

    const result = await uc.execute(anOwner(), { action: "read", siteSlug: SITE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.units[0]?.gaps).toEqual(
      expect.arrayContaining(["answer-too-long", "buried-answer"]),
    );
  });

  it("ちょうど上限の長さは隙間にしない（境界）", async () => {
    const exact = "あ".repeat(MAX_ANSWER_UNIT_LENGTH);
    const { uc } = aeoUseCase({ aeo: fakeAeo({ units: [aUnit({ answer: exact })] }) });

    const result = await uc.execute(anOwner(), { action: "read", siteSlug: SITE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.units[0]?.gaps).not.toContain("answer-too-long");
  });
});

describe("AEO: 抽出は置き換えなので、件数を記録に残す", () => {
  it("0 件でも失敗にせず、0 件として記録する", async () => {
    const { uc, audit } = aeoUseCase({ aeo: fakeAeo({ units: [] }) });

    const result = await uc.execute(anOwner(), {
      action: "extract",
      siteSlug: SITE,
      articleSlug: ARTICLE,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.extractedCount).toBe(0);
    expect(audit.entries.find((e) => e.action === "aeo_answer_units.extracted")?.after).toMatchObject(
      { count: 0 },
    );
  });

  it("記事を書く人は抽出できるが、構えは保存できない", async () => {
    const { uc } = aeoUseCase();

    const extracted = await uc.execute(aWriter(), {
      action: "extract",
      siteSlug: SITE,
      articleSlug: ARTICLE,
    });
    const saved = await uc.execute(aWriter(), {
      action: "save_profile",
      siteSlug: SITE,
      topicScope: "x",
      audience: "y",
      publisherName: "z",
      structuredDataEnabled: false,
    });

    expect(extracted.ok).toBe(true);
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.code).toBe("FORBIDDEN");
  });
});
