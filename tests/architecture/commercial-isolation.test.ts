import { describe, expect, it } from "vitest";
import { createRankProductsUseCase } from "@/application/usecases/ranking/rank-products";
import type {
  EditorialRankingModelRepositoryPort,
  EditorialScoreCardRepositoryPort,
} from "@/application/ports/ranking";
import { createListConversionsUseCase } from "@/application/usecases/monetization/manage-affiliate";
import { createDeps } from "@/infrastructure/composition";
import { markCommercial, markEditorial, readDataClass } from "@/domain/shared";

/**
 * 「ランキングに報酬を入れられない」ことを、型と実行時の 2 段で確認する。
 *
 * 型だけでは `as any` で外せる。実行時の印だけでは書き忘れが起きる。
 * 両方あって初めて「仕組みで守られている」と言える。
 */

const stubModels = {
  findById: async () => ({ ok: true as const, value: null }),
  list: async () => ({ ok: true as const, value: { items: [], nextCursor: null } }),
  save: async (m: never) => ({ ok: true as const, value: m }),
};

const stubCards = {
  listByModel: async () => ({ ok: true as const, value: [] }),
  save: async (c: never) => ({ ok: true as const, value: c }),
};

describe("Editorial / Commercial の遮断", () => {
  it("Editorial 印のポートは受け付ける", () => {
    const deps = {
      rankingModels: markEditorial({ ...stubModels }) as unknown as EditorialRankingModelRepositoryPort,
      scoreCards: markEditorial({ ...stubCards }) as unknown as EditorialScoreCardRepositoryPort,
    };
    expect(() => createRankProductsUseCase(deps)).not.toThrow();
  });

  it("Commercial 印のポートを型を外して渡すと、組み立て時に失敗する", () => {
    // `as any` 相当の抜け道を意図的に通す。ここで落ちなければ守られていない。
    const commercialPort = markCommercial({ ...stubModels });
    const deps = {
      rankingModels: commercialPort as unknown as EditorialRankingModelRepositoryPort,
      scoreCards: markEditorial({ ...stubCards }) as unknown as EditorialScoreCardRepositoryPort,
    };
    expect(() => createRankProductsUseCase(deps)).toThrow(/商業データ/);
  });

  it("つなぎ目一式をまるごと渡すことは、型として許されない", () => {
    // この 1 行が「型で止まっている」ことの機械的な証拠。
    // 守りが外れると @ts-expect-error が余分になり、型検査が失敗する。
    const all = createDeps();
    // @ts-expect-error 商業側のつなぎ目を含む一式は、順位づけへ渡せない
    expect(() => createRankProductsUseCase(all)).toThrow(/商業データ/);
  });

  it("提携側は、商業の印が無いつなぎ目を受け取らない", () => {
    // 印の付け忘れをここで落とす。付け忘れたまま放っておくと、
    // 将来それを順位づけへ渡せてしまう。
    const deps = createDeps();
    expect(() =>
      createListConversionsUseCase({
        accounts: deps.affiliateAccounts,
        programs: deps.affiliatePrograms,
        links: deps.affiliateLinks,
        // 印を外したものを渡す。
        conversions: { ...deps.conversions } as typeof deps.conversions,
      }),
    ).toThrow(/商業データの印/);
  });

  it("印は実行時にも残る", () => {
    expect(readDataClass(markEditorial({}))).toBe("editorial");
    expect(readDataClass(markCommercial({}))).toBe("commercial");
    expect(readDataClass({})).toBeNull();
  });

  it("印は列挙されない (ログや JSON に混ざらない)", () => {
    const port = markCommercial({ a: 1 });
    expect(Object.keys(port)).toEqual(["a"]);
    expect(JSON.stringify(port)).toBe('{"a":1}');
  });
});

/**
 * 型レベルの確認。
 *
 * 下のコメントを外すとコンパイルエラーになることが、この仕組みの本体。
 * 自動テストでは実行時の印を確認し、型の側は `pnpm run typecheck` が担保する。
 *
 *   const bad: EditorialRankingModelRepositoryPort = markCommercial(stubModels);
 *   //    ^ Commercial 印は Editorial 印の位置へ代入できない
 */
