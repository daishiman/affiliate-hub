/** @tier 1 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  OPTIMIZATION_DIMENSIONS,
  assertRegistrable,
  type OptimizationDimension,
} from "@/domain/analytics/optimization";
import {
  MAX_SIMULTANEOUS_DIMENSIONS,
  type VariantSetting,
  type VariantSpec,
  approveVariantSpec,
  assertComparable,
  createVariantSpec,
  diffVariantSpecs,
  explainVariantSpec,
} from "@/domain/analytics/variant-spec";
import { createProvenance } from "@/domain/shared";

/**
 * 見せ方の設定（Variant Spec）が守るべき性質。
 *
 * ここは「配色も構成も同じ 1 つの形で表す」という設計の要になっていて、
 * 軸が増えるたびに例のテストを足す作りにすると、
 * **足し忘れた軸だけが検査されない**状態になる。
 * 登録表そのものから入力を作らせて、どの軸でも成り立つことを見る。
 *
 * 対応する要件: REQ-B16（見せ方の実験）、REQ-E14（同時に変える軸の上限）
 */

const PROVENANCE = (() => {
  const built = createProvenance({
    sourceType: "manual",
    sourceName: "性質検査",
    retrievedAt: new Date("2026-08-01T00:00:00Z"),
    confidence: 1,
    permittedUsage: "検査のみ",
  });
  if (!built.ok) throw new Error("前提が崩れた");
  return built.value;
})();

/** 登録表から、実際に登録してよい軸だけを取り出す。 */
const REGISTRABLE: readonly OptimizationDimension[] = OPTIMIZATION_DIMENSIONS.filter(
  (d) => assertRegistrable(d).ok,
);

function valueFor(dimension: OptimizationDimension, seed: number): VariantSetting {
  return {
    dimensionKey: dimension.key,
    value: dimension.candidateSource === "numeric" ? seed : `v${seed}`,
  };
}

const settingsArb = fc
  .uniqueArray(fc.constantFrom(...REGISTRABLE), { minLength: 1, maxLength: 4 })
  .chain((dimensions) =>
    fc
      .array(fc.integer({ min: 1, max: 9 }), {
        minLength: dimensions.length,
        maxLength: dimensions.length,
      })
      .map((seeds) => dimensions.map((d, i) => valueFor(d, seeds[i]))),
  );

function specOf(id: string, settings: readonly VariantSetting[]): VariantSpec {
  const built = createVariantSpec({ id, label: `設定 ${id}`, settings, provenance: PROVENANCE });
  if (!built.ok) throw new Error(`前提が崩れた: ${built.error.message}`);
  return built.value;
}

describe("登録表にある軸は、すべて同じ扱いで通る", () => {
  it("登録してよい軸なら、どれ 1 つでも設定を作れる", () => {
    fc.assert(
      fc.property(fc.constantFrom(...REGISTRABLE), fc.integer({ min: 1, max: 9 }), (d, seed) => {
        const built = createVariantSpec({
          id: "vs",
          label: "名前",
          settings: [valueFor(d, seed)],
          provenance: PROVENANCE,
        });
        expect(built.ok, `${d.key} が作れない`).toBe(true);
      }),
    );
  });

  it("登録表にない軸は、名前を何にしても受け付けない", () => {
    const known = new Set(OPTIMIZATION_DIMENSIONS.map((d) => d.key));
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20 }), (key) => {
        fc.pre(!known.has(key));
        const built = createVariantSpec({
          id: "vs",
          label: "名前",
          settings: [{ dimensionKey: key, value: "x" }],
          provenance: PROVENANCE,
        });
        expect(built.ok).toBe(false);
      }),
    );
  });
});

describe("差の取り方", () => {
  it("同じ設定どうしの差は空になる", () => {
    fc.assert(
      fc.property(settingsArb, (settings) => {
        const spec = specOf("a", settings);
        expect(diffVariantSpecs(spec, spec)).toEqual([]);
      }),
    );
  });

  it("左右を入れ替えると、同じ軸について値だけが入れ替わる", () => {
    fc.assert(
      fc.property(settingsArb, settingsArb, (a, b) => {
        const specA = specOf("a", a);
        const specB = specOf("b", b);
        const ab = diffVariantSpecs(specA, specB);
        const ba = diffVariantSpecs(specB, specA);

        expect(ba.map((d) => d.dimensionKey).sort()).toEqual(
          ab.map((d) => d.dimensionKey).sort(),
        );
        for (const d of ab) {
          const mirrored = ba.find((x) => x.dimensionKey === d.dimensionKey);
          expect(mirrored?.baseline).toBe(d.candidate);
          expect(mirrored?.candidate).toBe(d.baseline);
        }
      }),
    );
  });

  it("差として並ぶ軸は、必ず片方にしかない値か、違う値を持つ", () => {
    fc.assert(
      fc.property(settingsArb, settingsArb, (a, b) => {
        for (const d of diffVariantSpecs(specOf("a", a), specOf("b", b))) {
          expect(d.baseline).not.toBe(d.candidate);
        }
      }),
    );
  });
});

describe("一度に変えてよい数の上限", () => {
  it("差が無いか、上限を超えたら、比較は必ず断られる", () => {
    fc.assert(
      fc.property(settingsArb, settingsArb, (a, b) => {
        const specA = specOf("a", a);
        const specB = specOf("b", b);
        const diffs = diffVariantSpecs(specA, specB);
        const result = assertComparable(specA, specB);

        if (diffs.length === 0 || diffs.length > MAX_SIMULTANEOUS_DIMENSIONS) {
          expect(result.ok).toBe(false);
        } else {
          expect(result.ok).toBe(true);
        }
      }),
    );
  });

  it("断るときは、何を変えているかを文で示す（利用者が減らせる）", () => {
    fc.assert(
      fc.property(settingsArb, settingsArb, (a, b) => {
        const result = assertComparable(specOf("a", a), specOf("b", b));
        if (result.ok) return;
        expect(result.error.message.trim()).not.toBe("");
      }),
    );
  });
});

describe("承認", () => {
  it("承認できるのは 1 回だけ（二重承認にならない）", () => {
    fc.assert(
      fc.property(settingsArb, fc.string({ minLength: 1, maxLength: 8 }), (settings, who) => {
        fc.pre(who.trim() !== "");
        const spec = specOf("a", settings);
        const first = approveVariantSpec(spec, { approvedBy: who, at: new Date() });
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        const second = approveVariantSpec(first.value, { approvedBy: who, at: new Date() });
        expect(second.ok).toBe(false);
        if (!second.ok) expect(second.error.code).toBe("CONFLICT");
      }),
    );
  });

  it("作った直後は必ず未承認（作っただけで適用できない）", () => {
    fc.assert(
      fc.property(settingsArb, (settings) => {
        const spec = specOf("a", settings);
        expect(spec.approvedBy).toBeNull();
        expect(spec.approvedAt).toBeNull();
        expect(explainVariantSpec(spec)).toContain("未承認");
      }),
    );
  });
});

describe("経緯の説明", () => {
  it("設定した軸の値が、すべて説明文に現れる（黙って効く軸がない）", () => {
    fc.assert(
      fc.property(settingsArb, (settings) => {
        const text = explainVariantSpec(specOf("a", settings));
        for (const s of settings) expect(text).toContain(String(s.value));
      }),
    );
  });

  it("説明文には出どころが必ず入る", () => {
    fc.assert(
      fc.property(settingsArb, (settings) => {
        expect(explainVariantSpec(specOf("a", settings))).toContain(PROVENANCE.sourceName);
      }),
    );
  });
});
