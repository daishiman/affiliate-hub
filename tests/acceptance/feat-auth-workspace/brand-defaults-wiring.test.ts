/**
 * @tier 1
 * @req REQ-P01, REQ-E04, REQ-G02
 * @types equivalence, boundary
 *
 * P10 の FR-01 が実測した穴を塞ぐための検査。
 *
 * `brand-defaults.test.ts` は「ユースケースはブランドを受け取れる」ところまでしか
 * 言っていなかった。テスト自身が `brands:` を組み立てて渡していたからである。
 * 製品の組み立て場所（`src/presentation/composition.ts`）が渡していないことは、
 * あの形のテストでは**原理的に見えない**。
 *
 * ここで見るのは 2 つ。
 *
 *   1. `createDraftContentVariantUseCase` を呼ぶ **すべての** 場所が `brands` を渡しているか
 *      （＝「口はあるが誰も渡していない」形が残っていないか）
 *   2. `brandId` を明示しなくても、ブランドが 1 つだけの作業場所なら既定値が届くか
 *      （＝画面経路にはブランド選択欄が無い、という現実の下で AWS-ACC-03 が成立するか）
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDraftContentVariantUseCase } from "@/application/usecases/generation/draft-content-variant";
import { createBrand } from "@/domain/identity";
import type { Brand } from "@/domain/identity";
import type { BrandRepositoryPort } from "@/application/ports/identity";
import type { LlmCostEstimatorPort, LlmPort, LlmRequest } from "@/application/ports";
import { ok } from "@/domain/shared";
import { asBrandId } from "@/domain/shared";
import { sampleGenerationInput } from "@/infrastructure/persistence/sample/generation-sample-input";
import type { GenerationInput } from "@/domain/generation/generation-input";
import { WORKSPACE, anOwner } from "../../support/actors";

const SRC = join(process.cwd(), "src");

function 全ソース(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...全ソース(path));
    } else if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      out.push(path);
    }
  }
  return out;
}

/**
 * `createDraftContentVariantUseCase({ ... })` の引数の中身を、呼び出しごとに取り出す。
 *
 * 正規表現で括弧の対応を数えているのは、`{` の入れ子（`credentials: { ... }` など）を
 * 含む呼び出しで途中打ち切りにしないため。行数で切ると、引数が複数行の呼び出しを
 * 「`brands` が無い」と誤判定する。
 */
function 呼び出しの引数(source: string): string[] {
  const 印 = "createDraftContentVariantUseCase(";
  const 結果: string[] = [];
  let i = source.indexOf(印);
  while (i !== -1) {
    let 深さ = 0;
    let j = i + 印.length - 1;
    for (; j < source.length; j += 1) {
      if (source[j] === "(") 深さ += 1;
      else if (source[j] === ")") {
        深さ -= 1;
        if (深さ === 0) break;
      }
    }
    const 引数 = source.slice(i + 印.length, j);
    // 定義そのもの（`export function createDraftContentVariantUseCase(deps: ...)`）を
    // 呼び出しと数えない。呼び出しは必ずオブジェクトリテラルを渡す形になっている。
    if (引数.trimStart().startsWith("{")) 結果.push(引数);
    i = source.indexOf(印, j);
  }
  return 結果;
}

describe("生成ユースケースを組み立てる場所が、ブランドを渡しているか", () => {
  const 呼び出し場所 = 全ソース(SRC)
    .map((path) => ({ path, 引数: 呼び出しの引数(readFileSync(path, "utf8")) }))
    .filter((e) => e.引数.length > 0);

  it("組み立てている場所が、そもそも 2 つ以上ある（1 つに減っていたらこの検査は要らなくなる）", () => {
    const 総数 = 呼び出し場所.reduce((n, e) => n + e.引数.length, 0);
    // 1 箇所に集約されたなら「片方だけ渡し忘れる」事故は起きえない。
    // そのときはこの検査ごと消してよい、という合図をここに残す。
    expect(総数).toBeGreaterThanOrEqual(2);
  });

  it("どの場所も brands を渡している（片方だけ渡すと、画面と道具で結果が変わる）", () => {
    const 渡していない = 呼び出し場所.flatMap((e) =>
      e.引数.filter((a) => !/\bbrands\s*:/.test(a)).map(() => e.path.replace(process.cwd(), "")),
    );
    expect(渡していない).toEqual([]);
  });
});

const MODEL = { providerId: "openai", modelId: "gpt-x" } as const;

const 見積り: LlmCostEstimatorPort = {
  estimate: async () => ok({ estimatedCostMinor: 1, currency: "JPY", inputTokens: 1 }),
};

function brandWith(over: Partial<Brand>): Brand {
  const built = createBrand({
    id: asBrandId("br_test"),
    workspaceId: WORKSPACE,
    displayName: "検査用ブランド",
    positioning: "検査のためだけに存在する。",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
  if (!built.ok) throw new Error("前提のブランドが作れていない");
  return {
    ...built.value,
    disclaimer: "この記事には広告が含まれます。",
    defaultCta: "在庫を見る",
    ...over,
  };
}

/** `list` だけが本物の振る舞いを持つ保存先。`findById` は使われないことを示すために投げる。 */
function 一覧で答える保存先(items: readonly Brand[]): BrandRepositoryPort {
  return {
    findById: async () => {
      throw new Error("brandId を渡していないのに findById が呼ばれた");
    },
    list: async () => ok({ items, nextCursor: null }),
    save: async () => {
      throw new Error("生成が保存先へ書き込んでいる");
    },
  };
}

const 渡された指示: LlmRequest[] = [];
const 記録するLLM: LlmPort = {
  // 使わないが、口が欠けていると `next build` の型検査で落ちる（vitest は型を見ない）。
  // 呼ばれたら投げる。空配列を返すと、うっかり呼んだ経路が緑のまま通る。
  embed: async () => {
    throw new Error("下書きの生成が embed を呼んでいる");
  },
  generateStructured: async (req: LlmRequest) => {
    渡された指示.push(req);
    return ok({
      modelId: MODEL.modelId,
      output: {},
      inputTokens: 1,
      outputTokens: 1,
    }) as never;
  },
};

/** 見本の入力から、免責と呼びかけだけを落としたもの。他 16 項目はそろっている。 */
const 免責なしの入力 = (() => {
  const { disclosure: _落とす, cta: _も落とす, ...残り } = sampleGenerationInput();
  return 残り as Partial<GenerationInput>;
})();

async function 走らせる(brands: BrandRepositoryPort) {
  渡された指示.length = 0;
  return createDraftContentVariantUseCase({ llm: 記録するLLM, costs: 見積り, brands }).execute(
    anOwner(),
    { model: MODEL, provided: 免責なしの入力 },
  );
}

describe("brandId を明示しない画面経路で、既定値が届くか", () => {
  it("ブランドが 1 つだけなら、明示しなくてもその免責と呼びかけが指示文へ載る", async () => {
    await 走らせる(一覧で答える保存先([brandWith({})]));
    expect(渡された指示.length).toBe(1);
    const 指示文 = JSON.stringify(渡された指示[0]);
    expect(指示文).toContain("この記事には広告が含まれます。");
    expect(指示文).toContain("在庫を見る");
  });

  it("ブランドが 2 つあるときは、どちらも選ばない（違う免責が載るほうが害が大きい）", async () => {
    const r = await 走らせる(
      一覧で答える保存先([
        brandWith({ id: asBrandId("br_a"), disclaimer: "Aの免責" }),
        brandWith({ id: asBrandId("br_b"), disclaimer: "Bの免責" }),
      ]),
    );
    // 既定値が入らないので、①「そろっていなければ始めない」で止まる。
    expect(r.ok).toBe(false);
    expect(渡された指示.length).toBe(0);
  });

  it("ブランドが 1 つも無いときも、勝手な文言をでっち上げない", async () => {
    const r = await 走らせる(一覧で答える保存先([]));
    expect(r.ok).toBe(false);
    expect(渡された指示.length).toBe(0);
  });

  it("保存先が読めないときは、既定値なしで進めずに理由を返す", async () => {
    渡された指示.length = 0;
    const 落ちる保存先: BrandRepositoryPort = {
      findById: async () => {
        throw new Error("使わない");
      },
      list: async () =>
        ({ ok: false, error: { code: "UNAVAILABLE", message: "保存先が落ちています。" } }) as never,
      save: async () => {
        throw new Error("使わない");
      },
    };
    const r = await createDraftContentVariantUseCase({
      llm: 記録するLLM,
      costs: 見積り,
      brands: 落ちる保存先,
    }).execute(anOwner(), { model: MODEL, provided: 免責なしの入力 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UNAVAILABLE");
    expect(渡された指示.length).toBe(0);
  });
});
