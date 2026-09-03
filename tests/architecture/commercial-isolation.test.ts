/**
 * @tier 1
 * @req REQ-FD02
 * @types equivalence, decision-table
 */
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

  it("順位づけは、編集の印が無いつなぎ目を受け取らない", () => {
    // 型を外したうえで印を付け忘れた場合。実行時の印は、まさにこの回を
    // 捕まえるために置いてある。印無しを通すと、二段目が無い状態になる。
    const deps = {
      rankingModels: { ...stubModels } as unknown as EditorialRankingModelRepositoryPort,
      scoreCards: markEditorial({ ...stubCards }) as unknown as EditorialScoreCardRepositoryPort,
    };
    expect(() => createRankProductsUseCase(deps)).toThrow(/編集データの印/);
    expect(() => createRankProductsUseCase(deps)).toThrow(/rankingModels/);
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
        ids: deps.ids,
        auditLog: deps.auditLog,
        now: () => new Date(),
      }),
    ).toThrow(/商業データの印/);
  });

  /**
   * 印（editorial / commercial / 無し）× 渡し先（順位づけ / 提携）の**総当たり**。
   *
   * 2026-08-19 に測ったとき、6 通りのうち「印無しを順位づけへ渡す」1 通りだけが
   * 期待と食い違っていた。順位づけ側が `containsCommercial` だけを見ており、
   * **商業と名乗っているものしか落とさなかった**ためである。
   *
   * 2026-08-21 に**両方の入口を同じ向き（印が無ければ落とす）へ揃えた**。
   * 実行時の印は `as any` 相当で型を外した回を捕まえるために置いたもので、
   * その回はたいてい印も付いていない。付いていないものを通す形だと、
   * いちばん効いてほしい場面で二段目が無くなる。表はもう非対称ではない。
   *
   * 期待は**表として先に書く**。実装から作ると、印の意味が変わったとき期待も一緒に動く。
   */
  const 期待 = [
    { 印: "editorial", 渡し先: "順位づけ", 通る: true },
    { 印: "commercial", 渡し先: "順位づけ", 通る: false },
    // 印無しも落とす（fail-closed）。順位づけ側 `RANKING_DATA_PORTS` の判定。
    { 印: "無し", 渡し先: "順位づけ", 通る: false },
    { 印: "editorial", 渡し先: "提携", 通る: false },
    { 印: "commercial", 渡し先: "提携", 通る: true },
    { 印: "無し", 渡し先: "提携", 通る: false },
  ] as const;

  it.each(期待)("$印 の印を $渡し先 へ渡すと 通る=$通る", ({ 印, 渡し先, 通る }) => {
    const 付ける = <T extends object>(v: T) =>
      印 === "editorial" ? markEditorial(v) : 印 === "commercial" ? markCommercial(v) : v;

    const 組み立てる = () => {
      if (渡し先 === "順位づけ") {
        createRankProductsUseCase({
          rankingModels: 付ける({ ...stubModels }) as unknown as EditorialRankingModelRepositoryPort,
          scoreCards: markEditorial({ ...stubCards }) as unknown as EditorialScoreCardRepositoryPort,
        });
        return;
      }
      const deps = createDeps();
      createListConversionsUseCase({
        accounts: deps.affiliateAccounts,
        programs: deps.affiliatePrograms,
        links: deps.affiliateLinks,
        conversions: 付ける({ ...deps.conversions }) as typeof deps.conversions,
        ids: deps.ids,
        auditLog: deps.auditLog,
        now: () => new Date(),
      });
    };

    if (通る) expect(組み立てる).not.toThrow();
    else expect(組み立てる).toThrow(/商業データ/);
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
