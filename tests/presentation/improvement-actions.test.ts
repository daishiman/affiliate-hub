/**
 * @tier 1
 * @req REQ-IM06, REQ-IM09
 * @types permission-matrix, state-transition
 *
 * 改善ループを**画面から 1 周まわす**ところ。
 *
 * --- なぜこの試験が要ったのか ---
 *
 * 記録先の表も、判定の式も、保存の突き当ても先にそろっていた。
 * それでも改善ループは 1 度も回っていなかった。**押せる場所が無かった**からである。
 * 部品が全部あることと、通しで動くことは別なので、ここでは
 * 「試作を登録する → 承認する → 始める → 観測を書く → 判定する」を
 * **画面が呼ぶのと同じ入口（サーバーアクション）**で順に押す。
 *
 * ユースケースを直に呼ばないのは、押した先で別のものを呼んでいても
 * ユースケースの試験は緑のままだからである（`admin-actions.test.ts` と同じ理由）。
 *
 *   REQ-IM06  試作の承認。人だけができ、承認していないものは比較に使えない。
 *   REQ-IM09  開始・観測・判定の履歴。件数不足のまま「決まった」ことにしない。
 *
 * 規範: docs/spec/03-分析・解析基盤仕様.md §14.3 / §14.5
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/** 画面の作り直しは要求の中でしか呼べない。ここでは何もしない形にする。 */
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

/**
 * 誰がログインしているか。`null` は「ログインできていない」。
 *
 * 差し替えるのは `signedInActor()` であって `getCurrentActor()` ではない。
 * 操作の側は**見本の身元へ落ちない**入口を使っており、見本を差し替えても
 * そこは通らないためである（落ちる入口を使っていたのが 2026-08-19 まで）。
 */
let signedIn: ActorContext | null = SAMPLE_ACTOR;
vi.mock("@/presentation/composition", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/presentation/composition")>()),
  signedInActor: async () => signedIn,
}));

/** 一覧を引くときに渡す身元。ログインしていない状態では引けない。 */
function current(): ActorContext {
  if (signedIn === null) throw new Error("ログインしていない状態では一覧を引けません。");
  return signedIn;
}

const {
  advanceLoopRunAction,
  approveVariantSpecAction,
  draftVariantSpecAction,
  startLoopRunAction,
} = await import("@/presentation/admin/observe/improvement-action");
const { improvementUseCases } = await import("@/presentation/composition");

const SITE = "video-editing-gear";
const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string | readonly string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) for (const v of value) data.append(key, v);
    else data.set(key, value as string);
  }
  return data;
}

/** 改善ループを回せる人。見本のログイン（数字を見るだけ）には無い権限である。 */
function asImprovementRunner(): void {
  signedIn = { ...SAMPLE_ACTOR, roles: ["workspace_admin"] };
}

/** 登録した試作の id を、画面が使うのと同じ一覧から引く。 */
async function specIdByLabel(label: string): Promise<string> {
  const listed = await (await improvementUseCases()).dimensions.execute(current(), {});
  if (!listed.ok) throw new Error(listed.error.message);
  const found = listed.value.specs.find((s) => s.label === label);
  if (found === undefined) throw new Error(`登録した試作が一覧に出ていません: ${label}`);
  return found.id;
}

/** 実施中の比較を、画面が使うのと同じ一覧から引く。 */
async function runningRun(): Promise<{ id: string; hasObservation: boolean }> {
  const listed = await (await improvementUseCases()).review.execute(current(), { siteSlug: SITE });
  if (!listed.ok) throw new Error(listed.error.message);
  const found = listed.value.rows.find((r) => r.status === "running");
  if (found === undefined) throw new Error("実施中の比較が一覧に出ていません。");
  return { id: found.id, hasObservation: found.hasObservation };
}

beforeEach(() => {
  signedIn = SAMPLE_ACTOR;
});

describe("改善ループを画面から 1 周まわす", () => {
  it("登録 → 承認 → 開始 → 観測 → 判定 が、押した順に通る", async () => {
    asImprovementRunner();
    const label = `比較表を先に出す（試験 ${Date.now()}）`;

    // 1. 試作を登録する。軸は画面が並べた分だけ届く。
    const drafted = await draftVariantSpecAction(
      IDLE,
      form({
        siteSlug: SITE,
        label,
        dimensionKey: ["section_order", "lead_length"],
        dimensionValue: ["比較が先", "240"],
      }),
    );
    expect(drafted.status).toBe("done");

    const specId = await specIdByLabel(label);

    // 登録しただけでは比較に使えない。ここで始められたら承認が飾りになる。
    const tooEarly = await startLoopRunAction(
      IDLE,
      form({
        siteSlug: SITE,
        baselineSpecId: "spec_baseline",
        candidateSpecId: specId,
        primaryMetric: "read_completion_rate",
      }),
    );
    expect(tooEarly.status).toBe("failed");

    // 2. 承認する。
    const approved = await approveVariantSpecAction(IDLE, form({ siteSlug: SITE, specId }));
    expect(approved.status).toBe("done");

    // 3. 比較を始める。件数は既定のまま（空欄を 0 に読み替えない）。
    const started = await startLoopRunAction(
      IDLE,
      form({
        siteSlug: SITE,
        baselineSpecId: "spec_baseline",
        candidateSpecId: specId,
        primaryMetric: "read_completion_rate",
        minimumSamples: "",
      }),
    );
    expect(started.status).toBe("done");

    const run = await runningRun();

    // 4. 観測を書く。
    const observed = await advanceLoopRunAction(
      IDLE,
      form({
        runId: run.id,
        intent: "observe",
        baselineValue: "0.42",
        baselineSamples: "1200",
        candidateValue: "0.49",
        candidateSamples: "1200",
      }),
    );
    expect(observed.status).toBe("done");

    // 5. 判定する。ここまでが 1 周。
    const concluded = await advanceLoopRunAction(IDLE, form({ runId: run.id, intent: "conclude" }));
    expect(concluded.status).toBe("done");
    expect(concluded.message.trim()).not.toBe("");

    // 判定の結果が、見る側の一覧にも出ている（書いたつもりで終わっていない）。
    const listed = await (await improvementUseCases()).review.execute(current(), { siteSlug: SITE });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      const row = listed.value.rows.find((r) => r.id === run.id);
      expect(row?.status).toBe("concluded");
      expect(row?.result).not.toBeNull();
    }
  });

  it("件数が足りないまま判定しても「決まった」ことにならない", async () => {
    asImprovementRunner();
    const label = `本文を短くする（試験 ${Date.now()}）`;

    await draftVariantSpecAction(
      IDLE,
      form({
        siteSlug: SITE,
        label,
        dimensionKey: ["section_order", "lead_length"],
        dimensionValue: ["結論が先", "120"],
      }),
    );
    const specId = await specIdByLabel(label);
    await approveVariantSpecAction(IDLE, form({ siteSlug: SITE, specId }));
    await startLoopRunAction(
      IDLE,
      form({
        siteSlug: SITE,
        baselineSpecId: "spec_baseline",
        candidateSpecId: specId,
        primaryMetric: "read_completion_rate",
      }),
    );
    const run = await runningRun();

    await advanceLoopRunAction(
      IDLE,
      form({
        runId: run.id,
        intent: "observe",
        // 差は大きいが、件数が既定（200 件）に届いていない。
        baselineValue: "0.30",
        baselineSamples: "12",
        candidateValue: "0.90",
        candidateSamples: "11",
      }),
    );
    const concluded = await advanceLoopRunAction(IDLE, form({ runId: run.id, intent: "conclude" }));

    // 判定そのものは断らない。**「まだ分からない」で終わらせない**ために、
    // 判定できない理由が返り、比較は実施中のまま残る。
    expect(concluded.status).toBe("failed");
    expect(concluded.message.trim()).not.toBe("");

    const listed = await (await improvementUseCases()).review.execute(current(), { siteSlug: SITE });
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.value.rows.find((r) => r.id === run.id)?.status).toBe("running");
  });

  it("理由の無い打ち切りは残せない", async () => {
    asImprovementRunner();
    const run = await runningRun();
    const stopped = await advanceLoopRunAction(IDLE, form({ runId: run.id, intent: "stop", reason: "" }));

    expect(stopped.status).toBe("failed");
  });

  it("できること以外を指定されたら、できることを並べて返す", async () => {
    asImprovementRunner();
    const state = await advanceLoopRunAction(IDLE, form({ runId: "run_body_width", intent: "delete" }));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("観測値を書く");
  });
});

describe("誰が回せるか", () => {
  it("数字を見るだけの人は、回すことも承認することもできない", async () => {
    // 見本のログイン（`analyst`）。見えることと回せることを分けている。
    const drafted = await draftVariantSpecAction(
      IDLE,
      form({
        siteSlug: SITE,
        label: "見るだけの人が登録",
        dimensionKey: ["section_order"],
        dimensionValue: ["比較が先"],
      }),
    );
    expect(drafted.status).toBe("failed");

    const approved = await approveVariantSpecAction(
      IDLE,
      form({ siteSlug: SITE, specId: "spec_warm_theme" }),
    );
    expect(approved.status).toBe("failed");

    const started = await startLoopRunAction(
      IDLE,
      form({
        siteSlug: SITE,
        baselineSpecId: "spec_baseline",
        candidateSpecId: "spec_compare_first",
        primaryMetric: "read_completion_rate",
      }),
    );
    expect(started.status).toBe("failed");
  });

  it("ログインできていなければ、見本の身元で通ることはない", async () => {
    // `currentActor()` を使っていると、ここは**見本の身元へ落ちて**
    // 権限の話にすり替わる。見本へ役を 1 つ足した日に黙って通るようになるので、
    // 「役が足りない」ではなく「ログインしていない」で止まることを見る。
    signedIn = null;
    const started = await startLoopRunAction(
      IDLE,
      form({
        siteSlug: SITE,
        baselineSpecId: "spec_baseline",
        candidateSpecId: "spec_compare_first",
        primaryMetric: "read_completion_rate",
      }),
    );

    expect(started.status).toBe("failed");
    expect(started.message).toContain("ログイン");
  });

  it("AI は、役割を持っていても試作を承認できない", async () => {
    // 見た目だけの変更も人が承認する（仕様 §14.5）。
    signedIn = { ...SAMPLE_ACTOR, roles: ["owner"], isAiServiceAccount: true };
    const approved = await approveVariantSpecAction(
      IDLE,
      form({ siteSlug: SITE, specId: "spec_warm_theme" }),
    );

    expect(approved.status).toBe("failed");
  });

  it("AI は、比較を始めることもできない（読者に見えるものが変わるため）", async () => {
    signedIn = { ...SAMPLE_ACTOR, roles: ["owner"], isAiServiceAccount: true };
    const started = await startLoopRunAction(
      IDLE,
      form({
        siteSlug: SITE,
        baselineSpecId: "spec_baseline",
        candidateSpecId: "spec_compare_first",
        primaryMetric: "read_completion_rate",
      }),
    );

    expect(started.status).toBe("failed");
  });
});
