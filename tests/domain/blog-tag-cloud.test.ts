/**
 * @tier 1
 * @req REQ-BLOG04, REQ-BOPS07
 * 受入条件 A8（`docs/spec/feat-blog-ops-crud/requirements-baseline.md`）に対応する。
 * `@req` は要件表の ID しか拾わないので、受入 ID はここに文章で残す。
 * @types boundary, equivalence
 *
 * サイドバーのブランド一覧（`brand-tag-cloud`）に何が出るかを当てる。
 *
 * **当てるのは「種類との関係」であって、特定のタグ名ではない。**
 * 「ノース工房が出る」と書くと、見本データの名前が変わった日にテストだけが落ちる。
 * 落ちた人は名前を書き換えて緑に戻し、**守っているものは減ったまま**になる。
 */
import { describe, expect, it } from "vitest";
import { BLOG_TAG_KINDS, brandTagCloud, isBlogTagKind } from "@/domain/blogops";

type Tag = { readonly kind: "brand" | "topic"; readonly name: string };

/** 種類ごとに 2 件ずつ。母集団の床をここに置く（`form2-population-floor`）。 */
const SAMPLE: readonly Tag[] = [
  { kind: "topic", name: "はじめかた" },
  { kind: "brand", name: "ヘーゼル製作所" },
  { kind: "topic", name: "選び方" },
  { kind: "brand", name: "ノース工房" },
];

describe("ブランド一覧に出るタグ", () => {
  it("見本に両方の種類が入っている", () => {
    // 片方しか無いと、「ブランドだけを出す」のか
    // 「たまたま全部出しているだけ」なのかが区別できない。
    for (const kind of BLOG_TAG_KINDS) {
      expect(
        SAMPLE.some((t) => t.kind === kind),
        `見本に ${kind} が 1 件もありません`,
      ).toBe(true);
    }
  });

  it("ブランド以外は 1 件も出ない", () => {
    const out = brandTagCloud(SAMPLE, 10);
    expect(out.length).toBeGreaterThan(0);
    for (const tag of out) {
      expect(tag.kind, `${tag.name} がブランド以外なのに出ています`).toBe("brand");
    }
  });

  it("ブランドは 1 件も落とさない（上限に余りがあるとき）", () => {
    const brands = SAMPLE.filter((t) => t.kind === "brand");
    expect(brandTagCloud(SAMPLE, SAMPLE.length)).toHaveLength(brands.length);
  });

  it("上限より多いときは上限で止まる", () => {
    expect(brandTagCloud(SAMPLE, 1)).toHaveLength(1);
  });

  it("上限が 0 以下なら空", () => {
    // 「上限 0」を「無制限」と読み替えない。読み替えると、
    // 設定を 0 にした運営者の意図（枠を出さない）が逆に働く。
    expect(brandTagCloud(SAMPLE, 0)).toEqual([]);
    expect(brandTagCloud(SAMPLE, -1)).toEqual([]);
  });

  it("並び順は保存順に依らない（枠が日替わりにならない）", () => {
    const forward = brandTagCloud(SAMPLE, 10).map((t) => t.name);
    const backward = brandTagCloud([...SAMPLE].reverse(), 10).map((t) => t.name);
    expect(backward).toEqual(forward);
  });

  it("元の配列を書き換えない", () => {
    const before = [...SAMPLE];
    brandTagCloud(SAMPLE, 10);
    expect(SAMPLE).toEqual(before);
  });

  it("知らない種類の文字列は種類として通さない", () => {
    for (const kind of BLOG_TAG_KINDS) expect(isBlogTagKind(kind)).toBe(true);
    for (const bad of ["", "Brand", "maker", "topic "]) {
      expect(isBlogTagKind(bad), `${bad} を種類として通しました`).toBe(false);
    }
  });
});
