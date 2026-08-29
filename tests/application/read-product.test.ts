/**
 * @tier 1
 * @req REQ-A02, REQ-A08
 * @types equivalence, boundary, permission-matrix, tenant-isolation
 *
 * 受け入れ条件 §30.2（比較）と §30.8（追跡可能性）の中身は、ここで確かめている。
 *
 *   §30.2 → 「比較」「代わりになるもの」「報酬との分離」の 3 節
 *   §30.8 → 「根拠」の節（事実と推測を読者へ出す言葉で区別する）
 *
 * `tests/acceptance/acceptance-criteria.test.ts` は同じことを入口から 1 本通すが、
 * **1 つだけでは比較にならない**・**1 つでも引けなければ途中まで並べた表を出さない**
 * といった分かれ目は通らない。受け入れ条件が守られているかは、その分かれ目で決まる。
 */
import { describe, expect, it } from "vitest";
import {
  type ReadProductDeps,
  createCompareProductsUseCase,
  createExplainRankingUseCase,
  createFilterProductsUseCase,
  createFindAlternativesUseCase,
  createGetEvidenceUseCase,
  createGetProductUseCase,
  createListRankingUseCase,
  createListTestRunsUseCase,
} from "@/application/usecases/product/read-product";
import type { EditorialScoreCard } from "@/domain/ranking";
import { markEditorial, ok, taggedString } from "@/domain/shared";
import type { ProductId, WorkspaceId } from "@/domain/shared";
import { SAMPLE_MODEL_ID, SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { aNobody, anOwner } from "../support/actors";
import { failing, testDeps } from "../support/doubles";

/**
 * 読者へ商品と根拠を見せる読み取り。
 *
 * --- ここで守りたいこと ---
 * 1. **報酬が並び順の入力に混ざらない。** 型で塞いであるが、型を外して渡された場合に
 *    組み立てで落ちることまで確かめる。落ちなければ「報酬の高い順」が事故として成立する。
 * 2. **空欄を空文字で埋めない。** 比較表で欠けた欄を空白にすると、
 *    読者は「その機能が無い」と読む。無いのと分からないのは違う。
 * 3. **事実と推測を必ず区別する。** 同じ見た目で出すと、推測が事実として広まる。
 * 4. **実測していないものを「使ってみた」と書かせない。** 記録が無いことを、
 *    0 件ではなく理由として返す。
 *
 * 規範: 仕様 ブログ層 §14.2 / §20.3
 */

/** 見本の商品と評価基準は、この作業場所にだけ置いてある。 */
const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const owner = anOwner({ workspaceId: WS });
const nobody = aNobody({ workspaceId: WS });
const MODEL = String(SAMPLE_MODEL_ID);

function deps(over: Partial<ReadProductDeps> = {}): ReadProductDeps {
  const base = testDeps();
  return {
    products: base.products,
    claims: base.claims,
    evidence: base.evidence,
    testRuns: base.testRuns,
    rankingModels: base.rankingModels,
    scoreCards: base.scoreCards,
    ...over,
  };
}

/** 全項目に同じ点を置いた評価。合格ラインの上と下を作り分けるために使う。 */
function scoreCard(productId: string, score: number): EditorialScoreCard {
  const keys = [
    "measured_performance",
    "usability",
    "durability",
    "support",
    "price_value",
    "repairability",
  ];
  return {
    productId: productId as ProductId,
    scores: Object.fromEntries(keys.map((k) => [k, score])),
    evidenceRefs: ["ev_lumbar_pressure"],
    testedAt: new Date("2026-08-01T00:00:00Z"),
  };
}

describe("報酬との分離", () => {
  it("商業データのポートが混ざっていたら、組み立ての時点で落ちる", () => {
    const tainted = { ...deps(), conversions: testDeps().conversions } as ReadProductDeps;

    // 動かしてから気づくのでは、その 1 回はもう読者に出ている。
    expect(() => createListRankingUseCase(tainted)).toThrow(/並び順の入力/);
    expect(() => createGetProductUseCase(tainted)).toThrow(/商業データのポート/);
  });
});

describe("商品 1 件", () => {
  it("仕様を項目の並びにして、いつ取った情報かを添える", async () => {
    const got = await createGetProductUseCase(deps()).execute(owner, { productId: "p_alpha_15" });
    if (!got.ok) throw new Error(got.error.message);

    expect(got.value.specifications.map((s) => s.key)).toContain("座面の高さ");
    // 情報の古さを読者が自分で判断できるようにする。
    expect(got.value.retrievedAt).toBeInstanceOf(Date);
    expect(got.value.claims.length).toBeGreaterThan(0);
  });

  it("居ない商品は、選び直しを促して断る", async () => {
    const got = await createGetProductUseCase(deps()).execute(owner, { productId: "p_missing" });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
    expect(got.error.suggestedAction).toContain("一覧");
  });

  it("別の作業場所の商品は見えない", async () => {
    const outsider = anOwner({ workspaceId: "ws-test-other" as WorkspaceId });

    const got = await createGetProductUseCase(deps()).execute(outsider, { productId: "p_alpha_15" });
    expect(got.ok).toBe(false);
  });

  it("主張が取れなかったときは、0 件として見せない", async () => {
    const broken = deps({ claims: { ...testDeps().claims, listByProduct: async () => failing() } });

    expect(
      (await createGetProductUseCase(broken).execute(owner, { productId: "p_alpha_15" })).ok,
    ).toBe(false);
  });

  it("商品を読む権限が無ければ、何も返さない", async () => {
    const got = await createGetProductUseCase(deps()).execute(nobody, { productId: "p_alpha_15" });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });
});

describe("絞り込み", () => {
  it("言葉で絞れる", async () => {
    const found = await createFilterProductsUseCase(deps()).execute(owner, { text: "小柄" });
    if (!found.ok) throw new Error(found.error.message);

    expect(found.value.items.length).toBeGreaterThan(0);
    expect(found.value.emptyReason).toBeNull();
  });

  it("0 件のときは、次にできることを添える", async () => {
    const found = await createFilterProductsUseCase(deps()).execute(owner, {
      text: "存在しない語句ZZZ",
    });
    if (!found.ok) throw new Error(found.error.message);

    expect(found.value.items).toHaveLength(0);
    // 無言の空表を作らない。読者は自分の操作が悪いのか分からない。
    expect(found.value.emptyReason).toContain("条件");
  });

  it("一度に取り過ぎない上限がある", async () => {
    let asked = 0;
    const counting = deps({
      products: {
        ...testDeps().products,
        search: async (_ws: unknown, _q: unknown, page: { limit: number }) => {
          asked = page.limit;
          return { ok: true as const, value: { items: [], nextCursor: null } };
        },
      } as ReadProductDeps["products"],
    });

    await createFilterProductsUseCase(counting).execute(owner, { limit: 5000 });
    // 上限が無いと、1 回の呼び出しで保存先を引きずり出せてしまう。
    expect(asked).toBe(50);
  });

  it("既定の件数でも取り過ぎない", async () => {
    let asked = 0;
    const counting = deps({
      products: {
        ...testDeps().products,
        search: async (_ws: unknown, _q: unknown, page: { limit: number }) => {
          asked = page.limit;
          return { ok: true as const, value: { items: [], nextCursor: null } };
        },
      } as ReadProductDeps["products"],
    });

    await createFilterProductsUseCase(counting).execute(owner, {});
    expect(asked).toBe(20);
  });

  it("取れなかったときは、0 件として見せない", async () => {
    const broken = deps({ products: { ...testDeps().products, search: async () => failing() } });

    expect((await createFilterProductsUseCase(broken).execute(owner, {})).ok).toBe(false);
  });
});

describe("比較", () => {
  it("全商品で揃っている項目だけを列にする", async () => {
    const compared = await createCompareProductsUseCase(deps()).execute(owner, {
      productIds: ["p_alpha_15", "p_gamma_16"],
    });
    if (!compared.ok) throw new Error(compared.error.message);

    expect(compared.value.columns).toContain("座面の高さ");
    // 片方にしか無い項目を列にすると、空欄が「その機能が無い」に見える。
    expect(compared.value.columns).not.toContain("張地");
    expect(compared.value.missingColumns).toContain("張地");
  });

  it("揃わなかった項目を、読者から隠さない", async () => {
    const compared = await createCompareProductsUseCase(deps()).execute(owner, {
      productIds: ["p_alpha_15", "p_gamma_16"],
    });
    if (!compared.ok) throw new Error(compared.error.message);

    // 黙って落とすと、比べたつもりで比べていない状態になる。
    expect(compared.value.missingColumns.length).toBeGreaterThan(0);
  });

  it("表の中身は、列の並びと商品の並びに正しく対応する", async () => {
    const compared = await createCompareProductsUseCase(deps()).execute(owner, {
      productIds: ["p_alpha_15", "p_beta_14"],
    });
    if (!compared.ok) throw new Error(compared.error.message);

    const heightAt = compared.value.columns.indexOf("座面の高さ");
    expect(compared.value.rows).toHaveLength(2);
    expect(compared.value.rows[0][heightAt]).toBe("42〜54cm");
    expect(compared.value.rows[1][heightAt]).toBe("39〜51cm");
  });

  it("1 つだけでは比較にならないので断る", async () => {
    const compared = await createCompareProductsUseCase(deps()).execute(owner, {
      productIds: ["p_alpha_15"],
    });

    expect(compared.ok).toBe(false);
    if (compared.ok) return;
    expect(compared.error.field).toBe("productIds");
  });

  it("1 つでも引けない商品があれば、途中まで並べた表を出さない", async () => {
    const compared = await createCompareProductsUseCase(deps()).execute(owner, {
      productIds: ["p_alpha_15", "p_missing"],
    });

    // 欠けたまま出すと、無い商品が「比較対象に無い」ではなく「劣る」に見える。
    expect(compared.ok).toBe(false);
  });
});

describe("代わりになるもの", () => {
  it("同じ用途の別の商品を返し、元の商品は入れない", async () => {
    const found = await createFindAlternativesUseCase(deps()).execute(owner, {
      productId: "p_alpha_15",
    });
    if (!found.ok) throw new Error(found.error.message);

    expect(found.value.basis.productId).toBe("p_alpha_15");
    expect(found.value.alternatives.map((a) => a.productId)).not.toContain("p_alpha_15");
    expect(found.value.alternatives.length).toBeGreaterThan(0);
    expect(found.value.emptyReason).toBeNull();
  });

  it("件数の指定を守る", async () => {
    const found = await createFindAlternativesUseCase(deps()).execute(owner, {
      productId: "p_alpha_15",
      limit: 1,
    });
    if (!found.ok) throw new Error(found.error.message);

    expect(found.value.alternatives).toHaveLength(1);
  });

  it("候補が無いときは、登録が進めば出ることを伝える", async () => {
    const alone = deps({
      products: {
        ...testDeps().products,
        search: async () => ({ ok: true as const, value: { items: [], nextCursor: null } }),
      } as ReadProductDeps["products"],
    });

    const found = await createFindAlternativesUseCase(alone).execute(owner, {
      productId: "p_alpha_15",
    });
    if (!found.ok) throw new Error(found.error.message);

    expect(found.value.alternatives).toHaveLength(0);
    expect(found.value.emptyReason).toContain("登録");
  });

  it("探せなかったときは、候補なしと言わない", async () => {
    const broken = deps({
      products: {
        ...testDeps().products,
        search: async () => failing(),
      } as ReadProductDeps["products"],
    });

    expect(
      (await createFindAlternativesUseCase(broken).execute(owner, { productId: "p_alpha_15" })).ok,
    ).toBe(false);
  });
});

describe("根拠", () => {
  it("事実と推測を、読者へ出す言葉で区別する", async () => {
    const got = await createGetEvidenceUseCase(deps()).execute(owner, { productId: "p_alpha_15" });
    if (!got.ok) throw new Error(got.error.message);

    const kinds = got.value.items.map((i) => i.factOrInference);
    // 同じ見た目で出すと、推測が事実として広まる。
    expect(kinds).toContain("事実");
    expect(kinds).toContain("推測");
  });

  it("実測の主張には、元になった資料が付く", async () => {
    const got = await createGetEvidenceUseCase(deps()).execute(owner, { productId: "p_alpha_15" });
    if (!got.ok) throw new Error(got.error.message);

    const measured = got.value.items.find((i) => i.factOrInference === "事実");
    expect(measured?.evidence.length).toBeGreaterThan(0);
    expect(measured?.expiredNote).toBeNull();
  });

  it("記録がまだ無い商品は、その理由を書く", async () => {
    const empty = deps({
      claims: { ...testDeps().claims, listByProduct: async () => ({ ok: true as const, value: [] }) },
    });

    const got = await createGetEvidenceUseCase(empty).execute(owner, { productId: "p_alpha_15" });
    if (!got.ok) throw new Error(got.error.message);

    expect(got.value.emptyReason).toContain("根拠");
  });

  it("資料が引けなかったときは、根拠なしとして見せない", async () => {
    const broken = deps({ evidence: { ...testDeps().evidence, listByIds: async () => failing() } });

    expect(
      (await createGetEvidenceUseCase(broken).execute(owner, { productId: "p_alpha_15" })).ok,
    ).toBe(false);
  });
});

describe("検証記録", () => {
  it("実測していない商品は、そのことを理由として返す", async () => {
    const listed = await createListTestRunsUseCase(deps()).execute(owner, {
      productId: "p_alpha_15",
    });
    if (!listed.ok) throw new Error(listed.error.message);

    expect(listed.value.runs).toHaveLength(0);
    // 0 件で済ませると、実測していない商品に「使ってみた」と書いてしまう。
    expect(listed.value.emptyReason).toContain("使ってみた");
  });

  it("取れなかったときは、実測なしと言わない", async () => {
    const broken = deps({ testRuns: { ...testDeps().testRuns, listByProduct: async () => failing() } });

    expect(
      (await createListTestRunsUseCase(broken).execute(owner, { productId: "p_alpha_15" })).ok,
    ).toBe(false);
  });
});

describe("順位と、その理由", () => {
  const ranked = ["p_alpha_15", "p_beta_14", "p_gamma_16"];

  it("評価基準を添えて順位を返し、報酬が入力でないことを示す", async () => {
    const listed = await createListRankingUseCase(deps()).execute(owner, {
      modelId: MODEL,
      productIds: ranked,
    });
    if (!listed.ok) throw new Error(listed.error.message);

    expect(listed.value.criteria.length).toBeGreaterThan(0);
    for (const c of listed.value.criteria) expect(c.measurement.trim()).not.toBe("");
    // 読者に必ず出す一文の根拠。ここが true になったら順位の意味が変わる。
    expect(listed.value.compensationIsInput).toBe(false);
    expect(listed.value.modelVersion.trim()).not.toBe("");
  });

  it("商品が 1 つも指定されていなければ断る", async () => {
    const listed = await createListRankingUseCase(deps()).execute(owner, {
      modelId: MODEL,
      productIds: [],
    });

    expect(listed.ok).toBe(false);
    if (listed.ok) return;
    expect(listed.error.field).toBe("productIds");
  });

  it("居ない評価基準は、選び直しを促して断る", async () => {
    const listed = await createListRankingUseCase(deps()).execute(owner, {
      modelId: "rm_missing",
      productIds: ranked,
    });

    expect(listed.ok).toBe(false);
    if (listed.ok) return;
    expect(listed.error.code).toBe("NOT_FOUND");
    expect(listed.error.suggestedAction).toContain("評価基準");
  });

  it("評価の記録が無ければ、順位を作らない", async () => {
    const noCards = deps({
      scoreCards: { ...testDeps().scoreCards, listByModel: async () => ({ ok: true as const, value: [] }) },
    });

    const listed = await createListRankingUseCase(noCards).execute(owner, {
      modelId: MODEL,
      productIds: ranked,
    });

    expect(listed.ok).toBe(false);
    if (listed.ok) return;
    // 記録が無いまま並べると、根拠のない順位が読者へ出る。
    expect(listed.error.code).toBe("EVIDENCE_REQUIRED");
    expect(listed.error.suggestedAction).toContain("評価");
  });

  it("評価基準や評価が引けなかったときは、順位を作らない", async () => {
    const brokenModel = deps({
      rankingModels: { ...testDeps().rankingModels, findById: async () => failing() },
    });
    const brokenCards = deps({
      scoreCards: { ...testDeps().scoreCards, listByModel: async () => failing() },
    });

    for (const broken of [brokenModel, brokenCards]) {
      expect(
        (await createListRankingUseCase(broken).execute(owner, { modelId: MODEL, productIds: ranked })).ok,
      ).toBe(false);
    }
  });

  it("順位を読む権限が無ければ、順位も理由も返さない", async () => {
    const input = { modelId: MODEL, productIds: ranked };

    expect((await createListRankingUseCase(deps()).execute(nobody, input)).ok).toBe(false);
    expect(
      (await createExplainRankingUseCase(deps()).execute(nobody, { ...input, productId: "p_alpha_15" }))
        .ok,
    ).toBe(false);
  });

  it("ブランドとの対応を持たない順位と理由を限定担当者へは返さない", async () => {
    const input = { modelId: MODEL, productIds: ranked };
    const scoped = anOwner({
      workspaceId: WS,
      scopedBrandIds: [taggedString<"BrandId">("brand-limited")],
    });

    const listed = await createListRankingUseCase(deps()).execute(scoped, input);
    const explained = await createExplainRankingUseCase(deps()).execute(scoped, {
      ...input,
      productId: "p_alpha_15",
    });

    expect(listed.ok).toBe(false);
    if (!listed.ok) expect(listed.error.code).toBe("TENANT_MISMATCH");
    expect(explained.ok).toBe(false);
    if (!explained.ok) expect(explained.error.code).toBe("TENANT_MISMATCH");
  });
});

describe("順位の説明", () => {
  const input = { modelId: MODEL, productIds: ["p_alpha_15", "p_beta_14", "p_gamma_16"] };

  it("何がどれだけ効いたかを内訳で返す", async () => {
    const explained = await createExplainRankingUseCase(deps()).execute(owner, {
      ...input,
      productId: "p_alpha_15",
    });
    if (!explained.ok) throw new Error(explained.error.message);

    expect(explained.value.rank).toBeGreaterThan(0);
    expect(explained.value.contributions.length).toBeGreaterThan(0);
    for (const c of explained.value.contributions) {
      // 重みと点数の両方を出さないと、なぜその順位かを読者が検算できない。
      expect(c.measurement.trim()).not.toBe("");
      expect(c.contribution).toBeCloseTo(c.weight * c.score, 6);
    }
    expect(explained.value.excludedReason).toBeNull();
  });

  it("順位表に無い商品は、含まれていないと分かる形で断る", async () => {
    const explained = await createExplainRankingUseCase(deps()).execute(owner, {
      ...input,
      productId: "p_delta_13",
    });

    expect(explained.ok).toBe(false);
    if (explained.ok) return;
    expect(explained.error.code).toBe("NOT_FOUND");
    expect(explained.error.suggestedAction).toContain("順位表");
  });

  it("選外は「見つからない」ではなく、選外の理由として返す", async () => {
    /*
      見本の評価はどれも合格ラインを超えているため、選外が 1 件も出ない。
      そこで**評価だけ**を差し替え、合格ラインを下回る商品を 1 つ混ぜる。

      選外を「見つからない」と同じ扱いにすると、読者には
      **その商品が最初から存在しなかった**ように見える。
      落ちた理由を出せることが、順位の作り方を説明できることの前提になる。
    */
    const withLowScore = deps({
      scoreCards: markEditorial({
        ...testDeps().scoreCards,
        listByModel: async () =>
          ok([
            scoreCard("p_alpha_15", 0.8),
            // すべての項目で合格ラインを割る。
            scoreCard("p_beta_14", 0.0),
          ]),
      }) as ReadProductDeps["scoreCards"],
    });

    const explained = await createExplainRankingUseCase(withLowScore).execute(owner, {
      ...input,
      productId: "p_beta_14",
    });
    if (!explained.ok) throw new Error(explained.error.message);

    expect(explained.value.rank).toBe(0);
    expect(explained.value.excludedReason).toContain("合格ライン");
    expect(explained.value.contributions).toHaveLength(0);
  });
});
