/**
 * @tier 2
 * @req REQ-TM05, REQ-TM06
 * @types decision-table, equivalence
 *
 * 計測点は画面に手で書かない。**部品が「自分が何であるか」を名乗る。**
 * 名乗れる種類は 2 つの一覧に限られている（要素と節）。
 *
 * ここを足した理由。2026-08-19 に測ったところ、この 2 つの一覧は
 * **どこからも見られていなかった。**
 *   - 要素の一覧から `affiliate_link` を落としても 4090 件すべて緑
 *   - 節の一覧から `evidence` を落としても緑
 *   - 記事の節から名乗り（`telemetrySectionAttrs`）を丸ごと外しても緑
 * 追跡表の判定欄は `tests/ui/ui-layers.test.ts` を指していたが、
 * **同ファイルに `telemetry` の文字は 1 つも無い。**
 *
 * 期待値は**手で書き写す**。一覧を回して当てると、1 行消えたときに
 * 繰り返しが 1 周短くなるだけで緑になる。
 */
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  TELEMETRY_ATTR,
  TELEMETRY_ELEMENT_KINDS,
  TELEMETRY_SECTION_KINDS,
  telemetryAttrs,
  telemetrySectionAttrs,
} from "@/presentation/ui/telemetry-attrs";
import { AffiliateLink } from "@/presentation/ui/patterns/disclosure";

/** 名乗れる要素の全種類。手で書き写した。 */
const EXPECTED_ELEMENT_KINDS = [
  "affiliate_link",
  "internal_link",
  "external_link",
  "cta_button",
  "ranking_row",
  "comparison_row",
  "product_card",
  "filter_control",
  "nav_item",
  "toc_item",
  "search_submit",
  "appearance_control",
];

/** 滞在時間を測る節の全種類。手で書き写した。 */
const EXPECTED_SECTION_KINDS = [
  "lead",
  "conclusion",
  "ranking",
  "comparison",
  "review",
  "faq",
  "evidence",
  "cta",
  "related",
];

describe("名乗れる種類の一覧", () => {
  it("要素の種類が、並び順まで含めてこの一覧である", () => {
    // 減ると、その種類の部品が計測から静かに落ちる。
    // 増えると、拾う側と画面の対応が知らないうちに広がる。どちらもここで止める。
    expect([...TELEMETRY_ELEMENT_KINDS]).toEqual(EXPECTED_ELEMENT_KINDS);
  });

  it("節の種類が、並び順まで含めてこの一覧である", () => {
    expect([...TELEMETRY_SECTION_KINDS]).toEqual(EXPECTED_SECTION_KINDS);
  });

  it("要素と節で、同じ名前を使い回していない", () => {
    // 使い回すと、拾う側が「これは要素か節か」を属性名だけで決められなくなる。
    const overlap = EXPECTED_ELEMENT_KINDS.filter((k) => EXPECTED_SECTION_KINDS.includes(k));
    expect(overlap).toEqual([]);
  });
});

describe("名乗り方", () => {
  it("種類と識別子は必ず出る", () => {
    const attrs = telemetryAttrs({ kind: "cta_button", id: "buy" });
    expect(attrs[TELEMETRY_ATTR.kind]).toBe("cta_button");
    expect(attrs[TELEMETRY_ATTR.id]).toBe("buy");
  });

  it("省略した欄は属性ごと出ない（空文字を出さない）", () => {
    // 空文字を出すと、拾う側で「未設定」と「空」が区別できない。
    const attrs = telemetryAttrs({ kind: "cta_button", id: "buy" });
    expect(TELEMETRY_ATTR.label in attrs).toBe(false);
    expect(TELEMETRY_ATTR.rank in attrs).toBe(false);
    expect(TELEMETRY_ATTR.placement in attrs).toBe(false);
  });

  it("印を付けない使い方（見本帳）では、属性が 1 つも付かない", () => {
    // 見本帳の操作が本物の数字に混ざらないための逃げ道。
    expect(telemetryAttrs(undefined)).toEqual({});
    expect(telemetrySectionAttrs(undefined)).toEqual({});
  });

  it("節は、識別子と種類の両方を出す", () => {
    const attrs = telemetrySectionAttrs({ kind: "evidence", id: "s1" });
    expect(attrs[TELEMETRY_ATTR.section]).toBe("s1");
    expect(attrs[TELEMETRY_ATTR.sectionKind]).toBe("evidence");
  });
});

describe("取りこぼせない印", () => {
  it("成果リンクは、画面が何も書かなくても必ず名乗る", () => {
    // 要件の中心。**画面側に付け忘れる余地を残さない。**
    render(
      <AffiliateLink href="/go/abc" linkId="l1">
        買う
      </AffiliateLink>,
    );
    const a = screen.getByRole("link", { name: "買う" });
    expect(a.getAttribute(TELEMETRY_ATTR.kind)).toBe("affiliate_link");
    expect(a.getAttribute(TELEMETRY_ATTR.id)).toBe("l1");
  });

  it("リンクIDが無くても名乗る（数は取りこぼさない）", () => {
    // 内訳は出せなくなるが、**数えられなくなるほうが害が大きい。**
    render(<AffiliateLink href="/go/abc">これを買う</AffiliateLink>);
    const a = screen.getByRole("link", { name: "これを買う" });
    expect(a.getAttribute(TELEMETRY_ATTR.kind)).toBe("affiliate_link");
    expect(a.getAttribute(TELEMETRY_ATTR.id)).not.toBe("");
  });

  it("リンク先そのものは印にしない", () => {
    // ASP のパラメータを計測の記録に持ち込まない。
    render(
      <AffiliateLink href="/go/abc?click_id=xyz" linkId="l1">
        こちらで買う
      </AffiliateLink>,
    );
    const a = screen.getByRole("link", { name: "こちらで買う" });
    for (const name of Object.values(TELEMETRY_ATTR)) {
      expect(a.getAttribute(name) ?? "").not.toContain("click_id");
    }
  });
});
