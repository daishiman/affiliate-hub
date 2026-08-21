/** @tier 1 */
import { describe, expect, it } from "vitest";
import { createLlmProviderCatalog } from "@/infrastructure/llm/llm-provider-catalog";

/**
 * 提供元とモデルの目録。
 *
 * 見ているのは「設定を書き間違えたときに、間違えたと分かるか」。
 * 空を返して済ませると、**設定していない状態と見分けが付かなくなる**。
 *
 * @req REQ-SEC01
 * @types equivalence, contract
 */

const MODEL = {
  modelId: "m-1",
  label: "既定のモデル",
  inputPricePerMillionMinor: 450,
  outputPricePerMillionMinor: 2_250,
  currency: "JPY",
  sourceUrl: "https://platform.claude.com/docs/en/about-claude/pricing",
  pricedOn: "2026-08-18",
};

describe("生成 AI の目録", () => {
  it("鍵を登録して使う 4 社が並ぶ", async () => {
    const listed = await createLlmProviderCatalog("{}").listProviders();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const required = listed.value.filter((p) => p.required).map((p) => p.providerId);
    expect(required.sort()).toEqual(["anthropic", "google", "openai", "xai"]);
  });

  it("鍵の要らない提供元は残すが、必須にしない", async () => {
    const listed = await createLlmProviderCatalog("{}").listProviders();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const cf = listed.value.find((p) => p.providerId === "workers_ai");
    expect(cf?.required).toBe(false);
    // 鍵を発行しに行く先が無いことも、画面が判断できるようにする。
    expect(cf?.keyIssueUrl).toBe("");
  });

  it("鍵を発行する場所が全部そろっている（必須の 4 社）", async () => {
    const listed = await createLlmProviderCatalog("{}").listProviders();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    for (const provider of listed.value.filter((p) => p.required)) {
      expect(provider.keyIssueUrl, `${provider.providerId} の発行先が無い`).toMatch(/^https:\/\//);
    }
  });

  it("設定にあるモデルを返す", async () => {
    const catalog = createLlmProviderCatalog(JSON.stringify({ anthropic: [MODEL] }));
    const models = await catalog.listModels("anthropic");
    expect(models.ok).toBe(true);
    if (!models.ok) return;
    expect(models.value[0]?.modelId).toBe("m-1");
    expect(models.value[0]?.inputPricePerMillionMinor).toBe(450);
  });

  it("設定に無い提供元は 0 件（間違いではないので断らない）", async () => {
    const catalog = createLlmProviderCatalog(JSON.stringify({ anthropic: [MODEL] }));
    const models = await catalog.listModels("xai");
    expect(models.ok).toBe(true);
    if (!models.ok) return;
    expect(models.value).toHaveLength(0);
  });

  it("設定が空なら 0 件", async () => {
    const models = await createLlmProviderCatalog("  ").listModels("anthropic");
    expect(models.ok).toBe(true);
    if (!models.ok) return;
    expect(models.value).toHaveLength(0);
  });

  it("JSON として読めない設定は、0 件ではなく間違いとして返す", async () => {
    const models = await createLlmProviderCatalog("{ではない").listModels("anthropic");
    expect(models.ok).toBe(false);
    if (models.ok) return;
    expect(models.error.code).toBe("VALIDATION_FAILED");
    expect(models.error.suggestedAction).toBeTruthy();
  });

  it("配列でない・入れ物でない設定も間違いとして返す", async () => {
    expect((await createLlmProviderCatalog("[]").listModels("anthropic")).ok).toBe(false);
    expect(
      (await createLlmProviderCatalog(JSON.stringify({ anthropic: {} })).listModels("anthropic")).ok,
    ).toBe(false);
  });

  it("単価の欄が欠けたモデルがあれば、その提供元ごと間違いとして返す", async () => {
    // **1 件だけ落として通さない。** 通すと欠けたモデルが 0 円で見積もられる。
    const broken = JSON.stringify({
      anthropic: [MODEL, { ...MODEL, modelId: "m-2", inputPricePerMillionMinor: undefined }],
    });
    expect((await createLlmProviderCatalog(broken).listModels("anthropic")).ok).toBe(false);
  });

  it("名前や通貨が空のモデルも間違いとして返す", async () => {
    for (const patch of [
      { modelId: "" },
      { label: "" },
      { currency: "" },
      { outputPricePerMillionMinor: "高い" },
      // 出どころと確認日も必須にした（2026-08-18）。
      // 任意にすると、埋めた行と埋めていない行が混ざり、
      // 古さの検査が「日付のある行だけ」を見ることになって抜けられる。
      { sourceUrl: undefined },
      { sourceUrl: "http://example.com/pricing" },
      { pricedOn: undefined },
      { pricedOn: "2026/08/18" },
    ]) {
      const raw = JSON.stringify({ anthropic: [{ ...MODEL, ...patch }] });
      expect(
        (await createLlmProviderCatalog(raw).listModels("anthropic")).ok,
        `${JSON.stringify(patch)} が通ってしまいました`,
      ).toBe(false);
    }
    expect((await createLlmProviderCatalog(JSON.stringify({ anthropic: [1] })).listModels("anthropic")).ok).toBe(
      false,
    );
  });
});
