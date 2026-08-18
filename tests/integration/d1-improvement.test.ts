/**
 * @tier 2
 * @req REQ-IM13
 * @types db-migration, tenant-isolation, state-transition, equivalence, decision-table
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import type { ImprovementRepositoryPort } from "@/application/ports/improvement";
import { createD1ImprovementRepository } from "@/infrastructure/persistence/d1/improvement-repository";
import type { LoopRun, VariantSetting, VariantSpec } from "@/domain/analytics";
import { asExperimentId, asWorkspaceId, type WorkspaceId } from "@/domain/shared";

/**
 * 改善ループの記録先（`variant_specs` / `loop_runs` / `loop_observations`）を、
 * **本物の D1 と本物のマイグレーション**で通す結合テスト。
 *
 * --- ここでいちばん見たいこと ---
 *
 * **一覧が入口でしか守られていない状態を無くすこと。**
 * `createVariantSpec` / `createLoopRun` は「作るとき」に一覧を突き当てるが、
 * 保存先は作られた値ではなく渡された値を受け取る。入口を通さずに組み立てた値を
 * `save〜` へ渡せば、「広告であることの表示」を軸にした記録が書けてしまう。
 * だから**この試験は入口を一切通さず、値を直に組み立てて保存を呼ぶ**。
 * 入口を通して作った値で試すと、入口が断ってくれるので保存側の穴が見えない。
 *
 * --- 一覧をここに書き写している理由 ---
 *
 * 調整してはいけない 6 件は、下に**文字列で書いてある**。実装の一覧
 * (`NON_OPTIMIZABLE`) を回すと、一覧から 1 件消えた日にこの試験も 1 周短くなって
 * 緑のまま通る（REQ-IM12 で実際にそうなっていた）。一覧が縮んだことを見張るには、
 * 見張る側が一覧を持っていなければならない。
 *
 * 規範: docs/spec/03-分析・解析基盤仕様.md §14.2 / §14.3 / §14.5、REQ-IM13
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let repo: ImprovementRepositoryPort;

const WS = asWorkspaceId("ws_loop") as WorkspaceId;
const OTHER_WS = asWorkspaceId("ws_other") as WorkspaceId;
const SITE = "video-editing-gear";

/**
 * 仕様 §14.5 の「調整してはいけないもの」6 件。
 * **実装の一覧を読み込まずに、ここへ書き写してある。**
 */
const NON_OPTIMIZABLE_KEYS = [
  "evidence_requirement",
  "disclosure_presence",
  "accessibility_level",
  "ranking_inputs",
  "consent_prominence",
  "factuality_labeling",
] as const;

function migrationStatements(): readonly string[] {
  const dir = path.resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(files.length).toBeGreaterThan(0);
  return files.flatMap((file) =>
    readFileSync(path.join(dir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s !== ""),
  );
}

/** 入口（`createVariantSpec`）を通さずに組み立てる。保存側だけを測るため。 */
function aSpec(over: Partial<VariantSpec> & { readonly id: string }): VariantSpec {
  return {
    label: "現行（比べるもと）",
    settings: [{ dimensionKey: "section_order", value: "結論が先" }],
    provenance: {
      sourceType: "manual",
      sourceName: "編集の責任者が決定",
      sourceUrl: null,
      retrievedAt: new Date("2026-07-01T00:00:00.000Z"),
      validUntil: null,
      confidence: 1,
      permittedUsage: "社内の記録として保持する",
    },
    approvedBy: "編集の責任者",
    approvedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...over,
  };
}

/**
 * 入口（`createLoopRun`）を通さずに組み立てる。
 *
 * `id` だけ `Omit` してあるのは、`LoopRun["id"]` が印つきの型で、
 * 素の文字列を書けないため。ここでは `asExperimentId` を通して付け直す。
 */
function aRun(over: Omit<Partial<LoopRun>, "id"> & { readonly id: string }): LoopRun {
  return {
    workspaceId: WS,
    loopKindKey: "content_improvement",
    siteSlug: SITE,
    baselineSpecId: "spec_baseline",
    candidateSpecId: "spec_candidate",
    changedDimensions: ["section_order"],
    primaryMetric: "read_completion_rate",
    minimumSamples: 200,
    status: "draft",
    startedAt: null,
    concludedAt: null,
    verdict: null,
    stoppedReason: null,
    ...over,
    id: asExperimentId(over.id),
  };
}

/** 承認済みの比べる 2 つを置いてから、比較を保存できる状態にする。 */
async function seedApprovedPair(): Promise<void> {
  for (const id of ["spec_baseline", "spec_candidate"]) {
    const saved = await repo.saveVariantSpec(WS, { spec: aSpec({ id }), siteSlug: SITE });
    expect(saved.ok).toBe(true);
  }
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
  repo = createD1ImprovementRepository(drizzle(proxy.env.DB, { schema }));
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  for (const table of ["loop_observations", "loop_runs", "variant_specs"]) {
    await proxy.env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe("マイグレーションそのもの", () => {
  it("3 つの表を実際に作る", async () => {
    const found = await proxy.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('variant_specs','loop_runs','loop_observations') ORDER BY name",
    ).all<{ name: string }>();
    expect(found.results.map((r) => r.name)).toEqual([
      "loop_observations",
      "loop_runs",
      "variant_specs",
    ]);
  });
});

describe("見せ方の設定を残す", () => {
  it("保存したものを読み直せる（由来の日付が Date で戻る）", async () => {
    const saved = await repo.saveVariantSpec(WS, { spec: aSpec({ id: "vs_1" }), siteSlug: SITE });
    expect(saved.ok).toBe(true);

    const listed = await repo.listVariantSpecs(WS, { siteSlug: SITE });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const found = listed.value.find((s) => s.id === "vs_1");
    expect(found?.label).toBe("現行（比べるもと）");
    expect(found?.settings).toEqual([{ dimensionKey: "section_order", value: "結論が先" }]);
    // 文字列のまま戻ると、日付の比較が黙って文字列比較になる。
    expect(found?.provenance.retrievedAt).toBeInstanceOf(Date);
    expect(found?.provenance.retrievedAt.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(found?.approvedAt).toBeInstanceOf(Date);
  });

  it("同じ id で保存し直すと上書きされる（増えない）", async () => {
    await repo.saveVariantSpec(WS, { spec: aSpec({ id: "vs_1" }), siteSlug: SITE });
    await repo.saveVariantSpec(WS, {
      spec: aSpec({ id: "vs_1", label: "名前を直した" }),
      siteSlug: SITE,
    });
    const listed = await repo.listVariantSpecs(WS);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.filter((s) => s.id === "vs_1")).toHaveLength(1);
    expect(listed.value[0]?.label).toBe("名前を直した");
  });

  it("ほかの作業場所の設定は一覧に出ない", async () => {
    await repo.saveVariantSpec(WS, { spec: aSpec({ id: "vs_mine" }), siteSlug: SITE });
    await repo.saveVariantSpec(OTHER_WS, { spec: aSpec({ id: "vs_theirs" }), siteSlug: SITE });
    const listed = await repo.listVariantSpecs(WS);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((s) => s.id)).toEqual(["vs_mine"]);
  });

  it("ブログを指定すると、そのブログのぶんだけ出る", async () => {
    await repo.saveVariantSpec(WS, { spec: aSpec({ id: "vs_a" }), siteSlug: SITE });
    await repo.saveVariantSpec(WS, { spec: aSpec({ id: "vs_b" }), siteSlug: "another-blog" });
    const listed = await repo.listVariantSpecs(WS, { siteSlug: SITE });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((s) => s.id)).toEqual(["vs_a"]);
  });
});

describe("調整してはいけないものを、保存側でも軸にできない", () => {
  // 仕様 §14.5 が禁じている行為そのもの:
  // 「根拠を示すこと」「広告であることの表示」…を改善の軸にする。
  it.each(NON_OPTIMIZABLE_KEYS)("%s を軸にした設定は保存できない", async (key) => {
    const spec = aSpec({
      id: `vs_${key}`,
      settings: [{ dimensionKey: key, value: "減らす" } satisfies VariantSetting],
    });
    const saved = await repo.saveVariantSpec(WS, { spec, siteSlug: SITE });
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.code).toBe("INVARIANT_VIOLATED");
    // 「表に無いから」ではなく「調整の対象にしないと決めたから」断る。
    expect(saved.error.message).toContain("改善の軸にできません");
    expect(saved.error.suggestedAction).not.toBeNull();

    // 断ったのに行が残っていないこと。書いてから直すのでは
    //「一度は書けた」という事実が保存先に残る。
    const listed = await repo.listVariantSpecs(WS);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value).toHaveLength(0);
  });

  it.each(NON_OPTIMIZABLE_KEYS)("%s を変えた比較は記録できない", async (key) => {
    await seedApprovedPair();
    const run = aRun({ id: "run_banned", changedDimensions: [key] });
    const saved = await repo.saveRun(WS, run);
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("改善の軸にできません");
  });

  it("登録表に無い軸も保存できない（禁止の一覧とは別の理由で断る）", async () => {
    const spec = aSpec({
      id: "vs_unknown",
      settings: [{ dimensionKey: "font_size_of_disclosure", value: 8 }],
    });
    const saved = await repo.saveVariantSpec(WS, { spec, siteSlug: SITE });
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.code).toBe("VALIDATION_FAILED");
    expect(saved.error.message).toContain("登録されていない軸");
  });
});

describe("承認されていないものを比較に使わせない", () => {
  it("承認の欄が片方だけの設定は保存できない", async () => {
    const saved = await repo.saveVariantSpec(WS, {
      spec: aSpec({ id: "vs_half", approvedAt: null }),
      siteSlug: SITE,
    });
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("両方そろっていないと記録できません");
  });

  it("未承認の設定を指した比較は記録できない（見た目だけの変更も同じ）", async () => {
    await repo.saveVariantSpec(WS, { spec: aSpec({ id: "spec_baseline" }), siteSlug: SITE });
    await repo.saveVariantSpec(WS, {
      spec: aSpec({ id: "spec_candidate", approvedBy: null, approvedAt: null }),
      siteSlug: SITE,
    });
    const saved = await repo.saveRun(WS, aRun({ id: "run_unapproved" }));
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.code).toBe("INVARIANT_VIOLATED");
    expect(saved.error.message).toContain("承認されていません");
  });

  it("保存先に無い設定を指した比較は記録できない", async () => {
    const saved = await repo.saveRun(WS, aRun({ id: "run_dangling" }));
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("保存先にありません");
  });

  it("ほかの作業場所の設定は、比較の相手にならない", async () => {
    await repo.saveVariantSpec(OTHER_WS, { spec: aSpec({ id: "spec_baseline" }), siteSlug: SITE });
    await repo.saveVariantSpec(OTHER_WS, { spec: aSpec({ id: "spec_candidate" }), siteSlug: SITE });
    const saved = await repo.saveRun(WS, aRun({ id: "run_cross" }));
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("保存先にありません");
  });
});

describe("判定の規律を、記録の側でも守る", () => {
  beforeEach(seedApprovedPair);

  it("3 つの軸を同時に変えた比較は記録できない", async () => {
    const saved = await repo.saveRun(
      WS,
      aRun({
        id: "run_too_many",
        changedDimensions: ["section_order", "lead_length", "body_max_width"],
      }),
    );
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("多すぎます");
  });

  it("判定保留のまま終わった記録は残せない", async () => {
    const saved = await repo.saveRun(
      WS,
      aRun({
        id: "run_pending",
        status: "concluded",
        startedAt: new Date("2026-08-01T00:00:00.000Z"),
        concludedAt: new Date("2026-08-10T00:00:00.000Z"),
        verdict: "pending",
      }),
    );
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("判定保留のまま終わらせられません");
  });

  it("判定の入っていない「判定済み」も残せない", async () => {
    const saved = await repo.saveRun(
      WS,
      aRun({
        id: "run_no_verdict",
        status: "concluded",
        startedAt: new Date("2026-08-01T00:00:00.000Z"),
        concludedAt: new Date("2026-08-10T00:00:00.000Z"),
        verdict: null,
      }),
    );
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("判定が要ります");
  });

  it("理由の無い打ち切りは残せない", async () => {
    const saved = await repo.saveRun(
      WS,
      aRun({
        id: "run_stopped",
        status: "stopped",
        startedAt: new Date("2026-08-01T00:00:00.000Z"),
        concludedAt: new Date("2026-08-05T00:00:00.000Z"),
        stoppedReason: "   ",
      }),
    );
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("打ち切る理由");
  });

  it("定義されていない指標では記録できない（指標の後出しを残さない）", async () => {
    const saved = await repo.saveRun(
      WS,
      aRun({ id: "run_metric", primaryMetric: "revenue_per_reader" as LoopRun["primaryMetric"] }),
    );
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("定義されていません");
  });

  it("登録されていないループの記録は残せない", async () => {
    const saved = await repo.saveRun(WS, aRun({ id: "run_kind", loopKindKey: "vibes_loop" }));
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("登録されていないループ");
  });

  it("まだ動かせないループの記録は残せない", async () => {
    const saved = await repo.saveRun(
      WS,
      aRun({ id: "run_planned", loopKindKey: "topic_expansion" }),
    );
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("1 件ずつ扱うループを、件数で比べる記録にできない", async () => {
    // `product_improvement` は実装済みだが `decisionBasis` が単件。
    // 件数がそろうのを待つ仕組みへ乗せると、待つ相手のいない記録になる。
    const saved = await repo.saveRun(
      WS,
      aRun({ id: "run_single_case", loopKindKey: "product_improvement" }),
    );
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("比べて決めるループではありません");
  });

  it("同じ設定どうしを比べた記録は残せない", async () => {
    const saved = await repo.saveRun(
      WS,
      aRun({ id: "run_same", baselineSpecId: "spec_baseline", candidateSpecId: "spec_baseline" }),
    );
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("同じ設定どうし");
  });

  it("違いが 1 つも無い比較は残せない", async () => {
    const saved = await repo.saveRun(WS, aRun({ id: "run_no_diff", changedDimensions: [] }));
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("違いがありません");
  });

  it.each([0, -1, 2.5])(
    "必要件数が %s の比較は残せない（件数に届く前に差があると言えてしまう）",
    async (minimumSamples) => {
      const saved = await repo.saveRun(
        WS,
        aRun({ id: `run_samples_${minimumSamples}`, minimumSamples }),
      );
      expect(saved.ok).toBe(false);
      if (saved.ok) return;
      expect(saved.error.message).toContain("1 以上の整数");
    },
  );

  it("ほかの作業場所の記録は保存できない", async () => {
    const saved = await repo.saveRun(WS, aRun({ id: "run_other", workspaceId: OTHER_WS }));
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.code).toBe("FORBIDDEN");
  });

  it("そろっている記録は保存でき、読み直せる", async () => {
    const saved = await repo.saveRun(
      WS,
      aRun({
        id: "run_ok",
        status: "running",
        startedAt: new Date("2026-08-01T00:00:00.000Z"),
      }),
    );
    expect(saved.ok).toBe(true);
    const listed = await repo.listRuns(WS, { siteSlug: SITE });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const run = listed.value.find((r) => String(r.id) === "run_ok");
    expect(run?.status).toBe("running");
    expect(run?.changedDimensions).toEqual(["section_order"]);
    expect(run?.minimumSamples).toBe(200);
    expect(run?.startedAt).toBeInstanceOf(Date);
  });
});

describe("観測値", () => {
  beforeEach(async () => {
    await seedApprovedPair();
    const saved = await repo.saveRun(
      WS,
      aRun({ id: "run_ok", status: "running", startedAt: new Date("2026-08-01T00:00:00.000Z") }),
    );
    expect(saved.ok).toBe(true);
  });

  const observation = {
    runId: "run_ok",
    baselineValue: 0.42,
    baselineSamples: 1_180,
    candidateValue: 0.49,
    candidateSamples: 1_204,
    observedAt: new Date("2026-08-10T00:00:00.000Z"),
  };

  it("保存したものを読み直せる", async () => {
    const saved = await repo.saveObservation(WS, observation);
    expect(saved.ok).toBe(true);
    const read = await repo.observationsOf(WS, "run_ok");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toEqual({
      runId: "run_ok",
      baselineValue: 0.42,
      baselineSamples: 1_180,
      candidateValue: 0.49,
      candidateSamples: 1_204,
    });
  });

  it("測り直すと上書きされる（1 周につき 1 行）", async () => {
    await repo.saveObservation(WS, observation);
    await repo.saveObservation(WS, { ...observation, candidateSamples: 1_500 });
    const read = await repo.observationsOf(WS, "run_ok");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value?.candidateSamples).toBe(1_500);
  });

  it("ほかの作業場所の観測値は読めない", async () => {
    await repo.saveObservation(WS, observation);
    const read = await repo.observationsOf(OTHER_WS, "run_ok");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toBeNull();
  });

  it("保存先に無い比較の観測値は書けない", async () => {
    const saved = await repo.saveObservation(WS, { ...observation, runId: "run_missing" });
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("保存先にありません");
  });

  it("まだ始まっていない比較に観測値は書けない", async () => {
    await repo.saveRun(WS, aRun({ id: "run_draft" }));
    const saved = await repo.saveObservation(WS, { ...observation, runId: "run_draft" });
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("まだ始まっていない");
  });

  it("件数が負の観測値は書けない", async () => {
    const saved = await repo.saveObservation(WS, { ...observation, baselineSamples: -1 });
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("0 以上の整数");
  });

  it("数字になっていない観測値は書けない", async () => {
    const saved = await repo.saveObservation(WS, { ...observation, candidateValue: Number.NaN });
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.message).toContain("数字になっていません");
  });
});
