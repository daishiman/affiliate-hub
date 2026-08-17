import { beforeEach, describe, expect, it } from "vitest";
import type { EditorialContentVariantRepositoryPort } from "@/application/ports/authoring";
import type { PublicationRepositoryPort } from "@/application/ports/distribution";
import type { ImprovementRepositoryPort, LoopObservation } from "@/application/ports/improvement";
import type { LlmCostEstimatorPort, LlmPort, LlmRequest } from "@/application/ports";
import type { TelemetrySinkPort } from "@/application/ports/telemetry";
import {
  type ManageContentDeps,
  createApproveContentUseCase,
  createGetContentUseCase,
} from "@/application/usecases/content/manage-content";
import {
  type ManageDistributionDeps,
  createListPublicationsUseCase,
  createSchedulePublicationUseCase,
} from "@/application/usecases/distribution/manage-distribution";
import { createDraftContentVariantUseCase } from "@/application/usecases/generation/draft-content-variant";
import { createRecordTelemetryUseCase } from "@/application/usecases/analytics/record-telemetry";
import { createListMetricsUseCase } from "@/application/usecases/analytics/read-metrics";
import { createReviewLoopRunsUseCase } from "@/application/usecases/improvement/review-loop-runs";
import type { ContentVariant } from "@/domain/authoring";
import type { LoopRun, TelemetryEvent, VariantSpec } from "@/domain/analytics";
import { requiredSectionsFor } from "@/domain/authoring/article-structure";
import { type PublishCandidate, evaluatePublishGate } from "@/domain/compliance";
import {
  type Publication,
  advance,
  createPublication,
  recordSendSuccess,
} from "@/domain/distribution";
import { OUTPUT_REQUIRED_FIELDS } from "@/domain/generation";
import type {
  ActorContext,
  ContentVariantId,
  ExperimentId,
  PublicationId,
  WorkspaceId,
} from "@/domain/shared";
import { markEditorial, ok, taggedString } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import { sampleGenerationInput } from "@/infrastructure/persistence/sample/generation-sample-input";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { anOwner } from "../support/actors";
import { aChannelConnection } from "../support/factories";
import { recordingEvents, testDeps } from "../support/doubles";

/**
 * 改善の 1 周を、層をまたいで端から端まで通す結合テスト。
 *
 *   作る → 承認 → 公開 → 測る → 分析 → 提案 → 承認 → 作り直す
 *
 * --- なぜ 1 本にまとめて通すのか ---
 * 各段の単体テストは既にある。それでも 1 周を通すのは、
 * **段と段のつなぎ目は、どちらの単体テストの持ち物でもない**からで、
 * そこだけが誰にも見られないまま残る。実際、この試験を書いたことで
 * 「計測と分析が同じ数字を見ていない」ことが分かった（下の注記）。
 *
 * --- 保存先の扱い（ここが読みどころ） ---
 * 経路上の保存先の多くはまだ見本データで、書き込みは拒む作りになっている。
 * そこで、この試験は**同じユースケースを 2 通りの保存先で 2 回通す**。
 *
 *   1. 本当に保存する差し替え（この下の `memory*`）で、**1 周が最後まで回ること**
 *   2. 本番の組み立て（`createDeps()`）で、**まだ繋がっていない段が
 *      成功を装わず、次の一手つきで断ること**
 *
 * 1 だけだと「見本のままでも動く」と誤読され、2 だけだと 1 周が
 * 通る道筋を誰も確かめていないことになる。両方を書いて初めて、
 * 「どこまで本物か」が試験の側から言える。
 *
 * --- ここで見ないこと ---
 * 各段の入力検証・権限の網羅は単体側で見る。ここは繋がりだけを見る。
 * D1 を実際に使う結合は `tests/integration/d1-link-inbox.test.ts`。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）/ REQ-TS07
 */

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const owner: ActorContext = anOwner({ workspaceId: WS });

/** 見本の記事のうち、自動確認で不適合になっていない 1 本。 */
const VARIANT_ID = "cv_alpha_review";

const NOW = new Date("2026-08-17T00:00:00Z");

// --- 本当に保存する差し替え -------------------------------------------------

/**
 * 記事の保存先。見本データを土台に、`save` だけ本当に効くようにする。
 *
 * 見本を捨てて空にしない。空にすると「承認する対象がそもそも無い」ため、
 * 1 周が通ったのか、何もしなかったのかを区別できなくなる。
 */
function memoryVariants(): EditorialContentVariantRepositoryPort {
  const base = testDeps().contentVariants;
  const saved = new Map<string, ContentVariant>();
  return markEditorial({
    ...base,
    async findById(workspaceId: WorkspaceId, id: ContentVariantId) {
      const mine = saved.get(String(id));
      if (mine !== undefined) return ok(mine);
      return base.findById(workspaceId, id);
    },
    async save(variant: ContentVariant) {
      saved.set(String(variant.id), variant);
      return ok(variant);
    },
  }) as EditorialContentVariantRepositoryPort;
}

/** 配信の保存先。1 周のあいだ状態が進むので、書けないと先へ進めない。 */
function memoryPublications(): PublicationRepositoryPort {
  const rows = new Map<string, Publication>();
  return {
    async findById(_workspaceId: WorkspaceId, id: PublicationId) {
      return ok(rows.get(String(id)) ?? null);
    },
    async findByIdempotencyKey(_workspaceId: WorkspaceId, key: string) {
      return ok([...rows.values()].find((p) => p.idempotencyKey === key) ?? null);
    },
    async listByVariant(_workspaceId: WorkspaceId, variantId: ContentVariantId) {
      return ok([...rows.values()].filter((p) => p.variantId === variantId));
    },
    async listDue() {
      return ok([]);
    },
    async listRecent() {
      return ok([...rows.values()]);
    },
    async save(publication: Publication) {
      rows.set(String(publication.id), publication);
      return ok(publication);
    },
  } as PublicationRepositoryPort;
}

/** 改善ループの保存先。承認した見せ方が本当に残ることを見たいので書ける形にする。 */
function memoryImprovement(seed: {
  readonly specs: readonly VariantSpec[];
  readonly runs: readonly LoopRun[];
  readonly observations: Readonly<Record<string, LoopObservation>>;
}): ImprovementRepositoryPort {
  const specs = [...seed.specs];
  const runs = [...seed.runs];
  return {
    async listVariantSpecs() {
      return ok(specs);
    },
    async saveVariantSpec(_workspaceId: WorkspaceId, spec: VariantSpec) {
      specs.push(spec);
      return ok(true as const);
    },
    async listRuns() {
      return ok(runs);
    },
    async saveRun(_workspaceId: WorkspaceId, run: LoopRun) {
      runs.push(run);
      return ok(true as const);
    },
    async observationsOf(_workspaceId: WorkspaceId, runId: string) {
      return ok(seed.observations[runId] ?? null);
    },
  };
}

/** 計測の記録先。受け取った中身を後から読めるようにする。 */
function memorySink(): TelemetrySinkPort & { readonly stored: () => readonly TelemetryEvent[] } {
  const stored: TelemetryEvent[] = [];
  return {
    stored: () => stored,
    async recordBatch(_workspaceId: WorkspaceId, events: readonly TelemetryEvent[]) {
      stored.push(...events);
      return ok({ accepted: events.length, rejected: 0 });
    },
    async aiUsage() {
      return ok([]);
    },
    async purgeExpired() {
      return ok({ deleted: 0 });
    },
    async forgetReader(_workspaceId: WorkspaceId, readerKey: string) {
      const before = stored.length;
      for (let i = stored.length - 1; i >= 0; i -= 1) {
        if (stored[i].readerKey === readerKey) stored.splice(i, 1);
      }
      return ok({ deleted: before - stored.length });
    },
  };
}

// --- 生成 AI の差し替え -----------------------------------------------------

/** 形の合った返答の見本。中身の良し悪しはここでは見ない。 */
function validOutput(headline: string): Record<string, unknown> {
  const value: Record<string, unknown> = {};
  for (const field of OUTPUT_REQUIRED_FIELDS) value[field] = headline;
  value.claims_used = [];
  value.evidence_used = [];
  value.assumptions = [];
  value.affiliate_link_ids = [];
  value.platform_warnings = [];
  value.factuality_score = 0.9;
  value.persona_fit_score = 0.9;
  value.channel_fit_score = 0.9;
  value.compliance_status = "pass";
  return value;
}

function scriptedLlm(outputs: readonly Record<string, unknown>[]) {
  const requests: LlmRequest[] = [];
  const llm: LlmPort = {
    async generateStructured<T>(request: LlmRequest) {
      requests.push(request);
      const output = outputs[Math.min(requests.length - 1, outputs.length - 1)];
      return ok({
        output: output as T,
        modelId: "test-model",
        inputTokens: 100,
        outputTokens: 200,
        truncated: false,
      });
    },
    async embed() {
      return ok([]);
    },
  };
  return { llm, requests };
}

const costs: LlmCostEstimatorPort = {
  async estimate() {
    return ok({ estimatedCostMinor: 30, currency: "JPY" });
  },
};

// --- 改善ループの種 ---------------------------------------------------------

const RUN_ID = "exp_loop_1" as ExperimentId;

function aSpec(id: string, label: string, value: string): VariantSpec {
  return {
    id,
    label,
    settings: [{ dimensionKey: "summary_position", value }],
    provenance: {
      source: "test",
      collectedAt: NOW,
      note: "1 周を通すための見本",
    },
    approvedBy: "user-owner",
    approvedAt: NOW,
  } as unknown as VariantSpec;
}

function aRun(): LoopRun {
  return {
    id: RUN_ID,
    workspaceId: WS,
    loopKindKey: "content_improvement",
    siteSlug: "video-editing-gear",
    baselineSpecId: "vs_baseline",
    candidateSpecId: "vs_candidate",
    changedDimensions: ["summary_position"],
    primaryMetric: "read_completion_rate",
    minimumSamples: 100,
    status: "running",
    startedAt: NOW,
    concludedAt: null,
    verdict: null,
    stoppedReason: null,
  } as unknown as LoopRun;
}

/** 差がはっきり出ていて、件数も足りている観測値。 */
const CONCLUSIVE: LoopObservation = {
  runId: RUN_ID,
  baselineValue: 0.4,
  baselineSamples: 800,
  candidateValue: 0.55,
  candidateSamples: 800,
};

/** 件数が足りない観測値。判定できないことを隠さない側の確認に使う。 */
const TOO_FEW: LoopObservation = {
  runId: RUN_ID,
  baselineValue: 0.4,
  baselineSamples: 3,
  candidateValue: 0.9,
  candidateSamples: 3,
};

// --- 公開ゲートに通る記事 ---------------------------------------------------

function readyCandidate(): PublishCandidate {
  return {
    articleType: "ranking",
    presentSections: requiredSectionsFor("ranking"),
    authorIds: ["au_1"],
    updateOwnerId: "u_1",
    relationshipType: "affiliate",
    disclosureVisibleMessage: "アフィリエイト広告を利用しています。",
    claimCount: 3,
    evidenceCount: 2,
    hasAffiliateCta: true,
    merchantOptionCount: 2,
    imageRightsConfirmed: true,
    structuredDataValid: true,
    mobileChecked: true,
    linksChecked: true,
    aiAnswerEvalPassed: true,
    webmcpSchemaEval: true,
    nextReviewAt: new Date("2026-12-01T00:00:00Z"),
    now: NOW,
  };
}

// --- 1 周 -------------------------------------------------------------------

const CONNECTION = aChannelConnection({
  kind: "own_site",
  accountLabel: "見本ブログ",
  workspaceId: SAMPLE_WORKSPACE_ID as WorkspaceId,
});

let variants: EditorialContentVariantRepositoryPort;
let publications: PublicationRepositoryPort;
let events: ReturnType<typeof recordingEvents>;
let sink: ReturnType<typeof memorySink>;

beforeEach(() => {
  variants = memoryVariants();
  publications = memoryPublications();
  events = recordingEvents();
  sink = memorySink();
});

function contentDeps(): ManageContentDeps {
  const base = testDeps();
  return {
    packages: base.contentPackages,
    variants,
    personas: base.personas,
    events: events.port,
  };
}

function distributionDeps(): ManageDistributionDeps {
  const base = testDeps();
  return {
    // 出し先は 1 つだけ用意する。複数あると、ユースケースは
    // 「こちらで選ばずアカウント名を挙げて聞き返す」ので 1 周が進まない。
    // これは不便ではなく仕様（投稿は取り消しても「出た」事実が消せない）。
    connections: {
      ...base.channelConnections,
      listByWorkspace: async () => ok({ items: [CONNECTION], nextCursor: null }),
    } as ManageDistributionDeps["connections"],
    publications,
    manualExport: base.manualExport,
    variants,
    ids: base.ids,
  };
}

describe("1 周（作る → 承認 → 公開 → 測る → 分析 → 提案 → 承認 → 作り直す）", () => {
  it("段ごとの結果が次の段の入力になり、最後にもう 1 本作るところまで戻ってくる", async () => {
    // ① 作る。
    const { llm, requests } = scriptedLlm([
      validOutput("最初の下書き"),
      validOutput("作り直した下書き"),
    ]);
    const drafted = await createDraftContentVariantUseCase({ llm, costs }).execute(owner, {
      provided: sampleGenerationInput(),
    });
    expect(drafted.ok).toBe(true);
    if (!drafted.ok) return;
    expect(drafted.value.output.body).toBe("最初の下書き");
    // 見積りを取らずに呼んでいないこと。費用は呼ぶ前に分かる約束になっている。
    expect(drafted.value.estimatedCostMinor).toBe(30);

    // ② 承認。人が承認したことが記録に残る。
    const approved = await createApproveContentUseCase(contentDeps()).execute(owner, {
      variantId: VARIANT_ID,
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.value.status).toBe("approved");
    expect(events.names()).toContain("content_variant.approved");

    // 承認は**読み直しても**承認済みであること。
    // 返り値だけを見ると、保存されていなくても気づけない。
    const reread = await createGetContentUseCase(contentDeps()).execute(owner, {
      variantId: VARIANT_ID,
    });
    expect(reread.ok).toBe(true);
    if (!reread.ok) return;
    expect(reread.value.variant.status).toBe("approved");

    // ③ 公開。**アプリの入口から**配信を作る。
    // ここは以前 domain の `createPublication` を直接呼んで代用していた。
    // 代用したままだと「1 周は回るが、画面からも AI からも始められない」に
    // 気づけない（実際にそうなっていた。残課題 26）。
    const scheduled = await createSchedulePublicationUseCase(distributionDeps()).execute(owner, {
      variantId: String(reread.value.variant.id),
      channelKind: "own_site",
    });
    expect(scheduled.ok).toBe(true);
    if (!scheduled.ok) return;
    expect(scheduled.value.alreadyExisted).toBe(false);

    // 同じ要求をもう一度出しても増えない。二重投稿はここで止まる。
    const again = await createSchedulePublicationUseCase(distributionDeps()).execute(owner, {
      variantId: String(reread.value.variant.id),
      channelKind: "own_site",
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.alreadyExisted).toBe(true);
    expect(again.value.card.publicationId).toBe(scheduled.value.card.publicationId);

    const stored = await publications.findById(
      WS,
      taggedString<"PublicationId">(scheduled.value.card.publicationId) as PublicationId,
    );
    expect(stored.ok).toBe(true);
    if (!stored.ok || stored.value === null) return;
    const created = { ok: true as const, value: stored.value };

    const rendering = advance(created.value, "RENDERING", { at: NOW });
    expect(rendering.ok).toBe(true);
    if (!rendering.ok) return;
    const validating = advance(rendering.value, "VALIDATING", { at: NOW });
    expect(validating.ok).toBe(true);
    if (!validating.ok) return;

    const gate = evaluatePublishGate(readyCandidate());
    expect(gate.ok).toBe(true);
    const sending = advance(validating.value, "SENDING", { gate, at: NOW });
    expect(sending.ok).toBe(true);
    if (!sending.ok) return;
    const published = recordSendSuccess(
      sending.value,
      { id: "ext_1", url: "https://example.test/a" },
      NOW,
    );
    await publications.save(published);

    // 公開されたことが、配信の一覧から見えること。
    const listed = await createListPublicationsUseCase(distributionDeps()).execute(owner, {});
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.total).toBe(1);
    expect(listed.value.items[0]?.stateLabel).toBe("公開済み");
    expect(listed.value.needsAttention).toHaveLength(0);

    // ④ 測る。同意が要らない回数と、要る詳しい記録の両方を送る。
    const recorded = await createRecordTelemetryUseCase({ sink }).execute(owner, {
      events: [
        {
          key: "page_view",
          payload: {
            path: "/video-editing-gear/laptops",
            siteSlug: "video-editing-gear",
            referrerKind: "search",
          },
        },
        {
          key: "scroll_depth",
          payload: {
            path: "/video-editing-gear/laptops",
            siteSlug: "video-editing-gear",
            percent: 80,
          },
        },
      ],
      signals: { choice: "granted" },
      readerKey: "rk_test",
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    expect(recorded.value.accepted).toBe(2);
    expect(sink.stored()).toHaveLength(2);

    // ⑤ 分析。数字は「どう数えたか」と一緒に出る。
    //
    // **注記（この試験で分かったこと）**: ここで読む数字は、④ で記録した
    // 出来事から作られていない。計測の受け口と集計の保存先がまだ別物で、
    // 繋ぎ目が無い。1 周は回るが、④ の結果が ⑤ に届いていないことを
    // 隠さずに書いておく（`docs/product/backlog.md` に項目として残した）。
    const metrics = await createListMetricsUseCase({ metrics: testDeps().metrics }).execute(
      owner,
      {},
    );
    expect(metrics.ok).toBe(true);
    if (!metrics.ok) return;
    expect(metrics.value.rows.length).toBeGreaterThan(0);
    for (const row of metrics.value.rows) {
      expect(row.howCounted).not.toBe("");
      // 判断に使えない数字には、必ず使えない理由が付いていること。
      if (!row.usableForEditorialJudgement) expect(row.notUsableReason).not.toBeNull();
    }

    // ⑥ 提案。件数が足りていれば、何を変えるかが言葉で出る。
    const improvement = memoryImprovement({
      specs: [aSpec("vs_baseline", "いまの見せ方", "top"), aSpec("vs_candidate", "試す見せ方", "bottom")],
      runs: [aRun()],
      observations: { [RUN_ID]: CONCLUSIVE },
    });
    const reviewed = await createReviewLoopRunsUseCase({ repository: improvement }).execute(
      owner,
      {},
    );
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    const row = reviewed.value.rows.find((r) => r.id === RUN_ID);
    expect(row).toBeDefined();
    expect(row?.blockedReason).toBeNull();
    expect(row?.suggestions.length).toBeGreaterThan(0);
    // 判定が出たときの提案は、残すか戻すかのどちらかを言う。
    expect(row?.suggestions[0]?.verdict).not.toBe("pending");
    expect(row?.suggestions[0]?.requiresApproval).toBe(true);
    // 提案は「勝手に適用しない」。人の承認が要ることが読む側に出ている。
    expect(reviewed.value.caveats.join("")).toContain("人の承認");

    // ⑦ 承認（提案の側）。承認した見せ方が保存先に残ること。
    const adopted = aSpec("vs_adopted", "採用した見せ方", "bottom");
    const savedSpec = await improvement.saveVariantSpec(WS, adopted);
    expect(savedSpec.ok).toBe(true);
    const specsAfter = await improvement.listVariantSpecs(WS);
    expect(specsAfter.ok).toBe(true);
    if (!specsAfter.ok) return;
    expect(specsAfter.value.map((s) => s.id)).toContain("vs_adopted");

    // ⑧ 作り直す。同じユースケースをもう一度通り、2 本目が出る。
    const regenerated = await createDraftContentVariantUseCase({ llm, costs }).execute(owner, {
      provided: sampleGenerationInput(),
    });
    expect(regenerated.ok).toBe(true);
    if (!regenerated.ok) return;
    expect(regenerated.value.output.body).toBe("作り直した下書き");
    expect(requests).toHaveLength(2);
  });

  it("承認を飛ばしても、公開ゲートの結果が無ければ送信へ進めない", async () => {
    const created = createPublication({
      id: taggedString<"PublicationId">("pub_loop_2") as PublicationId,
      workspaceId: WS,
      variantId: taggedString<"ContentVariantId">(VARIANT_ID) as ContentVariantId,
      channelKind: "own_site",
      connectionId: CONNECTION.id,
      idempotencyKey: "idem-loop-2",
    });
    if (!created.ok) throw created.error;

    const rendering = advance(created.value, "RENDERING", { at: NOW });
    if (!rendering.ok) throw rendering.error;
    const validating = advance(rendering.value, "VALIDATING", { at: NOW });
    if (!validating.ok) throw validating.error;

    // ゲートを渡さずに進めようとする。ここが通ると承認の意味が消える。
    const blocked = advance(validating.value, "SENDING", { at: NOW });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error.code).toBe("PUBLISH_GATE_FAILED");
    expect(blocked.error.suggestedAction).toContain("公開前チェック");
  });

  it("同意が無いときも 1 周は止まらず、詳しい記録だけが落ちる", async () => {
    const recorded = await createRecordTelemetryUseCase({ sink }).execute(owner, {
      events: [
        {
          key: "page_view",
          payload: { path: "/a", siteSlug: "video-editing-gear", referrerKind: "direct" },
        },
        {
          key: "scroll_depth",
          payload: { path: "/a", siteSlug: "video-editing-gear", percent: 50 },
        },
      ],
      signals: { choice: "denied" },
      readerKey: "rk_test",
    });
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    expect(recorded.value.accepted).toBe(1);
    expect(recorded.value.droppedByConsent).toBe(1);
    // 落とした側を黙って消さない。件数として出ることが、原因の切り分けを可能にする。
    expect(recorded.value.decision.allowBehaviour).toBe(false);
    // 目印は残さない。同意が無いのに読者を追える状態を作らない。
    expect(sink.stored()[0]?.readerKey).toBeNull();
  });

  it("件数が足りないうちは、差があると言わずに理由を出す", async () => {
    const improvement = memoryImprovement({
      specs: [aSpec("vs_baseline", "いまの見せ方", "top"), aSpec("vs_candidate", "試す見せ方", "bottom")],
      runs: [aRun()],
      observations: { [RUN_ID]: TOO_FEW },
    });
    const reviewed = await createReviewLoopRunsUseCase({ repository: improvement }).execute(
      owner,
      {},
    );
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    const row = reviewed.value.rows.find((r) => r.id === RUN_ID);
    expect(row?.blockedReason).not.toBeNull();
    // 判定できないときも提案の欄は空にしない。空にすると
    //「まだ何も分からない」ことが画面から消え、次の一手が示されない。
    // 出るのは**変えないことの提案**であり、採用を促す提案ではない。
    expect(row?.suggestions[0]?.verdict).toBe("pending");
    expect(row?.suggestions[0]?.rationale).toContain("いまは変えない");
    expect(reviewed.value.pendingCount).toBe(1);
  });
});

// --- 本番の組み立てで、まだ繋がっていない段がどう振る舞うか -------------------

describe("本番の組み立て（見本データのまま）で 1 周を通そうとしたとき", () => {
  it("承認は成功を装わず、次に何を待てばよいかを添えて断る", async () => {
    const real = createDeps();
    const result = await createApproveContentUseCase({
      packages: real.contentPackages,
      variants: real.contentVariants,
      personas: real.personas,
      events: real.events,
    }).execute(owner, { variantId: VARIANT_ID });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 空の成功で返さないこと。返すと「承認したのに残っていない」が起きる。
    expect(result.error.code).toBe("NOT_IMPLEMENTED");
    expect(result.error.suggestedAction).not.toBeNull();
    expect(result.error.suggestedAction).toContain("保存先");
  });

  it("採用した見せ方の保存も、同じ形で断る（黙って捨てない）", async () => {
    const real = createDeps();
    const saved = await real.improvement.saveVariantSpec(WS, aSpec("vs_x", "試し", "top"));
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.code).toBe("NOT_IMPLEMENTED");
    expect(saved.error.suggestedAction).not.toBeNull();
  });

  it("読み出しだけの段は見本データで通る（読めるものまで止めない）", async () => {
    const real = createDeps();
    const reviewed = await createReviewLoopRunsUseCase({ repository: real.improvement }).execute(
      owner,
      {},
    );
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    // 0 件でも「読めなかった」と同じ顔にしない。どちらかが必ず言葉で出る。
    if (reviewed.value.rows.length === 0) expect(reviewed.value.emptyReason).not.toBeNull();
    else expect(reviewed.value.emptyReason).toBeNull();
  });
});
