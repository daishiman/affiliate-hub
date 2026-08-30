/** @tier 1 @req REQ-IM06, REQ-IM09 @types permission-matrix, state-transition, equivalence */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

/**
 * 改善ループ（試作 → 承認 → 開始 → 観測 → 判定）の入口。
 *
 * 観測・判定・打ち切りは 1 つの入口にまとめてある。ボタンごとに分けると
 * 権限の確認を書き忘れる箇所が 3 倍になるため。
 * 逆に、まとめた入口は **知らない intent が黙って通る**危険を持つので、
 * 落ちどころ（3 つを名指しする断り）をここで固定する。
 */

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

let signedIn: ActorContext | null = { ...SAMPLE_ACTOR, roles: ["owner"] };
const draftSpec = vi.fn();
const approveSpec = vi.fn();
const start = vi.fn();
const observe = vi.fn();
const conclude = vi.fn();
const stop = vi.fn();

vi.mock("@/presentation/composition", () => ({
  signedInActor: async () => signedIn,
  improvementUseCases: async () => ({
    draftSpec: { execute: draftSpec },
    approveSpec: { execute: approveSpec },
    start: { execute: start },
    observe: { execute: observe },
    conclude: { execute: conclude },
    stop: { execute: stop },
  }),
}));

const {
  draftVariantSpecAction,
  approveVariantSpecAction,
  startLoopRunAction,
  advanceLoopRunAction,
} = await import("@/presentation/admin/observe/improvement-action");

const IDLE = { status: "idle", message: "" } as const;
const PATH = "/admin/improvement";

function form(pairs: readonly (readonly [string, string])[]): FormData {
  const data = new FormData();
  for (const [key, value] of pairs) data.append(key, value);
  return data;
}

beforeEach(() => {
  signedIn = { ...SAMPLE_ACTOR, roles: ["owner"] };
  for (const spy of [draftSpec, approveSpec, start, observe, conclude, stop]) spy.mockReset();
  revalidatePath.mockReset();
});

describe("未ログインなら、どの段も始まらない", () => {
  it.each([
    ["試作を登録する", draftVariantSpecAction, draftSpec],
    ["承認する", approveVariantSpecAction, approveSpec],
    ["始める", startLoopRunAction, start],
    ["進める", advanceLoopRunAction, observe],
  ] as const)("%s", async (_label, action, spy) => {
    signedIn = null;
    const state = await action(IDLE, form([["intent", "observe"]]));

    // 操作名は出さない。何が在るかを未ログインの人へ教えない。
    expect(state).toEqual({
      status: "failed",
      message: "ログインし直してください。この操作には、誰が行ったかの記録が要ります。",
    });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("draftVariantSpecAction", () => {
  it("軸は画面が並べた順のまま、鍵と値を対にして渡す", async () => {
    draftSpec.mockResolvedValue(ok({ message: "試作を登録しました。" }));
    await draftVariantSpecAction(
      IDLE,
      form([
        ["siteSlug", "blog"],
        ["label", "見出しを短く"],
        ["dimensionKey", "headline"],
        ["dimensionKey", "cta"],
        ["dimensionValue", "短い"],
        ["dimensionValue", "詳しく見る"],
      ]),
    );

    expect(draftSpec.mock.calls[0][1].settings).toEqual([
      { dimensionKey: "headline", value: "短い" },
      { dimensionKey: "cta", value: "詳しく見る" },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("値の数が足りない軸は、空文字として渡す", async () => {
    draftSpec.mockResolvedValue(ok({ message: "登録しました。" }));
    await draftVariantSpecAction(
      IDLE,
      form([["dimensionKey", "headline"], ["dimensionKey", "cta"], ["dimensionValue", "短い"]]),
    );

    expect(draftSpec.mock.calls[0][1].settings[1]).toEqual({ dimensionKey: "cta", value: "" });
  });

  it("断られたら、原因の欄まで返し、描き直さない", async () => {
    draftSpec.mockResolvedValue(
      err(domainError("CONFLICT", "同じ名前の試作があります。", { field: "label" })),
    );
    const state = await draftVariantSpecAction(IDLE, form([["label", "見出しを短く"]]));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("label");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("approveVariantSpecAction", () => {
  it("承認できたら、ユースケースの文をそのまま出す", async () => {
    approveSpec.mockResolvedValue(ok({ message: "承認しました。始められます。" }));
    const state = await approveVariantSpecAction(
      IDLE,
      form([["siteSlug", "blog"], ["specId", "s-1"]]),
    );

    expect(approveSpec.mock.calls[0][1]).toEqual({ siteSlug: "blog", specId: "s-1" });
    expect(state).toEqual({ status: "done", message: "承認しました。始められます。" });
  });
});

describe("startLoopRunAction", () => {
  it("最小件数が空欄なら、0 ではなく「既定のまま」で渡す", async () => {
    start.mockResolvedValue(ok({ message: "始めました。" }));
    await startLoopRunAction(IDLE, form([["siteSlug", "blog"], ["minimumSamples", "  "]]));

    // 0 に読み替えると、1 件も集まっていないのに判定できることになる。
    expect(start.mock.calls[0][1].minimumSamples).toBeUndefined();
  });

  it("最小件数が入っていれば、数として渡す", async () => {
    start.mockResolvedValue(ok({ message: "始めました。" }));
    await startLoopRunAction(
      IDLE,
      form([
        ["siteSlug", "blog"],
        ["baselineSpecId", "s-1"],
        ["candidateSpecId", "s-2"],
        ["primaryMetric", "click_rate"],
        ["minimumSamples", "300"],
      ]),
    );

    expect(start.mock.calls[0][1]).toEqual({
      siteSlug: "blog",
      baselineSpecId: "s-1",
      candidateSpecId: "s-2",
      primaryMetric: "click_rate",
      minimumSamples: 300,
    });
  });
});

describe("advanceLoopRunAction", () => {
  it("observe は 4 つの観測値を数として渡す", async () => {
    observe.mockResolvedValue(ok({ message: "観測を書きました。" }));
    await advanceLoopRunAction(
      IDLE,
      form([
        ["runId", "r-1"],
        ["intent", "observe"],
        ["baselineValue", "0.12"],
        ["baselineSamples", "400"],
        ["candidateValue", "0.15"],
        ["candidateSamples", "410"],
      ]),
    );

    expect(observe.mock.calls[0][1]).toEqual({
      runId: "r-1",
      baselineValue: 0.12,
      baselineSamples: 400,
      candidateValue: 0.15,
      candidateSamples: 410,
    });
  });

  it("観測値が空欄なら NaN のまま渡し、断る仕事はユースケースへ残す", async () => {
    observe.mockResolvedValue(err(domainError("CONFLICT", "観測値が読めません。")));
    const state = await advanceLoopRunAction(IDLE, form([["runId", "r-1"], ["intent", "observe"]]));

    expect(observe.mock.calls[0][1].baselineValue).toBeNaN();
    expect(state.status).toBe("failed");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("conclude は run の番号だけを渡す", async () => {
    conclude.mockResolvedValue(ok({ message: "候補の勝ちです。" }));
    const state = await advanceLoopRunAction(IDLE, form([["runId", "r-1"], ["intent", "conclude"]]));

    expect(conclude.mock.calls[0][1]).toEqual({ runId: "r-1" });
    expect(state).toEqual({ status: "done", message: "候補の勝ちです。" });
    expect(revalidatePath).toHaveBeenCalledWith(PATH);
  });

  it("stop は理由も一緒に渡す", async () => {
    stop.mockResolvedValue(ok({ message: "打ち切りました。" }));
    await advanceLoopRunAction(
      IDLE,
      form([["runId", "r-1"], ["intent", "stop"], ["reason", "季節要因"]]),
    );

    expect(stop.mock.calls[0][1]).toEqual({ runId: "r-1", reason: "季節要因" });
  });

  it("知らない intent は、できること 3 つを名指しして断る", async () => {
    const state = await advanceLoopRunAction(IDLE, form([["runId", "r-1"], ["intent", "delete"]]));

    expect(state).toEqual({
      status: "failed",
      message: "できることは、観測値を書く・判定する・打ち切る、の 3 つです。",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("intent が無いときも、黙って何かを起こさない", async () => {
    const state = await advanceLoopRunAction(IDLE, form([["runId", "r-1"]]));

    expect(state.status).toBe("failed");
    for (const spy of [observe, conclude, stop]) expect(spy).not.toHaveBeenCalled();
  });
});
