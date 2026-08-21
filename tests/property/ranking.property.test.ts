/** @tier 1 @req REQ-P04, REQ-SEC04, REQ-B12 @types property, boundary */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_RANKING_CRITERIA,
  PROHIBITED_RANKING_CRITERIA,
  type EditorialScoreCard,
  type RankingModel,
  createRankingModel,
  explainRank,
  rankProducts,
} from "@/domain/ranking";
import { taggedString } from "@/domain/shared";

/**
 * 順位づけの「常に成り立っていてほしいこと」を、例ではなく性質で確かめる。
 *
 * 例で書くテスト（`tests/domain/invariants.test.ts`）との違いは、
 * **入力を自分で選ばない**ところにある。
 * 例を選ぶのは書いた人なので、書いた人が想像しなかった形は永久に試されない。
 * ここでは fast-check に数百通りを作らせ、成り立たない組み合わせを探させる。
 *
 * 反例が見つかったときは、fast-check が最小の形まで縮めて出す。
 * その最小形は `tests/domain/` 側へ**例のテストとして写す**（回帰テストにする）。
 * 性質テストは毎回違う入力を試すので、同じ不具合を必ず再現する保証がない。
 *
 * 対応する要件: REQ-P04（比較エンジン・順位）、REQ-B03（順位の根拠表示）
 */

const WS = taggedString<"WorkspaceId">("ws_prop");

/** 重みの合計をきっちり 1.0 にする。整数で作ってから割る。 */
const criteriaArb = fc
  .uniqueArray(fc.constantFrom(...ALLOWED_RANKING_CRITERIA), { minLength: 1, maxLength: 7 })
  .chain((keys) =>
    fc
      .array(fc.integer({ min: 1, max: 100 }), { minLength: keys.length, maxLength: keys.length })
      .map((raw) => {
        const total = raw.reduce((s, n) => s + n, 0);
        return keys.map((key, i) => ({
          key,
          weight: raw[i] / total,
          measurement: "同一条件での実測",
          // 合格ラインを 0 にして「選外」を起こさせない。
          // 順位の性質を見たいのに、除外が混ざると原因が 2 つになる。
          passThreshold: 0,
        }));
      }),
  );

function modelOf(criteria: readonly { key: string; weight: number; measurement: string; passThreshold: number }[]): RankingModel {
  const built = createRankingModel({
    id: taggedString<"RankingModelId">("rm_prop"),
    workspaceId: WS,
    categoryId: taggedString<"CategoryId">("cat_prop"),
    version: "v1",
    audience: "性質検査",
    criteria,
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  });
  if (!built.ok) throw new Error(`前提が崩れた: ${built.error.message}`);
  return built.value;
}

const scoreArb = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

/** モデルと点数表を同時に作る。点数表の項目はモデルの項目と必ず一致させる。 */
const caseArb = criteriaArb.chain((criteria) =>
  fc
    .uniqueArray(
      fc.string({ minLength: 1, maxLength: 6 }).filter((s) => s.trim() !== ""),
      { minLength: 1, maxLength: 6 },
    )
    .chain((productIds) =>
      fc
        .array(fc.array(scoreArb, { minLength: criteria.length, maxLength: criteria.length }), {
          minLength: productIds.length,
          maxLength: productIds.length,
        })
        .map((scoreRows) => ({
          criteria,
          cards: productIds.map((pid, i): EditorialScoreCard => ({
            productId: taggedString<"ProductId">(pid),
            scores: Object.fromEntries(criteria.map((c, j) => [c.key, scoreRows[i][j]])),
            evidenceRefs: ["ev_1"],
            testedAt: null,
          })),
        })),
    ),
);

describe("順位づけの性質", () => {
  it("同じ入力なら、カードの並び順が違っても同じ順位になる（再現性）", () => {
    fc.assert(
      fc.property(caseArb, fc.integer({ min: 0, max: 1000 }), ({ criteria, cards }, rotate) => {
        const model = modelOf(criteria);
        const shift = rotate % cards.length;
        const rotated = [...cards.slice(shift), ...cards.slice(0, shift)];

        const a = rankProducts(model, cards);
        const b = rankProducts(model, rotated);
        expect(a.ok && b.ok).toBe(true);
        if (!a.ok || !b.ok) return;

        expect(b.value.ranked.map((r) => r.productId)).toEqual(
          a.value.ranked.map((r) => r.productId),
        );
      }),
    );
  });

  it("順位は合計点の降順で、同点は商品IDの昇順で決まる", () => {
    fc.assert(
      fc.property(caseArb, ({ criteria, cards }) => {
        const result = rankProducts(modelOf(criteria), cards);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const ranked = result.value.ranked;
        for (let i = 1; i < ranked.length; i++) {
          const prev = ranked[i - 1];
          const cur = ranked[i];
          expect(prev.totalScore).toBeGreaterThanOrEqual(cur.totalScore);
          if (prev.totalScore === cur.totalScore) {
            expect(String(prev.productId) < String(cur.productId)).toBe(true);
          }
        }
      }),
    );
  });

  it("順位番号は 1 から始まる連番になる", () => {
    fc.assert(
      fc.property(caseArb, ({ criteria, cards }) => {
        const result = rankProducts(modelOf(criteria), cards);
        if (!result.ok) return;
        expect(result.value.ranked.map((r) => r.rank)).toEqual(
          result.value.ranked.map((_, i) => i + 1),
        );
      }),
    );
  });

  it("入れた商品は必ず「順位あり」か「選外」のどちらか一方に現れる（消えない・重複しない）", () => {
    fc.assert(
      fc.property(caseArb, ({ criteria, cards }) => {
        const result = rankProducts(modelOf(criteria), cards);
        if (!result.ok) return;

        const appeared = [
          ...result.value.ranked.map((r) => String(r.productId)),
          ...result.value.excluded.map((e) => String(e.productId)),
        ];
        expect(appeared.length).toBe(cards.length);
        expect([...appeared].sort()).toEqual(cards.map((c) => String(c.productId)).sort());
      }),
    );
  });

  it("ある商品の点数を上げると、合計点は下がらず、順位も悪くならない（単調性）", () => {
    fc.assert(
      fc.property(
        caseArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        ({ criteria, cards }, cardPick, keyPick, bump) => {
          const model = modelOf(criteria);
          const target = cardPick % cards.length;
          const key = criteria[keyPick % criteria.length].key;

          const before = rankProducts(model, cards);
          if (!before.ok) return;

          const raised = cards.map((c, i) =>
            i === target
              ? {
                  ...c,
                  scores: {
                    ...c.scores,
                    [key]: Math.min(1, (c.scores[key] ?? 0) + bump),
                  },
                }
              : c,
          );
          const after = rankProducts(model, raised);
          if (!after.ok) return;

          const id = String(cards[target].productId);
          const b = before.value.ranked.find((r) => String(r.productId) === id);
          const a = after.value.ranked.find((r) => String(r.productId) === id);
          expect(b && a).toBeTruthy();
          if (!b || !a) return;

          expect(a.totalScore).toBeGreaterThanOrEqual(b.totalScore);
          expect(a.rank).toBeLessThanOrEqual(b.rank);
        },
      ),
    );
  });

  it("「最も効いた項目」は重み付き点数の最大、「最も足りない項目」は最小になる", () => {
    // ここは弱い assert が残りやすい場所。
    // 実際、`explainRank` の並べ替えを丸ごと外しても、
    // 「strongest が null でない」だけを見るテストでは気づけない。
    fc.assert(
      fc.property(caseArb, ({ criteria, cards }) => {
        const result = rankProducts(modelOf(criteria), cards);
        if (!result.ok) return;

        for (const r of result.value.ranked) {
          const explained = explainRank(result.value, r.productId);
          expect(explained.ok).toBe(true);
          if (!explained.ok) return;

          const weighted = r.breakdown.map((b) => b.weightedScore);
          expect(explained.value.strongest?.weightedScore).toBe(Math.max(...weighted));
          expect(explained.value.weakest?.weightedScore).toBe(Math.min(...weighted));
        }
      }),
    );
  });

  it("選外にした商品は、理由を尋ねると理由つきで断られる（黙って消えない）", () => {
    fc.assert(
      fc.property(caseArb, ({ criteria, cards }) => {
        // 合格ラインを上げて、選外を必ず起こす。
        const strict = criteria.map((c) => ({ ...c, passThreshold: 1 }));
        const result = rankProducts(modelOf(strict), cards);
        if (!result.ok) return;

        for (const e of result.value.excluded) {
          expect(e.reason.trim()).not.toBe("");
          expect(e.failedCriteria.length).toBeGreaterThan(0);
          const explained = explainRank(result.value, e.productId);
          expect(explained.ok).toBe(false);
          if (!explained.ok) expect(explained.error.message).toContain(e.reason);
        }
      }),
    );
  });
});

describe("報酬は順位の入力にならない", () => {
  it("禁止された評価基準は、重みや測定方法をどう書いても必ず拒否される", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PROHIBITED_RANKING_CRITERIA),
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (key, weight, measurement) => {
          const built = createRankingModel({
            id: taggedString<"RankingModelId">("rm_prop"),
            workspaceId: WS,
            categoryId: taggedString<"CategoryId">("cat_prop"),
            version: "v1",
            audience: "性質検査",
            criteria: [
              { key, weight, measurement, passThreshold: 0 },
              { key: "usability", weight: 1 - weight, measurement: "実測", passThreshold: 0 },
            ],
            effectiveFrom: new Date("2026-01-01T00:00:00Z"),
          });
          expect(built.ok).toBe(false);
          if (!built.ok) expect(built.error.code).toBe("COMMERCIAL_INPUT_REJECTED");
        },
      ),
    );
  });

  it("読者へ出す評価基準の一覧は、モデルの評価基準とちょうど同じになる（隠れた基準がない）", () => {
    fc.assert(
      fc.property(caseArb, ({ criteria, cards }) => {
        const model = modelOf(criteria);
        const result = rankProducts(model, cards);
        if (!result.ok) return;

        expect(result.value.criteriaDisclosure.map((c) => c.key)).toEqual(
          model.criteria.map((c) => c.key),
        );
        expect(result.value.criteriaDisclosure.map((c) => c.weight)).toEqual(
          model.criteria.map((c) => c.weight),
        );
      }),
    );
  });
});
