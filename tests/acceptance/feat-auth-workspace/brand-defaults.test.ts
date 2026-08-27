/**
 * @tier 1
 * @req REQ-P01, REQ-E04, REQ-G02
 * @types equivalence, boundary
 */
import { describe, expect, it } from "vitest";
import {
  brandGenerationDefaults,
  createBrand,
  withBrandDefaults,
  DEFAULT_CTA,
} from "@/domain/identity";
import { missingInputFields } from "@/domain/generation/generation-input";
import type { Brand } from "@/domain/identity";
import type { WorkspaceId, BrandId } from "@/domain/shared/ids";
import type { GenerationInput } from "@/domain/generation/generation-input";
import { createDraftContentVariantUseCase } from "@/application/usecases/generation/draft-content-variant";
import type { BrandRepositoryPort } from "@/application/ports/identity";
import type { LlmCostEstimatorPort, LlmPort, LlmRequest } from "@/application/ports";
import { ok } from "@/domain/shared";
import { sampleGenerationInput } from "@/infrastructure/persistence/sample/generation-sample-input";
import { WORKSPACE, anOwner } from "../../support/actors";

/**
 * AWS-ACC-03「ブランド設定の標準 CTA と標準免責が記事生成の既定値として渡る」。
 *
 * ここで見るのは**繋がっているかどうか**だけである。
 * ブランドにも生成入力にも、前から CTA と免責の欄はあった。
 * 無かったのは**その間を通す道**で、道が無いあいだ生成側は
 * 見本データに書いた固定文言を使っていた（`generation-sample-input.ts`）。
 *
 * だから「既定値が入る」を確かめるだけでは足りない。
 * **ブランドを変えたら値も変わること**を同時に見る。変わらないなら、
 * それは固定文言がたまたま一致しているだけで、道は通っていない。
 */

function brandWith(over: Partial<Brand>): Brand {
  const built = createBrand({
    id: "br_test" as BrandId,
    workspaceId: "ws-test-main" as WorkspaceId,
    displayName: "検査用ブランド",
    positioning: "検査のためだけに存在する。",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
  if (!built.ok) throw new Error("前提のブランドが作れていない");
  return { ...built.value, ...over };
}

describe("ブランドの標準値を生成の既定値に写す", () => {
  it("標準 CTA がそのまま呼びかけ文になる", () => {
    const d = brandGenerationDefaults(brandWith({ defaultCta: "在庫を見る" }));
    expect(d.cta?.phrase).toBe("在庫を見る");
  });

  it("標準免責がそのまま広告表記になる", () => {
    const d = brandGenerationDefaults(brandWith({ disclaimer: "広告を含みます。" }));
    expect(d.disclosure).toBe("広告を含みます。");
  });

  it("ブランドを切り替えると渡る値も切り替わる", () => {
    const a = brandGenerationDefaults(brandWith({ defaultCta: "価格を見る" }));
    const b = brandGenerationDefaults(brandWith({ defaultCta: "在庫を見る" }));
    expect(a.cta?.phrase).not.toBe(b.cta?.phrase);
  });

  /**
   * ここが**穴を塞ぐ側**の検査。
   *
   * 免責が未設定のブランクに既定文を埋めてしまうと、
   * 「書いていないのに広告表記が付いた記事」が公開まで通ってしまう。
   * 埋めずに `null` のまま返し、生成の手前で止まらせる。
   */
  it("免責が未設定なら埋めない（空のまま生成へ進めない）", () => {
    const d = brandGenerationDefaults(brandWith({ disclaimer: null }));
    expect(d.disclosure).toBeNull();

    const missing = missingInputFields(withBrandDefaults(brandWith({ disclaimer: null }), {}));
    expect(missing.map((m) => m.key)).toContain("disclosure");
  });
});

describe("呼び出し側が明示しなくても入る／明示したら勝つ", () => {
  it("何も渡さなくても呼びかけと広告表記が埋まる", () => {
    const merged = withBrandDefaults(brandWith({ disclaimer: "広告を含みます。" }), {});
    expect(merged.cta?.phrase).toBe(DEFAULT_CTA);
    expect(merged.disclosure).toBe("広告を含みます。");
  });

  it("明示した値はブランドの標準値より優先される", () => {
    const merged = withBrandDefaults(brandWith({ defaultCta: "在庫を見る" }), {
      cta: { kind: "compare", phrase: "条件を絞って比べる" },
    });
    expect(merged.cta?.phrase).toBe("条件を絞って比べる");
  });

  /**
   * ブランドが取れないとき（保存先へ届かない等）に、
   * 既定値を**でっち上げない**。渡されたものをそのまま返し、
   * 足りなければ生成の手前で止まる。
   */
  it("ブランドが無いときは何も足さない", () => {
    const merged = withBrandDefaults(null, { cta: null });
    expect(merged.cta).toBeNull();
    expect(missingInputFields(merged).map((m) => m.key)).toContain("disclosure");
  });
});

// --- 配線されているか（口があるだけで誰も呼んでいない、を防ぐ） -------------

/**
 * ここから下が**このタスクの本題**である。
 *
 * 上の検査は「関数が正しく計算する」までしか言っていない。
 * 関数を足しただけで誰も呼ばなければ、AWS-ACC-03 は 1 ミリも満たされない。
 * それは `port-wiring` の門が探している「口はあるが誰も呼んでいない」形そのもの。
 *
 * だから**生成ユースケースを本物の入口から呼び**、ブランドを渡したときと
 * 渡さなかったときで結果が変わることを見る。
 */

const 生成用の偽LLM: LlmPort = {
  async generateStructured<T>(request: LlmRequest) {
    渡された指示.push(request);
    return ok({
      output: 生成物() as T,
      modelId: "test-model",
      inputTokens: 10,
      outputTokens: 20,
      truncated: false,
    });
  },
  async embed() {
    return ok([]);
  },
};
const 渡された指示: LlmRequest[] = [];
const 見積り: LlmCostEstimatorPort = {
  async estimate() {
    return ok({ estimatedCostMinor: 1, currency: "JPY" });
  },
};

function 生成物(): Record<string, unknown> {
  return {
    title: "見出し",
    body: "本文",
    summary: "要約",
    claims_used: [],
    persona_fit_score: 0.9,
    channel_fit_score: 0.9,
    compliance_status: "pass",
  };
}

/** 1 つのブランドだけを知っている保存先の代役。 */
function ブランド保存先(brand: Brand): BrandRepositoryPort {
  return {
    async findById(workspaceId, id) {
      if (workspaceId !== brand.workspaceId || id !== brand.id) return ok(null);
      return ok(brand);
    },
    async list() {
      return ok({ items: [brand], nextCursor: null });
    },
    async save(b) {
      return ok(b);
    },
  } as BrandRepositoryPort;
}

describe("生成ユースケースまで届いているか", () => {
  const MODEL = { providerId: "anthropic", modelId: "test-model" };
  const 免責なしの入力 = (() => {
    const { disclosure: _落とす, cta: _も落とす, ...残り } = sampleGenerationInput();
    return 残り as Partial<GenerationInput>;
  })();

  it("ブランドを渡さなければ、免責が無いまま止まる", async () => {
    const r = await createDraftContentVariantUseCase({
      llm: 生成用の偽LLM,
      costs: 見積り,
    }).execute(anOwner(), { model: MODEL, provided: 免責なしの入力 });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.details?.missing).toContain("disclosure");
  });

  /**
   * 「入力の門を通ったか」ではなく、**設定した文字列が指示文に載ったか**を見る。
   *
   * 門を通っただけなら、空文字で埋めても通ってしまう。
   * 利用者が設定画面に書いた文字が、そのまま生成 AI へ届いていることを見る。
   * （この先で偽 LLM の出力が形不足で落ちるが、それは生成物の検査の話で、
   *   ここで見たい「設定が届いたか」はもう決着している。）
   */
  it("ブランドを渡すと、設定した免責と呼びかけがそのまま指示文へ載る", async () => {
    渡された指示.length = 0;
    const brand = brandWith({
      workspaceId: WORKSPACE,
      disclaimer: "この記事には広告が含まれます。",
      defaultCta: "在庫を見る",
    });
    await createDraftContentVariantUseCase({
      llm: 生成用の偽LLM,
      costs: 見積り,
      brands: ブランド保存先(brand),
    }).execute(anOwner(), { model: MODEL, provided: 免責なしの入力, brandId: brand.id });

    expect(渡された指示.length).toBe(1);
    const 指示文 = JSON.stringify(渡された指示[0]);
    expect(指示文).toContain("この記事には広告が含まれます。");
    expect(指示文).toContain("在庫を見る");
  });

  /**
   * **ブランドが読めなかったときに、黙って既定値をでっち上げない。**
   *
   * 見つからないブランドを指したのに生成が進むなら、
   * それは設定していない値がどこかから湧いている。
   */
  it("指したブランドが無ければ、埋まらないまま止まる", async () => {
    const brand = brandWith({ workspaceId: WORKSPACE, disclaimer: "広告を含みます。" });
    const r = await createDraftContentVariantUseCase({
      llm: 生成用の偽LLM,
      costs: 見積り,
      brands: ブランド保存先(brand),
    }).execute(anOwner(), {
      model: MODEL,
      provided: 免責なしの入力,
      brandId: "br_no_such" as BrandId,
    });

    expect(r.ok).toBe(false);
  });
});
